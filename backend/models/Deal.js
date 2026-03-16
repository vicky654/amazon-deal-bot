const mongoose = require('mongoose');

/**
 * Price history entry — one record per time we observed this product's price.
 * Capped at 50 entries per deal (managed in dealFilter.js upsert).
 */
const priceHistorySchema = new mongoose.Schema(
  {
    price:         { type: Number },
    originalPrice: { type: Number },
    savings:       { type: Number },
    recordedAt:    { type: Date, default: Date.now },
  },
  { _id: false }
);

const dealSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },

    // Amazon Standard Identification Number — primary business key
    asin: {
      type: String,
      index: true,
    },

    price: {
      type: Number,
      default: null,
    },

    originalPrice: {
      type: Number,
    },

    savings: {
      type: Number,
    },

    image: {
      type: String,
      default: '',
    },

    // Affiliate link (built by buildAffiliateLink in affiliate.js)
    link: {
      type: String,
      required: true,
    },

    // Which category crawler found this deal
    category: {
      type: String,
      default: 'manual',
    },

    // How the deal was classified
    dealType: {
      type: String,
      enum: ['discount', 'price-drop', 'manual', null],
      default: null,
    },

    // Human-readable reason from the deal filter engine
    filterReason: {
      type: String,
    },

    // Whether the deal has been posted to Telegram
    posted: {
      type: Boolean,
      default: false,
    },

    // When it was posted (null if not posted yet)
    postedAt: {
      type: Date,
      default: null,
    },

    // Price over time — enables "lowest price ever" and trend detection
    priceHistory: [priceHistorySchema],
  },
  {
    timestamps: true, // adds createdAt, updatedAt
  }
);

// Compound index used by the "skip if recently posted" check
dealSchema.index({ asin: 1, posted: 1 });

const Deal = mongoose.model('Deal', dealSchema);

module.exports = Deal;
