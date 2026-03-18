/**
 * System Routes
 *
 * GET /api/system/cron-status  → live cron state (running, lastRun, nextRun, logs)
 * GET /api/system/telegram-debug → Telegram config diagnostics (safe, no secrets)
 */

const router    = require('express').Router();
const { state } = require('../cronState');

// ── Cron status ───────────────────────────────────────────────────────────────

router.get('/cron-status', (req, res) => {
  res.json({
    running:  state.running,
    lastRun:  state.lastRun,
    nextRun:  state.nextRun,
    logs:     state.logs,
  });
});

// ── Telegram diagnostics ──────────────────────────────────────────────────────

router.get('/telegram-debug', (req, res) => {
  const token  = process.env.TELEGRAM_TOKEN  || '';
  const chatId = process.env.TELEGRAM_CHAT   || '';

  // Mask sensitive values — only show first 8 chars of token, full chat id
  const tokenMasked  = token  ? `${token.slice(0, 8)}…` : '(not set)';
  const chatMasked   = chatId || '(not set)';

  const issues = [];
  if (!token)  issues.push('TELEGRAM_TOKEN is missing');
  if (!chatId) issues.push('TELEGRAM_CHAT is missing');
  if (chatId && !chatId.startsWith('-')) {
    issues.push('TELEGRAM_CHAT should start with "-" for groups/channels (e.g. -100xxxxxxxxxx)');
  }

  res.json({
    ok:         issues.length === 0,
    token:      tokenMasked,
    chatId:     chatMasked,
    issues,
    hint: issues.length
      ? 'Fix the issues above in Render → Environment Variables, then redeploy.'
      : 'Configuration looks correct.',
  });
});

module.exports = router;
