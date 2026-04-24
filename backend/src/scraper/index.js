/**
 * Amazon India Product Scraper — entry point
 *
 * All non-Amazon URLs are rejected (return null) so the crawler never
 * accidentally dispatches to a removed platform scraper.
 */

const { scrapeAmazon } = require('./amazon');
const logger           = require('../../utils/logger');

const AMAZON_RE = /amazon\.(in|com)/i;

async function scrapeProduct(url) {
  if (!AMAZON_RE.test(url)) {
    logger.debug(`[Scraper] Non-Amazon URL rejected: ${url}`);
    return null;
  }

  logger.info(`[Scraper] amazon → ${url}`);
  return scrapeAmazon(url);
}

module.exports = { scrapeProduct };
