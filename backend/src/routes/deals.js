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
const https    = require('https');
const http     = require('http');
const Deal     = require('../models/Deal');
const { scrapeProduct }         = require('../scraper');
const { generateAffiliateLink } = require('../affiliate');
const { evaluateDeal, upsertDeal } = require('../engine/dealFilter');
const telegram = require('../../telegram');
const logger   = require('../../utils/logger');

// ── Short URL resolver (amzn.to / bit.ly / etc.) ─────────────────────────────

const SHORT_DOMAINS = ['amzn.to', 'amzn.in', 'bit.ly', 'tinyurl.com', 'goo.gl', 't.co'];

function isShortUrl(url) {
  try {
    const host = new URL(url).hostname.replace('www.', '');
    return SHORT_DOMAINS.some((d) => host === d || host.endsWith('.' + d));
  } catch { return false; }
}

/**
 * Follow HTTP redirects and return the final resolved URL.
 * Uses Node's built-in http/https modules to avoid circular Puppeteer launching.
 */
function resolveShortUrl(inputUrl, maxRedirects = 10) {
  return new Promise((resolve) => {
    let remaining = maxRedirects;

    function follow(url) {
      if (remaining-- <= 0) return resolve(url);
      const mod = url.startsWith('https') ? https : http;
      try {
        const req = mod.request(url, { method: 'HEAD', timeout: 8000 }, (res) => {
          const loc = res.headers?.location;
          if (loc && res.statusCode >= 300 && res.statusCode < 400) {
            // Handle relative redirects
            const next = loc.startsWith('http') ? loc : new URL(loc, url).href;
            follow(next);
          } else {
            resolve(url);
          }
        });
        req.on('error', () => resolve(url));
        req.on('timeout', () => { req.destroy(); resolve(url); });
        req.end();
      } catch { resolve(url); }
    }

    follow(inputUrl);
  });
}

// GET /api/deals/analytics — click + performance stats
router.get('/analytics', async (req, res, next) => {
  try {
    const [topDeals, totals] = await Promise.all([
      Deal.find({ clicks: { $gt: 0 } })
        .sort({ clicks: -1 })
        .limit(10)
        .select('title price discount platform clicks posted postedAt score affiliateLink image')
        .lean(),
      Deal.aggregate([
        {
          $group: {
            _id:         null,
            totalClicks: { $sum: '$clicks' },
            totalDeals:  { $sum: 1 },
            postedDeals: { $sum: { $cond: ['$posted', 1, 0] } },
            avgScore:    { $avg: '$score' },
          },
        },
      ]),
    ]);

    const agg = totals[0] || { totalClicks: 0, totalDeals: 0, postedDeals: 0, avgScore: 0 };

    res.json({
      success: true,
      stats: {
        totalClicks: agg.totalClicks,
        totalDeals:  agg.totalDeals,
        postedDeals: agg.postedDeals,
        avgScore:    Math.round(agg.avgScore || 0),
      },
      topDeals,
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/deals — always returns max 20, newest first
router.get('/', async (req, res, next) => {
  try {
    const platform = req.query.platform || null;
    const posted   = req.query.posted !== undefined ? req.query.posted === 'true' : null;
    const sortBy   = req.query.sort === 'clicks' ? { clicks: -1 } : { createdAt: -1 };
    const limit    = Math.min(parseInt(req.query.limit || '20', 10), 50);

    const filter = {};
    if (platform) filter.platform = platform;
    if (posted !== null) filter.posted = posted;

    const deals = await Deal.find(filter)
      .sort(sortBy)
      .limit(limit)
      .lean();

    res.json({ success: true, count: deals.length, deals });
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

// POST /api/deals/generate — on-demand single-URL scrape (supports short URLs)
router.post('/generate', async (req, res, next) => {
  try {
    let { url } = req.body;
    if (!url) return res.status(400).json({ success: false, error: 'url is required' });

    // Expand short URLs (amzn.to / bit.ly / etc.)
    if (isShortUrl(url)) {
      logger.info(`[API] Resolving short URL: ${url}`);
      const resolved = await resolveShortUrl(url);
      logger.info(`[API] Resolved to: ${resolved}`);
      url = resolved;
    }

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
