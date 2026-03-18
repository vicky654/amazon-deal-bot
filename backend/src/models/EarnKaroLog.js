const mongoose = require('mongoose');

const earnKaroLogSchema = new mongoose.Schema(
  {
    event:   {
      type: String,
      required: true,
      // login_success | login_fail | session_expired | refresh_start | refresh_success
      // refresh_failure | refresh_skipped | auto_relogin | validation | disconnect | error
    },
    level:   { type: String, enum: ['info', 'warn', 'error'], default: 'info' },
    message: { type: String, required: true },
    meta:    { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

earnKaroLogSchema.index({ createdAt: -1 });

module.exports = mongoose.model('EarnKaroLog', earnKaroLogSchema, 'earnkaro_logs');
