const mongoose = require('mongoose');

const priceHistorySchema = new mongoose.Schema(
  {
    asin: {
      type:     String,
      required: true,
      index:    true,
    },
    platform: {
      type:     String,
      default:  'amazon',
      index:    true,
    },
    price:         { type: Number, required: true },
    originalPrice: { type: Number },
    discount:      { type: Number },
    timestamp:     { type: Date, default: Date.now, index: true },
  },
  {
    timestamps: false,
    collection: 'price_history',
  }
);

// Optimize for time-series range queries per ASIN
priceHistorySchema.index({ asin: 1, timestamp: -1 });

module.exports = mongoose.models.PriceHistory || mongoose.model('PriceHistory', priceHistorySchema);
