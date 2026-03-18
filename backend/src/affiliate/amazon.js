/**
 * Amazon Affiliate Link Generator
 *
 * Appends the Associates tracking tag to any Amazon product URL.
 * No browser needed — pure URL manipulation.
 */

const TRACKING_ID = process.env.AMAZON_TRACKING_ID || 'dailydeal06f0-21';

const ASIN_PATTERNS = [
  /\/dp\/([A-Z0-9]{10})/i,
  /\/gp\/product\/([A-Z0-9]{10})/i,
  /\/product\/([A-Z0-9]{10})/i,
  /\/([A-Z0-9]{10})(?:[/?]|$)/,
];

function extractAsin(url) {
  if (!url) return null;
  for (const rx of ASIN_PATTERNS) {
    const m = url.match(rx);
    if (m) return m[1].toUpperCase();
  }
  return null;
}

/**
 * Build a clean affiliate link.
 * Format: https://www.amazon.in/dp/{ASIN}?tag={TRACKING_ID}
 *
 * @param {string} url  Any Amazon product URL
 * @returns {string}    Affiliate URL or original URL if ASIN not found
 */
function buildAmazonAffiliateLink(url) {
  const asin = extractAsin(url);
  if (!asin) return url; // Return as-is; caller can decide
  return `https://www.amazon.in/dp/${asin}?tag=${TRACKING_ID}`;
}

function isAmazonUrl(url) {
  return /amazon\.(in|com)/i.test(url) && (/\/dp\//.test(url) || /\/gp\/product\//.test(url));
}

module.exports = { buildAmazonAffiliateLink, extractAsin, isAmazonUrl };
