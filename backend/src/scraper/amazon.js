/**
 * Amazon India Product Scraper
 *
 * Returns standardised deal object.
 * All selector arrays are passed into page.evaluate() as arguments
 * so closures do NOT break serialisation.
 */

const { openPage, randomDelay } = require('./browser');
const logger = require('../../utils/logger');

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

// Runs inside browser — must be a plain function, no closures
function amazonPageEvaluator(priceSelectors, originalSelectors, titleSelectors, imageSelectors) {
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

  const title         = qText(titleSelectors);
  const priceText     = qText(priceSelectors);
  const originalText  = qText(originalSelectors);
  const image         = qAttr(imageSelectors, 'src');
  const price         = parseNum(priceText);
  const originalPrice = parseNum(originalText);

  let discount = null;
  if (price && originalPrice && originalPrice > price) {
    discount = Math.round(((originalPrice - price) / originalPrice) * 100);
  }

  return { title, price, originalPrice, discount, image, url: window.location.href };
}

async function scrapeAmazon(url, attempt = 1, maxAttempts = 3) {
  const page = await openPage({ blockAssets: attempt > 1 });

  try {
    logger.info(`[Amazon][Attempt ${attempt}/${maxAttempts}] ${url}`);

    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await randomDelay(1500, 3500);

    const content = await page.content();
    if (BOT_SIGNALS.some((s) => content.includes(s))) {
      throw new Error('Bot/CAPTCHA detected');
    }

    const currentUrl = page.url();
    if (!currentUrl.includes('/dp/') && !currentUrl.includes('/gp/product/')) {
      throw new Error(`Redirected away from product: ${currentUrl}`);
    }

    try {
      await page.waitForSelector(TITLE_SELECTORS[0], { timeout: 8000 });
    } catch {
      logger.warn('[Amazon] Primary title selector timeout — trying fallbacks');
    }

    const raw = await page.evaluate(
      amazonPageEvaluator,
      PRICE_SELECTORS,
      ORIGINAL_PRICE_SELECTORS,
      TITLE_SELECTORS,
      IMAGE_SELECTORS
    );

    if (!raw.title) throw new Error('Title not found — layout may have changed');

    return { ...raw, platform: 'amazon' };
  } catch (err) {
    logger.error(`[Amazon][Attempt ${attempt}] ${err.message}`);
    if (attempt < maxAttempts) {
      await new Promise((r) => setTimeout(r, attempt * 3000));
      return scrapeAmazon(url, attempt + 1, maxAttempts);
    }
    throw new Error(`Amazon scrape failed after ${maxAttempts} attempts: ${err.message}`);
  } finally {
    await page.close().catch(() => {});
  }
}

module.exports = { scrapeAmazon };
