'use strict';
/**
 * Telegram channel listener — subscribes to source channels and
 * dispatches each new message through the repost pipeline.
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
 * Resolves entities, attempts to join public channels, then subscribes.
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

  logger.info(`[Listener] Connecting to ${channels.length} source channel(s): ${channels.map(c => `@${c}`).join(', ')}`);

  const client = await getClient();
  const subscribedChannels = [];

  for (const ch of channels) {
    try {
      // Resolve entity — builds the local peer cache gramjs needs for matching
      const entity = await client.getEntity(ch);
      const type   = entity.className || 'unknown';
      const id     = entity.id?.toString?.() || '?';
      logger.info(`[Listener] ✅ Resolved @${ch} → type=${type} id=${id}`);

      // Attempt to join — required to receive updates from public channels
      // via a user client. Safe to call if already a member.
      try {
        await client.invoke(new Api.channels.JoinChannel({ channel: entity }));
        logger.info(`[Listener] ✅ Joined / already member of @${ch}`);
      } catch (joinErr) {
        // FloodWait, already member, or private channel — non-fatal
        logger.warn(`[Listener] Join attempt for @${ch}: ${joinErr.message} (proceeding anyway)`);
      }

      subscribedChannels.push(ch);
    } catch (e) {
      logger.error(`[Listener] ❌ Could not resolve @${ch}: ${e.message}`);
      logger.error(`[Listener]    → Make sure @${ch} is a public channel and the account is not banned`);
    }
  }

  if (subscribedChannels.length === 0) {
    logger.error('[Listener] ❌ No channels could be resolved — repost engine will receive NO messages');
    return [];
  }

  // Subscribe to new messages from all resolved source channels
  client.addEventHandler(
    async (event) => {
      try {
        await pipeline(event, client);
      } catch (err) {
        logger.error(`[Listener] Pipeline error: ${err.message}`);
      }
    },
    new NewMessage({ chats: subscribedChannels }),
  );

  logger.info(`[Listener] ✅ Subscribed to ${subscribedChannels.length} channel(s): ${subscribedChannels.map(c => `@${c}`).join(', ')}`);
  logger.info(`[Listener] Waiting for new messages…`);
  return subscribedChannels;
}

module.exports = { startListener, getSourceChannels };
