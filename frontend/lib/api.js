/**
 * Typed API client for the deal-system backend.
 *
 * All methods throw on non-2xx responses so callers can catch with try/catch.
 * Base URL is controlled by NEXT_PUBLIC_API_URL env var.
 */

const BASE = (process.env.NEXT_PUBLIC_API_URL || 'https://deal-system-backend.onrender.com').replace(/\/$/, '');


console.log(`API base URL: ${process.env.NEXT_PUBLIC_API_URL}`);
class ApiError extends Error {
  constructor(message, status, body) {
    super(message);
    this.name   = 'ApiError';
    this.status = status;
    this.body   = body;
  }
}

async function request(path, options = {}) {
  const url   = `${BASE}${path}`;
  const token = typeof window !== 'undefined' ? localStorage.getItem('dealbot_token') : null;
  const res   = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
    ...options,
  });

  const data = await res.json().catch(() => ({ error: res.statusText }));

  if (!res.ok) {
    throw new ApiError(data?.error || `HTTP ${res.status}`, res.status, data);
  }
  return data;
}

// ── Deals ─────────────────────────────────────────────────────────────────────

export const dealsApi = {
  /** @param {{ limit?: number, platform?: string, posted?: boolean, sort?: string }} params */
  list(params = {}) {
    const qs = new URLSearchParams(
      Object.entries(params).filter(([, v]) => v !== undefined && v !== null).map(([k, v]) => [k, String(v)])
    ).toString();
    return request(`/api/deals${qs ? `?${qs}` : ''}`);
  },

  analytics() {
    return request('/api/deals/analytics');
  },

  get(id) {
    return request(`/api/deals/${id}`);
  },

  delete(id) {
    return request(`/api/deals/${id}`, { method: 'DELETE' });
  },

  /** @param {{ url: string }} body */
  generate(url) {
    return request('/api/deals/generate', {
      method: 'POST',
      body:   JSON.stringify({ url }),
    });
  },

  postToTelegram(id) {
    return request(`/api/deals/${id}/post`, { method: 'POST' });
  },
};

// ── Crawler ───────────────────────────────────────────────────────────────────

export const crawlerApi = {
  status() {
    return request('/api/crawler/status');
  },

  start() {
    return request('/api/crawler/start', { method: 'POST' });
  },

  runs(limit = 20) {
    return request(`/api/crawler/runs?limit=${limit}`);
  },
};

// ── EarnKaro ──────────────────────────────────────────────────────────────────

export const earnkaroApi = {
  status() {
    return request('/api/earnkaro/status');
  },

  health() {
    return request('/api/earnkaro/health');
  },

  logs(limit = 50) {
    return request(`/api/earnkaro/logs?limit=${limit}`);
  },

  /** Auto-login via Puppeteer — credentials never stored to disk */
  login(email, password) {
    return request('/api/earnkaro/login', {
      method: 'POST',
      body:   JSON.stringify({ email, password }),
    });
  },

  /** @param {object[]} cookies  Manual fallback — cookie JSON array from browser */
  connect(cookies) {
    return request('/api/earnkaro/connect', {
      method: 'POST',
      body:   JSON.stringify({ cookies }),
    });
  },

  test() {
    return request('/api/earnkaro/test', { method: 'POST' });
  },

  /** Force cookie refresh using stored in-memory credentials */
  refresh() {
    return request('/api/earnkaro/refresh', { method: 'POST' });
  },

  /** Re-login with fresh credentials (while already connected) */
  relogin(email, password) {
    return request('/api/earnkaro/relogin', {
      method: 'POST',
      body:   JSON.stringify({ email, password }),
    });
  },

  disconnect() {
    return request('/api/earnkaro/disconnect', { method: 'POST' });
  },
};

// ── Reels ─────────────────────────────────────────────────────────────────────

export const reelsApi = {
  /**
   * Generate (or return cached) reel for a deal.
   * @param {string} dealId
   * @param {'dark'|'sale'|'minimal'} template
   */
  generate(dealId, template = 'dark') {
    return request('/api/reels/generate', {
      method: 'POST',
      body:   JSON.stringify({ dealId, template }),
    });
  },

  /** Check if a reel is already cached. */
  status(dealId, template = 'dark') {
    return request(`/api/reels/${dealId}/status?template=${template}`);
  },

  /** Clear cached reel files for a deal. */
  clear(dealId) {
    return request(`/api/reels/${dealId}`, { method: 'DELETE' });
  },

  /** Record that user copied the caption (analytics). */
  recordCopied(dealId, template = 'dark') {
    return request(`/api/reels/${dealId}/copied`, {
      method: 'POST',
      body:   JSON.stringify({ template }),
    });
  },
};

// ── Telegram ──────────────────────────────────────────────────────────────────

export const telegramApi = {
  send(title, price, image, link, originalPrice, discount, platform) {
    return request('/telegram', {
      method: 'POST',
      body:   JSON.stringify({ title, price, image, link, originalPrice, savings: discount, platform }),
    });
  },

  sendMessage(message) {
    return request('/telegram-message', {
      method: 'POST',
      body:   JSON.stringify({ message }),
    });
  },
};

// ── Health ────────────────────────────────────────────────────────────────────

export const healthApi = {
  check() { return request('/health'); },
  metrics() { return request('/metrics'); },
};

// ── System ────────────────────────────────────────────────────────────────────

export const systemApi = {
  cronStatus()    { return request('/api/system/cron-status'); },
  telegramDebug() { return request('/api/system/telegram-debug'); },
  health()        { return request('/api/system/health'); },

  testTelegram()     { return request('/api/system/test/telegram',  { method: 'POST' }); },
  testCron()         { return request('/api/system/test/cron',      { method: 'POST' }); },
  testAffiliate()    { return request('/api/system/test/affiliate', { method: 'POST' }); },
  testScraper()      { return request('/api/system/test/scraper',   { method: 'POST' }); },
  testEarnkaro(url)  {
    return request('/api/system/test/earnkaro', {
      method: 'POST',
      body:   JSON.stringify({ url }),
    });
  },

  // Auto Mode
  getAutoMode()             { return request('/api/system/auto-mode'); },
  setAutoMode(enabled)      { return request('/api/system/auto-mode', { method: 'POST', body: JSON.stringify({ enabled }) }); },

  // Per-deal retry
  retryTelegram(dealId)     { return request(`/api/system/retry/${dealId}/telegram`,  { method: 'POST' }); },
  retryAffiliate(dealId)    { return request(`/api/system/retry/${dealId}/affiliate`, { method: 'POST' }); },
};

// ── Auth ──────────────────────────────────────────────────────────────────────

export const authApi = {
  login(email, password) {
    return request('/api/auth/login', {
      method: 'POST',
      body:   JSON.stringify({ email, password }),
    });
  },
  me() { return request('/api/auth/me'); },
};

// ── Dashboard ─────────────────────────────────────────────────────────────────

export const dashboardApi = {
  get() { return request('/api/dashboard'); },
};

export { ApiError };
