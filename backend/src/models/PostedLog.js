const mongoose = require('mongoose');

const postedLogSchema = new mongoose.Schema({
  productId: { type: String, required: true },
  platform:  { type: String, required: true },
  titleKey:  { type: String, default: null },
  postedAt:  { type: Date, default: Date.now },
  // Dynamic TTL: expireAt = postedAt + cooldownMs (set by markAsPosted based on score).
  // MongoDB deletes the document when expireAt <= now (expireAfterSeconds: 0).
  // Default fallback: 5 days, in case markAsPosted is called without a score.
  expireAt:  { type: Date, expires: 0, default: () => new Date(Date.now() + 5 * 24 * 60 * 60 * 1000) },
});

// Compound unique index — idempotent upserts, fast lookups, prevents double-entries.
postedLogSchema.index({ productId: 1, platform: 1 }, { unique: true });

module.exports = mongoose.model('PostedLog', postedLogSchema);
