'use strict';
/**
 * Repost engine entry point.
 *
 * Pipeline per incoming Telegram message:
 *   listener → parser → linkResolver → filter → dedup → poster
 *
 * TEST_MODE=true  → bypass all quality filters, bypass Amazon-only gate.
 *                   Use to verify the send path works end-to-end.
 *
 * Completely independent from the Amazon crawler.
 * Crawler failures do NOT affect repost delivery.
 */

const { startListener }     = require('./listener');
const { parseMessage, extractTelegramText } = require('./parser');
const { resolveAmazonLink } = require('./linkResolver');
const { passesFilter }      = require('./filter');
const { isAlreadyReposted, markReposted } = require('./dedup');
const { repostDeal }        = require('./poster');
const { disconnect, isHealthy, state: clientState } = require('./client');
const logger   = require('../../utils/logger');
const telegram = require('../../telegram');

const TEST_MODE = process.env.TEST_MODE === 'true';

// ── Platform detector ─────────────────────────────────────────────────────────
function _detectPlatform(urls, rawText) {
  const hay = [...(urls || []), rawText || ''].join(' ').toLowerCase();
  if (/amazon\.in|amzn\.to|amzn\.in|a\.co\//.test(hay)) return 'Amazon';
  if (/flipkart\.com|fkrt\.it/.test(hay))                return 'Flipkart';
  if (/myntra\.com/.test(hay))                            return 'Myntra';
  if (/ajio\.com/.test(hay))                              return 'Ajio';
  if (/meesho\.com/.test(hay))                            return 'Meesho';
  return 'unknown';
}

// ── Runtime stats (exposed via /api/debug/repost) ─────────────────────────────
const stats = {
  startedAt:             null,
  monitoredChannels:     [],
  destinationChannel:    null,
  testMode:              TEST_MODE,
  totalMessagesReceived: 0,
  lastMessageAt:         null,
  lastRepostAt:          null,
  repostCount:           0,
  duplicateCount:        0,
  filteredCount:         0,
  errorCount:            0,
  lastFilterReason:      null,
  lastError:             null,
};

let _running       = false;
let _watchdogTimer = null;
let _restarting    = false; // guard against concurrent watchdog restarts

// ── Pipeline (Phases 4–9) ──────────────────────────────────────────────────────

async function pipeline(event, client) {
  console.log('[STEP 1] event received');

  // ── PHASE 5: URL extraction (via parseMessage) ────────────────────────────
  let parsed;
  try {
    parsed = await parseMessage(event, client);
  } catch (err) {
    console.error('[PIPELINE FAIL]', err);
    return;
  }

  if (!parsed) {
    console.log('RETURN REASON: parseMessage returned null — no message object');
    return;
  }

  const urls = parsed.allUrls || [];
  console.log('[URLS]', urls);

  if (urls.length === 0) {
    console.log('RETURN REASON: no urls extracted');
    stats.filteredCount++;
    stats.lastFilterReason = 'no-urls';
    return;
  }

  // ── PHASE 6: ASIN resolution ──────────────────────────────────────────────
  console.log('[ASIN] resolving...');
  let resolved;
  try {
    resolved = await resolveAmazonLink(urls);
  } catch (err) {
    console.error('[PIPELINE FAIL]', err);
    return;
  }

  if (!resolved) {
    console.log('RETURN REASON: asin resolution failed — urls were:', urls);
    stats.filteredCount++;
    stats.lastFilterReason = 'no-valid-amazon-link';
    return;
  }

  console.log('[ASIN] resolved:', resolved.asin);

  if (!/^[A-Z0-9]{10}$/.test(resolved.asin)) {
    console.log('RETURN REASON: asin resolution failed — bad format:', resolved.asin);
    stats.filteredCount++;
    stats.lastFilterReason = `invalid-asin:${resolved.asin}`;
    return;
  }

  // ── Build deal object ─────────────────────────────────────────────────────
  const chatId = event.message?.peerId?.channelId?.toString?.() || 'unknown';
  const msgId  = event.message?.id || 'unknown';
  const deal = {
    ...parsed,
    asin:          resolved.asin,
    affiliateUrl:  resolved.affiliateUrl,
    originalUrl:   resolved.originalUrl,
    sourceChannel: chatId,
  };
  console.log('[STEP 6] product resolved — title:', (deal.title || 'n/a').slice(0, 60),
    '| price:', deal.dealPrice, '| disc:', deal.discount);

  // ── PHASE 7: Quality filter ───────────────────────────────────────────────
  console.log('[FILTER] checking quality');
  let filterResult;
  try {
    filterResult = passesFilter(deal);
  } catch (err) {
    console.error('[PIPELINE FAIL]', err);
    return;
  }

  const { pass, reason } = filterResult;
  console.log('[FILTER RESULT]:', pass, reason || '');
  if (!pass) {
    console.log('RETURN REASON: quality filter failed —', reason);
    stats.filteredCount++;
    stats.lastFilterReason = reason;
    return;
  }

  // ── PHASE 8: Duplicate check ──────────────────────────────────────────────
  console.log('[DUPLICATE] checking');
  let isDup;
  try {
    isDup = await isAlreadyReposted(deal.asin, deal.affiliateUrl, deal.title);
  } catch (err) {
    console.error('[PIPELINE FAIL]', err);
    return;
  }

  console.log('[DUPLICATE RESULT]:', isDup);
  if (isDup) {
    console.log('RETURN REASON: duplicate repost — ASIN:', deal.asin);
    stats.duplicateCount++;
    return;
  }

  // ── PHASE 9: Telegram send ────────────────────────────────────────────────
  console.log('[SEND] posting to telegram — ASIN:', deal.asin);
  stats.totalMessagesReceived++;
  stats.lastMessageAt = new Date().toISOString();
  try {
    await repostDeal(deal);
    await markReposted(deal.asin, deal.affiliateUrl, deal.title, deal.sourceChannel);
    stats.repostCount++;
    stats.lastRepostAt = new Date().toISOString();
    console.log('[SEND SUCCESS]', deal.asin);
  } catch (postErr) {
    stats.errorCount++;
    stats.lastError = postErr.message;
    console.error('[SEND FAIL]', postErr);
  }
}

// ── Reconnect watchdog ────────────────────────────────────────────────────────

const WATCHDOG_MS = 5 * 60 * 1000;

async function _runWatchdog() {
  if (!_running) return;
  if (_restarting) { logger.debug('[Repost] Watchdog: restart already in progress — skipping tick'); return; }

  const healthy = await isHealthy();
  if (healthy) { logger.debug('[Repost] Watchdog: connection healthy'); return; }

  _restarting = true;
  stats.errorCount++;
  stats.lastError = 'watchdog: connection lost';
  logger.warn('[Repost] Watchdog: Telegram connection lost — restarting listener…');

  try {
    try { await disconnect(); } catch (_) {}
    await new Promise(r => setTimeout(r, 5000));

    const channels = await startListener(pipeline);
    stats.monitoredChannels = channels || [];
    logger.info('[Repost] Watchdog: ✅ listener restarted');
  } catch (err) {
    stats.lastError = err.message;
    logger.error(`[Repost] Watchdog: restart failed: ${err.message}`);
  } finally {
    _restarting = false;
  }
}

// ── Start / stop ──────────────────────────────────────────────────────────────

async function start() {
  if (_running) { logger.warn('[Repost] Already running — ignoring start()'); return; }

  const destChannel = process.env.TELEGRAM_CHAT || process.env.REPOST_OUTPUT_CHANNEL;

  logger.info('[Repost] ════════════════════════════════════════════');
  logger.info('[Repost] Starting Telegram repost engine…');
  logger.info(`[Repost] 🎯 Destination channel : TELEGRAM_CHAT=${destChannel}`);
  logger.info(`[Repost] 🔍 TEST_MODE            : ${TEST_MODE ? 'ON — all quality filters bypassed' : 'OFF — real filters active'}`);
  logger.info(`[Repost] 🏷 Affiliate tag         : ${process.env.REPOST_AFFILIATE_TAG || 'dailydeal06f0-21'}`);
  logger.info(`[Repost] 📡 Source channels       : ${process.env.REPOST_SOURCE_CHANNELS || '(none)'}`);
  logger.info('[Repost] ════════════════════════════════════════════');

  stats.startedAt          = new Date().toISOString();
  stats.destinationChannel = destChannel;
  stats.testMode           = TEST_MODE;

  try {
    const channels = await startListener(pipeline);
    stats.monitoredChannels = channels || [];
    _running = true;
    _watchdogTimer = setInterval(_runWatchdog, WATCHDOG_MS);

    logger.info(`[Repost] ✅ Engine running — monitoring: ${(channels || []).map(c => `@${c}`).join(', ')}`);

    // ── Startup test message — confirms bot can post to the channel ───────
    try {
      await telegram.sendMessageToTelegram(
        `✅ <b>Repost engine connected</b>\n` +
        `📡 Monitoring: <code>${(channels || []).map(c => `@${c}`).join(', ')}</code>\n` +
        `🎯 Channel: <code>${destChannel}</code>\n` +
        `🔍 TEST_MODE: <b>${TEST_MODE ? 'ON' : 'OFF'}</b>`,
        { parse_mode: 'HTML' }
      );
      logger.info(`[Repost] ✅ Startup test message delivered to ${destChannel}`);
    } catch (testMsgErr) {
      logger.error(`[Repost] ❌ Startup test message FAILED: ${testMsgErr.message}`);
      logger.error(`[Repost]    → Check: is the bot an admin in channel ${destChannel}?`);
      logger.error(`[Repost]    → Check: is TELEGRAM_CHAT set correctly in .env?`);
      logger.error(`[Repost]    → Check: is TELEGRAM_TOKEN valid?`);
    }
  } catch (err) {
    stats.lastError = err.message;
    logger.error(`[Repost] ❌ Failed to start: ${err.message}`);
    logger.error('[Repost] → Run: node tools/telegram-login.js  to authenticate');
  }
}

async function stop() {
  if (!_running) return;
  _running = false;
  if (_watchdogTimer) { clearInterval(_watchdogTimer); _watchdogTimer = null; }
  await disconnect();
  logger.info('[Repost] Repost engine stopped');
}

async function restart() {
  logger.info('[Repost] Restart requested…');
  await stop();
  await new Promise(r => setTimeout(r, 2000));
  await start();
}

function getStats() {
  const uptime = stats.startedAt
    ? Math.floor((Date.now() - new Date(stats.startedAt).getTime()) / 1000)
    : 0;
  const minsSinceMsg = stats.lastMessageAt
    ? Math.floor((Date.now() - new Date(stats.lastMessageAt).getTime()) / 60000)
    : null;
  return {
    ...stats,
    running:                _running,
    uptimeSeconds:          uptime,
    minutesSinceLastMessage: minsSinceMsg,
    clientState,
  };
}

module.exports = { start, stop, restart, getStats };
