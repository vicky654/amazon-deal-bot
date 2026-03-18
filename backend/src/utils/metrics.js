/**
 * In-process metrics store
 *
 * Prometheus-compatible counters and histograms exposed via /metrics endpoint.
 * Zero external dependencies — resets on restart (acceptable for single-process).
 *
 * If you need persistence, push these to Prometheus Pushgateway or DataDog.
 */

const counters   = new Map();
const histograms = new Map(); // key → { sum, count, min, max, buckets[] }
const gauges     = new Map();

function increment(key, by = 1) {
  counters.set(key, (counters.get(key) || 0) + by);
}

function gauge(key, value) {
  gauges.set(key, value);
}

function observe(key, ms) {
  if (!histograms.has(key)) {
    histograms.set(key, { sum: 0, count: 0, min: Infinity, max: -Infinity, samples: [] });
  }
  const h = histograms.get(key);
  h.sum   += ms;
  h.count += 1;
  h.min    = Math.min(h.min, ms);
  h.max    = Math.max(h.max, ms);
  h.samples.push(ms);
  // Keep last 200 samples for p95 calculation
  if (h.samples.length > 200) h.samples.shift();
}

function percentile(sortedArr, p) {
  if (!sortedArr.length) return 0;
  const idx = Math.ceil((p / 100) * sortedArr.length) - 1;
  return sortedArr[Math.max(0, idx)];
}

function snapshot() {
  const out = {
    counters:   Object.fromEntries(counters),
    gauges:     Object.fromEntries(gauges),
    histograms: {},
  };

  for (const [key, h] of histograms) {
    const sorted = [...h.samples].sort((a, b) => a - b);
    out.histograms[key] = {
      count: h.count,
      sum_ms: h.sum,
      avg_ms: h.count ? Math.round(h.sum / h.count) : 0,
      min_ms: h.min === Infinity ? 0 : h.min,
      max_ms: h.max === -Infinity ? 0 : h.max,
      p50_ms: percentile(sorted, 50),
      p95_ms: percentile(sorted, 95),
      p99_ms: percentile(sorted, 99),
    };
  }

  return out;
}

function reset() {
  counters.clear();
  histograms.clear();
  gauges.clear();
}

module.exports = { increment, gauge, observe, snapshot, reset };
