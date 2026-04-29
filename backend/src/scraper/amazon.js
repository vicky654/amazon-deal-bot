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

const { openPage, sleep, simulateHuman, smoothScroll, randomDelay, getBrowserDiagnostics } = require('./browser');
const logger = require('../../utils/logger');
const fs   = require('fs');
const path = require('path');

const DEBUG_DIR = path.join(__dirname, '..', '..', 'debug');

// ── Skip metrics (process-lifetime counters) ──────────────────────────────────
const metrics = {
  skipped_redirect:          0,
  skipped_unavailable:       0,
  skipped_bot_captcha:       0,
  skipped_bot_wall:          0,
  skipped_captcha:           0,
  skipped_sign_in:           0,
  skipped_homepage_redirect: 0,
  skipped_wrong_layout:      0,
  skipped_dom:               0,
  success:                   0,
  failed:                    0,  // exhausted all retries on transient errors
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

// ── Product-page anti-bot classification ──────────────────────────────────────
function classifyProductPage(html, title, finalUrl) {
  if (!html || html.length < 1500) return 'blank-page';
  const lower = html.toLowerCase();
  const t     = (title || '').toLowerCase();
  const url   = (finalUrl || '').toLowerCase();

  if (/captcha|robot check|enter the characters/i.test(lower))                 return 'captcha';
  if (/automated access|unusual traffic/i.test(lower))                         return 'bot-wall';
  if (/we just need to make sure/i.test(lower))                                return 'bot-wall';
  if (/sign-in|signin|ap_signin|auth-portal/i.test(url))                       return 'sign-in';
  if (!url.includes('/dp/') && !url.includes('/gp/product/')) {
    if (url === 'https://www.amazon.in/' || url === 'https://www.amazon.in')   return 'homepage-redirect';
    if (url.includes('amazon.in') && !url.includes('/dp/') && !url.includes('/gp/product/')) return 'homepage-redirect';
  }
  if (!lower.includes('producttitle') && !lower.includes('priceblock') && !lower.includes('coreprice')) return 'wrong-layout';
  return 'ok';
}

// ── Debug snapshot for product pages ──────────────────────────────────────────
async function saveDebugSnapshot(page, label) {
  try {
    fs.mkdirSync(DEBUG_DIR, { recursive: true });
    const safe = label.replace(/[^a-z0-9-]/gi, '_').toLowerCase().slice(0, 60);
    const png  = path.join(DEBUG_DIR, `failure-${safe}.png`);
    const html = path.join(DEBUG_DIR, `failure-${safe}.html`);
    await page.screenshot({ path: png, fullPage: true }).catch(() => {});
    const content = await page.content().catch(() => '');
    if (content) fs.writeFileSync(html, content, 'utf8');
    logger.warn(`[Amazon] Debug → ${png}`);
    logger.warn(`[Amazon] Debug → ${html}`);
  } catch (e) {
    logger.warn(`[Amazon] saveDebugSnapshot failed: ${e.message}`);
  }
}

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

  // ASIN lifecycle — all declared before try/catch so every code path can reference them
  const originalAsin = (url.match(/\/dp\/([A-Z0-9]{10})/i) || [])[1]?.toUpperCase() || null;
  let extractedAsin  = null;  // set from page.url() after navigation
  let finalAsin      = null;  // set from window.location.href via page.evaluate()

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
    const html      = await page.content();
    const finalUrl  = page.url();
    const pageTitle = await page.title().catch(() => '(unavailable)');
    const diag      = getBrowserDiagnostics();
    const pageClass = classifyProductPage(html, pageTitle, finalUrl);

    logger.info(
      `[Amazon] Diagnostics url="${finalUrl}" title="${pageTitle}" class=${pageClass} ` +
      `browserAge=${diag.ageMinutes}min/${diag.ageLimit}min pages=${diag.pageCount}/${diag.pageLimit}`
    );

    // ── Hard early return for blocked pages — before ANY ASIN regex or extraction ──
    if (pageClass === 'bot-wall' || pageClass === 'captcha' || pageClass === 'homepage-redirect') {
      logger.warn(`[Amazon] BLOCKED PAGE ${pageClass} → skipping`);
      return null;
    }

    // ── Other non-product layouts — skip without retry ────────────────────────
    if (pageClass === 'sign-in' || pageClass === 'wrong-layout') {
      await saveDebugSnapshot(page, `amazon-${pageClass}-${originalAsin || 'unknown'}`);
      throw skip(pageClass, url);
    }

    // Capture ASIN from the navigated URL — runs only on valid product pages
    const navAsinMatch = finalUrl.match(/\/dp\/([A-Z0-9]{10})/i);
    extractedAsin = navAsinMatch ? navAsinMatch[1].toUpperCase() : null;

    // ── Layer 3: Redirect guard (attempt 1 only — permanent, no retry) ────────
    if (attempt === 1) {
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

    // ── Bot / CAPTCHA fallback (no retry) ─────────────────────────────────────
    if (BOT_PATTERN.test(html)) {
      await saveDebugSnapshot(page, `amazon-bot-${originalAsin || 'unknown'}`);
      throw skip('bot_captcha', url);
    }

    // ── Human-like settle before DOM extraction ───────────────────────────────
    await simulateHuman(page);
    await randomDelay(2500, 5000);
    const bodyH = await page.evaluate(() => document.body.scrollHeight).catch(() => 2000);
    await smoothScroll(page, Math.floor(bodyH * (0.2 + Math.random() * 0.3)));
    await randomDelay(800, 1800);

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

    // Resolve ASIN — prefer page-reported URL over navigated URL over input URL.
    // Amazon silently redirects superseded/variant ASINs to the active product;
    // using the original ASIN would generate an affiliate URL that returns 404.
    const rawAsinMatch = (raw.url || '').match(/\/dp\/([A-Z0-9]{10})/i);
    finalAsin = rawAsinMatch ? rawAsinMatch[1].toUpperCase() : null;

    const safeAsin = finalAsin || extractedAsin || originalAsin || null;

    if (!safeAsin) {
      logger.warn(`[Amazon] SKIP — could not resolve ASIN from URL or page: ${url}`);
      return null;
    }

    const resolvedFrom = finalAsin ? 'page-eval' : extractedAsin ? 'page-url' : 'input-url';
    if (finalAsin && originalAsin && finalAsin !== originalAsin) {
      logger.warn(`[Amazon] ASIN redirected: ${originalAsin} → ${finalAsin} (affiliate URL updated to final ASIN)`);
    } else {
      logger.info(`[Amazon] ASIN resolved=${safeAsin} source=${resolvedFrom}`);
    }

    metrics.success++;
    logger.info(`[Amazon][OK] "${raw.title.slice(0, 55)}" price=₹${raw.price} disc=${raw.discount ?? '?'}% img=${!!raw.image} asin=${safeAsin}`);
    return { ...raw, asin: safeAsin, platform: 'amazon' };

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
