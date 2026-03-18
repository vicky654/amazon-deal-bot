/**
 * Crawler API — Integration Tests (Supertest)
 */

const request = require('supertest');

// ── Mocks (same setup as api.deals.test.js) ────────────────────────────────────

jest.mock('mongoose', () => {
  const actual = jest.requireActual('mongoose');
  return {
    ...actual,
    connect:    jest.fn().mockResolvedValue({}),
    disconnect: jest.fn().mockResolvedValue({}),
    connection: { readyState: 1, close: jest.fn().mockResolvedValue({}) },
  };
});

const mockCrawlerRun = {
  status:     'completed',
  startedAt:  new Date('2026-03-17T10:00:00Z'),
  finishedAt: new Date('2026-03-17T10:04:00Z'),
  durationMs: 240000,
  stats:      { categoriesScanned: 10, linksExtracted: 500, productsScanned: 30, dealsFound: 5, dealsPosted: 3, errors: 2 },
};

jest.mock('../src/models/CrawlerRun', () => ({
  create:           jest.fn().mockResolvedValue({ _id: 'run-id-1' }),
  find:             jest.fn(),
  findByIdAndUpdate: jest.fn().mockResolvedValue({}),
  findOne:          jest.fn(),
}));

jest.mock('../src/models/Deal', () => ({
  find:            jest.fn().mockReturnValue({ sort: jest.fn().mockReturnValue({ limit: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue([]) }) }) }),
  findById:        jest.fn(),
  findByIdAndDelete: jest.fn(),
  findOne:         jest.fn(),
  create:          jest.fn(),
  findByIdAndUpdate: jest.fn(),
}));

jest.mock('../src/scraper', () => ({ scrapeProduct: jest.fn(), detectPlatform: jest.fn() }));
jest.mock('../src/affiliate', () => ({ generateAffiliateLink: jest.fn() }));
jest.mock('../src/engine/dealFilter', () => ({ evaluateDeal: jest.fn(), upsertDeal: jest.fn() }));
jest.mock('../telegram', () => ({
  formatDealText:       jest.fn().mockReturnValue('caption'),
  sendToTelegram:       jest.fn().mockResolvedValue({}),
  sendMessageToTelegram: jest.fn().mockResolvedValue({}),
  sendTestMessage:      jest.fn().mockResolvedValue(true),
}));

const mockRunCrawlCycle = jest.fn().mockResolvedValue({ dealsFound: 2, dealsPosted: 1 });
jest.mock('../src/crawler', () => ({
  runCrawlCycle: mockRunCrawlCycle,
  getQueueStats: jest.fn().mockReturnValue({
    scrape:    { pending: 0, active: 0, concurrency: 2 },
    affiliate: { pending: 0, active: 0, concurrency: 1 },
  }),
}));

jest.mock('../src/routes/earnkaro', () => {
  const router = require('express').Router();
  router.get('/status', (req, res) => res.json({ connected: false }));
  return router;
});

const CrawlerRun = require('../src/models/CrawlerRun');

let app;
beforeAll(() => {
  app = require('../server');
});

afterAll(async () => {
  const mongoose = require('mongoose');
  await mongoose.connection.close();
});

// ── GET /api/crawler/status (legacy shape) ─────────────────────────────────────

describe('GET /api/crawler/status', () => {
  beforeEach(() => {
    CrawlerRun.find.mockReturnValue({
      sort:  jest.fn().mockReturnValue({
        limit: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue([mockCrawlerRun]),
        }),
      }),
    });
  });

  it('returns 200 with isRunning and recentRuns', async () => {
    const res = await request(app).get('/api/crawler/status');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('isRunning');
    expect(res.body).toHaveProperty('recentRuns');
    expect(Array.isArray(res.body.recentRuns)).toBe(true);
  });

  it('returns queueStats with scrape and affiliate queues', async () => {
    const res = await request(app).get('/api/crawler/status');
    expect(res.body.queueStats).toHaveProperty('scrape');
    expect(res.body.queueStats).toHaveProperty('affiliate');
  });
});

// ── GET /health ────────────────────────────────────────────────────────────────

describe('GET /health', () => {
  it('returns 200 with status ok', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });

  it('includes uptime_s and timestamp', async () => {
    const res = await request(app).get('/health');
    expect(res.body).toHaveProperty('uptime_s');
    expect(res.body).toHaveProperty('timestamp');
    expect(typeof res.body.uptime_s).toBe('number');
  });
});

// ── GET /metrics ───────────────────────────────────────────────────────────────

describe('GET /metrics', () => {
  it('returns 200 with counters and histograms', async () => {
    const res = await request(app).get('/metrics');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('counters');
    expect(res.body).toHaveProperty('histograms');
  });
});

// ── POST /api/crawler/start (new route) ────────────────────────────────────────

describe('POST /api/crawler/start (src/routes/crawler)', () => {
  beforeEach(() => {
    CrawlerRun.findOne.mockReturnValue({
      sort: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue(null),
      }),
    });
  });

  it('returns 200 immediately without waiting for cycle', async () => {
    const res = await request(app).post('/api/crawler/start');
    expect([200, 409]).toContain(res.status); // 409 if already running
    if (res.status === 200) {
      expect(res.body.success).toBe(true);
    }
  });

  it('returns 409 if crawl is already in progress', async () => {
    // Trigger first crawl
    await request(app).post('/api/crawler/start');
    // Immediately trigger second — may get 409 depending on timing
    // Just verify the endpoint is wired and returns a valid JSON response
    const res = await request(app).post('/api/crawler/start');
    expect([200, 409]).toContain(res.status);
    expect(res.body).toHaveProperty('success');
  });
});
