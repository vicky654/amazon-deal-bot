/**
 * Hybrid Link Generator
 *
 * Flow:
 *   1. Try affiliate link (EarnKaro / Amazon tag) with strict timeout
 *   2. If affiliate fails or times out → fall back to original product URL
 *   3. Return both so the deal can store the full picture
 *
 * Timeout: AFFILIATE_TIMEOUT_MS env var (default 5000 ms).
 * Amazon: instant (tag append) — no timeout applied.
 * Flipkart / Myntra / Ajio: EarnKaro via affiliate queue (concurrency=1).
 */

const { buildAmazonAffiliateLink } = require('../affiliate/amazon');
const { generateEarnKaroLink }     = require('../affiliate/earnkaro');
const { getAffiliateQueue }        = require('../queue');
const logger                       = require('../../utils/logger');

const EARNKARO_PLATFORMS = new Set(['flipkart', 'myntra', 'ajio']);
const TIMEOUT_MS = parseInt(process.env.AFFILIATE_TIMEOUT_MS || '5000', 10);

function timeoutPromise(ms) {
  return new Promise((_, reject) =>
    setTimeout(() => reject(new Error(`Affiliate timeout after ${ms}ms`)), ms)
  );
}

/**
 * Generate the best available link for a product.
 *
 * @param {string} url       Original product URL
 * @param {string} platform  'amazon' | 'flipkart' | 'myntra' | 'ajio' | ...
 * @returns {Promise<{
 *   affiliateLink: string|null,
 *   originalLink:  string,
 *   finalLink:     string,
 *   isAffiliate:   boolean,
 * }>}
 */
async function generateFinalLink(url, platform) {
  const originalLink = url;
  let affiliateLink  = null;

  // ── Amazon: synchronous tag append, never fails ───────────────────────────
  if (platform === 'amazon') {
    try {
      affiliateLink = buildAmazonAffiliateLink(url);
      logger.info(`[LinkGen][Amazon] affiliate: ${affiliateLink}`);
    } catch (err) {
      logger.warn(`[LinkGen][Amazon] tag failed: ${err.message}`);
    }
  }

  // ── EarnKaro platforms: queued + hard timeout ──────────────────────────────
  else if (EARNKARO_PLATFORMS.has(platform)) {
    const queue        = getAffiliateQueue();
    const queuedTask   = queue.add(() => generateEarnKaroLink(url));

    try {
      affiliateLink = await Promise.race([queuedTask, timeoutPromise(TIMEOUT_MS)]);
      logger.info(`[LinkGen][${platform}] affiliate: ${affiliateLink}`);
    } catch (err) {
      logger.warn(`[LinkGen][${platform}] fallback — ${err.message}`);
      affiliateLink = null;
      // The queued Puppeteer task continues in background and closes its page.
      // The affiliate queue is concurrency=1 so no parallel sessions are opened.
    }
  }

  const isAffiliate = !!(affiliateLink && affiliateLink !== url);
  const finalLink   = isAffiliate ? affiliateLink : originalLink;

  return { affiliateLink: isAffiliate ? affiliateLink : null, originalLink, finalLink, isAffiliate };
}

module.exports = { generateFinalLink };
