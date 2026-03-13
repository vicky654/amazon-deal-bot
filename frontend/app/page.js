

'use client';

import { useState } from "react";
import axios from "axios";

const API_URL = "http://localhost:5000";

export default function Home() {

  const [url, setUrl] = useState("");
  const [message, setMessage] = useState("");

  const [deal, setDeal] = useState(null);

  const [loading, setLoading] = useState(false);
  const [telegramLoading, setTelegramLoading] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  /*
  GENERATE DEAL
  */

  const generateDeal = async () => {

    if (!url.trim()) {
      setError("Please enter Amazon URL");
      return;
    }

    setLoading(true);
    setError("");
    setSuccess("");
    setDeal(null);

    try {

      const res = await axios.post(`${API_URL}/generate`, {
        url: url.trim()
      });


      console.log("API response:", res.data);

      setDeal(res.data);

    } catch (err) {

      setError(err.response?.data?.error || "Failed to generate deal");

    } finally {

      setLoading(false);

    }

  };

  /*
  SEND DEAL TO TELEGRAM
  */

  const sendDealTelegram = async () => {

    if (!deal) return;

    setTelegramLoading(true);

    try {

await axios.post(`${API_URL}/telegram`, {
  title: deal.title,
  price: deal.price,
  image: deal.image,
  link: deal.link,
  originalPrice: deal.originalPrice,
  savings: deal.savings
});

      setSuccess("✅ Deal posted to Telegram!");

    } catch (err) {

      setError(err.response?.data?.error || "Telegram failed");

    } finally {

      setTelegramLoading(false);

    }

  };

  /*
  SEND CUSTOM MESSAGE
  */

  const sendMessageTelegram = async () => {

    if (!message.trim()) {
      setError("Enter message first");
      return;
    }

    setTelegramLoading(true);
    setError("");
    setSuccess("");

    try {

      await axios.post(`${API_URL}/telegram-message`, {
        message: message
      });

      setSuccess("✅ Message sent to Telegram!");

      setMessage("");

    } catch (err) {

      setError(err.response?.data?.error || "Message send failed");

    } finally {

      setTelegramLoading(false);

    }

  };

  /*
  DEAL TEXT
  */

  console.log("Current deal state:", deal);

  const dealText = deal ? `🔥 Amazon Deal

${deal.title}

💰 Price: ₹${deal.price}

🛒 Buy Now:
${deal.link}

#AmazonDeals #Discount` : "";





console.log("Deal Text:", deal);

  return (

    <main className="min-h-screen bg-gray-100 py-10 px-4">

      <div className="max-w-4xl mx-auto">

        {/* HEADER */}

        <div className="text-center mb-10">

          <h1 className="text-4xl font-bold text-gray-800">
            🔥 Amazon Deal Generator
          </h1>

          <p className="text-gray-600">
            Generate deals or send custom messages to Telegram
          </p>

        </div>

        {/* AMAZON URL SECTION */}

        <div className="bg-white rounded-xl shadow-lg p-6 mb-6">

          <h2 className="text-xl font-semibold mb-4">
            Generate Deal from Amazon URL
          </h2>

          <div className="flex gap-3">

            <input
              value={url}
              onChange={(e)=>setUrl(e.target.value)}
              placeholder="Paste Amazon product URL"
              className="flex-1 border px-4 py-3 rounded-lg text-black"
            />

            <button
              onClick={generateDeal}
              disabled={loading}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >

              {loading ? "Generating..." : "Generate Deal"}

            </button>

          </div>

        </div>

        {/* CUSTOM MESSAGE SECTION */}

        <div className="bg-white rounded-xl shadow-lg p-6 mb-6">

          <h2 className="text-xl font-semibold mb-4">
            Send Custom Message
          </h2>

          <textarea
            value={message}
            onChange={(e)=>setMessage(e.target.value)}
            placeholder="Write Telegram message..."
            rows={4}
            className="w-full border px-4 py-3 rounded-lg text-black mb-4"
          />

          <button
            onClick={sendMessageTelegram}
            disabled={telegramLoading}
            className="bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700"
          >

            {telegramLoading ? "Sending..." : "📨 Send Message"}

          </button>

        </div>

        {/* ERROR */}

        {error && (

          <div className="bg-red-100 border border-red-300 p-4 mb-6 rounded">
            <p className="text-red-600">{error}</p>
          </div>

        )}

        {/* SUCCESS */}

        {success && (

          <div className="bg-green-100 border border-green-300 p-4 mb-6 rounded">
            <p className="text-green-700">{success}</p>
          </div>

        )}

        {/* DEAL PREVIEW */}

        {deal && (

          <div className="bg-white rounded-xl shadow-lg p-6">

            <h2 className="text-2xl font-bold mb-6">
              Generated Deal
            </h2>

            <div className="grid md:grid-cols-2 gap-8">

              <img
                src={deal.image}
                alt={deal.title}
                className="rounded-lg"
              />

              <div>

                <h3 className="text-xl font-semibold mb-3 text-gray-800">
                  {deal.title}
                </h3>

                <p className="text-3xl text-green-600 font-bold mb-4">
                  ₹{deal.price} 
                </p>

                <textarea
                  readOnly
                  value={dealText}
                  rows={7}
                  className="w-full border rounded-lg p-3 text-sm text-black bg-gray-50 mb-4"
                />

                <button
                  onClick={sendDealTelegram}
                  disabled={telegramLoading}
                  className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700"
                >

                  {telegramLoading
                    ? "Posting..."
                    : "📤 Post Deal to Telegram"}

                </button>

              </div>

            </div>

          </div>

        )}



        <div className="mt-8 bg-blue-50 p-6 rounded-xl">

          <h3 className="text-blue-800 font-semibold mb-3">
            Instructions
          </h3>

          <ul className="list-disc list-inside text-blue-700 space-y-1">

            <li>Paste Amazon product URL</li>

            <li>Click Generate Deal</li>

            <li>Review the scraped product</li>

            <li>Copy deal text or send to Telegram</li>

            <li>Make sure backend + MongoDB running</li>

          </ul>

        </div>
      </div>

    </main>
  );
}