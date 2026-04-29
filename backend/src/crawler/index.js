/**
 * Amazon India Crawler Orchestrator
 *
 * Flow per cycle:
 *   1. Extract product URLs from all Amazon category pages (Puppeteer + stealth)
 *   2. Deduplicate via URL cache (skip recently scraped)
 *   3. For each URL: scrape → affiliate link → deal filter → save → Telegram
 *   4. Scraping via p-queue (concurrency controlled by SCRAPE_CONCURRENCY)
 *   6. Record CrawlerRun stats
 */

const { CATEGORIES, buildPageUrl }   = require('./categories');

// ── Allowed category keywords (product-level safety net) ─────────────────────
// Primary filtering is done at source (categories.js URLs/nodes).
// This is a secondary check on the scraped product's own category string.
const ALLOWED_CATEGORY_KEYWORDS = [
  // Electronics / Gadgets
  'mobile', 'phone', 'smartphone', 'laptop', 'computer', 'tablet',
  'headphone', 'earphone', 'earbud', 'speaker', 'audio', 'smartwatch',
  'wearable', 'camera', 'television', 'tv', 'monitor', 'gadget', 'electronic',
  'charger', 'power bank', 'keyboard', 'mouse',

  // Shoes / Footwear
  'shoe', 'shoes', 'footwear', 'sneaker', 'sandal', 'slipper', 'boot',
  'heel', 'loafer', 'flip flop', 'sport shoe', 'running shoe',

  // Clothing / Fashion
  'clothing', 'fashion', 'apparel', 'shirt', 'kurta', 'dress', 'saree',
  'jeans', 'trouser', 'jacket', 'hoodie', 'sweatshirt', 'top', 'tshirt',
  't-shirt', 'legging', 'skirt', 'ethnic', 'western', 'suit', 'blazer',

  // Makeup / Beauty
  'beauty', 'makeup', 'cosmetic', 'lipstick', 'foundation', 'skincare',
  'moisturizer', 'serum', 'shampoo', 'conditioner', 'perfume', 'fragrance',
  'hair', 'face wash', 'sunscreen', 'cream', 'lotion', 'grooming',

  // Gym / Fitness
  'fitness', 'gym', 'sport', 'sports', 'yoga', 'dumbbell', 'weight',
  'protein', 'supplement', 'cycling', 'treadmill', 'exercise', 'workout',
];

const BLOCKED_CATEGORY_KEYWORDS = [
  'book', 'books', 'novel', 'textbook', 'grocery', 'food', 'vegetable',
  'fruit', 'snack', 'beverage', 'kitchen', 'cookware', 'utensil',
  'toy', 'baby', 'diaper', 'stationery', 'automotive', 'tyre', 'car',
  'furniture', 'mattress', 'curtain', 'bedsheet', 'pillow', 'tool',
  'hardware', 'pet', 'garden', 'plant', 'seed',
];

function isAllowedCategory(product) {
  const raw = ((product.category || '') + ' ' + (product.title || '')).toLowerCase().trim();

  // Blocked wins — skip even if an allowed keyword also matches
  if (BLOCKED_CATEGORY_KEYWORDS.some((k) => raw.includes(k))) return false;

  // If category field is empty, let it through (platform-level filtering is sufficient)
  if (!product.category) return true;

  return ALLOWED_CATEGORY_KEYWORDS.some((k) => raw.includes(k));
}
const { extractLinksFromCategory, cycleWarmUp, CATEGORY_DELAY_MIN_MS, CATEGORY_DELAY_MAX_MS } = require('./extractor');
const antiBot = require('./antiBot');
const { warmUpBrowser, checkLifecycle, getBrowserDiagnostics } = require('../scraper/browser');
const { scrapeProduct }              = require('../scraper');
const { generateFinalLink }          = require('../services/linkGenerator');
const { evaluateDeal, upsertDeal }   = require('../engine/dealFilter');
const { getScrapeQueue, getQueueStats, clearScrapeQueue } = require('../queue');
const { shouldPostDeal, isBook, normalizeTitle } = require('../engine/postDecision');
const { normalizeProduct, extractBrand, isTitleDuplicate, isAlreadyPosted, markAsPosted, claimInflight, releaseInflight } = require('../engine/dedup');
const { emit }           = require('../events/emitter');
const { urlCache }                   = require('../utils/cache');
const metrics                        = require('../utils/metrics');
const Deal                           = require('../models/Deal');
const CrawlerRun                     = require('../models/CrawlerRun');
const telegram                       = require('../../telegram');
const { recordPricePoint }           = require('../services/priceEngine');
const { calculateDealScore, isVerified } = require('../services/scoringEngine');
const logger                         = require('../../utils/logger');
const autoMode                       = require('../autoMode');

const PUBLIC_URL = (
  process.env.PUBLIC_URL ||
  process.env.RENDER_EXTERNAL_URL ||
  'https://deal-system-backend.onrender.com'
).replace(/\/$/, '');

const MAX_BRAND_PER_CYCLE = parseInt(process.env.MAX_BRAND_PER_CYCLE || '3', 10);

let _stopFlag            = false;
let _seenTitles          = new Set();
let _seenBrands          = new Map();  // brand → post count this cycle
let _forceSentFirstDeal  = false; // reset each cycle; used by FORCE_FIRST_DEAL=true
let _consecutiveZeroYield = 0;    // how many back-to-back cycles found 0 fresh URLs

function stopCrawl() {
  _stopFlag = true;
  clearScrapeQueue();
  emit('crawler:stopped', { type: 'info', reason: 'user-requested' });
  logger.info('[Crawler] Stop requested — queue cleared');
}

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }
function categoryDelay() {
  const ms = CATEGORY_DELAY_MIN_MS + Math.floor(Math.random() * (CATEGORY_DELAY_MAX_MS - CATEGORY_DELAY_MIN_MS));
  return sleep(ms);
}

// ─── SHARED QUEUE ─────────────────────────────────────────────────────────────

const scrapeQueue = getScrapeQueue();

// ─── CRAWL CYCLE ──────────────────────────────────────────────────────────────

async function runCrawlCycle() {
  _stopFlag           = false;
  _seenTitles         = new Set();
  _seenBrands         = new Map();
  _forceSentFirstDeal = false;
  const startedAt = Date.now();

  // Global tracking — readable by /api/debug/crawler
  global.crawlerRunning   = true;
  global.lastCrawlerRun   = new Date().toISOString();
  global.dealsScraped     = 0;
  global.dealsPosted      = 0;
  global.productsScanned  = 0;
  global.currentCategory  = 'Initializing...';
  global.lastCrawlerError = null;

  logger.info('[Crawler] ══ runCrawlCycle START ══');
  const diag = getBrowserDiagnostics();
  logger.info(`[Crawler] Browser diag: connected=${diag.connected} age=${diag.ageMinutes}min/${diag.ageLimit}min pages=${diag.pageCount}/${diag.pageLimit} warmUp=${diag.warmUpDone}`);
  logger.info(`[Crawler] AUTO_MODE=${autoMode.state.enabled} | PUBLIC_URL=${PUBLIC_URL}`);
  logger.info(`[Crawler] TELEGRAM_TOKEN=${process.env.TELEGRAM_TOKEN ? process.env.TELEGRAM_TOKEN.slice(0,8)+'…' : 'NOT SET'}`);
  logger.info(`[Crawler] TELEGRAM_CHAT=${process.env.TELEGRAM_CHAT || 'NOT SET'}`);
  logger.info(`[Crawler] MONGODB_URI=${process.env.MONGODB_URI ? 'set' : 'NOT SET'}`);

  const run = await CrawlerRun.create({
    status:    'running',
    startedAt: new Date(),
  });

  emit('crawler:started', { type: 'info', runId: run._id.toString() });

  const stats = {
    categoriesScanned: 0,
    linksExtracted:    0,
    productsScanned:   0,
    dealsFound:        0,
    dealsPosted:       0,
    errors:            0,
    byPlatform: {
      amazon: { scraped: 0, deals: 0, errors: 0 },
    },
  };
  const categoryStats = [];

  logger.info('═══ Crawl cycle starting ═══');

  try {
    // ── Phase 0: Reset per-cycle state ───────────────────────────────────────
    antiBot.resetCycleState();

    // ── Phase 0b: Lifecycle check + Session warm-up ──────────────────────────
    // checkLifecycle → restarts Chrome if page/age limits exceeded (between cycles, never mid-scrape)
    // warmUpBrowser  → visits Amazon homepage once per browser session (cookies)
    // cycleWarmUp    → browse + search page every cycle (behavioral trust)
    const browserRestarted = await checkLifecycle();
    if (browserRestarted) {
      logger.info('[Crawler] Browser was restarted by checkLifecycle() — full warm-up chain will run');
    }
    await warmUpBrowser();
    await cycleWarmUp();

    // ── Phase 1: Extract links from selected categories ───────────────────────
    // No post-warmup rest needed — category pages are fetched via axios (plain HTTP),
    // not Puppeteer, so there is no browser session continuity between the warm-up
    // and category extraction. The warm-up is solely for the Puppeteer product
    // scraping session that runs in Phase 2.
    const urlsByPlatform = { amazon: [] };

    // Select 1–2 categories per cycle (rotating subset reduces request patterns)
    // Skip any category currently blacklisted by the anti-bot module
    const availableCategories = CATEGORIES.filter(c => !antiBot.isBlacklisted(c.id));
    const cycleCount          = 1 + Math.floor(Math.random() * 2);  // 1 or 2
    const selectedCategories  = [...availableCategories]
      .sort(() => Math.random() - 0.5)
      .slice(0, Math.min(cycleCount, availableCategories.length));

    const blacklisted = antiBot.getBlacklisted();
    if (blacklisted.length > 0) {
      logger.warn(`[Crawler] Skipping blacklisted: ${blacklisted.map(b => `${b.id}(${b.expiresIn})`).join(', ')}`);
    }
    logger.info(`[Crawler] Scanning ${selectedCategories.length}/${availableCategories.length} available categories this cycle`);

    for (const category of selectedCategories) {
      if (_stopFlag) { logger.info('[Crawler] Stop flag — exiting category loop'); break; }
      global.currentCategory = category.name;
      logger.info(`[Crawler] category start: ${category.name}`);
      console.log('[Crawler] category start');
      let links = [];

      try {
        links = await extractLinksFromCategory(category, buildPageUrl);
      } catch (err) {
        logger.error(`[${category.platform}] ${category.name} extraction failed: ${err.message}`);
        stats.errors++;
      }

      // If a bot-wall was hit inside extractLinksFromCategory, abort the rest of
      // the category loop immediately. The session is compromised for this cycle —
      // continuing to the next category would just hit more bot-walls on the same
      // flagged session. The next cycle will do a fresh warm-up first.
      if (antiBot.isBotWallThisCycle()) {
        logger.warn('[Crawler] ⚠ Bot-wall detected this cycle — aborting remaining categories to rest session');
        categoryStats.push({
          categoryId:   category.id,
          categoryName: category.name,
          platform:     category.platform,
          linksFound:   0,
          newLinks:     0,
          abortedBotWall: true,
        });
        break;
      }

      // Filter out recently-scraped URLs
      const fresh = links.filter((u) => !urlCache.has(u));
      urlsByPlatform[category.platform] = [
        ...(urlsByPlatform[category.platform] || []),
        ...fresh,
      ];

      stats.categoriesScanned++;
      stats.linksExtracted += fresh.length;

      emit('crawler:progress', {
        currentCategory:    category.name,
        currentPlatform:    category.platform,
        categoriesScanned:  stats.categoriesScanned,
        totalCategories:    selectedCategories.length,
        linksExtracted:     stats.linksExtracted,
        productsScanned:    stats.productsScanned,
        dealsFound:         stats.dealsFound,
        dealsPosted:        stats.dealsPosted,
      });

      categoryStats.push({
        categoryId:   category.id,
        categoryName: category.name,
        platform:     category.platform,
        linksFound:   links.length,
        newLinks:     fresh.length,
      });

      logger.info(`[Extractor] extracted ${links.length} ASINs`);
      console.log(`[Extractor] extracted ${links.length} ASINs`);
      await categoryDelay();
    }

    const totalFresh = Object.values(urlsByPlatform).reduce((s, a) => s + a.length, 0);
    logger.info(`[Crawler] Phase 1 complete — ${totalFresh} fresh URLs queued`);
    for (const [plat, urls] of Object.entries(urlsByPlatform)) {
      logger.info(`[Crawler]   ${plat}: ${urls.length} URLs`);
    }
    
    if (totalFresh === 0) {
      _consecutiveZeroYield++;
      logger.warn(`[Crawler] ⚠️  0 fresh URLs found — bot detection or empty categories. consecutive=${_consecutiveZeroYield}`);
      return stats; // Early exit if nothing to scrape
    }

    // ── Phase 2: Scrape + filter + post ──────────────────────────────────────
    logger.info('Phase 2 starting — scraping');
    console.log(`[Crawler] Starting product scrape queue with ${totalFresh} URLs`);

    const allPromises = [];

    for (const [platform, urls] of Object.entries(urlsByPlatform)) {
      console.log(`[Crawler] Enqueuing ${urls.length} URLs for ${platform}`);
      for (const url of urls) {
        console.log('[Scrape] starting');
        const promise = scrapeQueue.add(() => processProduct(url, platform, stats));
        allPromises.push(promise);
      }
    }
    console.log(`[Crawler] All ${allPromises.length} promises enqueued, waiting for settle...`);

    await Promise.allSettled(allPromises);
    await scrapeQueue.onIdle();

    // Low-yield detection — alert when feed would go dark
    if (stats.dealsPosted === 0 && stats.productsScanned > 0) {
      logger.warn(
        `[Crawler] ⚠️ ZERO DEALS POSTED — scanned=${stats.productsScanned} found=${stats.dealsFound}. ` +
        `All eligible products are in PostedLog (5-day cooldown). ` +
        `Consider widening category pages or reducing MIN_DEAL_SCORE.`
      );
      emit('crawler:low-yield', { type: 'warn', scanned: stats.productsScanned, found: stats.dealsFound });
    }

    // ── Phase 3: Finalise run ─────────────────────────────────────────────────
    const durationMs = Date.now() - startedAt;

    await CrawlerRun.findByIdAndUpdate(run._id, {
      status:     'completed',
      finishedAt: new Date(),
      durationMs,
      stats,
      categoryStats,
    });

    emit('crawler:completed', { type: 'info', stats, durationMs });
    metrics.observe('crawl.duration_ms', durationMs);
    metrics.increment('crawl.cycles');
    metrics.gauge('crawl.last_deals_found', stats.dealsFound);

    global.crawlerRunning = false;
    global.currentCategory = 'Idle';
    antiBot.logStats();
    logger.info(
      `═══ Crawl complete (${Math.round(durationMs / 1000)}s) ═══ ` +
      `scanned=${stats.productsScanned} deals=${stats.dealsFound} posted=${stats.dealsPosted} errors=${stats.errors}`
    );

    return stats;
  } catch (error) {
    const durationMs = Date.now() - startedAt;

    global.crawlerRunning   = false;
    global.currentCategory   = 'Failed';
    global.lastCrawlerError = error.message;

    await CrawlerRun.findByIdAndUpdate(run._id, {
      status:     'failed',
      finishedAt: new Date(),
      durationMs,
      stats,
      categoryStats,
      error:      error.message,
    });

    emit('crawler:error', { type: 'error', message: error.message });
    logger.error(`Crawl cycle failed: ${error.message}`);
    throw error;
  }
}

// ─── PER-PRODUCT PROCESSOR ────────────────────────────────────────────────────

async function processProduct(url, platform, stats) {
  const t0 = Date.now();
  const asinMatch = url.match(/\/dp\/([A-Z0-9]{10})/i);
  const asin = asinMatch ? asinMatch[1] : 'unknown';
  
  if (_stopFlag) {
    logger.info(`[Scrape] SKIP (STOP FLAG) ${url}`);
    return;
  }

  logger.info(`[Scrape] ▶ START ${platform} → ${url}`);
  console.log(`[Scrape] Starting: ${asin}`);

  try {
    // Retry once on scrape failure (Puppeteer flakiness, network timeout)
    let product = null;
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        product = await scrapeProduct(url);
        break;
      } catch (scrapeErr) {
        logger.error(`[Scrape] ❌ Attempt ${attempt} FAILED for ${url}: ${scrapeErr.message}${attempt < 2 ? ' — retrying in 3s' : ' — giving up'}`);
        if (attempt === 2) throw scrapeErr;
        await sleep(3000);
      }
    }

    urlCache.set(url);

    stats.productsScanned++;
    global.productsScanned = stats.productsScanned;
    global.dealsScraped = (global.dealsScraped || 0) + 1;
    if (stats.byPlatform[platform]) stats.byPlatform[platform].scraped++;
    metrics.observe('scrape.duration_ms', Date.now() - t0);
    metrics.increment(`scrape.${platform}.success`);

    if (!product || !product.title || !product.price || !product.asin) {
      console.log(`[Crawler][SKIP] invalid product | title=${!!product?.title} price=${!!product?.price} asin=${!!product?.asin}`);
      return;
    }

    console.log('[Amazon][OK]');
    logger.info(`[Scrape][OK] "${product.title.slice(0, 60)}" price=₹${product.price} disc=${product.discount ?? '?'}% img=${!!product.image} url=${url}`);

    // ── SMART DEAL FLOW ──
    try {
      const { productId } = normalizeProduct(product);

      // 1. Record price point & update historical stats
      const historyStats = await recordPricePoint(product.asin, product.price, product.originalPrice, platform);
      
      // 2. Enrich product with historical context & metadata
      const enrichedProduct = {
        ...product,
        ...(historyStats || {}),
      };

      // 3. Calculate smart deal score
      const dealScore = calculateDealScore(enrichedProduct);
      const verified  = isVerified(enrichedProduct, dealScore);
      
      enrichedProduct.dealScore      = dealScore;
      enrichedProduct.isVerifiedDeal = verified;

      logger.info(`[SmartDeal] asin=${product.asin} score=${dealScore} verified=${verified} avg30d=${enrichedProduct.avg30dPrice || '?'}`);

      // ── FORCE_FIRST_DEAL bypass (set env var for testing only) ───────────────
      if (process.env.FORCE_FIRST_DEAL === 'true' && !_forceSentFirstDeal && product.title && product.price) {
        _forceSentFirstDeal = true;
        logger.info(`[FORCE] Bypassing all filters — sending first valid scrape: "${product.title.slice(0, 60)}"`);
        try {
          const forced  = await generateFinalLink(url, platform);
          const caption = telegram.formatDealText(
            product.title, product.price, forced.finalLink,
            product.originalPrice, product.discount, null, platform,
          );
          await telegram.sendToTelegram(product.image, caption, forced.finalLink);
          logger.info('[FORCE] ✅ Forced deal sent to Telegram successfully');
        } catch (forceErr) {
          logger.error(`[FORCE] ❌ Forced send FAILED: ${forceErr.message}`);
        }
        return;
      }

      /* ── FILTERS BYPASSED FOR TESTING ──
      // ── EARLY GATE 0: Category allowlist ─────────────────────────────────────
      if (!isAllowedCategory(product)) {
        logger.info(`[Filter][SKIP:category] cat="${product.category || 'none'}" title="${product.title.slice(0, 60)}"`);
        metrics.increment('filter.category_skip');
        return;
      }

      // ── EARLY GATE 1: Book filter ─────────────────────────────────────────────
      if (isBook(product)) {
        logger.info(`[Filter][SKIP:book] "${product.title.slice(0, 60)}"`);
        metrics.increment('filter.book_skip');
        return;
      }

      // ── EARLY GATE 2a: Exact title dedup within this cycle ───────────────────
      const titleKey = normalizeTitle(product.title);
      if (_seenTitles.has(titleKey)) {
        logger.info(`[Filter][SKIP:title-exact] "${product.title.slice(0, 60)}"`);
        metrics.increment('filter.duplicate_skip');
        return;
      }
      _seenTitles.add(titleKey);

      // ── EARLY GATE 2b: Fuzzy title similarity (cross-cycle, last 200 posted) ──
      if (isTitleDuplicate(product.title)) {
        logger.info(`[Filter][SKIP:title-fuzzy ≥${process.env.TITLE_SIMILARITY_THRESHOLD || 0.85}] "${product.title.slice(0, 60)}"`);
        metrics.increment('filter.title_similarity_skip');
        return;
      }

      // ── EARLY GATE 3: Concurrency guard + 5-day PostedLog check ─────────────
      if (!claimInflight(productId, platform)) {
        logger.info(`[Filter][SKIP:in-flight] id=${productId} "${product.title.slice(0, 60)}"`);
        metrics.increment('filter.inflight_skip');
        return;
      }
      if (await isAlreadyPosted(productId, platform, product.title)) {
        logger.info(`[Filter][SKIP:posted-log] id=${productId} "${product.title.slice(0, 60)}"`);
        logger.info('[Crawler][SKIP] duplicate');
        metrics.increment('filter.db_duplicate_skip');
        return;
      }

      // ── EARLY GATE 4: Brand frequency cap ────────────────────────────────────
      const brand     = extractBrand(product.title);
      const brandHits = _seenBrands.get(brand) || 0;
      if (brandHits >= MAX_BRAND_PER_CYCLE) {
        logger.info(`[Filter][SKIP:brand-cap] brand=${brand} hits=${brandHits}/${MAX_BRAND_PER_CYCLE} "${product.title.slice(0, 60)}"`);
        metrics.increment('filter.brand_cap_skip');
        return;
      }
      */

      // Generate hybrid link (affiliate with 5s timeout, fallback to original)
      const t1 = Date.now();
      const linkResult = await generateFinalLink(url, platform);
      product.affiliateLink = linkResult.affiliateLink;
      product.originalLink  = linkResult.originalLink;
      product.finalLink     = linkResult.finalLink;
      product.isAffiliate   = linkResult.isAffiliate;
      metrics.observe('affiliate.duration_ms', Date.now() - t1);
      if (!linkResult.isAffiliate) metrics.increment('affiliate.fallback');

      // Evaluate deal (BYPASSED FOR TESTING)
      console.log('[Filter] evaluating deal');
      // const { shouldPost, reason, dealType } = await evaluateDeal(product);
      const shouldPost = true;
      const reason = 'FORCE_SEND_TEST_MODE';
      const dealType = 'discount';

      if (!shouldPost) {
        logger.info(`[Filter][SKIP:discount] "${product.title.slice(0, 50)}" — ${reason}`);
        console.log('[Filter][SKIP] low score');
        return;
      }

      stats.dealsFound++;
      if (stats.byPlatform[platform]) stats.byPlatform[platform].deals++;
      logger.info(`Deal: "${product.title.slice(0, 50)}" — ${reason}`);
      console.log('[Filter] approved');
      console.log('[Crawler] Deal approved');
      metrics.increment(`deals.${platform}.found`);

      // Save to DB
      const deal = await upsertDeal(product, platform, dealType, reason);

      // Smart rules gate + Auto Mode + score check (BYPASSED FOR TESTING)
      const MIN_SCORE = 0;
      const scoreMet  = true;
      const allow     = true;
      const postReason = 'FORCE_SEND_TEST_MODE';

      logger.info(`[PostGate] score=${deal.score}/${MIN_SCORE} autoMode=${autoMode.state.enabled} allow=${allow}/${postReason} "${deal.title?.slice(0,50)}"`);

      if (true) { // Force enter
        if (!deal.title || !deal.price) {
          logger.warn(`[Telegram] SKIPPED INVALID DEAL — missing title or price | id=${deal._id} title=${deal.title ?? 'null'} price=${deal.price ?? 'null'}`);
          return;
        }

        logger.info(`[Telegram] SENDING TO TELEGRAM: "${deal.title?.slice(0, 60)}" | price=₹${deal.price} discount=${deal.discount}% chat=${process.env.TELEGRAM_CHAT}`);
        console.log('[FORCE SEND] sending product');
        console.log('[Crawler] Sending to Telegram');
        let tgSent = false;
        let tgLastErr = null;
        for (let tgAttempt = 1; tgAttempt <= 3 && !tgSent; tgAttempt++) {
          try {
            if (tgAttempt > 1) {
              logger.warn(`[Telegram] Retry ${tgAttempt}/3 for deal ${deal._id}…`);
              await sleep(4000 * (tgAttempt - 1));
            }
            console.log('[Telegram] sending deal');
            await postDealToTelegram(deal);
            tgSent = true;
            console.log('[Telegram] success');
          } catch (err) {
            tgLastErr = err;
            logger.warn(`[Telegram] Attempt ${tgAttempt}/3 failed: ${err.message}`);
          }
        }

        if (tgSent) {
          const now = new Date();
          await Deal.findByIdAndUpdate(deal._id, {
            posted:       true,
            postedAt:     deal.postedAt || now,
            lastPostedAt: now,
            lastPrice:    deal.price,
            'steps.telegram.done': true,
            'steps.telegram.at':   now,
          });
          // Write to PostedLog — 3 retries, dynamic cooldown by score, CRITICAL log on all-fail
          const { productId: postedProductId } = normalizeProduct(deal);
          await markAsPosted(postedProductId, deal.platform || platform, normalizeTitle(deal.title), deal.score || 0);
          // Increment brand counter for this cycle
          const postedBrand = extractBrand(deal.title);
          _seenBrands.set(postedBrand, (_seenBrands.get(postedBrand) || 0) + 1);
          stats.dealsPosted++;
          global.dealsPosted = (global.dealsPosted || 0) + 1;
          metrics.increment(`deals.${platform}.posted`);
          global.lastSuccessfulTelegramSend = new Date().toISOString();
          logger.info(`[Telegram] ✅ SENT OK — "${deal.title.slice(0, 50)}" [${postReason}]`);
          emit('crawler:deal-posted', {
            type:     'posted',
            title:    deal.title.slice(0, 80),
            platform: deal.platform || platform,
            price:    deal.price,
            discount: deal.discount,
            reason:   postReason,
          });
        } else {
          const tgBody = tgLastErr?.response?.body ?? tgLastErr?.response ?? '';
          logger.error(`[Telegram] ❌ SEND FAILED after 3 attempts for deal ${deal._id}: ${tgLastErr?.message} | response=${JSON.stringify(tgBody)}`);
          console.log('[Telegram][FAIL]');
          emit('crawler:deal-error', {
            type:    'error',
            title:   deal.title?.slice(0, 80),
            platform,
            reason:  tgLastErr?.message,
          });
          await Deal.findByIdAndUpdate(deal._id, {
            'steps.telegram.done':  false,
            'steps.telegram.error': tgLastErr?.message,
          }).catch(() => {});
        }
      }
    } finally {
      // Release in-flight claim — runs on every exit path (return, throw, or fall-through)
      releaseInflight(productId, platform);
    }
  } catch (error) {
    stats.errors++;
    if (stats.byPlatform[platform]) stats.byPlatform[platform].errors++;
    metrics.increment(`scrape.${platform}.errors`);
    logger.error(`[Scrape] ❌ processProduct FAILED [${platform}] ${url}: ${error.message}`);
  }
}

// ─── TELEGRAM FORMATTER ───────────────────────────────────────────────────────

const { buildAffiliateUrl, isValidAffiliateUrl } = require('../affiliate/amazon');

async function postDealToTelegram(deal) {
  const postUrl = buildAffiliateUrl(deal);

  if (!postUrl) {
    throw new Error(`[Telegram] No valid affiliate URL for deal ${deal._id} (ASIN: ${deal.asin})`);
  }
  if (!isValidAffiliateUrl(postUrl)) {
    throw new Error(`[Telegram] Built URL failed validation for deal ${deal._id}: ${postUrl}`);
  }

  logger.info(`[Telegram] Using affiliate URL: ${postUrl}`);

  const caption = telegram.formatDealText(
    deal.title,
    deal.price,
    postUrl,
    deal.originalPrice,
    deal.discount,
    '🛒',
    'amazon',
  );

  await telegram.sendToTelegram(deal.image, caption, postUrl);
}

module.exports = {
  runCrawlCycle,
  stopCrawl,
  getQueueStats,
};
