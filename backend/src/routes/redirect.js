/**
 * Click Tracking Redirect
 *
 * GET /r/:dealId
 *   → Increment clicks counter
 *   → Redirect: finalLink → affiliateLink → link (originalLink fallback)
 *
 * Priority:
 *   1. finalLink  (affiliate if available, else original — set by linkGenerator)
 *   2. affiliateLink
 *   3. link (legacy field)
 */

const router = require('express').Router();
const Deal   = require('../models/Deal');
const logger = require('../../utils/logger');

router.get('/:dealId', async (req, res) => {
  try {
    const deal = await Deal.findByIdAndUpdate(
      req.params.dealId,
      { $inc: { clicks: 1 } },
      { new: true, select: 'finalLink affiliateLink originalLink link clicks' }
    ).lean();

    if (!deal) return res.status(404).send('Deal not found');

    const target = deal.finalLink || deal.affiliateLink || deal.originalLink || deal.link;
    if (!target)  return res.status(422).send('No link available for this deal');

    logger.info(`[Redirect] ${req.params.dealId} → clicks=${deal.clicks} → ${target.slice(0, 80)}`);
    res.redirect(302, target);
  } catch (err) {
    logger.error(`[Redirect] ${err.message}`);
    res.status(500).send('Server error');
  }
});

module.exports = router;
