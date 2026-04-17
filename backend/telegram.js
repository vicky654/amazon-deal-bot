const TelegramBot = require('node-telegram-bot-api');
require('dotenv').config();
const logger = require('./utils/logger');

/*
 * ─── INITIALISE BOT ──────────────────────────────────────────────────────────
 */

const TOKEN   = process.env.TELEGRAM_TOKEN;
const CHAT_ID = process.env.TELEGRAM_CHAT;

let bot = null;

// ── Startup validation ────────────────────────────────────────────────────────
if (!TOKEN) {
  logger.error('[Telegram] ❌ TELEGRAM_TOKEN is NOT SET — Telegram posting is DISABLED. Set it in Render dashboard.');
} else if (!CHAT_ID) {
  logger.error('[Telegram] ❌ TELEGRAM_CHAT is NOT SET — Telegram posting is DISABLED. Set it in Render dashboard.');
} else {
  if (!CHAT_ID.startsWith('-')) {
    logger.warn(
      `[Telegram] ⚠️  TELEGRAM_CHAT="${CHAT_ID}" does not start with "-". ` +
      'Supergroups and channels require the "-100xxxxxxxxxx" format.'
    );
  }
  bot = new TelegramBot(TOKEN);
  logger.info(
    `[Telegram] ✅ Bot initialised — chat: ${CHAT_ID} ` +
    `(token: ${TOKEN.slice(0, 8)}…)`
  );
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
const PLATFORM_META = {
  amazon:   { label: 'Amazon',   emoji: '🛒', color: '🟠' },
  flipkart: { label: 'Flipkart', emoji: '🟡', color: '🟡' },
  myntra:   { label: 'Myntra',   emoji: '👗', color: '🩷' },
  ajio:     { label: 'Ajio',     emoji: '👠', color: '🔴' },
  manual:   { label: 'Deal',     emoji: '🛍️', color: '🔵' },
};

/**
 * Format a deal into a Telegram-ready HTML caption.
 *
 * @param {string} title
 * @param {number} price
 * @param {string} link          Affiliate link
 * @param {number} originalPrice
 * @param {number} discount      Percentage
 * @param {string} platformEmoji Optional override emoji
 * @param {string} platform      'amazon' | 'flipkart' | 'myntra' | 'ajio'
 */
function formatDealText(title, price, link, originalPrice, discount, platformEmoji, platform = 'amazon') {
  const meta = PLATFORM_META[platform] || PLATFORM_META.manual;

  let savingsPct = discount;
  if (!savingsPct && originalPrice && price && originalPrice > price) {
    savingsPct = Math.round(((originalPrice - price) / originalPrice) * 100);
  }

  const savedAmount = (originalPrice && price)
    ? Math.round(originalPrice - price).toLocaleString('en-IN')
    : null;

  const formattedPrice    = price         ? `₹${Number(price).toLocaleString('en-IN')}`         : 'Check Price';
  const formattedOriginal = originalPrice ? `₹${Number(originalPrice).toLocaleString('en-IN')}` : null;

  const header = savingsPct
    ? `🔥 <b>${savingsPct}% OFF</b> — ${meta.label} Deal`
    : `🔥 ${meta.label} Deal`;

  const lines = [
    header,
    '',
    `<b>${escapeHtml(title)}</b>`,
    '',
  ];

  if (formattedOriginal) lines.push(`🏷 MRP: <s>${formattedOriginal}</s>`);
  lines.push(`💰 Deal Price: <b>${formattedPrice}</b>`);

  if (savingsPct) {
    lines.push(
      savedAmount
        ? `⚡ You Save: <b>${savingsPct}% (₹${savedAmount})</b>`
        : `⚡ You Save: <b>${savingsPct}%</b>`
    );
  }

  lines.push('');
  lines.push(`${meta.emoji} <a href="${link}">Buy Now on ${meta.label}</a>`);
  lines.push('');
  lines.push(`📢 <a href="https://t.me/+NJWXP0z-Sb00YThl">Daily Deals Channel</a>`);

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
/**
 * Send a deal to Telegram — photo + caption + inline Buy Now button.
 * Falls back to text-only if image send fails.
 *
 * @param {string} imageUrl
 * @param {string} caption      HTML-formatted caption
 * @param {string} buyLink      Link for the inline button (optional)
 */
async function sendToTelegram(imageUrl, caption, buyLink = null) {
  if (!bot || !CHAT_ID) {
    logger.error('[Telegram] ❌ sendToTelegram called but bot/chat not configured — SKIPPING. Check TELEGRAM_TOKEN and TELEGRAM_CHAT on Render.');
    return null;
  }
  logger.info(`[Telegram] Sending deal... chat=${CHAT_ID} hasImage=${!!imageUrl}`);

  const replyMarkup = buyLink
    ? { inline_keyboard: [[{ text: '🛒 Buy Now', url: buyLink }]] }
    : undefined;

  if (imageUrl) {
    try {
      const result = await bot.sendPhoto(CHAT_ID, imageUrl, {
        caption,
        parse_mode:   'HTML',
        reply_markup: replyMarkup,
      });
      logger.info('Deal sent to Telegram (with image)');
      return result;
    } catch (error) {
      logger.warn(`Image send failed: ${error.message} — falling back to text`);
    }
  }

  try {
    const result = await bot.sendMessage(CHAT_ID, caption, {
      parse_mode:   'HTML',
      reply_markup: replyMarkup,
    });
    logger.info('Deal sent to Telegram (text-only)');
    return result;
  } catch (error) {
    logger.error(`Telegram send failed: ${error.message}`);
    throw error;
  }
}

/**
 * Send an arbitrary text message to Telegram (custom message feature).
 * @param {string} message
 * @param {{ parse_mode?: 'Markdown'|'HTML' }} [opts]
 */
async function sendMessageToTelegram(message, opts = {}) {
  if (!bot || !CHAT_ID) {
    logger.warn('Telegram not configured — skipping message');
    return null;
  }

  try {
    const result = await bot.sendMessage(CHAT_ID, message, opts);
    logger.info('Custom message sent to Telegram');
    return result;
  } catch (error) {
    logger.error(`Telegram message failed: ${error.message}`);
    throw error;
  }
}

/**
 * Send a Markdown-formatted system alert to Telegram.
 * Used internally for EarnKaro session alerts.
 */
async function sendAlert(message) {
  return sendMessageToTelegram(message, { parse_mode: 'Markdown' });
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
  sendAlert,
  formatDealText,
  sendTestMessage,
};
