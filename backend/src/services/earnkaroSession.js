/**
 * EarnKaro Session Service
 *
 * Single source of truth for all EarnKaro session operations:
 *   - AES-256-GCM encrypted in-memory credential store (auto-refresh, no DB persistence)
 *   - Puppeteer login automation
 *   - Cookie persistence  (MongoDB primary, file fallback)
 *   - Session health calculation
 *   - Structured event logging  (earnkaro_logs collection, capped at 200)
 *
 * Security:
 *   - Credentials never written to disk or DB
 *   - Runtime key generated fresh on each process start
 *   - Cookies not exposed raw in any API response
 */

const crypto  = require('crypto');
const fs      = require('fs');
const path    = require('path');

const { openPage, randomDelay, sleep } = require('../scraper/browser');
const EarnKaroSession = require('../models/EarnKaroSession');
const EarnKaroLog     = require('../models/EarnKaroLog');
const logger          = require('../../utils/logger');

// ── Constants ─────────────────────────────────────────────────────────────────

const COOKIES_PATH = path.resolve(
  process.env.EARNKARO_COOKIES_PATH ||
  path.join(__dirname, '../../earnkaro-cookies.json')
);

const COOKIE_HEALTHY_HOURS  = parseInt(process.env.EARNKARO_HEALTHY_HOURS  || '12', 10);
const COOKIE_EXPIRING_HOURS = parseInt(process.env.EARNKARO_EXPIRING_HOURS || '20', 10);
const LOG_CAP               = 200;

const EARNKARO_APP_URL  = 'https://app.earnkaro.com/';
const EARNKARO_LINK_PAGE = 'https://app.earnkaro.com/link-generator';

const LOGIN_URLS = [
  'https://earnkaro.com/login',
  'https://earnkaro.com/sign-in',
  'https://earnkaro.com/signin',
  'https://app.earnkaro.com/login',
  'https://app.earnkaro.com/sign-in',
  'https://app.earnkaro.com/',
  'https://earnkaro.com/',
];

const SEL = {
  // ── Login page selectors ─────────────────────────────────────────────────────
  email:    ['input[type="email"]', 'input[name="email"]', 'input[name="phone"]', 'input[type="text"][name*="email" i]', 'input[placeholder*="email" i]', 'input[placeholder*="phone" i]', 'input[type="tel"]'],
  password: ['input[type="password"]'],
  submit:   ['button[type="submit"]', 'button[class*="login" i]', 'button[class*="signin" i]', 'input[type="submit"]', 'button[class*="btn" i][class*="primary" i]'],
  dashboard:['[class*="dashboard"]', '[class*="profile"]', '.user-name', '[class*="username"]', 'nav [class*="user"]', '[data-testid="user-menu"]'],
  loginForm:['input[type="email"]', 'input[type="password"]'],

  // ── Link generator page selectors ─────────────────────────────────────────
  // Elements present when the user IS logged in (absence → session expired)
  loginCheck: '[class*="navbar"], [class*="sidebar"], [class*="topbar"], [class*="user-menu"], [class*="user-profile"], [class*="user-avatar"], a[href*="logout"], nav',

  // Element present when the user is on the login page (confirms redirect)
  loginPage:  'input[type="password"]',

  // Product URL input field on link-generator page (tried in order)
  urlInput:   'input[placeholder*="url" i], input[placeholder*="link" i], input[placeholder*="paste" i], input[placeholder*="product" i], input[name="url"], input[id*="url" i], input[type="text"]',

  // Generate / Convert affiliate link button
  generateBtn:'button[type="submit"], button[class*="generate" i], button[class*="convert" i], button[class*="create" i], button[class*="shorten" i], [class*="btn"][class*="primary" i]',

  // Where the generated short link appears (read-only input or result area)
  outputLink: 'input[readonly], input[id*="output" i], input[id*="result" i], input[id*="short" i], [class*="output" i] input, [class*="result" i] input, [class*="generated" i] input, [class*="affiliate" i] input',
};

// ── In-Memory AES-256-GCM Credential Store ────────────────────────────────────
// Runtime key: generated once at process start, lives only in memory, never persisted.

const _RUNTIME_KEY = crypto.randomBytes(32);
let   _encryptedCreds = null;   // { iv, data, tag } — all hex strings
let   _loginLock      = false;  // Prevent parallel Puppeteer logins

// ── In-Memory Session Status Cache ───────────────────────────────────────────
// Lightweight synchronous status for dashboard health checks (no DB query).

let _statusCache = { connected: false, healthScore: 0, updatedAt: null };

function _updateStatusCache(connected, healthScore = 0) {
  _statusCache = { connected, healthScore, updatedAt: new Date().toISOString() };
}

/**
 * Synchronous session status snapshot — no DB query, suitable for health endpoints.
 * Updated whenever saveSession / markSessionStatus runs.
 */
function getSessionStatus() {
  return {
    connected:      _statusCache.connected,
    healthScore:    _statusCache.healthScore,
    updatedAt:      _statusCache.updatedAt,
    hasCredentials: hasCredentials(),
  };
}

function _encrypt(obj) {
  const iv     = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-gcm', _RUNTIME_KEY, iv);
  const enc    = Buffer.concat([cipher.update(JSON.stringify(obj), 'utf8'), cipher.final()]);
  return { iv: iv.toString('hex'), data: enc.toString('hex'), tag: cipher.getAuthTag().toString('hex') };
}

function _decrypt(stored) {
  const dec = crypto.createDecipheriv('aes-256-gcm', _RUNTIME_KEY, Buffer.from(stored.iv, 'hex'));
  dec.setAuthTag(Buffer.from(stored.tag, 'hex'));
  return JSON.parse(Buffer.concat([dec.update(Buffer.from(stored.data, 'hex')), dec.final()]).toString('utf8'));
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function maskEmail(email) {
  if (!email) return '';
  if (!email.includes('@')) return `${email[0]}***`;
  const [local, domain] = email.split('@');
  const parts = domain.split('.');
  return `${local[0]}***@${parts[0][0]}***.${parts.slice(1).join('.')}`;
}

async function findEl(page, selectors) {
  for (const sel of selectors) {
    const el = await page.$(sel).catch(() => null);
    if (el) return { el, sel };
  }
  return null;
}

// ── Structured Logging ────────────────────────────────────────────────────────

async function addLog(event, level, message, meta = {}) {
  const logFn = level === 'error' ? 'error' : level === 'warn' ? 'warn' : 'info';
  logger[logFn](`[EarnKaro][${event}] ${message}`);

  try {
    await EarnKaroLog.create({ event, level, message, meta });

    // Cap at LOG_CAP entries
    const total = await EarnKaroLog.countDocuments();
    if (total > LOG_CAP) {
      const excess = await EarnKaroLog.find()
        .sort({ createdAt: 1 })
        .limit(total - LOG_CAP)
        .select('_id')
        .lean();
      if (excess.length) await EarnKaroLog.deleteMany({ _id: { $in: excess.map((l) => l._id) } });
    }
  } catch (err) {
    logger.warn(`[EarnKaro] Log write failed: ${err.message}`);
  }
}

async function getLogs(limit = 50) {
  try {
    return EarnKaroLog.find().sort({ createdAt: -1 }).limit(Math.min(limit, LOG_CAP)).lean();
  } catch {
    return [];
  }
}

// ── Credential Store API ──────────────────────────────────────────────────────

function storeCredentials(email, password) {
  _encryptedCreds = _encrypt({ email, password });
  logger.info(`[EarnKaro] Credentials stored in memory (${maskEmail(email)})`);
}

function getCredentials() {
  if (!_encryptedCreds) return null;
  try   { return _decrypt(_encryptedCreds); }
  catch { _encryptedCreds = null; return null; }
}

function hasCredentials() { return _encryptedCreds !== null; }

function clearCredentials() { _encryptedCreds = null; }

// ── Cookie Persistence ────────────────────────────────────────────────────────

async function saveSession(cookies, email, loginMethod = 'auto') {
  _updateStatusCache(true, 100);   // Mark connected immediately (optimistic)
  await EarnKaroSession.deleteMany({});
  const session = await EarnKaroSession.create({
    cookies,
    cookiesCount:     cookies.length,
    email:            maskEmail(email),
    loginMethod,
    lastValidated:    new Date(),
    validationStatus: 'healthy',
  });

  // Sync to fallback file
  try { fs.writeFileSync(COOKIES_PATH, JSON.stringify(cookies, null, 2), 'utf8'); } catch (_) {}

  return session;
}

async function loadCookies() {
  // 1. MongoDB
  try {
    const session = await EarnKaroSession.findOne().sort({ createdAt: -1 }).lean();
    if (session?.cookies?.length > 0) return session.cookies;
  } catch (err) {
    logger.warn(`[EarnKaro] MongoDB load failed: ${err.message} — trying file`);
  }

  // 2. File fallback
  if (fs.existsSync(COOKIES_PATH)) {
    try { return JSON.parse(fs.readFileSync(COOKIES_PATH, 'utf8')); } catch (_) {}
  }

  throw new Error('No EarnKaro session. Login via Admin → Settings → EarnKaro Login.');
}

// ── Session Health ────────────────────────────────────────────────────────────

async function getHealth() {
  try {
    const session = await EarnKaroSession.findOne().sort({ createdAt: -1 }).lean();

    if (!session) {
      if (fs.existsSync(COOKIES_PATH)) {
        const stat     = fs.statSync(COOKIES_PATH);
        const ageHours = (Date.now() - new Date(stat.mtime)) / 3_600_000;
        return _buildHealth({ ageHours, loginMethod: 'manual', lastValidated: stat.mtime, validationStatus: 'unknown' });
      }
      return { connected: false, health: 'unknown', hasCredentials: hasCredentials() };
    }

    const ageHours = (Date.now() - new Date(session.updatedAt || session.createdAt)) / 3_600_000;
    return _buildHealth({
      ageHours,
      loginMethod:      session.loginMethod,
      lastValidated:    session.lastValidated || session.updatedAt,
      validationStatus: session.validationStatus || 'unknown',
      email:            session.email,
      cookiesCount:     session.cookiesCount,
    });
  } catch (err) {
    return { connected: false, health: 'unknown', error: err.message, hasCredentials: hasCredentials() };
  }
}

function _buildHealth({ ageHours, loginMethod, lastValidated, validationStatus, email, cookiesCount }) {
  const age = Math.round(ageHours * 10) / 10;

  let health;
  if (validationStatus === 'expired' || ageHours >= COOKIE_EXPIRING_HOURS) health = 'expired';
  else if (ageHours >= COOKIE_HEALTHY_HOURS)                               health = 'expiring';
  else                                                                     health = 'healthy';

  const nextRefreshHours = hasCredentials()
    ? Math.max(0, Math.round((COOKIE_HEALTHY_HOURS - ageHours) * 10) / 10)
    : null;

  return {
    connected:        true,
    health,
    cookieAgeHours:   age,
    cookieAgePct:     Math.min(100, Math.round((ageHours / COOKIE_EXPIRING_HOURS) * 100)),
    lastValidated,
    validationStatus,
    loginMethod,
    email:            email || '',
    cookiesCount:     cookiesCount || 0,
    hasCredentials:   hasCredentials(),
    nextRefreshHours,
    thresholds:       { healthyHours: COOKIE_HEALTHY_HOURS, expiringHours: COOKIE_EXPIRING_HOURS },
  };
}

async function markSessionStatus(status) {
  if (status === 'expired') _updateStatusCache(false, 0);
  else if (status === 'healthy') _updateStatusCache(true, 100);
  try {
    await EarnKaroSession.findOneAndUpdate(
      {},
      { $set: { validationStatus: status, lastValidated: new Date() } },
      { sort: { createdAt: -1 } }
    );
  } catch (_) {}
}

// ── Puppeteer Login ───────────────────────────────────────────────────────────

async function performLogin(email, password) {
  if (_loginLock) throw new Error('Login already in progress — please wait');
  _loginLock = true;

  let page = null;
  try {
    page = await openPage({ blockAssets: false });

    // Try login URLs in order — stop at first URL that shows an email/password form
    let loginFound = false;
    for (const url of LOGIN_URLS) {
      try {
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
        await randomDelay(1800, 3000);

        // Check URL and presence of auth form
        const currentUrl = page.url();
        const onAuthPage = /login|signin|sign-in|auth/i.test(currentUrl);
        const hasForm    = await findEl(page, SEL.email);
        if (hasForm || onAuthPage) {
          // Verify there's actually an email field
          if (await findEl(page, SEL.email)) { loginFound = true; break; }
        }
      } catch (_) {}
    }
    if (!loginFound) {
      throw new Error(
        'EarnKaro login page not found — the site may be temporarily down, or the URL structure has changed. ' +
        'Try again in a few minutes, or use manual cookie export as a fallback.'
      );
    }

    // Fill email
    const emailField = await findEl(page, SEL.email);
    if (!emailField) throw new Error('Email/phone input not found');
    await emailField.el.click({ clickCount: 3 });
    await emailField.el.type(email, { delay: 60 });
    await randomDelay(500, 1000);

    // Fill password
    const passField = await findEl(page, SEL.password);
    if (!passField) throw new Error('Password input not found');
    await passField.el.click({ clickCount: 3 });
    await passField.el.type(password, { delay: 60 });
    await randomDelay(500, 1000);

    // Submit
    const submitBtn = await findEl(page, SEL.submit);
    if (!submitBtn) throw new Error('Submit button not found');
    await submitBtn.el.click();

    // Wait for navigation or dashboard
    await Promise.race([
      page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 20000 }).catch(() => {}),
      page.waitForSelector(SEL.dashboard.join(', '), { timeout: 20000 }).catch(() => {}),
      sleep(8000),
    ]);
    await randomDelay(2000, 3000);

    // Detect login failure
    const currentUrl = page.url();
    const stillLogin = await findEl(page, SEL.loginForm);
    if (stillLogin && (currentUrl.includes('login') || currentUrl.includes('signin'))) {
      const errorMsg = await page.evaluate(() => {
        for (const s of ['[class*="error"]', '[class*="alert"]', '[role="alert"]', '.toast', '[class*="message"]']) {
          const el = document.querySelector(s);
          if (el?.innerText?.trim()) return el.innerText.trim();
        }
        return null;
      }).catch(() => null);
      throw new Error(errorMsg || 'Login failed — check email and password');
    }

    const rawCookies = await page.cookies();
    if (!rawCookies?.length) throw new Error('Login succeeded but no cookies captured');

    return rawCookies;
  } finally {
    _loginLock = false;
    if (page) await page.close().catch(() => {});
  }
}

// ── Session Test (Puppeteer) ──────────────────────────────────────────────────

async function testSession() {
  const cookies = await loadCookies();
  let page = null;
  try {
    page = await openPage({ blockAssets: false });
    await page.setCookie(...cookies.map((c) => ({
      name:     c.name,
      value:    c.value,
      domain:   c.domain || 'app.earnkaro.com',
      path:     c.path   || '/',
      expires:  c.expirationDate || c.expires || -1,
      httpOnly: c.httpOnly || false,
      secure:   c.secure  || false,
    })));

    await page.goto(EARNKARO_APP_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await randomDelay(2000, 3000);

    const onLogin = await findEl(page, SEL.loginForm);
    const valid   = !onLogin;

    await markSessionStatus(valid ? 'healthy' : 'expired');
    await addLog(
      valid ? 'validation' : 'session_expired',
      valid ? 'info' : 'warn',
      valid ? 'Session validation passed' : 'Session validation failed — cookies expired'
    );
    return valid;
  } finally {
    if (page) await page.close().catch(() => {});
  }
}

// ── Getters exposed for other modules ────────────────────────────────────────

module.exports = {
  // Credentials
  storeCredentials,
  getCredentials,
  hasCredentials,
  clearCredentials,

  // Session ops
  performLogin,
  saveSession,
  loadCookies,
  testSession,

  // Health + status
  getHealth,
  getSessionStatus,
  markSessionStatus,

  // Logging
  addLog,
  getLogs,

  // Helpers
  maskEmail,

  // Constants (read-only)
  COOKIE_HEALTHY_HOURS,
  COOKIE_EXPIRING_HOURS,
  EARNKARO_LINK_PAGE,
  SEL,
};
