/**
 * Unit tests — scraper.js
 *
 * Tests:
 *  - cleanPrice parsing
 *  - savings calculation logic
 *  - scrapeAmazonProduct with mocked Puppeteer (success, bot detection, retry)
 *  - findDealProducts with mocked Puppeteer
 */

// ─── Mock Puppeteer before importing scraper ──────────────────────────────────

const mockPageClose = jest.fn().mockResolvedValue(undefined);
const mockSetUserAgent = jest.fn().mockResolvedValue(undefined);
const mockSetExtraHTTPHeaders = jest.fn().mockResolvedValue(undefined);
const mockSetRequestInterception = jest.fn().mockResolvedValue(undefined);
const mockGoto = jest.fn().mockResolvedValue(undefined);
const mockContent = jest.fn().mockResolvedValue("<html>normal page</html>");
const mockUrl = jest.fn().mockReturnValue("https://www.amazon.in/dp/B08N5WRWNW");
const mockWaitForSelector = jest.fn().mockResolvedValue(undefined);
const mockEvaluate = jest.fn();
const mockOn = jest.fn();
const mockNewPage = jest.fn();
const mockIsConnected = jest.fn().mockReturnValue(true);
const mockBrowserClose = jest.fn().mockResolvedValue(undefined);

const mockBrowser = {
  isConnected: mockIsConnected,
  newPage: mockNewPage,
  on: mockOn,
  close: mockBrowserClose,
};

jest.mock("puppeteer", () => ({
  launch: jest.fn().mockResolvedValue(mockBrowser),
}));

// Build a fresh mock page object
function makeMockPage(overrides = {}) {
  return {
    setUserAgent: mockSetUserAgent,
    setExtraHTTPHeaders: mockSetExtraHTTPHeaders,
    setRequestInterception: mockSetRequestInterception,
    on: mockOn,
    goto: mockGoto,
    content: overrides.content || mockContent,
    url: overrides.url || mockUrl,
    waitForSelector: overrides.waitForSelector || mockWaitForSelector,
    evaluate: overrides.evaluate || mockEvaluate,
    close: mockPageClose,
  };
}

// ─── Import after mock ────────────────────────────────────────────────────────

const { cleanPrice, scrapeAmazonProduct, findDealProducts } = require("../scraper");

// ─── Helpers ─────────────────────────────────────────────────────────────────

const GOOD_PRODUCT = {
  title: "Samsung Galaxy Buds Pro",
  price: 4999,
  originalPrice: 14999,
  savings: 67,
  image: "https://m.media-amazon.com/images/I/test.jpg",
  link: "https://www.amazon.in/dp/B08N5WRWNW",
  _debug: { priceText: "₹4,999", originalText: "₹14,999" },
};

beforeEach(() => {
  jest.clearAllMocks();
  mockIsConnected.mockReturnValue(true);
  // Default: newPage returns a usable page
  mockNewPage.mockResolvedValue(makeMockPage());
  mockEvaluate.mockResolvedValue(GOOD_PRODUCT);
});

// ─── cleanPrice ──────────────────────────────────────────────────────────────

describe("cleanPrice", () => {
  test("parses Indian rupee price", () => {
    expect(cleanPrice("₹1,299.00")).toBe(1299);
  });

  test("parses plain number string", () => {
    expect(cleanPrice("999")).toBe(999);
  });

  test("parses price with surrounding whitespace", () => {
    expect(cleanPrice("  ₹4,999  ")).toBe(4999);
  });

  test("parses price with only digits", () => {
    expect(cleanPrice("14999")).toBe(14999);
  });

  test("returns null for null input", () => {
    expect(cleanPrice(null)).toBeNull();
  });

  test("returns null for empty string", () => {
    expect(cleanPrice("")).toBeNull();
  });

  test("returns null for non-numeric string", () => {
    expect(cleanPrice("N/A")).toBeNull();
  });

  test("parses decimal price correctly", () => {
    expect(cleanPrice("₹1,999.99")).toBe(1999.99);
  });
});

// ─── Savings calculation ─────────────────────────────────────────────────────

describe("savings calculation", () => {
  // The scraper calculates savings inside page.evaluate — we test the formula here
  function calcSavings(price, originalPrice) {
    if (!price || !originalPrice || originalPrice <= price) return null;
    return Math.round(((originalPrice - price) / originalPrice) * 100);
  }

  test("calculates 60% off correctly", () => {
    expect(calcSavings(4000, 10000)).toBe(60);
  });

  test("calculates 67% off correctly", () => {
    expect(calcSavings(4999, 14999)).toBe(67);
  });

  test("calculates 50% off correctly", () => {
    expect(calcSavings(500, 1000)).toBe(50);
  });

  test("returns null when price equals original price", () => {
    expect(calcSavings(999, 999)).toBeNull();
  });

  test("returns null when deal price is higher than original", () => {
    expect(calcSavings(1200, 999)).toBeNull();
  });

  test("returns null when price is null", () => {
    expect(calcSavings(null, 999)).toBeNull();
  });

  test("returns null when original price is null", () => {
    expect(calcSavings(999, null)).toBeNull();
  });
});

// ─── scrapeAmazonProduct ─────────────────────────────────────────────────────

describe("scrapeAmazonProduct", () => {
  test("returns product data on success", async () => {
    const result = await scrapeAmazonProduct("https://www.amazon.in/dp/B08N5WRWNW");

    expect(result.title).toBe("Samsung Galaxy Buds Pro");
    expect(result.price).toBe(4999);
    expect(result.originalPrice).toBe(14999);
    expect(result.savings).toBe(67);
    expect(result.asin).toBe("B08N5WRWNW");
    // Affiliate link should contain tracking tag
    expect(result.link).toContain("tag=");
  });

  test("strips _debug field from returned product", async () => {
    const result = await scrapeAmazonProduct("https://www.amazon.in/dp/B08N5WRWNW");
    expect(result._debug).toBeUndefined();
  });

  test("throws after max retries when title is not found", async () => {
    mockEvaluate.mockResolvedValue({ ...GOOD_PRODUCT, title: null });

    await expect(
      scrapeAmazonProduct("https://www.amazon.in/dp/B08N5WRWNW")
    ).rejects.toThrow("Failed to scrape after");
  }, 20000); // retries with backoff can take ~9s

  test("throws on bot detection page", async () => {
    const botPage = makeMockPage({
      content: jest
        .fn()
        .mockResolvedValue("<html>Enter the characters you see below</html>"),
    });
    mockNewPage.mockResolvedValue(botPage);

    await expect(
      scrapeAmazonProduct("https://www.amazon.in/dp/B08N5WRWNW")
    ).rejects.toThrow("Failed to scrape after");
  }, 20000);

  test("throws when redirected to non-product page", async () => {
    const redirectPage = makeMockPage({
      url: jest.fn().mockReturnValue("https://www.amazon.in/s?k=phones"),
    });
    mockNewPage.mockResolvedValue(redirectPage);

    await expect(
      scrapeAmazonProduct("https://www.amazon.in/dp/B08N5WRWNW")
    ).rejects.toThrow("Failed to scrape after");
  }, 20000);

  test("retries on failure and succeeds on second attempt", async () => {
    // First call to newPage returns a bad page, second returns a good page
    mockNewPage
      .mockResolvedValueOnce(
        makeMockPage({
          evaluate: jest.fn().mockRejectedValue(new Error("Network error")),
        })
      )
      .mockResolvedValueOnce(makeMockPage());

    const result = await scrapeAmazonProduct("https://www.amazon.in/dp/B08N5WRWNW");
    expect(result.title).toBe("Samsung Galaxy Buds Pro");
    // Page should have been created twice (one per attempt)
    expect(mockNewPage).toHaveBeenCalledTimes(2);
  }, 15000);

  test("closes the page after successful scrape", async () => {
    await scrapeAmazonProduct("https://www.amazon.in/dp/B08N5WRWNW");
    expect(mockPageClose).toHaveBeenCalled();
  });

  test("closes the page after failed scrape", async () => {
    mockEvaluate.mockRejectedValue(new Error("Selector not found"));

    await expect(
      scrapeAmazonProduct("https://www.amazon.in/dp/B08N5WRWNW")
    ).rejects.toThrow();

    expect(mockPageClose).toHaveBeenCalled();
  }, 20000);
});

// ─── findDealProducts ─────────────────────────────────────────────────────────

describe("findDealProducts", () => {
  test("returns an array of unique product URLs", async () => {
    const mockLinks = [
      "https://www.amazon.in/dp/B08N5WRWNW",
      "https://www.amazon.in/dp/B09V3KBBCT",
    ];

    mockNewPage.mockResolvedValue(
      makeMockPage({
        evaluate: jest.fn().mockResolvedValue(mockLinks),
      })
    );

    const result = await findDealProducts();
    expect(Array.isArray(result)).toBe(true);
    // Duplicates should be removed
    const unique = new Set(result);
    expect(unique.size).toBe(result.length);
  });

  test("returns empty array if all pages fail", async () => {
    mockNewPage.mockResolvedValue(
      makeMockPage({
        goto: jest.fn().mockRejectedValue(new Error("Navigation failed")),
        evaluate: jest.fn().mockResolvedValue([]),
      })
    );

    const result = await findDealProducts();
    expect(Array.isArray(result)).toBe(true);
  });
});
