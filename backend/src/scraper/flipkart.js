/**
 * Flipkart Product Scraper
 */

const { openPage, randomDelay } = require('./browser');
const logger = require('../../utils/logger');

const TITLE_SELECTORS = [
  '.B_NuCI',
  'h1.yhB1nd',
  'span.B_NuCI',
  'h1[class*="title"]',
  'div[class*="title"] h1',
];

const PRICE_SELECTORS = [
  '._30jeq3._16Jk6d',
  '._16Jk6d',
  'div._30jeq3',
  'div[class*="price"] ._30jeq3',
];

const ORIGINAL_PRICE_SELECTORS = [
  '._3I9_wc._2p6lqe',
  '._3I9_wc',
  'div._3I9_wc',
  'span[class*="strike"]',
];

const DISCOUNT_SELECTORS = [
  '._3Ay6Sb._31Dcoz span',
  '._3Ay6Sb span',
  'div[class*="discount"] span',
];

const IMAGE_SELECTORS = [
  '._396cs4._2amPTt._3qGmMb',
  'img._396cs4',
  'img[class*="product-image"]',
  '._2r_T1I img',
];

function flipkartEvaluator(titleSels, priceSels, origSels, discSels, imgSels) {
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
  const priceText     = qText(priceSels);
  const originalText  = qText(origSels);
  const discountText  = qText(discSels);
  const image         = qAttr(imgSels, 'src');
  const price         = parseNum(priceText);
  const originalPrice = parseNum(originalText);

  let discount = parseNum(discountText ? discountText.replace('%', '').replace('off', '').trim() : null);
  if (!discount && price && originalPrice && originalPrice > price) {
    discount = Math.round(((originalPrice - price) / originalPrice) * 100);
  }

  return { title, price, originalPrice, discount, image, url: window.location.href };
}

async function scrapeFlipkart(url, attempt = 1, maxAttempts = 3) {
  const page = await openPage({ blockAssets: attempt > 1 });

  try {
    logger.info(`[Flipkart][Attempt ${attempt}/${maxAttempts}] ${url}`);

    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await randomDelay(2000, 4000);

    // Dismiss login popup if present
    try {
      await page.click('button._2KpZ6l._2doB4z', { timeout: 3000 });
    } catch { /* no popup */ }

    try {
      await page.waitForSelector(TITLE_SELECTORS[0], { timeout: 8000 });
    } catch {
      logger.warn('[Flipkart] Primary title selector timeout — trying fallbacks');
    }

    const raw = await page.evaluate(
      flipkartEvaluator,
      TITLE_SELECTORS,
      PRICE_SELECTORS,
      ORIGINAL_PRICE_SELECTORS,
      DISCOUNT_SELECTORS,
      IMAGE_SELECTORS
    );

    if (!raw.title) throw new Error('Title not found');

    return { ...raw, platform: 'flipkart' };
  } catch (err) {
    logger.error(`[Flipkart][Attempt ${attempt}] ${err.message}`);
    if (attempt < maxAttempts) {
      await new Promise((r) => setTimeout(r, attempt * 3000));
      return scrapeFlipkart(url, attempt + 1, maxAttempts);
    }
    throw new Error(`Flipkart scrape failed after ${maxAttempts} attempts: ${err.message}`);
  } finally {
    await page.close().catch(() => {});
  }
}

module.exports = { scrapeFlipkart };
