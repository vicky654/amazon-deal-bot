const mongoose = require('mongoose');

const postedLogSchema = new mongoose.Schema({
  productId: { type: String, required: true },  // ASIN (Amazon) | sha256 URL hash (others)
  platform:  { type: String, required: true },
  titleKey:  { type: String, default: null },
  postedAt:  { type: Date, default: Date.now, expires: 60 * 60 * 24 * 5 },  // 5-day TTL
});

// Compound unique index — prevents duplicate entries and enables fast, platform-scoped lookups.
// upsert in markAsPosted relies on this for idempotency.
postedLogSchema.index({ productId: 1, platform: 1 }, { unique: true });

module.exports = mongoose.model('PostedLog', postedLogSchema);
