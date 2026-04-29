'use strict';
/**
 * Auto Mode State
 *
 * Controls whether the crawler automatically posts deals to Telegram.
 *
 * Auto Mode ON  → scrape + filter + affiliate + post (fully automated)
 * Auto Mode OFF → scrape + filter + affiliate + SAVE only (manual review before posting)
 *
 * State is persisted to MongoDB so it survives server restarts.
 * Call loadState() once after MongoDB connects (done in server.js).
 */

const DEFAULT_ON = (process.env.AUTO_MODE_DEFAULT || 'true') === 'true';

const state = {
  enabled:   DEFAULT_ON,
  updatedAt: new Date().toISOString(),
  updatedBy: 'system',
};

function _getConfigModel() {
  const mongoose = require('mongoose');
  if (mongoose.models.AppConfig) return mongoose.models.AppConfig;
  return mongoose.model('AppConfig', new mongoose.Schema(
    { key: { type: String, required: true, unique: true }, value: mongoose.Schema.Types.Mixed },
    { collection: 'app_configs' }
  ));
}

/** Load persisted state from MongoDB. Called once at server startup after DB connects. */
async function loadState() {
  try {
    const Config = _getConfigModel();
    const doc = await Config.findOne({ key: 'autoMode' }).lean();
    if (doc && typeof doc.value?.enabled === 'boolean') {
      state.enabled   = doc.value.enabled;
      state.updatedAt = doc.value.updatedAt || new Date().toISOString();
      state.updatedBy = doc.value.updatedBy || 'loaded';
    }
  } catch (_) {
    // Non-fatal — falls back to DEFAULT_ON
  }
}

/** Toggle auto mode and persist the new state to MongoDB. */
async function setAutoMode(enabled, by = 'admin') {
  state.enabled   = !!enabled;
  state.updatedAt = new Date().toISOString();
  state.updatedBy = by;
  try {
    const Config = _getConfigModel();
    await Config.findOneAndUpdate(
      { key: 'autoMode' },
      { value: { enabled: state.enabled, updatedAt: state.updatedAt, updatedBy: by } },
      { upsert: true }
    );
  } catch (_) {
    // Non-fatal — in-memory state is still updated
  }
}

module.exports = { state, setAutoMode, loadState };
