const TelegramBot = require('node-telegram-bot-api');
require('dotenv').config();
const logger = require('./utils/logger');

/*
 * ─── INITIALISE BOT ──────────────────────────────────────────────────────────
 */

const TOKEN   = process.env.TELEGRAM_TOKEN;
const CHAT_ID = process.env.REPOST_OUTPUT_CHANNEL || process.env.TELEGRAM_CHAT || '-1003897819335';

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
// Telegram limits: sendPhoto caption = 1024 chars, sendMessage = 4096 chars.
const PHOTO_CAPTION_LIMIT   = 1024;
const MESSAGE_TEXT_LIMIT    = 4096;
const MAX_TITLE_IN_CAPTION  = 180;   // leave room for price lines + links

function formatDealText(title, price, link, originalPrice, discount, platformEmoji, platform = 'amazon') {
  const meta = PLATFORM_META[platform] || PLATFORM_META.manual;

  // 1. Calculations
  const mrp          = originalPrice ? Number(originalPrice) : 0;
  const dealPrice    = price ? Number(price) : 0;
  const savings      = mrp > dealPrice ? mrp - dealPrice : 0;
  const discountPct  = discount ? Number(discount) : (mrp > 0 ? Math.round((savings / mrp) * 100) : 0);

  // 2. Debug Log
  console.log(`\n[MessageFormat]\nMRP=${mrp}\nDeal=${dealPrice}\nSavings=${savings}\nDiscount=${discountPct}\n`);

  // 3. Currency Formatting (en-IN)
  const fmt = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 });
  const formattedMrp     = fmt.format(mrp);
  const formattedDeal    = fmt.format(dealPrice);
  const formattedSavings = fmt.format(savings);

  // 4. Header with Discount %
  const header = discountPct > 0 
    ? `🔥 <b>${discountPct}% OFF</b> — ${meta.label} Deal`
    : `🔥 ${meta.label} Deal`;

  // 5. Build Lines
  const rawTitle    = (title || '').trim();
  const shortTitle  = rawTitle.length > MAX_TITLE_IN_CAPTION
    ? rawTitle.slice(0, MAX_TITLE_IN_CAPTION - 1) + '…'
    : rawTitle;

  const lines = [
    header,
    '',
    `<b>${escapeHtml(shortTitle)}</b>`,
    '',
  ];

  // Rule: Hide MRP line if originalPrice <= dealPrice
  if (mrp > dealPrice) {
    lines.push(`🏷 MRP: <s>₹${formattedMrp}</s>`);
  }

  lines.push(`💰 Deal Price: <b>₹${formattedDeal}</b>`);

  // Rule: Hide savings line if savings <= 0
  if (savings > 0) {
    lines.push(`⚡ You Save: <b>${discountPct}% (₹${formattedSavings})</b>`);
  }

  // Encode & in URLs to prevent Telegram HTML parser errors
  const safeLink = encodeHrefAmpersands(link || '');

  lines.push('');
  lines.push(`${meta.emoji} <a href="${safeLink}">Buy Now on ${meta.label}</a>`);
  lines.push('');
  lines.push(`📢 <a href="https://t.me/+NJWXP0z-Sb00YThl">Daily Deals Channel</a>`);

  return lines.join('\n');
}

/**
 * Escape characters that have special meaning in Telegram HTML mode.
 * Applied to all user-supplied text content (titles, names).
 */
function escapeHtml(text) {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Encode `&` inside a URL placed inside an HTML attribute value.
 * Telegram's HTML parser treats bare `&foo=` as an entity reference and
 * throws "can't parse entities" — causing the sendMessage to fail silently.
 */
function encodeHrefAmpersands(url) {
  if (!url) return '';
  return url.replace(/&(?!amp;)/g, '&amp;');
}

/**
 * Return true only for absolute HTTPS URLs — the only kind Telegram will
 * actually fetch for sendPhoto.
 */
function isValidImageUrl(url) {
  return typeof url === 'string' && url.startsWith('https://') && url.length > 16;
}

/*
 * ─── RATE LIMITER ─────────────────────────────────────────────────────────────
 *
 * All Telegram sends are serialized through a single promise chain so that
 * concurrent deal posts (common when a crawl cycle finds 5-10 deals at once)
 * never fire simultaneously and trigger Telegram's flood control.
 *
 * Flow per send:
 *   1. Wait for any previous send in the chain to complete
 *   2. Random 2-5 s pre-send delay
 *   3. Send (sendPhoto → sendMessage fallback)
 *   4. On 429 Too Many Requests: read retry_after, sleep, retry (up to 4 attempts)
 */

let _tgSendChain = Promise.resolve();

function _tgSleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

function _retryAfterMs(err) {
  // node-telegram-bot-api wraps the Telegram JSON body in err.response.body
  const body = err.response?.body;
  const fromBody = typeof body === 'object'
    ? body?.parameters?.retry_after
    : null;
  const fromMsg = parseInt((err.message || '').match(/retry after (\d+)/i)?.[1] || '0', 10);
  const secs = fromBody || fromMsg || 0;
  return secs > 0 ? (secs + 2) * 1000 : 0; // +2 s safety margin
}

/*
 * ─── SEND TO TELEGRAM ────────────────────────────────────────────────────────
 */

/**
 * Core send — photo (URL) + caption + inline button, text-only fallback.
 * Called only through the rate-limited wrapper below.
 */
async function _sendCore(imageUrl, caption, buyLink) {
  // ── STEP 3: Destination check ────────────────────────────────────────────
  console.log('[DESTINATION CHECK]');
  console.log('ENV TELEGRAM_CHAT:', process.env.TELEGRAM_CHAT);
  console.log('ENV REPOST_OUTPUT_CHANNEL:', process.env.REPOST_OUTPUT_CHANNEL);
  console.log('FINAL TARGET USED:', CHAT_ID);

  if (!bot || !CHAT_ID) {
    console.error('[SEND FAIL] bot or CHAT_ID not configured — TOKEN set:', !!TOKEN, 'CHAT_ID:', CHAT_ID);
    return null;
  }

  // ── STEP 4: Bot account ──────────────────────────────────────────────────
  try {
    const me = await bot.getMe();
    console.log('[BOT ACCOUNT]');
    console.log({ id: me?.id, username: me?.username, firstName: me?.first_name });
  } catch (meErr) {
    console.error('[BOT ACCOUNT] getMe() failed:', meErr.message);
  }

  // ── STEP 5: Target entity ────────────────────────────────────────────────
  try {
    const chatInfo = await bot.getChat(CHAT_ID);
    console.log('[TARGET ENTITY]');
    console.log({
      id:        chatInfo?.id,
      title:     chatInfo?.title,
      username:  chatInfo?.username,
      type:      chatInfo?.type,
    });
  } catch (chatErr) {
    console.error('[TARGET ENTITY] getChat() failed:', chatErr.message);
  }

  const validImage = isValidImageUrl(imageUrl);
  console.log('[SEND] imageUrl valid:', validImage, '| captionLen:', caption?.length ?? 0);

  const replyMarkup = buyLink
    ? { inline_keyboard: [[{ text: '🛒 Buy Now', url: encodeHrefAmpersands(buyLink) }]] }
    : undefined;

  // ── Attempt 1: sendPhoto with caption ────────────────────────────────────
  if (validImage) {
    const photoCaption = caption && caption.length > PHOTO_CAPTION_LIMIT
      ? caption.slice(0, PHOTO_CAPTION_LIMIT - 1) + '…'
      : caption;

    try {
      console.log('[SEND] attempting sendPhoto to', CHAT_ID);
      const result = await bot.sendPhoto(CHAT_ID, imageUrl, {
        caption:      photoCaption,
        parse_mode:   'HTML',
        reply_markup: replyMarkup,
      });
      console.log('\n========== TELEGRAM SEND RESPONSE ==========');
      console.log({ messageId: result?.message_id, date: result?.date, chatId: result?.chat?.id, chatType: result?.chat?.type });
      console.log('TARGET CHAT:', CHAT_ID);
      console.log('============================================\n');
      return result;
    } catch (photoErr) {
      const errBody = photoErr.response?.body ?? photoErr.response ?? '';
      console.error('\n========== TELEGRAM SEND FAIL ==========');
      console.error(photoErr);
      console.error('body:', JSON.stringify(errBody));
      console.error('========================================\n');
      console.log('[SEND] sendPhoto failed — falling back to text');
    }
  }

  // ── Attempt 2: sendMessage text-only ─────────────────────────────────────
  const textCaption = caption && caption.length > MESSAGE_TEXT_LIMIT
    ? caption.slice(0, MESSAGE_TEXT_LIMIT - 1) + '…'
    : caption;

  try {
    console.log('[SEND] attempting sendMessage to', CHAT_ID);
    const result = await bot.sendMessage(CHAT_ID, textCaption, {
      parse_mode:               'HTML',
      reply_markup:             replyMarkup,
      disable_web_page_preview: false,
    });
    console.log('\n========== TELEGRAM SEND RESPONSE ==========');
    console.log({ messageId: result?.message_id, date: result?.date, chatId: result?.chat?.id, chatType: result?.chat?.type });
    console.log('TARGET CHAT:', CHAT_ID);
    console.log('============================================\n');
    return result;
  } catch (textErr) {
    const errBody = textErr.response?.body ?? textErr.response ?? '';
    console.error('\n========== TELEGRAM SEND FAIL ==========');
    console.error(textErr);
    console.error('body:', JSON.stringify(errBody));
    console.error('captionLen:', textCaption?.length);
    console.error('========================================\n');
    throw textErr;
  }
}

/**
 * Core send — photo (Buffer) + caption + inline button, text-only fallback.
 * Called only through the rate-limited wrapper below.
 */
async function _sendCoreBuffer(buffer, caption, buyLink) {
  if (!bot || !CHAT_ID) {
    logger.error('[Telegram] ❌ sendPhotoBuffer called but bot/chat not configured — SKIPPING.');
    return null;
  }

  const { Readable } = require('stream');

  const replyMarkup = buyLink
    ? { inline_keyboard: [[{ text: '🛒 Buy Now', url: encodeHrefAmpersands(buyLink) }]] }
    : undefined;

  // ── Attempt 1: sendPhoto with buffer stream ───────────────────────────────
  const photoCaption = caption && caption.length > PHOTO_CAPTION_LIMIT
    ? caption.slice(0, PHOTO_CAPTION_LIMIT - 1) + '…'
    : caption;

  try {
    const stream = Readable.from(buffer);
    const result = await bot.sendPhoto(CHAT_ID, stream, {
      caption:      photoCaption,
      parse_mode:   'HTML',
      reply_markup: replyMarkup,
    }, { filename: 'deal.jpg', contentType: 'image/jpeg' });
    logger.info('[Telegram] Deal sent with buffered photo');
    return result;
  } catch (photoErr) {
    const errBody = photoErr.response?.body ?? photoErr.response ?? '';
    logger.warn(`[Telegram] sendPhoto(buffer) failed (${photoErr.message}) body=${JSON.stringify(errBody)} — falling back to text`);
  }

  // ── Attempt 2: sendMessage text-only ─────────────────────────────────────
  const textCaption = caption && caption.length > MESSAGE_TEXT_LIMIT
    ? caption.slice(0, MESSAGE_TEXT_LIMIT - 1) + '…'
    : caption;

  try {
    const result = await bot.sendMessage(CHAT_ID, textCaption, {
      parse_mode:               'HTML',
      reply_markup:             replyMarkup,
      disable_web_page_preview: false,
    });
    logger.info('[Telegram] Deal sent (text-only fallback after buffer photo fail)');
    return result;
  } catch (textErr) {
    const errBody = textErr.response?.body ?? textErr.response ?? '';
    logger.error(`[Telegram] sendMessage FAILED: ${textErr.message} | body=${JSON.stringify(errBody)}`);
    throw textErr;
  }
}

/**
 * Rate-limited buffer-photo send — serialized through the same _tgSendChain
 * as sendToTelegram so the two never fire simultaneously.
 *
 * @param {Buffer}  buffer   Raw image bytes downloaded from the source message
 * @param {string}  caption  HTML-formatted caption
 * @param {string}  buyLink  Affiliate URL for the inline button (optional)
 */
function sendPhotoBuffer(buffer, caption, buyLink = null) {
  return new Promise((resolve, reject) => {
    _tgSendChain = _tgSendChain
      .catch(() => {})
      .then(async () => {
        const preDelay = 2000 + Math.floor(Math.random() * 3000);
        await _tgSleep(preDelay);

        for (let attempt = 1; attempt <= 4; attempt++) {
          try {
            const result = await _sendCoreBuffer(buffer, caption, buyLink);
            resolve(result);
            return;
          } catch (err) {
            const waitMs = _retryAfterMs(err);
            if (waitMs > 0 && attempt < 4) {
              logger.warn(`[Telegram] ⚠ 429 Too Many Requests — waiting ${waitMs / 1000}s before retry (attempt ${attempt}/4)`);
              await _tgSleep(waitMs);
              continue;
            }
            reject(err);
            return;
          }
        }
      });
  });
}

/**
 * Rate-limited send — serialized, 2-5 s random gap, 429 auto-retry.
 *
 * @param {string} imageUrl
 * @param {string} caption      HTML-formatted caption
 * @param {string} buyLink      Link for the inline button (optional)
 */
function sendToTelegram(imageUrl, caption, buyLink = null) {
  return new Promise((resolve, reject) => {
    _tgSendChain = _tgSendChain
      .catch(() => {}) // never let a previous failure freeze the chain
      .then(async () => {
        // Enforce 2-5 s random gap between consecutive Telegram sends
        const preDelay = 2000 + Math.floor(Math.random() * 3000);
        await _tgSleep(preDelay);

        // Up to 4 attempts (handles transient 429 + one genuine retry)
        for (let attempt = 1; attempt <= 4; attempt++) {
          try {
            const result = await _sendCore(imageUrl, caption, buyLink);
            resolve(result);
            return;
          } catch (err) {
            const waitMs = _retryAfterMs(err);
            if (waitMs > 0 && attempt < 4) {
              logger.warn(`[Telegram] ⚠ 429 Too Many Requests — waiting ${waitMs / 1000}s before retry (attempt ${attempt}/4)`);
              await _tgSleep(waitMs);
              continue;
            }
            reject(err);
            return;
          }
        }
      });
  });
}

/**
 * Send an arbitrary text message to Telegram.
 * Serialized through _tgSendChain — never fires concurrently with deal sends.
 * @param {string} message
 * @param {{ parse_mode?: 'Markdown'|'HTML' }} [opts]
 */
function sendMessageToTelegram(message, opts = {}) {
  if (!bot || !CHAT_ID) {
    logger.warn('Telegram not configured — skipping message');
    return Promise.resolve(null);
  }
  return new Promise((resolve, reject) => {
    _tgSendChain = _tgSendChain
      .catch(() => {})
      .then(async () => {
        const preDelay = 2000 + Math.floor(Math.random() * 3000);
        await _tgSleep(preDelay);
        try {
          const result = await bot.sendMessage(CHAT_ID, message, opts);
          logger.info('Custom message sent to Telegram');
          resolve(result);
        } catch (err) {
          logger.error(`Telegram message failed: ${err.message}`);
          reject(err);
        }
      });
  });
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
 * Serialized through _tgSendChain like all other sends.
 */
function sendTestMessage() {
  if (!bot || !CHAT_ID) return Promise.resolve(false);
  return sendMessageToTelegram('✅ DealBot is running and connected!')
    .then(() => { logger.info('Telegram test message sent'); return true; })
    .catch((err) => { logger.error(`Telegram test failed: ${err.message}`); return false; });
}

module.exports = {
  sendToTelegram,
  sendPhotoBuffer,
  sendMessageToTelegram,
  sendAlert,
  formatDealText,
  sendTestMessage,
};
