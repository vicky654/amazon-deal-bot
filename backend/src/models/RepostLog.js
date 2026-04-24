'use strict';
const mongoose = require('mongoose');

// Tracks every deal reposted via the Telegram listener.
// MongoDB TTL index auto-deletes documents after expireAt.
const schema = new mongoose.Schema({
  asin:          { type: String, required: true },
  urlHash:       { type: String },                 // SHA-256 of normalized Amazon URL
  titleKey:      { type: String },                 // normalized title for similarity check
  sourceChannel: { type: String },
  repostedAt:    { type: Date, default: Date.now },
  expireAt:      {
    type:    Date,
    expires: 0,                                    // deleted when expireAt <= now
    default: () => new Date(Date.now() + 24 * 60 * 60 * 1000), // 24h default
  },
});

schema.index({ asin: 1 }, { unique: true });
schema.index({ urlHash: 1 });

module.exports = mongoose.model('RepostLog', schema);
