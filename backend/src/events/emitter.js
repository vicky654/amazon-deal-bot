/**
 * Global SSE event bus + in-memory activity log.
 * Zero dependencies — plain Node EventEmitter.
 */

const EventEmitter = require('events');

const bus = new EventEmitter();
bus.setMaxListeners(200); // support many concurrent SSE clients

const activityLog = [];
const MAX_ENTRIES  = 50;

const HISTORY_EVENTS = new Set([
  'crawler:deal-posted',
  'crawler:deal-skipped',
  'crawler:deal-error',
  'crawler:started',
  'crawler:completed',
  'crawler:stopped',
  'crawler:error',
]);

/**
 * Emit an event to all connected SSE clients and optionally store in the activity log.
 *
 * @param {string} event  e.g. 'crawler:deal-posted'
 * @param {object} data   Arbitrary payload merged into the log entry
 */
function emit(event, data = {}) {
  const entry = {
    id:        `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    event,
    ...data,
    timestamp: new Date().toISOString(),
  };

  if (HISTORY_EVENTS.has(event)) {
    activityLog.unshift(entry);
    if (activityLog.length > MAX_ENTRIES) activityLog.pop();
  }

  bus.emit('sse', { event, data: entry });
}

function getActivity() {
  return [...activityLog];
}

module.exports = { emit, getActivity, bus };
