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
const { generateAffiliateLink }      = require('../affiliate');
const { evaluateDeal, upsertDeal }   = require('../engine/dealFilter');
const { getScrapeQueue, getQueueStats } = require('../queue');
const { urlCache }                   = require('../utils/cache');
const metrics                        = require('../utils/metrics');
const Deal                           = require('../models/Deal');
const CrawlerRun                     = require('../models/CrawlerRun');
const telegram                       = require('../../telegram');
const logger                         = require('../../utils/logger');

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }
function categoryDelay() {
  const ms = CATEGORY_DELAY_MIN_MS + Math.floor(Math.random() * (CATEGORY_DELAY_MAX_MS - CATEGORY_DELAY_MIN_MS));
  return sleep(ms);
}

// ─── SHARED QUEUE ─────────────────────────────────────────────────────────────

const scrapeQueue = getScrapeQueue();

// ─── CRAWL CYCLE ──────────────────────────────────────────────────────────────

async function runCrawlCycle() {
  const startedAt = Date.now();

  const run = await CrawlerRun.create({
    status:    'running',
    startedAt: new Date(),
  });

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
    logger.info(`Phase 1 complete — ${totalFresh} fresh URLs queued`);

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

    metrics.observe('crawl.duration_ms', durationMs);
    metrics.increment('crawl.cycles');
    metrics.gauge('crawl.last_deals_found', stats.dealsFound);

    logger.info(
      `═══ Crawl complete (${Math.round(durationMs / 1000)}s) ═══ ` +
      `scanned=${stats.productsScanned} deals=${stats.dealsFound} posted=${stats.dealsPosted} errors=${stats.errors}`
    );

    return stats;
  } catch (error) {
    const durationMs = Date.now() - startedAt;

    await CrawlerRun.findByIdAndUpdate(run._id, {
      status:     'failed',
      finishedAt: new Date(),
      durationMs,
      stats,
      categoryStats,
      error:      error.message,
    });

    logger.error(`Crawl cycle failed: ${error.message}`);
    throw error;
  }
}

// ─── PER-PRODUCT PROCESSOR ────────────────────────────────────────────────────

async function processProduct(url, platform, stats) {
  const t0 = Date.now();

  try {
    // Scrape
    const product = await scrapeProduct(url);
    urlCache.set(url); // Mark as scraped (TTL applies)

    stats.productsScanned++;
    if (stats.byPlatform[platform]) stats.byPlatform[platform].scraped++;
    metrics.observe('scrape.duration_ms', Date.now() - t0);
    metrics.increment(`scrape.${platform}.success`);

    if (!product || !product.title) {
      logger.warn(`No data returned for ${url}`);
      stats.errors++;
      return;
    }

    // Generate affiliate link
    const t1 = Date.now();
    try {
      product.affiliateLink = await generateAffiliateLink(url, platform);
      metrics.observe('affiliate.duration_ms', Date.now() - t1);
    } catch (affErr) {
      logger.warn(`[Affiliate] Failed for ${url}: ${affErr.message} — using original URL`);
      product.affiliateLink = url;
      metrics.increment('affiliate.errors');
    }

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

    // Post to Telegram (only once per deal)
    if (!deal.posted) {
      await postDealToTelegram(deal);

      await Deal.findByIdAndUpdate(deal._id, { posted: true, postedAt: new Date() });
      stats.dealsPosted++;
      metrics.increment(`deals.${platform}.posted`);
      logger.info(`Posted: "${deal.title.slice(0, 50)}"`);
    } else {
      logger.info(`Already posted: ${deal.asin || deal._id} — skipping Telegram`);
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

  const emoji   = PLATFORM_EMOJI[deal.platform] || '🛍️';
  const caption = telegram.formatDealText(
    deal.title,
    deal.price,
    deal.affiliateLink || deal.link,
    deal.originalPrice,
    deal.discount,
    emoji,
    deal.platform,
  );

  await telegram.sendToTelegram(deal.image, caption);
}

module.exports = {
  runCrawlCycle,
  getQueueStats,
};
