/**
 * Reels REST API
 *
 * POST   /api/reels/generate            → generate reel + caption; return videoUrl + caption + hashtags
 * GET    /api/reels/:dealId/status      → check if reel is cached
 * POST   /api/reels/:dealId/copied      → record that user copied the caption (analytics)
 * DELETE /api/reels/:dealId             → clear cached reel files
 */

const router        = require('express').Router();
const Deal          = require('../models/Deal');
const ReelCaption   = require('../models/ReelCaption');
const { generateReel, deleteReelCache, reelExists } = require('../services/reelGenerator');
const { buildInstagramContent } = require('../services/captionGenerator');
const logger        = require('../../utils/logger');

const VALID_TEMPLATES = ['dark', 'sale', 'minimal'];

// ── Simple in-memory rate limit (10 generations / 5 min / IP) ────────────────

const _genMap = new Map();
function _rateLimit(max, windowMs) {
  return (req, res, next) => {
    const ip  = req.ip || 'unknown';
    const now = Date.now();
    let   rec = _genMap.get(ip);
    if (!rec || now > rec.resetAt) rec = { count: 0, resetAt: now + windowMs };
    rec.count++;
    _genMap.set(ip, rec);
    if (rec.count > max) {
      return res.status(429).json({ success: false, error: 'Too many reel requests. Try again later.' });
    }
    next();
  };
}
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of _genMap) if (now > v.resetAt) _genMap.delete(k);
}, 10 * 60 * 1000).unref();

// ── POST /api/reels/generate ──────────────────────────────────────────────────

router.post('/generate', _rateLimit(10, 5 * 60 * 1000), async (req, res) => {
  const { dealId, template = 'dark' } = req.body;

  if (!dealId) {
    return res.status(400).json({ success: false, error: 'dealId is required' });
  }
  if (!VALID_TEMPLATES.includes(template)) {
    return res.status(400).json({
      success: false,
      error: `template must be one of: ${VALID_TEMPLATES.join(', ')}`,
    });
  }

  let deal;
  try {
    deal = await Deal.findById(dealId).lean();
  } catch (err) {
    return res.status(400).json({ success: false, error: `Invalid dealId: ${err.message}` });
  }
  if (!deal) {
    return res.status(404).json({ success: false, error: 'Deal not found' });
  }

  logger.info(`[Reels] Generate: deal=${dealId} template=${template}`);

  try {
    // 1. Generate (or return cached) video
    const result = await generateReel(deal, template);

    // 2. Build Instagram caption + hashtags (pure, instant)
    const { caption, hashtags } = buildInstagramContent(deal);

    // 3. Persist caption to DB (upsert — fire-and-forget, never blocks response)
    ReelCaption.findOneAndUpdate(
      { dealId: deal._id, template },
      { dealTitle: deal.title, caption, hashtags },
      { upsert: true, new: true }
    ).catch((err) => logger.warn(`[Reels] Caption save failed: ${err.message}`));

    res.json({
      success:  true,
      videoUrl: result.videoUrl,
      cached:   result.cached,
      template,
      dealId,
      caption,
      hashtags,
    });
  } catch (err) {
    logger.error(`[Reels] Generation failed for ${dealId}: ${err.message}`);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── GET /api/reels/:dealId/status ─────────────────────────────────────────────

router.get('/:dealId/status', async (req, res) => {
  const { dealId } = req.params;
  const template   = req.query.template || 'dark';

  if (!VALID_TEMPLATES.includes(template)) {
    return res.status(400).json({ success: false, error: 'Invalid template' });
  }

  const exists   = reelExists(dealId, template);
  const videoUrl = exists ? `/reels/${dealId}_${template}.mp4` : null;

  // Also return any saved caption
  let caption = null; let hashtags = [];
  try {
    const saved = await ReelCaption.findOne({ dealId, template }).lean();
    if (saved) { caption = saved.caption; hashtags = saved.hashtags; }
  } catch (_) {}

  res.json({ success: true, exists, videoUrl, template, caption, hashtags });
});

// ── POST /api/reels/:dealId/copied ────────────────────────────────────────────
// Records when a user copies the caption — lightweight analytics

router.post('/:dealId/copied', async (req, res) => {
  const { dealId } = req.params;
  const template   = req.body.template || 'dark';

  try {
    await ReelCaption.findOneAndUpdate(
      { dealId, template },
      { $set: { copiedAt: new Date() } }
    );
  } catch (_) {}

  res.json({ success: true });
});

// ── DELETE /api/reels/:dealId ─────────────────────────────────────────────────

router.delete('/:dealId', async (req, res) => {
  const { dealId } = req.params;
  deleteReelCache(dealId);

  // Optionally clear saved captions too
  await ReelCaption.deleteMany({ dealId }).catch(() => {});

  logger.info(`[Reels] Cache + captions cleared for deal ${dealId}`);
  res.json({ success: true, message: `Reel cache cleared for ${dealId}` });
});

module.exports = router;
