/**
 * Deal Filter — Platform-Aware
 *
 * Platform-specific thresholds:
 *   amazon   → 40% discount OR 30% price drop
 *   flipkart → 40% discount
 *   myntra   → 50% discount (fashion standard)
 *   ajio     → 50% discount
 *
 * All thresholds overridable via env vars.
 */

const Deal   = require('../models/Deal');
const logger = require('../../utils/logger');
const { scoreDeal } = require('./dealScorer');

const THRESHOLDS = {
  amazon:   { discount: parseInt(process.env.AMAZON_MIN_DISCOUNT   || '40', 10), priceDrop: parseInt(process.env.AMAZON_PRICE_DROP   || '30', 10) },
  flipkart: { discount: parseInt(process.env.FLIPKART_MIN_DISCOUNT || '40', 10), priceDrop: 0 },
  myntra:   { discount: parseInt(process.env.MYNTRA_MIN_DISCOUNT   || '50', 10), priceDrop: 0 },
  ajio:     { discount: parseInt(process.env.AJIO_MIN_DISCOUNT     || '50', 10), priceDrop: 0 },
};

/**
 * Evaluate whether a scraped product qualifies as a deal.
 *
 * @param {object} product  Standardised product from scraper
 * @returns {{ shouldPost: boolean, reason: string, dealType: string }}
 */
async function evaluateDeal(product) {
  const { platform = 'amazon', price, originalPrice, discount, title } = product;
  const threshold = THRESHOLDS[platform] || THRESHOLDS.amazon;

  // ── Rule 1: Direct discount ─────────────────────────────────────────────
  if (discount && discount >= threshold.discount) {
    return {
      shouldPost: true,
      reason: `${discount}% off (≥ ${threshold.discount}% threshold)`,
      dealType: 'discount',
    };
  }

  // ── Rule 2: Computed discount from prices ────────────────────────────────
  if (price && originalPrice && originalPrice > price) {
    const computed = Math.round(((originalPrice - price) / originalPrice) * 100);
    if (computed >= threshold.discount) {
      return {
        shouldPost: true,
        reason: `${computed}% off (computed, ≥ ${threshold.discount}% threshold)`,
        dealType: 'discount',
      };
    }
  }

  // ── Rule 3: Price drop vs historical low (Amazon only) ───────────────────
  if (platform === 'amazon' && threshold.priceDrop > 0 && price) {
    try {
      const existing = await Deal.findOne({ asin: product.asin }).lean();
      if (existing && existing.priceHistory && existing.priceHistory.length >= 3) {
        const prices    = existing.priceHistory.map((h) => h.price).filter(Boolean);
        const lowestOld = Math.min(...prices);
        const dropPct   = Math.round(((lowestOld - price) / lowestOld) * 100);
        if (dropPct >= threshold.priceDrop) {
          return {
            shouldPost: true,
            reason: `Price drop ${dropPct}% below historical low ₹${lowestOld}`,
            dealType: 'price-drop',
          };
        }
      }
    } catch (err) {
      logger.warn(`[DealFilter] Price history check failed: ${err.message}`);
    }
  }

  return {
    shouldPost: false,
    reason: `Discount ${discount || 'N/A'}% below threshold ${threshold.discount}%`,
    dealType: null,
  };
}

/**
 * Upsert deal to MongoDB.
 * - Creates if new ASIN/platform
 * - Always appends to priceHistory (max 50)
 * - Never resets `posted` flag (prevents Telegram re-posts)
 */
async function upsertDeal(product, category, dealType, reason) {
  const { platform, asin, title, price, originalPrice, discount, image, affiliateLink, url } = product;

  const priceEntry = {
    price,
    originalPrice: originalPrice || null,
    discount:      discount || null,
    recordedAt:    new Date(),
  };

  const existing = await Deal.findOne({ asin, platform });

  if (existing) {
    existing.title         = title;
    existing.price         = price;
    existing.originalPrice = originalPrice || existing.originalPrice;
    existing.discount      = discount      || existing.discount;
    existing.image         = image         || existing.image;
    existing.affiliateLink = affiliateLink || existing.affiliateLink;
    existing.category      = category      || existing.category;
    existing.dealType      = dealType      || existing.dealType;
    existing.filterReason  = reason;

    existing.priceHistory.push(priceEntry);
    if (existing.priceHistory.length > 50) existing.priceHistory.shift();

    const saved = await existing.save();
    await pruneOldDeals();
    return saved;
  }

  const score = scoreDeal({ platform, price, originalPrice, discount }, dealType);

  const created = await Deal.create({
    platform,
    asin:          asin || `${platform}_${Date.now()}`,
    title,
    price,
    originalPrice: originalPrice || null,
    discount:      discount || null,
    image:         image || null,
    affiliateLink: affiliateLink || url,
    link:          url,
    category:      category || platform,
    dealType:      dealType || 'discount',
    filterReason:  reason,
    score,
    posted:        false,
    priceHistory:  [priceEntry],
    steps: {
      scrape:    { done: true,  at: new Date() },
      filter:    { done: true,  at: new Date(), reason },
      affiliate: { done: !!(affiliateLink && affiliateLink !== url), at: new Date() },
      telegram:  { done: false },
    },
  });
  await pruneOldDeals();
  return created;
}

const DEAL_LIMIT = 20;

/**
 * Keep only the latest DEAL_LIMIT deals in MongoDB.
 * Runs after every upsert — cheap because the collection never exceeds ~20 docs.
 */
async function pruneOldDeals() {
  try {
    const total = await Deal.countDocuments();
    if (total <= DEAL_LIMIT) return;

    const toKeep = await Deal.find()
      .sort({ createdAt: -1 })
      .limit(DEAL_LIMIT)
      .select('_id')
      .lean();

    const keepIds = toKeep.map((d) => d._id);
    const result  = await Deal.deleteMany({ _id: { $nin: keepIds } });

    if (result.deletedCount > 0) {
      logger.info(`[Cleanup] Pruned ${result.deletedCount} old deal(s). DB now holds ${DEAL_LIMIT}.`);
    }
  } catch (err) {
    logger.warn(`[Cleanup] Prune failed: ${err.message}`);
  }
}

module.exports = { evaluateDeal, upsertDeal, pruneOldDeals };
