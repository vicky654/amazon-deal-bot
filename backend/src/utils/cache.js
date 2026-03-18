/**
 * URL Deduplication Cache
 *
 * Prevents scraping the same product URL multiple times in a crawl cycle
 * and across cycles (configurable TTL).
 *
 * Zero dependencies — simple Map with TTL expiry.
 * For distributed deployments, swap this for Redis with SETNX.
 */

const SCRAPE_CACHE_TTL_MS = parseInt(process.env.SCRAPE_CACHE_TTL_MS || String(30 * 60 * 1000), 10); // 30 min default

class TTLCache {
  constructor(ttlMs = SCRAPE_CACHE_TTL_MS) {
    this._map = new Map(); // key → { value, expiresAt }
    this._ttl = ttlMs;
  }

  set(key, value = true) {
    this._map.set(key, { value, expiresAt: Date.now() + this._ttl });
  }

  has(key) {
    const entry = this._map.get(key);
    if (!entry) return false;
    if (Date.now() > entry.expiresAt) {
      this._map.delete(key);
      return false;
    }
    return true;
  }

  get(key) {
    if (!this.has(key)) return undefined;
    return this._map.get(key).value;
  }

  delete(key) {
    this._map.delete(key);
  }

  // Evict expired entries (call periodically to avoid memory leak)
  purgeExpired() {
    const now = Date.now();
    let purged = 0;
    for (const [k, v] of this._map) {
      if (now > v.expiresAt) { this._map.delete(k); purged++; }
    }
    return purged;
  }

  get size() { return this._map.size; }

  clear() { this._map.clear(); }
}

// One shared instance for URL deduplication across the scraping cycle
const urlCache = new TTLCache();

// Purge expired entries every 10 minutes
setInterval(() => {
  const purged = urlCache.purgeExpired();
  if (purged > 0) require('../../utils/logger').debug(`[Cache] Purged ${purged} expired entries`);
}, 10 * 60 * 1000).unref();

module.exports = { TTLCache, urlCache };
