const TelegramBot = require('node-telegram-bot-api');
require('dotenv').config();
const logger = require('./utils/logger');

/*
 * ─── INITIALISE BOT ──────────────────────────────────────────────────────────
 */

const TOKEN = process.env.TELEGRAM_TOKEN;
const CHAT_ID = process.env.TELEGRAM_CHAT;

let bot = null;

if (TOKEN) {
  bot = new TelegramBot(TOKEN);
  logger.info('Telegram bot initialised');
} else {
  logger.warn('TELEGRAM_TOKEN missing — Telegram posting disabled');
}

/*
 * ─── MESSAGE FORMATTER ───────────────────────────────────────────────────────
 */

/**
 * Format a deal into a Telegram-ready HTML caption.
 *
 * Output example:
 *   🔥 <b>71% OFF</b> — Amazon Deal
 *
 *   Samsung Galaxy Buds Pro
 *
 *   🏷 MRP: <s>₹14,999</s>
 *   💰 Deal Price: <b>₹4,299</b>
 *   ⚡ You Save: <b>71%  (₹10,700)</b>
 *
 *   🛒 <a href="...">Buy Now on Amazon</a>
 */
function formatDealText(title, price, link, originalPrice, savings) {
  // Compute savings if not provided
  let savingsPct = savings;
  let savedAmount = null;

  if (!savingsPct && originalPrice && price && originalPrice > price) {
    savingsPct = Math.round(((originalPrice - price) / originalPrice) * 100);
  }

  if (originalPrice && price) {
    savedAmount = Math.round(originalPrice - price).toLocaleString('en-IN');
  }

  const formattedPrice    = price         ? `₹${Number(price).toLocaleString('en-IN')}`         : 'Check Price';
  const formattedOriginal = originalPrice ? `₹${Number(originalPrice).toLocaleString('en-IN')}` : null;

  // Header line — highlight the discount prominently
  const header = savingsPct
    ? `🔥 <b>${savingsPct}% OFF</b> — Amazon Deal`
    : '🔥 Amazon Deal';

  const lines = [
    header,
    '',
    `<b>${escapeHtml(title)}</b>`,
    '',
  ];

  if (formattedOriginal) {
    lines.push(`🏷 MRP: <s>${formattedOriginal}</s>`);
  }

  lines.push(`💰 Deal Price: <b>${formattedPrice}</b>`);

  if (savingsPct) {
    const savingsLine = savedAmount
      ? `⚡ You Save: <b>${savingsPct}% (₹${savedAmount})</b>`
      : `⚡ You Save: <b>${savingsPct}%</b>`;
    lines.push(savingsLine);
  }

  lines.push('');
  lines.push(`🛒 <a href="${link}">Buy Now on Amazon</a>`);
  lines.push('');
  lines.push(`📢 <a href="https://t.me/+NJWXP0z-Sb00YThl">Daily Amazon Deals Channel</a>`);

  return lines.join('\n');
}

/**
 * Escape characters that have special meaning in Telegram HTML mode.
 */
function escapeHtml(text) {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/*
 * ─── SEND TO TELEGRAM ────────────────────────────────────────────────────────
 */

/**
 * Send a deal to Telegram — photo + caption if image available, text-only fallback.
 */
async function sendToTelegram(imageUrl, caption) {
  if (!bot || !CHAT_ID) {
    logger.warn('Telegram not configured — skipping post');
    return null;
  }

  // Try sending with image
  if (imageUrl) {
    try {
      const result = await bot.sendPhoto(CHAT_ID, imageUrl, {
        caption,
        parse_mode: 'HTML',
      });
      logger.info('Deal sent to Telegram (with image)');
      return result;
    } catch (error) {
      // Image send failed (bad URL, size limit, etc.) — fall through to text-only
      logger.warn(`Image send failed: ${error.message} — falling back to text`);
    }
  }

  // Text-only fallback
  try {
    const result = await bot.sendMessage(CHAT_ID, caption, { parse_mode: 'HTML' });
    logger.info('Deal sent to Telegram (text-only)');
    return result;
  } catch (error) {
    logger.error(`Telegram send failed: ${error.message}`);
    throw error;
  }
}

/**
 * Send an arbitrary text message to Telegram (custom message feature).
 */
async function sendMessageToTelegram(message) {
  if (!bot || !CHAT_ID) {
    logger.warn('Telegram not configured — skipping message');
    return null;
  }

  try {
    const result = await bot.sendMessage(CHAT_ID, message);
    logger.info('Custom message sent to Telegram');
    return result;
  } catch (error) {
    logger.error(`Telegram message failed: ${error.message}`);
    throw error;
  }
}

/**
 * Send a test ping to verify the bot is configured correctly.
 */
async function sendTestMessage() {
  if (!bot || !CHAT_ID) return false;

  try {
    await bot.sendMessage(CHAT_ID, '✅ DealBot is running and connected!');
    logger.info('Telegram test message sent');
    return true;
  } catch (error) {
    logger.error(`Telegram test failed: ${error.message}`);
    return false;
  }
}

module.exports = {
  sendToTelegram,
  sendMessageToTelegram,
  formatDealText,
  sendTestMessage,
};
