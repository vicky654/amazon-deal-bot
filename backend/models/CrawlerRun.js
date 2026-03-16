const mongoose = require('mongoose');

/**
 * Tracks each automated crawl cycle.
 * Used for monitoring, debugging, and the dashboard status panel.
 */

const categoryStatSchema = new mongoose.Schema({
  categoryId:   { type: String },
  categoryName: { type: String },
  linksFound:   { type: Number, default: 0 },
  newLinks:     { type: Number, default: 0 },
}, { _id: false });

const crawlerRunSchema = new mongoose.Schema(
  {
    status: {
      type: String,
      enum: ['running', 'completed', 'failed'],
      default: 'running',
    },

    startedAt:  { type: Date, default: Date.now },
    finishedAt: { type: Date },
    durationMs: { type: Number },

    stats: {
      categoriesScanned: { type: Number, default: 0 },
      linksExtracted:    { type: Number, default: 0 },
      productsScanned:   { type: Number, default: 0 },
      dealsFound:        { type: Number, default: 0 },
      dealsPosted:       { type: Number, default: 0 },
      errors:            { type: Number, default: 0 },
    },

    categoryStats: [categoryStatSchema],

    // Error message if status === 'failed'
    error: { type: String },
  },
  { timestamps: true }
);

// Index for efficient "get recent runs" queries
crawlerRunSchema.index({ startedAt: -1 });

const CrawlerRun = mongoose.model('CrawlerRun', crawlerRunSchema);

module.exports = CrawlerRun;
