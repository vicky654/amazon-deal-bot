/**
 * Deal Model — Multi-Platform
 */

const mongoose = require('mongoose');

const priceEntrySchema = new mongoose.Schema(
  {
    price:         { type: Number },
    originalPrice: { type: Number },
    discount:      { type: Number },
    recordedAt:    { type: Date, default: Date.now },
  },
  { _id: false }
);

const dealSchema = new mongoose.Schema(
  {
    platform: {
      type:     String,
      enum:     ['amazon', 'flipkart', 'myntra', 'ajio', 'manual'],
      required: true,
      index:    true,
    },
    asin: {
      // Used as the primary business key for Amazon.
      // For other platforms, store their product ID or a URL-derived hash.
      type:  String,
      index: true,
    },
    title:         { type: String, required: true, trim: true },
    price:         { type: Number },
    originalPrice: { type: Number },
    discount:      { type: Number },  // percentage
    savings:       { type: Number },  // rupees saved (optional)
    image:         { type: String },
    link:          { type: String },  // canonical product URL
    affiliateLink: { type: String },  // affiliate URL (tag / EarnKaro)
    category:      { type: String, default: 'general' },
    dealType: {
      type:    String,
      enum:    ['discount', 'price-drop', 'manual'],
      default: 'discount',
    },
    filterReason: { type: String },
    score:        { type: Number, default: 0 },   // 0-100 deal score

    // ── Pipeline step tracking ──────────────────────────────────────────────
    steps: {
      scrape:    { done: { type: Boolean, default: false }, at: Date, error: String },
      filter:    { done: { type: Boolean, default: false }, at: Date, reason: String },
      affiliate: { done: { type: Boolean, default: false }, at: Date, error: String },
      telegram:  { done: { type: Boolean, default: false }, at: Date, error: String },
    },

    clicks:       { type: Number, default: 0 },
    posted:       { type: Boolean, default: false, index: true },
    postedAt:     { type: Date },
    lastPostedAt: { type: Date },   // updated on every post (including re-posts)
    lastPrice:    { type: Number }, // price at time of last post (for price-drop detection)
    scheduledFor: { type: Date, default: null },
    priceHistory: {
      type:    [priceEntrySchema],
      default: [],
    },
  },
  {
    timestamps: true,
    collection: 'deals',
  }
);

dealSchema.index({ asin: 1, platform: 1 }, { unique: true, sparse: true });
dealSchema.index({ platform: 1, posted: 1 });
dealSchema.index({ createdAt: -1 });

module.exports = mongoose.models.Deal || mongoose.model('Deal', dealSchema);
