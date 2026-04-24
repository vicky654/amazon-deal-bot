'use strict';
/**
 * /api/debug/repost — live stats and control for the Telegram repost engine.
 *
 * GET  /api/debug/repost          → full diagnostic snapshot
 * POST /api/debug/repost/restart  → stop + start the engine without server restart
 */

const router = require('express').Router();
const logger = require('../../utils/logger');

function _repost() { return require('../repost'); }

// ── GET /api/debug/repost ─────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    if (process.env.REPOST_ENABLED !== 'true') {
      return res.json({
        enabled: false,
        message: 'Set REPOST_ENABLED=true in .env and restart to activate',
      });
    }

    const s = _repost().getStats();

    res.json({
      enabled: true,

      // ── Engine state ──────────────────────────────────────────────────────
      running:               s.running,
      testMode:              s.testMode,
      uptimeSeconds:         s.uptimeSeconds,
      startedAt:             s.startedAt,

      // ── Connection ────────────────────────────────────────────────────────
      telegramConnected:     s.clientState?.connected  ?? false,
      reconnectCount:        s.clientState?.reconnectCount ?? 0,
      lastConnectedAt:       s.clientState?.lastConnectedAt ?? null,
      clientLastError:       s.clientState?.lastError  ?? null,

      // ── Channels ──────────────────────────────────────────────────────────
      sourceChannels:        s.monitoredChannels,
      destinationChannel:    s.destinationChannel || process.env.TELEGRAM_CHAT,

      // ── Message traffic ───────────────────────────────────────────────────
      totalMessagesReceived: s.totalMessagesReceived,
      minutesSinceLastMessage: s.minutesSinceLastMessage,
      lastMessageAt:         s.lastMessageAt,

      // ── Repost counts ─────────────────────────────────────────────────────
      repostCount:           s.repostCount,
      duplicateCount:        s.duplicateCount,
      filteredCount:         s.filteredCount,
      errorCount:            s.errorCount,
      lastFilterReason:      s.lastFilterReason,
      lastRepostAt:          s.lastRepostAt,
      minutesSinceLastRepost: s.lastRepostAt
        ? Math.floor((Date.now() - new Date(s.lastRepostAt).getTime()) / 60000)
        : null,

      // ── Errors ────────────────────────────────────────────────────────────
      lastError:             s.lastError,

      // ── Active config ─────────────────────────────────────────────────────
      config: {
        sourceChannels:  process.env.REPOST_SOURCE_CHANNELS || '(not set)',
        destinationChat: process.env.TELEGRAM_CHAT,
        affiliateTag:    process.env.REPOST_AFFILIATE_TAG   || '(not set)',
        minDiscount:     process.env.REPOST_MIN_DISCOUNT    || '40',
        minSaving:       process.env.REPOST_MIN_SAVING      || '300',
        minPrice:        process.env.REPOST_MIN_PRICE       || '200',
        maxPrice:        process.env.REPOST_MAX_PRICE       || '50000',
        blockKeywords:   process.env.REPOST_BLOCK_KEYWORDS  || '(built-in defaults)',
        cooldownHours:   process.env.REPOST_COOLDOWN_HOURS  || '24',
      },
    });
  } catch (err) {
    logger.error(`[Debug/Repost] GET error: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/debug/repost/restart ────────────────────────────────────────────
router.post('/restart', async (req, res) => {
  try {
    if (process.env.REPOST_ENABLED !== 'true') {
      return res.status(400).json({ error: 'REPOST_ENABLED is not true' });
    }
    logger.info('[Debug/Repost] Restart triggered via API');
    setImmediate(() => _repost().restart().catch(err => {
      logger.error(`[Debug/Repost] Restart error: ${err.message}`);
    }));
    res.json({ ok: true, message: 'Repost engine restarting…' });
  } catch (err) {
    logger.error(`[Debug/Repost] POST /restart error: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
