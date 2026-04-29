'use strict';
/**
 * End-to-end Telegram pipeline test.
 *
 * Sends a clearly-labelled test deal through the REAL posting path:
 *   formatDealText() → sendToTelegram() → _tgSendChain → _sendCore()
 *   → bot.sendPhoto (with URL image) → inline button
 *
 * Run:  node tools/test-pipeline.js
 *
 * Exits 0 on success, 1 on failure.
 */

require('dotenv').config();

const telegram = require('../telegram');
const logger   = require('../utils/logger');

// ── Test deal payload ─────────────────────────────────────────────────────────
// Uses a real Amazon product so the image URL is reliably fetchable by Telegram.
const TEST_DEAL = {
  title:         'boAt Rockerz 450 Bluetooth On Ear Headphones with Mic',
  price:         999,
  originalPrice: 2990,
  discount:      67,
  asin:          'B08FKW96T1',
  image:         'https://m.media-amazon.com/images/I/61t4qRfbVnL._SL1500_.jpg',
  affiliateLink: 'https://www.amazon.in/dp/B08FKW96T1?tag=dailydeal06f0-21',
};

// ── Main ──────────────────────────────────────────────────────────────────────

async function runTest() {
  logger.info('════════════════════════════════════════════════════════════');
  logger.info('[TEST] 🧪 END-TO-END TELEGRAM PIPELINE TEST STARTING');
  logger.info('════════════════════════════════════════════════════════════');

  // ── Step 1: Environment validation ───────────────────────────────────────
  const token  = process.env.TELEGRAM_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT;
  logger.info(`[TEST] TELEGRAM_TOKEN : ${token  ? token.slice(0, 10) + '…' : '❌ NOT SET'}`);
  logger.info(`[TEST] TELEGRAM_CHAT  : ${chatId || '❌ NOT SET'}`);
  if (!token || !chatId) {
    logger.error('[TEST] ❌ ABORT — TELEGRAM_TOKEN or TELEGRAM_CHAT missing in .env');
    process.exit(1);
  }

  // ── Step 2: Deal created ──────────────────────────────────────────────────
  logger.info('[TEST] ─────────────────────────────────────────');
  logger.info('[TEST] Deal created:');
  logger.info(`[TEST]   Title    : ${TEST_DEAL.title}`);
  logger.info(`[TEST]   Price    : ₹${TEST_DEAL.price}`);
  logger.info(`[TEST]   Original : ₹${TEST_DEAL.originalPrice}`);
  logger.info(`[TEST]   Discount : ${TEST_DEAL.discount}%`);
  logger.info(`[TEST]   ASIN     : ${TEST_DEAL.asin}`);
  logger.info(`[TEST]   Image    : ${TEST_DEAL.image}`);
  logger.info(`[TEST]   Link     : ${TEST_DEAL.affiliateLink}`);

  // ── Step 3: Build caption via real formatter ──────────────────────────────
  logger.info('[TEST] ─────────────────────────────────────────');
  logger.info('[TEST] Building caption via telegram.formatDealText()…');

  const realCaption = telegram.formatDealText(
    TEST_DEAL.title,
    TEST_DEAL.price,
    TEST_DEAL.affiliateLink,
    TEST_DEAL.originalPrice,
    TEST_DEAL.discount,
    '🛒',
    'amazon',
  );

  // Prepend the test label so the message is clearly identifiable in the group
  const testLabel = '🧪 <b>TEST DEAL DELIVERY</b>\n<i>This is a pipeline test message.</i>\n\n';
  const caption   = testLabel + realCaption;

  logger.info(`[TEST] Caption generated — ${caption.length} chars`);
  logger.info('[TEST] Caption preview:');
  caption.split('\n').forEach((line) => logger.info(`[TEST]   ${line}`));

  // ── Step 4: Queue the send through the real _tgSendChain ─────────────────
  logger.info('[TEST] ─────────────────────────────────────────');
  logger.info('[TEST] Queuing send via telegram.sendToTelegram()…');
  logger.info(`[TEST] Image URL : ${TEST_DEAL.image}`);
  logger.info(`[TEST] Buy Link  : ${TEST_DEAL.affiliateLink}`);
  logger.info('[TEST] → Entering _tgSendChain (2–5 s pre-send delay applies)…');

  const startMs = Date.now();

  let result;
  try {
    result = await telegram.sendToTelegram(
      TEST_DEAL.image,
      caption,
      TEST_DEAL.affiliateLink,
    );
  } catch (err) {
    const errBody = err.response?.body ?? err.response ?? '';
    logger.error('[TEST] ════════════════════════════════════════════════════════════');
    logger.error('[TEST] ❌ TELEGRAM SEND FAILED');
    logger.error(`[TEST]   Error   : ${err.message}`);
    logger.error(`[TEST]   Response: ${JSON.stringify(errBody)}`);
    logger.error('[TEST] ════════════════════════════════════════════════════════════');
    process.exit(1);
  }

  const elapsedMs = Date.now() - startMs;

  // ── Step 5: Parse and log Telegram response ───────────────────────────────
  logger.info('[TEST] ─────────────────────────────────────────');
  if (result) {
    const msgId  = result.message_id;
    const chat   = result.chat?.id || result.chat?.username || chatId;
    const type   = result.photo ? 'photo' : 'text';
    logger.info(`[TEST] Telegram response received:`);
    logger.info(`[TEST]   message_id : ${msgId}`);
    logger.info(`[TEST]   chat       : ${chat}`);
    logger.info(`[TEST]   type       : ${type}`);
    logger.info(`[TEST]   elapsed    : ${elapsedMs} ms`);
  } else {
    logger.warn('[TEST] sendToTelegram resolved with null — bot may be unconfigured');
  }

  // ── Step 6: Final confirmation ────────────────────────────────────────────
  logger.info('════════════════════════════════════════════════════════════');
  logger.info('[TEST] ✅ End-to-end Telegram delivery successful');
  logger.info(`[TEST]    Chat    : ${chatId}`);
  logger.info(`[TEST]    Elapsed : ${elapsedMs} ms`);
  logger.info('════════════════════════════════════════════════════════════');

  process.exit(0);
}

runTest().catch((err) => {
  logger.error(`[TEST] Unhandled error: ${err.message}`);
  logger.error(err.stack);
  process.exit(1);
});
