/**
 * Deals REST API
 *
 * GET    /api/deals         → Recent deals (paginated, filterable by platform)
 * GET    /api/deals/:id     → Single deal
 * DELETE /api/deals/:id     → Delete deal
 * POST   /api/deals/generate → Scrape + save a single URL on-demand
 * POST   /api/deals/:id/post → Post existing deal to Telegram
 */

const router   = require('express').Router();
const Deal     = require('../models/Deal');
const { scrapeProduct }         = require('../scraper');
const { generateAffiliateLink } = require('../affiliate');
const { evaluateDeal, upsertDeal } = require('../engine/dealFilter');
const telegram = require('../../telegram');
const logger   = require('../../utils/logger');

// GET /api/deals — always returns max 20, newest first
router.get('/', async (req, res, next) => {
  try {
    const platform = req.query.platform || null;
    const posted   = req.query.posted !== undefined ? req.query.posted === 'true' : null;

    const filter = {};
    if (platform) filter.platform = platform;
    if (posted !== null) filter.posted = posted;

    const deals = await Deal.find(filter)
      .sort({ createdAt: -1 })
      .limit(20)
      .lean();

    res.json({ success: true, count: deals.length, total: 20, deals });
  } catch (err) {
    next(err);
  }
});

// GET /api/deals/:id
router.get('/:id', async (req, res, next) => {
  try {
    const deal = await Deal.findById(req.params.id).lean();
    if (!deal) return res.status(404).json({ success: false, error: 'Deal not found' });
    res.json({ success: true, deal });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/deals/:id
router.delete('/:id', async (req, res, next) => {
  try {
    await Deal.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// POST /api/deals/generate — on-demand single-URL scrape
router.post('/generate', async (req, res, next) => {
  try {
    const { url } = req.body;
    if (!url) return res.status(400).json({ success: false, error: 'url is required' });

    logger.info(`[API] Manual generate: ${url}`);

    const product = await scrapeProduct(url);
    if (!product || !product.title) {
      return res.status(422).json({ success: false, error: 'Could not extract product data' });
    }

    product.affiliateLink = await generateAffiliateLink(url, product.platform).catch(() => url);

    const { shouldPost, reason, dealType } = await evaluateDeal(product);

    const deal = await upsertDeal(product, product.platform, dealType || 'manual', reason);

    res.json({ success: true, deal, shouldPost, reason });
  } catch (err) {
    logger.error(`[API] /generate failed: ${err.message}`);
    next(err);
  }
});

// POST /api/deals/:id/post — post an existing deal to Telegram
router.post('/:id/post', async (req, res, next) => {
  try {
    const deal = await Deal.findById(req.params.id);
    if (!deal) return res.status(404).json({ success: false, error: 'Deal not found' });

    const caption = telegram.formatDealText(
      deal.title,
      deal.price,
      deal.affiliateLink || deal.link,
      deal.originalPrice,
      deal.discount,
    );

    await telegram.sendToTelegram(deal.image, caption);

    deal.posted   = true;
    deal.postedAt = new Date();
    await deal.save();

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
