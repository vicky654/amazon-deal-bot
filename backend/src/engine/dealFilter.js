/**
 * Deal Filter — Platform-Aware
 *
 * A product qualifies (any rule matches):
 *   Rule 1  Direct discount tag   ≥ AMAZON_MIN_DISCOUNT% (default 40%)
 *   Rule 2a Computed discount      ≥ threshold %
 *   Rule 2b Absolute price drop    ≥ AMAZON_MIN_PRICE_DROP_RS (default ₹500)
 *   Rule 3  Historical price drop  ≥ AMAZON_PRICE_DROP% vs lowest stored price (Amazon only)
 *
 * All thresholds are overridable via env vars.
 */

const Deal   = require('../models/Deal');
const logger = require('../../utils/logger');
const { scoreDeal } = require('./dealScorer');

const THRESHOLDS = {
  amazon:   { discount: parseInt(process.env.AMAZON_MIN_DISCOUNT   || '40', 10), priceDrop: parseInt(process.env.AMAZON_PRICE_DROP || '30', 10), priceDropRs: parseInt(process.env.AMAZON_MIN_PRICE_DROP_RS || '500', 10) },
  flipkart: { discount: parseInt(process.env.FLIPKART_MIN_DISCOUNT || '50', 10), priceDrop: 0, priceDropRs: 0 },
  myntra:   { discount: parseInt(process.env.MYNTRA_MIN_DISCOUNT   || '50', 10), priceDrop: 0, priceDropRs: 0 },
  ajio:     { discount: parseInt(process.env.AJIO_MIN_DISCOUNT     || '50', 10), priceDrop: 0, priceDropRs: 0 },
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

  // ── Rule 2: Computed discount OR absolute price drop ────────────────────
  if (price && originalPrice && originalPrice > price) {
    const computed     = Math.round(((originalPrice - price) / originalPrice) * 100);
    const absoluteDrop = Math.round(originalPrice - price);

    if (computed >= threshold.discount) {
      return {
        shouldPost: true,
        reason:   `${computed}% off (computed, ≥ ${threshold.discount}% threshold)`,
        dealType: 'discount',
      };
    }

    if (threshold.priceDropRs > 0 && absoluteDrop >= threshold.priceDropRs) {
      return {
        shouldPost: true,
        reason:   `₹${absoluteDrop} price drop (≥ ₹${threshold.priceDropRs} threshold)`,
        dealType: 'price-drop',
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
  const { 
    platform, asin, title, price, originalPrice, discount, image, affiliateLink, url, originalLink, finalLink,
    rating, reviewCount, brand, isLightningDeal, couponInfo, badgeInfo, dealScore, isVerifiedDeal
  } = product;

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
    existing.originalLink  = originalLink  || url || existing.originalLink;
    existing.finalLink     = finalLink     || existing.finalLink;
    existing.link          = url           || existing.link;
    existing.category      = category      || existing.category;
    existing.dealType      = dealType      || existing.dealType;
    existing.filterReason  = reason;

    // Smart Metadata
    existing.rating          = rating          || existing.rating;
    existing.reviewCount      = reviewCount      || existing.reviewCount;
    existing.brand           = brand           || existing.brand;
    existing.isLightningDeal = isLightningDeal !== undefined ? isLightningDeal : existing.isLightningDeal;
    existing.couponInfo      = couponInfo      || existing.couponInfo;
    existing.badgeInfo       = badgeInfo       || existing.badgeInfo;
    existing.dealScore       = dealScore       !== undefined ? dealScore : existing.dealScore;
    existing.isVerifiedDeal  = isVerifiedDeal  !== undefined ? isVerifiedDeal : existing.isVerifiedDeal;

    existing.priceHistory.push(priceEntry);
    if (existing.priceHistory.length > 50) existing.priceHistory.shift();

    const saved = await existing.save();
    await pruneOldDeals();
    return saved;
  }

  const created = await Deal.create({
    platform,
    asin:          asin || `${platform}_${Date.now()}`,
    title,
    brand,
    price,
    originalPrice: originalPrice || null,
    discount:      discount || null,
    image:         image || null,
    rating,
    reviewCount,
    isLightningDeal,
    couponInfo,
    badgeInfo,
    dealScore:     dealScore || 0,
    isVerifiedDeal: isVerifiedDeal || false,
    affiliateLink: affiliateLink || null,
    originalLink:  originalLink || url,
    finalLink:     finalLink    || affiliateLink || url,
    link:          url,
    category:      category || platform,
    dealType:      dealType || 'discount',
    filterReason:  reason,
    score:         dealScore || 0, // sync legacy field
    posted:        false,
    priceHistory:  [priceEntry],
    steps: {
      scrape:    { done: true,  at: new Date() },
      filter:    { done: true,  at: new Date(), reason },
      affiliate: { done: !!(affiliateLink), at: new Date() },
      telegram:  { done: false },
    },
  });
  await pruneOldDeals();
  return created;
}

const DEAL_LIMIT = 200;

/**
 * Prune unposted deals older than 48h. Never deletes posted deals —
 * PostedLog (TTL 5 days) is the dedup authority, not this collection.
 */
async function pruneOldDeals() {
  try {
    const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000);
    const result = await Deal.deleteMany({ posted: false, createdAt: { $lt: cutoff } });
    if (result.deletedCount > 0) {
      logger.info(`[Cleanup] Pruned ${result.deletedCount} unposted deal(s) older than 48h.`);
    }
  } catch (err) {
    logger.warn(`[Cleanup] Prune failed: ${err.message}`);
  }
}

module.exports = { evaluateDeal, upsertDeal, pruneOldDeals };
