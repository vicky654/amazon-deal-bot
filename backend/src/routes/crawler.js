/**
 * Crawler Control API
 *
 * GET  /api/crawler/status  → Last run + queue stats
 * POST /api/crawler/start   → Trigger manual crawl cycle
 * GET  /api/crawler/runs    → Paginated run history
 */

const router     = require('express').Router();
const CrawlerRun = require('../models/CrawlerRun');
const { runCrawlCycle } = require('../crawler');
const { getQueueStats } = require('../queue');
const logger     = require('../../utils/logger');

let _running = false;

router.get('/status', async (req, res, next) => {
  try {
    const lastRun = await CrawlerRun.findOne().sort({ startedAt: -1 }).lean();
    res.json({
      success:   true,
      running:   _running,
      queues:    getQueueStats(),
      lastRun,
    });
  } catch (err) {
    next(err);
  }
});

router.post('/start', async (req, res) => {
  if (_running) {
    return res.status(409).json({ success: false, error: 'Crawl cycle already running' });
  }

  res.json({ success: true, message: 'Crawl cycle started' });

  // Fire and forget — don't block the HTTP response
  _running = true;
  runCrawlCycle()
    .then((stats) => logger.info(`[API] Manual crawl done: ${JSON.stringify(stats)}`))
    .catch((err) => logger.error(`[API] Manual crawl failed: ${err.message}`))
    .finally(() => { _running = false; });
});

router.get('/runs', async (req, res, next) => {
  try {
    const limit = Math.min(parseInt(req.query.limit || '20', 10), 100);
    const runs  = await CrawlerRun.find().sort({ startedAt: -1 }).limit(limit).lean();
    res.json({ success: true, runs });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
