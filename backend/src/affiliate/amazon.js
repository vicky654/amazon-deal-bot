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

/**
 * Build a clean affiliate URL from a deal object.
 * Priority: use stored affiliateLink if valid, otherwise rebuild from ASIN/URL.
 *
 * @param {object} deal  Deal document from DB (has asin, affiliateLink, finalLink, etc.)
 * @returns {string|null} Clean affiliate URL or null if ASIN can't be found
 */
function buildAffiliateUrl(deal) {
  // Already a valid affiliate link — use it directly
  if (deal.affiliateLink && isValidAffiliateUrl(deal.affiliateLink)) {
    return deal.affiliateLink;
  }

  // Rebuild from ASIN (most reliable)
  if (deal.asin && /^[A-Z0-9]{10}$/i.test(deal.asin)) {
    return `https://www.amazon.in/dp/${deal.asin.toUpperCase()}?tag=${TRACKING_ID}`;
  }

  // Extract ASIN from any stored URL
  const sourceUrl = deal.finalLink || deal.originalLink || deal.link || '';
  const asin = extractAsin(sourceUrl);
  if (asin) return `https://www.amazon.in/dp/${asin}?tag=${TRACKING_ID}`;

  return null;
}

/**
 * Validate that a URL is a proper Amazon affiliate link.
 * Must have: amazon.in domain, /dp/ path, tag= param.
 */
function isValidAffiliateUrl(url) {
  if (!url) return false;
  return (
    /amazon\.in/i.test(url) &&
    /\/dp\/[A-Z0-9]{10}/i.test(url) &&
    url.includes('tag=')
  );
}

module.exports = { buildAmazonAffiliateLink, buildAffiliateUrl, isValidAffiliateUrl, extractAsin, isAmazonUrl };
