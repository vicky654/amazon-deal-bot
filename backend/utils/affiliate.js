/**
 * Amazon Affiliate Link Builder
 * Generates clean Amazon affiliate links
 */

const TRACKING_ID = "dailydeal06f0-21";
const AMAZON_DOMAIN = "https://www.amazon.in";

/**
 * Extract ASIN from Amazon product URL
 * @param {string} url
 * @returns {string|null}
 */
function extractAsin(url) {

  if (!url || typeof url !== "string") {
    return null;
  }

  const patterns = [
    /\/dp\/([A-Z0-9]{10})/i,
    /\/gp\/product\/([A-Z0-9]{10})/i,
    /\/product\/([A-Z0-9]{10})/i,
    /\/([A-Z0-9]{10})(?:[/?]|$)/i
  ];

  for (const pattern of patterns) {

    const match = url.match(pattern);

    if (match && match[1]) {
      return match[1].toUpperCase();
    }

  }

  return null;
}

/**
 * Build clean Amazon affiliate link
 * @param {string} url
 * @returns {string}
 */
function buildAffiliateLink(url) {

  const asin = extractAsin(url);

  if (!asin) {
    throw new Error("Invalid Amazon URL. ASIN not found.");
  }

  return `${AMAZON_DOMAIN}/dp/${asin}?tag=${TRACKING_ID}`;
}

/**
 * Check if URL is Amazon product
 * @param {string} url
 * @returns {boolean}
 */
function isAmazonProductUrl(url) {

  if (!url) return false;

  return url.includes("amazon.in") && extractAsin(url) !== null;

}

module.exports = {
  buildAffiliateLink,
  extractAsin,
  isAmazonProductUrl
};