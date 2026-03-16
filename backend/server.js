require("dotenv").config();

const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const cron = require("node-cron");

const Deal = require("./models/Deal");
const scraper = require("./scraper");
const telegram = require("./telegram");
const logger = require("./utils/logger");
const { extractAsin } = require("./utils/affiliate");

/*
 * ─── ENVIRONMENT VALIDATION ─────────────────────────────────────────────────
 */

const REQUIRED_ENV = ["MONGODB_URI", "TELEGRAM_TOKEN", "TELEGRAM_CHAT"];
const missingEnv = REQUIRED_ENV.filter((key) => !process.env[key]);

if (missingEnv.length > 0) {
  logger.warn(`Missing environment variables: ${missingEnv.join(", ")} — some features may be disabled`);
}

/*
 * ─── CONFIG ─────────────────────────────────────────────────────────────────
 */

const PORT = process.env.PORT || 5000;
const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/deal-system";
const MIN_DISCOUNT_PERCENT = 60; // Only post deals with at least 60% off
const MAX_CONCURRENT_SCRAPES = 3; // Max parallel scrapes in the cron job

/*
 * ─── CONCURRENCY LIMITER ────────────────────────────────────────────────────
 * Simple semaphore so the cron job never fires more than MAX_CONCURRENT_SCRAPES
 * Puppeteer pages simultaneously, preventing memory spikes.
 */

class Semaphore {
  constructor(max) {
    this.max = max;
    this._count = 0;
    this._queue = [];
  }

  acquire() {
    if (this._count < this.max) {
      this._count++;
      return Promise.resolve();
    }
    return new Promise((resolve) => this._queue.push(resolve));
  }

  release() {
    this._count--;
    if (this._queue.length > 0) {
      this._count++;
      this._queue.shift()();
    }
  }
}

const scrapeSemaphore = new Semaphore(MAX_CONCURRENT_SCRAPES);

/*
 * ─── APP SETUP ──────────────────────────────────────────────────────────────
 */

const app = express();

app.use(cors());
app.use(express.json());

/*
 * ─── GLOBAL ERROR HANDLERS ──────────────────────────────────────────────────
 */

process.on("unhandledRejection", (err) => {
  logger.error(`Unhandled Promise Rejection: ${err.message}`, err);
});

process.on("uncaughtException", (err) => {
  logger.error(`Uncaught Exception: ${err.message}`, err);
});

/*
 * ─── MONGODB CONNECTION ─────────────────────────────────────────────────────
 */

mongoose
  .connect(MONGODB_URI)
  .then(() => logger.info("MongoDB connected"))
  .catch((err) => logger.error(`MongoDB connection error: ${err.message}`));

/*
 * ─── CRON JOB ───────────────────────────────────────────────────────────────
 * Runs every 5 minutes.
 * Scans Amazon deals pages → scrapes products → saves + posts ≥60% discounts.
 */

let cronRunning = false;

cron.schedule("*/5 * * * *", async () => {
  // Prevent overlapping runs if a previous cycle takes too long
  if (cronRunning) {
    logger.warn("Cron: previous run still in progress — skipping this tick");
    return;
  }

  cronRunning = true;
  logger.info("Cron: starting deal scan...");

  try {
    const urls = await scraper.findDealProducts();
    logger.info(`Cron: found ${urls.length} product URLs to check`);

    // Process all URLs concurrently, throttled by the semaphore
    const tasks = urls.map((url) =>
      scrapeSemaphore
        .acquire()
        .then(async () => {
          try {
            await processDealUrl(url);
          } finally {
            scrapeSemaphore.release();
          }
        })
    );

    await Promise.allSettled(tasks);
    logger.info("Cron: deal scan complete");
  } catch (error) {
    logger.error(`Cron: scan failed — ${error.message}`);
  } finally {
    cronRunning = false;
  }
});

/**
 * Scrape a single URL, check the discount threshold, save to DB and post to Telegram.
 * Errors are caught per-product so one failure doesn't abort the whole batch.
 */
async function processDealUrl(url) {
  try {
    const product = await scraper.scrapeAmazonProduct(url);

    if (!product || !product.title) {
      logger.warn(`Cron: no data returned for ${url}`);
      return;
    }

    logger.info(`Cron: scraped "${product.title}" (savings: ${product.savings}%)`);

    if (!product.savings || product.savings < MIN_DISCOUNT_PERCENT) {
      return; // Not a good enough deal
    }

    logger.info(`Cron: ${product.savings}% deal found — "${product.title}"`);

    // Duplicate check
    if (!product.asin) {
      logger.warn(`Cron: could not extract ASIN from ${url} — skipping`);
      return;
    }

    const existing = await Deal.findOne({ asin: product.asin });
    if (existing) {
      logger.info(`Cron: deal already exists for ASIN ${product.asin} — skipping`);
      return;
    }

    // Save to database
    const deal = new Deal(product);
    await deal.save();
    logger.info(`Cron: deal saved (ASIN: ${product.asin})`);

    // Post to Telegram
    const caption = telegram.formatDealText(
      product.title,
      product.price,
      product.link,
      product.originalPrice,
      product.savings
    );

    await telegram.sendToTelegram(product.image, caption);
    logger.info(`Cron: posted to Telegram — "${product.title}"`);

    // Mark as posted
    deal.posted = true;
    await deal.save();
  } catch (error) {
    logger.error(`Cron: failed to process ${url} — ${error.message}`);
  }
}

/*
 * ─── API ROUTES ─────────────────────────────────────────────────────────────
 */

/* GET /api/deals — list recent deals */
app.get("/api/deals", async (req, res) => {
  try {
    const deals = await Deal.find().sort({ createdAt: -1 }).limit(50);
    res.json(deals);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/* GET /api/deals/:id — single deal */
app.get("/api/deals/:id", async (req, res) => {
  try {
    const deal = await Deal.findById(req.params.id);
    if (!deal) return res.status(404).json({ error: "Deal not found" });
    res.json(deal);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/* POST /generate — scrape and save a deal from a provided Amazon URL */
app.post("/generate", async (req, res) => {
  try {
    const { url } = req.body;

    if (!url) return res.status(400).json({ error: "Amazon URL is required" });

    if (!url.includes("amazon")) {
      return res.status(400).json({ error: "Please provide a valid Amazon product URL" });
    }

    const asin = extractAsin(url);
    if (!asin) return res.status(400).json({ error: "Invalid Amazon URL — could not extract ASIN" });

    // Return cached deal if it already exists
    const existing = await Deal.findOne({ asin });
    if (existing) return res.json(existing);

    const product = await scraper.scrapeAmazonProduct(url);

    if (!product || !product.title) {
      return res.status(500).json({ error: "Failed to scrape product" });
    }

    const deal = new Deal({
      title: product.title,
      price: product.price,
      image: product.image,
      link: product.link,
      asin,
      savings: product.savings,
      originalPrice: product.originalPrice,
    });

    await deal.save();
    logger.info(`Generated deal: ${deal.title}`);
    res.json(deal);
  } catch (error) {
    logger.error(`/generate error: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

/* POST /telegram — post a deal to Telegram */
app.post("/telegram", async (req, res) => {
  try {
    const { title, price, image, link, originalPrice, savings } = req.body;

    if (!title || !link) {
      return res.status(400).json({ error: "Title and link are required" });
    }

    const caption = telegram.formatDealText(title, price, link, originalPrice, savings);
    const result = await telegram.sendToTelegram(image, caption);

    res.json({ success: true, message: "Deal posted to Telegram", result });
  } catch (error) {
    logger.error(`/telegram error: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

/* POST /telegram-message — send a custom message to Telegram */
app.post("/telegram-message", async (req, res) => {
  try {
    const { message } = req.body;

    if (!message) return res.status(400).json({ error: "Message is required" });

    const result = await telegram.sendMessageToTelegram(message);
    res.json({ success: true, message: "Message sent to Telegram", result });
  } catch (error) {
    logger.error(`/telegram-message error: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

/* DELETE /api/deals/:id */
app.delete("/api/deals/:id", async (req, res) => {
  try {
    const deal = await Deal.findByIdAndDelete(req.params.id);
    if (!deal) return res.status(404).json({ error: "Deal not found" });
    res.json({ success: true, message: "Deal deleted" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/* GET /health */
app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    time: new Date().toISOString(),
    mongoState: mongoose.connection.readyState, // 1 = connected
  });
});

/*
 * ─── GRACEFUL SHUTDOWN ──────────────────────────────────────────────────────
 */

async function shutdown(signal) {
  logger.info(`Received ${signal} — shutting down gracefully...`);

  await scraper.closeBrowser();
  await mongoose.connection.close();

  logger.info("Shutdown complete");
  process.exit(0);
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

/*
 * ─── START SERVER ───────────────────────────────────────────────────────────
 */

app.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`);
});

module.exports = app;
