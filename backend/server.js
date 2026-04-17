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
const eventsRouter        = require('./src/routes/events');
const healthRouter        = require('./src/routes/health');
const earnkaroRouter      = require('./src/routes/earnkaro');
const reelsRouter         = require('./src/routes/reels');
const systemRouter        = require('./src/routes/system');
const debugRouter         = require('./src/routes/debug');
const redirectRouter      = require('./src/routes/redirect');
const authRouter          = require('./src/routes/auth');
const dashboardRouter     = require('./src/routes/dashboard');
const verifyToken         = require('./src/middleware/auth');
const { closeBrowser }    = require('./src/scraper/browser');
const { getQueueStats }   = require('./src/queue');
const earnkaroAutoRefresh = require('./src/services/earnkaroAutoRefresh');
const { state: cronState, addLog: cronLog, parseIntervalMinutes } = require('./src/cronState');

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

// ── Chromium boot-check ────────────────────────────────────────────────────────
// Catches Puppeteer misconfiguration at startup (visible in Render build/deploy logs)
// instead of silently failing during a crawl cycle 15 minutes later.
{
  const fs = require('fs');
  const puppeteer = require('puppeteer');

  // puppeteer v21 checks PUPPETEER_SKIP_DOWNLOAD (not the old PUPPETEER_SKIP_CHROMIUM_DOWNLOAD)
  const skipVars = [
    'PUPPETEER_SKIP_DOWNLOAD',
    'PUPPETEER_SKIP_CHROME_DOWNLOAD',
    'PUPPETEER_SKIP_CHROMIUM_DOWNLOAD',
  ];
  const activeSkip = skipVars.find((v) => process.env[v] === 'true');
  if (activeSkip) {
    logger.error('════════════════════════════════════════════════════════');
    logger.error(`${activeSkip}=true is SET — Chromium was NOT downloaded.`);
    logger.error('DELETE this env var from Render dashboard, then redeploy.');
    logger.error('Scraping will return 0 results until this is fixed.');
    logger.error('════════════════════════════════════════════════════════');
  }

  try {
    const chromePath = puppeteer.executablePath();
    if (chromePath && fs.existsSync(chromePath)) {
      logger.info(`[Boot] Chromium OK → ${chromePath}`);
    } else {
      logger.error(`[Boot] Chromium NOT FOUND at: ${chromePath}`);
      logger.error('[Boot] Delete PUPPETEER_SKIP_CHROMIUM_DOWNLOAD from Render env vars, then redeploy');
    }
  } catch (e) {
    logger.error(`[Boot] Chromium check failed: ${e.message}`);
  }
}

const PORT          = process.env.PORT          || 5000;
const MONGODB_URI   = process.env.MONGODB_URI   || 'mongodb://localhost:27017/deal-system';
const CRON_SCHEDULE = process.env.CRON_SCHEDULE || '*/5 * * * *'; // every 5 min

/*
 * ─── APP ──────────────────────────────────────────────────────────────────────
 */

const app = express();

// ── CORS ──────────────────────────────────────────────────────────────────────
//
// ALLOWED_ORIGINS env var (comma-separated) controls which origins are allowed.
// Supports:
//   • Exact match:    https://myapp.vercel.app
//   • Wildcard TLD:   *.vercel.app  (all Vercel preview deploys)
//
// Without ALLOWED_ORIGINS the backend falls back to open CORS (origin: '*'),
// which works fine for local dev but disallows credentials.
//
// For production on Render, set:
//   ALLOWED_ORIGINS=https://your-app.vercel.app,https://your-custom-domain.com

const CORS_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'];
const CORS_HEADERS = ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'];

const rawOrigins = process.env.ALLOWED_ORIGINS;

function originAllowed(origin, allowList) {
  // Server-to-server (no Origin header) → always allow
  if (!origin) return true;
  return allowList.some((allowed) => {
    if (allowed === '*') return true;
    // Wildcard subdomain: *.vercel.app
    if (allowed.startsWith('*.')) {
      const suffix = allowed.slice(1); // e.g. ".vercel.app"
      return origin.endsWith(suffix);
    }
    return origin === allowed;
  });
}

const corsOptions = rawOrigins
  ? {
      origin(origin, callback) {
        const list = rawOrigins.split(',').map((o) => o.trim()).filter(Boolean);
        if (originAllowed(origin, list)) return callback(null, true);
        logger.warn(`[CORS] Blocked origin: ${origin}`);
        callback(new Error(`CORS: origin "${origin}" not allowed`));
      },
      credentials:    true,
      methods:        CORS_METHODS,
      allowedHeaders: CORS_HEADERS,
    }
  : {
      // Open CORS for local dev — credentials must be false with origin: '*'
      origin:         '*',
      methods:        CORS_METHODS,
      allowedHeaders: CORS_HEADERS,
    };

// Handle preflight (OPTIONS) for ALL routes before any other middleware.
// This is required for non-simple requests (e.g. those with Authorization header).
app.options('*', cors(corsOptions));
app.use(cors(corsOptions));
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

const cronIntervalMs = parseIntervalMinutes(CRON_SCHEDULE) * 60 * 1000;

cron.schedule(CRON_SCHEDULE, async () => {
  if (cronState.running) {
    logger.warn('Cron: previous cycle still running — skipping tick');
    cronLog('Skipped — previous cycle still running');
    return;
  }

  const now = new Date();
  cronState.running = true;
  cronState.lastRun = now.toISOString();
  cronState.nextRun = new Date(now.getTime() + cronIntervalMs).toISOString();
  cronLog('Cron cycle started');

  try {
    await newCrawler.runCrawlCycle();
    cronLog('Crawl cycle completed successfully');
  } catch (err) {
    logger.error(`Cron cycle threw: ${err.message}`);
    cronLog(`Error: ${err.message}`);
  } finally {
    cronState.running = false;
  }
});

/*
 * ─── ROUTES ───────────────────────────────────────────────────────────────────
 */

// Multi-platform REST API
app.use('/r',             redirectRouter);     // click tracking redirects
app.use('/api/auth',      authRouter);         // login + token verify
app.use('/api/dashboard', verifyToken, dashboardRouter); // protected dashboard
app.use('/api/events',   eventsRouter);
app.use('/api/deals',    dealsRouter);
app.use('/api/crawler',  crawlerRouter);
app.use('/api/earnkaro', earnkaroRouter);
app.use('/api/reels',    reelsRouter);
app.use('/api/system',   systemRouter);
app.use('/api/debug',    debugRouter);
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
    logger.error(`/telegram-message: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

// Legacy /api/crawler/status shape (frontend CrawlerPanel expects recentRuns + isRunning)
app.get('/api/crawler/status', async (req, res) => {
  try {
    const CrawlerRun = require('./src/models/CrawlerRun');
    const runs = await CrawlerRun.find().sort({ startedAt: -1 }).limit(10).lean();
    res.json({
      isRunning:  cronState.running,
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
    logger.info(`Cron: ${CRON_SCHEDULE} (interval ~${parseIntervalMinutes(CRON_SCHEDULE)} min)`);
    logger.info(`CORS: ${rawOrigins ? `restricted to ${rawOrigins}` : 'open (*)'}`);
    telegram.sendTestMessage().catch(() => {});
    earnkaroAutoRefresh.start();

    // Keep-alive self-ping — prevents Render free tier from sleeping during active crawl windows.
    // Pings /health every 10 minutes. Does NOT prevent sleep if no external traffic hits the server
    // for >15 min — for that, use an external monitor (UptimeRobot free tier, pinging /health every 5 min).
    const SELF_URL = (process.env.RENDER_EXTERNAL_URL || process.env.PUBLIC_URL || '').replace(/\/$/, '');
    if (SELF_URL && process.env.NODE_ENV === 'production') {
      const https = require('https');
      const http  = require('http');
      setInterval(() => {
        const url  = `${SELF_URL}/health`;
        const lib  = url.startsWith('https') ? https : http;
        const req  = lib.get(url, (res) => {
          logger.debug(`[KeepAlive] /health → ${res.statusCode}`);
        });
        req.on('error', (e) => logger.warn(`[KeepAlive] ping failed: ${e.message}`));
        req.end();
      }, 10 * 60 * 1000); // every 10 minutes
      logger.info(`[KeepAlive] Self-ping active → ${SELF_URL}/health every 10 min`);
    }
  });
}

module.exports = app;
