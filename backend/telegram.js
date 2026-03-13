const TelegramBot = require("node-telegram-bot-api");
require("dotenv").config();

/*
ENV VARIABLES
*/

const TOKEN = process.env.TELEGRAM_TOKEN;
const CHAT_ID = process.env.TELEGRAM_CHAT;

/*
INIT BOT
*/

let bot = null;

if (TOKEN) {
  bot = new TelegramBot(TOKEN);
  console.log("✅ Telegram bot initialized");
} else {
  console.log("⚠️ TELEGRAM_TOKEN missing in .env");
}

/*
FORMAT AMAZON DEAL TEXT
*/

function formatDealText(title, price, link, originalPrice, savings) {

  const merchant = "Amazon";

  const formattedPrice = price ? `₹${price}` : "Check Price";
  const formattedOriginal = originalPrice ? `₹${originalPrice}` : "N/A";

  let formattedSavings = "N/A";

  if (savings) {
    formattedSavings = `${savings}%`;
  } 
  else if (originalPrice && price) {
    const calc = Math.round(((originalPrice - price) / originalPrice) * 100);
    formattedSavings = `${calc}%`;
  }

  return `🔥 Amazon Deal

${title}

Merchant: ${merchant}

Original Price: ${formattedOriginal}
Deal Price: ${formattedPrice}
Savings: ${formattedSavings}

🛒 Buy Now:
${link}

Sent on <a href="https://t.me/+NJWXP0z-Sb00YThl">Daily Amazon Deals Telegram Channel</a>`;
}

/*
SEND DEAL TO TELEGRAM
(IMAGE + CAPTION)
*/

async function sendToTelegram(imageUrl, caption) {

  if (!bot || !CHAT_ID) {
    console.log("⚠️ Telegram not configured");
    return null;
  }

  try {

    // SEND WITH IMAGE
    if (imageUrl) {

      const result = await bot.sendPhoto(CHAT_ID, imageUrl, {
        caption: caption,
        parse_mode: "HTML"
      });

      console.log("📤 Deal sent to Telegram with image");

      return result;
    }

    // SEND TEXT ONLY
    const result = await bot.sendMessage(CHAT_ID, caption);

    console.log("📤 Deal sent as text");

    return result;

  } catch (error) {

    console.error("❌ Telegram send error:", error.message);

    try {

      const fallback = await bot.sendMessage(CHAT_ID, caption);

      console.log("⚠️ Image failed, sent text instead");

      return fallback;

    } catch (err) {

      console.error("❌ Telegram fallback failed:", err.message);
      throw err;

    }
  }
}

/*
SEND CUSTOM MESSAGE
*/

async function sendMessageToTelegram(message) {

  if (!bot || !CHAT_ID) {
    console.log("⚠️ Telegram not configured");
    return null;
  }

  try {

    const result = await bot.sendMessage(CHAT_ID, message);

    console.log("📨 Custom message sent to Telegram");

    return result;

  } catch (error) {

    console.error("❌ Telegram message error:", error.message);
    throw error;

  }
}

/*
TEST BOT
*/

async function sendTestMessage() {

  if (!bot || !CHAT_ID) {
    console.log("⚠️ Telegram not configured");
    return false;
  }

  try {

    await bot.sendMessage(
      CHAT_ID,
      "✅ Deal System Bot is running!"
    );

    console.log("🧪 Test message sent");

    return true;

  } catch (error) {

    console.error("❌ Test message failed:", error.message);

    return false;

  }
}

/*
EXPORT FUNCTIONS
*/

module.exports = {
  sendToTelegram,
  sendMessageToTelegram,
  formatDealText,
  sendTestMessage
};