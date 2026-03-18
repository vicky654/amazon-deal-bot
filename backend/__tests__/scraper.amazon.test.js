/**
 * Amazon Scraper — Unit Tests
 *
 * Mocks browser.js entirely so no real Puppeteer is launched.
 */

// ── Build a reusable mock page factory ────────────────────────────────────────
function makeMockPage(overrides = {}) {
  return {
    setUserAgent:           jest.fn().mockResolvedValue(undefined),
    setExtraHTTPHeaders:    jest.fn().mockResolvedValue(undefined),
    evaluateOnNewDocument:  jest.fn().mockResolvedValue(undefined),
    setRequestInterception: jest.fn().mockResolvedValue(undefined),
    on:                     jest.fn(),
    goto:                   jest.fn().mockResolvedValue(undefined),
    content:                jest.fn().mockResolvedValue('<html><body>Amazon Product</body></html>'),
    url:                    jest.fn().mockReturnValue('https://www.amazon.in/dp/B08N5WRWNW'),
    waitForSelector:        jest.fn().mockResolvedValue(undefined),
    evaluate:               jest.fn().mockResolvedValue({
      title:         'Sony WH-1000XM5 Headphones',
      price:         22990,
      originalPrice: 34990,
      discount:      34,
      image:         'https://m.media-amazon.com/images/test.jpg',
      url:           'https://www.amazon.in/dp/B08N5WRWNW',
    }),
    close:                  jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

const mockBrowser = {
  openPage:     jest.fn(),
  randomDelay:  jest.fn().mockResolvedValue(undefined),
  sleep:        jest.fn().mockResolvedValue(undefined),
  getBrowser:   jest.fn(),
  closeBrowser: jest.fn(),
};

jest.mock('../src/scraper/browser', () => mockBrowser);

const { scrapeAmazon } = require('../src/scraper/amazon');

// ── Tests ──────────────────────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks();
  mockBrowser.randomDelay.mockResolvedValue(undefined);
});

describe('scrapeAmazon() — success path', () => {
  let page;

  beforeEach(() => {
    page = makeMockPage();
    mockBrowser.openPage.mockResolvedValue(page);
  });

  it('returns a standardised product object', async () => {
    const product = await scrapeAmazon('https://www.amazon.in/dp/B08N5WRWNW');

    expect(product).toMatchObject({
      platform:      'amazon',
      title:         'Sony WH-1000XM5 Headphones',
      price:         22990,
      originalPrice: 34990,
      discount:      34,
    });
  });

  it('always sets platform = "amazon"', async () => {
    const product = await scrapeAmazon('https://www.amazon.in/dp/B08N5WRWNW');
    expect(product.platform).toBe('amazon');
  });

  it('closes the page after success', async () => {
    await scrapeAmazon('https://www.amazon.in/dp/B08N5WRWNW');
    expect(page.close).toHaveBeenCalledTimes(1);
  });

  it('passes selector arrays to page.evaluate', async () => {
    await scrapeAmazon('https://www.amazon.in/dp/B08N5WRWNW');
    // evaluate must be called with (fn, arg1, arg2, ...) — not a closure
    expect(page.evaluate).toHaveBeenCalledWith(
      expect.any(Function),
      expect.any(Array),
      expect.any(Array),
      expect.any(Array),
      expect.any(Array),
    );
  });
});

describe('scrapeAmazon() — bot detection', () => {
  it('throws on CAPTCHA page', async () => {
    const page = makeMockPage({
      content: jest.fn().mockResolvedValue('<html>Enter the characters you see below</html>'),
    });
    mockBrowser.openPage.mockResolvedValue(page);

    await expect(scrapeAmazon('https://www.amazon.in/dp/B08N5WRWNW', 1, 1))
      .rejects.toThrow(/Bot|CAPTCHA/i);
  });

  it('throws when redirected away from product page', async () => {
    const page = makeMockPage({
      content: jest.fn().mockResolvedValue('<html>Amazon Home</html>'),
      url:     jest.fn().mockReturnValue('https://www.amazon.in/'),
    });
    mockBrowser.openPage.mockResolvedValue(page);

    await expect(scrapeAmazon('https://www.amazon.in/dp/B08N5WRWNW', 1, 1))
      .rejects.toThrow(/Redirected/i);
  });

  it('throws when title is not found', async () => {
    const page = makeMockPage({
      evaluate: jest.fn().mockResolvedValue({ title: null, price: 999 }),
    });
    mockBrowser.openPage.mockResolvedValue(page);

    await expect(scrapeAmazon('https://www.amazon.in/dp/B08N5WRWNW', 1, 1))
      .rejects.toThrow(/title not found/i);
  });
});

describe('scrapeAmazon() — retry logic', () => {
  it('retries up to maxAttempts on failure', async () => {
    const failingPage = makeMockPage({
      content: jest.fn().mockResolvedValue('<html>Enter the characters you see below</html>'),
    });
    mockBrowser.openPage.mockResolvedValue(failingPage);

    await expect(scrapeAmazon('https://www.amazon.in/dp/B08N5WRWNW', 1, 3))
      .rejects.toThrow();

    // openPage called 3 times (one per attempt)
    expect(mockBrowser.openPage).toHaveBeenCalledTimes(3);
  });

  it('succeeds on second attempt after first failure', async () => {
    const failPage = makeMockPage({
      goto: jest.fn().mockRejectedValue(new Error('Navigation timeout')),
    });
    const goodPage = makeMockPage();

    mockBrowser.openPage
      .mockResolvedValueOnce(failPage)
      .mockResolvedValueOnce(goodPage);

    const product = await scrapeAmazon('https://www.amazon.in/dp/B08N5WRWNW', 1, 3);
    expect(product.title).toBeTruthy();
    expect(mockBrowser.openPage).toHaveBeenCalledTimes(2);
  });

  it('closes the page even when an error occurs', async () => {
    const errorPage = makeMockPage({
      goto: jest.fn().mockRejectedValue(new Error('Timeout')),
    });
    mockBrowser.openPage.mockResolvedValue(errorPage);

    await expect(scrapeAmazon('https://www.amazon.in/dp/B08N5WRWNW', 1, 1))
      .rejects.toThrow();

    expect(errorPage.close).toHaveBeenCalled();
  });
});
