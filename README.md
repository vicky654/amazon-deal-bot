# Amazon Deal Generator

A full-stack web application for generating and sharing Amazon deals to Telegram.

## Tech Stack

- **Frontend**: Next.js 14 (App Router) with Tailwind CSS
- **Backend**: Node.js with Express
- **Scraping**: Puppeteer
- **Database**: MongoDB with Mongoose
- **HTTP Client**: Axios

## Project Structure

```
deal-system/
├── backend/
│   ├── server.js         # Express API server
│   ├── scraper.js        # Puppeteer scraper for Amazon
│   ├── telegram.js        # Telegram Bot API integration
│   ├── models/
│   │   └── Deal.js        # Mongoose schema
│   └── package.json
├── frontend/
│   ├── app/
│   │   ├── page.js       # Admin dashboard
│   │   ├── layout.js
│   │   └── globals.css
│   ├── next.config.js
│   ├── tailwind.config.js
│   └── package.json
├── .env                  # Environment variables
├── package.json          # Root package with concurrently
└── README.md
```

## Features

1. **Admin Dashboard**
   - Input field for Amazon product URL
   - "Generate Deal" button to scrape product details
   - Display product image, title, and price
   - Formatted deal text in textarea

2. **Backend API**
   - `POST /generate` - Scrape Amazon product using Puppeteer
   - `POST /telegram` - Send deal to Telegram
   - `GET /api/deals` - Get all saved deals

3. **Telegram Integration**
   - Send deals with image and caption to Telegram
   - Formatted message with emoji

4. **MongoDB Storage**
   - Save all generated deals
   - Track created timestamps

## Prerequisites

1. **Node.js** (v18 or higher)
2. **MongoDB** (local or Atlas)
3. **Telegram Bot Token** (from @BotFather)
4. **Telegram Chat ID** (from @userinfobot)

## Installation

1. **Install root dependencies:**
   ```bash
   npm install
   ```

2. **Install backend dependencies:**
   ```bash
   cd backend && npm install
   ```

3. **Install frontend dependencies:**
   ```bash
   cd frontend && npm install
   ```

## Configuration

1. **Edit `.env` file:**
   ```env
   PORT=5000
   MONGODB_URI=mongodb://localhost:27017/deal-system
   TELEGRAM_TOKEN=your_bot_token_here
   TELEGRAM_CHAT=your_chat_id_here
   ```

2. **Get Telegram Credentials:**
   - Bot Token: Start @BotFather on Telegram, create a new bot, get the token
   - Chat ID: Start @userinfobot on Telegram, send a message to your bot, get the chat ID

## Running the Application

### Option 1: Run both servers together (recommended)
```bash
npm run dev
```

This will start:
- Backend server on http://localhost:5000
- Frontend on http://localhost:3000

### Option 2: Run separately

**Terminal 1 - Backend:**
```bash
cd backend
npm run dev
```

**Terminal 2 - Frontend:**
```bash
cd frontend
npm run dev
```

## Usage

1. Open http://localhost:3000 in your browser
2. Paste an Amazon product URL in the input field
3. Click "Generate Deal"
4. Review the scraped product details
5. Click "Post to Telegram" to share the deal

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/generate` | Scrape Amazon product |
| POST | `/telegram` | Send deal to Telegram |
| GET | `/api/deals` | Get all saved deals |
| GET | `/health` | Health check |

## Example Request

```bash
# Generate deal
curl -X POST http://localhost:5000/generate \
  -H "Content-Type: application/json" \
  -d '{"url": "https://www.amazon.in/dp/B09V3KXJPB"}'

# Post to Telegram
curl -X POST http://localhost:5000/telegram \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Product Title",
    "price": 999,
    "image": "https://image-url.jpg",
    "link": "https://amazon.in/product"
  }'
```

## Troubleshooting

1. **MongoDB Connection Error**
   - Make sure MongoDB is running
   - Check MONGODB_URI in .env

2. **Puppeteer Error**
   - Run: `cd backend && npx puppeteer browsers install chrome`
   - On Windows, you may need to install Chrome manually

3. **Telegram Not Sending**
   - Verify TELEGRAM_TOKEN is correct
   - Verify TELEGRAM_CHAT is correct
   - Make sure bot has been started by the user

4. **CORS Error**
   - Backend runs on port 5000, frontend on 3000
   - CORS is enabled in server.js

## License

ISC

