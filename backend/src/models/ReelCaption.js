const mongoose = require('mongoose');

/**
 * Stores the last generated Instagram caption for each deal+template combo.
 * One document per (dealId, template) — upserted on every generate call.
 */
const reelCaptionSchema = new mongoose.Schema(
  {
    dealId:    { type: mongoose.Schema.Types.ObjectId, ref: 'Deal', required: true, index: true },
    dealTitle: { type: String, default: '' },
    template:  { type: String, enum: ['dark', 'sale', 'minimal'], default: 'dark' },
    caption:   { type: String, required: true },
    hashtags:  [{ type: String }],
    copiedAt:  { type: Date, default: null },   // set when user copies
  },
  { timestamps: true }
);

// Unique per (dealId, template) — ensures upsert works correctly
reelCaptionSchema.index({ dealId: 1, template: 1 }, { unique: true });

module.exports = mongoose.model('ReelCaption', reelCaptionSchema, 'reel_captions');
