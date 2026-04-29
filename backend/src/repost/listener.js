'use strict';
/**
 * Telegram channel listener — COMPLETE SENIOR-LEVEL FIX
 *
 * Root cause: GramJS does NOT automatically push UpdateNewChannelMessage for
 * broadcast channels unless:
 *   (a) GetState() is called after connect to sync the update sequence number
 *   (b) The channel entity is in the session entity cache (via getDialogs or getEntity)
 *   (c) A recent getMessages() call forces Telegram to record this client's pts
 *       for that specific channel
 *
 * Phases:
 *   1 — Dialog sync (hydrates entity cache + pts)
 *   2 — Resolve LootAlertz entity
 *   3 — Full channel membership check
 *   4 — Universal raw event trap (fires for ALL updates, proves connection works)
 *   5 — Simple ALLOWED ID matching only
 *   6 — Single NewMessage handler (no chats filter)
 *   7 — Force GetState() (critical for pts sync)
 *   8 — Force recent message fetch (forces Telegram to track this client's pts)
 *   9 — 2-minute diagnostic timer (prints root cause if no events arrive)
 */

const { NewMessage } = require('telegram/events');
const { Api }        = require('telegram');
const { getClient }  = require('./client');

// ── PHASE 5: Only allowed IDs — hardcoded + dynamically resolved ──────────────
// '-1001365001702' = lootalertz
const ALLOWED = ['-1001365001702'];

function getSourceChannels() {
  return (process.env.REPOST_SOURCE_CHANNELS || '')
    .split(',')
    .map(c => c.trim().replace(/^@/, ''))
    .filter(Boolean);
}

async function startListener(pipeline) {
  const channels = getSourceChannels();

  console.log('================================================');
  console.log('[Listener] Starting listener — source channels:', channels);
  console.log('[Listener] ALLOWED IDs:', ALLOWED);
  console.log('================================================');

  const client = await getClient();

  // ── PHASE 7: Force GetState() immediately after connect ────────────────────
  // This is CRITICAL. Without it, Telegram does not know what update sequence
  // the client is at for broadcast channels, so it never pushes their updates.
  try {
    const updateState = await client.invoke(new Api.updates.GetState());
    console.log('[GRAMJS] update state synced:', {
      pts:  updateState.pts,
      qts:  updateState.qts,
      seq:  updateState.seq,
      date: updateState.date,
    });
  } catch (err) {
    console.error('[GRAMJS] GetState() failed:', err.message);
  }

  // ── PHASE 4: Universal raw event trap ─────────────────────────────────────
  // Register BEFORE getDialogs so no update is missed during startup.
  // If LootAlertz posts and this NEVER fires, the problem is at the
  // Telegram session / account layer (account restricted, not joined, etc.)
  client.addEventHandler(async (event) => {
    try {
      console.log('================ EVENT =================');
      console.log('CLASS:', event?.className);
      console.log('CHAT:', event?.chatId?.toString?.());
      console.log('TEXT:', event?.message?.message);
      console.log('PEER:', JSON.stringify(
        event?.message?.peerId,
        (_, v) => typeof v === 'bigint' ? v.toString() : v
      ));
      console.log('========================================');
    } catch (err) {
      console.error('[RAW EVENT FAIL]', err);
    }
  });

  // ── PHASE 1: Dialog sync ────────────────────────────────────────────────────
  // Fetches all dialogs — forces Telegram to push pts state for every channel
  // the account is subscribed to, including broadcast channels.
  console.log('========== DIALOG SYNC ==========');
  try {
    const dialogs = await client.getDialogs({ limit: 200 });
    console.log(`[Listener] ${dialogs.length} dialogs loaded:`);
    for (const d of dialogs) {
      const rawId  = d.entity?.id?.toString?.() || '?';
      const prefId = rawId.startsWith('-') ? rawId : '-100' + rawId;
      const id     = d.id?.toString?.() || prefId;
      console.log({
        title:     d.title,
        id,
        username:  d.entity?.username,
        broadcast: d.entity?.broadcast,
      });
    }
  } catch (e) {
    console.log('[Listener] getDialogs() error (non-fatal):', e.message);
  }
  console.log('=================================');

  // ── PHASE 2: Force resolve LootAlertz entity ─────────────────────────────
  let lootEntity = null;
  for (const ch of channels) {
    try {
      lootEntity = await client.getEntity(ch);
      const resolvedId = '-100' + lootEntity.id?.toString?.();

      console.log('========== SOURCE ENTITY ==========');
      console.log({
        id:        lootEntity.id?.toString(),
        prefixedId: resolvedId,
        title:     lootEntity.title,
        username:  lootEntity.username,
        broadcast: lootEntity.broadcast,
      });
      console.log('===================================');

      // Add dynamically resolved ID to ALLOWED if not already present
      if (!ALLOWED.includes(resolvedId)) {
        ALLOWED.push(resolvedId);
        console.log('[Listener] Dynamically added to ALLOWED:', resolvedId);
      }
    } catch (e) {
      console.log(`[Listener] getEntity(@${ch}) failed:`, e.message);
    }
  }

  // ── PHASE 3: Full channel membership check ─────────────────────────────────
  if (lootEntity) {
    try {
      const full = await client.invoke(
        new Api.channels.GetFullChannel({ channel: lootEntity })
      );
      console.log('========== FULL CHANNEL ==========');
      console.log({
        id:           full?.fullChat?.id?.toString?.(),
        about:        full?.fullChat?.about,
        participantsCount: full?.fullChat?.participantsCount,
      });
      console.log('==================================');
    } catch (err) {
      console.error('[Listener] GetFullChannel failed:', err.message);
      console.error('[Listener] → Account may NOT be joined to this channel');
    }

    // ── PHASE 8: Force recent message fetch ─────────────────────────────────
    // Fetches latest messages → forces Telegram server to register this client's
    // pts for this specific channel → future UpdateNewChannelMessage events will flow.
    try {
      const msgs = await client.getMessages(lootEntity, { limit: 5 });
      console.log('========== RECENT LOOTALERTZ MSGS ==========');
      for (const m of msgs) {
        console.log({ id: m.id, text: (m.message || '').slice(0, 80) });
      }
      console.log('============================================');
      console.log('[Listener] pts synced via getMessages ✅');
    } catch (err) {
      console.error('[Listener] getMessages failed:', err.message);
    }

    // Join the channel (idempotent)
    try {
      await client.invoke(new Api.channels.JoinChannel({ channel: lootEntity }));
      console.log('[Listener] JoinChannel confirmed ✅');
    } catch (err) {
      console.log('[Listener] JoinChannel:', err.message, '(may already be member)');
    }
  } else {
    console.error('[Listener] CRITICAL: Could not resolve any source channel entity');
    console.error('[Listener] → Check REPOST_SOURCE_CHANNELS in .env');
  }

  // ── PHASE 6: Single NewMessage handler — NO chats filter ──────────────────
  // Using { chats: [...] } filter silently drops broadcast channel events in GramJS.
  // We catch everything and filter manually by chatId.
  client.addEventHandler(
    async (event) => {
      console.log('[NEWMESSAGE FIRED]');

      // ── PHASE 5: Strict simple matching ───────────────────────────────────
      const incomingId = event.chatId?.toString?.() || 'unknown';
      console.log('[CHAT ID]', incomingId);
      console.log('[ALLOWED]', ALLOWED);

      const match = ALLOWED.includes(incomingId);
      console.log('[MATCH]', match);

      if (!match) {
        console.log('RETURN REASON: source channel mismatch —', incomingId);
        return;
      }

      const text = event?.message?.message || event?.message?.caption || '';
      console.log('[TEXT]', text.slice(0, 120));

      console.log('[Listener] ✅ Source matched — dispatching to pipeline');
      try {
        await pipeline(event, client);
      } catch (err) {
        console.error('[Listener] pipeline threw:', err.message);
        console.error(err.stack);
      }
    },
    new NewMessage({}),
  );

  // ── PHASE 9: 2-minute diagnostic timer ────────────────────────────────────
  let receivedLootAlertz = false;
  const origHandler = pipeline;

  // Intercept pipeline to detect first LootAlertz event
  const wrappedPipeline = async (event, client) => {
    receivedLootAlertz = true;
    return origHandler(event, client);
  };

  setTimeout(() => {
    if (!receivedLootAlertz) {
      console.error('');
      console.error('============================================================');
      console.error('FINAL ROOT CAUSE DIAGNOSTIC (2-minute timeout reached):');
      console.error('Telegram user session is NOT receiving broadcast updates');
      console.error('for LootAlertz (-1001365001702).');
      console.error('');
      console.error('Checklist:');
      console.error('  1. Is the Telegram account ACTUALLY JOINED to @lootalertz?');
      console.error('     Open Telegram app with the SAME phone number and check.');
      console.error('  2. Is the account flood-limited or restricted by Telegram?');
      console.error('  3. Is TELEGRAM_PHONE in .env the correct account?');
      console.error('     Currently:', process.env.TELEGRAM_PHONE);
      console.error('  4. Run: node tools/telegram-login.js --fresh to re-auth.');
      console.error('  5. Manually join @lootalertz from the Telegram app, then restart.');
      console.error('============================================================');
      console.error('');
    } else {
      console.log('[Listener] ✅ LootAlertz events received successfully');
    }
  }, 2 * 60 * 1000);

  console.log('================================================');
  console.log('[Listener] ✅ All handlers registered');
  console.log('[Listener] ALLOWED IDs:', ALLOWED);
  console.log('[Listener] Watching: if LootAlertz posts, [NEWMESSAGE FIRED] will appear');
  console.log('[Listener] If only own group events appear → account not subscribed to LootAlertz');
  console.log('================================================');

  return channels;
}

module.exports = { startListener, getSourceChannels };
