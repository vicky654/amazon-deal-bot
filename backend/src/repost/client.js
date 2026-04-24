'use strict';
/**
 * GramJS user-client singleton.
 *
 * Session lifecycle:
 *   1. First run  → no session in DB → run: node tools/telegram-login.js
 *   2. Normal run → loads StringSession from MongoDB (or TELEGRAM_SESSION_STRING env)
 *   3. After every connect the refreshed session string is saved back to DB
 *      (Telegram silently rotates auth keys — persisting keeps the session valid)
 */

const { TelegramClient } = require('telegram');
const { StringSession }  = require('telegram/sessions');
const logger = require('../../utils/logger');

const API_ID   = parseInt(process.env.TELEGRAM_API_ID   || '0', 10);
const API_HASH = process.env.TELEGRAM_API_HASH           || '';

let _client = null;

// Live state — exposed via /api/debug/repost
const state = {
  connected:       false,
  reconnectCount:  0,
  lastConnectedAt: null,
  lastError:       null,
};

// ── Session helpers ───────────────────────────────────────────────────────────

async function _loadSessionString() {
  if (process.env.TELEGRAM_SESSION_STRING) {
    return process.env.TELEGRAM_SESSION_STRING;
  }
  try {
    const TelegramSession = require('../models/TelegramSession');
    const doc = await TelegramSession.findOne({}).lean();
    return doc?.sessionString || '';
  } catch (e) {
    logger.warn(`[RepostClient] Could not load session from DB: ${e.message}`);
    return '';
  }
}

async function saveSessionString(str) {
  if (!str) return;
  try {
    const TelegramSession = require('../models/TelegramSession');
    await TelegramSession.findOneAndUpdate(
      {},
      { sessionString: str, updatedAt: new Date() },
      { upsert: true, new: true }
    );
    logger.info('[RepostClient] Session saved to MongoDB');
  } catch (e) {
    logger.error(`[RepostClient] Could not save session: ${e.message}`);
  }
}

// ── Client factory ────────────────────────────────────────────────────────────

async function getClient() {
  // Return cached connected client
  if (_client && _client.connected) return _client;

  if (!API_ID || !API_HASH) {
    throw new Error(
      'TELEGRAM_API_ID and TELEGRAM_API_HASH are required. ' +
      'Get them from: https://my.telegram.org → API Development Tools'
    );
  }

  const sessionStr = await _loadSessionString();
  if (!sessionStr) {
    throw new Error(
      'No Telegram session found. ' +
      'Run: node tools/telegram-login.js  to authenticate, then restart the server.'
    );
  }

  const session = new StringSession(sessionStr);

  _client = new TelegramClient(session, API_ID, API_HASH, {
    connectionRetries:   10,
    retryDelay:          3000,
    autoReconnect:       true,
    floodSleepThreshold: 60,       // auto-sleep on flood waits under 60 s
    deviceModel:         'Desktop',
    systemVersion:       'Windows 10',
    appVersion:          '4.8.1',
    langCode:            'en',
  });

  // Suppress GramJS internal console spam
  _client.setLogLevel('none');

  await _client.connect();

  if (!await _client.isUserAuthorized()) {
    _client = null;
    throw new Error(
      'Telegram session expired or invalid. ' +
      'Run: node tools/telegram-login.js  to re-authenticate.'
    );
  }

  // Persist refreshed session string (handles silent Telegram key rotation)
  const fresh = _client.session.save();
  if (fresh && fresh !== sessionStr) await saveSessionString(fresh);

  state.connected       = true;
  state.lastConnectedAt = new Date().toISOString();
  state.lastError       = null;
  logger.info('[RepostClient] ✅ Telegram user client connected');

  return _client;
}

// ── Health check ──────────────────────────────────────────────────────────────

async function isHealthy() {
  try {
    if (!_client) return false;
    return await _client.isUserAuthorized();
  } catch (_) {
    return false;
  }
}

// ── Disconnect ────────────────────────────────────────────────────────────────

async function disconnect() {
  if (_client) {
    try { await _client.disconnect(); } catch (_) {}
    _client = null;
  }
  state.connected = false;
  logger.info('[RepostClient] Telegram user client disconnected');
}

module.exports = { getClient, disconnect, saveSessionString, isHealthy, state };
