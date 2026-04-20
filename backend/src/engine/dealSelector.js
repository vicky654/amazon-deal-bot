/**
 * Deal Selector — Batch / Scheduled Posting
 *
 * Used when you want to pick N deals to post in one batch (e.g. scheduled job,
 * manual trigger). NOT used by the streaming crawler — that posts inline.
 *
 * Selection mix:
 *   40% trending  — highest score deals
 *   30% fresh     — most recently scraped
 *   30% random    — shuffle picks, forces variety
 *
 * Guarantees:
 *   - Never picks a product in PostedLog (5-day TTL window)
 *   - Max MAX_BRAND_PER_BATCH deals per brand in one batch
 *   - Score includes ±8 jitter so rotation doesn't repeat in a fixed order
 */

const Deal      = require('../models/Deal');
const PostedLog = require('../models/PostedLog');
const { scoreDeal } = require('./dealScorer');
const { extractBrand } = require('./dedup');

const MAX_BRAND_PER_BATCH = parseInt(process.env.MAX_BRAND_PER_BATCH || '2', 10);

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function takeUnique(pool, n, picked) {
  const out = [];
  for (const d of pool) {
    if (out.length >= n) break;
    const id = String(d._id);
    if (picked.has(id)) continue;
    picked.add(id);
    out.push(d);
  }
  return out;
}

function applyBrandCap(deals, cap) {
  const brandCount = new Map();
  return deals.filter((d) => {
    const brand = extractBrand(d.title);
    const count = brandCount.get(brand) || 0;
    if (count >= cap) return false;
    brandCount.set(brand, count + 1);
    return true;
  });
}

/**
 * Fetch deals not in PostedLog, apply 40/30/30 selection.
 *
 * @param {object} opts
 * @param {string} [opts.platform]      Filter by platform (optional)
 * @param {number} [opts.limit=10]      Total deals to return
 * @param {number} [opts.minScore=25]   Minimum deal score to consider
 */
async function getFreshDeals({ platform, limit = 10, minScore = 25 } = {}) {
  // Build set of product IDs blocked by PostedLog
  const blocked = await PostedLog
    .find(platform ? { platform } : {})
    .select('productId platform')
    .lean();
  const blockedKeys = new Set(blocked.map((l) => `${l.productId}:${l.platform}`));

  // Fetch candidate deals from DB (over-fetch to allow filtering)
  const query = { price: { $gt: 0 }, score: { $gte: minScore } };
  if (platform) query.platform = platform;

  const candidates = await Deal.find(query)
    .sort({ score: -1, createdAt: -1 })
    .limit(limit * 8)
    .lean();

  // Filter out blocked products
  const pool = candidates.filter((d) => {
    const pid = d.asin ? d.asin.toUpperCase() : null;
    if (!pid) return true; // non-ASIN: rely on titleKey dedup in crawler
    return !blockedKeys.has(`${pid}:${d.platform}`);
  });

  if (pool.length === 0) return [];

  // Apply score jitter for rotation variety
  const scored = pool.map((d) => ({
    ...d,
    _liveScore: scoreDeal(d, d.dealType, true),
  }));

  // 40% trending, 30% fresh, 30% random
  const nTrending = Math.ceil(limit * 0.4);
  const nFresh    = Math.ceil(limit * 0.3);
  const nRandom   = limit - nTrending - nFresh;

  const byScore = [...scored].sort((a, b) => b._liveScore - a._liveScore);
  const byDate  = [...scored].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  const byRand  = shuffle(scored);

  const picked   = new Set();
  const selected = [
    ...takeUnique(byScore, nTrending, picked),
    ...takeUnique(byDate,  nFresh,    picked),
    ...takeUnique(byRand,  nRandom,   picked),
  ];

  // Apply brand cap, then shuffle final list so order varies each call
  return shuffle(applyBrandCap(selected, MAX_BRAND_PER_BATCH));
}

/**
 * Only deletes unposted deals older than 48h.
 * Posted deals are never touched — PostedLog is the dedup authority.
 */
async function safePruneDeals() {
  const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000);
  const result = await Deal.deleteMany({ posted: false, createdAt: { $lt: cutoff } });
  return result.deletedCount;
}

module.exports = { getFreshDeals, safePruneDeals };
