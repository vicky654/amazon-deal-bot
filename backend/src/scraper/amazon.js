/**
 * Amazon India Product Scraper — ultra-stable, Amazon-only
 *
 * - domcontentloaded only (never networkidle2)
 * - Fresh page per request, browser auto-relaunched on disconnect
 * - "frame detached" aware retry
 * - Blocks images/fonts/media/stylesheet for speed
 * - Returns null on final failure (never crashes the queue)
 */

const { openPage, sleep } = require('./browser');
const logger = require('../../utils/logger');

// ── Selectors ─────────────────────────────────────────────────────────────────

const TITLE_SELECTORS = [
  '#productTitle',
  '#title span',
  '.product-title-word-break',
  'h1.a-size-large',
];

const PRICE_SELECTORS = [
  '.priceToPay .a-offscreen',
  '.apexPriceToPay .a-offscreen',
  '#corePriceDisplay_desktop_feature_div .a-offscreen',
  '#corePrice_desktop .a-offscreen',
  '#priceblock_dealprice',
  '#priceblock_ourprice',
  '#sns-base-price',
  '.a-price[data-a-color="price"] .a-offscreen',
  '.a-price .a-offscreen',
  '.a-price-whole',
];

const ORIGINAL_PRICE_SELECTORS = [
  '.basisPrice .a-offscreen',
  '.priceBlockStrikePriceString',
  '#priceblock_listprice',
  '#listPrice',
  '.a-price.a-text-price .a-offscreen',
  '.a-text-price .a-offscreen',
  '.a-size-small.a-color-secondary.a-text-strike',
  '[data-a-strike="true"] .a-offscreen',
];

const IMAGE_SELECTORS = [
  '#landingImage',
  '#imgBlkFront',
  '#main-image',
  '#imageBlock img',
  '.a-dynamic-image',
];

const BOT_SIGNALS = [
  'Enter the characters you see below',
  "Sorry, we just need to make sure you're not a robot",
  'automated access',
  'CAPTCHA',
  'api-services-support@amazon',
];

// ── Page evaluator (runs inside browser — no closures) ────────────────────────

function amazonEvaluator(titleSels, priceSels, origSels, imgSels) {
  function qText(sels) {
    for (const s of sels) {
      const el = document.querySelector(s);
      if (el) { const t = (el.innerText || el.textContent || '').trim(); if (t) return t; }
    }
    return null;
  }
  function qAttr(sels, attr) {
    for (const s of sels) { const el = document.querySelector(s); if (el && el[attr]) return el[attr]; }
    return null;
  }
  function parseNum(t) {
    if (!t) return null;
    const n = parseFloat(t.replace(/[^0-9.]/g, ''));
    return isNaN(n) ? null : n;
  }

  const title         = qText(titleSels);
  const price         = parseNum(qText(priceSels));
  const originalPrice = parseNum(qText(origSels));
  const image         = qAttr(imgSels, 'src');
  const discount      = (price && originalPrice && originalPrice > price)
    ? Math.round(((originalPrice - price) / originalPrice) * 100)
    : null;

  return { title, price, originalPrice, discount, image, url: window.location.href };
}

// ── Scraper ───────────────────────────────────────────────────────────────────

const MAX_ATTEMPTS = 3;

async function scrapeAmazon(url, attempt = 1) {
  logger.info(`[Amazon] START → ${url} (attempt ${attempt}/${MAX_ATTEMPTS})`);

  // Extract ASIN from URL for reliable DB dedup
  const asinMatch = url.match(/\/dp\/([A-Z0-9]{10})/i);
  const asin      = asinMatch ? asinMatch[1].toUpperCase() : null;

  let page = null;

  try {
    // Always fresh page — browser auto-relaunches if disconnected (browser.js)
    page = await openPage({ blockAssets: true });

    // ── Navigate ────────────────────────────────────────────────────────────
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
    } catch (navErr) {
      // Mark detached errors so retry logic can identify them
      if (navErr.message.includes('detached') || navErr.message.includes('Navigation failed')) {
        navErr._detached = true;
      }
      throw navErr;
    }

    // ── Stability: wait for body + settle ───────────────────────────────────
    await page.waitForSelector('body', { timeout: 15000 });
    await sleep(3000);

    // ── Bot / CAPTCHA check ─────────────────────────────────────────────────
    const html = await page.content();
    if (BOT_SIGNALS.some((s) => html.includes(s))) {
      throw new Error('Bot/CAPTCHA detected');
    }

    // ── Product page validation ─────────────────────────────────────────────
    const finalUrl = page.url();
    if (!finalUrl.includes('/dp/') && !finalUrl.includes('/gp/product/')) {
      throw new Error(`Redirected off product page: ${finalUrl}`);
    }

    // ── Wait for title (best-effort) ────────────────────────────────────────
    await page.waitForSelector('#productTitle', { timeout: 15000 }).catch(() => {
      logger.warn('[Amazon] #productTitle timeout — using fallback selectors');
    });

    // ── Extract ─────────────────────────────────────────────────────────────
    const raw = await page.evaluate(
      amazonEvaluator,
      TITLE_SELECTORS,
      PRICE_SELECTORS,
      ORIGINAL_PRICE_SELECTORS,
      IMAGE_SELECTORS,
    );

    if (!raw.title || !raw.price) {
      throw new Error(`Missing data — title=${!!raw.title} price=${!!raw.price}`);
    }

    logger.info(`[Amazon] SUCCESS → title="${raw.title.slice(0, 60)}" price=₹${raw.price} discount=${raw.discount ?? 'N/A'}%`);
    return { ...raw, asin, platform: 'amazon' };

  } catch (err) {
    logger.error(`[Amazon] FAIL (attempt ${attempt}/${MAX_ATTEMPTS}) → ${err.message}`);

    // Close broken page before any retry
    if (page) { await page.close().catch(() => {}); page = null; }

    if (attempt < MAX_ATTEMPTS) {
      const delay = 2000 + Math.floor(Math.random() * 3000); // 2–5 s
      logger.info(`[Amazon] Retrying in ${Math.round(delay / 1000)}s…`);
      await sleep(delay);
      return scrapeAmazon(url, attempt + 1);
    }

    logger.warn(`[Amazon] SKIPPED URL — ${url}`);
    return null; // never throw — processProduct handles null cleanly

  } finally {
    if (page) await page.close().catch(() => {});
  }
}

module.exports = { scrapeAmazon };
