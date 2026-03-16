/**
 * Crawler Orchestrator
 *
 * Ties together every subsystem into a single runCrawlCycle() call:
 *
 *   1. Scan all configured categories with axios+cheerio (fast, no browser)
 *   2. Deduplicate product URLs by ASIN across categories
 *   3. Push unique URLs into the ProductQueue
 *   4. Workers (queue processor) scrape each product with Puppeteer
 *   5. Deal filter evaluates each scraped product
 *   6. Qualifying deals are upserted to MongoDB and posted to Telegram
 *   7. CrawlerRun document records stats for the dashboard
 *
 * Realistic throughput on a single server:
 *   - Category extraction: ~50–200 links/category via axios (fast)
 *   - Product scraping: ~6–10 products/min at concurrency=2 with safe delays
 *   - 5-minute cron cycle: realistically 30–50 products scraped deeply
 *   - The queue is seeded from ALL categories so the best deals surface first
 */

const { CATEGORIES, buildPageUrl } = require('./categories');
const { extractLinksFromCategory, CATEGORY_DELAY_MIN_MS, CATEGORY_DELAY_MAX_MS } = require('./extractor');
const { scrapeAmazonProduct } = require('../scraper');
const { evaluateDeal, upsertDeal } = require('../engine/dealFilter');
const ProductQueue = require('../engine/queue');
const Deal = require('../models/Deal');
const CrawlerRun = require('../models/CrawlerRun');
const telegram = require('../telegram');
const logger = require('../utils/logger');

/*
 * ─── CONFIG ──────────────────────────────────────────────────────────────────
 */

// How many Puppeteer tabs run in parallel (keep ≤ 3 to avoid bans)
const SCRAPE_CONCURRENCY = parseInt(process.env.SCRAPE_CONCURRENCY || '2', 10);

// Delay between scanning individual categories
function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function categoryDelay() {
  const ms = CATEGORY_DELAY_MIN_MS + Math.floor(Math.random() * (CATEGORY_DELAY_MAX_MS - CATEGORY_DELAY_MIN_MS));
  return sleep(ms);
}

/*
 * ─── SHARED QUEUE INSTANCE ───────────────────────────────────────────────────
 * Exported so server.js can expose real-time queue stats via the API.
 */
const queue = new ProductQueue({ concurrency: SCRAPE_CONCURRENCY });

/*
 * ─── MAIN ENTRY POINT ────────────────────────────────────────────────────────
 */

/**
 * Run a full crawl cycle:
 *   Extract links → queue → scrape → filter → save → post
 *
 * Returns the final stats object so callers can log/display results.
 * Never throws — all errors are caught and recorded on the CrawlerRun document.
 */
async function runCrawlCycle() {
  const startedAt = Date.now();

  // Create a run record immediately so the dashboard shows "running" status
  const run = await CrawlerRun.create({
    status: 'running',
    startedAt: new Date(),
  });

  const stats = {
    categoriesScanned: 0,
    linksExtracted: 0,
    productsScanned: 0,
    dealsFound: 0,
    dealsPosted: 0,
    errors: 0,
  };
  const categoryStats = [];

  logger.info('═══ Crawl cycle starting ═══');

  try {
    // ── Phase 1: Category extraction ─────────────────────────────────────────
    queue.reset();
    queue.setProcessor((url, meta) => processProduct(url, meta, stats));

    for (const category of CATEGORIES) {
      logger.info(`Scanning category: ${category.name}`);

      let links = [];
      try {
        links = await extractLinksFromCategory(category, buildPageUrl);
      } catch (err) {
        logger.error(`Category ${category.name} extraction failed: ${err.message}`);
        stats.errors++;
      }

      const newLinks = queue.addMany(links, { category: category.id });

      stats.categoriesScanned++;
      stats.linksExtracted += links.length;

      categoryStats.push({
        categoryId: category.id,
        categoryName: category.name,
        linksFound: links.length,
        newLinks,
      });

      logger.info(`${category.name}: ${links.length} links found, ${newLinks} new (queue: ${queue.stats().pending})`);

      // Polite delay between categories
      await categoryDelay();
    }

    logger.info(`Phase 1 complete — ${queue.stats().seenThisCycle} unique products queued`);

    // ── Phase 2: Scrape + filter ──────────────────────────────────────────────
    logger.info(`Phase 2 starting — scraping with concurrency=${SCRAPE_CONCURRENCY}`);
    await queue.process();

    // ── Phase 3: Finalise run record ─────────────────────────────────────────
    const durationMs = Date.now() - startedAt;

    await CrawlerRun.findByIdAndUpdate(run._id, {
      status: 'completed',
      finishedAt: new Date(),
      durationMs,
      stats,
      categoryStats,
    });

    logger.info(
      `═══ Crawl cycle complete (${Math.round(durationMs / 1000)}s) ═══ ` +
      `scanned=${stats.productsScanned} deals=${stats.dealsFound} posted=${stats.dealsPosted} errors=${stats.errors}`
    );

    return stats;
  } catch (error) {
    const durationMs = Date.now() - startedAt;

    await CrawlerRun.findByIdAndUpdate(run._id, {
      status: 'failed',
      finishedAt: new Date(),
      durationMs,
      stats,
      categoryStats,
      error: error.message,
    });

    logger.error(`Crawl cycle failed: ${error.message}`);
    throw error;
  }
}

/*
 * ─── PER-PRODUCT PROCESSOR ───────────────────────────────────────────────────
 */

/**
 * Scrape one product URL, evaluate it against the deal filter,
 * save to DB and post to Telegram if it qualifies.
 *
 * All errors are caught so one bad product doesn't stop the queue.
 */
async function processProduct(url, { category = 'unknown' } = {}, stats) {
  try {
    // Scrape the product page
    const product = await scrapeAmazonProduct(url);
    stats.productsScanned++;

    if (!product || !product.title) {
      logger.warn(`Skipping ${url} — no product data returned`);
      stats.errors++;
      return;
    }

    // Evaluate against deal filter (discount threshold + price history)
    const { shouldPost, reason, dealType } = await evaluateDeal(product);

    if (!shouldPost) {
      logger.info(`Skip: "${product.title.slice(0, 50)}…" — ${reason}`);
      return;
    }

    stats.dealsFound++;
    logger.info(`Deal: "${product.title.slice(0, 50)}…" — ${reason}`);

    // Upsert to MongoDB (updates price history even if already exists)
    const deal = await upsertDeal(product, category, dealType, reason);

    // Only post to Telegram if not already posted (prevents re-posts on price updates)
    if (!deal.posted) {
      await postDealToTelegram(deal);

      await Deal.findByIdAndUpdate(deal._id, {
        posted: true,
        postedAt: new Date(),
      });

      stats.dealsPosted++;
      logger.info(`Posted to Telegram: "${deal.title.slice(0, 50)}…"`);
    } else {
      logger.info(`Already posted: ASIN ${deal.asin} — skipping Telegram`);
    }
  } catch (error) {
    stats.errors++;
    logger.error(`processProduct failed [${url}]: ${error.message}`);
  }
}

/*
 * ─── TELEGRAM FORMATTER ──────────────────────────────────────────────────────
 */

async function postDealToTelegram(deal) {
  const caption = telegram.formatDealText(
    deal.title,
    deal.price,
    deal.link,
    deal.originalPrice,
    deal.savings
  );
  await telegram.sendToTelegram(deal.image, caption);
}

/*
 * ─── EXPORTS ─────────────────────────────────────────────────────────────────
 */

module.exports = {
  runCrawlCycle,
  getQueueStats: () => queue.stats(),
};
