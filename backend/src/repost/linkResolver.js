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

// ── ASIN validation cache (2-hour TTL) ───────────────────────────────────────
// Prevents hitting amazon.in for the same ASIN on every repost message.
const _asinCache = new Map(); // asin → { result, expireAt }
const ASIN_CACHE_TTL = 2 * 60 * 60 * 1000;

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

// ── Request headers ───────────────────────────────────────────────────────────

const FOLLOW_HEADERS = {
  'User-Agent':      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Accept':          'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-IN,en;q=0.9',
};

// ── Redirect follower ─────────────────────────────────────────────────────────

async function followRedirects(url) {
  try {
    const response = await axios.get(url, {
      maxRedirects:   10,
      timeout:        8000,
      validateStatus: () => true,
      headers:        FOLLOW_HEADERS,
    });
    return response.request?.res?.responseUrl || response.config?.url || url;
  } catch (err) {
    logger.debug(`[LinkResolver] Redirect follow failed for ${url.slice(0, 60)}: ${err.message}`);
    return null;
  }
}

// ── Product URL validator ─────────────────────────────────────────────────────
//
// Verifies that https://www.amazon.in/dp/{ASIN} resolves to a real product page.
// Rejects:
//   - HTTP non-200
//   - Homepage redirects (URL lost /dp/)
//   - "Page not found" / 404 pages
//   - CAPTCHA / bot-wall pages
//   - Blank/tiny responses
//
// Returns { valid: true } or { valid: false, reason: string }

async function _doValidateProductUrl(asin) {
  const url = `https://www.amazon.in/dp/${asin}`;
  logger.info(`[ASIN] Validating ${asin} → ${url}`);

  let response;
  try {
    response = await axios.get(url, {
      headers:        FOLLOW_HEADERS,
      maxRedirects:   5,
      timeout:        10000,
      validateStatus: () => true,
    });
  } catch (err) {
    logger.warn(`[ASIN] ${asin} — network error: ${err.message}`);
    return { valid: false, reason: `network-error: ${err.message}` };
  }

  const status   = response.status;
  const finalUrl = (response.request?.res?.responseUrl || response.config?.url || url).toLowerCase();
  const html     = typeof response.data === 'string' ? response.data : '';

  if (status === 404) {
    logger.warn(`[ASIN] Rejected ${asin}: HTTP 404`);
    return { valid: false, reason: 'http-404' };
  }

  if (status !== 200) {
    logger.warn(`[ASIN] Rejected ${asin}: HTTP ${status}`);
    return { valid: false, reason: `http-${status}` };
  }

  if (!finalUrl.includes('/dp/')) {
    logger.warn(`[ASIN] Rejected ${asin}: homepage-redirect (final=${finalUrl.slice(0, 60)})`);
    return { valid: false, reason: 'homepage-redirect' };
  }

  if (/looking for something\?|page not found|this page doesn.t exist|we couldn.t find that page/i.test(html)) {
    logger.warn(`[ASIN] Rejected ${asin}: page-not-found in HTML`);
    return { valid: false, reason: 'page-not-found' };
  }

  if (/captcha|robot check|enter the characters/i.test(html)) {
    logger.warn(`[ASIN] ${asin}: captcha on validation — accepting with warning`);
    return { valid: true, reason: 'captcha-warning' };
  }

  if (html.length < 5000) {
    logger.warn(`[ASIN] Rejected ${asin}: response too small (${html.length} bytes)`);
    return { valid: false, reason: 'blank-page' };
  }

  const hasProduct = /productTitle|priceblock|corePriceDisplay|buyNow|add-to-cart/i.test(html);
  if (!hasProduct) {
    logger.warn(`[ASIN] Rejected ${asin}: no product indicators found`);
    return { valid: false, reason: 'product-page-missing' };
  }

  logger.info(`[ASIN] ${asin} valid ✅ (${html.length} bytes, final=${finalUrl.slice(0, 60)})`);
  return { valid: true };
}

async function validateProductUrl(asin) {
  const cached = _asinCache.get(asin);
  if (cached && cached.expireAt > Date.now()) {
    logger.debug(`[ASIN] ${asin} — cache hit (valid=${cached.result.valid})`);
    return cached.result;
  }
  const result = await _doValidateProductUrl(asin);
  // Cache all results except transient network errors
  if (!result.reason?.startsWith('network-error')) {
    _asinCache.set(asin, { result, expireAt: Date.now() + ASIN_CACHE_TTL });
  }
  return result;
}

// ── Main resolver ─────────────────────────────────────────────────────────────

/**
 * Given an array of URL candidates, return the first resolved + validated Amazon deal.
 *
 * @param {string[]} urls
 * @returns {Promise<{ asin, affiliateUrl, originalUrl } | null>}
 */
async function resolveAmazonLink(urls) {
  for (const url of urls) {
    if (!url) continue;

    let asin       = null;
    let resolvedUrl = url;

    // Quick path: already a clean Amazon .in URL with ASIN
    if (isAmazonUrl(url)) {
      asin = extractAsin(url);
      if (asin) {
        logger.info(`[LinkResolver] Direct Amazon URL → ASIN=${asin}`);
      }
    }

    // Redirect path: amzn.to, bit.ly, custom domain, or Amazon URL without ASIN
    if (!asin) {
      const finalUrl = await followRedirects(url);
      if (!finalUrl) continue;

      resolvedUrl = finalUrl;

      if (isAmazonUrl(finalUrl)) {
        asin = extractAsin(finalUrl);
        if (asin) {
          logger.info(`[LinkResolver] Resolved ${url.slice(0, 40)} → ASIN=${asin} final=${finalUrl.slice(0, 60)}`);
        }
      }
    }

    if (!asin) {
      logger.debug(`[LinkResolver] No ASIN found in ${url.slice(0, 60)}`);
      continue;
    }

    // ── Validate the product page actually exists on amazon.in ───────────────
    const validation = await validateProductUrl(asin);
    if (!validation.valid) {
      logger.warn(`[LinkResolver] ASIN=${asin} rejected: ${validation.reason} — skipping`);
      continue;
    }

    const affiliateUrl = buildAffiliateUrl(asin);
    logger.info(`[LinkResolver] ✅ ASIN=${asin} validated → ${affiliateUrl}`);
    return { asin, affiliateUrl, originalUrl: resolvedUrl };
  }

  return null;
}

module.exports = { resolveAmazonLink, buildAffiliateUrl, extractAsin, isAmazonUrl };
