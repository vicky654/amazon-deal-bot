/**
 * ─────────────────────────────────────────────────────────────────────────────
 *  TEST PIPELINE — Amazon India Deal Bot
 *  Full end-to-end test: browser → extraction → affiliate link → Telegram
 *
 *  Run:
 *    cd backend && node test-pipeline.js
 *
 *  Non-headless (watch the browser):
 *    HEADLESS=false node test-pipeline.js
 *
 *  Custom URL:
 *    TEST_URL="https://www.amazon.in/s?k=headphones&sort=discount-rank" node test-pipeline.js
 * ─────────────────────────────────────────────────────────────────────────────
 */

'use strict';
require('dotenv').config();

const fs             = require('fs');
const path           = require('path');
const { chromium }   = require('playwright');
const puppeteerVanilla = require('puppeteer');
const TelegramBot    = require('node-telegram-bot-api');

// ─── CONFIG ───────────────────────────────────────────────────────────────────

const TEST_URL      = process.env.TEST_URL || 'https://www.amazon.in/s?k=running+shoes&sort=discount-rank';
const MAX_PRODUCTS  = 5;
const HEADLESS      = process.env.HEADLESS !== 'false';  // HEADLESS=false to watch
const TRACKING_ID   = process.env.AMAZON_TRACKING_ID || 'dailydeal06f0-21';
const TOKEN         = process.env.TELEGRAM_TOKEN;
const CHAT_ID       = process.env.TELEGRAM_CHAT;

// Reuse the already-downloaded Puppeteer Chromium — no second 200MB download
const CHROMIUM_PATH   = puppeteerVanilla.executablePath();
// Shared profile with the production crawler — same persistent cookies
const CHROME_PROFILE  = path.join(__dirname, 'chrome-profile');

// ─── LOGGER ───────────────────────────────────────────────────────────────────

const C = {
  reset:  '\x1b[0m',
  bold:   '\x1b[1m',
  red:    '\x1b[31m',
  green:  '\x1b[32m',
  yellow: '\x1b[33m',
  cyan:   '\x1b[36m',
  gray:   '\x1b[90m',
};

function ts() {
  return new Date().toTimeString().slice(0, 8);
}

function log(tag, msg, colour = C.cyan) {
  console.log(`${C.gray}${ts()}${C.reset} ${colour}${C.bold}${tag}${C.reset} ${msg}`);
}
function ok(tag, msg)   { log(tag, msg, C.green);  }
function warn(tag, msg) { log(tag, msg, C.yellow); }
function err(tag, msg)  { log(tag, msg, C.red);    }

// ─── PHASE 1: BROWSER LAUNCH ──────────────────────────────────────────────────

const LAUNCH_ARGS = [
  '--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu',
  '--window-size=1366,768', '--disable-blink-features=AutomationControlled', '--lang=en-IN',
  '--ignore-certificate-errors', '--ignore-certificate-errors-spki-list',
  '--allow-running-insecure-content', '--disable-web-security',
  '--disable-background-networking', '--disable-background-timer-throttling',
];

// Comprehensive stealth init script — mirrors browser.js STEALTH_SCRIPT
const STEALTH_INIT = () => {
  try { Object.defineProperty(navigator, 'webdriver', { get: () => undefined, configurable: true }); } catch(e) {}
  try {
    const arr = [
      { name: 'Chrome PDF Plugin',   filename: 'internal-pdf-viewer',                  description: 'Portable Document Format' },
      { name: 'Chrome PDF Viewer',   filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai',      description: '' },
      { name: 'Native Client',       filename: 'internal-nacl-plugin',                  description: '' },
    ];
    arr.item = (i) => arr[i]||null; arr.namedItem = (n) => arr.find(p=>p.name===n)||null; arr.refresh = ()=>{};
    Object.defineProperty(navigator, 'plugins', { get: () => arr, configurable: true });
  } catch(e) {}
  try { Object.defineProperty(navigator, 'languages',           { get: ()=>['en-IN','en-US','en'],  configurable:true }); } catch(e) {}
  try { Object.defineProperty(navigator, 'hardwareConcurrency', { get: ()=>8,                       configurable:true }); } catch(e) {}
  try { Object.defineProperty(navigator, 'deviceMemory',        { get: ()=>8,                       configurable:true }); } catch(e) {}
  try {
    const noop = ()=>{}, lst = {addListener:noop,removeListener:noop};
    window.chrome = {
      app:{isInstalled:false}, csi:()=>({}), loadTimes:()=>({}),
      runtime:{id:undefined,connect:noop,sendMessage:noop,getManifest:()=>({}),onMessage:lst,onConnect:lst,onInstalled:lst,
        PlatformOs:{WIN:'win',MAC:'mac',LINUX:'linux',ANDROID:'android',CROS:'cros'},
        OnInstalledReason:{INSTALL:'install',UPDATE:'update',CHROME_UPDATE:'chrome_update'}},
      webstore:{onInstallStageChanged:lst,onDownloadProgress:lst,install:noop},
    };
  } catch(e) {}
  try {
    const orig = window.Permissions.prototype.query;
    window.Permissions.prototype.query = function(p){
      if(p.name==='notifications') return Promise.resolve({state:'denied',onchange:null});
      return orig.call(this,p);
    };
  } catch(e) {}
  try {
    const patch = Ctx => { if(!Ctx)return; const o=Ctx.prototype.getParameter; Ctx.prototype.getParameter=function(p){if(p===37445)return 'Intel Inc.';if(p===37446)return 'Intel Iris OpenGL Engine';return o.call(this,p);}; };
    patch(window.WebGLRenderingContext); patch(window.WebGL2RenderingContext);
  } catch(e) {}
};

async function launchBrowser() {
  fs.mkdirSync(CHROME_PROFILE, { recursive: true });
  log('[Amazon]', `Launching Chromium — headless=${HEADLESS} profile=${CHROME_PROFILE}`);

  // launchPersistentContext combines browser + context with persistent cookies/session
  const context = await chromium.launchPersistentContext(CHROME_PROFILE, {
    executablePath:    CHROMIUM_PATH,
    headless:          HEADLESS,
    args:              LAUNCH_ARGS,
    ignoreHTTPSErrors: true,
    viewport:          { width: 1366, height: 768 },
    userAgent:         'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.6167.85 Safari/537.36',
    locale:            'en-IN',
    timezoneId:        'Asia/Kolkata',
    extraHTTPHeaders:  {
      'Accept-Language':           'en-IN,en;q=0.9',
      'Accept':                    'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
      'Accept-Encoding':           'gzip, deflate, br',
      'Upgrade-Insecure-Requests': '1',
      'Cache-Control':             'max-age=0',
      'DNT':                       '1',
    },
  });

  await context.addInitScript(STEALTH_INIT);
  ok('[Amazon]', 'Browser launched with persistent profile');
  return context;  // PersistentContext acts as both browser and context
}

// ─── PHASE 2: WARM-UP + OPEN PAGE ────────────────────────────────────────────

async function warmUpContext(context) {
  log('[Amazon]', 'Warm-up: visiting https://www.amazon.in/ for session cookies…');
  const page = await context.newPage();
  try {
    await page.goto('https://www.amazon.in/', { waitUntil: 'domcontentloaded', timeout: 30000 });
    const title = await page.title().catch(() => '');
    ok('[Amazon]', `Warm-up loaded: "${title}"`);
    await page.waitForTimeout(2000 + Math.floor(Math.random() * 1500));
    await page.mouse.move(300 + Math.floor(Math.random() * 400), 200 + Math.floor(Math.random() * 200), { steps: 8 });
    await page.waitForTimeout(600 + Math.floor(Math.random() * 500));
  } catch (e) {
    warn('[Amazon]', `Warm-up failed (non-fatal): ${e.message}`);
  } finally {
    await page.close().catch(() => {});
  }
}

async function openCategoryPage(context) {
  // launchPersistentContext already set all headers + stealth scripts at context level.
  // Just create a new page, block only font/video, and navigate.
  const page = await context.newPage();

  // Block only font and video — images + CSS must load for natural bot-avoidance
  await page.route('**/*', (route) => {
    const type = route.request().resourceType();
    if (['font', 'media'].includes(type)) { route.abort(); }
    else                                  { route.continue(); }
  });

  // Monitor network failures
  page.on('response', (res) => {
    if (res.status() >= 400 && res.url().includes('amazon.in')) {
      warn('[Net]', `${res.status()} ← ${res.url().slice(0, 100)}`);
    }
  });
  page.on('requestfailed', (req) => {
    const e = req.failure()?.errorText || '';
    if (req.url().includes('amazon.in') && e !== 'net::ERR_ABORTED') {
      warn('[Net]', `FAILED ${e} — ${req.url().slice(0, 100)}`);
    }
  });

  log('[Amazon]', `Navigating → ${TEST_URL}`);

  try {
    await page.goto(TEST_URL, { waitUntil: 'domcontentloaded', timeout: 50000 });
  } catch (navErr) {
    err('[Amazon]', `Navigation error: ${navErr.message}`);
    const debugDir = path.join(__dirname, 'debug');
    fs.mkdirSync(debugDir, { recursive: true });
    await page.screenshot({ path: path.join(debugDir, 'nav-failure.png'), fullPage: true }).catch(() => {});
    throw navErr;
  }

  const finalUrl  = page.url();
  const pageTitle = await page.title().catch(() => '(unavailable)');
  ok('[Amazon]', `Loaded URL:  ${finalUrl}`);
  ok('[Amazon]', `Page title:  ${pageTitle}`);

  return page;
}

// ─── PHASE 3: WAIT FOR REAL ASIN CARDS ───────────────────────────────────────

async function waitForGrid(page) {
  log('[Amazon]', 'Waiting for ASIN product cards…');

  // waitForFunction is strictly correct: checks for actual data-asin="B0XXXXXXXX" pattern
  // Unlike waitForSelector('.s-main-slot') which exists even on error/empty pages
  const found = await page
    .waitForFunction(() => {
      const cards = document.querySelectorAll('[data-component-type="s-search-result"][data-asin]');
      return Array.from(cards).some(c => /^[A-Z0-9]{10}$/.test(c.getAttribute('data-asin') || ''));
    }, { timeout: 28000, polling: 800 })
    .then(() => true)
    .catch(() => false);

  log('[Amazon]', `Search grid found: ${found}`);

  if (!found) {
    const html = await page.content().catch(() => '');
    const debugDir = path.join(__dirname, 'debug');
    fs.mkdirSync(debugDir, { recursive: true });
    await page.screenshot({ path: path.join(debugDir, 'grid-failure.png'), fullPage: true }).catch(() => {});
    fs.writeFileSync(path.join(debugDir, 'grid-failure.html'), html, 'utf8');

    let reason = 'unknown';
    if (!html || html.length < 2000)                                  reason = 'blank/empty page';
    else if (/captcha|robot check|automated access/i.test(html))      reason = 'CAPTCHA / bot-wall';
    else if (/your connection is not private|ERR_CERT/i.test(html))   reason = 'SSL warning page';
    else if (!/s-search-result|s-result-item/i.test(html))            reason = 'no product elements in HTML';
    else                                                               reason = 'ASIN pattern not matched within 28s';

    err('[Amazon]', `Grid NOT found — ${reason}`);
    err('[Amazon]', `HTML size: ${html.length} bytes`);
    err('[Amazon]', `Debug → ${path.join(debugDir, 'grid-failure.png')}`);
    throw new Error(`Product grid did not appear: ${reason}`);
  }

  // Smooth incremental scroll to trigger lazy-loaded cards
  await page.evaluate(() => new Promise(resolve => {
    let pos = 0; const h = document.body.scrollHeight;
    const t = setInterval(() => { pos = Math.min(pos + Math.ceil(h/20), h); window.scrollTo(0,pos); if(pos>=h){clearInterval(t);resolve();} }, 55);
  }));
  await page.waitForTimeout(800 + Math.floor(Math.random() * 400));

  ok('[Amazon]', 'Product grid loaded and scrolled');
}

// ─── PHASE 4: EXTRACT PRODUCTS ────────────────────────────────────────────────

async function extractProducts(page) {
  log('[Amazon]', 'Extracting product cards from DOM…');

  const rawProducts = await page.evaluate((maxP) => {
    const cards = Array.from(
      document.querySelectorAll('[data-component-type="s-search-result"][data-asin]')
    );

    console.log(`[DOM] Total cards found: ${cards.length}`);

    const results = [];

    for (const card of cards) {
      if (results.length >= maxP * 3) break; // collect buffer, we'll filter to maxP after

      const asin = (card.getAttribute('data-asin') || '').toUpperCase();
      if (!asin || !/^[A-Z0-9]{10}$/.test(asin)) continue;

      // Skip sponsored
      const sponsored =
        card.querySelector('.puis-sponsored-label-text') ||
        card.querySelector('.s-sponsored-label-info-icon') ||
        card.querySelector('[data-component-type="s-ads-carousel"]');
      if (sponsored) continue;

      // ── Title ────────────────────────────────────────────────────────────────
      const titleEl =
        card.querySelector('h2 a span') ||
        card.querySelector('.a-size-medium.a-color-base.a-text-normal') ||
        card.querySelector('.a-size-base-plus.a-color-base.a-text-normal') ||
        card.querySelector('h2 span');
      const title = titleEl ? (titleEl.innerText || titleEl.textContent || '').trim() : null;
      if (!title) continue;

      // ── Current price ────────────────────────────────────────────────────────
      // Amazon search cards: first .a-price .a-offscreen is the deal price
      const priceEls = card.querySelectorAll('.a-price .a-offscreen');
      const priceText = priceEls.length > 0
        ? (priceEls[0].innerText || priceEls[0].textContent || '').trim()
        : '';

      // ── Original / strike-through price ─────────────────────────────────────
      // Second .a-price.a-text-price .a-offscreen is the original
      const origEl =
        card.querySelector('.a-price.a-text-price .a-offscreen') ||
        card.querySelector('.a-text-price .a-offscreen');
      const origText = origEl ? (origEl.innerText || origEl.textContent || '').trim() : '';

      // ── Image (from search card — src is a thumbnail, enough for Telegram) ───
      const imgEl   = card.querySelector('img.s-image');
      // Hi-res: try data-a-dynamic-image JSON; fall back to src
      let image = null;
      if (imgEl) {
        const dynRaw = imgEl.getAttribute('data-a-dynamic-image');
        if (dynRaw) {
          try {
            const urlMap = JSON.parse(dynRaw);
            const urls   = Object.keys(urlMap);
            urls.sort((a, b) => {
              const [wa, ha] = urlMap[a] || [0, 0];
              const [wb, hb] = urlMap[b] || [0, 0];
              return (wb * hb) - (wa * ha);
            });
            if (urls.length && urls[0].startsWith('http')) image = urls[0];
          } catch (_) {}
        }
        if (!image) {
          const src = imgEl.getAttribute('src') || '';
          if (src.startsWith('http')) image = src;
        }
      }

      // ── Parse numbers ────────────────────────────────────────────────────────
      function toNum(t) {
        if (!t) return null;
        const n = parseFloat(t.replace(/[^0-9.]/g, ''));
        return isNaN(n) ? null : n;
      }

      const price         = toNum(priceText);
      const originalPrice = toNum(origText);

      if (!price) continue; // no price = skip

      const discount =
        price && originalPrice && originalPrice > price
          ? Math.round(((originalPrice - price) / originalPrice) * 100)
          : null;

      results.push({ asin, title, price, originalPrice, discount, image,
        url: `https://www.amazon.in/dp/${asin}` });
    }

    return { totalCards: cards.length, products: results };
  }, MAX_PRODUCTS);

  log('[Amazon]', `Found ${rawProducts.totalCards} product cards in DOM`);

  const products = rawProducts.products.slice(0, MAX_PRODUCTS);

  if (products.length === 0) {
    warn('[Amazon]', 'No products extracted — trying href fallback scan…');
    const fallback = await page.evaluate(() => {
      const seen = new Set();
      const out  = [];
      document.querySelectorAll('a[href*="/dp/"]').forEach((a) => {
        const m = (a.href || '').match(/\/dp\/([A-Z0-9]{10})/i);
        if (m && !seen.has(m[1])) {
          seen.add(m[1].toUpperCase());
          out.push({ asin: m[1].toUpperCase(), title: m[1], price: null, url: `https://www.amazon.in/dp/${m[1].toUpperCase()}` });
        }
      });
      return out.slice(0, 5);
    });
    warn('[Amazon]', `Href fallback found ${fallback.length} ASINs (no price data)`);
    return fallback;
  }

  ok('[Amazon]', `Extracted ${products.length} products (capped at ${MAX_PRODUCTS})`);
  return products;
}

// ─── PHASE 5: BUILD AFFILIATE LINKS ──────────────────────────────────────────

function buildAffiliateUrl(asin) {
  return `https://www.amazon.in/dp/${asin}?tag=${TRACKING_ID}`;
}

// ─── PHASE 6: FORMAT TELEGRAM MESSAGE ────────────────────────────────────────

function escapeHtml(t) {
  if (!t) return '';
  return t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function encodeHref(url) {
  if (!url) return '';
  return url.replace(/&(?!amp;)/g, '&amp;');
}

function formatMessage(product, affiliateUrl) {
  const title  = (product.title || '').slice(0, 180);
  const price  = product.price         ? `₹${Number(product.price).toLocaleString('en-IN')}`         : 'Check Price';
  const mrp    = product.originalPrice ? `₹${Number(product.originalPrice).toLocaleString('en-IN')}` : null;
  const disc   = product.discount      ? `${product.discount}%` : null;
  const saved  = (product.price && product.originalPrice)
    ? `₹${Math.round(product.originalPrice - product.price).toLocaleString('en-IN')}`
    : null;

  const header = disc
    ? `🔥 <b>TEST DEAL — ${disc} OFF</b>`
    : `🔥 <b>TEST DEAL FOUND</b>`;

  const lines = [
    header,
    '',
    `<b>${escapeHtml(title)}</b>`,
    '',
  ];

  if (mrp)  lines.push(`🏷 MRP: <s>${mrp}</s>`);
  lines.push(`💰 Deal Price: <b>${price}</b>`);
  if (disc) lines.push(`⚡ Save: <b>${disc}${saved ? ` (${saved})` : ''}</b>`);
  lines.push('');
  lines.push(`🛒 <a href="${encodeHref(affiliateUrl)}">Buy Now on Amazon</a>`);
  lines.push('');
  lines.push(`🔬 <i>TEST MODE — ASIN: ${product.asin}</i>`);

  return lines.join('\n');
}

// ─── PHASE 7: TELEGRAM SEND ───────────────────────────────────────────────────

async function sendToTelegram(bot, product, affiliateUrl) {
  const caption = formatMessage(product, affiliateUrl);

  log('[Telegram]', `Sending message for ASIN ${product.asin}…`);
  log('[Telegram]', `chat=${CHAT_ID} hasImage=${!!product.image} captionLen=${caption.length}`);

  const replyMarkup = {
    inline_keyboard: [[{ text: '🛒 Buy Now', url: encodeHref(affiliateUrl) }]],
  };

  // Attempt 1: sendPhoto
  if (product.image && product.image.startsWith('https://')) {
    const photoCaption = caption.length > 1023 ? caption.slice(0, 1023) + '…' : caption;
    try {
      await bot.sendPhoto(CHAT_ID, product.image, {
        caption:      photoCaption,
        parse_mode:   'HTML',
        reply_markup: replyMarkup,
      });
      ok('[Telegram]', `Message sent with image ✅  (ASIN ${product.asin})`);
      return;
    } catch (photoErr) {
      const body = photoErr.response?.body ?? '';
      warn('[Telegram]', `sendPhoto failed: ${photoErr.message} | body=${JSON.stringify(body)}`);
      warn('[Telegram]', 'Falling back to text-only send…');
    }
  } else {
    warn('[Telegram]', `No valid image URL for ASIN ${product.asin} — skipping photo attempt`);
  }

  // Attempt 2: sendMessage text-only
  const textCaption = caption.length > 4095 ? caption.slice(0, 4095) + '…' : caption;
  try {
    await bot.sendMessage(CHAT_ID, textCaption, {
      parse_mode:               'HTML',
      reply_markup:             replyMarkup,
      disable_web_page_preview: false,
    });
    ok('[Telegram]', `Message sent as text ✅  (ASIN ${product.asin})`);
  } catch (textErr) {
    const body = textErr.response?.body ?? '';
    err('[Telegram]', `sendMessage FAILED: ${textErr.message}`);
    err('[Telegram]', `Response body: ${JSON.stringify(body)}`);
    err('[Telegram]', `Caption length: ${textCaption.length}`);
    throw textErr;
  }
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n' + '═'.repeat(60));
  console.log(' AMAZON DEAL BOT — TEST PIPELINE');
  console.log('═'.repeat(60));
  console.log(` URL:          ${TEST_URL}`);
  console.log(` Max products: ${MAX_PRODUCTS}`);
  console.log(` Headless:     ${HEADLESS}`);
  console.log(` Tracking ID:  ${TRACKING_ID}`);
  console.log(` Telegram:     ${TOKEN ? TOKEN.slice(0,8) + '…' : '❌ NOT SET'} → chat ${CHAT_ID || '❌ NOT SET'}`);
  console.log('═'.repeat(60) + '\n');

  // ── Telegram bot init ─────────────────────────────────────────────────────
  if (!TOKEN || !CHAT_ID) {
    err('[Telegram]', '❌ TELEGRAM_TOKEN or TELEGRAM_CHAT not set in .env — aborting');
    process.exit(1);
  }

  const bot = new TelegramBot(TOKEN);
  log('[Telegram]', `Bot initialised (${TOKEN.slice(0,8)}…) → chat ${CHAT_ID}`);

  // ── Send start banner ─────────────────────────────────────────────────────
  try {
    await bot.sendMessage(CHAT_ID,
      `🔬 <b>TEST MODE STARTED</b>\n\nScraping: <code>${TEST_URL}</code>\nMax products: ${MAX_PRODUCTS}`,
      { parse_mode: 'HTML' }
    );
    ok('[Telegram]', 'Start banner sent OK');
  } catch (e) {
    err('[Telegram]', `Could not send start banner: ${e.message}`);
    process.exit(1);
  }

  let context = null;  // PersistentContext — acts as browser + context combined
  let page    = null;
  const results = { extracted: 0, sent: 0, failed: 0, skipped: 0 };

  try {
    // ── Phase 1: Launch persistent browser + context ──────────────────────────
    context = await launchBrowser();

    // ── Phase 2: Warm up — visit Amazon homepage to build session cookies ─────
    await warmUpContext(context);

    // ── Phase 3: Open category page ───────────────────────────────────────────
    page = await openCategoryPage(context);

    // ── Phase 4: Wait for product grid ────────────────────────────────────────
    await waitForGrid(page);

    // ── Phase 5: Extract products ────────────────────────────────────────────
    const products = await extractProducts(page);
    results.extracted = products.length;

    if (products.length === 0) {
      err('[Amazon]', '❌ 0 products extracted — stopping test');
      await bot.sendMessage(CHAT_ID, '❌ <b>TEST FAILED</b>\n0 products extracted from Amazon.', { parse_mode: 'HTML' });
      return;
    }

    // ── Phase 6+7+8: Affiliate + Format + Send ───────────────────────────────
    for (let i = 0; i < products.length; i++) {
      const product = products[i];

      log('[Amazon]', `─── Product ${i + 1}/${products.length} ─── ASIN: ${product.asin}`);
      log('[Amazon]', `  Title:    ${(product.title || '').slice(0, 80)}`);
      log('[Amazon]', `  Price:    ₹${product.price ?? 'N/A'}`);
      log('[Amazon]', `  MRP:      ₹${product.originalPrice ?? 'N/A'}`);
      log('[Amazon]', `  Discount: ${product.discount ?? 'N/A'}%`);
      log('[Amazon]', `  Image:    ${product.image ? product.image.slice(0, 80) : 'none'}`);

      // Generate affiliate URL
      const affiliateUrl = buildAffiliateUrl(product.asin);
      ok('[Amazon]', `  Affiliate URL: ${affiliateUrl}`);

      // Send to Telegram
      try {
        await sendToTelegram(bot, product, affiliateUrl);
        results.sent++;
      } catch (sendErr) {
        err('[Telegram]', `FAILED for ASIN ${product.asin}: ${sendErr.message}`);
        results.failed++;
      }

      // Small delay between Telegram sends to avoid rate-limit
      if (i < products.length - 1) {
        await new Promise((r) => setTimeout(r, 1200));
      }
    }

  } catch (fatalErr) {
    err('[Pipeline]', `FATAL ERROR in ${fatalErr.stack?.split('\n')[1]?.trim() || 'unknown location'}`);
    err('[Pipeline]', fatalErr.message);

    try {
      await bot.sendMessage(CHAT_ID,
        `❌ <b>TEST PIPELINE ERROR</b>\n\n<code>${fatalErr.message}</code>`,
        { parse_mode: 'HTML' }
      );
    } catch (_) {}

    process.exitCode = 1;

  } finally {
    if (page)    await page.close().catch(() => {});
    if (context) await context.close().catch(() => {}); // closes browser too

    // ── Final summary ─────────────────────────────────────────────────────────
    console.log('\n' + '═'.repeat(60));
    console.log(' TEST PIPELINE SUMMARY');
    console.log('═'.repeat(60));
    console.log(` Products extracted: ${results.extracted}`);
    console.log(` Telegram sent:      ${results.sent}`);
    console.log(` Telegram failed:    ${results.failed}`);
    console.log(` Skipped:            ${results.skipped}`);
    console.log('═'.repeat(60) + '\n');

    const summaryText =
      `📊 <b>TEST PIPELINE COMPLETE</b>\n\n` +
      `✅ Extracted:  ${results.extracted}\n` +
      `📨 Sent:       ${results.sent}\n` +
      `❌ Failed:     ${results.failed}`;

    try {
      await bot.sendMessage(CHAT_ID, summaryText, { parse_mode: 'HTML' });
    } catch (_) {}
  }
}

main().catch((e) => {
  console.error('\n[UNCAUGHT]', e.message, '\n', e.stack);
  process.exit(1);
});
