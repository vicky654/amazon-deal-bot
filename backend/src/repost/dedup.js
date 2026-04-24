'use strict';
/**
 * Repost duplicate guard — three layers:
 *
 *   Layer 1  In-memory LRU Set (500 ASINs)  — fast path, survives DB hiccups
 *   Layer 2  RepostLog (MongoDB, 24h TTL)   — persistent, cross-restart authority
 *   Layer 3  Title bigram similarity ≥ 0.75 — catches same product, changed title
 */

const crypto    = require('crypto');
const RepostLog = require('../models/RepostLog');
const logger    = require('../../utils/logger');

const COOLDOWN_HOURS = parseInt(process.env.REPOST_COOLDOWN_HOURS || '24', 10);
const COOLDOWN_MS    = COOLDOWN_HOURS * 60 * 60 * 1000;
const CACHE_MAX      = 500;

// ── Layer 1: In-memory ASIN cache ─────────────────────────────────────────────
const _cache      = new Set();
const _cacheQueue = [];

function _addToCache(asin) {
  if (_cache.has(asin)) return;
  if (_cache.size >= CACHE_MAX) {
    const evict = _cacheQueue.shift();
    _cache.delete(evict);
  }
  _cache.add(asin);
  _cacheQueue.push(asin);
}

// ── Layer 3: Title bigram similarity ─────────────────────────────────────────
const _postedTitleKeys = [];   // normalized titles
const SIMILARITY_THRESHOLD = 0.75;

function _bigrams(str) {
  const s = str.replace(/\s+/g, ' ').trim();
  const set = new Set();
  for (let i = 0; i < s.length - 1; i++) set.add(s.slice(i, i + 2));
  return set;
}

function _jacard(a, b) {
  const bg1 = _bigrams(a);
  const bg2 = _bigrams(b);
  let common = 0;
  for (const bg of bg1) if (bg2.has(bg)) common++;
  const union = bg1.size + bg2.size - common;
  return union === 0 ? 0 : common / union;
}

function _normalizeTitle(t) {
  return (t || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

function _isTitleDuplicate(title) {
  if (!title) return false;
  const key = _normalizeTitle(title);
  return _postedTitleKeys.some(k => _jacard(key, k) >= SIMILARITY_THRESHOLD);
}

function _addTitleKey(title) {
  const key = _normalizeTitle(title);
  if (_postedTitleKeys.length >= CACHE_MAX) _postedTitleKeys.shift();
  _postedTitleKeys.push(key);
}

// ── URL hash ──────────────────────────────────────────────────────────────────
function hashUrl(url) {
  return crypto.createHash('sha256').update(url || '').digest('hex').slice(0, 16);
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Returns true if this deal was already reposted within the cooldown window.
 */
async function isAlreadyReposted(asin, affiliateUrl, title) {
  // Layer 1: memory
  if (_cache.has(asin)) {
    logger.debug(`[RepostDedup] ASIN ${asin} in memory cache`);
    return true;
  }

  // Layer 2: MongoDB
  try {
    const exists = await RepostLog.findOne({ asin }).lean();
    if (exists) {
      _addToCache(asin); // warm the memory cache
      logger.debug(`[RepostDedup] ASIN ${asin} found in RepostLog`);
      return true;
    }
  } catch (e) {
    logger.warn(`[RepostDedup] DB check failed (non-fatal): ${e.message}`);
  }

  // Layer 3: title similarity
  if (_isTitleDuplicate(title)) {
    logger.debug(`[RepostDedup] Title similarity match for "${(title || '').slice(0, 50)}"`);
    return true;
  }

  return false;
}

/**
 * Mark a deal as reposted — updates all three layers.
 */
async function markReposted(asin, affiliateUrl, title, sourceChannel) {
  _addToCache(asin);
  _addTitleKey(title);

  const expireAt = new Date(Date.now() + COOLDOWN_MS);
  try {
    await RepostLog.findOneAndUpdate(
      { asin },
      {
        asin,
        urlHash:       hashUrl(affiliateUrl),
        titleKey:      _normalizeTitle(title),
        sourceChannel: sourceChannel || '',
        repostedAt:    new Date(),
        expireAt,
      },
      { upsert: true }
    );
  } catch (e) {
    logger.warn(`[RepostDedup] Could not write RepostLog (non-fatal): ${e.message}`);
  }
}

module.exports = { isAlreadyReposted, markReposted, hashUrl };
