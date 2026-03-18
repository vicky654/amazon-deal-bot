require('dotenv').config();

const express  = require('express');
const cors     = require('cors');
const mongoose = require('mongoose');
const cron     = require('node-cron');
const path     = require('path');

// ── New multi-platform modules ────────────────────────────────────────────────
const newCrawler          = require('./src/crawler');
const dealsRouter         = require('./src/routes/deals');
const crawlerRouter       = require('./src/routes/crawler');
const healthRouter        = require('./src/routes/health');
const earnkaroRouter      = require('./src/routes/earnkaro');
const reelsRouter         = require('./src/routes/reels');
const { closeBrowser }    = require('./src/scraper/browser');
const { getQueueStats }   = require('./src/queue');
const earnkaroAutoRefresh = require('./src/services/earnkaroAutoRefresh');

// ── Legacy modules (kept for backward compat during migration) ─────────────
const telegram = require('./telegram');
const logger   = require('./utils/logger');

/*
 * ─── ENVIRONMENT ──────────────────────────────────────────────────────────────
 */

const REQUIRED_ENV = ['MONGODB_URI', 'TELEGRAM_TOKEN', 'TELEGRAM_CHAT'];
const missingEnv   = REQUIRED_ENV.filter((k) => !process.env[k]);
if (missingEnv.length) {
  logger.warn(`Missing env vars: ${missingEnv.join(', ')} — some features disabled`);
}

const PORT       = process.env.PORT        || 5000;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/deal-system';
const CRON_SCHEDULE = process.env.CRON_SCHEDULE || '*/5 * * * *'; // every 5 min

/*
 * ─── APP ──────────────────────────────────────────────────────────────────────
 */

const app = express();
app.use(cors());
app.use(express.json({ limit: '2mb' }));

// Serve generated reels (and other static assets from backend/public/)
app.use(express.static(path.join(__dirname, 'public')));

/*
 * ─── GLOBAL ERROR HANDLERS ────────────────────────────────────────────────────
 */

process.on('unhandledRejection', (err) => logger.error(`Unhandled rejection: ${err?.message || err}`));
process.on('uncaughtException',  (err) => logger.error(`Uncaught exception: ${err?.message || err}`));

/*
 * ─── MONGODB ──────────────────────────────────────────────────────────────────
 */

mongoose
  .connect(MONGODB_URI, { serverSelectionTimeoutMS: 10000 })
  .then(() => logger.info('MongoDB connected'))
  .catch((err) => logger.error(`MongoDB connection error: ${err.message}`));

/*
 * ─── CRON ─────────────────────────────────────────────────────────────────────
 * Default: every 5 minutes.
 * Override via CRON_SCHEDULE env var (e.g. "star/10 * * * *" for every 10 min).
 */

let cronRunning = false;

cron.schedule(CRON_SCHEDULE, async () => {
  if (cronRunning) {
    logger.warn('Cron: previous cycle still running — skipping tick');
    return;
  }
  cronRunning = true;
  try {
    await newCrawler.runCrawlCycle();
  } catch (err) {
    logger.error(`Cron cycle threw: ${err.message}`);
  } finally {
    cronRunning = false;
  }
});

/*
 * ─── ROUTES ───────────────────────────────────────────────────────────────────
 */

// Multi-platform REST API
app.use('/api/deals',    dealsRouter);
app.use('/api/crawler',  crawlerRouter);
app.use('/api/earnkaro', earnkaroRouter);
app.use('/api/reels',    reelsRouter);
app.use('/',             healthRouter);

// ── Legacy endpoints (frontend currently calls these) ─────────────────────────

// POST /generate — kept for frontend compatibility; now dispatches multi-platform
app.post('/generate', async (req, res, next) => {
  req.url = '/generate'; // alias → /api/deals/generate
  dealsRouter.handle(req, res, next);
});

// POST /telegram — send arbitrary deal to Telegram
app.post('/telegram', async (req, res) => {
  try {
    const { title, price, image, link, originalPrice, savings, platform } = req.body;
    if (!title || !link) return res.status(400).json({ error: 'title and link are required' });

    const caption = telegram.formatDealText(title, price, link, originalPrice, savings, null, platform);
    const result  = await telegram.sendToTelegram(image, caption, link);
    res.json({ success: true, result });
  } catch (err) {
    logger.error(`/telegram: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

// POST /telegram-message — custom message
app.post('/telegram-message', async (req, res) => {
  try {
    const { message } = req.body;
    if (!message) return res.status(400).json({ error: 'message is required' });
    const result = await telegram.sendMessageToTelegram(message);
    res.json({ success: true, result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Legacy /api/crawler/status shape (frontend CrawlerPanel expects recentRuns + isRunning)
app.get('/api/crawler/status', async (req, res) => {
  try {
    const CrawlerRun = require('./src/models/CrawlerRun');
    const runs = await CrawlerRun.find().sort({ startedAt: -1 }).limit(10).lean();
    res.json({
      isRunning:  cronRunning,
      queueStats: getQueueStats(),
      recentRuns: runs,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/*
 * ─── GLOBAL ERROR MIDDLEWARE ──────────────────────────────────────────────────
 */

app.use((err, req, res, _next) => {
  logger.error(`[Express] ${req.method} ${req.path} → ${err.message}`);
  res.status(err.status || 500).json({ success: false, error: err.message });
});

/*
 * ─── GRACEFUL SHUTDOWN ────────────────────────────────────────────────────────
 */

async function shutdown(signal) {
  logger.info(`${signal} received — shutting down`);
  earnkaroAutoRefresh.stop();
  await closeBrowser();
  await mongoose.connection.close();
  process.exit(0);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT',  () => shutdown('SIGINT'));

/*
 * ─── START ────────────────────────────────────────────────────────────────────
 */

// Only bind the port when this file is run directly (not when required by tests)
if (require.main === module) {
  app.listen(PORT, () => {
    logger.info(`Server running on port ${PORT}`);
    logger.info(`Cron: ${CRON_SCHEDULE}`);
    telegram.sendTestMessage().catch(() => {});

    // Start EarnKaro auto-refresh cron (independent of main crawler)
    earnkaroAutoRefresh.start();
  });
}

module.exports = app;
