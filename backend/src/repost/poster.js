'use strict';
/**
 * Deal poster — formats the caption and sends via existing telegram.js pipeline.
 *
 * All sends go through telegram.sendPhotoBuffer or telegram.sendToTelegram.
 * No raw Telegram Bot API calls. No axios. No form-data.
 * Inherits: rate limiter, 429 retry chain, serialized send queue.
 */

const telegram = require('../../telegram');
const logger   = require('../../utils/logger');

const DEST_CHANNEL = process.env.TELEGRAM_CHAT || process.env.REPOST_OUTPUT_CHANNEL;

// ── Message formatter ─────────────────────────────────────────────────────────

function formatRepostCaption(deal) {
  const { title, dealPrice, originalPrice, discount, affiliateUrl } = deal;

  const saving = originalPrice && dealPrice ? Math.round(originalPrice - dealPrice) : null;
  const disc   = discount || (saving && originalPrice ? Math.round(saving / originalPrice * 100) : null);

  const safeTitle = (title || 'Amazon Deal')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const safeUrl = (affiliateUrl || '').replace(/&(?!amp;)/g, '&amp;');

  const fmtPrice = n => n ? `₹${Number(n).toLocaleString('en-IN')}` : null;

  const lines = [];
  if (disc) lines.push(`🔥 <b>${disc}% OFF</b>`);
  lines.push('');
  lines.push(`<b>${safeTitle}</b>`);
  lines.push('');
  if (dealPrice)     lines.push(`💰 Deal Price: <b>${fmtPrice(dealPrice)}</b>`);
  if (originalPrice) lines.push(`🏷 Original Price: <s>${fmtPrice(originalPrice)}</s>`);
  if (saving > 0)    lines.push(`⚡ Save <b>₹${saving.toLocaleString('en-IN')}</b>`);
  lines.push('');
  lines.push(`🛒 <a href="${safeUrl}">Buy Now on Amazon</a>`);
  lines.push('');
  lines.push(`📢 <a href="https://t.me/+NJWXP0z-Sb00YThl">Daily Deals Channel</a>`);

  return lines.join('\n');
}

// ── Main repost function ──────────────────────────────────────────────────────

async function repostDeal(deal) {
  const { mediaBuffer, affiliateUrl } = deal;
  const caption = formatRepostCaption(deal);

  logger.info(`[Poster] ─────────────────────────────────────────`);
  logger.info(`[Poster] 📤 Sending to channel: ${DEST_CHANNEL}`);
  logger.info(`[Poster] ASIN      : ${deal.asin || 'N/A'}`);
  logger.info(`[Poster] Title     : "${(deal.title || '').slice(0, 70)}"`);
  logger.info(`[Poster] Price     : ₹${deal.dealPrice} (orig ₹${deal.originalPrice}) ${deal.discount}% off`);
  logger.info(`[Poster] MediaBuf  : ${!!mediaBuffer} (${mediaBuffer ? `${Math.round(mediaBuffer.length / 1024)} KB` : 'none'})`);
  logger.info(`[Poster] URL       : ${(affiliateUrl || '').slice(0, 80)}`);
  logger.info(`[Poster] Caption   : ${caption.length} chars`);

  if (mediaBuffer) {
    logger.info(`[Poster] → Calling telegram.sendPhotoBuffer…`);
    await telegram.sendPhotoBuffer(mediaBuffer, caption, affiliateUrl);
    logger.info(`[Poster] ✅ Photo delivered to ${DEST_CHANNEL}`);
    return;
  }

  logger.info(`[Poster] → Calling telegram.sendToTelegram (text/URL image)…`);
  await telegram.sendToTelegram(null, caption, affiliateUrl);
  logger.info(`[Poster] ✅ Text delivered to ${DEST_CHANNEL}`);
}

module.exports = { repostDeal, formatRepostCaption };
