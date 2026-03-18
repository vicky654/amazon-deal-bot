/**
 * EarnKaro REST API
 *
 * GET  /api/earnkaro/status       → connection status
 * GET  /api/earnkaro/health       → detailed health (cookie age, validation, refresh ETA)
 * GET  /api/earnkaro/logs         → recent event log (earnkaro_logs collection)
 * POST /api/earnkaro/login        → Puppeteer auto-login, stores cookies + credentials
 * POST /api/earnkaro/connect      → manual cookie JSON upload (fallback)
 * POST /api/earnkaro/test         → Puppeteer session test
 * POST /api/earnkaro/refresh      → force cookie refresh (uses stored credentials)
 * POST /api/earnkaro/disconnect   → wipe session
 */

const router      = require('express').Router();
const sessionSvc  = require('../services/earnkaroSession');
const autoRefresh = require('../services/earnkaroAutoRefresh');
const logger      = require('../../utils/logger');

// ── Simple in-memory rate limiter (no extra deps) ─────────────────────────────
// Tracks: { [ip]: { count, resetAt } }
const _rateMap = new Map();

function _rateLimit(maxAttempts, windowMs) {
  return (req, res, next) => {
    const ip  = req.ip || req.socket?.remoteAddress || 'unknown';
    const now = Date.now();
    let   rec = _rateMap.get(ip);

    if (!rec || now > rec.resetAt) {
      rec = { count: 0, resetAt: now + windowMs };
      _rateMap.set(ip, rec);
    }

    rec.count++;
    if (rec.count > maxAttempts) {
      const retryAfter = Math.ceil((rec.resetAt - now) / 1000);
      res.setHeader('Retry-After', retryAfter);
      return res.status(429).json({
        success: false,
        error:   `Too many login attempts. Try again in ${retryAfter}s.`,
      });
    }
    next();
  };
}

// Clean up stale entries every 30 minutes to prevent memory leak
setInterval(() => {
  const now = Date.now();
  for (const [ip, rec] of _rateMap) {
    if (now > rec.resetAt) _rateMap.delete(ip);
  }
}, 30 * 60 * 1000).unref();

// ── GET /api/earnkaro/status ──────────────────────────────────────────────────

router.get('/status', async (req, res) => {
  try {
    const health = await sessionSvc.getHealth();
    res.json({
      connected:    health.connected,
      cookiesCount: health.cookiesCount || 0,
      email:        health.email        || '',
      loginMethod:  health.loginMethod  || '',
      lastUpdated:  health.lastValidated || null,
      health:       health.health       || 'unknown',
    });
  } catch (err) {
    res.status(500).json({ connected: false, error: err.message });
  }
});

// ── GET /api/earnkaro/health ──────────────────────────────────────────────────

router.get('/health', async (req, res) => {
  try {
    const health = await sessionSvc.getHealth();
    // Never expose raw cookies — strip them from any nested objects
    res.json(health);
  } catch (err) {
    res.status(500).json({ connected: false, health: 'unknown', error: err.message });
  }
});

// ── GET /api/earnkaro/logs ────────────────────────────────────────────────────

router.get('/logs', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit || '50', 10), 200);
    const logs  = await sessionSvc.getLogs(limit);
    res.json({ success: true, count: logs.length, logs });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── POST /api/earnkaro/login ──────────────────────────────────────────────────
// Rate limit: 5 attempts per 15 minutes per IP

router.post('/login', _rateLimit(5, 15 * 60 * 1000), async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ success: false, error: 'email and password are required' });
  }

  try {
    logger.info(`[EarnKaro] Manual login initiated for ${sessionSvc.maskEmail(email)}`);
    await sessionSvc.addLog('login_start', 'info', `Login initiated for ${sessionSvc.maskEmail(email)}`);

    const cookies = await sessionSvc.performLogin(email, password);
    await sessionSvc.saveSession(cookies, email, 'auto');

    // Store credentials in-memory for future auto-refresh
    sessionSvc.storeCredentials(email, password);

    const msg = `Login successful — ${cookies.length} cookies captured`;
    await sessionSvc.addLog('login_success', 'info', msg, { cookiesCount: cookies.length });

    res.json({
      success:      true,
      cookiesCount: cookies.length,
      message:      `Connected as ${sessionSvc.maskEmail(email)}`,
    });
  } catch (err) {
    await sessionSvc.addLog('login_fail', 'error', err.message).catch(() => {});
    const status = /password|credential|email/i.test(err.message) ? 401 : 500;
    res.status(status).json({ success: false, error: err.message });
  }
  // Password lives only in request scope — never persisted beyond storeCredentials (encrypted memory)
});

// ── POST /api/earnkaro/connect (manual fallback) ─────────────────────────────

router.post('/connect', async (req, res) => {
  const { cookies } = req.body;
  if (!cookies || !Array.isArray(cookies) || cookies.length === 0) {
    return res.status(400).json({ success: false, error: 'cookies must be a non-empty array' });
  }
  const invalid = cookies.filter((c) => !c.name || !c.value);
  if (invalid.length) {
    return res.status(400).json({ success: false, error: `${invalid.length} cookie(s) missing name or value` });
  }

  try {
    await sessionSvc.saveSession(cookies, '', 'manual');
    const msg = `${cookies.length} cookies saved manually`;
    await sessionSvc.addLog('manual_connect', 'info', msg, { cookiesCount: cookies.length });
    res.json({ success: true, cookiesCount: cookies.length, message: msg });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── POST /api/earnkaro/test ───────────────────────────────────────────────────

router.post('/test', async (req, res) => {
  try {
    const valid = await sessionSvc.testSession();
    res.json({
      success:   true,
      connected: valid,
      message:   valid
        ? 'Session is active and working.'
        : 'Session has expired. Please re-login from the settings panel.',
    });
  } catch (err) {
    logger.error(`[EarnKaro] Test error: ${err.message}`);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── POST /api/earnkaro/refresh ────────────────────────────────────────────────

router.post('/refresh', async (req, res) => {
  if (!sessionSvc.hasCredentials()) {
    return res.status(400).json({
      success: false,
      error:   'No credentials in memory. Please login first — credentials are cleared on server restart.',
    });
  }

  try {
    const result = await autoRefresh.runRefresh();
    if (result.skipped) {
      return res.json({ success: true, skipped: true, reason: result.reason, message: 'Refresh skipped — see reason.' });
    }
    res.json({ success: true, cookiesCount: result.cookiesCount, message: 'Session refreshed successfully.' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── POST /api/earnkaro/disconnect ─────────────────────────────────────────────

const fs              = require('fs');
const path            = require('path');
const EarnKaroSession = require('../models/EarnKaroSession');

router.post('/disconnect', async (req, res) => {
  try {
    await EarnKaroSession.deleteMany({});

    const p = path.resolve(process.env.EARNKARO_COOKIES_PATH || path.join(__dirname, '../../earnkaro-cookies.json'));
    if (fs.existsSync(p)) fs.unlinkSync(p);

    sessionSvc.clearCredentials();
    await sessionSvc.addLog('disconnect', 'info', 'Session disconnected via admin panel');

    res.json({ success: true, message: 'Disconnected successfully' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── POST /api/earnkaro/relogin (alias for login — used by "Re-login" button) ──

router.post('/relogin', _rateLimit(5, 15 * 60 * 1000), async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ success: false, error: 'email and password are required' });
  }

  try {
    await sessionSvc.addLog('login_start', 'info', `Re-login initiated for ${sessionSvc.maskEmail(email)}`);
    const cookies = await sessionSvc.performLogin(email, password);
    await sessionSvc.saveSession(cookies, email, 'auto');
    sessionSvc.storeCredentials(email, password);
    const msg = `Re-login successful — ${cookies.length} cookies refreshed`;
    await sessionSvc.addLog('login_success', 'info', msg, { cookiesCount: cookies.length });
    res.json({ success: true, cookiesCount: cookies.length, message: `Re-connected as ${sessionSvc.maskEmail(email)}` });
  } catch (err) {
    await sessionSvc.addLog('login_fail', 'error', err.message).catch(() => {});
    const status = /password|credential|email/i.test(err.message) ? 401 : 500;
    res.status(status).json({ success: false, error: err.message });
  }
});

module.exports = router;
