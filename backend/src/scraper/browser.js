/**
 * Singleton Browser Manager
 *
 * Uses puppeteer.executablePath() — bundled Chromium, no system Chrome.
 *
 * --single-process and --no-zygote are intentionally OMITTED:
 *   --single-process collapses all renderer processes into one; any navigation
 *   crash kills the entire browser, causing the "Target closed" / "frame
 *   detached" crash loop seen in production logs.
 */

const puppeteer = require('puppeteer');
const logger    = require('../../utils/logger');

const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
];

const LAUNCH_ARGS = [
  '--no-sandbox',
  '--disable-setuid-sandbox',
  '--disable-dev-shm-usage',
  '--disable-gpu',
  '--disable-extensions',
  '--disable-background-networking',
  '--disable-background-timer-throttling',
  '--disable-renderer-backgrounding',
  '--disable-backgrounding-occluded-windows',
  '--window-size=1366,768',
  '--disable-blink-features=AutomationControlled',
];

let _browser       = null;
let _launchPromise = null; // mutex — prevents concurrent relaunch races

async function getBrowser() {
  if (_browser && _browser.isConnected()) return _browser;

  // If a launch is already in progress, wait for it instead of starting another
  if (_launchPromise) return _launchPromise;

  const executablePath = puppeteer.executablePath();
  logger.info(`[Browser] Launching — ${executablePath}`);

  _launchPromise = puppeteer
    .launch({
      headless:        'new',
      executablePath,
      args:            LAUNCH_ARGS,
      defaultViewport: { width: 1366, height: 768 },
      timeout:         60000,
      protocolTimeout: 60000,
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
      _browser       = null;
      logger.error(`[Browser] Launch FAILED: ${err.message}`);
      throw err;
    });

  return _launchPromise;
}

async function closeBrowser() {
  if (_browser) {
    await _browser.close().catch(() => {});
    _browser = null;
  }
}

async function openPage({ blockAssets = false, ua = null } = {}) {
  let browser = await getBrowser();
  let page;

  try {
    page = await browser.newPage();
  } catch (err) {
    // Browser went away between getBrowser() and newPage() — relaunch once
    logger.warn(`[Browser] newPage failed (${err.message}) — relaunching`);
    _browser = null;
    browser  = await getBrowser();
    page     = await browser.newPage();
  }

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
