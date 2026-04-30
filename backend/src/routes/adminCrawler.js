/**
 * Admin Crawler Control API
 *
 * GET  /api/admin/crawler/status  → Returns status, stats, and states
 * GET  /api/admin/crawler/logs    → Returns live logs array
 * POST /api/admin/crawler/start   → Starts crawler
 * POST /api/admin/crawler/stop    → Stops crawler
 * POST /api/admin/crawler/restart → Restarts crawler
 */

const router = require('express').Router();
const CrawlerRun = require('../models/CrawlerRun');
const { runCrawlCycle, stopCrawl } = require('../crawler');
const { getQueueStats } = require('../queue');
const { getBrowserDiagnostics } = require('../scraper/browser');
const { state: cronState, addLog } = require('../cronState');
const logger = require('../../utils/logger');

// Role check middleware (optional but requested)
function requireAdminRole(req, res, next) {
  // If your JWT payload has a role, check it. Otherwise, assume valid JWT means admin.
  if (req.admin && req.admin.role && req.admin.role !== 'admin') {
    return res.status(403).json({ success: false, error: 'Admin role required' });
  }
  next();
}

router.use(requireAdminRole);

router.get('/status', async (req, res, next) => {
  try {
    const lastRun = await CrawlerRun.findOne().sort({ startedAt: -1 }).lean();
    const running = global.crawlerRunning || cronState.running || false;
    
    // Memory usage
    const mem = process.memoryUsage();
    const memoryMB = Math.round(mem.rss / 1024 / 1024);
    
    // Browser
    const diag = getBrowserDiagnostics();

    res.json({
      success: true,
      data: {
        running,
        isStarting: cronState.isStarting,
        isStopping: cronState.isStopping,
        isRestarting: cronState.isRestarting,
        lastRun: global.lastCrawlerRun || (lastRun ? lastRun.startedAt : null),
        currentCategory: global.currentCategory || 'Idle',
        currentAsin: global.currentAsin || null,
        queueSize: getQueueStats().totalQueued || 0,
        activePages: diag.pageCount || 0,
        dealsSent: global.dealsPosted || 0,
        browserConnected: diag.connected || false,
        memoryUsageMB: memoryMB,
      }
    });
  } catch (err) {
    next(err);
  }
});

router.get('/logs', (req, res) => {
  res.json({
    success: true,
    data: {
      logs: cronState.logs
    }
  });
});

router.post('/start', async (req, res) => {
  const running = global.crawlerRunning || cronState.running || false;
  if (running || cronState.isStarting) {
    return res.status(409).json({ success: false, error: 'Crawler is already running or starting' });
  }

  logger.info('[CrawlerControl] START requested');
  addLog('[CrawlerControl] START requested', 'info');

  cronState.isStarting = true;
  cronState.running = true; 
  global.crawlerRunning = true;

  setImmediate(() => {
    addLog('[CrawlerControl] STATUS running=true', 'info');
    runCrawlCycle()
      .then((stats) => {
        logger.info(`[CrawlerControl] Cycle completed: ${JSON.stringify(stats)}`);
        addLog(`Crawl completed: ${stats.dealsFound} deals found`, 'info');
      })
      .catch((err) => {
        logger.error(`[CrawlerControl] Cycle failed: ${err.message}`);
        addLog(`Crawl failed: ${err.message}`, 'error');
      })
      .finally(() => { 
        cronState.running = false; 
        global.crawlerRunning = false;
        cronState.isStarting = false;
        addLog('[CrawlerControl] STATUS running=false', 'info');
      });
  });

  res.json({ success: true, message: 'Crawler started', data: {} });
});

router.post('/stop', (req, res) => {
  const running = global.crawlerRunning || cronState.running || false;
  if (!running || cronState.isStopping) {
    return res.status(409).json({ success: false, error: 'Crawler is already stopped' });
  }

  logger.info('[CrawlerControl] STOP requested');
  addLog('[CrawlerControl] STOP requested', 'warn');

  stopCrawl();
  
  res.json({ success: true, message: 'Crawler stopped', data: {} });
});

router.post('/restart', async (req, res) => {
  if (cronState.isRestarting) {
    return res.status(409).json({ success: false, error: 'Crawler is already restarting' });
  }

  logger.info('[CrawlerControl] RESTART requested');
  addLog('[CrawlerControl] RESTART requested', 'warn');
  
  cronState.isRestarting = true;

  const running = global.crawlerRunning || cronState.running || false;
  if (running) {
    stopCrawl();
    // Wait a bit for it to stop gracefully
    setTimeout(() => {
      startNewCycle();
    }, 3000);
  } else {
    startNewCycle();
  }

  function startNewCycle() {
    cronState.running = true;
    global.crawlerRunning = true;
    cronState.isStarting = true;

    setImmediate(() => {
      addLog('[CrawlerControl] STATUS running=true', 'info');
      runCrawlCycle()
        .then((stats) => {
          logger.info(`[CrawlerControl] Restart cycle completed: ${JSON.stringify(stats)}`);
          addLog(`Restart crawl completed: ${stats.dealsFound} deals found`, 'info');
        })
        .catch((err) => {
          logger.error(`[CrawlerControl] Restart cycle failed: ${err.message}`);
          addLog(`Restart crawl failed: ${err.message}`, 'error');
        })
        .finally(() => { 
          cronState.running = false;
          global.crawlerRunning = false;
          cronState.isRestarting = false;
          cronState.isStarting = false;
          addLog('[CrawlerControl] STATUS running=false', 'info');
        });
    });
  }

  res.json({ success: true, message: 'Crawler restarting', data: {} });
});

module.exports = router;
