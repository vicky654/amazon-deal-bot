/**
 * Ajio Product Scraper
 */

const { openPage, randomDelay } = require('./browser');
const logger = require('../../utils/logger');

const TITLE_SELECTORS = [
  '.prod-name',
  'h1.prod-name',
  '.product-title',
  'h1[class*="prod"]',
  '[class*="productName"]',
];

const PRICE_SELECTORS = [
  '.prod-sp',
  '.prod-discnt-price',
  '[class*="discounted-price"]',
  'span[class*="sale-price"]',
];

const ORIGINAL_PRICE_SELECTORS = [
  '.prod-cp',
  'span[class*="original-price"]',
  'span[class*="strike"]',
  '.prod-price-strike',
];

const DISCOUNT_SELECTORS = [
  '.prod-discnt',
  '[class*="discount-percent"]',
  'span[class*="discount"]',
];

const IMAGE_SELECTORS = [
  '.img-magnifier-container img',
  '.product-image img',
  '.prod-img img',
  'img[class*="product"]',
];

function ajioEvaluator(titleSels, priceSels, origSels, discSels, imgSels) {
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

  const title        = qText(titleSels);
  const priceText    = qText(priceSels);
  const originalText = qText(origSels);
  const discountText = qText(discSels);
  const image        = qAttr(imgSels, 'src');
  const price        = parseNum(priceText);
  const originalPrice = parseNum(originalText);

  let discount = parseNum(discountText ? discountText.replace(/[^0-9]/g, '') : null);
  if (!discount && price && originalPrice && originalPrice > price) {
    discount = Math.round(((originalPrice - price) / originalPrice) * 100);
  }

  return { title, price, originalPrice, discount, image, url: window.location.href };
}

async function scrapeAjio(url, attempt = 1, maxAttempts = 3) {
  const page = await openPage({ blockAssets: false }); // Ajio is SPA

  try {
    logger.info(`[Ajio][Attempt ${attempt}/${maxAttempts}] ${url}`);

    await page.goto(url, { waitUntil: 'networkidle2', timeout: 50000 });
    await randomDelay(2500, 5000);

    try {
      await page.waitForSelector(TITLE_SELECTORS[0], { timeout: 10000 });
    } catch {
      logger.warn('[Ajio] Primary title selector timeout — trying fallbacks');
    }

    const raw = await page.evaluate(
      ajioEvaluator,
      TITLE_SELECTORS,
      PRICE_SELECTORS,
      ORIGINAL_PRICE_SELECTORS,
      DISCOUNT_SELECTORS,
      IMAGE_SELECTORS
    );

    if (!raw.title) throw new Error('Title not found');

    return { ...raw, platform: 'ajio' };
  } catch (err) {
    logger.error(`[Ajio][Attempt ${attempt}] ${err.message}`);
    if (attempt < maxAttempts) {
      await new Promise((r) => setTimeout(r, attempt * 4000));
      return scrapeAjio(url, attempt + 1, maxAttempts);
    }
    throw new Error(`Ajio scrape failed after ${maxAttempts} attempts: ${err.message}`);
  } finally {
    await page.close().catch(() => {});
  }
}

module.exports = { scrapeAjio };
