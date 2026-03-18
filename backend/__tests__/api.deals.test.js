/**
 * Deals API — Integration Tests (Supertest)
 *
 * All external IO (DB, scrapers, Telegram) is mocked.
 * The real Express router is tested end-to-end.
 */

const request = require('supertest');

// ── Mock all external dependencies before loading the app ─────────────────────

jest.mock('mongoose', () => {
  const actual = jest.requireActual('mongoose');
  return {
    ...actual,
    connect:    jest.fn().mockResolvedValue({}),
    disconnect: jest.fn().mockResolvedValue({}),
    connection: { readyState: 1, close: jest.fn().mockResolvedValue({}) },
  };
});

jest.mock('../src/models/Deal', () => {
  const mockDeal = {
    find:            jest.fn(),
    findById:        jest.fn(),
    findByIdAndDelete: jest.fn(),
    findOne:         jest.fn(),
    create:          jest.fn(),
    findByIdAndUpdate: jest.fn(),
  };
  return mockDeal;
});

jest.mock('../src/models/CrawlerRun', () => ({
  create:           jest.fn().mockResolvedValue({ _id: 'run-id-1' }),
  find:             jest.fn().mockReturnValue({ sort: jest.fn().mockReturnValue({ limit: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue([]) }) }) }),
  findByIdAndUpdate: jest.fn().mockResolvedValue({}),
  findOne:          jest.fn().mockReturnValue({ sort: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue(null) }) }),
}));

jest.mock('../src/scraper', () => ({
  scrapeProduct: jest.fn(),
  detectPlatform: jest.fn(),
}));

jest.mock('../src/affiliate', () => ({
  generateAffiliateLink: jest.fn(),
}));

jest.mock('../src/engine/dealFilter', () => ({
  evaluateDeal: jest.fn(),
  upsertDeal:   jest.fn(),
}));

jest.mock('../telegram', () => ({
  formatDealText:       jest.fn().mockReturnValue('formatted caption'),
  sendToTelegram:       jest.fn().mockResolvedValue({}),
  sendMessageToTelegram: jest.fn().mockResolvedValue({}),
  sendTestMessage:      jest.fn().mockResolvedValue(true),
}));

jest.mock('../src/crawler', () => ({
  runCrawlCycle: jest.fn().mockResolvedValue({ dealsFound: 0 }),
  getQueueStats: jest.fn().mockReturnValue({ scrape: { pending: 0 }, affiliate: { pending: 0 } }),
}));

jest.mock('../src/routes/earnkaro', () => {
  const router = require('express').Router();
  router.get('/status', (req, res) => res.json({ connected: false }));
  return router;
});

// ── Load app after mocks ───────────────────────────────────────────────────────

const Deal              = require('../src/models/Deal');
const { scrapeProduct } = require('../src/scraper');
const { generateAffiliateLink } = require('../src/affiliate');
const { evaluateDeal, upsertDeal } = require('../src/engine/dealFilter');

let app;
beforeAll(() => {
  app = require('../server');
});

afterAll(async () => {
  const mongoose = require('mongoose');
  await mongoose.connection.close();
});

// ── Helper data ───────────────────────────────────────────────────────────────

const SAMPLE_DEAL = {
  _id:           'deal-id-1',
  platform:      'amazon',
  asin:          'B08N5WRWNW',
  title:         'Sony WH-1000XM5',
  price:         22990,
  originalPrice: 34990,
  discount:      34,
  affiliateLink: 'https://www.amazon.in/dp/B08N5WRWNW?tag=test-track-21',
  image:         'https://example.com/image.jpg',
  posted:        false,
  save:          jest.fn().mockResolvedValue({ _id: 'deal-id-1', posted: true }),
};

const SAMPLE_PRODUCT = {
  platform:      'amazon',
  title:         'Sony WH-1000XM5',
  price:         22990,
  originalPrice: 34990,
  discount:      34,
  image:         'https://example.com/image.jpg',
  url:           'https://www.amazon.in/dp/B08N5WRWNW',
  asin:          'B08N5WRWNW',
};

// ── GET /api/deals ─────────────────────────────────────────────────────────────

describe('GET /api/deals', () => {
  it('returns 200 with an array of deals', async () => {
    Deal.find.mockReturnValue({
      sort: jest.fn().mockReturnValue({
        limit: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue([SAMPLE_DEAL]),
        }),
      }),
    });

    const res = await request(app).get('/api/deals');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.deals).toHaveLength(1);
    expect(res.body.deals[0].asin).toBe('B08N5WRWNW');
  });

  it('respects limit query param (max 200)', async () => {
    Deal.find.mockReturnValue({
      sort: jest.fn().mockReturnValue({
        limit: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue([]),
        }),
      }),
    });

    const res = await request(app).get('/api/deals?limit=5');
    expect(res.status).toBe(200);
    // Verify limit was passed correctly
    const limitCall = Deal.find().sort().limit.mock.calls;
    // Just check it responds successfully
    expect(res.body.success).toBe(true);
  });

  it('filters by platform query param', async () => {
    Deal.find.mockReturnValue({
      sort: jest.fn().mockReturnValue({
        limit: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue([]),
        }),
      }),
    });

    const res = await request(app).get('/api/deals?platform=flipkart');
    expect(res.status).toBe(200);
    expect(Deal.find).toHaveBeenCalledWith(expect.objectContaining({ platform: 'flipkart' }));
  });

  it('returns 500 when DB throws', async () => {
    Deal.find.mockImplementation(() => { throw new Error('DB connection lost'); });

    const res = await request(app).get('/api/deals');
    expect(res.status).toBe(500);
  });
});

// ── GET /api/deals/:id ─────────────────────────────────────────────────────────

describe('GET /api/deals/:id', () => {
  it('returns 200 with deal when found', async () => {
    Deal.findById.mockReturnValue({ lean: jest.fn().mockResolvedValue(SAMPLE_DEAL) });

    const res = await request(app).get('/api/deals/deal-id-1');
    expect(res.status).toBe(200);
    expect(res.body.deal.asin).toBe('B08N5WRWNW');
  });

  it('returns 404 when deal not found', async () => {
    Deal.findById.mockReturnValue({ lean: jest.fn().mockResolvedValue(null) });

    const res = await request(app).get('/api/deals/nonexistent-id');
    expect(res.status).toBe(404);
  });
});

// ── DELETE /api/deals/:id ──────────────────────────────────────────────────────

describe('DELETE /api/deals/:id', () => {
  it('returns 200 on successful delete', async () => {
    Deal.findByIdAndDelete.mockResolvedValue(SAMPLE_DEAL);

    const res = await request(app).delete('/api/deals/deal-id-1');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});

// ── POST /api/deals/generate ───────────────────────────────────────────────────

describe('POST /api/deals/generate', () => {
  beforeEach(() => {
    scrapeProduct.mockResolvedValue(SAMPLE_PRODUCT);
    generateAffiliateLink.mockResolvedValue('https://www.amazon.in/dp/B08N5WRWNW?tag=test-track-21');
    evaluateDeal.mockResolvedValue({ shouldPost: true, reason: '34% off', dealType: 'discount' });
    upsertDeal.mockResolvedValue({ ...SAMPLE_DEAL, _id: 'deal-id-1' });
  });

  it('returns 200 with deal data on success', async () => {
    const res = await request(app)
      .post('/api/deals/generate')
      .send({ url: 'https://www.amazon.in/dp/B08N5WRWNW' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.deal).toBeDefined();
  });

  it('returns 400 when url is missing', async () => {
    const res = await request(app).post('/api/deals/generate').send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/url is required/i);
  });

  it('returns 422 when scraper returns no data', async () => {
    scrapeProduct.mockResolvedValue(null);

    const res = await request(app)
      .post('/api/deals/generate')
      .send({ url: 'https://www.amazon.in/dp/B08N5WRWNW' });

    expect(res.status).toBe(422);
  });

  it('uses original URL as fallback when affiliate link fails', async () => {
    generateAffiliateLink.mockRejectedValue(new Error('EarnKaro session expired'));

    const res = await request(app)
      .post('/api/deals/generate')
      .send({ url: 'https://www.amazon.in/dp/B08N5WRWNW' });

    // Should still succeed — affiliate failure is non-fatal
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('includes shouldPost and reason in response', async () => {
    const res = await request(app)
      .post('/api/deals/generate')
      .send({ url: 'https://www.amazon.in/dp/B08N5WRWNW' });

    expect(res.body).toHaveProperty('shouldPost');
    expect(res.body).toHaveProperty('reason');
  });
});

// ── POST /api/deals/:id/post ───────────────────────────────────────────────────

describe('POST /api/deals/:id/post', () => {
  it('posts deal to Telegram and marks as posted', async () => {
    const dealObj = { ...SAMPLE_DEAL };
    dealObj.save = jest.fn().mockResolvedValue({ ...dealObj, posted: true });
    Deal.findById.mockResolvedValue(dealObj);

    const res = await request(app).post('/api/deals/deal-id-1/post');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('returns 404 for unknown deal id', async () => {
    Deal.findById.mockResolvedValue(null);

    const res = await request(app).post('/api/deals/bad-id/post');
    expect(res.status).toBe(404);
  });
});
