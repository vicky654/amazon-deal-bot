/**
 * CrawlerRun Model — tracks every automated crawl cycle
 */

const mongoose = require('mongoose');

const categoryStatSchema = new mongoose.Schema(
  {
    categoryId:   String,
    categoryName: String,
    platform:     String,
    linksFound:   { type: Number, default: 0 },
    newLinks:     { type: Number, default: 0 },
  },
  { _id: false }
);

const crawlerRunSchema = new mongoose.Schema(
  {
    status: {
      type:    String,
      enum:    ['running', 'completed', 'failed'],
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
      byPlatform: {
        amazon:   { scraped: Number, deals: Number, errors: Number },
        flipkart: { scraped: Number, deals: Number, errors: Number },
        myntra:   { scraped: Number, deals: Number, errors: Number },
        ajio:     { scraped: Number, deals: Number, errors: Number },
      },
    },
    categoryStats: [categoryStatSchema],
    error:         { type: String },
  },
  {
    timestamps: false,
    collection: 'crawlerruns',
  }
);

crawlerRunSchema.index({ startedAt: -1 });

module.exports = mongoose.models.CrawlerRun || mongoose.model('CrawlerRun', crawlerRunSchema);
