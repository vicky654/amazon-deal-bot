/**
 * Crawler Control API
 *
 * GET  /api/crawler/status  → Last run + queue stats
 * POST /api/crawler/start   → Trigger manual crawl cycle
 * GET  /api/crawler/runs    → Paginated run history
 */

const router     = require('express').Router();
const CrawlerRun = require('../models/CrawlerRun');
const { runCrawlCycle, stopCrawl } = require('../crawler');
const { getQueueStats } = require('../queue');
const { getBrowserDiagnostics } = require('../scraper/browser');
const { state: cronState } = require('../cronState');
const logger     = require('../../utils/logger');

router.get('/status', async (req, res, next) => {
  try {
    const lastRun = await CrawlerRun.findOne().sort({ startedAt: -1 }).lean();
    const running = global.crawlerRunning || cronState.running || false;
    
    logger.info(`[CrawlerControl] STATUS running=${running}`);
    
    res.json({
      success: true,
      running,
      status:  running ? 'running' : 'stopped',
      currentCategory: global.currentCategory || 'Idle',
      productsScanned: global.productsScanned || 0,
      dealsSent:       global.dealsPosted || 0,
      lastRunTime:     global.lastCrawlerRun || (lastRun ? lastRun.startedAt : null),
      browserPages:    getBrowserDiagnostics().pageCount || 0,
      queueSize:       getQueueStats().totalQueued || 0,
      lastRun,
    });
  } catch (err) {
    next(err);
  }
});

router.post('/start', async (req, res) => {
  const running = global.crawlerRunning || cronState.running || false;
  if (running) {
    logger.info('[CrawlerControl] START requested but already running');
    return res.status(409).json({ success: false, error: 'Crawler is already running' });
  }

  logger.info('[CrawlerControl] START requested');
  res.json({ success: true, message: 'Crawler Started' });

  // Update unified state
  cronState.running = true; 
  global.crawlerRunning = true;

  setImmediate(() => {
    runCrawlCycle()
      .then((stats) => logger.info(`[CrawlerControl] Cycle completed: ${JSON.stringify(stats)}`))
      .catch((err) => logger.error(`[CrawlerControl] Cycle failed: ${err.message}`))
      .finally(() => { 
        cronState.running = false; 
        global.crawlerRunning = false;
      });
  });
});

router.post('/stop', (req, res) => {
  const running = global.crawlerRunning || cronState.running || false;
  if (!running) {
    logger.info('[CrawlerControl] STOP requested but already stopped');
    return res.status(409).json({ success: false, error: 'Crawler is already stopped' });
  }

  logger.info('[CrawlerControl] STOP requested');
  stopCrawl();
  
  res.json({ success: true, message: 'Crawler Stopped' });
});

router.post('/restart', async (req, res) => {
  logger.info('[CrawlerControl] RESTART requested');
  
  const running = global.crawlerRunning || cronState.running || false;
  if (running) {
    stopCrawl();
    // Wait a bit for it to stop
    await new Promise(r => setTimeout(r, 2000));
  }

  // Start a new cycle
  cronState.running = true;
  global.crawlerRunning = true;

  setImmediate(() => {
    runCrawlCycle()
      .then((stats) => logger.info(`[CrawlerControl] Restart cycle completed: ${JSON.stringify(stats)}`))
      .catch((err) => logger.error(`[CrawlerControl] Restart cycle failed: ${err.message}`))
      .finally(() => { 
        cronState.running = false;
        global.crawlerRunning = false;
      });
  });

  res.json({ success: true, message: 'Crawler Restarted' });
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
