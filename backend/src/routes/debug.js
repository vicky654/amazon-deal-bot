/**
 * Debug API — crawler diagnostics
 *
 * GET /api/debug/crawler  → live status + env check + telegram ping
 */

const router     = require('express').Router();
const CrawlerRun = require('../models/CrawlerRun');
const Deal       = require('../models/Deal');
const { getQueueStats }    = require('../queue');
const { state: cronState } = require('../cronState');
const autoMode   = require('../autoMode');
const telegram   = require('../../telegram');
const logger     = require('../../utils/logger');
const fs         = require('fs');

function checkEnvVar(name) {
  const val = process.env[name];
  return { set: !!val, preview: val ? `${val.slice(0, 6)}…` : null };
}

function checkChrome() {
  const puppeteer = require('puppeteer');
  try {
    const bundledPath = puppeteer.executablePath();
    const exists      = bundledPath && fs.existsSync(bundledPath);
    return {
      found:  exists,
      path:   bundledPath,
      source: 'bundled',
      hint:   exists ? null : 'Chromium missing — PUPPETEER_SKIP_CHROMIUM_DOWNLOAD must NOT be set; redeploy to re-download it',
    };
  } catch (e) {
    return { found: false, path: null, source: null, hint: e.message };
  }
}

router.get('/crawler', async (req, res) => {
  try {
    const [lastRun, totalDeals, postedDeals] = await Promise.all([
      CrawlerRun.findOne().sort({ startedAt: -1 }).lean(),
      Deal.countDocuments(),
      Deal.countDocuments({ posted: true }),
    ]);

    let isTelegramWorking = false;
    let telegramError     = null;
    try {
      isTelegramWorking = await telegram.sendTestMessage();
    } catch (e) {
      telegramError = e.message;
    }

    const chrome = checkChrome();

    const env = {
      TELEGRAM_TOKEN:            checkEnvVar('TELEGRAM_TOKEN'),
      TELEGRAM_CHAT:             checkEnvVar('TELEGRAM_CHAT'),
      MONGODB_URI:               checkEnvVar('MONGODB_URI'),
      JWT_SECRET:                checkEnvVar('JWT_SECRET'),
      ALLOWED_ORIGINS:   checkEnvVar('ALLOWED_ORIGINS'),
      AUTO_MODE_DEFAULT: checkEnvVar('AUTO_MODE_DEFAULT'),
      NODE_ENV: { set: true, preview: process.env.NODE_ENV || 'development' },
      // These must NOT be set — flagged here if someone accidentally re-adds them
      // puppeteer v21 uses PUPPETEER_SKIP_DOWNLOAD (not the old CHROMIUM variant)
      PUPPETEER_SKIP_DOWNLOAD: {
        set:    !!process.env.PUPPETEER_SKIP_DOWNLOAD,
        danger: process.env.PUPPETEER_SKIP_DOWNLOAD === 'true'
                  ? '⛔ DELETE THIS — puppeteer v21 checks this exact name; Chromium will NOT download'
                  : null,
      },
      PUPPETEER_SKIP_CHROMIUM_DOWNLOAD: {
        set:    !!process.env.PUPPETEER_SKIP_CHROMIUM_DOWNLOAD,
        danger: process.env.PUPPETEER_SKIP_CHROMIUM_DOWNLOAD === 'true'
                  ? '⛔ DELETE THIS — old puppeteer name, still blocks download'
                  : null,
      },
      PUPPETEER_EXECUTABLE_PATH: {
        set:    !!process.env.PUPPETEER_EXECUTABLE_PATH,
        danger: process.env.PUPPETEER_EXECUTABLE_PATH
                  ? '⛔ DELETE THIS — use puppeteer.executablePath() instead'
                  : null,
      },
    };

    res.json({
      // Global runtime counters (set by crawler/index.js)
      crawler: {
        running:      global.crawlerRunning  ?? cronState.running,
        lastRun:      global.lastCrawlerRun  ?? cronState.lastRun,
        dealsScraped: global.dealsScraped    ?? 0,
        dealsPosted:  global.dealsPosted     ?? 0,
        lastError:    global.lastCrawlerError ?? null,
      },
      status:          (global.crawlerRunning ?? cronState.running) ? 'running' : 'stopped',
      autoMode:        autoMode.state.enabled,
      autoModeUpdatedAt: autoMode.state.updatedAt,
      cron: {
        running:    cronState.running,
        lastRun:    cronState.lastRun,
        nextRun:    cronState.nextRun,
        schedule:   process.env.CRON_SCHEDULE || '*/5 * * * *',
        recentLogs: cronState.logs.slice(0, 10),
      },
      lastDbRun: lastRun ? {
        status:     lastRun.status,
        startedAt:  lastRun.startedAt,
        finishedAt: lastRun.finishedAt,
        durationMs: lastRun.durationMs,
        stats:      lastRun.stats,
        error:      lastRun.error || null,
      } : null,
      db: {
        totalDeals,
        postedDeals,
        unpostedDeals: totalDeals - postedDeals,
      },
      queue: getQueueStats(),
      telegram: {
        isTelegramWorking,
        tokenSet:  env.TELEGRAM_TOKEN.set,
        chatIdSet: env.TELEGRAM_CHAT.set,
        chatId:    env.TELEGRAM_CHAT.preview,
        error:     telegramError,
      },
      chrome: {
        found:  chrome.found,
        path:   chrome.path,
        source: chrome.source,
        hint:   chrome.hint || null,
      },
      env,
      system: {
        nodeVersion: process.version,
        platform:    process.platform,
        uptime:      Math.round(process.uptime()),
        memory: {
          usedMB:  Math.round(process.memoryUsage().heapUsed  / 1024 / 1024),
          totalMB: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
          rssMB:   Math.round(process.memoryUsage().rss       / 1024 / 1024),
        },
      },
    });

    logger.info('[Debug] /api/debug/crawler called');
  } catch (err) {
    logger.error(`[Debug] /api/debug/crawler error: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
