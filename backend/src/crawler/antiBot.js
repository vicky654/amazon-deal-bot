'use strict';
/**
 * Anti-bot state — shared across extractor and crawler.
 *
 * Responsibilities:
 *   - Category blacklist with TTL (bot-wall / CAPTCHA / API 400 storm)
 *   - Hourly page request budget (prevents burst patterns)
 *   - Detection event recording + rolling stats
 *   - Bot-wall sleep deduplication (only one long sleep per detection window)
 */

const logger = require('../../utils/logger');

// ── Category blacklist ────────────────────────────────────────────────────────
// Maps categoryId → expiresAt (ms since epoch)
const _blacklist = new Map();

// ── Hourly page request budget ────────────────────────────────────────────────
const MAX_PAGES_PER_HOUR = parseInt(process.env.MAX_PAGES_PER_HOUR || '25', 10);
const _hourBucket = { count: 0, resetAt: Date.now() + 3_600_000 };

// ── Detection metrics (process-lifetime rolling counts) ───────────────────────
const stats = {
  okPages:           0,
  wrongLayout:       0,
  homepageRedirect:  0,
  botWall:           0,
  captcha:           0,
  api400:            0,
  blocked:           0,   // all other non-ok classes (ssl, network-error, exception…)
};

// ── Bot-wall sleep dedup ──────────────────────────────────────────────────────
// Prevents sleeping 10-20 min multiple times in the same detection window.
// A new sleep is allowed only after 45 min have passed since the last one.
let _lastBotWallSleepAt = 0;

// ── Per-cycle bot-wall flag ───────────────────────────────────────────────────
// Set true the moment a bot-wall is detected in the current cycle.
// The crawler checks this after each category and aborts the rest of the cycle,
// so the session gets a full rest + warm-up before trying any more categories.
let _botWallThisCycle = false;

// ── Blacklist API ─────────────────────────────────────────────────────────────

function isBlacklisted(categoryId) {
  const exp = _blacklist.get(categoryId);
  if (!exp) return false;
  if (Date.now() < exp) return true;
  _blacklist.delete(categoryId);
  return false;
}

function blacklistCategory(categoryId, durationMs) {
  // Default: 90–180 min, randomised to avoid predictable retry patterns
  const ms = durationMs ?? (90 + Math.floor(Math.random() * 90)) * 60_000;
  _blacklist.set(categoryId, Date.now() + ms);
  logger.warn(`[AntiBot] Category "${categoryId}" blacklisted for ${Math.round(ms / 60_000)} min`);
}

function getBlacklisted() {
  const now = Date.now();
  return [..._blacklist.entries()]
    .filter(([, exp]) => exp > now)
    .map(([id, exp]) => ({ id, expiresIn: `${Math.round((exp - now) / 60_000)}min` }));
}

// ── Page budget API ───────────────────────────────────────────────────────────

function budgetOk() {
  const now = Date.now();
  if (now >= _hourBucket.resetAt) {
    _hourBucket.count   = 0;
    _hourBucket.resetAt = now + 3_600_000;
    logger.info(`[AntiBot] Hourly page budget reset — limit: ${MAX_PAGES_PER_HOUR}/hr`);
  }
  return _hourBucket.count < MAX_PAGES_PER_HOUR;
}

function consumeBudget() { _hourBucket.count++; }

function budgetRemaining() {
  return Math.max(0, MAX_PAGES_PER_HOUR - _hourBucket.count);
}

// ── Detection recording ───────────────────────────────────────────────────────

function record(pageClass) {
  switch (pageClass) {
    case 'ok':                stats.okPages++;           break;
    case 'wrong-layout':      stats.wrongLayout++;       break;
    case 'homepage-redirect': stats.homepageRedirect++;  break;
    case 'bot-wall':          stats.botWall++;           break;
    case 'captcha':           stats.captcha++;           break;
    case 'api-400':           stats.api400++;            break;
    default:                  stats.blocked++;           break;
  }
}

// ── Per-cycle bot-wall helpers ────────────────────────────────────────────────

/** Called at the START of every crawl cycle to reset the per-cycle flag. */
function resetCycleState() {
  _botWallThisCycle = false;
}

/** Called by extractor when a bot-wall / captcha is detected on any page. */
function setBotWallThisCycle() {
  _botWallThisCycle = true;
}

/**
 * Returns true if a bot-wall was hit during the current cycle.
 * The crawler uses this to abort the category loop so the compromised session
 * gets a full rest + warm-up before any more categories are attempted.
 */
function isBotWallThisCycle() {
  return _botWallThisCycle;
}

// ── Bot-wall sleep dedup ──────────────────────────────────────────────────────

function shouldSleepForBotWall() {
  const now = Date.now();
  if (now - _lastBotWallSleepAt < 45 * 60_000) {
    logger.warn('[AntiBot] Bot-wall detected but already slept recently — skipping cooldown');
    return false;
  }
  _lastBotWallSleepAt = now;
  return true;
}

// ── Stats reporting ───────────────────────────────────────────────────────────

function logStats() {
  const total      = Object.values(stats).reduce((s, v) => s + v, 0);
  const detections = stats.wrongLayout + stats.homepageRedirect + stats.botWall + stats.captcha;
  const rate       = total ? (detections / total * 100).toFixed(1) : '0.0';
  logger.info(
    `[AntiBot] pages=${total} ok=${stats.okPages} wrong-layout=${stats.wrongLayout} ` +
    `homepage-redirect=${stats.homepageRedirect} bot-wall=${stats.botWall} captcha=${stats.captcha} ` +
    `api-400=${stats.api400} other-blocked=${stats.blocked} | detection-rate=${rate}% | ` +
    `budget=${_hourBucket.count}/${MAX_PAGES_PER_HOUR}/hr`
  );
}

module.exports = {
  isBlacklisted, blacklistCategory, getBlacklisted,
  budgetOk, consumeBudget, budgetRemaining,
  record, shouldSleepForBotWall, logStats, stats,
  resetCycleState, setBotWallThisCycle, isBotWallThisCycle,
};
