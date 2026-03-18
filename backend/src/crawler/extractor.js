/**
 * Multi-Platform Category Link Extractor
 *
 * Amazon        → axios + cheerio (fast, headless HTTP)
 * Flipkart      → axios + cheerio (listing pages are SSR)
 * Myntra / Ajio → Puppeteer (SPA, requires JS)
 *
 * Returns normalised product URLs per category.
 */

const axios   = require('axios');
const cheerio = require('cheerio');
const { openPage, randomDelay, sleep } = require('../scraper/browser');
const logger  = require('../../utils/logger');

const PAGE_DELAY_MIN_MS     = 2000;
const PAGE_DELAY_MAX_MS     = 5000;
const CATEGORY_DELAY_MIN_MS = 3000;
const CATEGORY_DELAY_MAX_MS = 8000;

const AXIOS_HEADERS = {
  'User-Agent':      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Accept-Language': 'en-IN,en;q=0.9',
  'Accept':          'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
};

// ─── AMAZON (axios + cheerio) ─────────────────────────────────────────────────

async function extractAmazonLinks(category, buildPageUrl) {
  const links = new Set();
  let emptyStreak = 0;

  for (let page = 1; page <= category.maxPages; page++) {
    const url = buildPageUrl(category, page);
    try {
      const { data } = await axios.get(url, { headers: AXIOS_HEADERS, timeout: 20000 });
      const $ = cheerio.load(data);

      // Bot check
      if (data.includes('Enter the characters you see below') || data.includes('automated access')) {
        logger.warn(`[Extractor][Amazon] Bot detection on ${category.name} page ${page} — stopping`);
        break;
      }

      const pageSeen = new Set();

      $('a[href*="/dp/"]').each((_, el) => {
        const href  = $(el).attr('href') || '';
        const match = href.match(/\/dp\/([A-Z0-9]{10})/i);
        if (match) pageSeen.add(`https://www.amazon.in/dp/${match[1].toUpperCase()}`);
      });

      $('[data-asin]').each((_, el) => {
        const asin = $(el).attr('data-asin') || '';
        if (asin && /^[A-Z0-9]{10}$/i.test(asin)) {
          pageSeen.add(`https://www.amazon.in/dp/${asin.toUpperCase()}`);
        }
      });

      if (pageSeen.size === 0) {
        emptyStreak++;
        if (emptyStreak >= 2) break;
      } else {
        emptyStreak = 0;
        pageSeen.forEach((u) => links.add(u));
      }

      logger.debug(`[Extractor][Amazon][${category.name}] Page ${page}: ${pageSeen.size} links`);
      await sleep(PAGE_DELAY_MIN_MS + Math.floor(Math.random() * (PAGE_DELAY_MAX_MS - PAGE_DELAY_MIN_MS)));
    } catch (err) {
      logger.error(`[Extractor][Amazon][${category.name}] Page ${page} failed: ${err.message}`);
      emptyStreak++;
      if (emptyStreak >= 2) break;
    }
  }

  return [...links];
}

// ─── FLIPKART (axios + cheerio) ───────────────────────────────────────────────

async function extractFlipkartLinks(category) {
  const links = new Set();

  for (let page = 1; page <= category.maxPages; page++) {
    const url = page === 1 ? category.url : `${category.url}&page=${page}`;
    try {
      const { data } = await axios.get(url, { headers: AXIOS_HEADERS, timeout: 20000 });
      const $ = cheerio.load(data);

      $('a[href*="/p/"]').each((_, el) => {
        const href = $(el).attr('href') || '';
        if (href.includes('/p/itm') || href.match(/\/p\/[a-z0-9]+$/i)) {
          const fullUrl = href.startsWith('http') ? href : `https://www.flipkart.com${href}`;
          links.add(fullUrl.split('?')[0]);
        }
      });

      // Also look for data attributes
      $('[data-id]').each((_, el) => {
        const id = $(el).attr('data-id') || '';
        if (id && id.length > 5) {
          // Flipkart product IDs need the full href — already captured above
        }
      });

      logger.debug(`[Extractor][Flipkart][${category.name}] Page ${page}: accumulated ${links.size}`);
      await sleep(PAGE_DELAY_MIN_MS + Math.floor(Math.random() * (PAGE_DELAY_MAX_MS - PAGE_DELAY_MIN_MS)));
    } catch (err) {
      logger.error(`[Extractor][Flipkart][${category.name}] Page ${page} failed: ${err.message}`);
    }
  }

  return [...links];
}

// ─── MYNTRA (Puppeteer) ───────────────────────────────────────────────────────

async function extractMyntraLinks(category) {
  const links = new Set();
  const page  = await openPage({ blockAssets: false });

  try {
    for (let p = 1; p <= category.maxPages; p++) {
      const url = p === 1 ? category.url : `${category.url}?p=${p}`;
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 45000 });
      await randomDelay(2000, 4000);

      // Scroll to trigger lazy loading
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await sleep(2000);

      const pageLinks = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('a[href*="/buy/"]'))
          .map((a) => a.href)
          .filter((h) => h.includes('myntra.com') && h.includes('/buy/'));
      });

      pageLinks.forEach((u) => links.add(u.split('?')[0]));
      logger.debug(`[Extractor][Myntra][${category.name}] Page ${p}: ${pageLinks.length} links`);
      await randomDelay(2000, 4000);
    }
  } catch (err) {
    logger.error(`[Extractor][Myntra][${category.name}] ${err.message}`);
  } finally {
    await page.close().catch(() => {});
  }

  return [...links];
}

// ─── AJIO (Puppeteer) ─────────────────────────────────────────────────────────

async function extractAjioLinks(category) {
  const links = new Set();
  const page  = await openPage({ blockAssets: false });

  try {
    for (let p = 1; p <= category.maxPages; p++) {
      const url = p === 1 ? category.url : `${category.url}?pageNum=${p}`;
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 45000 });
      await randomDelay(2500, 5000);

      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await sleep(2000);

      const pageLinks = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('a.rilrtl-products-list__link, a[href*="/p/"]'))
          .map((a) => a.href)
          .filter((h) => h.includes('ajio.com'));
      });

      pageLinks.forEach((u) => links.add(u.split('?')[0]));
      logger.debug(`[Extractor][Ajio][${category.name}] Page ${p}: ${pageLinks.length} links`);
      await randomDelay(2000, 4000);
    }
  } catch (err) {
    logger.error(`[Extractor][Ajio][${category.name}] ${err.message}`);
  } finally {
    await page.close().catch(() => {});
  }

  return [...links];
}

// ─── DISPATCHER ───────────────────────────────────────────────────────────────

async function extractLinksFromCategory(category, buildPageUrl) {
  switch (category.platform) {
    case 'amazon':   return extractAmazonLinks(category, buildPageUrl);
    case 'flipkart': return extractFlipkartLinks(category);
    case 'myntra':   return extractMyntraLinks(category);
    case 'ajio':     return extractAjioLinks(category);
    default:
      logger.warn(`[Extractor] Unknown platform: ${category.platform}`);
      return [];
  }
}

module.exports = {
  extractLinksFromCategory,
  CATEGORY_DELAY_MIN_MS,
  CATEGORY_DELAY_MAX_MS,
};
