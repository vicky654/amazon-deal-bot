/**
 * Affiliate Link Router
 *
 * Amazon → direct tag append (instant, no browser)
 * Flipkart / Myntra / Ajio → EarnKaro (queued, concurrency=1)
 *
 * All callers use generateAffiliateLink(url) — platform is auto-detected.
 */

const { buildAmazonAffiliateLink } = require('./amazon');
const { generateEarnKaroLink }     = require('./earnkaro');
const { getAffiliateQueue }        = require('../queue');
const logger                       = require('../../utils/logger');

const EARNKARO_PLATFORMS = ['flipkart', 'myntra', 'ajio'];

/**
 * Generate the affiliate link for a given product URL.
 *
 * @param {string} url       Product URL (any supported platform)
 * @param {string} platform  Platform identifier from scraper
 * @returns {Promise<string>} Affiliate link
 */
async function generateAffiliateLink(url, platform) {
  if (platform === 'amazon') {
    const link = buildAmazonAffiliateLink(url);
    logger.info(`[Affiliate][Amazon] ${link}`);
    return link;
  }

  if (EARNKARO_PLATFORMS.includes(platform)) {
    // Push through the concurrency=1 affiliate queue so EarnKaro
    // never gets simultaneous requests from the same session
    const queue = getAffiliateQueue();
    return queue.add(() => generateEarnKaroLink(url));
  }

  logger.warn(`[Affiliate] No affiliate handler for platform: ${platform} — returning original URL`);
  return url;
}

module.exports = { generateAffiliateLink };
