'use strict';
/**
 * Amazon India Category Link Extractor
 *
 * Category pages  → axios + cheerio (SSR HTML, no JS execution needed)
 * Warm-up pages   → Puppeteer (builds Puppeteer session trust for product scraping)
 *
 * IMPORTANT: Amazon /s? category listing pages are server-side rendered.
 * The full product grid with data-asin attributes is present in the initial
 * HTTP response — no JavaScript execution is required to see ASINs.
 * Using axios (plain HTTP) avoids all browser-automation fingerprints.
 * Puppeteer is reserved for product detail pages (src/scraper/amazon.js)
 * where JS rendering is genuinely required.
 *
 * This is the approach that worked reliably in the original working version.
 * The regression was introduced when category extraction was switched to Puppeteer.
 */

const fs    = require('fs');
const path  = require('path');
const axios = require('axios');

const { openPage, sleep, smoothScroll } = require('../scraper/browser');
const logger  = require('../../utils/logger');
const antiBot = require('./antiBot');

const DEBUG_DIR = path.join(__dirname, '..', '..', 'debug');

// ── Delays ─────────────────────────────────────────────────────────────────────
// axios fetches complete in ~1–3 s — moderate delays are sufficient
const PAGE_DELAY_MS_MIN     = 2000;   // between pages within a category
const PAGE_DELAY_MS_MAX     = 6000;
const CATEGORY_DELAY_MIN_MS = 8000;   // between categories
const CATEGORY_DELAY_MAX_MS = 20000;

const metrics = {
  skipped_no_price:  0,
  skipped_sponsored: 0,
  enqueued:          0,
};

// ── Request headers — rotate UA, include full realistic browser header set ─────
const AXIOS_USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:123.0) Gecko/20100101 Firefox/123.0',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
];

function randomAxiosHeaders() {
  const ua = AXIOS_USER_AGENTS[Math.floor(Math.random() * AXIOS_USER_AGENTS.length)];
  return {
    'User-Agent':                ua,
    'Accept-Language':           'en-IN,en;q=0.9,en-GB;q=0.8',
    'Accept':                    'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
    'Accept-Encoding':           'gzip, deflate, br',
    'Cache-Control':             'max-age=0',
    'Upgrade-Insecure-Requests': '1',
    'DNT':                       '1',
    'Connection':                'keep-alive',
    'sec-ch-ua':                 '"Not A(Brand";v="99", "Google Chrome";v="122", "Chromium";v="122"',
    'sec-ch-ua-mobile':          '?0',
    'sec-ch-ua-platform':        '"Windows"',
    'Sec-Fetch-Dest':            'document',
    'Sec-Fetch-Mode':            'navigate',
    'Sec-Fetch-Site':            'none',
    'Sec-Fetch-User':            '?1',
  };
}

// ── Page classifier for raw HTTP responses ─────────────────────────────────────
function classifyPage(html, finalUrl) {
  if (!html || html.length < 500) return 'blank-page';
  const lower = html.toLowerCase();

  if (/captcha|robot check|enter the characters/i.test(lower))  return 'captcha';
  if (/automated access|unusual traffic/i.test(lower))          return 'bot-wall';
  if (/sorry, we just need to make sure/i.test(lower))          return 'bot-wall';
  if (/your connection is not private|err_cert/i.test(lower))   return 'ssl-warning';
  if (/this site can|err_connection|err_name/i.test(lower))     return 'network-error';
  if (/no results for|didn.*t find/i.test(lower))               return 'no-results';

  // Homepage redirect — response URL lost the search path
  if (finalUrl) {
    const u = finalUrl.toLowerCase();
    if (u.includes('amazon.in') && !u.includes('/s?') && !u.includes('keywords=') && !u.includes('k=') && !u.includes('&page=')) {
      if (u === 'https://www.amazon.in/' || u.endsWith('amazon.in/')) {
        return 'homepage-redirect';
      }
    }
  }

  // Valid category page must have search result items or data-asin attributes
  const hasResults = lower.includes('s-result-item') || lower.includes('s-search-result') || /data-asin="[a-z0-9]{10}"/i.test(html);
  if (!hasResults) return 'wrong-layout';

  return 'ok';
}

// ── Debug snapshot ────────────────────────────────────────────────────────────
function saveDebugHtml(html, label) {
  try {
    fs.mkdirSync(DEBUG_DIR, { recursive: true });
    const safe     = label.replace(/[^a-z0-9-]/gi, '_').toLowerCase().slice(0, 60);
    const htmlPath = path.join(DEBUG_DIR, `failure-${safe}.html`);
    fs.writeFileSync(htmlPath, html, 'utf8');
    logger.warn(`[Extractor] Debug HTML → ${htmlPath}`);
  } catch (e) {
    logger.warn(`[Extractor] saveDebugHtml failed: ${e.message}`);
  }
}

// ── Known placeholder / invalid ASINs Amazon puts in non-product elements ──────
const BAD_ASINS = new Set([
  '0000000000', 'XXXXXXXXXX', 'AAAAAAAAA1', 'B000000000',
]);

// ── ASIN extraction — targets real search result cards only ───────────────────
//
// Amazon search result HTML structure:
//   <div data-component-type="s-search-result" ... data-asin="B08FKW96T1" ...>
//
// Both attributes live on the SAME opening tag.
// We find the marker, walk back to the tag start (<), read to >, then extract.
// This avoids matching ASINs from ad containers, "also viewed" widgets, or
// carousels that have data-asin but NOT data-component-type="s-search-result".
function extractAsinsFromHtml(html) {
  const urls      = new Set();
  const rejected  = { bad: 0, format: 0 };
  const MARKER    = 'data-component-type="s-search-result"';
  let   searchPos = 0;

  while (true) {
    const markerPos = html.indexOf(MARKER, searchPos);
    if (markerPos === -1) break;

    // Walk back to find the opening '<' of this tag
    let tagStart = markerPos;
    while (tagStart > 0 && html[tagStart] !== '<') tagStart--;

    // Find the closing '>' of this tag
    const tagEnd = html.indexOf('>', markerPos);
    if (tagEnd === -1) { searchPos = markerPos + 1; continue; }

    const tag       = html.slice(tagStart, tagEnd + 1);
    const asinMatch = tag.match(/data-asin="([A-Z0-9]{10})"/i);

    if (asinMatch) {
      const asin = asinMatch[1].toUpperCase();
      if (!/^[A-Z0-9]{10}$/.test(asin)) {
        rejected.format++;
      } else if (BAD_ASINS.has(asin)) {
        rejected.bad++;
      } else {
        urls.add(`https://www.amazon.in/dp/${asin}`);
      }
    }

    searchPos = tagEnd + 1;
  }

  // Fallback: if no result cards found (layout change), scan all data-asin attrs
  if (urls.size === 0) {
    logger.debug('[Extractor] No s-search-result cards found — falling back to all data-asin scan');
    for (const m of html.matchAll(/data-asin="([A-Z0-9]{10})"/gi)) {
      const asin = m[1].toUpperCase();
      if (/^[A-Z0-9]{10}$/.test(asin) && !BAD_ASINS.has(asin)) {
        urls.add(`https://www.amazon.in/dp/${asin}`);
      }
    }
  }

  // Last-resort fallback: /dp/ href links
  if (urls.size === 0) {
    for (const m of html.matchAll(/href="[^"]*\/dp\/([A-Z0-9]{10})[^"]*"/gi)) {
      const asin = m[1].toUpperCase();
      if (/^[A-Z0-9]{10}$/.test(asin) && !BAD_ASINS.has(asin)) {
        urls.add(`https://www.amazon.in/dp/${asin}`);
      }
    }
  }

  if (rejected.format > 0 || rejected.bad > 0) {
    logger.debug(`[Extractor] ASIN extraction: rejected format=${rejected.format} bad=${rejected.bad}`);
  }

  return [...urls];
}

// ── Single-page fetch via axios ────────────────────────────────────────────────
async function fetchCategoryPage(url, categoryName, pageNum) {
  const label = `${categoryName}-p${pageNum}`;
  logger.info(`[Extractor] ── ${categoryName} p${pageNum} ──`);
  logger.info(`[Extractor]   URL: ${url}`);

  let response;
  try {
    response = await axios.get(url, {
      headers:        randomAxiosHeaders(),
      timeout:        25000,
      maxRedirects:   5,
      validateStatus: (s) => s < 500,
    });
  } catch (err) {
    logger.error(`[Extractor] axios error on ${label}: ${err.message}`);
    antiBot.record('blocked');
    return { urls: null, pageClass: 'network-error' };
  }

  const statusCode = response.status;
  const finalUrl   = response.request?.res?.responseUrl || response.config?.url || url;
  const html       = typeof response.data === 'string' ? response.data : '';

  logger.info(`[Extractor] Status: ${statusCode} | HTML: ${html.length} bytes | Final URL: ${finalUrl}`);

  if (statusCode === 503 || statusCode === 429) {
    logger.warn(`[Extractor] Rate-limited (${statusCode}) on ${label}`);
    antiBot.record('bot-wall');
    return { urls: null, pageClass: 'bot-wall' };
  }

  if (statusCode >= 400) {
    logger.warn(`[Extractor] HTTP ${statusCode} on ${label}`);
    antiBot.record('blocked');
    return { urls: null, pageClass: 'blocked' };
  }

  const pageClass = classifyPage(html, finalUrl);
  logger.info(`[Extractor] Page class: ${pageClass}`);

  if (pageClass !== 'ok') {
    logger.warn(`[Extractor] ✖ "${pageClass}" on ${label} — saving debug HTML`);
    saveDebugHtml(html, label);
    antiBot.record(pageClass);
    return { urls: null, pageClass };
  }

  const urls = extractAsinsFromHtml(html);
  logger.info(`[Extractor] ${label}: extracted ${urls.length} ASINs`);
  antiBot.record('ok');

  return { urls, pageClass };
}

// ── Category extractor ─────────────────────────────────────────────────────────

async function extractLinksFromCategory(category, buildPageUrl) {
  const links      = new Set();
  let emptyStreak  = 0;
  let blockedCount = 0;

  // Randomise start page so repeated cycles don't always hit page 1 first
  const start = category.maxPages > 1
    ? 1 + Math.floor(Math.random() * Math.max(1, category.maxPages - 1))
    : 1;
  const pageOrder = [];
  for (let i = start; i <= category.maxPages; i++) pageOrder.push(i);
  for (let i = 1;     i < start;             i++) pageOrder.push(i);

  for (const pageNum of pageOrder) {
    // ── Hourly page budget ──────────────────────────────────────────────────
    if (!antiBot.budgetOk()) {
      logger.warn(`[Extractor] Hourly budget exhausted — stopping "${category.name}"`);
      break;
    }
    antiBot.consumeBudget();

    const url = buildPageUrl(category, pageNum);
    const { urls: result, pageClass } = await fetchCategoryPage(url, category.name, pageNum);

    // ── Bot detection → blacklist + cycle abort ─────────────────────────────
    if (['bot-wall', 'captcha', 'homepage-redirect'].includes(pageClass)) {
      antiBot.blacklistCategory(category.id);
      antiBot.setBotWallThisCycle();
      if (antiBot.shouldSleepForBotWall()) {
        const cooldownMs = (10 + Math.floor(Math.random() * 10)) * 60_000;
        logger.warn(
          `[Extractor] ⚠ ${pageClass.toUpperCase()} on "${category.name}" — ` +
          `cooling down ${Math.round(cooldownMs / 60_000)} min`
        );
        await sleep(cooldownMs);
      }
      break;
    }

    if (pageClass === 'wrong-layout' || result === null) {
      blockedCount++;
      if (blockedCount >= 2) {
        logger.warn(`[Extractor] ${category.name}: 2 consecutive failures — aborting`);
        break;
      }
    } else if (result.length === 0) {
      emptyStreak++;
      if (emptyStreak >= 2) {
        logger.warn(`[Extractor] ${category.name}: 2 empty pages — done`);
        break;
      }
    } else {
      emptyStreak = blockedCount = 0;
      result.forEach((u) => links.add(u));
    }

    await sleep(PAGE_DELAY_MS_MIN + Math.floor(Math.random() * (PAGE_DELAY_MS_MAX - PAGE_DELAY_MS_MIN)));
  }

  logger.info(`[Extractor] ${category.name} COMPLETE — ${links.size} unique URLs`);
  return [...links];
}

// ── Cycle warm-up — builds Puppeteer session trust for PRODUCT scraping ────────
// This warm-up is for the Puppeteer browser session used by the product scraper
// (src/scraper/amazon.js), NOT for category extraction (which uses axios).
// Visiting Amazon pages via the persistent Chrome profile builds cookies and
// behavioral trust so product detail page scraping is less likely to be flagged.

const WARM_UP_BROWSE_PAGES = [
  'https://www.amazon.in/gp/new-releases/electronics/',
  'https://www.amazon.in/gp/bestsellers/shoes/',
  'https://www.amazon.in/gp/new-releases/apparel/',
  'https://www.amazon.in/deals',
  'https://www.amazon.in/gp/new-releases/beauty/',
];

const WARM_UP_SEARCH_URLS = [
  'https://www.amazon.in/s?k=wireless+earphones+under+1000',
  'https://www.amazon.in/s?k=running+shoes+men',
  'https://www.amazon.in/s?k=face+wash+skincare',
  'https://www.amazon.in/s?k=smartwatch+under+5000',
  'https://www.amazon.in/s?k=gym+fitness+equipment',
  'https://www.amazon.in/s?k=laptop+backpack',
];

async function _simulateHuman(page) {
  const moves = 2 + Math.floor(Math.random() * 3);
  for (let i = 0; i < moves; i++) {
    await page.mouse.move(
      150 + Math.floor(Math.random() * 900),
      80  + Math.floor(Math.random() * 500),
      { steps: 8 + Math.floor(Math.random() * 8) }
    );
    await sleep(100 + Math.floor(Math.random() * 300));
  }
}

async function cycleWarmUp() {
  logger.info('[AntiBot] Cycle warm-up starting — building Puppeteer session trust for product scraping…');

  // Step 1: Browse a stable Amazon landing page
  const browseUrl = WARM_UP_BROWSE_PAGES[Math.floor(Math.random() * WARM_UP_BROWSE_PAGES.length)];
  let page = null;
  try {
    page = await openPage({ blockAssets: false });
    await page.goto(browseUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await sleep(1200 + Math.floor(Math.random() * 1800));
    await _simulateHuman(page);
    const scrollH = await page.evaluate(() => document.body.scrollHeight).catch(() => 2000);
    await smoothScroll(page, Math.floor(scrollH * (0.2 + Math.random() * 0.2)));
    await sleep(600 + Math.floor(Math.random() * 800));
    logger.info(`[AntiBot] Warm-up: browse ${browseUrl}`);
  } catch (e) {
    logger.debug(`[AntiBot] Warm-up browse non-fatal: ${e.message}`);
  } finally {
    if (page) { await page.close().catch(() => {}); page = null; }
  }

  await sleep(800 + Math.floor(Math.random() * 1200));

  // Step 2: Perform a generic search
  const searchUrl = WARM_UP_SEARCH_URLS[Math.floor(Math.random() * WARM_UP_SEARCH_URLS.length)];
  try {
    page = await openPage({ blockAssets: 'media' });
    await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await sleep(1000 + Math.floor(Math.random() * 1500));
    await _simulateHuman(page);
    await sleep(500 + Math.floor(Math.random() * 600));
    logger.info(`[AntiBot] Warm-up: search "${searchUrl.split('?k=')[1] || searchUrl}"`);
  } catch (e) {
    logger.debug(`[AntiBot] Warm-up search non-fatal: ${e.message}`);
  } finally {
    if (page) await page.close().catch(() => {});
  }

  logger.info('[AntiBot] Cycle warm-up complete');
}

module.exports = {
  extractLinksFromCategory, cycleWarmUp,
  CATEGORY_DELAY_MIN_MS, CATEGORY_DELAY_MAX_MS, metrics,
};
