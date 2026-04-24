/**
 * Amazon India Product Scraper
 *
 * 3-Layer early-exit system:
 *   Layer 1 — Extractor price filter (handled in extractor.js, before this runs)
 *   Layer 2 — HTML unavailability check (attempt 1, before any sleep)
 *   Layer 3 — Redirect guard (attempt 1, before any sleep)
 *
 * Retry only for: navigation timeouts, transient network errors
 * Never retry:    redirects, unavailable products, bot walls
 */

const { openPage, sleep } = require('./browser');
const logger = require('../../utils/logger');

// ── Skip metrics (process-lifetime counters) ──────────────────────────────────
const metrics = {
  skipped_redirect:    0,
  skipped_unavailable: 0,
  skipped_bot_captcha: 0,
  skipped_dom:         0,
  success:             0,
  failed:              0,  // exhausted all retries on transient errors
};

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

// ── Layer 3: Non-amazon domains that indicate a redirect away from product ────
const REDIRECT_DOMAINS = [
  'primevideo.com',
  'kdp.amazon.com',
  'music.amazon',
  'audible.',
  'amazon.com/gp/video',
];

// ── Layer 2: HTML strings that mean no purchasable price exists — ever ────────
const UNAVAILABLE_PATTERN = /Currently unavailable|Currently out of stock|This is an Add-on item|This item is an Add-on|Add-on Item|This title is not currently available|This item is not available|We don't know when or if this item will be back in stock|This item has been discontinued/i;

// ── Bot / CAPTCHA signals ─────────────────────────────────────────────────────
const BOT_PATTERN = /Enter the characters you see below|we just need to make sure you're not a robot|automated access|api-services-support@amazon/i;

// ── Page evaluator (serialised into browser — no closures allowed) ────────────

function amazonEvaluator(titleSels, priceSels, origSels, imgSels) {
  function qText(sels) {
    for (const s of sels) {
      const el = document.querySelector(s);
      if (el) {
        const t = (el.innerText || el.textContent || '').trim();
        if (t) return t;
      }
    }
    return null;
  }
  function qAttr(sels, attr) {
    for (const s of sels) {
      const el = document.querySelector(s);
      if (el && el[attr]) return el[attr];
    }
    return null;
  }
  function parseNum(t) {
    if (!t) return null;
    const n = parseFloat(t.replace(/[^0-9.]/g, ''));
    return isNaN(n) ? null : n;
  }

  // ── Image: try data-a-dynamic-image (high-res JSON map) before falling back to src ──
  // Amazon stores high-res URLs in data-a-dynamic-image even when the src is a placeholder.
  function getImage(sels) {
    for (const s of sels) {
      const el = document.querySelector(s);
      if (!el) continue;

      // data-a-dynamic-image = '{"https://...jpg":[1500,1500],"https://...jpg":[75,75]}'
      const dynamicRaw = el.getAttribute('data-a-dynamic-image');
      if (dynamicRaw) {
        try {
          const urlMap = JSON.parse(dynamicRaw);
          const urls   = Object.keys(urlMap);
          // Prefer the largest image (sort by pixel area descending)
          urls.sort((a, b) => {
            const [wa, ha] = urlMap[a] || [0, 0];
            const [wb, hb] = urlMap[b] || [0, 0];
            return (wb * hb) - (wa * ha);
          });
          if (urls.length > 0 && urls[0].startsWith('https://')) return urls[0];
        } catch (_) {}
      }

      // Fall back to src attribute
      const src = el.getAttribute('src') || el.src || '';
      // Skip tiny placeholder: Amazon 1px placeholder is "transparent-pixel.gif" or data: URI
      if (src && src.startsWith('https://') && !src.includes('transparent-pixel') && !src.startsWith('data:')) {
        return src;
      }
    }
    return null;
  }

  const title         = qText(titleSels);
  const price         = parseNum(qText(priceSels));
  const originalPrice = parseNum(qText(origSels));
  const image         = getImage(imgSels);
  const discount      = (price && originalPrice && originalPrice > price)
    ? Math.round(((originalPrice - price) / originalPrice) * 100)
    : null;

  // DOM-rendered unavailability — catches JS-injected add-on badges and OOS states
  const isUnavailable = !!(
    document.getElementById('outOfStock') ||
    document.querySelector('[data-feature-name="addonBadge"]') ||
    document.querySelector('.addon-item-description') ||
    document.querySelector('#availability .a-color-error') ||
    [...document.querySelectorAll('#availability span')]
      .some((el) => /unavailable|out of stock/i.test(el.innerText || ''))
  );

  return { title, price, originalPrice, discount, image, url: window.location.href, isUnavailable };
}

// ── Scraper ───────────────────────────────────────────────────────────────────

const MAX_ATTEMPTS = 3;

function skip(reason, url, noRetry = true) {
  metrics[`skipped_${reason}`] = (metrics[`skipped_${reason}`] || 0) + 1;
  logger.warn(`[SKIP] ${reason} — ${url}`);
  const err = new Error(`[SKIP] ${reason}`);
  if (noRetry) err._noRetry = true;
  return err;
}

async function scrapeAmazon(url, attempt = 1) {
  logger.info(`[Amazon] START → ${url} (attempt ${attempt}/${MAX_ATTEMPTS})`);

  const asinMatch = url.match(/\/dp\/([A-Z0-9]{10})/i);
  const asin      = asinMatch ? asinMatch[1].toUpperCase() : null;

  let page = null;

  try {
    page = await openPage({ blockAssets: 'heavy' });

    // ── Navigate ─────────────────────────────────────────────────────────────
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
    } catch (navErr) {
      // Detached frame = transient — allow retry
      if (navErr.message.includes('detached') || navErr.message.includes('Navigation failed')) {
        navErr._detached = true;
      }
      throw navErr;
    }

    await page.waitForSelector('body', { timeout: 15000 });

    // ── Read HTML immediately (before sleep) for fast early exits ─────────────
    const html = await page.content();

    // ── Layer 3: Redirect guard (attempt 1 only — permanent, no retry) ────────
    if (attempt === 1) {
      const finalUrl = page.url();
      const isRedirected =
        (!finalUrl.includes('/dp/') && !finalUrl.includes('/gp/product/')) ||
        REDIRECT_DOMAINS.some((d) => finalUrl.includes(d));

      if (isRedirected) {
        throw skip('redirect', url);
      }
    }

    // ── Layer 2: HTML unavailability (attempt 1 only — product state is permanent) ─
    if (attempt === 1) {
      if (UNAVAILABLE_PATTERN.test(html)) {
        metrics.skipped_unavailable++;
        logger.warn(`[SKIP] unavailable — ${url}`);
        return null; // silent return — not an error, just no product
      }
    }

    // ── Bot / CAPTCHA (no retry — same session will hit it again) ─────────────
    if (BOT_PATTERN.test(html)) {
      throw skip('bot_captcha', url);
    }

    // ── Settle page before DOM extraction ────────────────────────────────────
    await sleep(3000);

    // ── Wait for title (best-effort) ─────────────────────────────────────────
    await page.waitForSelector('#productTitle', { timeout: 15000 }).catch(() => {
      logger.warn('[Amazon] #productTitle timeout — trying fallback selectors');
    });

    // ── Extract ──────────────────────────────────────────────────────────────
    const raw = await page.evaluate(
      amazonEvaluator,
      TITLE_SELECTORS,
      PRICE_SELECTORS,
      ORIGINAL_PRICE_SELECTORS,
      IMAGE_SELECTORS,
    );

    // DOM-rendered unavailability (JS-injected after page load)
    if (raw.isUnavailable) {
      metrics.skipped_dom++;
      logger.warn(`[SKIP] dom_unavailable — ${url}`);
      return null;
    }

    if (!raw.title || !raw.price) {
      throw new Error(`Missing data — title=${!!raw.title} price=${!!raw.price}`);
    }

    metrics.success++;
    logger.info(`[Amazon][OK] "${raw.title.slice(0, 55)}" price=₹${raw.price} disc=${raw.discount ?? '?'}% img=${!!raw.image} asin=${asin}`);
    return { ...raw, asin, platform: 'amazon' };

  } catch (err) {
    logger.error(`[Amazon] FAIL (attempt ${attempt}/${MAX_ATTEMPTS}) → ${err.message}`);

    if (page) { await page.close().catch(() => {}); page = null; }

    // ── _noRetry: permanent failures — exit immediately ───────────────────────
    if (err._noRetry) {
      return null;
    }

    // ── Transient failures — retry with deterministic backoff ────────────────
    if (attempt < MAX_ATTEMPTS) {
      const delay = 2000 * attempt; // 2s → 4s
      logger.info(`[Amazon] Retry ${attempt + 1}/${MAX_ATTEMPTS} in ${delay / 1000}s…`);
      await sleep(delay);
      return scrapeAmazon(url, attempt + 1);
    }

    metrics.failed++;
    logger.warn(`[Amazon] EXHAUSTED — ${url}`);
    return null;

  } finally {
    if (page) await page.close().catch(() => {});
  }
}

module.exports = { scrapeAmazon, metrics };
