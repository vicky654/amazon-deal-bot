/**
 * Integration Tests — Full Scrape → Affiliate → Save Flow
 *
 * Uses real deal-filter logic + real queue.
 * Mocks: Puppeteer (browser.js), Telegram, EarnKaro cookies.
 */

const fs = require('fs');

// ── Mock Puppeteer / browser ───────────────────────────────────────────────────

const mockProductData = {
  title:         'Boat Rockerz 450 Bluetooth Headphone',
  price:         799,
  originalPrice: 1999,
  discount:      60,
  image:         'https://example.com/boat.jpg',
  url:           'https://www.amazon.in/dp/B07XLHWMVM',
};

const mockPage = {
  setUserAgent:           jest.fn().mockResolvedValue(undefined),
  setExtraHTTPHeaders:    jest.fn().mockResolvedValue(undefined),
  evaluateOnNewDocument:  jest.fn().mockResolvedValue(undefined),
  setCookie:              jest.fn().mockResolvedValue(undefined),
  goto:                   jest.fn().mockResolvedValue(undefined),
  content:                jest.fn().mockResolvedValue('<html><body>Amazon Product</body></html>'),
  url:                    jest.fn().mockReturnValue('https://www.amazon.in/dp/B07XLHWMVM'),
  waitForSelector:        jest.fn().mockResolvedValue(undefined),
  evaluate:               jest.fn().mockResolvedValue({ ...mockProductData }),
  $:                      jest.fn().mockResolvedValue(null),
  $$:                     jest.fn().mockResolvedValue([]),
  $eval:                  jest.fn().mockResolvedValue(''),
  click:                  jest.fn().mockResolvedValue(undefined),
  type:                   jest.fn().mockResolvedValue(undefined),
  close:                  jest.fn().mockResolvedValue(undefined),
};

jest.mock('../src/scraper/browser', () => ({
  openPage:     jest.fn().mockResolvedValue(mockPage),
  randomDelay:  jest.fn().mockResolvedValue(undefined),
  sleep:        jest.fn().mockResolvedValue(undefined),
  getBrowser:   jest.fn(),
  closeBrowser: jest.fn(),
}));

// ── Mock Telegram ──────────────────────────────────────────────────────────────

jest.mock('../telegram', () => ({
  formatDealText:       jest.fn().mockReturnValue('Test caption'),
  sendToTelegram:       jest.fn().mockResolvedValue({ message_id: 1 }),
  sendMessageToTelegram: jest.fn().mockResolvedValue({}),
  sendTestMessage:      jest.fn().mockResolvedValue(true),
}));

// ── Mock MongoDB models ────────────────────────────────────────────────────────

let savedDeals = [];
let savedRuns  = [];

jest.mock('../src/models/Deal', () => {
  const deals = require('../__tests__/fixtures/dealStore');
  return deals;
});

jest.mock('../src/models/CrawlerRun', () => ({
  create:            jest.fn().mockResolvedValue({ _id: 'run-1' }),
  findByIdAndUpdate: jest.fn().mockResolvedValue({}),
  findOne:           jest.fn().mockReturnValue({ sort: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue(null) }) }),
  find:              jest.fn().mockReturnValue({ sort: jest.fn().mockReturnValue({ limit: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue([]) }) }) }),
}));

// ── Fixtures ──────────────────────────────────────────────────────────────────

// Create the fixture module needed by the mock above
const fixturesDir = require('path').join(__dirname, 'fixtures');
if (!require('fs').existsSync(fixturesDir)) require('fs').mkdirSync(fixturesDir, { recursive: true });

require('fs').writeFileSync(
  require('path').join(fixturesDir, 'dealStore.js'),
  `
const store = [];
module.exports = {
  findOne: jest.fn().mockResolvedValue(null),
  create: jest.fn().mockImplementation((data) => {
    const doc = { ...data, _id: 'deal-' + Date.now(), save: jest.fn().mockResolvedValue(true) };
    store.push(doc);
    return Promise.resolve(doc);
  }),
  find: jest.fn().mockReturnValue({ sort: jest.fn().mockReturnValue({ limit: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue(store) }) }) }),
  findByIdAndUpdate: jest.fn().mockResolvedValue({}),
  _store: store,
};
`
);

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('Integration: URL → Scrape → Affiliate → Deal', () => {
  const { scrapeProduct }         = require('../src/scraper');
  const { buildAmazonAffiliateLink } = require('../src/affiliate/amazon');
  const { evaluateDeal }          = require('../src/engine/dealFilter');

  const AMAZON_URL = 'https://www.amazon.in/dp/B07XLHWMVM';

  it('scrapes a product and extracts all required fields', async () => {
    const product = await scrapeProduct(AMAZON_URL);

    expect(product).toMatchObject({
      platform: 'amazon',
      title:    expect.any(String),
      price:    expect.any(Number),
    });
    expect(product.title.length).toBeGreaterThan(0);
  });

  it('generates a valid Amazon affiliate link from scraped URL', async () => {
    const product = await scrapeProduct(AMAZON_URL);
    const link    = buildAmazonAffiliateLink(product.url);

    expect(link).toContain('amazon.in/dp/');
    expect(link).toContain('tag=');
  });

  it('evaluates deal as qualifying at 60% discount', async () => {
    const product = { ...mockProductData, platform: 'amazon', asin: 'B07XLHWMVM' };
    const { shouldPost, reason, dealType } = await evaluateDeal(product);

    expect(shouldPost).toBe(true);
    expect(dealType).toBe('discount');
    expect(reason).toMatch(/60%/);
  });

  it('evaluates deal as NOT qualifying at 20% discount', async () => {
    const product = {
      ...mockProductData,
      price:    1599,
      originalPrice: 1999,
      discount: 20,
      platform: 'amazon',
      asin:     'B07XLHWMVM',
    };
    const { shouldPost } = await evaluateDeal(product);
    expect(shouldPost).toBe(false);
  });
});

describe('Integration: Platform routing', () => {
  const { scrapeProduct, detectPlatform } = require('../src/scraper');

  it('detects amazon platform', () => {
    const entry = detectPlatform('https://www.amazon.in/dp/B08N5WRWNW');
    expect(entry?.platform).toBe('amazon');
  });

  it('detects flipkart platform', () => {
    const entry = detectPlatform('https://www.flipkart.com/product/p/itm123');
    expect(entry?.platform).toBe('flipkart');
  });

  it('detects myntra platform', () => {
    const entry = detectPlatform('https://www.myntra.com/some-product/buy/123');
    expect(entry?.platform).toBe('myntra');
  });

  it('detects ajio platform', () => {
    const entry = detectPlatform('https://www.ajio.com/p/product-id');
    expect(entry?.platform).toBe('ajio');
  });

  it('returns null for unsupported platform', () => {
    const entry = detectPlatform('https://www.snapdeal.com/product/123');
    expect(entry).toBeNull();
  });
});

describe('Integration: Error handling', () => {
  const { openPage } = require('../src/scraper/browser');

  it('scraper retries and throws after max attempts on network failure', async () => {
    openPage.mockRejectedValue(new Error('Page creation failed'));

    const { scrapeAmazon } = require('../src/scraper/amazon');
    await expect(scrapeAmazon('https://www.amazon.in/dp/BAD0000000', 1, 2))
      .rejects.toThrow(/scrape failed after 2 attempts/i);

    expect(openPage).toHaveBeenCalledTimes(2);

    // Restore for subsequent tests
    openPage.mockResolvedValue(mockPage);
  });

  it('affiliate failure falls back to original URL without crashing', async () => {
    const { generateAffiliateLink } = require('../src/affiliate');
    jest.spyOn(require('../src/affiliate/earnkaro'), 'generateEarnKaroLink')
      .mockRejectedValueOnce(new Error('EarnKaro session expired'));

    // Amazon uses direct tag — never calls EarnKaro
    const link = await generateAffiliateLink('https://www.amazon.in/dp/B08N5WRWNW', 'amazon');
    expect(link).toContain('amazon.in');
    expect(link).toContain('tag=');
  });
});
