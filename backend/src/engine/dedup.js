/**
 * Dedup — Deal Selection Engine
 *
 * Four-layer duplicate guard (in evaluation order):
 *
 *   Layer 1  _pendingPost       In-flight concurrency guard (synchronous, zero-latency)
 *   Layer 2  _lastPostedIds     Capped in-memory Set (200 entries, LRU-evict oldest)
 *                               Survives DB failures within a process session
 *   Layer 3  PostedLog (Mongo)  Persistent 5-day TTL store (cross-restart authority)
 *   Layer 4  Title similarity   Bigram Jaccard ≥ SIMILARITY_THRESHOLD → reject
 *                               Catches same product with slightly changed titles
 *
 * DUPLICATE DEFINITION (any match = reject):
 *   - Same productId (ASIN or SHA-256 URL hash)
 *   - Same normalized URL (tracking params stripped)
 *   - Title bigram similarity ≥ 85%
 *
 * FAIL-SAFE:
 *   If PostedLog is unavailable → _lastPostedIds still blocks repeats from this session.
 *   If both fail → title similarity still catches near-duplicates.
 *   System NEVER returns an empty array to fill a quota with old deals.
 */

const crypto    = require('crypto');
const PostedLog = require('../models/PostedLog');
const logger    = require('../../utils/logger');

// ── Configuration ─────────────────────────────────────────────────────────────
const SIMILARITY_THRESHOLD  = parseFloat(process.env.TITLE_SIMILARITY_THRESHOLD || '0.85');
const POSTED_IDS_MAX_SIZE   = parseInt(process.env.POSTED_IDS_MAX_SIZE || '200', 10);

// ── Layer 1: In-flight guard ──────────────────────────────────────────────────
// Synchronous check+add. JS is single-threaded so no atomicity issues.
// Key: `${productId}:${platform}`
const _pendingPost = new Set();

// ── Layer 2: Capped in-memory posted IDs (LRU-evict, size 200) ───────────────
// Populated on every successful AND failed markAsPosted — survives DB downtime.
// Keys are same as PostedLog: `${productId}:${platform}`
const _lastPostedIds    = new Set();
const _lastPostedQueue  = [];  // FIFO for eviction order

function _addToPostedCache(key) {
  if (_lastPostedIds.has(key)) return;
  if (_lastPostedIds.size >= POSTED_IDS_MAX_SIZE) {
    const evict = _lastPostedQueue.shift();
    _lastPostedIds.delete(evict);
  }
  _lastPostedIds.add(key);
  _lastPostedQueue.push(key);
}

// ── Layer 4: Title similarity store ──────────────────────────────────────────
// Stores normalized posted titles (capped at POSTED_IDS_MAX_SIZE).
const _postedTitleKeys  = [];   // Array<string> — normalized titles of posted deals

// ── Dynamic cooldown by deal score ────────────────────────────────────────────
function getCooldownMs(score) {
  if (score >= 75) return 7 * 24 * 60 * 60 * 1000;  // hot   → 7 days
  if (score >= 55) return 5 * 24 * 60 * 60 * 1000;  // good  → 5 days
  if (score >= 35) return 3 * 24 * 60 * 60 * 1000;  // ok    → 3 days
  return              2 * 24 * 60 * 60 * 1000;       // weak  → 2 days
}

// ─────────────────────────────────────────────────────────────────────────────
// PRODUCT IDENTITY
// ─────────────────────────────────────────────────────────────────────────────

// Tracking params to strip from all platform URLs before hashing
const TRACKING_PARAMS = new Set([
  'ref', 'ref_', 'tag', 'linkCode', 'camp', 'creative', 'creativeASIN',
  'psc', 'smid', 'th', 'pf_rd_r', 'pf_rd_p', 'pd_rd_r', 'pd_rd_w',
  'pd_rd_wg', 'sr', 'keywords', 'qid', 's', 'sprefix', 'crid', 'spLa',
  'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
  'fbclid', 'gclid', 'msclkid', 'yclid', '_encoding',
]);

/**
 * Strip tracking params and return a clean, stable URL string.
 * Used both for hashing (productId) and as a secondary duplicate signal.
 */
function normalizeUrl(url) {
  if (!url) return '';
  try {
    const u = new URL(url.trim());
    for (const param of TRACKING_PARAMS) {
      u.searchParams.delete(param);
    }
    const qs = u.searchParams.toString();
    return (u.origin + u.pathname).replace(/\/+$/, '').toLowerCase() + (qs ? `?${qs}` : '');
  } catch {
    return url.split('?')[0].replace(/\/+$/, '').toLowerCase();
  }
}

/**
 * Derive a stable, platform-scoped product identity.
 *
 * Amazon:  ASIN (10-char alphanumeric) — survives all URL variants.
 * Others:  SHA-256 of normalized URL (tracking params stripped).
 * Fallback: SHA-256 of normalized title (no URL available).
 *
 * @returns {{ productId: string, platform: string, cleanUrl: string }}
 */
function normalizeProduct(product) {
  if (product.asin && /^[A-Z0-9]{10}$/i.test(product.asin)) {
    return {
      productId: product.asin.toUpperCase(),
      platform:  product.platform || 'amazon',
      cleanUrl:  normalizeUrl(product.originalLink || product.url || product.link || ''),
    };
  }

  const rawUrl  = (product.originalLink || product.url || product.link || '').trim();
  const cleanUrl = normalizeUrl(rawUrl);

  if (cleanUrl) {
    return {
      productId: crypto.createHash('sha256').update(cleanUrl).digest('hex').slice(0, 16),
      platform:  product.platform || 'unknown',
      cleanUrl,
    };
  }

  const titleHash = (product.title || 'unknown').toLowerCase().replace(/\s+/g, '-');
  return {
    productId: crypto.createHash('sha256').update(titleHash).digest('hex').slice(0, 16),
    platform:  product.platform || 'unknown',
    cleanUrl:  '',
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// TITLE SIMILARITY (Layer 4)
// ─────────────────────────────────────────────────────────────────────────────

const STOP_WORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'for', 'with', 'in', 'of', 'to', 'by',
  'at', 'is', 'it', 'on', 'as', 'be', 'was', 'are', 'from', 'this', 'that',
]);

// Unit suffixes: normalize away so "64GB" and "64 GB" both become a stable token
const UNIT_RE = /(\d+)\s*(gb|mb|tb|kg|g|ml|l|mah|w|hz|inch|cm|mm|")/gi;

/**
 * Normalize a product title for similarity comparison.
 * Lowercase, remove punctuation, collapse unit variants, drop stop words.
 */
function normalizeTitleForSimilarity(title) {
  return (title || '')
    .toLowerCase()
    .replace(UNIT_RE, (_, n, u) => `${n}${u.toLowerCase()}`)  // "64 GB" → "64gb"
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 1 && !STOP_WORDS.has(w))
    .join(' ')
    .trim();
}

/**
 * Compute bigram set from a space-tokenized string.
 * Single-token strings use unigrams as fallback.
 */
function getBigrams(str) {
  const tokens = str.split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return new Set();
  if (tokens.length === 1) return new Set(tokens);
  const bigrams = new Set();
  for (let i = 0; i < tokens.length - 1; i++) {
    bigrams.add(`${tokens[i]} ${tokens[i + 1]}`);
  }
  return bigrams;
}

/**
 * Bigram Jaccard similarity: |A ∩ B| / |A ∪ B|
 * Returns 0–1. Identical strings → 1. Completely different → 0.
 */
function titleSimilarity(titleA, titleB) {
  const a = normalizeTitleForSimilarity(titleA);
  const b = normalizeTitleForSimilarity(titleB);
  if (!a || !b) return 0;
  if (a === b) return 1;

  const bigramsA = getBigrams(a);
  const bigramsB = getBigrams(b);

  let intersect = 0;
  for (const bg of bigramsA) {
    if (bigramsB.has(bg)) intersect++;
  }

  const union = bigramsA.size + bigramsB.size - intersect;
  return union === 0 ? 1 : intersect / union;
}

/**
 * Check whether a title is too similar to any recently posted deal.
 * O(N) scan of _postedTitleKeys (capped at 200 — acceptable cost).
 *
 * @param {string} title  Raw product title from scraper
 * @returns {boolean}
 */
function isTitleDuplicate(title) {
  if (_postedTitleKeys.length === 0) return false;
  const normalized = normalizeTitleForSimilarity(title);
  if (!normalized) return false;

  for (const posted of _postedTitleKeys) {
    if (titleSimilarity(normalized, posted) >= SIMILARITY_THRESHOLD) {
      return true;
    }
  }
  return false;
}

// ─────────────────────────────────────────────────────────────────────────────
// BRAND EXTRACTION
// ─────────────────────────────────────────────────────────────────────────────

const SKIP_PREFIXES = new Set([
  'renewed', 'refurbished', 'combo', 'generic', 'pack', 'set', 'buy', 'new',
]);

function extractBrand(title) {
  const words = (title || '').trim().toLowerCase().split(/\s+/);
  for (const word of words) {
    const clean = word.replace(/[^a-z0-9]/g, '');
    if (clean.length > 1 && !SKIP_PREFIXES.has(clean)) return clean;
  }
  return 'unknown';
}

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * LAYER 1 — Synchronous in-flight guard.
 * Call BEFORE any await. JS single-thread makes check+add atomic.
 *
 * @returns {boolean} true if claim succeeded (product is yours to process)
 */
function claimInflight(productId, platform) {
  const key = `${productId}:${platform}`;
  if (_pendingPost.has(key)) return false;
  _pendingPost.add(key);
  return true;
}

function releaseInflight(productId, platform) {
  _pendingPost.delete(`${productId}:${platform}`);
}

/**
 * LAYERS 1-4 — Full duplicate check.
 *
 * Evaluation order (fast → slow):
 *   1. _pendingPost (sync Set lookup)
 *   2. _lastPostedIds (sync Set lookup)
 *   3. PostedLog DB (async, authoritative — fails OPEN on error)
 *   4. Title similarity (O(200) scan — only if all above pass)
 *
 * @returns {Promise<boolean>}  true = duplicate, reject this deal
 */
async function isAlreadyPosted(productId, platform, title = null) {
  const key = `${productId}:${platform}`;

  // Layer 1 + 2: synchronous, O(1)
  if (_pendingPost.has(key) || _lastPostedIds.has(key)) return true;

  // Layer 3: PostedLog DB — fails OPEN (infra flakiness must not silence deals)
  try {
    const found = await PostedLog.exists({ productId, platform });
    if (found) {
      _addToPostedCache(key);  // warm the in-memory cache for subsequent calls
      return true;
    }
  } catch (err) {
    logger.warn(`[Dedup] PostedLog lookup failed for ${key}: ${err.message} — proceeding to title check`);
  }

  // Layer 4: Title similarity — catches "Samsung Galaxy A23 5G 128GB Black" vs
  //          "Samsung Galaxy A23 5G 128GB Blue" (different variant, same product)
  if (title && isTitleDuplicate(title)) {
    logger.info(`[Dedup] Title similarity match (≥${SIMILARITY_THRESHOLD}): "${title.slice(0, 60)}"`);
    return true;
  }

  return false;
}

/**
 * Write to PostedLog + update all in-memory caches.
 *
 * Retry: 3 attempts, exponential backoff (2 s, 4 s).
 * On all failures: CRITICAL log + _lastPostedIds fallback activated.
 * In-memory stores are ALWAYS populated regardless of DB success.
 *
 * @param {string} productId
 * @param {string} platform
 * @param {string|null} titleKey   Normalized title for DB storage
 * @param {number} score           Deal score → drives dynamic cooldown
 */
async function markAsPosted(productId, platform, titleKey = null, score = 0) {
  const key      = `${productId}:${platform}`;
  const now      = new Date();
  const expireAt = new Date(now.getTime() + getCooldownMs(score));

  // Always update in-memory state — before DB write, so even a crash after
  // posting to Telegram but before DB write is partially protected.
  _addToPostedCache(key);
  if (titleKey) {
    if (_postedTitleKeys.length >= POSTED_IDS_MAX_SIZE) _postedTitleKeys.shift();
    _postedTitleKeys.push(normalizeTitleForSimilarity(titleKey));
  }

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      await PostedLog.findOneAndUpdate(
        { productId, platform },
        { $setOnInsert: { titleKey, postedAt: now, expireAt } },
        { upsert: true },
      );
      return;
    } catch (err) {
      if (attempt < 3) {
        await new Promise((r) => setTimeout(r, attempt * 2000));  // 2 s, 4 s
      } else {
        logger.error(
          `[Dedup] CRITICAL: markAsPosted failed after 3 attempts for ${key}. ` +
          `Product posted to Telegram but PostedLog NOT written. ` +
          `In-memory fallback is ACTIVE for this session only. Error: ${err.message}`
        );
      }
    }
  }
}

module.exports = {
  normalizeProduct,
  normalizeUrl,
  normalizeTitleForSimilarity,
  titleSimilarity,
  isTitleDuplicate,
  extractBrand,
  isAlreadyPosted,
  markAsPosted,
  claimInflight,
  releaseInflight,
  getCooldownMs,
};
