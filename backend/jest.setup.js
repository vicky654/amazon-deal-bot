// ── Global mocks applied before every test file ──────────────────────────────

// Prevent cron from scheduling real jobs during tests
jest.mock('node-cron', () => ({ schedule: jest.fn() }));

// Prevent dotenv from touching the environment (tests use inline env vars)
jest.mock('dotenv', () => ({ config: jest.fn() }));

// Silence logger output in tests (set VERBOSE_TESTS=1 to re-enable)
if (!process.env.VERBOSE_TESTS) {
  jest.mock('./utils/logger', () => ({
    info:  jest.fn(),
    warn:  jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  }));
}

// Set minimal env vars so modules don't throw on missing config
process.env.MONGODB_URI        = 'mongodb://127.0.0.1:27017/test';
process.env.TELEGRAM_TOKEN     = 'test-token';
process.env.TELEGRAM_CHAT      = '-100000000';
process.env.AMAZON_TRACKING_ID = 'test-track-21';
process.env.SCRAPE_CONCURRENCY = '2';
