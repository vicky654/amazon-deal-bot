/**
 * Category Link Extractor
 *
 * Uses axios + cheerio instead of Puppeteer for category pages.
 * Why: Category/search pages are server-side rendered — product links and
 * data-asin attributes appear in the initial HTML without JavaScript execution.
 * This is ~10x faster than Puppeteer and uses far less memory.
 *
 * Strategy:
 *   1. Fetch category page HTML via axios with browser-like headers
 *   2. Parse with cheerio and extract all /dp/ hrefs + data-asin attributes
 *   3. Normalise to clean ASIN-based URLs to prevent duplicates
 *   4. Apply inter-page delay to avoid rate limiting
 */

const axios = require('axios');
const cheerio = require('cheerio');
const { extractAsin } = require('../utils/affiliate');
const logger = require('../utils/logger');

/*
 * ─── CONSTANTS ───────────────────────────────────────────────────────────────
 */

const AMAZON_BASE = 'https://www.amazon.in';
const REQUEST_TIMEOUT_MS = 18000;
const PAGE_DELAY_MIN_MS = 2000;
const PAGE_DELAY_MAX_MS = 5000;
const CATEGORY_DELAY_MIN_MS = 3000;
const CATEGORY_DELAY_MAX_MS = 7000;

// Rotate through common browser user agents to reduce detection
const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:124.0) Gecko/20100101 Firefox/124.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:124.0) Gecko/20100101 Firefox/124.0',
];

// Signals that Amazon has served a bot-check page instead of content
const BOT_SIGNALS = [
  'Enter the characters you see below',
  'Sorry, we just need to make sure you\'re not a robot',
  'Type the characters you see in this image',
  'api-services-support@amazon',
];

/*
 * ─── HELPERS ─────────────────────────────────────────────────────────────────
 */

function randomAgent() {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function randomDelay(minMs, maxMs) {
  const ms = minMs + Math.floor(Math.random() * (maxMs - minMs));
  return sleep(ms);
}

function isBotResponse(html) {
  return BOT_SIGNALS.some((signal) => html.includes(signal));
}

/**
 * Build request headers that mimic a real browser session.
 */
function buildHeaders() {
  return {
    'User-Agent': randomAgent(),
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
    'Accept-Encoding': 'gzip, deflate, br',
    'Connection': 'keep-alive',
    'Upgrade-Insecure-Requests': '1',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'none',
    'Cache-Control': 'max-age=0',
  };
}

/*
 * ─── LINK EXTRACTION ─────────────────────────────────────────────────────────
 */

/**
 * Fetch a single category/search page and extract all product ASINs.
 *
 * Two extraction strategies run in parallel:
 *   A) Scrape all <a href="/dp/ASIN"> links
 *   B) Scrape all [data-asin] attributes on product cards
 * Strategy B is more reliable on search result pages where Amazon encodes
 * ASINs as data attributes rather than full hrefs.
 *
 * @param {string} url  Full URL of the page to extract from
 * @returns {Promise<string[]>}  Array of normalised amazon.in/dp/ASIN URLs
 */
async function extractLinksFromPage(url) {
  const response = await axios.get(url, {
    headers: buildHeaders(),
    timeout: REQUEST_TIMEOUT_MS,
    // Decompress gzip responses automatically
    decompress: true,
  });

  const html = response.data;

  if (isBotResponse(html)) {
    throw new Error('Bot detection page returned by Amazon');
  }

  const $ = cheerio.load(html);
  const asins = new Set();

  // Strategy A: anchor hrefs containing /dp/
  $('a[href*="/dp/"]').each((_, el) => {
    const href = $(el).attr('href') || '';
    // Resolve relative URLs
    const fullUrl = href.startsWith('http') ? href : `${AMAZON_BASE}${href}`;
    const asin = extractAsin(fullUrl);
    if (asin) asins.add(asin);
  });

  // Strategy B: data-asin attributes on product card containers
  $('[data-asin]').each((_, el) => {
    const asin = $(el).attr('data-asin');
    if (asin && /^[A-Z0-9]{10}$/i.test(asin)) {
      asins.add(asin.toUpperCase());
    }
  });

  // Convert ASINs → normalised product URLs
  return [...asins].map((asin) => `${AMAZON_BASE}/dp/${asin}`);
}

/*
 * ─── CATEGORY SCANNER ────────────────────────────────────────────────────────
 */

/**
 * Scan all pages of a single category, collecting product links.
 * Stops early if a page returns no links (end of results).
 *
 * @param {object} category  Category object from categories.js
 * @param {function} buildPageUrl  Function(category, page) → URL string
 * @returns {Promise<string[]>}  Deduplicated product URLs for this category
 */
async function extractLinksFromCategory(category, buildPageUrl) {
  const links = new Set();
  let consecutiveEmptyPages = 0;

  for (let page = 1; page <= category.maxPages; page++) {
    const url = buildPageUrl(category, page);

    try {
      logger.info(`[${category.name}] Scanning page ${page}/${category.maxPages}: ${url}`);

      const pageLinks = await extractLinksFromPage(url);

      if (pageLinks.length === 0) {
        consecutiveEmptyPages++;
        logger.warn(`[${category.name}] Page ${page} returned 0 links (empty: ${consecutiveEmptyPages})`);
        // Two consecutive empty pages → stop scanning this category early
        if (consecutiveEmptyPages >= 2) {
          logger.info(`[${category.name}] Stopping early at page ${page} (no more results)`);
          break;
        }
      } else {
        consecutiveEmptyPages = 0;
        pageLinks.forEach((l) => links.add(l));
        logger.info(`[${category.name}] Page ${page}: ${pageLinks.length} products (total: ${links.size})`);
      }
    } catch (error) {
      logger.error(`[${category.name}] Page ${page} failed: ${error.message}`);
      // On bot detection, stop the category entirely — don't hammer the blocked IP
      if (error.message.includes('Bot detection')) {
        logger.warn(`[${category.name}] Bot detection — stopping category scan`);
        break;
      }
    }

    // Throttle between pages — critical to avoid IP bans
    if (page < category.maxPages) {
      await randomDelay(PAGE_DELAY_MIN_MS, PAGE_DELAY_MAX_MS);
    }
  }

  const result = [...links];
  logger.info(`[${category.name}] Complete — ${result.length} unique products`);
  return result;
}

module.exports = {
  extractLinksFromPage,
  extractLinksFromCategory,
  CATEGORY_DELAY_MIN_MS,
  CATEGORY_DELAY_MAX_MS,
};
