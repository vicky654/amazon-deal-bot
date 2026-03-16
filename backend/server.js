require('dotenv').config();

const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const cron = require('node-cron');

const Deal = require('./models/Deal');
const CrawlerRun = require('./models/CrawlerRun');
const scraper = require('./scraper');
const telegram = require('./telegram');
const crawler = require('./crawler/index');
const logger = require('./utils/logger');
const { extractAsin } = require('./utils/affiliate');

/*
 * ─── ENVIRONMENT VALIDATION ──────────────────────────────────────────────────
 */

const REQUIRED_ENV = ['MONGODB_URI', 'TELEGRAM_TOKEN', 'TELEGRAM_CHAT'];
const missingEnv = REQUIRED_ENV.filter((k) => !process.env[k]);
if (missingEnv.length > 0) {
  logger.warn(`Missing env vars: ${missingEnv.join(', ')} — some features disabled`);
}

/*
 * ─── CONFIG ──────────────────────────────────────────────────────────────────
 */

const PORT = process.env.PORT || 5000;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/deal-system';

/*
 * ─── APP ─────────────────────────────────────────────────────────────────────
 */

const app = express();
app.use(cors());
app.use(express.json());

/*
 * ─── GLOBAL ERROR HANDLERS ───────────────────────────────────────────────────
 */

process.on('unhandledRejection', (err) => logger.error(`Unhandled rejection: ${err.message}`, err));
process.on('uncaughtException',  (err) => logger.error(`Uncaught exception: ${err.message}`,  err));

/*
 * ─── MONGODB ─────────────────────────────────────────────────────────────────
 */

mongoose
  .connect(MONGODB_URI)
  .then(() => logger.info('MongoDB connected'))
  .catch((err) => logger.error(`MongoDB connection error: ${err.message}`));

/*
 * ─── CRON JOB ────────────────────────────────────────────────────────────────
 * Runs every 5 minutes.
 * Delegates entirely to crawler.runCrawlCycle() — no deal logic lives here.
 */

let cronRunning = false;

cron.schedule('*/5 * * * *', async () => {
  if (cronRunning) {
    logger.warn('Cron: previous cycle still running — skipping tick');
    return;
  }
  cronRunning = true;
  try {
    await crawler.runCrawlCycle();
  } catch (error) {
    logger.error(`Cron: cycle threw: ${error.message}`);
  } finally {
    cronRunning = false;
  }
});

/*
 * ─── API ROUTES ──────────────────────────────────────────────────────────────
 */

/* GET /api/deals */
app.get('/api/deals', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit || '50', 10), 200);
    const deals = await Deal.find().sort({ createdAt: -1 }).limit(limit);
    res.json(deals);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* GET /api/deals/:id */
app.get('/api/deals/:id', async (req, res) => {
  try {
    const deal = await Deal.findById(req.params.id);
    if (!deal) return res.status(404).json({ error: 'Deal not found' });
    res.json(deal);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* DELETE /api/deals/:id */
app.delete('/api/deals/:id', async (req, res) => {
  try {
    const deal = await Deal.findByIdAndDelete(req.params.id);
    if (!deal) return res.status(404).json({ error: 'Deal not found' });
    res.json({ success: true, message: 'Deal deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* POST /generate — manual single-URL scrape */
app.post('/generate', async (req, res) => {
  try {
    const { url } = req.body;

    if (!url) return res.status(400).json({ error: 'Amazon URL is required' });
    if (!url.includes('amazon')) return res.status(400).json({ error: 'Please provide a valid Amazon product URL' });

    const asin = extractAsin(url);
    if (!asin) return res.status(400).json({ error: 'Invalid Amazon URL — could not extract ASIN' });

    const existing = await Deal.findOne({ asin });
    if (existing) return res.json(existing);

    const product = await scraper.scrapeAmazonProduct(url);
    if (!product || !product.title) return res.status(500).json({ error: 'Failed to scrape product' });

    const deal = new Deal({
      title:         product.title,
      price:         product.price,
      image:         product.image,
      link:          product.link,
      asin,
      savings:       product.savings,
      originalPrice: product.originalPrice,
      category:      'manual',
      dealType:      'manual',
      priceHistory:  [{ price: product.price, originalPrice: product.originalPrice, savings: product.savings }],
    });

    await deal.save();
    logger.info(`Manual deal generated: ${deal.title}`);
    res.json(deal);
  } catch (err) {
    logger.error(`/generate: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

/* POST /telegram */
app.post('/telegram', async (req, res) => {
  try {
    const { title, price, image, link, originalPrice, savings } = req.body;
    if (!title || !link) return res.status(400).json({ error: 'Title and link are required' });

    const caption = telegram.formatDealText(title, price, link, originalPrice, savings);
    const result  = await telegram.sendToTelegram(image, caption);

    res.json({ success: true, message: 'Deal posted to Telegram', result });
  } catch (err) {
    logger.error(`/telegram: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

/* POST /telegram-message */
app.post('/telegram-message', async (req, res) => {
  try {
    const { message } = req.body;
    if (!message) return res.status(400).json({ error: 'Message is required' });

    const result = await telegram.sendMessageToTelegram(message);
    res.json({ success: true, message: 'Message sent to Telegram', result });
  } catch (err) {
    logger.error(`/telegram-message: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

/*
 * ─── CRAWLER API ─────────────────────────────────────────────────────────────
 */

/* GET /api/crawler/status — last N runs + live queue stats */
app.get('/api/crawler/status', async (req, res) => {
  try {
    const runs = await CrawlerRun.find()
      .sort({ startedAt: -1 })
      .limit(10)
      .lean();

    res.json({
      isRunning:  cronRunning,
      queueStats: crawler.getQueueStats(),
      recentRuns: runs,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* POST /api/crawler/start — manually trigger a crawl cycle */
app.post('/api/crawler/start', async (req, res) => {
  if (cronRunning) {
    return res.status(409).json({ error: 'A crawl cycle is already running' });
  }

  // Respond immediately, run async in background
  res.json({ success: true, message: 'Crawl cycle started' });

  cronRunning = true;
  crawler.runCrawlCycle()
    .catch((err) => logger.error(`Manual crawl threw: ${err.message}`))
    .finally(() => { cronRunning = false; });
});

/* GET /health */
app.get('/health', (_req, res) => {
  res.json({
    status:     'ok',
    time:       new Date().toISOString(),
    mongoState: mongoose.connection.readyState, // 1 = connected
    crawling:   cronRunning,
  });
});

/*
 * ─── GRACEFUL SHUTDOWN ───────────────────────────────────────────────────────
 */

async function shutdown(signal) {
  logger.info(`${signal} received — shutting down gracefully`);
  await scraper.closeBrowser();
  await mongoose.connection.close();
  logger.info('Shutdown complete');
  process.exit(0);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT',  () => shutdown('SIGINT'));

/*
 * ─── START ───────────────────────────────────────────────────────────────────
 */

app.listen(PORT, () => logger.info(`Server running on port ${PORT}`));

module.exports = app;
