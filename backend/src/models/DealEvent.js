const mongoose = require('mongoose');

const dealEventSchema = new mongoose.Schema(
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
    eventType: {
      type:     String,
      enum:     ['price-drop', 'lowest-ever', 'back-in-stock', 'coupon-added', 'lightning-deal'],
      required: true,
      index:    true,
    },
    previousPrice: { type: Number },
    currentPrice:  { type: Number, required: true },
    dropPercent:   { type: Number },
    detectedAt:    { type: Date, default: Date.now, index: true },
    metadata:      { type: mongoose.Schema.Types.Mixed }, // flexible storage for event-specific data
  },
  {
    timestamps: false,
    collection: 'deal_events',
  }
);

module.exports = mongoose.models.DealEvent || mongoose.model('DealEvent', dealEventSchema);
