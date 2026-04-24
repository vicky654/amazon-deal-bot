'use strict';
/**
 * Deal quality filter — configurable thresholds + built-in spam blocks.
 *
 * TEST_MODE=true bypasses all quality filters (use to verify delivery path).
 *
 * Layer 1  Must have ASIN, title, price, shopping URL     (skipped in TEST_MODE)
 * Layer 2  Price / discount / saving thresholds           (skipped in TEST_MODE)
 * Layer 3  Spam keyword block                             (skipped in TEST_MODE)
 * Layer 4  Optional allow-list                            (skipped in TEST_MODE)
 */

const TEST_MODE    = process.env.TEST_MODE        === 'true';
const MIN_DISCOUNT = parseInt(process.env.REPOST_MIN_DISCOUNT || '40',    10);
const MIN_SAVING   = parseInt(process.env.REPOST_MIN_SAVING   || '300',   10);
const MIN_PRICE    = parseInt(process.env.REPOST_MIN_PRICE    || '200',   10);
const MAX_PRICE    = parseInt(process.env.REPOST_MAX_PRICE    || '50000', 10);

// ── Built-in spam / non-shopping blocks (always active when NOT in TEST_MODE) ──
const BUILTIN_BLOCK = [
  'crypto','bitcoin','ethereum','binance','solana','bnb','usdt',
  'trading signal','forex signal','investment plan','earn money fast',
  'make money online','passive income','ponzi','refer and earn',
  'betting tip','casino','satta matka','ipl bet','cricket bet',
  'fantasy team tip','dream11 team','gambling',
  '18+','adult content','xxx','porn','onlyfans',
  'free recharge','jio free data','airtel free','bsnl free','vi free',
  'spin and win','scratch card','lucky draw','you have won',
  'free gift card','free amazon voucher','free flipkart voucher',
  '₹0 only','zero cost',
  'breaking news','weather update','joke of the day','good morning',
  'good night','daily quote','motivational quote',
];

const ENV_BLOCK = (process.env.REPOST_BLOCK_KEYWORDS || 'book,ebook,kindle,seed,diaper')
  .split(',').map(k => k.trim().toLowerCase()).filter(Boolean);

const BLOCK_SET = new Set([...BUILTIN_BLOCK, ...ENV_BLOCK]);

const ALLOW_KEYWORDS = (process.env.REPOST_ALLOW_KEYWORDS || '')
  .split(',').map(k => k.trim().toLowerCase()).filter(Boolean);

const SHOPPING_PATTERNS = [
  'amazon.in', 'amzn.to', 'amzn.in', 'a.co/',
  'flipkart.com', 'fkrt.it', 'dl.flipkart',
];

function _hasShoppingLink(text) {
  if (!text) return false;
  const lower = text.toLowerCase();
  return SHOPPING_PATTERNS.some(p => lower.includes(p));
}

// ── Main filter ───────────────────────────────────────────────────────────────

/**
 * @param {object} deal
 * @returns {{ pass: boolean, reason: string }}
 */
function passesFilter(deal) {
  // TEST_MODE: bypass everything — just confirm the send path works
  if (TEST_MODE) {
    return { pass: true, reason: 'test-mode-bypass' };
  }

  const { title, dealPrice, originalPrice, discount, rawText, asin } = deal;

  if (!asin)                        return { pass: false, reason: 'no-asin' };
  if (!title || title.length < 8)   return { pass: false, reason: 'no-title' };
  if (!dealPrice || dealPrice <= 0) return { pass: false, reason: 'no-price' };

  if (rawText && !_hasShoppingLink(rawText)) {
    return { pass: false, reason: 'no-shopping-link' };
  }

  if (dealPrice < MIN_PRICE)
    return { pass: false, reason: `price-too-low:${dealPrice}<${MIN_PRICE}` };
  if (MAX_PRICE > 0 && dealPrice > MAX_PRICE)
    return { pass: false, reason: `price-too-high:${dealPrice}>${MAX_PRICE}` };

  if (discount != null && discount < MIN_DISCOUNT)
    return { pass: false, reason: `discount-too-low:${discount}%<${MIN_DISCOUNT}%` };

  if (originalPrice && dealPrice && originalPrice > dealPrice) {
    const saving = originalPrice - dealPrice;
    if (saving < MIN_SAVING)
      return { pass: false, reason: `saving-too-low:₹${Math.round(saving)}<₹${MIN_SAVING}` };
  }

  const searchText = `${title} ${rawText || ''}`.toLowerCase();
  for (const kw of BLOCK_SET) {
    if (searchText.includes(kw)) return { pass: false, reason: `blocked:${kw}` };
  }

  if (ALLOW_KEYWORDS.length > 0 && !ALLOW_KEYWORDS.some(kw => searchText.includes(kw))) {
    return { pass: false, reason: 'not-in-allowlist' };
  }

  return { pass: true, reason: 'ok' };
}

module.exports = { passesFilter };
