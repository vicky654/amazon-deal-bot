'use strict';
/**
 * Telegram channel listener — subscribes to source channels and
 * dispatches each new message through the repost pipeline.
 *
 * Fix log: getDialogs() is required before addEventHandler() fires for channels.
 * Without it, Telegram never pushes UpdateNewChannelMessage to this client because
 * the server doesn't know the client's pts (point-in-time counter) for those dialogs.
 *
 * Three handlers are registered in order:
 *   1. Raw catch-all (no builder) — logs every Update class that arrives.
 *      If nothing appears here, the connection itself is not delivering updates.
 *   2. Global NewMessage (no chats filter) — fires for every incoming message.
 *      If this fires but #3 doesn't, the channel ID filter is the problem.
 *   3. Filtered NewMessage (BigInt IDs) — the live pipeline handler.
 */

const { NewMessage } = require('telegram/events');
const { Api }        = require('telegram');
const { getClient }  = require('./client');
const logger         = require('../../utils/logger');

function getSourceChannels() {
  return (process.env.REPOST_SOURCE_CHANNELS || '')
    .split(',')
    .map(c => c.trim().replace(/^@/, ''))
    .filter(Boolean);
}

/**
 * Start listening on all configured source channels.
 *
 * @param {Function} pipeline   async (event, client) → void
 * @returns {string[]}  list of subscribed channel usernames
 */
async function startListener(pipeline) {
  const channels = getSourceChannels();
  if (channels.length === 0) {
    logger.warn('[Listener] ⚠ No source channels configured — set REPOST_SOURCE_CHANNELS in .env');
    return [];
  }

  logger.info(`[Listener] Source channels: ${channels.map(c => `@${c}`).join(', ')}`);

  const client = await getClient();

  // ── Step 1: Prime update state ─────────────────────────────────────────────
  // getDialogs() fetches the user's dialog list from Telegram, which initialises
  // the internal pts/qts counters for every channel.  Without this call Telegram
  // will NOT push UpdateNewChannelMessage events for channels because the server
  // doesn't know what the client's current state is for those dialogs.
  logger.info('[Listener] Fetching dialogs to prime update state (required for channel events)…');
  try {
    const dialogs = await client.getDialogs({ limit: 200 });
    logger.info(`[Listener] ✅ ${dialogs.length} dialogs loaded — pts primed, Telegram will now push updates`);
  } catch (e) {
    logger.warn(`[Listener] getDialogs() failed (non-fatal, updates may still work): ${e.message}`);
  }

  // ── Step 2: Raw catch-all handler ─────────────────────────────────────────
  // No second argument = fires for EVERY raw Telegram Update object.
  // This is the ground-truth diagnostic: if nothing appears here,
  // the problem is at the network/auth/connection layer, not the event filter.
  client.addEventHandler((update) => {
    const cls = (update && update.className) ? update.className : String(update);
    logger.info(`[Listener] [RAW] ${cls}`);
  });

  // ── Step 3: Resolve entities ───────────────────────────────────────────────
  const subscribedChannels = [];
  const resolvedBigIntIds  = [];   // BigInt channel IDs for the typed filter

  for (const ch of channels) {
    try {
      const entity = await client.getEntity(ch);
      const type   = entity.className || 'unknown';
      const id     = entity.id?.toString?.() || '?';
      logger.info(`[Listener] ✅ Resolved @${ch} → type=${type} id=${id}`);

      // Join the channel so Telegram routes its updates to this user client.
      // Safe to call if already a member — throws ALREADY_PARTICIPANT (non-fatal).
      try {
        await client.invoke(new Api.channels.JoinChannel({ channel: entity }));
        logger.info(`[Listener] ✅ Joined / already member of @${ch}`);
      } catch (joinErr) {
        logger.warn(`[Listener] Join attempt @${ch}: ${joinErr.message} (proceeding anyway)`);
      }

      if (entity.id) {
        resolvedBigIntIds.push(entity.id);  // BigInt — matches how updates arrive
      }
      subscribedChannels.push(ch);
    } catch (e) {
      logger.error(`[Listener] ❌ Could not resolve @${ch}: ${e.message}`);
      logger.error(`[Listener]    → Verify @${ch} is a public channel and the account is not restricted`);
    }
  }

  if (subscribedChannels.length === 0) {
    logger.error('[Listener] ❌ No channels resolved — no messages will be received');
    return [];
  }

  // ── Step 4: Global NewMessage handler (no filter) ─────────────────────────
  // Fires for every incoming message from ANY chat.
  // If this fires but the filtered handler (#5) does not, the chat ID filter
  // is the problem (BigInt mismatch, username not found, etc.).
  client.addEventHandler(
    async (event) => {
      const msgId  = event.message?.id;
      const chatId = event.message?.peerId?.channelId?.toString?.() ||
                     event.message?.peerId?.chatId?.toString?.()     ||
                     event.message?.peerId?.userId?.toString?.()     || 'unknown';
      const text   = (event.message?.message || '').slice(0, 80).replace(/\n/g, ' ');
      const media  = event.message?.media?.className || 'none';
      logger.info(`[Listener] [GLOBAL] msg=${msgId} chat=${chatId} media=${media} text="${text}"`);
    },
    new NewMessage({}),
  );

  // ── Step 5: Filtered pipeline handler ─────────────────────────────────────
  // Uses BigInt entity IDs (resolved above) instead of string usernames.
  // Channel message updates arrive carrying numeric peer IDs, not usernames,
  // so BigInt matching is more reliable than string lookup.
  const filterArg = resolvedBigIntIds.length > 0 ? resolvedBigIntIds : subscribedChannels;

  client.addEventHandler(
    async (event) => {
      try {
        await pipeline(event, client);
      } catch (err) {
        logger.error(`[Listener] Pipeline error: ${err.message}`);
      }
    },
    new NewMessage({ chats: filterArg }),
  );

  // ── Step 6: Diagnostics summary ───────────────────────────────────────────
  logger.info(`[Listener] ════════════════════════════════════════════════`);
  logger.info(`[Listener] ✅ Listener active — 3 handlers registered`);
  logger.info(`[Listener]   Channels  : ${subscribedChannels.map(c => `@${c}`).join(', ')}`);
  logger.info(`[Listener]   BigInt IDs: ${resolvedBigIntIds.map(id => id.toString()).join(', ')}`);
  logger.info(`[Listener]   Handler 1 : Raw catch-all  → logs every Update class name`);
  logger.info(`[Listener]   Handler 2 : Global NewMsg  → logs every message from any chat`);
  logger.info(`[Listener]   Handler 3 : Filtered NewMsg → runs pipeline for source channels`);
  logger.info(`[Listener] Watch for [RAW] and [GLOBAL] lines when LootAlertz posts`);
  logger.info(`[Listener] ════════════════════════════════════════════════`);

  return subscribedChannels;
}

module.exports = { startListener, getSourceChannels };
