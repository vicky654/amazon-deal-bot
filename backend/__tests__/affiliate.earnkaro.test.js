/**
 * EarnKaro Affiliate — Unit Tests
 *
 * Mocks: puppeteer (via browser.js), fs
 */

const fs   = require('fs');
const path = require('path');

// ── Mock browser.js so no real Puppeteer is launched ──────────────────────────
const mockPage = {
  setCookie:              jest.fn().mockResolvedValue(undefined),
  goto:                   jest.fn().mockResolvedValue(undefined),
  $:                      jest.fn().mockResolvedValue(null),
  $$:                     jest.fn().mockResolvedValue([]),
  $eval:                  jest.fn().mockResolvedValue(''),
  click:                  jest.fn().mockResolvedValue(undefined),
  type:                   jest.fn().mockResolvedValue(undefined),
  evaluate:               jest.fn().mockResolvedValue([]),
  waitForSelector:        jest.fn().mockResolvedValue(undefined),
  close:                  jest.fn().mockResolvedValue(undefined),
};

jest.mock('../src/scraper/browser', () => ({
  openPage:     jest.fn().mockResolvedValue(mockPage),
  randomDelay:  jest.fn().mockResolvedValue(undefined),
  sleep:        jest.fn().mockResolvedValue(undefined),
  getBrowser:   jest.fn(),
  closeBrowser: jest.fn(),
}));

jest.mock('fs');

const { generateEarnKaroLink } = require('../src/affiliate/earnkaro');

const VALID_COOKIES = JSON.stringify([
  { name: 'session', value: 'abc123', domain: 'app.earnkaro.com', path: '/', httpOnly: true, secure: true },
  { name: 'auth',    value: 'xyz789', domain: 'app.earnkaro.com', path: '/',                 secure: true },
]);

const PRODUCT_URL = 'https://www.flipkart.com/samsung-galaxy/p/itm123456';
const GENERATED_LINK = 'https://ekaro.in/enkr202403171234';

// ── Helpers ────────────────────────────────────────────────────────────────────
function setupValidSession() {
  fs.existsSync.mockReturnValue(true);
  fs.readFileSync.mockReturnValue(VALID_COOKIES);

  // Simulate: no login input found → session is active
  mockPage.$.mockImplementation((sel) => {
    if (sel.includes('email') || sel.includes('password')) return null;
    return { click: jest.fn(), innerText: 'User' }; // profile element found
  });

  // Simulate: input field found, button found, output link appears after generation
  let inputEl = null;
  mockPage.$.mockImplementation((sel) => {
    if (sel.includes('input[placeholder') || sel.includes('url') || sel.includes('link-input')) {
      inputEl = { click: jest.fn().mockResolvedValue(undefined), type: jest.fn().mockResolvedValue(undefined) };
      return inputEl;
    }
    if (sel.includes('submit') || sel.includes('generate') || sel.includes('make')) {
      return { click: jest.fn().mockResolvedValue(undefined) };
    }
    return null;
  });

  mockPage.$eval.mockImplementation((sel) => {
    if (sel.includes('readonly') || sel.includes('generated') || sel.includes('output') || sel.includes('affiliate') || sel.includes('result')) {
      return GENERATED_LINK;
    }
    return '';
  });
}

function setupExpiredSession() {
  fs.existsSync.mockReturnValue(true);
  fs.readFileSync.mockReturnValue(VALID_COOKIES);

  // Simulate login page → session expired
  mockPage.$.mockImplementation((sel) => {
    if (sel.includes('email') || sel.includes('type="email"')) {
      return { type: jest.fn() }; // login input found → not logged in
    }
    return null;
  });
}

// ── Tests ──────────────────────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks();
  mockPage.$.mockReset();
  mockPage.$eval.mockReset();
  mockPage.evaluate.mockReset();
});

describe('Cookie loading', () => {
  it('throws when cookies file does not exist', async () => {
    fs.existsSync.mockReturnValue(false);

    await expect(generateEarnKaroLink(PRODUCT_URL)).rejects.toThrow(
      /cookies not found/i
    );
  });

  it('throws when cookies file contains invalid JSON', async () => {
    fs.existsSync.mockReturnValue(true);
    fs.readFileSync.mockReturnValue('NOT_VALID_JSON{{{');

    await expect(generateEarnKaroLink(PRODUCT_URL)).rejects.toThrow(
      /Failed to parse EarnKaro cookies/i
    );
  });

  it('injects all cookies from file', async () => {
    setupValidSession();
    // Allow the link to be found via evaluate fallback
    mockPage.evaluate.mockResolvedValue([GENERATED_LINK]);

    try { await generateEarnKaroLink(PRODUCT_URL); } catch { /* ignore */ }

    expect(mockPage.setCookie).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'session', value: 'abc123' }),
      expect.objectContaining({ name: 'auth',    value: 'xyz789' })
    );
  });
});

describe('Session validation', () => {
  it('throws a clear error when session has expired (login page detected)', async () => {
    setupExpiredSession();

    await expect(generateEarnKaroLink(PRODUCT_URL)).rejects.toThrow(
      /session expired/i
    );
  });
});

describe('Link generation', () => {
  it('returns generated EarnKaro link when found via evaluate fallback', async () => {
    fs.existsSync.mockReturnValue(true);
    fs.readFileSync.mockReturnValue(VALID_COOKIES);

    // Provide fake input + button elements so the flow reaches the output-wait loop
    const mockInput = { click: jest.fn().mockResolvedValue(undefined), type: jest.fn().mockResolvedValue(undefined) };
    const mockBtn   = { click: jest.fn().mockResolvedValue(undefined) };

    mockPage.$.mockImplementation(async (sel) => {
      // login-page selectors → null (session active)
      if (sel.includes('email') || sel.includes('password')) return null;
      // URL input
      if (sel.includes('placeholder') || sel.includes('name="url"') || sel.includes('type="url"') || sel.includes('link-input')) return mockInput;
      // Generate button
      if (sel.includes('submit') || sel.includes('generate') || sel.includes('make')) return mockBtn;
      return null;
    });

    // Output polling returns '' but evaluate fallback finds the link
    mockPage.$eval.mockResolvedValue('');
    mockPage.evaluate.mockResolvedValue([GENERATED_LINK]);

    const link = await generateEarnKaroLink(PRODUCT_URL);
    expect(link).toBe(GENERATED_LINK);
  });

  it('retries on transient failure and throws after max attempts', async () => {
    fs.existsSync.mockReturnValue(true);
    fs.readFileSync.mockReturnValue(VALID_COOKIES);
    // No login page, but also no input/button/output → every attempt fails with "not found"
    mockPage.$.mockResolvedValue(null);
    mockPage.evaluate.mockResolvedValue([]);
    mockPage.$eval.mockResolvedValue('');

    await expect(generateEarnKaroLink(PRODUCT_URL, 1, 3)).rejects.toThrow();

    // openPage should have been called 3 times (one per attempt)
    const { openPage } = require('../src/scraper/browser');
    expect(openPage).toHaveBeenCalledTimes(3);
  });

  it('does not retry when session is expired', async () => {
    setupExpiredSession();

    await expect(generateEarnKaroLink(PRODUCT_URL)).rejects.toThrow();

    const { openPage } = require('../src/scraper/browser');
    // Should stop after first attempt (session expired is non-retriable)
    expect(openPage).toHaveBeenCalledTimes(1);
  });
});
