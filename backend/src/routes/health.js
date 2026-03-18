/**
 * Health + Metrics Routes
 *
 * GET /health   → Liveness check (uptime, DB status)
 * GET /metrics  → Performance counters, histograms, queue depths
 */

const router    = require('express').Router();
const mongoose  = require('mongoose');
const metrics   = require('../utils/metrics');
const { getQueueStats } = require('../queue');
const { closeBrowser }  = require('../scraper/browser');

const startedAt = Date.now();

router.get('/health', (req, res) => {
  const dbState = ['disconnected', 'connected', 'connecting', 'disconnecting'];
  const dbStatus = dbState[mongoose.connection.readyState] || 'unknown';

  const healthy = mongoose.connection.readyState === 1;

  res.status(healthy ? 200 : 503).json({
    status:    healthy ? 'ok' : 'degraded',
    uptime_s:  Math.floor((Date.now() - startedAt) / 1000),
    timestamp: new Date().toISOString(),
    db:        dbStatus,
    queues:    getQueueStats(),
  });
});

router.get('/metrics', (req, res) => {
  res.json({
    timestamp: new Date().toISOString(),
    ...metrics.snapshot(),
    queues: getQueueStats(),
  });
});

module.exports = router;
