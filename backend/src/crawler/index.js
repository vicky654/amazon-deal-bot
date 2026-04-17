/**
 * Multi-Platform Crawler Orchestrator
 *
 * Flow per cycle:
 *   1. Extract product URLs from all category pages
 *   2. Deduplicate via URL cache (skip recently scraped)
 *   3. For each URL: scrape → affiliate link → deal filter → save → Telegram
 *   4. Scraping via p-queue (concurrency 2–3)
 *   5. EarnKaro via affiliate queue (concurrency 1)
 *   6. Record CrawlerRun stats
 */

const { CATEGORIES, buildPageUrl }   = require('./categories');
const { extractLinksFromCategory, CATEGORY_DELAY_MIN_MS, CATEGORY_DELAY_MAX_MS } = require('./extractor');
const { scrapeProduct }              = require('../scraper');
const { generateFinalLink }          = require('../services/linkGenerator');
const { evaluateDeal, upsertDeal }   = require('../engine/dealFilter');
const { getScrapeQueue, getQueueStats, clearScrapeQueue } = require('../queue');
const { shouldPostDeal } = require('../engine/postDecision');
const { emit }           = require('../events/emitter');
const { urlCache }                   = require('../utils/cache');
const metrics                        = require('../utils/metrics');
const Deal                           = require('../models/Deal');
const CrawlerRun                     = require('../models/CrawlerRun');
const telegram                       = require('../../telegram');
const logger                         = require('../../utils/logger');
const autoMode                       = require('../autoMode');

const PUBLIC_URL = (
  process.env.PUBLIC_URL ||
  process.env.RENDER_EXTERNAL_URL ||
  'https://deal-system-backend.onrender.com'
).replace(/\/$/, '');

let _stopFlag = false;

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
  _stopFlag    = false;
  const startedAt = Date.now();

  // Global tracking — readable by /api/debug/crawler
  global.crawlerRunning   = true;
  global.lastCrawlerRun   = new Date().toISOString();
  global.dealsScraped     = 0;
  global.dealsPosted      = 0;
  global.lastCrawlerError = null;

  logger.info('[Crawler] ══ runCrawlCycle START ══');
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
      amazon:   { scraped: 0, deals: 0, errors: 0 },
      flipkart: { scraped: 0, deals: 0, errors: 0 },
      myntra:   { scraped: 0, deals: 0, errors: 0 },
      ajio:     { scraped: 0, deals: 0, errors: 0 },
    },
  };
  const categoryStats = [];

  logger.info('═══ Crawl cycle starting ═══');

  try {
    // ── Phase 1: Extract links from all categories ────────────────────────────
    const urlsByPlatform = { amazon: [], flipkart: [], myntra: [], ajio: [] };

    for (const category of CATEGORIES) {
      if (_stopFlag) { logger.info('[Crawler] Stop flag — exiting category loop'); break; }
      logger.info(`Scanning: [${category.platform}] ${category.name}`);
      let links = [];

      try {
        links = await extractLinksFromCategory(category, buildPageUrl);
      } catch (err) {
        logger.error(`[${category.platform}] ${category.name} extraction failed: ${err.message}`);
        stats.errors++;
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
        totalCategories:    CATEGORIES.length,
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

      logger.info(`[${category.platform}] ${category.name}: ${links.length} found, ${fresh.length} fresh`);
      await categoryDelay();
    }

    const totalFresh = Object.values(urlsByPlatform).reduce((s, a) => s + a.length, 0);
    logger.info(`[Crawler] Phase 1 complete — ${totalFresh} fresh URLs queued`);
    for (const [plat, urls] of Object.entries(urlsByPlatform)) {
      logger.info(`[Crawler]   ${plat}: ${urls.length} URLs`);
    }
    if (totalFresh === 0) {
      logger.warn('[Crawler] ⚠️  0 fresh URLs found — bot detection or empty categories. Nothing to scrape.');
    }

    // ── Phase 2: Scrape + filter + post ──────────────────────────────────────
    logger.info('Phase 2 starting — scraping');

    const allPromises = [];

    for (const [platform, urls] of Object.entries(urlsByPlatform)) {
      for (const url of urls) {
        const promise = scrapeQueue.add(() => processProduct(url, platform, stats));
        allPromises.push(promise);
      }
    }

    await Promise.allSettled(allPromises);
    await scrapeQueue.onIdle();

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
    logger.info(
      `═══ Crawl complete (${Math.round(durationMs / 1000)}s) ═══ ` +
      `scanned=${stats.productsScanned} deals=${stats.dealsFound} posted=${stats.dealsPosted} errors=${stats.errors}`
    );

    return stats;
  } catch (error) {
    const durationMs = Date.now() - startedAt;

    global.crawlerRunning   = false;
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
  logger.debug(`[Scrape] ${platform} → ${url}`);

  try {
    const product = await scrapeProduct(url);
    urlCache.set(url); // Mark as scraped (TTL applies)

    stats.productsScanned++;
    global.dealsScraped = (global.dealsScraped || 0) + 1;
    if (stats.byPlatform[platform]) stats.byPlatform[platform].scraped++;
    metrics.observe('scrape.duration_ms', Date.now() - t0);
    metrics.increment(`scrape.${platform}.success`);

    if (!product || !product.title) {
      logger.warn(`No data returned for ${url}`);
      stats.errors++;
      return;
    }

    // Generate hybrid link (affiliate with 5s timeout, fallback to original)
    const t1 = Date.now();
    const linkResult = await generateFinalLink(url, platform);
    product.affiliateLink = linkResult.affiliateLink;
    product.originalLink  = linkResult.originalLink;
    product.finalLink     = linkResult.finalLink;
    product.isAffiliate   = linkResult.isAffiliate;
    metrics.observe('affiliate.duration_ms', Date.now() - t1);
    if (!linkResult.isAffiliate) metrics.increment('affiliate.fallback');

    // Evaluate deal
    const { shouldPost, reason, dealType } = await evaluateDeal(product);

    if (!shouldPost) {
      logger.info(`Skip: "${product.title.slice(0, 50)}" — ${reason}`);
      return;
    }

    stats.dealsFound++;
    if (stats.byPlatform[platform]) stats.byPlatform[platform].deals++;
    logger.info(`Deal: "${product.title.slice(0, 50)}" — ${reason}`);
    metrics.increment(`deals.${platform}.found`);

    // Save to DB
    const deal = await upsertDeal(product, platform, dealType, reason);

    // Smart rules gate + Auto Mode + score check
    const MIN_SCORE = parseInt(process.env.MIN_DEAL_SCORE || '30', 10);
    const scoreMet  = (deal.score || 0) >= MIN_SCORE;
    const { allow, reason: postReason } = shouldPostDeal(product, deal);

    if (!autoMode.state.enabled) {
      logger.warn(`[Crawler] ⛔ AUTO MODE IS OFF — deal saved but NOT posted to Telegram: "${deal.title?.slice(0,50)}"`);
    } else if (!scoreMet) {
      logger.warn(`[Crawler] ⛔ Score too low (${deal.score} < ${MIN_SCORE}) — NOT posted: "${deal.title?.slice(0,50)}"`);
    } else if (!allow) {
      emit('crawler:deal-skipped', {
        type:     'skipped',
        title:    deal.title.slice(0, 80),
        platform: deal.platform || platform,
        price:    deal.price,
        reason:   postReason,
      });
      logger.info(`Smart rule blocked [${postReason}]: "${deal.title.slice(0, 50)}"`);
    } else {
      try {
        logger.info(`[Crawler] 📤 Posting to Telegram: "${deal.title?.slice(0,50)}" price=₹${deal.price} discount=${deal.discount}%`);
        await postDealToTelegram(deal);
        const now = new Date();
        await Deal.findByIdAndUpdate(deal._id, {
          posted:       true,
          postedAt:     deal.postedAt || now,
          lastPostedAt: now,
          lastPrice:    deal.price,
          'steps.telegram.done': true,
          'steps.telegram.at':   now,
        });
        stats.dealsPosted++;
        global.dealsPosted = (global.dealsPosted || 0) + 1;
        metrics.increment(`deals.${platform}.posted`);
        emit('crawler:deal-posted', {
          type:     'posted',
          title:    deal.title.slice(0, 80),
          platform: deal.platform || platform,
          price:    deal.price,
          discount: deal.discount,
          reason:   postReason,
        });
        logger.info(`Posted [${postReason}]: "${deal.title.slice(0, 50)}"`);
      } catch (tgErr) {
        emit('crawler:deal-error', {
          type:    'error',
          title:   deal.title?.slice(0, 80),
          platform,
          reason:  tgErr.message,
        });
        logger.error(`Telegram post failed for ${deal._id}: ${tgErr.message}`);
        await Deal.findByIdAndUpdate(deal._id, {
          'steps.telegram.done':  false,
          'steps.telegram.error': tgErr.message,
        }).catch(() => {});
      }
    }
  } catch (error) {
    stats.errors++;
    if (stats.byPlatform[platform]) stats.byPlatform[platform].errors++;
    metrics.increment(`scrape.${platform}.errors`);
    logger.error(`processProduct failed [${url}]: ${error.message}`);
  }
}

// ─── TELEGRAM FORMATTER ───────────────────────────────────────────────────────

async function postDealToTelegram(deal) {
  const PLATFORM_EMOJI = {
    amazon:   '🛒',
    flipkart: '🟡',
    myntra:   '👗',
    ajio:     '👠',
  };

  const emoji       = PLATFORM_EMOJI[deal.platform] || '🛍️';
  const redirectUrl = `${PUBLIC_URL}/r/${deal._id}`;

  const caption = telegram.formatDealText(
    deal.title,
    deal.price,
    redirectUrl,        // always use tracked redirect link
    deal.originalPrice,
    deal.discount,
    emoji,
    deal.platform,
  );

  await telegram.sendToTelegram(deal.image, caption, redirectUrl);
}

module.exports = {
  runCrawlCycle,
  stopCrawl,
  getQueueStats,
};
