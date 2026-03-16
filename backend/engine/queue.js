/**
 * ProductQueue — In-process async job queue with concurrency control.
 *
 * Why not BullMQ/Redis?
 *   BullMQ is excellent for multi-process distributed workloads. For a
 *   single-process crawler on one server, this custom queue gives you the
 *   same concurrency control and deduplication without the Redis dependency.
 *   Swap the `add/process` interface for BullMQ when you need distributed
 *   workers across multiple machines.
 *
 * Features:
 *   - Deduplication by ASIN (one job per product per crawl cycle)
 *   - Configurable concurrency (default: 2 parallel Puppeteer tabs)
 *   - Drainable: process() returns a Promise that resolves when all jobs finish
 *   - Per-cycle reset: clear seen ASINs between cron ticks
 *   - Real-time stats for monitoring
 */

const EventEmitter = require('events');
const { extractAsin } = require('../utils/affiliate');
const logger = require('../utils/logger');

class ProductQueue extends EventEmitter {
  /**
   * @param {object} opts
   * @param {number} opts.concurrency  Max parallel jobs (default 2)
   */
  constructor({ concurrency = 2 } = {}) {
    super();
    this._concurrency = concurrency;
    this._pending = [];            // Jobs waiting to run: [{ url, meta }]
    this._seenAsins = new Set();   // ASINs added this cycle — prevents duplicates
    this._active = 0;              // Jobs currently running
    this._processed = 0;           // Jobs completed (success + error) this cycle
    this._errors = 0;              // Jobs that threw an error this cycle
    this._processor = null;        // async (url, meta) => void
    this._drainResolvers = [];     // Resolve callbacks waiting on process()
  }

  /**
   * Set the function that processes each job.
   * Must be called before process().
   * @param {function} fn  async (url: string, meta: object) => void
   */
  setProcessor(fn) {
    this._processor = fn;
    return this;
  }

  /**
   * Add a product URL to the queue.
   * Silently ignores duplicates (same ASIN already added this cycle).
   *
   * @param {string} url   Amazon product URL
   * @param {object} meta  Arbitrary metadata passed to the processor (e.g. { category })
   * @returns {boolean}    true if added, false if duplicate/invalid
   */
  add(url, meta = {}) {
    const asin = extractAsin(url);
    if (!asin) return false;
    if (this._seenAsins.has(asin)) return false;

    this._seenAsins.add(asin);
    this._pending.push({ url, meta });
    return true;
  }

  /**
   * Add an array of URLs. Returns count of newly added (non-duplicate) jobs.
   * @param {string[]} urls
   * @param {object} meta
   * @returns {number}
   */
  addMany(urls, meta = {}) {
    return urls.reduce((count, url) => count + (this.add(url, meta) ? 1 : 0), 0);
  }

  /**
   * Start processing the queue.
   * Returns a Promise that resolves when every pending job has completed.
   * Safe to call when queue is empty — resolves immediately.
   */
  process() {
    if (!this._processor) {
      return Promise.reject(new Error('ProductQueue: call setProcessor() before process()'));
    }

    if (this._pending.length === 0 && this._active === 0) {
      return Promise.resolve();
    }

    return new Promise((resolve, reject) => {
      this._drainResolvers.push({ resolve, reject });
      this._tick();
    });
  }

  /**
   * Internal: pull jobs off the pending queue up to the concurrency limit.
   */
  _tick() {
    while (this._active < this._concurrency && this._pending.length > 0) {
      const job = this._pending.shift();
      this._active++;
      this._runJob(job).finally(() => {
        this._active--;
        this._tick();
        this._checkDrain();
      });
    }
  }

  /**
   * Internal: execute a single job, catching errors so the queue continues.
   */
  async _runJob({ url, meta }) {
    try {
      await this._processor(url, meta);
      this._processed++;
    } catch (error) {
      this._errors++;
      logger.error(`Queue: job failed [${url}]: ${error.message}`);
    }
  }

  /**
   * Internal: check if the queue has drained and resolve any waiting promises.
   */
  _checkDrain() {
    if (this._active === 0 && this._pending.length === 0) {
      const waiters = this._drainResolvers.splice(0);
      waiters.forEach(({ resolve }) => resolve());
      this.emit('drain');
    }
  }

  /**
   * Reset the queue for the next crawl cycle.
   * Clears the deduplication cache so new prices can be re-checked.
   */
  reset() {
    this._pending = [];
    this._seenAsins.clear();
    this._processed = 0;
    this._errors = 0;
    this._active = 0;
  }

  /**
   * Return a snapshot of queue health for monitoring.
   */
  stats() {
    return {
      pending: this._pending.length,
      active: this._active,
      processed: this._processed,
      errors: this._errors,
      seenThisCycle: this._seenAsins.size,
      concurrency: this._concurrency,
    };
  }
}

module.exports = ProductQueue;
