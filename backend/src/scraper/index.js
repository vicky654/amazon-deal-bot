/**
 * Scraper Router
 *
 * Detects platform from URL and dispatches to the correct scraper.
 * Returns a standardised deal object:
 *
 *   {
 *     platform:      'amazon' | 'flipkart' | 'myntra' | 'ajio',
 *     title:         string,
 *     price:         number,
 *     originalPrice: number | null,
 *     discount:      number | null,   // percentage
 *     image:         string | null,
 *     url:           string,          // canonical (possibly redirected) URL
 *   }
 */

const { scrapeAmazon }   = require('./amazon');
const { scrapeFlipkart } = require('./flipkart');
const { scrapeMyntra }   = require('./myntra');
const { scrapeAjio }     = require('./ajio');
const logger             = require('../../utils/logger');

const AMAZON_RE = /amazon\.(in|com)/i;

const PLATFORM_MAP = [
  { pattern: AMAZON_RE,            platform: 'amazon',   fn: scrapeAmazon   },
  { pattern: /flipkart\.com/i,     platform: 'flipkart', fn: scrapeFlipkart },
  { pattern: /myntra\.com/i,       platform: 'myntra',   fn: scrapeMyntra   },
  { pattern: /ajio\.com/i,         platform: 'ajio',     fn: scrapeAjio     },
];

function detectPlatform(url) {
  for (const entry of PLATFORM_MAP) {
    if (entry.pattern.test(url)) return entry;
  }
  return null;
}

/**
 * Scrape a product URL. Only Amazon URLs are processed; all others return null.
 *
 * @param {string} url
 * @returns {Promise<object|null>} Standardised deal object, or null for non-Amazon
 */
async function scrapeProduct(url) {
  if (!AMAZON_RE.test(url)) {
    logger.debug(`[Scraper] Non-Amazon URL skipped: ${url}`);
    return null;
  }

  const entry = detectPlatform(url);
  if (!entry) throw new Error(`Unsupported platform for URL: ${url}`);

  logger.info(`[Scraper] Platform detected: ${entry.platform} — ${url}`);
  return entry.fn(url);
}

module.exports = { scrapeProduct, detectPlatform };
