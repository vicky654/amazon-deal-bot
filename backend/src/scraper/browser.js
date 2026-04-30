'use strict';
/**
 * Singleton Browser Manager — puppeteer-extra + stealth + persistent profile
 *
 * Key anti-bot measures:
 *   1. Persistent Chrome profile (chrome-profile/) — accumulates cookies/history
 *   2. ignoreHTTPSErrors + --ignore-certificate-errors — fixes ERR_CERT_AUTHORITY_INVALID
 *   3. Comprehensive evaluateOnNewDocument patches — covers webdriver, plugins, WebGL, chrome.runtime
 *   4. HEADLESS=false env var — visible Chrome for debugging
 *   5. Single setExtraHTTPHeaders call — previous code overwrote all headers on 2nd call
 *   6. UA matches actual Chromium 121 binary (puppeteer@21.6)
 *
 * Launch reliability hardening:
 *   - Lock-file cleanup before every launch (SingletonLock, SingletonCookie, SingletonSocket)
 *   - Kill lingering chrome.exe on Windows before launch
 *   - 2-attempt launch: first with existing profile, then with quarantined profile
 *   - Wait for in-progress close before re-launching (prevents launch-while-closing race)
 *   - Full Chromium stderr/stdout captured and logged on failure
 *   - _isClosing race guard prevents double-close
 */

const fs               = require('fs');
const path             = require('path');
const { exec }         = require('child_process');
const puppeteerVanilla = require('puppeteer');
const puppeteer        = require('puppeteer-extra');
const StealthPlugin    = require('puppeteer-extra-plugin-stealth');
const logger           = require('../../utils/logger');

puppeteer.use(StealthPlugin());

// ── Config ────────────────────────────────────────────────────────────────────

const CHROME_PROFILE_DIR = path.join(__dirname, '..', '..', 'chrome-profile');

// Default to headless Chrome. Visible mode disabled to prevent resource exhaustion.
const IS_HEADLESS = true; 

const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.6167.85 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
];

const HUMAN_VIEWPORTS = [
  { width: 1280, height: 720 },
  { width: 1366, height: 768 },
  { width: 1440, height: 900 },
  { width: 1536, height: 864 },
  { width: 1920, height: 1080 },
];

const LAUNCH_ARGS = [
  '--no-sandbox',
  '--disable-setuid-sandbox',
  '--disable-dev-shm-usage',
  '--disable-gpu',
  '--no-zygote',
  '--single-process',
  '--lang=en-IN',
  '--window-size=1366,768',
];

// ── Stealth patches (unchanged from working version) ──────────────────────────
const STEALTH_SCRIPT = `
(function() {
  try { Object.defineProperty(navigator, 'webdriver', { get: () => undefined, configurable: true }); } catch(e) {}

  try {
    const fakePdf    = { name: 'Chrome PDF Plugin',  filename: 'internal-pdf-viewer',             description: 'Portable Document Format', length: 1 };
    const fakeViewer = { name: 'Chrome PDF Viewer',  filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai', description: '', length: 1 };
    const fakeNacl   = { name: 'Native Client',      filename: 'internal-nacl-plugin',             description: '', length: 2 };
    const arr = [fakePdf, fakeViewer, fakeNacl];
    arr.item = (i) => arr[i] || null;
    arr.namedItem = (n) => arr.find(p => p.name === n) || null;
    arr.refresh = () => {};
    Object.defineProperty(navigator, 'plugins', { get: () => arr, configurable: true });
  } catch(e) {}

  try { Object.defineProperty(navigator, 'languages',           { get: () => ['en-IN', 'en-US', 'en'], configurable: true }); } catch(e) {}
  try { Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => 8, configurable: true }); } catch(e) {}
  try { Object.defineProperty(navigator, 'deviceMemory',        { get: () => 8, configurable: true }); } catch(e) {}

  try {
    if (!window.chrome || !window.chrome.runtime) {
      const noop = () => {};
      const listener = { addListener: noop, removeListener: noop, hasListener: noop };
      window.chrome = {
        app: { isInstalled: false },
        csi: () => ({}),
        loadTimes: () => ({ firstPaintTime: Date.now()/1000, startLoadTime: Date.now()/1000 }),
        runtime: {
          id: undefined, connect: noop, sendMessage: noop, getManifest: () => ({}),
          onMessage: listener, onConnect: listener, onInstalled: listener,
          PlatformOs:   { WIN: 'win', MAC: 'mac', LINUX: 'linux', ANDROID: 'android', CROS: 'cros' },
          PlatformArch: { X86_32: 'x86-32', X86_64: 'x86-64', ARM: 'arm', ARM64: 'arm64' },
          RequestUpdateCheckStatus: { NO_UPDATE: 'no_update', THROTTLED: 'throttled', UPDATE_AVAILABLE: 'update_available' },
          OnInstalledReason: { INSTALL: 'install', UPDATE: 'update', CHROME_UPDATE: 'chrome_update' },
        },
        webstore: { onInstallStageChanged: listener, onDownloadProgress: listener, install: noop },
      };
    }
  } catch(e) {}

  try {
    const origQuery = window.Permissions.prototype.query;
    window.Permissions.prototype.query = function(params) {
      if (params.name === 'notifications') return Promise.resolve({ state: 'denied', onchange: null });
      return origQuery.call(this, params);
    };
  } catch(e) {}

  try {
    const patchGL = (Ctx) => {
      if (!Ctx) return;
      const orig = Ctx.prototype.getParameter;
      Ctx.prototype.getParameter = function(p) {
        if (p === 37445) return 'Intel Inc.';
        if (p === 37446) return 'Intel Iris OpenGL Engine';
        return orig.call(this, p);
      };
    };
    patchGL(window.WebGLRenderingContext);
    patchGL(window.WebGL2RenderingContext);
  } catch(e) {}

  try {
    Object.defineProperty(screen, 'width',       { get: () => 1366, configurable: true });
    Object.defineProperty(screen, 'height',      { get: () => 768,  configurable: true });
    Object.defineProperty(screen, 'availWidth',  { get: () => 1366, configurable: true });
    Object.defineProperty(screen, 'availHeight', { get: () => 728,  configurable: true });
    Object.defineProperty(screen, 'colorDepth',  { get: () => 24,   configurable: true });
    Object.defineProperty(screen, 'pixelDepth',  { get: () => 24,   configurable: true });
  } catch(e) {}

  try { delete window._phantom; }      catch(e) {}
  try { delete window.callPhantom; }   catch(e) {}
  try { delete window.__nightmare; }   catch(e) {}
  try { delete window.domAutomation; } catch(e) {}
})();
`;

// ── Browser lifecycle limits ──────────────────────────────────────────────────
const MAX_PAGES_BEFORE_RESTART = parseInt(process.env.BROWSER_MAX_PAGES   || '300', 10);
const MAX_BROWSER_AGE_MIN      = parseInt(process.env.BROWSER_MAX_AGE_MIN || '240', 10);
const MAX_BROWSER_AGE_MS       = MAX_BROWSER_AGE_MIN * 60 * 1000;

// ── Module state ──────────────────────────────────────────────────────────────

let _browser       = null;
let _launchPromise = null;
let _closePromise  = null;   // resolves when an in-progress close finishes
let _warmUpDone    = false;
let _pageCount     = 0;
let _browserStart  = 0;
let _isClosing     = false;

// ── Pre-launch helpers ────────────────────────────────────────────────────────

/**
 * Count running chrome.exe processes (Windows only).
 */
function _countChromeProcesses() {
  if (process.platform !== 'win32') return Promise.resolve(0);
  return new Promise((resolve) => {
    exec('tasklist /FI "IMAGENAME eq chrome.exe" /FO CSV /NH 2>NUL', (err, stdout) => {
      if (err || !stdout) return resolve(0);
      resolve((stdout.match(/chrome\.exe/gi) || []).length);
    });
  });
}

/**
 * Poll until all chrome.exe processes are gone or timeout elapses.
 */
async function waitForChromeToDie(maxWaitMs = 8000) {
  if (process.platform !== 'win32') return true;
  const deadline = Date.now() + maxWaitMs;
  while (Date.now() < deadline) {
    const count = await _countChromeProcesses();
    if (count === 0) {
      logger.info('[Browser] All chrome.exe confirmed gone');
      return true;
    }
    logger.debug(`[Browser] Waiting for ${count} chrome.exe to exit…`);
    await sleep(400);
  }
  const remaining = await _countChromeProcesses();
  if (remaining > 0) {
    logger.warn(`[Browser] ${remaining} chrome.exe still present after ${maxWaitMs}ms — proceeding anyway`);
  }
  return remaining === 0;
}

/**
 * Check Local State and Default/Preferences JSON files for corruption.
 */
function validateAndRepairProfile(profileDir) {
  const files = [
    path.join(profileDir, 'Local State'),
    path.join(profileDir, 'Default', 'Preferences'),
  ];
  for (const filePath of files) {
    if (!fs.existsSync(filePath)) continue;
    try {
      JSON.parse(fs.readFileSync(filePath, 'utf8'));
      logger.debug(`[Browser] Profile file OK: ${path.basename(filePath)}`);
    } catch (e) {
      logger.warn(`[Browser] Corrupt profile file: ${filePath} — resetting to {}`);
      try {
        fs.writeFileSync(filePath, '{}', 'utf8');
        logger.info(`[Browser] Reset ${path.basename(filePath)} to {}`);
      } catch (we) {
        logger.error(`[Browser] Could not repair ${filePath}: ${we.message}`);
      }
    }
  }
}

/**
 * Log Node.js memory + chrome.exe count immediately before a launch attempt.
 */
async function logResourcesBeforeLaunch() {
  const mem = process.memoryUsage();
  const chromeCount = await _countChromeProcesses();
  logger.info(
    `[Browser] Pre-launch — Node RSS: ${Math.round(mem.rss / 1024 / 1024)} MB, ` +
    `heap: ${Math.round(mem.heapUsed / 1024 / 1024)}/${Math.round(mem.heapTotal / 1024 / 1024)} MB, ` +
    `chrome.exe: ${chromeCount}`
  );
}

/**
 * Delete Chrome's singleton lock files left behind by crashed sessions.
 */
function clearChromeLocks(profileDir) {
  const LOCKS = ['SingletonLock', 'SingletonCookie', 'SingletonSocket'];
  let removed = 0;
  for (const name of LOCKS) {
    const lockPath = path.join(profileDir, name);
    try {
      if (fs.existsSync(lockPath)) {
        fs.unlinkSync(lockPath);
        removed++;
        logger.info(`[Browser] Removed stale lock: ${lockPath}`);
      }
    } catch (e) {
      logger.warn(`[Browser] Could not remove ${name}: ${e.message}`);
    }
  }
  if (removed === 0) logger.debug('[Browser] No stale lock files found');
  return removed;
}

/**
 * On Windows: kill orphaned chrome.exe processes that hold our profile lock.
 */
function killLingeringChrome() {
  if (process.platform !== 'win32') return Promise.resolve(0);
 
  // Only kill if our profile has orphaned lock files — indicates a previous crash
  const hasLock = ['SingletonLock', 'SingletonCookie', 'SingletonSocket']
    .some(name => fs.existsSync(path.join(CHROME_PROFILE_DIR, name)));
 
  if (!hasLock) {
    logger.debug('[Browser] No Puppeteer lock files found — skipping kill');
    return Promise.resolve(0);
  }
 
  return new Promise((resolve) => {
    console.log('[Browser] cleaning orphan chrome processes');
    // Escape backslashes for PowerShell
    const escapedProfile = CHROME_PROFILE_DIR.replace(/\\/g, '\\\\');
    const psCommand = `Get-CimInstance Win32_Process -Filter "Name = 'chrome.exe' AND CommandLine LIKE '%${escapedProfile}%'" | Stop-Process -Force`;
    
    exec(`powershell -Command "${psCommand}"`, (killErr) => {
      if (killErr) {
        logger.debug(`[Browser] orphan cleanup status: ${killErr.message}`);
      } else {
        logger.info('[Browser] Targeted orphan chrome processes terminated');
      }
      resolve(1);
    });
  });
}

/**
 * Rename a corrupted profile dir to chrome-profile-corrupt-{timestamp} and
 * create a fresh empty profile dir so the next launch can start clean.
 */
function quarantineProfile(profileDir) {
  const timestamp   = Date.now();
  const corruptPath = `${profileDir}-corrupt-${timestamp}`;
  try {
    fs.renameSync(profileDir, corruptPath);
    logger.warn(`[Browser] Quarantined corrupt profile → ${corruptPath}`);
  } catch (e) {
    logger.error(`[Browser] Could not quarantine profile (${e.message}) — will overwrite`);
  }
  try {
    fs.mkdirSync(profileDir, { recursive: true });
    logger.info(`[Browser] Fresh profile directory created: ${profileDir}`);
  } catch (e) {
    logger.error(`[Browser] Could not create fresh profile dir: ${e.message}`);
  }
}

/**
 * Log a detailed, actionable launch failure report.
 */
function logLaunchFailure(err, profileDir, attempt) {
  const msg   = (err && (err.message || err.toString())) || '(no message — Chromium likely crashed silently)';
  const stack = (err && err.stack) ? `\n${err.stack}` : '';
  logger.error(`[Browser] ════════════════════════════════════════════════`);
  logger.error(`[Browser] LAUNCH FAILED (attempt ${attempt})`);
  logger.error(`[Browser]   Error   : ${msg}${stack}`);
  logger.error(`[Browser]   Profile : ${profileDir}`);
  logger.error(`[Browser] ════════════════════════════════════════════════`);
}

// ── Core launch ────────────────────────────────────────────────────────────

async function _doLaunch(profileDir, headlessMode) {
  const executablePath = puppeteerVanilla.executablePath();
  const dumpio         = process.env.DEBUG_BROWSER === 'true';
  logger.info(`[Render] Chromium path detected: ${executablePath}`);
  logger.info(`[Browser] Launching — headless=${headlessMode} profile=${profileDir} dumpio=${dumpio}`);
  logger.info(`[Render] Puppeteer launched`);

  return puppeteer.launch({
    headless:          headlessMode,
    executablePath,
    userDataDir:       profileDir,
    args:              LAUNCH_ARGS,
    ignoreHTTPSErrors: true,
    defaultViewport:   { width: 1366, height: 768 },
    timeout:           60000,
    protocolTimeout:   90000,
    dumpio,
  });
}

// ── Browser lifecycle ─────────────────────────────────────────────────────────

async function getBrowser() {
  if (_closePromise) {
    logger.debug('[Browser] Waiting for in-progress close before launching…');
    await _closePromise;
  }

  if (_browser && _browser.isConnected()) return _browser;
  if (_launchPromise) return _launchPromise;

  fs.mkdirSync(CHROME_PROFILE_DIR, { recursive: true });

  _launchPromise = _safeLaunch();
  return _launchPromise;
}

async function _safeLaunch() {
  await logResourcesBeforeLaunch();
  await killLingeringChrome();
  await waitForChromeToDie(8000);   // poll until ALL chrome.exe truly gone
  clearChromeLocks(CHROME_PROFILE_DIR);
  validateAndRepairProfile(CHROME_PROFILE_DIR);

  const headlessFallback = true;
 
  // ── SINGLETON ATTEMPT: Legacy headless (headless=true) ─────────────────────
  // Legacy mode is significantly more stable for long-running crawlers on Windows.
  try {
    console.log('[Browser] existing browser reused');
    const chromeCount = await _countChromeProcesses();
    console.log(`[Browser] chrome.exe count: ${chromeCount}`);
    return _onLaunchSuccess(await _doLaunch(CHROME_PROFILE_DIR, headlessFallback));
  } catch (err) {
    logLaunchFailure(err, CHROME_PROFILE_DIR, 1);
    logger.warn('[Browser] Launch failed — retrying with fresh profile…');
  }

  await waitForChromeToDie(8000);
  clearChromeLocks(CHROME_PROFILE_DIR);
  quarantineProfile(CHROME_PROFILE_DIR);

  try {
    logger.warn('[Browser] Attempt 2: fresh profile…');
    const browser = await _doLaunch(CHROME_PROFILE_DIR, headlessFallback);
    return _onLaunchSuccess(browser);
  } catch (err) {
    _launchPromise = null;
    _browser       = null;
    throw err;
  }
}

function _onLaunchSuccess(browser) {
  _browser       = browser;
  _launchPromise = null;
  _pageCount     = 0;
  _browserStart  = Date.now();

  logger.info('[Render] Browser connected');

  browser.on('disconnected', () => {
    logger.warn('[Browser] ⚠ Chromium disconnected unexpectedly');
    _browser      = null;
    _warmUpDone   = false;
    _pageCount    = 0;
    _browserStart = 0;
    _isClosing    = false;
    _closePromise = null;
  });

  logger.info('[Browser] Launched OK');
  return browser;
}

async function closeBrowser(reason = 'explicit close') {
  if (_isClosing || !_browser) return;
  _isClosing = true;

  const browserRef  = _browser;
  _browser          = null;
  _warmUpDone       = false;
  _pageCount        = 0;
  _browserStart     = 0;

  _closePromise = browserRef.close()
    .catch((e) => logger.warn(`[Browser] close() error: ${e.message}`))
    .then(() => { logger.info('[Browser] Closed OK'); })
    .finally(() => {
      _isClosing    = false;
      _closePromise = null;
    });

  return _closePromise;
}

// ── Warm-up ──────────────────────────────────────────────────────────────────
async function warmUpBrowser() {
  if (_warmUpDone) return;
  _warmUpDone = true;

  logger.info('[Browser] Warm-up: visiting https://www.amazon.in/ to build session cookies…');

  let page = null;
  try {
    page = await openPage({ blockAssets: false });
    await page.goto('https://www.amazon.in/', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await sleep(2000 + rand(1500));
  } catch (err) {
    logger.warn(`[Browser] Warm-up failed: ${err.message}`);
  } finally {
    if (page) await page.close().catch(() => {});
  }
}

// ── Open page ─────────────────────────────────────────────────────────────────
async function openPage({ blockAssets = false, ua = null } = {}) {
  let browser = await getBrowser();
  let page;
 
  try {
    const pages = await browser.pages();
    console.log(`[Browser] open pages: ${pages.length}`);
    
    // Page limit and recycling
    const PAGE_THRESHOLD = 5;
    if (pages.length > PAGE_THRESHOLD) {
      console.log('[Browser] recycling pages');
      // Close all but the first (blank/background) page
      for (let i = 1; i < pages.length; i++) {
        await pages[i].close().catch(() => {});
      }
    }

    page = await browser.newPage();
  } catch (err) {
    logger.warn(`[Browser] newPage failed (${err.message}) — relaunching`);
    _browser = null;
    browser  = await getBrowser();
    page     = await browser.newPage();
  }

  _pageCount++;

  const chosenUA = ua || USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
  await page.setUserAgent(chosenUA);

  // Randomise viewport per page to break deterministic fingerprinting
  const vp = HUMAN_VIEWPORTS[Math.floor(Math.random() * HUMAN_VIEWPORTS.length)];
  await page.setViewport({ width: vp.width, height: vp.height, deviceScaleFactor: 1 });
  await page.evaluateOnNewDocument(`(function(){
    try {
      Object.defineProperty(screen, 'width',       { get: () => ${vp.width},  configurable: true });
      Object.defineProperty(screen, 'height',      { get: () => ${vp.height}, configurable: true });
      Object.defineProperty(screen, 'availWidth',  { get: () => ${vp.width},  configurable: true });
      Object.defineProperty(screen, 'availHeight', { get: () => ${vp.height - 40}, configurable: true });
    } catch(e){}
  })();`);

  await page.setExtraHTTPHeaders({
    'Accept-Language':           'en-IN,en;q=0.9',
    'Accept':                    'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
    'Accept-Encoding':           'gzip, deflate, br',
    'Upgrade-Insecure-Requests': '1',
    'Cache-Control':             'max-age=0',
    'DNT':                       '1',
  });

  await page.setBypassCSP(true);
  await page.evaluateOnNewDocument(STEALTH_SCRIPT);

  if (blockAssets && blockAssets !== 'none') {
    const blockSet = blockAssets === 'heavy'
      ? new Set(['image', 'font', 'media', 'stylesheet'])
      : new Set(['font', 'media']);

    await page.setRequestInterception(true);
    page.on('request', (req) => {
      if (blockSet.has(req.resourceType())) req.abort();
      else                                  req.continue();
    });
  }

  return page;
}

// ── Utilities ─────────────────────────────────────────────────────────────────

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }
function rand(max) { return Math.floor(Math.random() * max); }

function randomDelay(min = 1500, max = 4000) {
  return sleep(min + rand(max - min));
}

// ── Human-like behaviour helpers ──────────────────────────────────────────────

async function simulateHuman(page) {
  const moves = 3 + Math.floor(Math.random() * 4);
  for (let i = 0; i < moves; i++) {
    const x = 150 + Math.floor(Math.random() * 1000);
    const y = 80  + Math.floor(Math.random() * 620);
    await page.mouse.move(x, y, { steps: 10 + Math.floor(Math.random() * 12) });
    await sleep(120 + Math.floor(Math.random() * 400));
  }
  if (Math.random() < 0.25) {
    const w = 1280 + Math.floor(Math.random() * 160);
    const h = 700  + Math.floor(Math.random() * 120);
    await page.setViewport({ width: w, height: h }).catch(() => {});
    await sleep(150 + Math.floor(Math.random() * 250));
  }
  if (Math.random() < 0.4) {
    const hx = 300 + Math.floor(Math.random() * 700);
    const hy = 200 + Math.floor(Math.random() * 400);
    await page.mouse.move(hx, hy, { steps: 5 });
    await sleep(400 + Math.floor(Math.random() * 800));
  }
}

async function smoothScroll(page, targetY) {
  await page.evaluate((target) => {
    return new Promise((resolve) => {
      const step  = Math.max(40, Math.ceil(target / 25));
      let   pos   = window.scrollY || 0;
      const timer = setInterval(() => {
        pos = Math.min(pos + step, target);
        window.scrollTo(0, pos);
        if (pos >= target) { clearInterval(timer); resolve(); }
      }, 55);
    });
  }, targetY);
}

// ── Browser diagnostics ───────────────────────────────────────────────────────

function getBrowserDiagnostics() {
  const ageMs = _browserStart ? Date.now() - _browserStart : 0;
  return {
    connected:  !!_browser && _browser.isConnected(),
    isClosing:  _isClosing,
    warmUpDone: _warmUpDone,
    pageCount:  _pageCount,
    pageLimit:  MAX_PAGES_BEFORE_RESTART,
    ageMinutes: Math.round(ageMs / 60000),
    ageLimit:   MAX_BROWSER_AGE_MIN,
  };
}

// ── Lifecycle check — call at START of each crawler cycle, BEFORE warmup ─────
/**
 * Checks if the browser has exceeded page count or age limits and restarts it
 * if needed. Must be called BEFORE warmUpBrowser()/cycleWarmUp() so that after
 * a restart the full warm-up chain runs and session trust is rebuilt properly.
 *
 * Returns true if a restart was performed, false if browser is healthy.
 */
async function checkLifecycle() {
  if (!_browser || !_browser.isConnected() || _isClosing) return false;

  const ageMs        = _browserStart ? Date.now() - _browserStart : 0;
  const ageLimitHit  = ageMs >= MAX_BROWSER_AGE_MS;
  const pageLimitHit = _pageCount >= MAX_PAGES_BEFORE_RESTART;

  if (!ageLimitHit && !pageLimitHit) {
    logger.debug(
      `[Browser] checkLifecycle: healthy — pages=${_pageCount}/${MAX_PAGES_BEFORE_RESTART} ` +
      `age=${Math.round(ageMs / 60000)}/${MAX_BROWSER_AGE_MIN}min`
    );
    return false;
  }

  const reason = ageLimitHit
    ? `age limit reached (${Math.round(ageMs / 60000)}/${MAX_BROWSER_AGE_MIN} min)`
    : `page limit reached (${_pageCount}/${MAX_PAGES_BEFORE_RESTART} pages)`;

  logger.info(`[Browser] ♻ checkLifecycle: planned restart — ${reason}`);
  logger.info(`[Browser]   (Triggered at cycle boundary — NOT mid-scrape)`);

  await closeBrowser(reason);
  return true;
}

// ── Browser stats — for external diagnostics / debug routes ──────────────────
function getBrowserStats() {
  const ageMs = _browserStart ? Date.now() - _browserStart : 0;
  return {
    connected:   !!_browser && _browser.isConnected(),
    isClosing:   _isClosing,
    warmUpDone:  _warmUpDone,
    pageCount:   _pageCount,
    pageLimit:   MAX_PAGES_BEFORE_RESTART,
    ageMinutes:  Math.round(ageMs / 60000),
    ageLimit:    MAX_BROWSER_AGE_MIN,
  };
}

module.exports = {
  getBrowser, closeBrowser, openPage, warmUpBrowser,
  checkLifecycle, getBrowserStats, getBrowserDiagnostics,
  randomDelay, sleep, simulateHuman, smoothScroll,
  // Exposed for server.js graceful shutdown and self-test
  clearChromeLocks, killLingeringChrome, waitForChromeToDie,
  validateAndRepairProfile, CHROME_PROFILE_DIR,
};
