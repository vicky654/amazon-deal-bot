/**
 * Deal Filter Engine
 *
 * Evaluates a scraped product against multiple criteria to decide
 * whether it's worth saving and posting to Telegram.
 *
 * Criteria (any one is sufficient):
 *   1. Discount ≥ MIN_DISCOUNT_PERCENT (default 60%)
 *   2. Price dropped ≥ PRICE_DROP_THRESHOLD (default 30%) vs last recorded price
 *
 * The filter also:
 *   - Updates price history in MongoDB (always, not just for good deals)
 *   - Returns a structured result with the reason for the decision
 *   - Detects deal type (discount / price-drop) for categorisation
 */

const Deal = require('../models/Deal');
const logger = require('../utils/logger');

const MIN_DISCOUNT = parseInt(process.env.MIN_DISCOUNT_PERCENT || '60', 10);
const PRICE_DROP_THRESHOLD = parseInt(process.env.PRICE_DROP_THRESHOLD || '30', 10);

/**
 * Evaluate whether a product is a good deal and update its price history.
 *
 * @param {object} product  Scraped product from scraper.js
 * @returns {Promise<{ shouldPost: boolean, reason: string, dealType: string|null }>}
 */
async function evaluateDeal(product) {
  if (!product || !product.asin) {
    return { shouldPost: false, reason: 'No ASIN available', dealType: null };
  }

  // ── 1. Discount threshold ──────────────────────────────────────────────────
  if (product.savings != null && product.savings >= MIN_DISCOUNT) {
    return {
      shouldPost: true,
      reason: `${product.savings}% off (threshold: ${MIN_DISCOUNT}%)`,
      dealType: 'discount',
    };
  }

  // ── 2. Price history — check for significant price drop ───────────────────
  if (product.price != null) {
    try {
      const existing = await Deal.findOne({ asin: product.asin })
        .select('price priceHistory')
        .lean();

      if (existing && existing.price != null && product.price < existing.price) {
        const priceDrop = Math.round(
          ((existing.price - product.price) / existing.price) * 100
        );

        if (priceDrop >= PRICE_DROP_THRESHOLD) {
          logger.info(
            `Price drop detected for ${product.asin}: ₹${existing.price} → ₹${product.price} (${priceDrop}% drop)`
          );
          return {
            shouldPost: true,
            reason: `Price dropped ${priceDrop}% (₹${existing.price} → ₹${product.price})`,
            dealType: 'price-drop',
          };
        }
      }
    } catch (error) {
      // DB error — don't block the evaluation, just skip the history check
      logger.warn(`Price history check failed for ${product.asin}: ${error.message}`);
    }
  }

  return {
    shouldPost: false,
    reason: `Discount ${product.savings ?? 0}% < ${MIN_DISCOUNT}% and no significant price drop`,
    dealType: null,
  };
}

/**
 * Upsert deal in MongoDB — creates new or updates existing record.
 * Always appends to price history so we can track trends over time.
 *
 * @param {object} product   Scraped product data
 * @param {string} category  Category ID from crawler
 * @param {string} dealType  'discount' | 'price-drop'
 * @param {string} reason    Human-readable filter reason
 * @returns {Promise<object>}  The saved/updated Deal document
 */
async function upsertDeal(product, category, dealType, reason) {
  const priceEntry = {
    price: product.price,
    originalPrice: product.originalPrice,
    savings: product.savings,
    recordedAt: new Date(),
  };

  const existing = await Deal.findOne({ asin: product.asin });

  if (existing) {
    // Update the existing deal: refresh prices and append history
    await existing.updateOne({
      $set: {
        title: product.title,
        price: product.price,
        originalPrice: product.originalPrice,
        savings: product.savings,
        image: product.image || existing.image,
        link: product.link,
        dealType,
        filterReason: reason,
        category,
        // Preserve `posted` — don't clear it so we don't re-post on updates
      },
      $push: {
        priceHistory: {
          $each: [priceEntry],
          $slice: -50, // keep last 50 price points to avoid unbounded growth
        },
      },
    });

    // Return fresh doc
    return Deal.findById(existing._id);
  }

  // Create new deal
  const deal = new Deal({
    title: product.title,
    asin: product.asin,
    price: product.price,
    originalPrice: product.originalPrice,
    savings: product.savings,
    image: product.image || '',
    link: product.link,
    dealType,
    filterReason: reason,
    category,
    posted: false,
    priceHistory: [priceEntry],
  });

  await deal.save();
  return deal;
}

module.exports = { evaluateDeal, upsertDeal };
