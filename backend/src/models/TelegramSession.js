'use strict';
const mongoose = require('mongoose');

// Stores the GramJS StringSession so the server restarts without re-login.
const schema = new mongoose.Schema({
  sessionString: { type: String, required: true },
  updatedAt:     { type: Date, default: Date.now },
});

module.exports = mongoose.model('TelegramSession', schema);
