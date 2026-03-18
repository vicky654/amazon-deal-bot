/**
 * Shared cron state — imported by server.js (cron runner) and system route.
 * Using a plain object ensures both modules share the same reference.
 */

const state = {
  running:  false,
  lastRun:  null,   // ISO string
  nextRun:  null,   // ISO string
  logs:     [],     // newest-first array of strings (max 100)
};

/**
 * Prepend a timestamped log entry. Keeps the last 100 entries.
 * @param {string} msg
 */
function addLog(msg) {
  const entry = `[${new Date().toISOString()}] ${msg}`;
  state.logs.unshift(entry);
  if (state.logs.length > 100) state.logs.length = 100;
}

/**
 * Parse the minute-interval from a simple "* /N * * * *" cron expression.
 * Falls back to 5 if the pattern is not recognised.
 * @param {string} expr
 * @returns {number}
 */
function parseIntervalMinutes(expr) {
  const m = (expr || '').trim().match(/^\*\/(\d+)\s/);
  return m ? parseInt(m[1], 10) : 5;
}

module.exports = { state, addLog, parseIntervalMinutes };
