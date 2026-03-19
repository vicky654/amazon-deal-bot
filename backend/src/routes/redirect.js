/**
 * Click Tracking Redirect
 *
 * GET /r/:dealId  — increment clicks counter, redirect to affiliate link
 */

const router = require('express').Router();
const Deal   = require('../models/Deal');
const logger = require('../../utils/logger');

router.get('/:dealId', async (req, res) => {
  try {
    const deal = await Deal.findByIdAndUpdate(
      req.params.dealId,
      { $inc: { clicks: 1 } },
      { new: true, select: 'affiliateLink link clicks' }
    ).lean();

    if (!deal) return res.status(404).send('Deal not found');

    const target = deal.affiliateLink || deal.link;
    if (!target) return res.status(422).send('No link available for this deal');

    logger.info(`[Redirect] ${req.params.dealId} → clicks=${deal.clicks} → ${target.slice(0, 80)}`);
    res.redirect(302, target);
  } catch (err) {
    logger.error(`[Redirect] ${err.message}`);
    res.status(500).send('Server error');
  }
});

module.exports = router;
