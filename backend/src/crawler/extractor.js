'use strict';
/**
 * Amazon India Category Link Extractor
 *
 * Anti-bot hardening:
 *   - Images allowed (blocking images is a known Amazon bot-detection trigger)
 *   - Mouse movement simulation after page load
 *   - Network response + requestfailed monitoring per page
 *   - CAPTCHA / bot-wall / SSL page classified exactly
 *   - waitForFunction on ASIN pattern (not just .s-main-slot which exists on error pages)
 *   - Smooth incremental scrolling
 *   - Debug screenshot + HTML saved on every failure
 */

const fs   = require('fs');
const path = require('path');

const { openPage, sleep } = require('../scraper/browser');
const logger   = require('../../utils/logger');
const antiBot  = require('./antiBot');

const DEBUG_DIR = path.join(__dirname, '..', '..', 'debug');

const PAGE_DELAY_MS_MIN     = 2000;
const PAGE_DELAY_MS_MAX     = 8000;
const CATEGORY_DELAY_MIN_MS = 15000;
const CATEGORY_DELAY_MAX_MS = 45000;

const metrics = {
  skipped_no_price:  0,
  skipped_sponsored: 0,
  enqueued:          0,
};

// ── Bot / block / SSL page signals ───────────────────────────────────────────
const BOT_SIGNALS = [
  'enter the characters you see below',
  'automated access',
  'api-services-support@amazon',
  'robot check',
  'sorry, we just need to make sure',
  'type the characters you see in this image',
  'captcha',
  'your connection is not private',   // SSL warning page
  'err_cert_authority_invalid',
  'this site can',                    // "This site can't be reached"
  'unusual traffic',
];

function classifyPage(html, title) {
  if (!html || html.length < 1500) return 'blank-page';
  const lower = html.toLowerCase();
  const t     = (title || '').toLowerCase();
  if (/captcha|robot check|enter the characters/i.test(lower))                 return 'captcha';
  if (/your connection is not private|err_cert/i.test(lower))                  return 'ssl-warning';
  if (/automated access|unusual traffic/i.test(lower))                         return 'bot-wall';
  if (/sorry|we just need to make sure/i.test(lower))                          return 'bot-wall';
  if (/this site can|err_connection|err_name/i.test(lower))                    return 'network-error';
  if (/no results for|didn.*t find/i.test(lower))                              return 'no-results';
  if (!lower.includes('s-result-item') && !lower.includes('s-search-result')) return 'wrong-layout';
  return 'ok';
}

// ── Debug snapshot ────────────────────────────────────────────────────────────
async function saveDebugFiles(page, label) {
  try {
    fs.mkdirSync(DEBUG_DIR, { recursive: true });
    const safe = label.replace(/[^a-z0-9-]/gi, '_').toLowerCase().slice(0, 60);
    const png  = path.join(DEBUG_DIR, `failure-${safe}.png`);
    const html = path.join(DEBUG_DIR, `failure-${safe}.html`);

    await page.screenshot({ path: png, fullPage: true }).catch(() => {});
    const content = await page.content().catch(() => '');
    if (content) fs.writeFileSync(html, content, 'utf8');

    logger.warn(`[Extractor] Debug → ${png}`);
    logger.warn(`[Extractor] Debug → ${html}`);
  } catch (e) {
    logger.warn(`[Extractor] saveDebugFiles failed: ${e.message}`);
  }
}

// ── Network monitoring — attaches to a page and logs failures/challenges ─────
function setupNetworkMonitoring(page, label) {
  const WATCH_PATTERNS = /captcha|challenge|robot|blocked|errors|georestrict/i;
  let api400Count = 0;

  page.on('response', (res) => {
    const status = res.status();
    const url    = res.url();
    if (status === 400 && url.includes('data.amazon.in')) {
      api400Count++;
      if (api400Count === 1) antiBot.record('api-400');  // record once per page
      logger.warn(`[Net][${label}] API 400 #${api400Count} ← ${url.slice(0, 100)}`);
    } else if (status >= 400 && url.includes('amazon.in')) {
      logger.warn(`[Net][${label}] ${status} ← ${url.slice(0, 100)}`);
    }
    if (WATCH_PATTERNS.test(url)) {
      logger.warn(`[Net][${label}] Suspicious URL: ${url.slice(0, 120)}`);
    }
  });

  page.on('requestfailed', (req) => {
    const err = req.failure()?.errorText || 'unknown';
    const url = req.url();
    // Only log Amazon-domain failures (CDN/image failures are noise)
    if (url.includes('amazon.in') && !['net::ERR_ABORTED'].includes(err)) {
      logger.warn(`[Net][${label}] FAILED ${err} — ${url.slice(0, 100)}`);
    }
  });

  return { getApi400Count: () => api400Count };
}

// ── Smooth scroll — incremental, not instant ─────────────────────────────────
async function smoothScrollTo(page, targetY) {
  await page.evaluate((target) => {
    return new Promise((resolve) => {
      const step  = Math.max(40, Math.ceil(target / 25));
      let   pos   = window.scrollY || 0;
      const timer = setInterval(() => {
        pos = Math.min(pos + step, target);
        window.scrollTo(0, pos);
        if (pos >= target) { clearInterval(timer); resolve(); }
      }, 55);
    });
  }, targetY);
}

// ── Human behavior simulation — mouse, reading pauses, viewport variation ─────
async function simulateHuman(page) {
  // Randomised mouse movement across the viewport
  const moves = 3 + Math.floor(Math.random() * 4);
  for (let i = 0; i < moves; i++) {
    const x = 150 + Math.floor(Math.random() * 1000);
    const y = 80  + Math.floor(Math.random() * 620);
    await page.mouse.move(x, y, { steps: 10 + Math.floor(Math.random() * 12) });
    await sleep(120 + Math.floor(Math.random() * 400));
  }
  // Occasional slight viewport resize — real users resize browser windows
  if (Math.random() < 0.25) {
    const w = 1280 + Math.floor(Math.random() * 160);
    const h = 700  + Math.floor(Math.random() * 120);
    await page.setViewport({ width: w, height: h }).catch(() => {});
    await sleep(150 + Math.floor(Math.random() * 250));
  }
  // Occasional hover pause — simulates reading a result card
  if (Math.random() < 0.4) {
    const hx = 300 + Math.floor(Math.random() * 700);
    const hy = 200 + Math.floor(Math.random() * 400);
    await page.mouse.move(hx, hy, { steps: 5 });
    await sleep(400 + Math.floor(Math.random() * 800));
  }
}

// ── Page evaluator (serialisable — no closures) ───────────────────────────────
function amazonPageEvaluator() {
  const cards = Array.from(
    document.querySelectorAll('[data-component-type="s-search-result"][data-asin]')
  );

  let enqueued = 0, skipped_no_price = 0, skipped_sponsored = 0;
  const urls = [];

  for (const card of cards) {
    const asin = (card.getAttribute('data-asin') || '').toUpperCase();
    if (!asin || !/^[A-Z0-9]{10}$/.test(asin)) continue;

    // Skip sponsored
    if (
      card.querySelector('.puis-sponsored-label-text') ||
      card.querySelector('.s-sponsored-label-info-icon') ||
      card.querySelector('.s-label-popover-default') ||
      card.querySelector('[data-component-type="s-ads-carousel"]')
    ) { skipped_sponsored++; continue; }

    // Price must include ₹
    const priceEl   = card.querySelector('.a-price .a-offscreen, .a-price-whole, .a-color-price');
    const priceText = priceEl ? (priceEl.innerText || priceEl.textContent || '') : '';
    if (!priceText.trim() || !priceText.includes('₹')) { skipped_no_price++; continue; }

    urls.push(`https://www.amazon.in/dp/${asin}`);
    enqueued++;
  }

  return { total: cards.length, enqueued, skipped_no_price, skipped_sponsored, urls };
}

// ── Single-page extraction ────────────────────────────────────────────────────
// Returns { urls: string[] | null, pageClass: string }

async function extractOnePage(url, categoryName, pageNum) {
  let page      = null;
  let pageClass = 'unknown';

  try {
    // 'media' mode: images + CSS allowed, only font/video blocked
    // Images MUST be allowed — Amazon bot detection flags sessions with 0 image requests
    page = await openPage({ blockAssets: 'media' });

    const net = setupNetworkMonitoring(page, `${categoryName}-p${pageNum}`);

    logger.info(`[Extractor] ── ${categoryName} p${pageNum} ──`);
    logger.info(`[Extractor]   URL: ${url}`);

    // ── Navigate ─────────────────────────────────────────────────────────────
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 55000 });
    } catch (navErr) {
      logger.error(`[Extractor] Navigation error — ${categoryName} p${pageNum}: ${navErr.message}`);
      if (/ERR_CERT|SSL|certificate/i.test(navErr.message)) {
        logger.error(`[Extractor] ⚠ SSL error — --ignore-certificate-errors may not have applied correctly`);
      }
      if (/timeout/i.test(navErr.message)) {
        logger.warn(`[Extractor] Timeout — Amazon may be slow-loading to detect bots`);
      }
      await saveDebugFiles(page, `${categoryName}-p${pageNum}-nav`);
      return { urls: null, pageClass: 'nav-error' };
    }

    // ── Random idle after navigation — avoids deterministic timing fingerprint ─
    await sleep(1500 + Math.floor(Math.random() * 2500));

    // ── Post-navigation validation ────────────────────────────────────────────
    const finalUrl  = page.url();
    const pageTitle = await page.title().catch(() => '(unavailable)');
    const htmlSnap  = await page.content().catch(() => '');
    pageClass       = classifyPage(htmlSnap, pageTitle);

    logger.info(`[Extractor] Loaded URL:  ${finalUrl}`);
    logger.info(`[Extractor] Page title:  ${pageTitle}`);
    logger.info(`[Extractor] Page class:  ${pageClass}`);
    logger.info(`[Extractor] HTML size:   ${htmlSnap.length} bytes`);

    if (pageClass !== 'ok' && pageClass !== 'wrong-layout') {
      logger.warn(`[Extractor] ✖ Page is "${pageClass}" — saving debug files and aborting`);
      await saveDebugFiles(page, `${categoryName}-p${pageNum}-${pageClass}`);
      return { urls: null, pageClass };
    }

    // ── Simulate human behavior before waiting for grid ───────────────────────
    await simulateHuman(page);
    await sleep(600 + Math.floor(Math.random() * 600));

    // ── Wait for real ASIN product cards ──────────────────────────────────────
    // waitForFunction is stricter than waitForSelector:
    //   - validates ASIN pattern (rules out placeholder cards)
    //   - .s-main-slot appears on error/empty pages too — we don't use it
    const gridAppeared = await page
      .waitForFunction(() => {
        const cards = document.querySelectorAll('[data-component-type="s-search-result"][data-asin]');
        return Array.from(cards).some(c => /^[A-Z0-9]{10}$/.test(c.getAttribute('data-asin') || ''));
      }, { timeout: 28000, polling: 800 })
      .then(() => true)
      .catch(() => false);

    logger.info(`[Extractor] Search grid found: ${gridAppeared}`);

    if (!gridAppeared) {
      // Refresh HTML for accurate diagnosis (page may have changed since first read)
      const html2  = await page.content().catch(() => '');
      const class2 = classifyPage(html2, pageTitle);

      // Count any ASIN-like strings in raw HTML as last-resort signal
      const rawAsinCount = (html2.match(/data-asin="[A-Z0-9]{10}"/gi) || []).length;

      logger.warn(`[Extractor] ✖ Grid not found — ${categoryName} p${pageNum}`);
      logger.warn(`[Extractor]   Final URL  : ${finalUrl}`);
      logger.warn(`[Extractor]   Page class : ${class2}`);
      logger.warn(`[Extractor]   HTML size  : ${html2.length} bytes`);
      logger.warn(`[Extractor]   Raw ASINs  : ${rawAsinCount} in HTML (DOM may have timed out)`);

      await saveDebugFiles(page, `${categoryName}-p${pageNum}`);
      return { urls: null, pageClass: class2 };
    }

    // ── Reading pause — simulates user scanning results before scrolling ──────
    await sleep(800 + Math.floor(Math.random() * 1500));

    // ── Smooth scroll to trigger lazy-loaded cards ────────────────────────────
    const bodyHeight = await page.evaluate(() => document.body.scrollHeight);
    const depth1     = 0.30 + Math.random() * 0.15;   // 30–45 %
    const depth2     = 0.65 + Math.random() * 0.15;   // 65–80 %
    await smoothScrollTo(page, Math.floor(bodyHeight * depth1));
    await sleep(700 + Math.floor(Math.random() * 600));
    await smoothScrollTo(page, Math.floor(bodyHeight * depth2));
    await sleep(500 + Math.floor(Math.random() * 500));
    await smoothScrollTo(page, bodyHeight);
    await sleep(400 + Math.floor(Math.random() * 400));

    // ── Extract product links ─────────────────────────────────────────────────
    const result = await page.evaluate(amazonPageEvaluator);

    logger.info(
      `[Extractor] ${categoryName} p${pageNum}: ` +
      `cards=${result.total} enqueued=${result.enqueued} ` +
      `skipped_no_price=${result.skipped_no_price} skipped_sponsored=${result.skipped_sponsored} ` +
      `api400=${net.getApi400Count()}`
    );

    metrics.enqueued          += result.enqueued;
    metrics.skipped_no_price  += result.skipped_no_price;
    metrics.skipped_sponsored += result.skipped_sponsored;

    // ── Fallback: href scan when evaluator returns 0 ──────────────────────────
    if (result.enqueued === 0) {
      logger.warn(`[Extractor] Primary evaluator 0 — trying href fallback`);
      const fallbackUrls = await page.evaluate(() => {
        const seen = new Set();
        document.querySelectorAll('a[href*="/dp/"]').forEach((a) => {
          const m = (a.href || '').match(/\/dp\/([A-Z0-9]{10})/i);
          if (m) seen.add(`https://www.amazon.in/dp/${m[1].toUpperCase()}`);
        });
        return [...seen];
      });
      if (fallbackUrls.length > 0) {
        logger.info(`[Extractor] Href fallback: ${fallbackUrls.length} ASINs on ${categoryName} p${pageNum}`);
        return { urls: fallbackUrls, pageClass: 'ok' };
      }
      logger.warn(`[Extractor] Href fallback also 0 — saving snapshot`);
      await saveDebugFiles(page, `${categoryName}-p${pageNum}-empty`);
    }

    return { urls: result.urls, pageClass };

  } catch (err) {
    logger.error(`[Extractor] Exception — ${categoryName} p${pageNum}: ${err.message}`);
    if (page) await saveDebugFiles(page, `${categoryName}-p${pageNum}-exc`).catch(() => {});
    return { urls: null, pageClass: 'exception' };
  } finally {
    if (page) await page.close().catch(() => {});
  }
}

// ── Category extractor ────────────────────────────────────────────────────────

async function extractLinksFromCategory(category, buildPageUrl) {
  const links = new Set();
  let emptyStreak = 0, blockedCount = 0;

  const start = category.maxPages > 1
    ? 1 + Math.floor(Math.random() * Math.max(1, category.maxPages - 1))
    : 1;
  const pageOrder = [];
  for (let i = start; i <= category.maxPages; i++) pageOrder.push(i);
  for (let i = 1;     i < start;             i++) pageOrder.push(i);

  for (const pageNum of pageOrder) {
    // ── Global hourly page budget ─────────────────────────────────────────────
    if (!antiBot.budgetOk()) {
      logger.warn(
        `[Extractor] Hourly page budget exhausted (${antiBot.budgetRemaining()} left) — ` +
        `stopping "${category.name}"`
      );
      break;
    }
    antiBot.consumeBudget();

    const url                        = buildPageUrl(category, pageNum);
    const { urls: result, pageClass } = await extractOnePage(url, category.name, pageNum);

    // ── Record detection signal ───────────────────────────────────────────────
    antiBot.record(pageClass);

    // ── Bot-wall / CAPTCHA: blacklist + long cooldown ─────────────────────────
    if (pageClass === 'bot-wall' || pageClass === 'captcha') {
      antiBot.blacklistCategory(category.id);
      if (antiBot.shouldSleepForBotWall()) {
        const cooldownMs = (10 + Math.floor(Math.random() * 10)) * 60_000;  // 10–20 min
        logger.warn(
          `[Extractor] ⚠ ${pageClass.toUpperCase()} on "${category.name}" — ` +
          `cooling down ${Math.round(cooldownMs / 60_000)} min`
        );
        await sleep(cooldownMs);
      }
      break;
    }

    if (result === null) {
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

// ── Cycle warm-up — builds session trust before each crawl cycle ─────────────
// Visits a non-category Amazon page + performs a fake search so the browser
// session looks like a human shopper, not a direct search-result hammerer.

const WARM_UP_BROWSE_PAGES = [
  'https://www.amazon.in/gp/new-releases/electronics/',
  'https://www.amazon.in/gp/bestsellers/shoes/',
  'https://www.amazon.in/gp/new-releases/apparel/',
  'https://www.amazon.in/deals',
  'https://www.amazon.in/gp/new-releases/beauty/',
];

const WARM_UP_SEARCH_URLS = [
  'https://www.amazon.in/s?k=wireless+earphones+under+1000',
  'https://www.amazon.in/s?k=running+shoes+men+size+9',
  'https://www.amazon.in/s?k=face+wash+women+skincare',
  'https://www.amazon.in/s?k=smartwatch+under+5000',
  'https://www.amazon.in/s?k=gym+gloves+fitness+equipment',
  'https://www.amazon.in/s?k=laptop+backpack+college',
];

async function cycleWarmUp() {
  logger.info('[AntiBot] Cycle warm-up starting — building session trust…');

  // Step 1: Browse a stable Amazon landing page (new-releases / bestsellers)
  const browseUrl = WARM_UP_BROWSE_PAGES[Math.floor(Math.random() * WARM_UP_BROWSE_PAGES.length)];
  let page = null;
  try {
    page = await openPage({ blockAssets: false });
    await page.goto(browseUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await sleep(1500 + Math.floor(Math.random() * 2000));
    await simulateHuman(page);
    const scrollH = await page.evaluate(() => document.body.scrollHeight).catch(() => 2000);
    await smoothScrollTo(page, Math.floor(scrollH * (0.25 + Math.random() * 0.2)));
    await sleep(800 + Math.floor(Math.random() * 1200));
  } catch (e) {
    logger.debug(`[AntiBot] Warm-up browse non-fatal: ${e.message}`);
  } finally {
    if (page) { await page.close().catch(() => {}); page = null; }
  }

  await sleep(1000 + Math.floor(Math.random() * 1500));

  // Step 2: Perform a generic search — mimics user looking for products
  const searchUrl = WARM_UP_SEARCH_URLS[Math.floor(Math.random() * WARM_UP_SEARCH_URLS.length)];
  try {
    page = await openPage({ blockAssets: 'media' });
    await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await sleep(1200 + Math.floor(Math.random() * 1800));
    await simulateHuman(page);
    await sleep(600 + Math.floor(Math.random() * 800));
    logger.info(`[AntiBot] Warm-up search: ${searchUrl.split('?k=')[1] || searchUrl}`);
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
