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
const { parseMessage }      = require('./parser');
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

// ── Pipeline ──────────────────────────────────────────────────────────────────

async function pipeline(event, client) {
  const message = event.message;
  if (!message) return;

  // ── Immediate intake log — fires for EVERY message ────────────────────────
  const msgId    = message.id;
  const rawText  = message.message || '';
  const chatId   = event.message?.peerId?.channelId?.toString?.() || 'unknown';
  const preview  = rawText.slice(0, 120).replace(/\n/g, ' ');

  stats.totalMessagesReceived++;
  stats.lastMessageAt = new Date().toISOString();

  logger.info(`[Repost] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  logger.info(`[Repost] 📨 Message #${msgId} from channel=${chatId}`);
  logger.info(`[Repost] Text: "${preview}"`);

  // ── Step 1: Parse ─────────────────────────────────────────────────────────
  const parsed = await parseMessage(event, client);
  if (!parsed) {
    logger.info(`[Repost] SKIP msg=${msgId}: parser returned null (empty/non-text message)`);
    return;
  }

  const platform = _detectPlatform(parsed.allUrls, rawText);
  logger.info(`[Repost] Platform: ${platform} | URLs: ${parsed.allUrls.length} | Media: ${!!parsed.mediaBuffer}`);
  if (parsed.allUrls.length > 0) {
    logger.info(`[Repost] URLs: ${parsed.allUrls.join(', ')}`);
  }
  logger.info(`[Repost] Parsed — title="${(parsed.title || 'null').slice(0, 60)}" price=₹${parsed.dealPrice} disc=${parsed.discount}%`);

  // ── Step 2: Resolve + validate Amazon link ───────────────────────────────
  // This gate is ALWAYS enforced regardless of TEST_MODE.
  // TEST_MODE only bypasses quality filters (price/discount thresholds).
  // A real, validated ASIN is required before any message is posted.
  const resolved = await resolveAmazonLink(parsed.allUrls);

  if (!resolved) {
    logger.info(`[Repost] SKIP msg=${msgId}: no valid Amazon product link found (platform=${platform})`);
    stats.filteredCount++;
    stats.lastFilterReason = 'no-valid-amazon-link';
    return;
  }

  // Sanity-check the resolved ASIN format
  if (!/^[A-Z0-9]{10}$/.test(resolved.asin)) {
    logger.warn(`[Repost] SKIP msg=${msgId}: invalid ASIN format "${resolved.asin}"`);
    stats.filteredCount++;
    stats.lastFilterReason = `invalid-asin:${resolved.asin}`;
    return;
  }

  logger.info(`[Repost] ✅ Amazon link validated → ASIN=${resolved.asin} url=${resolved.affiliateUrl}`);

  const deal = {
    ...parsed,
    asin:          resolved.asin,
    affiliateUrl:  resolved.affiliateUrl,
    originalUrl:   resolved.originalUrl,
    sourceChannel: chatId,
  };

  // ── Step 3: Quality filter ────────────────────────────────────────────────
  const { pass, reason } = passesFilter(deal);
  if (!pass) {
    logger.info(`[Repost] SKIP msg=${msgId}: filter rejected [${reason}]`);
    stats.filteredCount++;
    stats.lastFilterReason = reason;
    return;
  }
  logger.info(`[Repost] Filter: ${TEST_MODE ? 'BYPASSED (TEST_MODE)' : 'PASSED ✅'}`);

  // ── Step 4: Duplicate check ───────────────────────────────────────────────
  const isDup = await isAlreadyReposted(deal.asin, deal.affiliateUrl, deal.title);
  if (isDup) {
    logger.info(`[Repost] SKIP msg=${msgId}: duplicate ASIN=${deal.asin}`);
    stats.duplicateCount++;
    return;
  }
  logger.info(`[Repost] Duplicate check: not a duplicate ✅`);

  // ── Step 5: Post ──────────────────────────────────────────────────────────
  logger.info(`[Repost] 🚀 Sending to channel — ASIN=${deal.asin} title="${(deal.title || '').slice(0, 55)}"`);
  try {
    await repostDeal(deal);
    await markReposted(deal.asin, deal.affiliateUrl, deal.title, deal.sourceChannel);
    stats.repostCount++;
    stats.lastRepostAt = new Date().toISOString();
    logger.info(`[Repost] ✅ DELIVERED msg=${msgId} ASIN=${deal.asin} disc=${deal.discount}% ₹${deal.dealPrice}`);
  } catch (postErr) {
    stats.errorCount++;
    stats.lastError = postErr.message;
    logger.error(`[Repost] ❌ Delivery FAILED msg=${msgId} ASIN=${deal.asin}: ${postErr.message}`);
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
