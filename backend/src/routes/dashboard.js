/**
 * Dashboard API
 *
 * GET /api/dashboard — aggregated stats for the admin home page
 * Protected by JWT middleware.
 */

const router     = require('express').Router();
const mongoose   = require('mongoose');
const Deal       = require('../models/Deal');
const { state: cronState }  = require('../cronState');
const { getQueueStats }     = require('../queue');
const autoMode              = require('../autoMode');
const logger                = require('../../utils/logger');

function safeRequire(mod) {
  try { return require(mod); } catch { return null; }
}

function mongoStatus() {
  const states = { 0: 'disconnected', 1: 'connected', 2: 'connecting', 3: 'disconnecting' };
  return states[mongoose.connection.readyState] || 'unknown';
}

router.get('/', async (req, res) => {
  try {
    const [aggResult, topDeals, recentDeals] = await Promise.all([
      // ── Aggregate totals ──────────────────────────────────────────────────
      Deal.aggregate([
        {
          $group: {
            _id:         null,
            totalClicks: { $sum: '$clicks' },
            totalDeals:  { $sum: 1 },
            postedDeals: { $sum: { $cond: ['$posted', 1, 0] } },
            avgScore:    { $avg: '$score' },
          },
        },
      ]),

      // ── Top 5 by clicks ───────────────────────────────────────────────────
      Deal.find({ clicks: { $gt: 0 } })
        .sort({ clicks: -1 })
        .limit(5)
        .select('title clicks score posted platform price discount image')
        .lean(),

      // ── Recent 5 deals ────────────────────────────────────────────────────
      Deal.find()
        .sort({ createdAt: -1 })
        .limit(5)
        .select('title price discount platform score posted postedAt createdAt steps')
        .lean(),
    ]);

    const agg = aggResult[0] || { totalClicks: 0, totalDeals: 0, postedDeals: 0, avgScore: 0 };

    // ── System status snapshot ─────────────────────────────────────────────
    const token  = process.env.TELEGRAM_TOKEN || '';
    const chatId = process.env.TELEGRAM_CHAT  || '';
    const tgOk   = !!(token && chatId && chatId.startsWith('-'));

    let ekStatus = null;
    try {
      const ek = safeRequire('../services/earnkaroSession');
      if (ek?.getSessionStatus) ekStatus = ek.getSessionStatus();
    } catch {}

    const queue = getQueueStats();
    const mongo = mongoStatus();

    res.json({
      // Overview numbers
      totalClicks: agg.totalClicks,
      totalDeals:  agg.totalDeals,
      postedDeals: agg.postedDeals,
      avgScore:    Math.round(agg.avgScore || 0),

      // Top deals by clicks
      topDeals,

      // System health
      systemStatus: {
        mongodb:   { ok: mongo === 'connected', status: mongo },
        telegram:  { ok: tgOk },
        earnkaro:  { ok: ekStatus?.connected ?? false, score: ekStatus?.healthScore ?? 0 },
        cron:      { ok: true, running: cronState.running, lastRun: cronState.lastRun, nextRun: cronState.nextRun },
        queue:     { pending: queue.pending, active: queue.active, processed: queue.processed, ok: queue.pending < 50 },
      },

      // Auto mode
      autoMode: {
        enabled:   autoMode.state.enabled,
        updatedAt: autoMode.state.updatedAt,
      },

      // Recent activity
      recentDeals,

      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    logger.error(`[Dashboard] ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
