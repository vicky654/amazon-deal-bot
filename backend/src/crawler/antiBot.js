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
  okPages:     0,
  wrongLayout: 0,
  botWall:     0,
  captcha:     0,
  api400:      0,
  blocked:     0,   // all other non-ok classes (ssl, network-error, exception…)
};

// ── Bot-wall sleep dedup ──────────────────────────────────────────────────────
// Prevents sleeping 10-20 min multiple times in the same detection window.
// A new sleep is allowed only after 25 min have passed since the last one.
let _lastBotWallSleepAt = 0;

// ── Blacklist API ─────────────────────────────────────────────────────────────

function isBlacklisted(categoryId) {
  const exp = _blacklist.get(categoryId);
  if (!exp) return false;
  if (Date.now() < exp) return true;
  _blacklist.delete(categoryId);
  return false;
}

function blacklistCategory(categoryId, durationMs) {
  // Default: 60–120 min, randomised to avoid predictable retry patterns
  const ms = durationMs ?? (60 + Math.floor(Math.random() * 60)) * 60_000;
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
    case 'ok':           stats.okPages++;     break;
    case 'wrong-layout': stats.wrongLayout++; break;
    case 'bot-wall':     stats.botWall++;     break;
    case 'captcha':      stats.captcha++;     break;
    case 'api-400':      stats.api400++;      break;
    default:             stats.blocked++;     break;
  }
}

// ── Bot-wall sleep dedup ──────────────────────────────────────────────────────

function shouldSleepForBotWall() {
  const now = Date.now();
  if (now - _lastBotWallSleepAt < 25 * 60_000) {
    logger.warn('[AntiBot] Bot-wall detected but already slept recently — skipping cooldown');
    return false;
  }
  _lastBotWallSleepAt = now;
  return true;
}

// ── Stats reporting ───────────────────────────────────────────────────────────

function logStats() {
  const total      = Object.values(stats).reduce((s, v) => s + v, 0);
  const detections = stats.botWall + stats.captcha;
  const rate       = total ? (detections / total * 100).toFixed(1) : '0.0';
  logger.info(
    `[AntiBot] pages=${total} ok=${stats.okPages} wrong-layout=${stats.wrongLayout} ` +
    `bot-wall=${stats.botWall} captcha=${stats.captcha} api-400=${stats.api400} ` +
    `other-blocked=${stats.blocked} | detection-rate=${rate}% | ` +
    `budget=${_hourBucket.count}/${MAX_PAGES_PER_HOUR}/hr`
  );
}

module.exports = {
  isBlacklisted, blacklistCategory, getBlacklisted,
  budgetOk, consumeBudget, budgetRemaining,
  record, shouldSleepForBotWall, logStats, stats,
};
