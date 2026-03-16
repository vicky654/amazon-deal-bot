const mongoose = require("mongoose");

const dealSchema = new mongoose.Schema(
{
title: {
type: String,
required: true,
trim: true
},

price: {
type: Number,
default: null
},

originalPrice: {
type: Number
},

savings: {
type: Number
},

image: {
type: String,
default: ""
},

link: {
type: String,
required: true
},

asin: {
type: String,
index: true
},

posted: {
type: Boolean,
default: false
}

},
{
timestamps: true
}
);

const Deal = mongoose.model("Deal", dealSchema);

module.exports = Deal;