const PriceHistory = require('../models/PriceHistory');
const DealEvent    = require('../models/DealEvent');
const Deal         = require('../models/Deal');
const logger       = require('../../utils/logger');

/**
 * Price Engine — handles historical price tracking and analytics
 */

/**
 * Record a new price point and update product historical stats
 * @param {string} asin
 * @param {number} price
 * @param {number} originalPrice
 * @param {string} platform
 */
async function recordPricePoint(asin, price, originalPrice, platform = 'amazon') {
  if (!asin || !price) return;

  try {
    // 1. Save to history
    await PriceHistory.create({
      asin,
      platform,
      price,
      originalPrice,
      timestamp: new Date(),
    });

    // 2. Fetch recent history for stats
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const history = await PriceHistory.find({
      asin,
      timestamp: { $gte: thirtyDaysAgo },
    }).sort({ timestamp: -1 }).lean();

    if (history.length === 0) return;

    // 3. Calculate stats
    let minPrice = price;
    let maxPrice = price;
    let sumPrice = 0;
    let sumPrice7d = 0;
    let count7d = 0;
    
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    history.forEach(h => {
      if (h.price < minPrice) minPrice = h.price;
      if (h.price > maxPrice) maxPrice = h.price;
      sumPrice += h.price;
      
      if (h.timestamp >= sevenDaysAgo) {
        sumPrice7d += h.price;
        count7d++;
      }
    });

    const avg30d = Math.round(sumPrice / history.length);
    const avg7d  = count7d > 0 ? Math.round(sumPrice7d / count7d) : avg30d;

    // 4. Check for events (Lowest Ever etc.)
    const deal = await Deal.findOne({ asin, platform });
    if (deal) {
      const isLowestEver = !deal.lowestPrice || price < deal.lowestPrice;
      
      if (isLowestEver && deal.lowestPrice && price < deal.lowestPrice) {
        await DealEvent.create({
          asin,
          platform,
          eventType: 'lowest-ever',
          previousPrice: deal.lowestPrice,
          currentPrice: price,
          detectedAt: new Date(),
        });
      }

      // 5. Update Deal model with new stats
      await Deal.updateOne(
        { asin, platform },
        {
          $set: {
            lowestPrice:  isLowestEver ? price : (deal.lowestPrice || price),
            highestPrice: deal.highestPrice ? Math.max(deal.highestPrice, price) : price,
            avg7dPrice:   avg7d,
            avg30dPrice:  avg30d,
            lastPrice:    price,
          }
        }
      );
    }

    return { avg30d, avg7d, minPrice, maxPrice };
  } catch (err) {
    logger.error(`[PriceEngine] Error for ${asin}: ${err.message}`);
    return null;
  }
}

module.exports = { recordPricePoint };
