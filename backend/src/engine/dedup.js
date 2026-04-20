/**
 * Dedup — Product Identity + PostedLog Interface
 *
 * Single source of truth for:
 *   normalizeProduct()  — stable productId from any platform
 *   isAlreadyPosted()   — PostedLog lookup (fail-open on DB error)
 *   markAsPosted()      — idempotent upsert with retry
 *   extractBrand()      — brand token for per-cycle frequency cap
 */

const crypto    = require('crypto');
const PostedLog = require('../models/PostedLog');
const logger    = require('../../utils/logger');

/**
 * Derive a stable, platform-scoped product identity.
 *
 * Amazon:  ASIN — survives any URL variant (tracking params, category paths, etc.)
 * Others:  SHA-256 of stripped canonical URL path (query + fragment removed)
 *
 * Returns { productId: string, platform: string }
 */
function normalizeProduct(product) {
  if (product.asin && /^[A-Z0-9]{10}$/i.test(product.asin)) {
    return {
      productId: product.asin.toUpperCase(),
      platform:  product.platform || 'amazon',
    };
  }

  const rawUrl = (product.originalLink || product.url || product.link || '').trim();
  const clean  = rawUrl.split('?')[0].split('#')[0].replace(/\/+$/, '').toLowerCase();

  if (!clean) {
    // Last resort: hash the normalized title
    const titleFallback = (product.title || '').toLowerCase().replace(/\s+/g, '-');
    return {
      productId: crypto.createHash('sha256').update(titleFallback).digest('hex').slice(0, 16),
      platform:  product.platform || 'unknown',
    };
  }

  return {
    productId: crypto.createHash('sha256').update(clean).digest('hex').slice(0, 16),
    platform:  product.platform || 'unknown',
  };
}

/**
 * Extract brand token from product title.
 * First meaningful word (lowercased, stripped of punctuation).
 */
function extractBrand(title) {
  return (title || '')
    .trim()
    .split(/\s+/)[0]
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

/**
 * Check whether this product was posted within the last 5 days.
 * Fails OPEN on DB error — never block a deal due to infrastructure flakiness.
 */
async function isAlreadyPosted(productId, platform) {
  try {
    const found = await PostedLog.exists({ productId, platform });
    return !!found;
  } catch (err) {
    logger.warn(`[Dedup] PostedLog lookup failed for ${productId}@${platform}: ${err.message} — allowing through`);
    return false;
  }
}

/**
 * Write to PostedLog. Idempotent — safe to call multiple times.
 *
 * Uses findOneAndUpdate with upsert so a duplicate-key from a concurrent write
 * is silently absorbed (not an error). Retries once after 2 s on failure.
 *
 * If BOTH attempts fail: logs CRITICAL. The deal is already on Telegram but
 * unlogged — it WILL repost next cycle. A monitoring alert should fire here.
 */
async function markAsPosted(productId, platform, titleKey = null) {
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      await PostedLog.findOneAndUpdate(
        { productId, platform },
        { $setOnInsert: { titleKey, postedAt: new Date() } },
        { upsert: true },
      );
      return;
    } catch (err) {
      if (attempt === 1) {
        await new Promise((r) => setTimeout(r, 2000));
      } else {
        logger.error(
          `[Dedup] CRITICAL: markAsPosted failed after 2 attempts — ` +
          `product ${productId}@${platform} posted to Telegram but PostedLog NOT written. ` +
          `Will repost next cycle. DB error: ${err.message}`
        );
      }
    }
  }
}

module.exports = { normalizeProduct, extractBrand, isAlreadyPosted, markAsPosted };
