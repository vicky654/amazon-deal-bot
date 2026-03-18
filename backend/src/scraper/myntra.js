/**
 * Myntra Product Scraper
 *
 * Myntra is a heavy SPA — we wait for key elements.
 */

const { openPage, randomDelay } = require('./browser');
const logger = require('../../utils/logger');

const TITLE_SELECTORS = [
  '.pdp-title',
  'h1.pdp-title',
  '.pdp-product-description-content h1',
  'h1[class*="title"]',
];

const BRAND_SELECTORS = [
  '.pdp-name',
  '.pdp-product-description-content .pdp-name',
];

const PRICE_SELECTORS = [
  '.pdp-price strong',
  '.pdp-discounted-price strong',
  'span[class*="discounted"] strong',
  '.pdp-price span',
];

const ORIGINAL_PRICE_SELECTORS = [
  '.pdp-mrp s',
  '.pdp-price s',
  'span.pdp-mrp s',
  's[class*="mrp"]',
];

const DISCOUNT_SELECTORS = [
  '.pdp-discount span',
  'span[class*="discount"]',
];

const IMAGE_SELECTORS = [
  'picture.image-grid-image img',
  '.image-grid-image img',
  'img[class*="product"]',
  '.pdp-image img',
];

function myntraEvaluator(titleSels, brandSels, priceSels, origSels, discSels, imgSels) {
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

  const brand        = qText(brandSels);
  const productTitle = qText(titleSels);
  const title        = brand && productTitle ? `${brand} ${productTitle}` : productTitle || brand;
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

async function scrapeMyntra(url, attempt = 1, maxAttempts = 3) {
  const page = await openPage({ blockAssets: false }); // Myntra SPA needs JS

  try {
    logger.info(`[Myntra][Attempt ${attempt}/${maxAttempts}] ${url}`);

    await page.goto(url, { waitUntil: 'networkidle2', timeout: 50000 });
    await randomDelay(2500, 5000);

    try {
      await page.waitForSelector(TITLE_SELECTORS[0], { timeout: 10000 });
    } catch {
      logger.warn('[Myntra] Primary title selector timeout — trying fallbacks');
    }

    const raw = await page.evaluate(
      myntraEvaluator,
      TITLE_SELECTORS,
      BRAND_SELECTORS,
      PRICE_SELECTORS,
      ORIGINAL_PRICE_SELECTORS,
      DISCOUNT_SELECTORS,
      IMAGE_SELECTORS
    );

    if (!raw.title) throw new Error('Title not found');

    return { ...raw, platform: 'myntra' };
  } catch (err) {
    logger.error(`[Myntra][Attempt ${attempt}] ${err.message}`);
    if (attempt < maxAttempts) {
      await new Promise((r) => setTimeout(r, attempt * 4000));
      return scrapeMyntra(url, attempt + 1, maxAttempts);
    }
    throw new Error(`Myntra scrape failed after ${maxAttempts} attempts: ${err.message}`);
  } finally {
    await page.close().catch(() => {});
  }
}

module.exports = { scrapeMyntra };
