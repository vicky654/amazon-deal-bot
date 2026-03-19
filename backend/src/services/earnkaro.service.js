/**
 * EarnKaro Debug Service
 *
 * Wraps the full link-generation pipeline with per-step status tracking.
 * Used exclusively by the debug panel / test endpoint for diagnostic visibility.
 *
 * Steps:
 *   1. browser       → launch Puppeteer page
 *   2. cookies       → load session cookies from DB / file
 *   3. loginCheck    → navigate to link generator, check if logged in
 *   4. login         → auto re-login if session expired (uses stored credentials)
 *   5. openConverter → confirm we're on the link generator page
 *   6. inputUrl      → fill the product URL into the input field
 *   7. convert       → click the generate button
 *   8. extract       → poll for and read the affiliate link from the page
 *
 * Production pipeline:  src/affiliate/earnkaro.js  (no step tracking)
 * Debug / testing:      this file                  (full step tracking)
 */

const { openPage, randomDelay, sleep } = require('../scraper/browser');
const sessionSvc = require('./earnkaroSession');
const logger     = require('../../utils/logger');

const { EARNKARO_LINK_PAGE, SEL } = sessionSvc;

const STEP_DEFS = [
  { key: 'browser',       label: 'Launch Browser' },
  { key: 'cookies',       label: 'Load Cookies' },
  { key: 'loginCheck',    label: 'Check Login Status' },
  { key: 'login',         label: 'Login (if needed)' },
  { key: 'openConverter', label: 'Open Link Converter' },
  { key: 'inputUrl',      label: 'Enter Product URL' },
  { key: 'convert',       label: 'Click Convert' },
  { key: 'extract',       label: 'Extract Affiliate Link' },
];

const STEP_KEYS = STEP_DEFS.map((s) => s.key);

// ── Step Tracker ──────────────────────────────────────────────────────────────

class StepTracker {
  constructor() {
    this.steps = {};
    this.logs  = [];
    for (const { key } of STEP_DEFS) {
      this.steps[key] = { status: 'pending', error: null, attempts: 0, startedAt: null, doneAt: null };
    }
  }

  start(key) {
    this.steps[key].status    = 'running';
    this.steps[key].startedAt = new Date().toISOString();
    this._log(key, `Step started: ${key}`);
  }

  success(key, note = '') {
    const s    = this.steps[key];
    s.status   = 'success';
    s.doneAt   = new Date().toISOString();
    s.error    = null;
    s.duration = s.startedAt ? Date.now() - new Date(s.startedAt).getTime() : null;
    this._log(key, note || `Step completed: ${key}`);
  }

  fail(key, error) {
    const s    = this.steps[key];
    s.status   = 'failed';
    s.error    = typeof error === 'string' ? error : error?.message || String(error);
    s.doneAt   = new Date().toISOString();
    s.duration = s.startedAt ? Date.now() - new Date(s.startedAt).getTime() : null;
    this._log(key, `Step failed: ${s.error}`, 'error');
  }

  skip(key, reason = '') {
    this.steps[key].status  = 'skipped';
    this.steps[key].doneAt  = new Date().toISOString();
    this._log(key, reason || `Step skipped: ${key}`);
  }

  incAttempts(key) { this.steps[key].attempts++; }

  _log(step, message, level = 'info') {
    const entry = { step, message, level, time: new Date().toISOString() };
    this.logs.push(entry);
    logger[level === 'error' ? 'error' : 'info'](`[EarnKaro][Debug][${step}] ${message}`);
  }

  get progress() {
    const done = STEP_KEYS.filter((k) => ['success', 'skipped'].includes(this.steps[k].status)).length;
    return Math.round((done / STEP_KEYS.length) * 100);
  }

  get firstFailedStep() {
    return STEP_KEYS.find((k) => this.steps[k].status === 'failed') || null;
  }

  // Mark all still-pending steps as skipped (used when pipeline aborts early)
  skipRemaining() {
    for (const key of STEP_KEYS) {
      if (this.steps[key].status === 'pending') {
        this.steps[key].status = 'skipped';
        this.steps[key].doneAt = new Date().toISOString();
      }
    }
  }
}

// ── Helper: normalise cookies for Puppeteer ────────────────────────────────────

function normaliseCookies(raw) {
  return raw.map((c) => ({
    name:     c.name,
    value:    c.value,
    domain:   c.domain   || 'app.earnkaro.com',
    path:     c.path     || '/',
    expires:  c.expirationDate || c.expires || -1,
    httpOnly: c.httpOnly || false,
    secure:   c.secure   || false,
    sameSite: c.sameSite || 'Lax',
  }));
}

// ── Core debug converter ───────────────────────────────────────────────────────

/**
 * Run the full EarnKaro link-generation pipeline with step tracking.
 *
 * @param {string} productUrl  Flipkart / Ajio / Myntra product URL
 * @param {object} [opts]
 * @param {number} [opts.maxRetries=2]  Max login retry attempts on session expiry
 * @returns {Promise<DebugResult>}
 */
async function debugConvert(productUrl, { maxRetries = 2 } = {}) {
  const tracker   = new StepTracker();
  const startedAt = Date.now();
  let   page      = null;

  try {
    // ── STEP 1: browser ────────────────────────────────────────────────────────
    tracker.start('browser');
    try {
      page = await openPage({ blockAssets: false });
      tracker.success('browser', 'Puppeteer page opened successfully');
    } catch (err) {
      tracker.fail('browser', err);
      tracker.skipRemaining();
      throw err;
    }

    // ── STEP 2: cookies ────────────────────────────────────────────────────────
    tracker.start('cookies');
    let rawCookies;
    try {
      rawCookies = await sessionSvc.loadCookies();
    } catch (err) {
      tracker.fail('cookies', err);
      tracker.skipRemaining();
      throw new Error(`No EarnKaro session — ${err.message}`);
    }
    await page.setCookie(...normaliseCookies(rawCookies));
    tracker.success('cookies', `${rawCookies.length} cookies loaded and injected`);

    // ── STEP 3: loginCheck ─────────────────────────────────────────────────────
    tracker.start('loginCheck');
    await page.goto(EARNKARO_LINK_PAGE, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    await randomDelay(2000, 3500);

    const afterNav       = page.url();
    const authRedirect   = /login|signin|sign-in|auth/i.test(afterNav);
    const navElements    = await page.$$(SEL.loginCheck);
    const loginPageEl    = await page.$(SEL.loginPage);
    const sessionExpired = authRedirect || (navElements.length === 0 && !!loginPageEl);

    let needLogin = false;
    if (sessionExpired) {
      tracker.fail('loginCheck', `Session expired — redirected to: ${afterNav}`);
      needLogin = true;
    } else {
      tracker.success('loginCheck', `Session active — nav elements found: ${navElements.length}`);
    }

    // ── STEP 4: login (conditional) ────────────────────────────────────────────
    if (needLogin) {
      tracker.start('login');

      if (!sessionSvc.hasCredentials()) {
        tracker.fail('login', 'No credentials in memory — cannot auto re-login. Please re-login from Settings → EarnKaro.');
        tracker.skipRemaining();
        throw new Error('Session expired and no credentials stored.');
      }

      let loginOk = false;
      let lastErr = null;

      for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
        tracker.incAttempts('login');
        try {
          const creds      = sessionSvc.getCredentials();
          const newCookies = await sessionSvc.performLogin(creds.email, creds.password);
          await sessionSvc.saveSession(newCookies, creds.email, 'auto');

          // Re-inject fresh cookies
          await page.setCookie(...normaliseCookies(newCookies));
          loginOk = true;
          break;
        } catch (err) {
          lastErr = err;
          tracker._log('login', `Login attempt ${attempt} failed: ${err.message}`, 'warn');
          if (attempt <= maxRetries) await sleep(2000 * attempt);
        }
      }

      if (!loginOk) {
        tracker.fail('login', lastErr?.message || 'Login failed after all retries');
        tracker.skipRemaining();
        throw new Error(`EarnKaro login failed: ${lastErr?.message}`);
      }
      tracker.success('login', `Auto re-login successful (${tracker.steps.login.attempts} attempt(s))`);
    } else {
      tracker.skip('login', 'Session still valid — login step skipped');
    }

    // ── STEP 5: openConverter ──────────────────────────────────────────────────
    tracker.start('openConverter');

    if (needLogin) {
      // Navigate fresh after re-login
      await page.goto(EARNKARO_LINK_PAGE, { waitUntil: 'domcontentloaded', timeout: 30_000 });
      await randomDelay(2000, 3000);
    }

    const converterUrl = page.url();
    if (/login|signin/i.test(converterUrl)) {
      tracker.fail('openConverter', `Still on auth page: ${converterUrl}`);
      tracker.skipRemaining();
      throw new Error('Could not reach link converter after login');
    }
    tracker.success('openConverter', `On link generator: ${converterUrl}`);

    // ── STEP 6: inputUrl ────────────────────────────────────────────────────────
    tracker.start('inputUrl');

    const inputSels = SEL.urlInput.split(', ');
    let inputEl     = null;
    let inputSel    = null;
    for (const sel of inputSels) {
      inputEl = await page.$(sel);
      if (inputEl) { inputSel = sel; break; }
    }

    if (!inputEl) {
      tracker.fail('inputUrl', 'URL input field not found — EarnKaro page structure may have changed');
      tracker.skipRemaining();
      throw new Error('URL input not found on EarnKaro link generator page');
    }

    await inputEl.click({ clickCount: 3 });
    await inputEl.type(productUrl, { delay: 50 });
    await randomDelay(500, 1000);
    tracker.success('inputUrl', `URL entered via selector: ${inputSel}`);

    // ── STEP 7: convert ─────────────────────────────────────────────────────────
    tracker.start('convert');

    const btnSels = SEL.generateBtn.split(', ');
    let btnEl     = null;
    let btnSel    = null;
    for (const sel of btnSels) {
      btnEl = await page.$(sel);
      if (btnEl) { btnSel = sel; break; }
    }

    if (!btnEl) {
      tracker.fail('convert', 'Generate/Convert button not found on page');
      tracker.skipRemaining();
      throw new Error('Generate button not found on EarnKaro page');
    }

    await btnEl.click();
    tracker.success('convert', `Clicked via selector: ${btnSel} — polling for result…`);

    // ── STEP 8: extract ─────────────────────────────────────────────────────────
    tracker.start('extract');

    const outputSels  = SEL.outputLink.split(', ');
    let affiliateLink = null;

    // Poll up to 20×800ms = 16 seconds
    for (let i = 0; i < 20 && !affiliateLink; i++) {
      await sleep(800);
      for (const sel of outputSels) {
        const val = await page.$eval(sel, (el) => el.value || el.innerText || '').catch(() => '');
        if (val && (val.startsWith('http') || val.includes('ekaro') || val.includes('earnkaro'))) {
          affiliateLink = val.trim();
          break;
        }
      }
    }

    // Last resort: scan all links / read-only inputs on the page
    if (!affiliateLink) {
      const pageLinks = await page.evaluate(() =>
        Array.from(document.querySelectorAll('a, input[readonly]'))
          .map((el) => el.href || el.value || '')
          .filter((v) => v.includes('ekaro.in') || v.includes('earnkaro'))
      ).catch(() => []);
      if (pageLinks.length > 0) affiliateLink = pageLinks[0];
    }

    if (!affiliateLink) {
      tracker.fail('extract', 'Affiliate link not generated within 16s — EarnKaro UI may have changed');
      throw new Error('Affiliate link not generated — check EarnKaro page selectors');
    }

    tracker.success('extract', `Link extracted: ${affiliateLink}`);

    await sessionSvc.addLog('debug_convert_ok', 'info',
      `Debug convert success: ${productUrl.slice(0, 60)} → ${affiliateLink.slice(0, 60)}`,
      { productUrl, affiliateLink }
    ).catch(() => {});

    return _buildResult({ success: true, affiliateLink, productUrl, tracker, startedAt });

  } catch (err) {
    tracker.skipRemaining();

    await sessionSvc.addLog('debug_convert_fail', 'error',
      `Debug convert failed: ${err.message}`,
      { productUrl, failedStep: tracker.firstFailedStep }
    ).catch(() => {});

    return _buildResult({ success: false, error: err.message, productUrl, tracker, startedAt });
  } finally {
    if (page) await page.close().catch(() => {});
  }
}

function _buildResult({ success, affiliateLink, error, productUrl, tracker, startedAt }) {
  return {
    success,
    affiliateLink:  success ? affiliateLink : productUrl,   // fallback to original on failure
    originalUrl:    productUrl,
    error:          error || null,
    steps:          tracker.steps,
    stepDefs:       STEP_DEFS,
    logs:           tracker.logs,
    progress:       tracker.progress,
    failedStep:     tracker.firstFailedStep,
    duration:       Date.now() - startedAt,
  };
}

// ── Session guard helper ──────────────────────────────────────────────────────

/**
 * ensureEarnKaroSession — verify a session exists before starting a pipeline.
 * Throws if no cookies are stored. Does NOT spin up a browser.
 */
async function ensureEarnKaroSession() {
  const cookies = await sessionSvc.loadCookies();
  return {
    ok:           true,
    cookiesCount: cookies.length,
    hasCredentials: sessionSvc.hasCredentials(),
  };
}

module.exports = { debugConvert, ensureEarnKaroSession, STEP_DEFS };
