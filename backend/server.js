require("dotenv").config();

const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");

const Deal = require("./models/Deal");
const scraper = require("./scraper");
const telegram = require("./telegram");

const app = express();

const PORT = process.env.PORT || 5000;

/*
MIDDLEWARE
*/

app.use(cors());
app.use(express.json());

/*
MONGODB CONNECTION
*/

const MONGODB_URI =
  process.env.MONGODB_URI || "mongodb://localhost:27017/deal-system";

mongoose
  .connect(MONGODB_URI)
  .then(() => console.log("✅ MongoDB Connected"))
  .catch((err) => console.error("MongoDB connection error:", err));

/*
GET ALL DEALS
*/

app.get("/api/deals", async (req, res) => {
  try {
    const deals = await Deal.find()
      .sort({ createdAt: -1 })
      .limit(50);

    res.json(deals);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/*
GET SINGLE DEAL
*/

app.get("/api/deals/:id", async (req, res) => {
  try {
    const deal = await Deal.findById(req.params.id);

    if (!deal) {
      return res.status(404).json({
        error: "Deal not found",
      });
    }

    res.json(deal);
  } catch (error) {
    res.status(500).json({
      error: error.message,
    });
  }
});

/*
GENERATE DEAL FROM AMAZON URL
*/

app.post("/generate", async (req, res) => {
  try {
    const { url } = req.body;

    if (!url) {
      return res.status(400).json({
        error: "Amazon URL is required",
      });
    }

    /*
    VALIDATE AMAZON URL
    */

    if (!url.includes("amazon")) {
      return res.status(400).json({
        error: "Please provide a valid Amazon product URL",
      });
    }

    /*
    DUPLICATE PROTECTION
    */

    const existingDeal = await Deal.findOne({ link: url });

    if (existingDeal) {
      return res.json(existingDeal);
    }

    /*
    SCRAPE PRODUCT
    */

    const product = await scraper.scrapeAmazonProduct(url);

    if (!product.title) {
      return res.status(500).json({
        error: "Failed to scrape product",
      });
    }

    /*
    SAVE DEAL
    */

  const deal = new Deal({
  title: product.title,
  price: product.price,
  image: product.image,
  link: product.link,
  savings: product.savings,
  originalPrice: product.originalPrice
});

    console.log("Generated deal:", product.price);

    await deal.save();

    res.json(deal);

  } catch (error) {
    console.error("Generate error:", error.message);

    res.status(500).json({
      error: error.message,
    });
  }
});

/*
SEND DEAL TO TELEGRAM
*/

app.post("/telegram", async (req, res) => {
  try {
const { title, price, image, link, originalPrice, savings } = req.body;

    if (!title || !link) {
      return res.status(400).json({
        error: "Title and link are required",
      });
    }

    /*
    FORMAT MESSAGE
    */

    // const caption = telegram.formatDealText(
    //   title,
    //   price,
    //   link
    // );



const caption = telegram.formatDealText(
  title,
  price,
  link,
  originalPrice,
  savings
);


    /*
    SEND TO TELEGRAM
    */


    const result = await telegram.sendToTelegram(
      image,
      caption
    );

    res.json({
      success: true,
      message: "Deal posted to Telegram",
      result,
    });

  } catch (error) {
    console.error("Telegram error:", error.message);

    res.status(500).json({
      error: error.message,
    });
  }
});

/*
SEND CUSTOM MESSAGE TO TELEGRAM
*/

app.post("/telegram-message", async (req, res) => {
  try {
    const { message } = req.body;

    if (!message) {
      return res.status(400).json({
        error: "Message is required",
      });
    }

    const result =
      await telegram.sendMessageToTelegram(message);

    res.json({
      success: true,
      message: "Message sent to Telegram",
      result,
    });

  } catch (error) {
    console.error("Telegram message error:", error.message);

    res.status(500).json({
      error: error.message,
    });
  }
});

/*
DELETE DEAL
*/

app.delete("/api/deals/:id", async (req, res) => {
  try {
    const deal = await Deal.findByIdAndDelete(
      req.params.id
    );

    if (!deal) {
      return res.status(404).json({
        error: "Deal not found",
      });
    }

    res.json({
      success: true,
      message: "Deal deleted",
    });

  } catch (error) {
    res.status(500).json({
      error: error.message,
    });
  }
});

/*
HEALTH CHECK
*/

app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    time: new Date().toISOString(),
  });
});

/*
START SERVER
*/

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});

module.exports = app;