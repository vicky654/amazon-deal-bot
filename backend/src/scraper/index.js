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

const PLATFORM_MAP = [
  { pattern: /amazon\.(in|com)/i,  platform: 'amazon',   fn: scrapeAmazon   },
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
 * Scrape any supported product URL.
 *
 * @param {string} url
 * @returns {Promise<object>} Standardised deal object
 */
async function scrapeProduct(url) {
  const entry = detectPlatform(url);
  if (!entry) throw new Error(`Unsupported platform for URL: ${url}`);

  logger.info(`[Scraper] Platform detected: ${entry.platform} — ${url}`);
  return entry.fn(url);
}

module.exports = { scrapeProduct, detectPlatform };
