/**
 * Deal Selector — Batch / Scheduled Posting
 *
 * Strict anti-duplication rules (any match = reject):
 *   - Same productId in PostedLog
 *   - Same normalized URL
 *   - Title similarity ≥ SIMILARITY_THRESHOLD (default 85%)
 *
 * FAIL-SAFE: If PostedLog is unavailable → return [] (never fallback to old deals).
 * FALLBACK:  If pool is thin → widen score floor to 15 (never reuse posted deals).
 *
 * Selection mix: 40% trending / 30% fresh / 30% random
 * Brand cap: weighted — slots distributed evenly across unique brands
 */

const Deal      = require('../models/Deal');
const PostedLog = require('../models/PostedLog');
const { scoreDeal }            = require('./dealScorer');
const {
  extractBrand,
  normalizeProduct,
  normalizeTitleForSimilarity,
  titleSimilarity,
} = require('./dedup');

const MIN_BRAND_DIVERSITY   = parseInt(process.env.MIN_BRAND_DIVERSITY        || '3',    10);
const SIMILARITY_THRESHOLD  = parseFloat(process.env.TITLE_SIMILARITY_THRESHOLD || '0.85');

// ── Utilities ─────────────────────────────────────────────────────────────────

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function takeUnique(pool, n, picked) {
  const out = [];
  for (const d of pool) {
    if (out.length >= n) break;
    const id = String(d._id);
    if (picked.has(id)) continue;
    picked.add(id);
    out.push(d);
  }
  return out;
}

/**
 * Weighted brand budget.
 * Max per brand = floor(totalLimit / max(MIN_BRAND_DIVERSITY, uniqueBrands)).
 * Ensures feed always has ≥ MIN_BRAND_DIVERSITY different brands.
 */
function applyBrandBudget(deals, totalLimit) {
  const uniqueBrands = new Set(deals.map((d) => extractBrand(d.title)));
  const brandBudget  = Math.max(1, Math.floor(totalLimit / Math.max(MIN_BRAND_DIVERSITY, uniqueBrands.size)));

  const brandCount = new Map();
  return deals.filter((d) => {
    const brand = extractBrand(d.title);
    const count = brandCount.get(brand) || 0;
    if (count >= brandBudget) return false;
    brandCount.set(brand, count + 1);
    return true;
  });
}

/**
 * Title similarity filter against a set of already-seen normalized titles.
 * O(candidates × postedTitles) — acceptable for ≤ 200 posted titles.
 */
function isTitleDuplicateOf(title, postedTitles) {
  const norm = normalizeTitleForSimilarity(title);
  if (!norm) return false;
  for (const posted of postedTitles) {
    if (titleSimilarity(norm, posted) >= SIMILARITY_THRESHOLD) return true;
  }
  return false;
}

// ── Main export ───────────────────────────────────────────────────────────────

/**
 * Fetch unique, never-posted deals from DB.
 *
 * FAIL-SAFE:
 *   - PostedLog unavailable → return [] (never post stale deals to fill quota)
 *   - Pool too small at minScore → widen to 15 (never reuse posted deals)
 *   - Pool still empty → return [] (explicit empty, no fallback to old deals)
 *
 * @param {object} opts
 * @param {string} [opts.platform]     Filter by platform
 * @param {number} [opts.limit=10]     Max deals to return
 * @param {number} [opts.minScore=25]  Min score; auto-lowered to 15 if pool thin
 */
async function getFreshDeals({ platform, limit = 10, minScore = 25 } = {}) {
  // ── Step 1: Load PostedLog blocklist ─────────────────────────────────────
  let blockedKeys;
  let postedTitleKeys;

  try {
    const blocked = await PostedLog
      .find(platform ? { platform } : {})
      .select('productId platform titleKey')
      .lean();

    blockedKeys    = new Set(blocked.map((l) => `${l.productId}:${l.platform}`));
    postedTitleKeys = blocked
      .map((l) => normalizeTitleForSimilarity(l.titleKey || ''))
      .filter(Boolean);
  } catch (err) {
    // FAIL CLOSED: PostedLog unavailable — return empty rather than risk repeats
    require('../../utils/logger').error(
      `[DealSelector] PostedLog query failed: ${err.message}. Returning [] to prevent duplicate posts.`
    );
    return [];
  }

  // ── Step 2: Fetch candidates from Deal collection ─────────────────────────
  async function fetchPool(scoreFloor) {
    const query = { price: { $gt: 0 }, score: { $gte: scoreFloor } };
    if (platform) query.platform = platform;

    const candidates = await Deal.find(query)
      .sort({ score: -1, createdAt: -1 })
      .limit(limit * 10)  // over-fetch to survive similarity filtering
      .lean();

    return candidates.filter((d) => {
      // Check 1: productId in PostedLog
      const { productId } = normalizeProduct(d);
      if (blockedKeys.has(`${productId}:${d.platform}`)) return false;

      // Check 2: Title similarity against posted titles
      if (postedTitleKeys.length > 0 && isTitleDuplicateOf(d.title, postedTitleKeys)) return false;

      return true;
    });
  }

  let pool = await fetchPool(minScore);

  // Widen score floor if pool is thin — NEVER reuse posted deals
  if (pool.length < limit && minScore > 15) {
    pool = await fetchPool(15);
  }

  // FAIL-SAFE: no new deals → return empty (never fallback to old deals)
  if (pool.length === 0) return [];

  // ── Step 3: Score with jitter for rotation variety ────────────────────────
  const scored = pool.map((d) => ({
    ...d,
    _liveScore: scoreDeal(d, d.dealType, true),  // ±8 randomness
  }));

  // ── Step 4: 40% trending / 30% fresh / 30% random ────────────────────────
  const nTrending = Math.ceil(limit * 0.4);
  const nFresh    = Math.ceil(limit * 0.3);
  const nRandom   = limit - nTrending - nFresh;

  const byScore = [...scored].sort((a, b) => b._liveScore - a._liveScore);
  const byDate  = [...scored].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  const byRand  = shuffle(scored);

  const picked   = new Set();
  const selected = [
    ...takeUnique(byScore, nTrending, picked),
    ...takeUnique(byDate,  nFresh,    picked),
    ...takeUnique(byRand,  nRandom,   picked),
  ];

  // ── Step 5: Brand budget + final shuffle ──────────────────────────────────
  return shuffle(applyBrandBudget(selected, limit));
}

/**
 * Safe prune — only removes UNPOSTED deals older than 48h.
 * Posted deals are never deleted; PostedLog is the dedup authority.
 * @returns {number} count of pruned documents
 */
async function safePruneDeals() {
  const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000);
  const { deletedCount } = await Deal.deleteMany({ posted: false, createdAt: { $lt: cutoff } });
  return deletedCount;
}

module.exports = { getFreshDeals, safePruneDeals };
