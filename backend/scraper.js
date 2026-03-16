/**
 * Amazon Product Scraper
 *
 * Features:
 * - Singleton browser instance (launch once, reuse across all scrapes)
 * - 3-attempt retry with exponential backoff
 * - Bot / CAPTCHA detection
 * - Random user-agent rotation
 * - Random delays to reduce ban risk
 * - Multiple fallback selectors for every field
 * - Detailed error logging so failures are never silent
 */

const puppeteer = require("puppeteer");
const { buildAffiliateLink, extractAsin } = require("./utils/affiliate");
const logger = require("./utils/logger");

/*
 * ─── CONSTANTS ──────────────────────────────────────────────────────────────
 */

const MAX_SCRAPE_ATTEMPTS = 3;
const DEALS_PAGES_TO_SCAN = 5;

const USER_AGENTS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:123.0) Gecko/20100101 Firefox/123.0",
];

/*
 * ─── SELECTOR LISTS (ordered by reliability) ────────────────────────────────
 * Multiple fallbacks protect against Amazon A/B testing and layout changes.
 */

const TITLE_SELECTORS = [
  "#productTitle",
  "#title span",
  ".product-title-word-break",
  "h1.a-size-large",
];

const DEAL_PRICE_SELECTORS = [
  ".priceToPay .a-offscreen",
  ".apexPriceToPay .a-offscreen",
  "#corePriceDisplay_desktop_feature_div .a-offscreen",
  "#corePrice_desktop .a-offscreen",
  "#priceblock_dealprice",
  "#priceblock_ourprice",
  "#sns-base-price",
  ".a-price[data-a-color='price'] .a-offscreen",
  ".a-price .a-offscreen",
  ".a-price-whole",
];

const ORIGINAL_PRICE_SELECTORS = [
  ".basisPrice .a-offscreen",
  ".priceBlockStrikePriceString",
  "#priceblock_listprice",
  "#listPrice",
  ".a-price.a-text-price .a-offscreen",
  ".a-text-price .a-offscreen",
  ".a-size-small.a-color-secondary.a-text-strike",
  "[data-a-strike='true'] .a-offscreen",
];

const IMAGE_SELECTORS = [
  "#landingImage",
  "#imgBlkFront",
  "#main-image",
  "#imageBlock img",
  ".a-dynamic-image",
];

/*
 * ─── BOT DETECTION SIGNALS ──────────────────────────────────────────────────
 */

const BOT_SIGNALS = [
  "Enter the characters you see below",
  "Sorry, we just need to make sure you're not a robot",
  "automated access",
  "CAPTCHA",
  "api-services-support@amazon",
  "Type the characters you see in this image",
];

/*
 * ─── BROWSER MANAGER (singleton) ────────────────────────────────────────────
 */

let _browser = null;
let _launchPromise = null;

/**
 * Returns the shared browser instance, launching it if necessary.
 * Handles concurrent callers safely via a single launch promise.
 */
async function getBrowser() {
  if (_browser && _browser.isConnected()) {
    return _browser;
  }

  // If a launch is already in progress, wait for it instead of launching twice
  if (_launchPromise) {
    return _launchPromise;
  }

  logger.info("Launching Puppeteer browser...");

  _launchPromise = puppeteer
    .launch({
      headless: "new",
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
        "--window-size=1280,800",
        "--disable-blink-features=AutomationControlled",
      ],
      defaultViewport: { width: 1280, height: 800 },
    })
    .then((browser) => {
      _browser = browser;
      _launchPromise = null;

      browser.on("disconnected", () => {
        logger.warn("Browser disconnected — will relaunch on next request");
        _browser = null;
      });

      logger.info("Browser launched successfully");
      return browser;
    })
    .catch((err) => {
      _launchPromise = null;
      throw err;
    });

  return _launchPromise;
}

/**
 * Closes the shared browser. Call this on graceful shutdown.
 */
async function closeBrowser() {
  if (_browser) {
    logger.info("Closing browser...");
    await _browser.close().catch((e) => logger.warn("Browser close error:", e.message));
    _browser = null;
  }
}

/*
 * ─── HELPERS ────────────────────────────────────────────────────────────────
 */

function randomAgent() {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function randomDelay(minMs = 2000, maxMs = 5000) {
  const ms = minMs + Math.floor(Math.random() * (maxMs - minMs));
  return sleep(ms);
}

/**
 * Parses a price string like "₹1,299.00" → 1299
 * Exported for unit testing.
 */
function cleanPrice(text) {
  if (!text) return null;
  const number = parseFloat(text.replace(/[^0-9.]/g, ""));
  return isNaN(number) ? null : number;
}

function isBotPage(content) {
  return BOT_SIGNALS.some((signal) => content.includes(signal));
}

function isProductUrl(url) {
  return url.includes("/dp/") || url.includes("/gp/product/");
}

/*
 * ─── PAGE EVALUATION ────────────────────────────────────────────────────────
 * Runs inside the browser context — no access to Node.js scope.
 * Selector arrays are passed in as serialised arguments.
 */

function pageEvaluator(dealSelectors, originalSelectors, titleSelectors, imageSelectors) {
  function queryText(selectors) {
    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (el) {
        const text = (el.innerText || el.textContent || "").trim();
        if (text) return text;
      }
    }
    return null;
  }

  function queryAttr(selectors, attr) {
    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (el && el[attr]) return el[attr];
    }
    return null;
  }

  function parsePrice(text) {
    if (!text) return null;
    const n = parseFloat(text.replace(/[^0-9.]/g, ""));
    return isNaN(n) ? null : n;
  }

  const title = queryText(titleSelectors);
  const priceText = queryText(dealSelectors);
  const originalText = queryText(originalSelectors);
  const image = queryAttr(imageSelectors, "src");

  const price = parsePrice(priceText);
  const originalPrice = parsePrice(originalText);

  let savings = null;
  if (price && originalPrice && originalPrice > price) {
    savings = Math.round(((originalPrice - price) / originalPrice) * 100);
  }

  return {
    title,
    price,
    originalPrice,
    savings,
    image,
    link: window.location.href,
    _debug: { priceText, originalText },
  };
}

/*
 * ─── CORE SCRAPER ───────────────────────────────────────────────────────────
 */

/**
 * Scrapes an Amazon product page with up to MAX_SCRAPE_ATTEMPTS retries.
 *
 * @param {string} url  Amazon product URL
 * @param {number} attempt  Internal — current attempt number (1-indexed)
 * @returns {Promise<object>} Product data
 */
async function scrapeAmazonProduct(url, attempt = 1) {
  const browser = await getBrowser();
  const page = await browser.newPage();

  try {
    await page.setUserAgent(randomAgent());
    await page.setExtraHTTPHeaders({ "Accept-Language": "en-US,en;q=0.9" });

    // On retries, block non-essential resources to reduce load time and fingerprint
    if (attempt > 1) {
      await page.setRequestInterception(true);
      page.on("request", (req) => {
        if (["image", "font", "media"].includes(req.resourceType())) {
          req.abort();
        } else {
          req.continue();
        }
      });
    }

    logger.info(`[Attempt ${attempt}/${MAX_SCRAPE_ATTEMPTS}] Scraping: ${url}`);

    await page.goto(url, {
      // domcontentloaded is faster and more reliable on Amazon than networkidle2
      waitUntil: "domcontentloaded",
      timeout: 45000,
    });

    // Human-like random pause
    await randomDelay(1500, 3500);

    // Check for bot/CAPTCHA detection
    const pageContent = await page.content();
    if (isBotPage(pageContent)) {
      throw new Error("Bot detection triggered — CAPTCHA or verification page");
    }

    // Check for unexpected redirects (e.g. to homepage or search results)
    const currentUrl = page.url();
    if (!isProductUrl(currentUrl)) {
      throw new Error(`Redirected away from product page: ${currentUrl}`);
    }

    // Wait for the title — soft fail so layout changes don't crash the whole scrape
    try {
      await page.waitForSelector(TITLE_SELECTORS[0], { timeout: 8000 });
    } catch {
      logger.warn(`Primary title selector not found — trying fallbacks`);
    }

    const raw = await page.evaluate(
      pageEvaluator,
      DEAL_PRICE_SELECTORS,
      ORIGINAL_PRICE_SELECTORS,
      TITLE_SELECTORS,
      IMAGE_SELECTORS
    );

    if (!raw.title) {
      throw new Error("Product title not found — page layout may have changed");
    }

    // Remove debug info before returning
    const { _debug, ...product } = raw;

    // Attach affiliate data
    const asin = extractAsin(product.link);
    product.asin = asin;
    product.link = asin ? buildAffiliateLink(product.link) : product.link;

    logger.info(
      `Scraped: "${product.title}" | Price: ₹${product.price} | Original: ₹${product.originalPrice} | Savings: ${product.savings}%`
    );

    return product;
  } catch (error) {
    logger.error(`Scrape attempt ${attempt} failed [${url}]: ${error.message}`);

    if (attempt < MAX_SCRAPE_ATTEMPTS) {
      const backoffMs = attempt * 3000;
      logger.info(`Retrying in ${backoffMs / 1000}s... (attempt ${attempt + 1}/${MAX_SCRAPE_ATTEMPTS})`);
      await sleep(backoffMs);
      // Page is closed in finally before the recursive call proceeds
      return scrapeAmazonProduct(url, attempt + 1);
    }

    throw new Error(
      `Failed to scrape after ${MAX_SCRAPE_ATTEMPTS} attempts — last error: ${error.message}`
    );
  } finally {
    // Always close the page to release memory, regardless of success or retry
    await page.close().catch((e) => logger.warn(`Page close error: ${e.message}`));
  }
}

/*
 * ─── DEALS PAGE SCANNER ─────────────────────────────────────────────────────
 */

/**
 * Scans Amazon deals pages and returns unique product URLs.
 * Uses the shared browser instance.
 *
 * @returns {Promise<string[]>}
 */
async function findDealProducts() {
  const browser = await getBrowser();
  const allLinks = [];

  for (let pageNum = 1; pageNum <= DEALS_PAGES_TO_SCAN; pageNum++) {
    const url = `https://www.amazon.in/deals?page=${pageNum}`;
    const page = await browser.newPage();

    try {
      await page.setUserAgent(randomAgent());
      logger.info(`Scanning deals page ${pageNum}/${DEALS_PAGES_TO_SCAN}: ${url}`);

      await page.goto(url, {
        waitUntil: "domcontentloaded",
        timeout: 30000,
      });

      await randomDelay(1000, 2500);

      const links = await page.evaluate(() => {
        const seen = new Set();
        const results = [];
        document.querySelectorAll("a[href*='/dp/']").forEach((a) => {
          const clean = a.href.split("?")[0];
          if (!seen.has(clean) && clean.includes("amazon.in")) {
            seen.add(clean);
            results.push(clean);
          }
        });
        return results;
      });

      logger.info(`Found ${links.length} product links on deals page ${pageNum}`);
      allLinks.push(...links);
    } catch (error) {
      logger.error(`Failed to scan deals page ${pageNum}: ${error.message}`);
    } finally {
      await page.close().catch(() => {});
    }

    // Throttle between page scans
    await randomDelay(2000, 4000);
  }

  const unique = [...new Set(allLinks)];
  logger.info(`Total unique product links found: ${unique.length}`);
  return unique;
}

module.exports = {
  scrapeAmazonProduct,
  findDealProducts,
  getBrowser,
  closeBrowser,
  // Exported for unit testing
  cleanPrice,
};
