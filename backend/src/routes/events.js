/**
 * SSE Event Stream
 *
 * GET /api/events          → persistent SSE connection
 * GET /api/events/activity → last 50 activity entries (REST fallback)
 */

const router          = require('express').Router();
const { bus, getActivity } = require('../events/emitter');
const logger          = require('../../utils/logger');

let _clientCount = 0;

router.get('/', (req, res) => {
  res.setHeader('Content-Type',  'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection',    'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // disable nginx buffering on Render
  res.flushHeaders();

  _clientCount++;
  logger.debug(`[SSE] Client connected — total: ${_clientCount}`);

  // Send initial snapshot so the client gets history immediately
  const snapshot = JSON.stringify({
    event:     'connected',
    activity:  getActivity(),
    timestamp: new Date().toISOString(),
  });
  res.write(`data: ${snapshot}\n\n`);

  // Heartbeat every 25 s to keep the TCP connection alive through proxies
  const hb = setInterval(() => {
    try { res.write(':heartbeat\n\n'); } catch {}
  }, 25000);

  function onSSE(payload) {
    try {
      res.write(`data: ${JSON.stringify(payload)}\n\n`);
    } catch {}
  }

  bus.on('sse', onSSE);

  req.on('close', () => {
    _clientCount--;
    clearInterval(hb);
    bus.off('sse', onSSE);
    logger.debug(`[SSE] Client disconnected — total: ${_clientCount}`);
  });
});

router.get('/activity', (req, res) => {
  res.json({ success: true, activity: getActivity() });
});

module.exports = router;
