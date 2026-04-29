/**
 * Scoring Engine — calculates deal quality scores (0-100)
 */

const logger = require('../../utils/logger');

/**
 * Calculate a weighted deal score
 * 
 * Weights:
 * - Price Drop vs 30d Avg (40%)
 * - Proximity to Historical Low (20%)
 * - Rating/Quality (15%)
 * - Review Volume (10%)
 * - Urgency/Badges (10%)
 * - Coupon/Savings (5%)
 * 
 * @param {Object} product
 * @returns {number} score 0-100
 */
function calculateDealScore(product) {
  let score = 0;

  try {
    const {
      price,
      originalPrice,
      avg30dPrice,
      lowestPrice,
      rating,
      reviewCount,
      isLightningDeal,
      couponInfo,
      isVerifiedDeal
    } = product;

    // 1. Price Drop vs 30d Average (Max 40 pts)
    if (avg30dPrice && price < avg30dPrice) {
      const dropPct = ((avg30dPrice - price) / avg30dPrice) * 100;
      // 20% drop = 40 pts, 10% drop = 20 pts
      score += Math.min(dropPct * 2, 40);
    }

    // 2. Historical Low (Max 20 pts)
    if (lowestPrice) {
      if (price <= lowestPrice) {
        score += 20; // It's the lowest ever!
      } else {
        const proximity = ((price - lowestPrice) / lowestPrice) * 100;
        if (proximity < 5) score += 15;
        else if (proximity < 10) score += 10;
      }
    } else {
      // No history yet, give a baseline if discount is high
      const discount = product.discount || 0;
      if (discount > 50) score += 10;
    }

    // 3. Rating Quality (Max 15 pts)
    if (rating) {
      if (rating >= 4.5) score += 15;
      else if (rating >= 4.0) score += 10;
      else if (rating >= 3.5) score += 5;
      else score -= 10; // Low rating penalty
    }

    // 4. Review Volume (Max 10 pts)
    if (reviewCount) {
      if (reviewCount > 5000) score += 10;
      else if (reviewCount > 1000) score += 7;
      else if (reviewCount > 100) score += 4;
    }

    // 5. Urgency & Badges (Max 10 pts)
    if (isLightningDeal) score += 10;
    if (isVerifiedDeal) score += 5;

    // 6. Extra Savings (Max 5 pts)
    if (couponInfo) score += 5;

    // ── Fake Discount Detection Penalty ──
    // If MRP (originalPrice) is significantly higher than 30d Avg, it's a fake discount
    if (originalPrice && avg30dPrice && originalPrice > avg30dPrice * 1.5) {
      const inflationFactor = originalPrice / avg30dPrice;
      if (inflationFactor > 2) score -= 30; // Extreme inflation
      else if (inflationFactor > 1.5) score -= 15;
    }

    return Math.max(0, Math.min(100, Math.round(score)));
  } catch (err) {
    logger.error(`[ScoringEngine] Error: ${err.message}`);
    return 0;
  }
}

/**
 * Determine if a deal is "verified" based on score and price drop
 */
function isVerified(product, score) {
  if (score >= 80) return true;
  if (product.price < product.avg30dPrice * 0.85 && product.rating >= 4) return true;
  return false;
}

module.exports = { calculateDealScore, isVerified };
