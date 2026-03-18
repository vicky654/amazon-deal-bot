/**
 * Queue System — Unit Tests
 *
 * Tests concurrency enforcement without any external dependencies.
 */

// Reset queue singletons between tests by clearing the module registry
beforeEach(() => {
  jest.resetModules();
});

describe('Scrape Queue', () => {
  it('respects configured concurrency limit', async () => {
    process.env.SCRAPE_CONCURRENCY = '2';
    const { getScrapeQueue } = require('../src/queue');
    const queue = getScrapeQueue();

    let concurrent = 0;
    let maxConcurrent = 0;

    const jobs = Array.from({ length: 6 }, (_, i) =>
      queue.add(async () => {
        concurrent++;
        maxConcurrent = Math.max(maxConcurrent, concurrent);
        await new Promise((r) => setTimeout(r, 30));
        concurrent--;
        return i;
      })
    );

    const results = await Promise.all(jobs);

    expect(maxConcurrent).toBeLessThanOrEqual(2);
    expect(results).toHaveLength(6);
  });

  it('processes all jobs and returns their results', async () => {
    const { getScrapeQueue } = require('../src/queue');
    const queue = getScrapeQueue();

    const results = await Promise.all(
      [10, 20, 30].map((n) => queue.add(async () => n * 2))
    );

    expect(results).toEqual([20, 40, 60]);
  });

  it('propagates job errors without stopping the queue', async () => {
    const { getScrapeQueue } = require('../src/queue');
    const queue = getScrapeQueue();

    const results = await Promise.allSettled([
      queue.add(async () => 'ok'),
      queue.add(async () => { throw new Error('job failed'); }),
      queue.add(async () => 'also ok'),
    ]);

    expect(results[0].status).toBe('fulfilled');
    expect(results[0].value).toBe('ok');
    expect(results[1].status).toBe('rejected');
    expect(results[1].reason.message).toBe('job failed');
    expect(results[2].status).toBe('fulfilled');
    expect(results[2].value).toBe('also ok');
  });

  it('exposes correct queue stats', async () => {
    const { getScrapeQueue, getQueueStats } = require('../src/queue');
    const queue = getScrapeQueue();

    // Add a slow job so there's something in the queue
    const job = queue.add(() => new Promise((r) => setTimeout(r, 100)));
    const stats = getQueueStats();

    expect(stats).toHaveProperty('scrape');
    expect(stats.scrape).toHaveProperty('concurrency');
    expect(stats.scrape.concurrency).toBe(2);

    await job;
  });
});

describe('Affiliate Queue', () => {
  it('enforces concurrency = 1 (serial execution)', async () => {
    process.env.AFFILIATE_CONCURRENCY = '1';
    const { getAffiliateQueue } = require('../src/queue');
    const queue = getAffiliateQueue();

    let concurrent = 0;
    let maxConcurrent = 0;

    const jobs = Array.from({ length: 4 }, () =>
      queue.add(async () => {
        concurrent++;
        maxConcurrent = Math.max(maxConcurrent, concurrent);
        await new Promise((r) => setTimeout(r, 20));
        concurrent--;
      })
    );

    await Promise.all(jobs);

    // EarnKaro session safety: strictly serial
    expect(maxConcurrent).toBe(1);
  });

  it('completes all jobs in order of addition', async () => {
    const { getAffiliateQueue } = require('../src/queue');
    const queue = getAffiliateQueue();
    const order = [];

    await Promise.all(
      [1, 2, 3].map((n) =>
        queue.add(async () => {
          order.push(n);
          return n;
        })
      )
    );

    expect(order).toEqual([1, 2, 3]);
  });
});

describe('drainAll()', () => {
  it('resolves when both queues are idle', async () => {
    const { getScrapeQueue, getAffiliateQueue, drainAll } = require('../src/queue');
    getScrapeQueue().add(() => new Promise((r) => setTimeout(r, 10)));
    getAffiliateQueue().add(() => new Promise((r) => setTimeout(r, 10)));

    await expect(drainAll()).resolves.toBeUndefined();
  });
});
