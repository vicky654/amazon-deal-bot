/**
 * Deal Scorer
 *
 * Computes a 0–100 score for a scraped product.
 * Only deals with score >= MIN_SCORE_TO_POST are automatically posted.
 *
 * Scoring breakdown:
 *   Discount %     → up to 50 pts  (linear, capped at 70%)
 *   Rupee savings  → up to 20 pts  (tiered)
 *   Price-drop     → +10 pts bonus
 *   Affordable     → +5  pts if price < ₹1,000
 *   High savings   → +5  pts if savings > ₹500
 *   Manual deal    → +10 pts (always gets a boost)
 */

const MIN_SCORE_TO_POST = parseInt(process.env.MIN_DEAL_SCORE || '30', 10);

/**
 * @param {object} product   Standardised product object from scraper
 * @param {string} dealType  'discount' | 'price-drop' | 'manual'
 * @returns {number} score 0–100
 */
function scoreDeal(product, dealType = 'discount') {
  let score = 0;

  const discount = product.discount || 0;
  const price    = product.price    || 0;
  const origPrice = product.originalPrice || 0;
  const savings  = origPrice > price ? origPrice - price : 0;

  // ── Discount percentage (0–50 pts) ────────────────────────────────────────
  score += Math.min(discount, 70) * (50 / 70);

  // ── Rupee savings tiers (0–20 pts) ────────────────────────────────────────
  if      (savings > 10_000) score += 20;
  else if (savings >  5_000) score += 16;
  else if (savings >  2_000) score += 12;
  else if (savings >  1_000) score += 8;
  else if (savings >    500) score += 5;
  else if (savings >    200) score += 2;

  // ── Price drop bonus ──────────────────────────────────────────────────────
  if (dealType === 'price-drop') score += 10;

  // ── Affordable product bonus (<₹1000) ─────────────────────────────────────
  if (price > 0 && price < 1_000) score += 5;

  // ── Manual deal always gets boosted ──────────────────────────────────────
  if (dealType === 'manual') score += 10;

  return Math.min(Math.round(score), 100);
}

/**
 * Human-readable score label.
 * @param {number} score
 * @returns {{ label: string, tier: 'hot'|'good'|'ok'|'weak' }}
 */
function scoreLabel(score) {
  if (score >= 75) return { label: '🔥 Hot Deal',    tier: 'hot'  };
  if (score >= 55) return { label: '✅ Good Deal',    tier: 'good' };
  if (score >= 35) return { label: '👍 Decent Deal',  tier: 'ok'   };
  return               { label: '💤 Weak Deal',    tier: 'weak' };
}

module.exports = { scoreDeal, scoreLabel, MIN_SCORE_TO_POST };
