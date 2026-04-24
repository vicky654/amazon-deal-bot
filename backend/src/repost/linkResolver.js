'use strict';
/**
 * Amazon link resolver.
 *
 * For each URL candidate:
 *   1. Follow all redirects (amzn.to, bitly, etc.) via axios HEAD/GET
 *   2. Check if final URL is amazon.in
 *   3. Extract ASIN
 *   4. Build clean affiliate URL: https://www.amazon.in/dp/{ASIN}?tag={TAG}
 */

const axios  = require('axios');
const logger = require('../../utils/logger');

const AFFILIATE_TAG = process.env.REPOST_AFFILIATE_TAG || 'dailydeal06f0-21';

const AMAZON_DOMAINS = ['amazon.in', 'www.amazon.in', 'm.amazon.in'];

const ASIN_PATTERNS = [
  /\/dp\/([A-Z0-9]{10})/i,
  /\/gp\/product\/([A-Z0-9]{10})/i,
  /\/exec\/obidos\/ASIN\/([A-Z0-9]{10})/i,
  /\/product\/([A-Z0-9]{10})(?:\/|\?|$)/i,
  /[?&]asin=([A-Z0-9]{10})/i,
];

// ── URL utilities ─────────────────────────────────────────────────────────────

function isAmazonUrl(url) {
  try {
    return AMAZON_DOMAINS.includes(new URL(url).hostname);
  } catch (_) {
    return false;
  }
}

function extractAsin(url) {
  for (const pattern of ASIN_PATTERNS) {
    const m = url.match(pattern);
    if (m) return m[1].toUpperCase();
  }
  return null;
}

function buildAffiliateUrl(asin, tag = AFFILIATE_TAG) {
  return `https://www.amazon.in/dp/${asin}?tag=${tag}`;
}

// ── Redirect follower ─────────────────────────────────────────────────────────

const FOLLOW_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
  'Accept':     'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
};

async function followRedirects(url) {
  // Many shortened URLs (amzn.to, bit.ly) need a GET to follow the chain.
  // We stop at the first Amazon domain we encounter.
  try {
    const response = await axios.get(url, {
      maxRedirects:   10,
      timeout:        8000,
      validateStatus: () => true,
      headers:        FOLLOW_HEADERS,
      // Grab the final URL from the axios response
    });

    const finalUrl = response.request?.res?.responseUrl
      || response.config?.url
      || url;

    return finalUrl;
  } catch (err) {
    logger.debug(`[LinkResolver] Redirect follow failed for ${url.slice(0, 60)}: ${err.message}`);
    return null;
  }
}

// ── Main resolver ─────────────────────────────────────────────────────────────

/**
 * Given an array of URL candidates, return the first resolved Amazon deal.
 *
 * @param {string[]} urls
 * @returns {Promise<{ asin, affiliateUrl, originalUrl } | null>}
 */
async function resolveAmazonLink(urls) {
  for (const url of urls) {
    if (!url) continue;

    // Quick path: already a clean Amazon URL with ASIN
    if (isAmazonUrl(url)) {
      const asin = extractAsin(url);
      if (asin) {
        logger.debug(`[LinkResolver] Direct Amazon URL → ASIN=${asin}`);
        return { asin, affiliateUrl: buildAffiliateUrl(asin), originalUrl: url };
      }
    }

    // Redirect path: amzn.to, bit.ly, custom domain
    const finalUrl = await followRedirects(url);
    if (!finalUrl) continue;

    if (isAmazonUrl(finalUrl)) {
      const asin = extractAsin(finalUrl);
      if (asin) {
        logger.debug(`[LinkResolver] Resolved ${url.slice(0, 40)} → ASIN=${asin}`);
        return { asin, affiliateUrl: buildAffiliateUrl(asin), originalUrl: finalUrl };
      }
    }
  }

  return null;
}

module.exports = { resolveAmazonLink, buildAffiliateUrl, extractAsin, isAmazonUrl };
