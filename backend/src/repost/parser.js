'use strict';
/**
 * Telegram message parser — extracts structured deal data.
 *
 * Handles multiple deal channel formats:
 *   - "Deal Price: ₹999 / MRP: ₹2,499 (60% Off)"
 *   - "₹999 (60% off) | Was ₹2,499"
 *   - "⚡ 60% Off  ₹999 ₹2499"
 */

const logger = require('../../utils/logger');

// ── Price extraction ──────────────────────────────────────────────────────────

function parseRupees(text) {
  // Returns array of all ₹ amounts found in text, as floats
  const matches = [...text.matchAll(/₹\s*([\d,]+(?:\.\d{1,2})?)/g)];
  return matches.map(m => parseFloat(m[1].replace(/,/g, '')));
}

function extractDealPrice(text) {
  const patterns = [
    /(?:deal|selling|offer|now|discounted)\s*(?:price)?[:\s]+₹\s*([\d,]+)/i,
    /₹\s*([\d,]+)\s*(?:\([\d]+%\s*off\)|only|\/-)?\s*(?:deal|now|offer)/i,
    /after\s*discount[:\s]+₹\s*([\d,]+)/i,
    /buy\s*(?:now\s*)?(?:at|for|@)[:\s]*₹\s*([\d,]+)/i,
    /price[:\s]+₹\s*([\d,]+)/i,
  ];
  for (const p of patterns) {
    const m = text.match(p);
    if (m) return parseFloat(m[1].replace(/,/g, ''));
  }
  return null;
}

function extractOriginalPrice(text) {
  const patterns = [
    /(?:original|mrp|m\.r\.p|was|market|retail|before)\s*(?:price)?[:\s]+₹\s*([\d,]+)/i,
    /~~₹\s*([\d,]+)~~/,                             // markdown strikethrough
    /(?:Rs\.?|INR)\s*([\d,]+)\s*[-–]\s*₹/i,        // "Rs.2499 - ₹999"
  ];
  for (const p of patterns) {
    const m = text.match(p);
    if (m) return parseFloat(m[1].replace(/,/g, ''));
  }
  return null;
}

function extractDiscount(text) {
  const patterns = [
    /(\d+)\s*%\s*off/i,
    /discount[:\s]+(\d+)\s*%/i,
    /save\s+(\d+)\s*%/i,
    /\((\d+)%\s*(?:off|discount)\)/i,
  ];
  for (const p of patterns) {
    const m = text.match(p);
    if (m) return parseInt(m[1], 10);
  }
  return null;
}

// ── Title extraction ──────────────────────────────────────────────────────────

function extractTitle(text) {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

  for (const line of lines) {
    // Strip leading/trailing emoji
    const stripped = line
      .replace(/^[\u{1F300}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\s!⚡🔥✅👉🔗]+/gu, '')
      .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\s!⚡🔥✅👉🔗]+$/gu, '')
      .trim();

    // Skip if it's a price line, a URL, a discount header, or too short
    if (!stripped) continue;
    if (/[₹$€£]/.test(stripped)) continue;
    if (/^\d+\s*%/.test(stripped)) continue;
    if (/^https?:\/\//.test(stripped)) continue;
    if (/^(?:deal|alert|offer|sale|flash|buy|shop|limited)/i.test(stripped) && stripped.length < 25) continue;
    if (stripped.length < 10) continue;

    return stripped;
  }

  return null;
}

// ── URL extraction ────────────────────────────────────────────────────────────

function extractTextUrls(text) {
  return (text.match(/https?:\/\/[^\s​‌‍﻿]+/g) || [])
    .map(u => u.replace(/[.,;!?)>\]]+$/, ''))   // strip trailing punctuation
    .filter(Boolean);
}

function extractButtonUrls(message) {
  const urls = [];
  try {
    const markup = message.replyMarkup;
    if (!markup?.rows) return urls;
    for (const row of markup.rows) {
      for (const btn of (row.buttons || [])) {
        if (btn.url) urls.push(btn.url);
      }
    }
  } catch (_) {}
  return urls;
}

// ── Media download ────────────────────────────────────────────────────────────

async function downloadMedia(client, message) {
  if (!message.media) return null;
  const isPhoto = !!message.media.photo;
  const isImageDoc = message.media.document?.mimeType?.startsWith('image/');
  if (!isPhoto && !isImageDoc) return null;

  try {
    const buffer = await client.downloadMedia(message.media);
    return Buffer.isBuffer(buffer) ? buffer : null;
  } catch (e) {
    logger.debug(`[Parser] Media download skipped: ${e.message}`);
    return null;
  }
}

// ── Main parser ───────────────────────────────────────────────────────────────

async function parseMessage(event, client) {
  const message = event.message;
  if (!message) return null;

  const rawText  = message.message || '';
  const textUrls = extractTextUrls(rawText);
  const btnUrls  = extractButtonUrls(message);
  const allUrls  = [...new Set([...textUrls, ...btnUrls])];

  const title         = extractTitle(rawText);
  let   dealPrice     = extractDealPrice(rawText);
  let   originalPrice = extractOriginalPrice(rawText);
  let   discount      = extractDiscount(rawText);

  // Fallback: infer from all ₹ amounts if specific patterns didn't match
  if (!dealPrice || !originalPrice) {
    const amounts = parseRupees(rawText).filter(v => v >= 50 && v <= 200000);
    if (amounts.length >= 2) {
      const sorted = [...amounts].sort((a, b) => a - b);
      if (!dealPrice)     dealPrice     = sorted[0];
      if (!originalPrice) originalPrice = sorted[sorted.length - 1];
    }
  }

  // Infer discount from prices if not found in text
  if (!discount && dealPrice && originalPrice && originalPrice > dealPrice) {
    discount = Math.round(((originalPrice - dealPrice) / originalPrice) * 100);
  }

  const mediaBuffer = await downloadMedia(client, message);

  logger.debug(
    `[Parser] title="${title?.slice(0, 50)}" ` +
    `deal=₹${dealPrice} orig=₹${originalPrice} disc=${discount}% ` +
    `urls=${allUrls.length} hasMedia=${!!mediaBuffer}`
  );

  return {
    title,
    dealPrice,
    originalPrice,
    discount,
    rawText,
    allUrls,
    mediaBuffer,
    sourceMessageId: message.id,
  };
}

module.exports = { parseMessage };
