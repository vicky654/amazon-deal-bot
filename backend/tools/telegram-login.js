/**
 * One-time interactive Telegram login — run ONCE before starting the server.
 *
 * Usage:
 *   cd backend
 *   node tools/telegram-login.js
 *
 * What it does:
 *   1. Connects to Telegram using TELEGRAM_API_ID + TELEGRAM_API_HASH
 *   2. Prompts for phone (or uses TELEGRAM_PHONE env var automatically)
 *   3. Prompts for OTP + optional 2FA password
 *   4. Saves the session string to MongoDB (TelegramSession collection)
 *   5. Prints the session string as a backup
 *
 * Run this ONCE. After that, just set REPOST_ENABLED=true and start the server.
 * Re-run only if the session expires or you explicitly log out from all devices.
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const readline = require('readline');
const mongoose = require('mongoose');
const { TelegramClient } = require('telegram');
const { StringSession }  = require('telegram/sessions');

const API_ID   = parseInt(process.env.TELEGRAM_API_ID   || '0', 10);
const API_HASH = process.env.TELEGRAM_API_HASH           || '';
const PHONE    = process.env.TELEGRAM_PHONE              || '';
const MONGO    = process.env.MONGODB_URI;

function ask(rl, question) {
  return new Promise(resolve => rl.question(question, resolve));
}

async function main() {
  console.log('\n════════════════════════════════════════════════════════');
  console.log('   Telegram User Client — One-Time Login Setup');
  console.log('════════════════════════════════════════════════════════\n');

  if (!API_ID || !API_HASH) {
    console.error('❌  TELEGRAM_API_ID or TELEGRAM_API_HASH missing from .env');
    console.error('    → Get them at: https://my.telegram.org → API Development Tools');
    process.exit(1);
  }

  if (!MONGO) {
    console.error('❌  MONGODB_URI missing from .env');
    process.exit(1);
  }

  console.log(`✓  API_ID  : ${API_ID}`);
  console.log(`✓  API_HASH: ${API_HASH.slice(0, 6)}…`);
  if (PHONE) console.log(`✓  PHONE   : ${PHONE} (from .env)\n`);
  else       console.log('   PHONE   : will prompt\n');

  console.log('Connecting to MongoDB…');
  await mongoose.connect(MONGO, { serverSelectionTimeoutMS: 10000 });
  console.log('✓  MongoDB connected\n');

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  const session = new StringSession('');
  const client  = new TelegramClient(session, API_ID, API_HASH, {
    connectionRetries: 5,
  });

  await client.start({
    phoneNumber: async () => {
      if (PHONE) {
        console.log(`Using phone from .env: ${PHONE}`);
        return PHONE.trim();
      }
      const p = await ask(rl, 'Enter phone number (with country code, e.g. +917814239292): ');
      return p.trim();
    },
    password: async () => {
      const pw = await ask(rl, 'Enter 2FA password (press Enter if none): ');
      return pw.trim();
    },
    phoneCode: async () => {
      const code = await ask(rl, 'Enter the OTP Telegram sent to your phone/app: ');
      return code.trim();
    },
    onError: (err) => {
      console.error(`\nTelegram error: ${err.message}`);
    },
  });

  rl.close();

  const sessionString = client.session.save();
  console.log('\n✅  Login successful!\n');
  console.log('─── Session string (save this as backup) ───────────────');
  console.log(`\nTELEGRAM_SESSION_STRING=${sessionString}\n`);
  console.log('────────────────────────────────────────────────────────\n');

  // Save to MongoDB
  const TelegramSession = mongoose.model(
    'TelegramSession',
    new mongoose.Schema({ sessionString: String, updatedAt: Date })
  );
  await TelegramSession.findOneAndUpdate(
    {},
    { sessionString, updatedAt: new Date() },
    { upsert: true }
  );

  console.log('✅  Session saved to MongoDB (TelegramSession collection)');
  console.log('\nNext steps:');
  console.log('  1. Set REPOST_ENABLED=true in .env');
  console.log('  2. Start (or restart) the server: node server.js');
  console.log('  3. Check: GET /api/debug/repost\n');

  await client.disconnect();
  await mongoose.connection.close();
  process.exit(0);
}

main().catch(err => {
  console.error(`\n❌  Login failed: ${err.message}\n`);
  process.exit(1);
});
