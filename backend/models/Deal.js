const mongoose = require('mongoose');

const dealSchema = new mongoose.Schema({
  // Product title
  title: {
    type: String,
    required: true,
    trim: true
  },
  // Product price
  price: {
    type: Number,
    default: null
  },
  // Product image URL
  image: {
    type: String,
    default: ''
  },
    originalPrice: {
    type: Number
  },

  savings: {
    type: Number
  },

  // Product affiliate link
  link: {
    type: String,
    required: true
  },
  // Creation timestamp
  createdAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Index for faster queries
dealSchema.index({ createdAt: -1 });

// Virtual for formatted price with Rupee symbol
dealSchema.virtual('formattedPrice').get(function() {
  if (this.price) {
    return `₹${this.price.toFixed(2)}`;
  }
  return 'N/A';
});

// Method to check if deal is recent (less than 24 hours old)
dealSchema.methods.isRecent = function() {
  const now = new Date();
  const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  return this.createdAt > twentyFourHoursAgo;
};

// Static method to get all deals sorted by newest first
dealSchema.statics.getAllDeals = function() {
  return this.find().sort({ createdAt: -1 });
};

// Static method to get recent deals
dealSchema.statics.getRecentDeals = function(limit = 10) {
  return this.find().sort({ createdAt: -1 }).limit(limit);
};

const Deal = mongoose.model('Deal', dealSchema);

module.exports = Deal;

