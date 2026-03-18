/**
 * EarnKaro Affiliate Link Generator
 *
 * Self-healing flow:
 *   1. Load cookies (MongoDB → file fallback)
 *   2. Pre-flight age check → fire background refresh if cookies > 10h old
 *   3. Navigate to link generator
 *   4. If session expired at runtime → auto re-login (if credentials in memory) + retry
 *   5. Max 3 attempts total
 *
 * Concurrency: MUST be called through the affiliate queue (concurrency=1).
 *              EarnKaro blocks parallel sessions.
 */

const { openPage, randomDelay, sleep } = require('../scraper/browser');
const sessionSvc = require('../services/earnkaroSession');
const logger     = require('../../utils/logger');

const { EARNKARO_LINK_PAGE, SEL, COOKIE_HEALTHY_HOURS } = sessionSvc;

// Sentinel thrown internally to signal session-expired + credentials available
const SESSION_REFRESHED = 'SESSION_REFRESHED';

// ── Pre-flight: background cookie age check ───────────────────────────────────

function _triggerBackgroundRefreshIfNeeded() {
  sessionSvc.getHealth().then((health) => {
    if (
      health.connected &&
      health.cookieAgeHours > COOKIE_HEALTHY_HOURS * 0.8 &&
      health.health !== 'expired' &&
      sessionSvc.hasCredentials()
    ) {
      logger.info(`[EarnKaro] Cookies ${health.cookieAgeHours}h old — scheduling background refresh`);
      const autoRefresh = require('../services/earnkaroAutoRefresh');
      autoRefresh.runRefresh().catch((err) =>
        logger.warn(`[EarnKaro] Background refresh failed: ${err.message}`)
      );
    }
  }).catch(() => {});
}

// ── Core generator ────────────────────────────────────────────────────────────

async function generateEarnKaroLink(productUrl, attempt = 1, maxAttempts = 3) {
  // Pre-flight check (non-blocking — does not delay generation)
  if (attempt === 1) _triggerBackgroundRefreshIfNeeded();

  const page = await openPage({ blockAssets: false });

  try {
    logger.info(`[EarnKaro][Attempt ${attempt}] Generating link: ${productUrl}`);

    // Inject cookies
    const cookies = await sessionSvc.loadCookies();
    const normalised = cookies.map((c) => ({
      name:     c.name,
      value:    c.value,
      domain:   c.domain || 'app.earnkaro.com',
      path:     c.path   || '/',
      expires:  c.expirationDate || c.expires || -1,
      httpOnly: c.httpOnly || false,
      secure:   c.secure  || false,
      sameSite: c.sameSite || 'Lax',
    }));
    await page.setCookie(...normalised);

    await page.goto(EARNKARO_LINK_PAGE, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await randomDelay(2000, 4000);

    // Session validation — URL check is the most reliable signal
    const currentUrl     = page.url();
    const redirectedToAuth = /login|signin|sign-in|auth/i.test(currentUrl);
    const loggedIn       = await page.$$(SEL.loginCheck);
    const onLoginPg      = await page.$(SEL.loginPage);
    const sessionExpired = redirectedToAuth || (loggedIn.length === 0 && onLoginPg);

    if (sessionExpired) {
      await sessionSvc.markSessionStatus('expired');
      await sessionSvc.addLog('session_expired', 'warn', `Session expired during link generation (attempt ${attempt})`);

      // Auto re-login if credentials available
      if (sessionSvc.hasCredentials() && attempt < maxAttempts) {
        logger.info('[EarnKaro] Session expired — auto re-login in progress...');
        await sessionSvc.addLog('auto_relogin', 'info', 'Auto re-login triggered during affiliate generation');

        const creds      = sessionSvc.getCredentials();
        const newCookies = await sessionSvc.performLogin(creds.email, creds.password);
        await sessionSvc.saveSession(newCookies, creds.email, 'auto');

        throw new Error(SESSION_REFRESHED); // caught below → clean retry
      }

      throw new Error(
        'EarnKaro session expired. Re-login via Admin → Settings → EarnKaro Login.'
      );
    }

    // Find URL input
    const inputSels = SEL.urlInput.split(', ');
    let inputEl = null;
    for (const sel of inputSels) {
      inputEl = await page.$(sel);
      if (inputEl) break;
    }
    if (!inputEl) throw new Error('URL input not found on EarnKaro page');

    await inputEl.click({ clickCount: 3 });
    await inputEl.type(productUrl, { delay: 60 });
    await randomDelay(500, 1000);

    // Find generate button
    const btnSels = SEL.generateBtn.split(', ');
    let btnEl = null;
    for (const sel of btnSels) {
      btnEl = await page.$(sel);
      if (btnEl) break;
    }
    if (!btnEl) throw new Error('Generate button not found on EarnKaro page');

    await btnEl.click();
    logger.info('[EarnKaro] Clicked generate — polling for link...');

    // Poll for output link
    const outputSels = SEL.outputLink.split(', ');
    for (let i = 0; i < 20; i++) {
      await sleep(800);
      for (const sel of outputSels) {
        const val = await page.$eval(sel, (el) => el.value || el.innerText || '').catch(() => '');
        if (val && (val.startsWith('http') || val.includes('ekaro') || val.includes('earnkaro'))) {
          logger.info(`[EarnKaro] Link generated: ${val.trim()}`);
          return val.trim();
        }
      }
    }

    // Last resort: scrape any EarnKaro short link from the page
    const allLinks = await page.evaluate(() =>
      Array.from(document.querySelectorAll('a, input[readonly]'))
        .map((el) => el.href || el.value || '')
        .filter((v) => v.includes('ekaro.in') || v.includes('earnkaro'))
    );
    if (allLinks.length > 0) {
      logger.info(`[EarnKaro] Fallback link: ${allLinks[0]}`);
      return allLinks[0];
    }

    throw new Error('Affiliate link not generated after 16 seconds');

  } catch (err) {
    const isSessionRefreshed = err.message === SESSION_REFRESHED;
    const isExpired          = err.message.includes('session expired') || err.message.includes('Re-login');

    logger.error(`[EarnKaro][Attempt ${attempt}] ${err.message}`);

    // Retry after auto re-login (session was refreshed → new cookies available)
    if (isSessionRefreshed && attempt < maxAttempts) {
      await page.close().catch(() => {});
      await sleep(2000);
      return generateEarnKaroLink(productUrl, attempt + 1, maxAttempts);
    }

    // Retry for transient errors (not session expiry)
    if (!isExpired && !isSessionRefreshed && attempt < maxAttempts) {
      await sleep(attempt * 5000);
      await page.close().catch(() => {});
      return generateEarnKaroLink(productUrl, attempt + 1, maxAttempts);
    }

    throw err;
  } finally {
    await page.close().catch(() => {});
  }
}

module.exports = { generateEarnKaroLink };
