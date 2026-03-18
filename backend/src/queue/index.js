/**
 * Queue System
 *
 * Two p-queue instances:
 *
 *   scrapeQueue     — concurrency 2–3, handles all Puppeteer scraping
 *   affiliateQueue  — concurrency 1,   handles EarnKaro (session-safe)
 *
 * Uses p-queue v6 (CommonJS-compatible).
 * Install: npm install p-queue@6
 */

// p-queue v6 exports a default export — handle both CJS and ESM interop
const _PQueue = require('p-queue');
const PQueue  = _PQueue.default || _PQueue;
const logger  = require('../../utils/logger');
const metrics = require('../utils/metrics');

const SCRAPE_CONCURRENCY    = parseInt(process.env.SCRAPE_CONCURRENCY    || '2', 10);
const AFFILIATE_CONCURRENCY = parseInt(process.env.AFFILIATE_CONCURRENCY || '1', 10);

let _scrapeQueue    = null;
let _affiliateQueue = null;

function getScrapeQueue() {
  if (!_scrapeQueue) {
    _scrapeQueue = new PQueue({
      concurrency: SCRAPE_CONCURRENCY,
      intervalCap: SCRAPE_CONCURRENCY,
      interval: 1000, // Max N starts per second
    });

    _scrapeQueue.on('active', () => {
      logger.debug(`[ScrapeQueue] Active=${_scrapeQueue.pending} Pending=${_scrapeQueue.size}`);
    });

    _scrapeQueue.on('error', (err) => {
      logger.error(`[ScrapeQueue] Unhandled error: ${err.message}`);
      metrics.increment('scrape.errors');
    });
  }
  return _scrapeQueue;
}

function getAffiliateQueue() {
  if (!_affiliateQueue) {
    _affiliateQueue = new PQueue({
      concurrency: AFFILIATE_CONCURRENCY,
    });

    _affiliateQueue.on('active', () => {
      logger.debug(`[AffiliateQueue] Active=${_affiliateQueue.pending} Pending=${_affiliateQueue.size}`);
    });

    _affiliateQueue.on('error', (err) => {
      logger.error(`[AffiliateQueue] Unhandled error: ${err.message}`);
      metrics.increment('affiliate.errors');
    });
  }
  return _affiliateQueue;
}

/**
 * Wait for both queues to drain (use at end of crawl cycle).
 */
async function drainAll() {
  await Promise.all([
    _scrapeQueue ? _scrapeQueue.onIdle() : Promise.resolve(),
    _affiliateQueue ? _affiliateQueue.onIdle() : Promise.resolve(),
  ]);
}

function getQueueStats() {
  return {
    scrape: _scrapeQueue
      ? { pending: _scrapeQueue.size, active: _scrapeQueue.pending, concurrency: SCRAPE_CONCURRENCY }
      : { pending: 0, active: 0, concurrency: SCRAPE_CONCURRENCY },
    affiliate: _affiliateQueue
      ? { pending: _affiliateQueue.size, active: _affiliateQueue.pending, concurrency: AFFILIATE_CONCURRENCY }
      : { pending: 0, active: 0, concurrency: AFFILIATE_CONCURRENCY },
  };
}

module.exports = { getScrapeQueue, getAffiliateQueue, drainAll, getQueueStats };
