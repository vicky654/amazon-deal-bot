const mongoose = require('mongoose');

const earnKaroSessionSchema = new mongoose.Schema(
  {
    cookies:          { type: Array,  required: true },
    cookiesCount:     { type: Number, default: 0 },
    email:            { type: String, default: '' },      // masked display only
    loginMethod:      { type: String, enum: ['auto', 'manual'], default: 'auto' },
    lastValidated:    { type: Date,   default: null },
    validationStatus: { type: String, enum: ['healthy', 'expired', 'unknown'], default: 'unknown' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('EarnKaroSession', earnKaroSessionSchema, 'earnkaro_sessions');
