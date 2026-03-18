/**
 * EarnKaro Auto-Refresh Service
 *
 * Cron-based session refresh using in-memory credentials.
 *
 * Behaviour:
 *   - Skips if session is still healthy (age < COOKIE_HEALTHY_HOURS)
 *   - Skips with Telegram warning if no credentials are in memory (server restarted)
 *   - Sends Telegram alert on refresh failure
 *   - Prevents parallel refresh runs
 *
 * Default schedule: every 12 hours (0 *\/12 * * *)
 * Override via: EARNKARO_REFRESH_SCHEDULE env var
 */

const cron          = require('node-cron');
const sessionSvc    = require('./earnkaroSession');
const logger        = require('../../utils/logger');

const REFRESH_SCHEDULE = process.env.EARNKARO_REFRESH_SCHEDULE || '0 */12 * * *';

let _cronTask     = null;
let _isRefreshing = false;

// ── Telegram alert helper ─────────────────────────────────────────────────────

async function _alert(message) {
  try {
    const telegram = require('../../telegram');
    await telegram.sendAlert(message);
  } catch (_) {}
}

// ── Core refresh logic ────────────────────────────────────────────────────────

async function runRefresh() {
  if (_isRefreshing) {
    logger.warn('[EarnKaro][AutoRefresh] Refresh already running — skipping');
    return { skipped: true, reason: 'already_running' };
  }
  _isRefreshing = true;

  try {
    const health = await sessionSvc.getHealth();

    // Skip if healthy and not near expiry
    if (health.health === 'healthy' && health.cookieAgeHours < sessionSvc.COOKIE_HEALTHY_HOURS * 0.8) {
      const msg = `Session healthy (${health.cookieAgeHours}h old) — skipping refresh`;
      logger.info(`[EarnKaro][AutoRefresh] ${msg}`);
      await sessionSvc.addLog('refresh_skipped', 'info', msg, { ageHours: health.cookieAgeHours });
      return { skipped: true, reason: 'healthy' };
    }

    // Guard: need credentials
    const creds = sessionSvc.getCredentials();
    if (!creds) {
      const msg = 'No credentials in memory — cannot auto-refresh. Re-login via admin panel after server restart.';
      logger.warn(`[EarnKaro][AutoRefresh] ${msg}`);
      await sessionSvc.addLog('refresh_skipped', 'warn', msg);

      if (health.health !== 'healthy') {
        await _alert(`⚠️ EarnKaro session is *${health.health}* (${health.cookieAgeHours}h old).\nAuto-refresh unavailable — credentials not in memory.\nPlease re-login via Admin → Settings.`);
      }
      return { skipped: true, reason: 'no_credentials' };
    }

    // Perform refresh
    logger.info('[EarnKaro][AutoRefresh] Starting credential-based refresh...');
    await sessionSvc.addLog('refresh_start', 'info', 'Auto-refresh started', { trigger: 'cron' });

    const cookies = await sessionSvc.performLogin(creds.email, creds.password);
    await sessionSvc.saveSession(cookies, creds.email, 'auto');

    const msg = `Auto-refresh successful — ${cookies.length} cookies refreshed`;
    await sessionSvc.addLog('refresh_success', 'info', msg, { cookiesCount: cookies.length });
    return { success: true, cookiesCount: cookies.length };

  } catch (err) {
    const msg = `Auto-refresh failed: ${err.message}`;
    logger.error(`[EarnKaro][AutoRefresh] ${msg}`);
    await sessionSvc.addLog('refresh_failure', 'error', msg).catch(() => {});
    await _alert(`🔴 EarnKaro auto-refresh FAILED\n${err.message}\nPlease re-login manually via Admin → Settings.`);
    throw err;
  } finally {
    _isRefreshing = false;
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

function start() {
  if (_cronTask) return;

  if (!cron.validate(REFRESH_SCHEDULE)) {
    logger.error(`[EarnKaro][AutoRefresh] Invalid cron expression: ${REFRESH_SCHEDULE}`);
    return;
  }

  logger.info(`[EarnKaro][AutoRefresh] Scheduled: ${REFRESH_SCHEDULE}`);
  _cronTask = cron.schedule(REFRESH_SCHEDULE, () => {
    runRefresh().catch((err) => logger.error(`[EarnKaro][AutoRefresh] Uncaught: ${err.message}`));
  });
}

function stop() {
  if (_cronTask) { _cronTask.stop(); _cronTask = null; }
}

function isRunning() { return _isRefreshing; }

module.exports = { start, stop, runRefresh, isRunning };
