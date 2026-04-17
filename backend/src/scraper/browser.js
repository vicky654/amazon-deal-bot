/**
 * Singleton Browser Manager
 *
 * Resolves Chrome in this order:
 *   1. PUPPETEER_EXECUTABLE_PATH env var (explicit override)
 *   2. puppeteer.executablePath()  (bundled Chromium, downloaded at npm install)
 *
 * Never hardcodes /usr/bin/google-chrome-stable — that only exists when
 * apt-get install google-chrome-stable ran, which Render does not allow.
 */

const puppeteer = require('puppeteer');
const logger    = require('../../utils/logger');

const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:123.0) Gecko/20100101 Firefox/123.0',
];

// Critical flags for running in containerised/restricted environments (Render, Docker, etc.)
const LAUNCH_ARGS = [
  '--no-sandbox',
  '--disable-setuid-sandbox',
  '--disable-dev-shm-usage',   // use /tmp instead of /dev/shm (small in containers)
  '--disable-gpu',
  '--no-zygote',               // prevents privileged zygote process (required on Render)
  '--single-process',          // avoids forking issues in restricted containers
  '--disable-extensions',
  '--disable-background-networking',
  '--window-size=1366,768',
  '--disable-blink-features=AutomationControlled',
];

let _browser       = null;
let _launchPromise = null;

function getExecutablePath() {
  // Explicit override (e.g. set in Render dashboard pointing to a known Chrome)
  if (process.env.PUPPETEER_EXECUTABLE_PATH) {
    return process.env.PUPPETEER_EXECUTABLE_PATH;
  }
  // Bundled Chromium downloaded by puppeteer during npm install
  try {
    return puppeteer.executablePath();
  } catch {
    return undefined;
  }
}

async function getBrowser() {
  if (_browser && _browser.isConnected()) return _browser;
  if (_launchPromise) return _launchPromise;

  const executablePath = getExecutablePath();
  logger.info(`[Browser] Launching — executablePath: ${executablePath || 'not resolved'}`);

  _launchPromise = puppeteer
    .launch({
      headless:        'new',
      executablePath,
      args:            LAUNCH_ARGS,
      defaultViewport: { width: 1366, height: 768 },
      timeout:         30000,
    })
    .then((browser) => {
      _browser       = browser;
      _launchPromise = null;

      browser.on('disconnected', () => {
        logger.warn('[Browser] Disconnected — will relaunch on next request');
        _browser = null;
      });

      logger.info('[Browser] Launched OK');
      return browser;
    })
    .catch((err) => {
      _launchPromise = null;
      logger.error(`[Browser] Launch FAILED: ${err.message}`);
      logger.error('[Browser] If on Render: ensure PUPPETEER_SKIP_CHROMIUM_DOWNLOAD is NOT set');
      throw err;
    });

  return _launchPromise;
}

async function closeBrowser() {
  if (_browser) {
    await _browser.close().catch((e) => logger.warn('[Browser] Close error:', e.message));
    _browser = null;
  }
}

/**
 * Opens a stealth page. Always call page.close() after use.
 */
async function openPage({ blockAssets = false, ua = null } = {}) {
  const browser = await getBrowser();
  const page    = await browser.newPage();

  await page.setUserAgent(ua || randomAgent());
  await page.setExtraHTTPHeaders({
    'Accept-Language': 'en-IN,en;q=0.9',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  });

  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
    window.chrome = { runtime: {} };
  });

  if (blockAssets) {
    await page.setRequestInterception(true);
    page.on('request', (req) => {
      if (['image', 'font', 'media', 'stylesheet'].includes(req.resourceType())) {
        req.abort();
      } else {
        req.continue();
      }
    });
  }

  return page;
}

function randomAgent() {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

function randomDelay(min = 1500, max = 4000) {
  return sleep(min + Math.floor(Math.random() * (max - min)));
}

module.exports = { getBrowser, closeBrowser, openPage, randomDelay, sleep };
