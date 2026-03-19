/**
 * Auto Mode State
 *
 * Controls whether the crawler automatically posts deals to Telegram.
 *
 * Auto Mode ON  → scrape + filter + affiliate + post (fully automated)
 * Auto Mode OFF → scrape + filter + affiliate + SAVE only (manual review before posting)
 *
 * This is an in-memory singleton — survives server restarts via the env var default.
 */

const DEFAULT_ON = (process.env.AUTO_MODE_DEFAULT || 'true') === 'true';

const state = {
  enabled:   DEFAULT_ON,
  updatedAt: new Date().toISOString(),
  updatedBy: 'system',   // 'system' | 'admin'
};

/**
 * @param {boolean} enabled
 * @param {'system'|'admin'} by
 */
function setAutoMode(enabled, by = 'admin') {
  state.enabled   = !!enabled;
  state.updatedAt = new Date().toISOString();
  state.updatedBy = by;
}

module.exports = { state, setAutoMode };
