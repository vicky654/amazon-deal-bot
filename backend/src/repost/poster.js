'use strict';
/**
 * Deal poster — formats the caption and sends via existing telegram.js pipeline.
 * FULL DEBUG MODE: destination check, entity resolution, response tracing.
 */

const telegram = require('../../telegram');

const DEST_CHANNEL = process.env.REPOST_OUTPUT_CHANNEL || process.env.TELEGRAM_CHAT;

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

  // ── STEP 3: Destination check ─────────────────────────────────────────────
  console.log('[DESTINATION CHECK]');
  console.log('ENV TELEGRAM_CHAT:', process.env.TELEGRAM_CHAT);
  console.log('ENV REPOST_OUTPUT_CHANNEL:', process.env.REPOST_OUTPUT_CHANNEL);
  console.log('FINAL TARGET USED:', DEST_CHANNEL);
  console.log('ASIN:', deal.asin);
  console.log('Title:', (deal.title || '').slice(0, 70));
  console.log('Price: ₹' + deal.dealPrice, '| Orig: ₹' + deal.originalPrice, '| Disc:', deal.discount + '%');
  console.log('Has media buffer:', !!mediaBuffer, mediaBuffer ? `(${Math.round(mediaBuffer.length / 1024)} KB)` : '');
  console.log('Caption length:', caption.length);
  console.log('URL:', (affiliateUrl || '').slice(0, 80));

  try {
    let result;
    if (mediaBuffer) {
      console.log('[SEND] calling telegram.sendPhotoBuffer...');
      result = await telegram.sendPhotoBuffer(mediaBuffer, caption, affiliateUrl);
      console.log('[SEND] sendPhotoBuffer returned:', result?.message_id ? `messageId=${result.message_id}` : 'no messageId');
    } else {
      console.log('[SEND] calling telegram.sendToTelegram (no media)...');
      result = await telegram.sendToTelegram(null, caption, affiliateUrl);
      console.log('[SEND] sendToTelegram returned:', result?.message_id ? `messageId=${result.message_id}` : 'no messageId');
    }

    if (result?.message_id) {
      console.log('\n========== POSTER SEND RESPONSE ==========');
      console.log({ messageId: result.message_id, chatId: result.chat?.id, chatType: result.chat?.type });
      console.log('TARGET CHAT:', DEST_CHANNEL);
      console.log('==========================================\n');
    } else {
      console.log('[SEND] WARNING: no message_id in response — message may not have been delivered');
      console.log('[SEND] full response:', JSON.stringify(result, null, 2));
    }

    return result;
  } catch (err) {
    console.error('\n========== TELEGRAM SEND FAIL ==========');
    console.error(err);
    console.error('========================================\n');
    throw err;
  }
}

module.exports = { repostDeal, formatRepostCaption };
