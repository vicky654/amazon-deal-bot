/**
 * System Routes
 *
 * GET  /api/system/cron-status     → live cron state
 * GET  /api/system/telegram-debug  → Telegram config diagnostics
 * GET  /api/system/health          → all-services health snapshot
 * POST /api/system/test/telegram   → send a test Telegram message
 * POST /api/system/test/cron       → manually trigger one cron cycle
 * POST /api/system/test/affiliate  → verify affiliate link generation
 * POST /api/system/test/scraper    → verify scraper on a known URL
 */

const router   = require('express').Router();
const mongoose = require('mongoose');
const { state }         = require('../cronState');
const { getQueueStats } = require('../queue');
const telegram          = require('../../telegram');
const logger            = require('../../utils/logger');
const autoMode          = require('../autoMode');
const Deal              = require('../models/Deal');

// ── Helpers ───────────────────────────────────────────────────────────────────

function safeRequire(mod) {
  try { return require(mod); } catch { return null; }
}

function mongoStatus() {
  const states = { 0: 'disconnected', 1: 'connected', 2: 'connecting', 3: 'disconnecting' };
  return states[mongoose.connection.readyState] || 'unknown';
}

// ── Cron status ───────────────────────────────────────────────────────────────

router.get('/cron-status', (req, res) => {
  res.json({
    running: state.running,
    lastRun: state.lastRun,
    nextRun: state.nextRun,
    logs:    state.logs,
  });
});

// ── Telegram diagnostics ──────────────────────────────────────────────────────

router.get('/telegram-debug', (req, res) => {
  const token  = process.env.TELEGRAM_TOKEN || '';
  const chatId = process.env.TELEGRAM_CHAT  || '';

  const tokenMasked = token  ? `${token.slice(0, 8)}…` : '(not set)';
  const chatMasked  = chatId || '(not set)';

  const issues = [];
  if (!token)  issues.push('TELEGRAM_TOKEN is missing');
  if (!chatId) issues.push('TELEGRAM_CHAT is missing');
  if (chatId && !chatId.startsWith('-')) {
    issues.push('TELEGRAM_CHAT should start with "-" for groups/channels (e.g. -100xxxxxxxxxx)');
  }

  res.json({
    ok:     issues.length === 0,
    token:  tokenMasked,
    chatId: chatMasked,
    issues,
    hint: issues.length
      ? 'Fix the issues above in Render → Environment Variables, then redeploy.'
      : 'Configuration looks correct.',
  });
});

// ── All-services health snapshot ──────────────────────────────────────────────

router.get('/health', async (req, res) => {
  const token  = process.env.TELEGRAM_TOKEN || '';
  const chatId = process.env.TELEGRAM_CHAT  || '';
  const tgOk   = !!(token && chatId && chatId.startsWith('-'));

  // EarnKaro session status
  let ekStatus = null;
  try {
    const ek = safeRequire('../services/earnkaroSession');
    if (ek?.getSessionStatus) ekStatus = ek.getSessionStatus();
  } catch {}

  const queue = getQueueStats();
  const mongo = mongoStatus();

  res.json({
    timestamp: new Date().toISOString(),
    services: {
      mongodb:     { ok: mongo === 'connected', status: mongo },
      telegram:    { ok: tgOk, tokenSet: !!token, chatIdSet: !!chatId, chatIdValid: chatId.startsWith('-') },
      cron:        { ok: true, running: state.running, lastRun: state.lastRun, nextRun: state.nextRun },
      earnkaro:    { ok: ekStatus?.connected ?? false, connected: ekStatus?.connected ?? false, score: ekStatus?.healthScore ?? 0 },
      queue:       { ok: queue.pending < 50, pending: queue.pending, active: queue.active, processed: queue.processed },
      reelGen:     { ok: true },   // FFmpeg is static-binary — always available if installed
    },
  });
});

// ── Test: Telegram message ────────────────────────────────────────────────────

router.post('/test/telegram', async (req, res) => {
  const start = Date.now();
  try {
    const msg = `🧪 *Test message* from DealBot admin panel\n\n✅ Telegram is working correctly!\n🕐 ${new Date().toLocaleString('en-IN')}`;
    const result = await telegram.sendMessageToTelegram(msg);
    res.json({ ok: true, ms: Date.now() - start, result });
  } catch (err) {
    logger.error(`[System/test/telegram] ${err.message}`);
    res.status(200).json({ ok: false, ms: Date.now() - start, error: err.message });
  }
});

// ── Test: Cron cycle (manual trigger) ────────────────────────────────────────

router.post('/test/cron', async (req, res) => {
  if (state.running) {
    return res.json({ ok: false, error: 'Cron is already running — wait for it to finish' });
  }
  const start = Date.now();
  try {
    const crawler = safeRequire('../crawler');
    if (!crawler?.runCrawlCycle) throw new Error('Crawler module not available');

    // Fire-and-forget so the API responds immediately
    crawler.runCrawlCycle().catch((e) => logger.error(`[System/test/cron] ${e.message}`));

    res.json({ ok: true, ms: Date.now() - start, message: 'Cron cycle triggered — check Live Logs for progress' });
  } catch (err) {
    logger.error(`[System/test/cron] ${err.message}`);
    res.status(200).json({ ok: false, ms: Date.now() - start, error: err.message });
  }
});

// ── Test: Affiliate link generation ──────────────────────────────────────────

router.post('/test/affiliate', async (req, res) => {
  const start   = Date.now();
  // Use a well-known Amazon URL for the test
  const testUrl = req.body?.url || 'https://www.amazon.in/dp/B08L5TNJHG';
  try {
    const { generateAffiliateLink } = require('../affiliate');
    const link = await generateAffiliateLink(testUrl, 'amazon');
    const ok = !!link && link !== testUrl;
    res.json({ ok, ms: Date.now() - start, affiliateLink: link, testUrl });
  } catch (err) {
    logger.error(`[System/test/affiliate] ${err.message}`);
    res.status(200).json({ ok: false, ms: Date.now() - start, error: err.message, testUrl });
  }
});

// ── Test: EarnKaro link generation (debug mode) ───────────────────────────────

router.post('/test/earnkaro', async (req, res) => {
  const start   = Date.now();
  const testUrl = req.body?.url || 'https://www.flipkart.com/apple-iphone-15/p/itm6e3b26f4fbe54';
  try {
    const { debugConvert } = require('../services/earnkaro.service');
    const result = await debugConvert(testUrl, { maxRetries: 1 });
    res.json({
      ok:           result.success,
      ms:           Date.now() - start,
      affiliateLink: result.affiliateLink,
      originalUrl:  result.originalUrl,
      steps:        result.steps,
      stepDefs:     result.stepDefs,
      logs:         result.logs,
      progress:     result.progress,
      failedStep:   result.failedStep,
      error:        result.error,
    });
  } catch (err) {
    logger.error(`[System/test/earnkaro] ${err.message}`);
    res.status(200).json({ ok: false, ms: Date.now() - start, error: err.message });
  }
});

// ── Test: Scraper ─────────────────────────────────────────────────────────────

router.post('/test/scraper', async (req, res) => {
  const start   = Date.now();
  const testUrl = req.body?.url || 'https://www.amazon.in/dp/B08L5TNJHG';
  try {
    const { scrapeProduct } = require('../scraper');
    const product = await scrapeProduct(testUrl);
    const ok = !!(product?.title);
    res.json({ ok, ms: Date.now() - start, product: ok ? { title: product.title, price: product.price } : null, testUrl });
  } catch (err) {
    logger.error(`[System/test/scraper] ${err.message}`);
    res.status(200).json({ ok: false, ms: Date.now() - start, error: err.message, testUrl });
  }
});

// ── Auto Mode: GET state ──────────────────────────────────────────────────────

router.get('/auto-mode', (req, res) => {
  res.json({
    enabled:   autoMode.state.enabled,
    updatedAt: autoMode.state.updatedAt,
    updatedBy: autoMode.state.updatedBy,
  });
});

// ── Auto Mode: SET state ──────────────────────────────────────────────────────

router.post('/auto-mode', (req, res) => {
  const { enabled } = req.body;
  if (typeof enabled !== 'boolean') {
    return res.status(400).json({ error: 'enabled must be a boolean' });
  }
  autoMode.setAutoMode(enabled, 'admin');
  logger.info(`[AutoMode] ${enabled ? 'ENABLED' : 'DISABLED'} by admin`);
  res.json({
    enabled:   autoMode.state.enabled,
    updatedAt: autoMode.state.updatedAt,
    updatedBy: autoMode.state.updatedBy,
  });
});

// ── Retry: Telegram post for a single deal ────────────────────────────────────

router.post('/retry/:dealId/telegram', async (req, res) => {
  const start = Date.now();
  try {
    const deal = await Deal.findById(req.params.dealId).lean();
    if (!deal) return res.status(404).json({ ok: false, error: 'Deal not found' });

    const tg = require('../../telegram');
    const caption = tg.formatDealText(
      deal.title,
      deal.price,
      deal.affiliateLink || deal.link,
      deal.originalPrice,
      deal.discount,
      null,
      deal.platform,
    );
    await tg.sendToTelegram(deal.image, caption);

    await Deal.findByIdAndUpdate(deal._id, {
      posted:   true,
      postedAt: new Date(),
      'steps.telegram.done':  true,
      'steps.telegram.at':    new Date(),
      'steps.telegram.error': null,
    });

    res.json({ ok: true, ms: Date.now() - start });
  } catch (err) {
    logger.error(`[Retry/telegram] ${err.message}`);
    await Deal.findByIdAndUpdate(req.params.dealId, {
      'steps.telegram.done':  false,
      'steps.telegram.error': err.message,
    }).catch(() => {});
    res.status(200).json({ ok: false, ms: Date.now() - start, error: err.message });
  }
});

// ── Retry: Affiliate link for a single deal ───────────────────────────────────

router.post('/retry/:dealId/affiliate', async (req, res) => {
  const start = Date.now();
  try {
    const deal = await Deal.findById(req.params.dealId);
    if (!deal) return res.status(404).json({ ok: false, error: 'Deal not found' });

    const { generateAffiliateLink } = require('../affiliate');
    const link = await generateAffiliateLink(deal.link, deal.platform);

    deal.affiliateLink            = link;
    deal.steps.affiliate.done     = true;
    deal.steps.affiliate.at       = new Date();
    deal.steps.affiliate.error    = undefined;
    await deal.save();

    res.json({ ok: true, ms: Date.now() - start, affiliateLink: link });
  } catch (err) {
    logger.error(`[Retry/affiliate] ${err.message}`);
    await Deal.findByIdAndUpdate(req.params.dealId, {
      'steps.affiliate.done':  false,
      'steps.affiliate.error': err.message,
    }).catch(() => {});
    res.status(200).json({ ok: false, ms: Date.now() - start, error: err.message });
  }
});

module.exports = router;
