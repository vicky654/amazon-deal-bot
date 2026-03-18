/**
 * Caption Generator Service
 *
 * Pure functions — no external APIs, no async, no side effects.
 * Used by the Reels route to attach ready-to-paste Instagram content
 * to every generated reel.
 *
 * generateCaption(deal)  → string  (Instagram caption, max ~500 chars)
 * generateHashtags(deal) → string[] (10–20 relevant hashtags)
 */

// ── Platform labels ───────────────────────────────────────────────────────────

const PLATFORM_LABEL = {
  amazon:   'Amazon',
  flipkart: 'Flipkart',
  myntra:   'Myntra',
  ajio:     'Ajio',
  manual:   'Online',
};

// ── Hashtag bank ──────────────────────────────────────────────────────────────

const BASE_TAGS = [
  '#deals', '#sale', '#discount', '#onlineshopping', '#shopping',
  '#offer', '#hotdeal', '#dealsoftheday', '#savemoney', '#indiaoffers',
];

const PLATFORM_TAGS = {
  amazon:   ['#amazondeals', '#amazonfinds', '#amazonsale', '#amazonindia'],
  flipkart: ['#flipkartdeals', '#flipkartsale', '#flipkartfinds'],
  myntra:   ['#myntradeals', '#myntrasale', '#fashiondeals'],
  ajio:     ['#ajiodeals', '#ajiosale', '#ajio'],
};

// Ordered by priority — first match wins
const CATEGORY_RULES = [
  {
    keywords: ['iphone', 'samsung galaxy', 'oneplus', 'realme', 'redmi', 'oppo', 'vivo', 'pixel', 'motorola', 'smartphone', 'mobile phone'],
    tags: ['#smartphones', '#mobiledeals', '#techdeals', '#gadgets', '#phonedeal'],
  },
  {
    keywords: ['laptop', 'macbook', 'notebook', 'chromebook', 'ultrabook'],
    tags: ['#laptopdeals', '#tech', '#laptop', '#workfromhome'],
  },
  {
    keywords: ['earphone', 'headphone', 'airpods', 'earbuds', 'neckband', 'tws', 'bluetooth speaker'],
    tags: ['#audiodeals', '#earphones', '#wireless', '#gadgets'],
  },
  {
    keywords: ['smartwatch', 'fitness band', 'apple watch', 'mi band'],
    tags: ['#smartwatch', '#wearables', '#fitnessgadgets'],
  },
  {
    keywords: ['tv ', 'television', 'smart tv', '4k tv', 'oled', 'qled', 'monitor'],
    tags: ['#tvdeals', '#smarttv', '#homeentertainment'],
  },
  {
    keywords: ['camera', 'dslr', 'mirrorless', 'gopro', 'lens', 'tripod'],
    tags: ['#cameraDeals', '#photography', '#photographers'],
  },
  {
    keywords: ['tablet', 'ipad', 'kindle', 'e-reader'],
    tags: ['#tabletdeals', '#ipad', '#kindle'],
  },
  {
    keywords: ['saree', 'kurta', 'lehenga', 'kurti', 'dupatta', 'salwar'],
    tags: ['#indianfashion', '#ethnicwear', '#fashiondeals', '#ootd'],
  },
  {
    keywords: ['shirt', 'tshirt', 't-shirt', 'jeans', 'dress', 'top ', 'trousers', 'shorts', 'hoodie', 'jacket', 'blazer'],
    tags: ['#fashiondeals', '#clothing', '#style', '#fashion', '#ootd'],
  },
  {
    keywords: ['shoes', 'sneakers', 'footwear', 'sandals', 'boots', 'heels', 'slipper', 'loafers'],
    tags: ['#shoedeals', '#sneakers', '#footwear', '#shoes'],
  },
  {
    keywords: ['bag', 'handbag', 'purse', 'backpack', 'wallet', 'clutch', 'sling bag'],
    tags: ['#bagdeals', '#handbag', '#fashion', '#accessories'],
  },
  {
    keywords: ['watch ', 'analog watch', 'digital watch', 'casio', 'titan', 'fastrack'],
    tags: ['#watchdeals', '#watches', '#accessories'],
  },
  {
    keywords: ['fridge', 'refrigerator', 'washing machine', 'ac ', 'air conditioner', 'microwave', 'dishwasher'],
    tags: ['#homeappliances', '#homedeals', '#whitegoods'],
  },
  {
    keywords: ['mixer', 'grinder', 'cooker', 'blender', 'juicer', 'toaster', 'air fryer', 'induction'],
    tags: ['#kitchendeals', '#cooking', '#kitchengadgets'],
  },
  {
    keywords: ['perfume', 'deodorant', 'cologne', 'fragrance'],
    tags: ['#perfumedeals', '#fragrance', '#lifestyle'],
  },
  {
    keywords: ['skincare', 'moisturizer', 'serum', 'face cream', 'sunscreen', 'toner', 'cleanser'],
    tags: ['#skincare', '#beautydeals', '#glowskin'],
  },
  {
    keywords: ['lipstick', 'foundation', 'mascara', 'eyeliner', 'makeup', 'concealer', 'blush'],
    tags: ['#makeupdeals', '#beautydeals', '#makeuplover'],
  },
  {
    keywords: ['gaming', 'playstation', 'xbox', 'nintendo', 'ps5', 'ps4', 'game controller'],
    tags: ['#gamingdeals', '#gaming', '#gamer', '#gamedeals'],
  },
  {
    keywords: ['toy', 'lego', 'action figure', 'board game', 'puzzle'],
    tags: ['#toydeals', '#toys', '#kidsdeals'],
  },
  {
    keywords: ['book', 'novel', 'textbook', 'stationery', 'pen ', 'notebook '],
    tags: ['#bookdeals', '#books', '#reading', '#education'],
  },
  {
    keywords: ['protein', 'supplement', 'whey', 'vitamin', 'gym'],
    tags: ['#fitnessdeals', '#gym', '#nutrition', '#fitness'],
  },
  {
    keywords: ['mattress', 'sofa', 'furniture', 'chair', 'table', 'bed ', 'wardrobe'],
    tags: ['#furnituredeals', '#homedecor', '#homedeals'],
  },
];

// ── Caption generator ─────────────────────────────────────────────────────────

/**
 * Build a ready-to-paste Instagram caption for a deal.
 * @param {object} deal  { title, price, originalPrice, discount, platform }
 * @returns {string}
 */
function generateCaption(deal) {
  const platform = PLATFORM_LABEL[deal.platform] || 'Online';

  const price    = deal.price        ? `₹${Number(deal.price).toLocaleString('en-IN')}`         : null;
  const orig     = deal.originalPrice ? `₹${Number(deal.originalPrice).toLocaleString('en-IN')}` : null;
  const saving   = (deal.originalPrice && deal.price && deal.originalPrice > deal.price)
    ? `₹${Number(deal.originalPrice - deal.price).toLocaleString('en-IN')}`
    : null;
  const discount = deal.discount ? `${deal.discount}%` : null;

  // Trim title to max 100 chars
  const title = String(deal.title || '').trim();
  const displayTitle = title.length > 100 ? `${title.slice(0, 97)}…` : title;

  const lines = [];

  // ── Hook ──────────────────────────────────────────────────────────────────
  lines.push('🔥 CRAZY DEAL ALERT! 🔥');
  lines.push('');

  // ── Product name ──────────────────────────────────────────────────────────
  lines.push(displayTitle);
  lines.push('');

  // ── Price block ───────────────────────────────────────────────────────────
  if (price)    lines.push(`💰 Deal Price: ${price}`);
  if (orig)     lines.push(`🏷️ Was: ${orig}`);
  if (discount && saving)  lines.push(`⚡ You Save: ${discount} OFF  (${saving})`);
  else if (discount)       lines.push(`⚡ You Save: ${discount} OFF`);
  else if (saving)         lines.push(`⚡ You Save: ${saving}`);
  lines.push('');

  // ── CTA ───────────────────────────────────────────────────────────────────
  lines.push(`🛒 Grab it now on ${platform}`);
  lines.push('👆 Link in Bio');
  lines.push('');

  // ── Urgency + engagement ──────────────────────────────────────────────────
  lines.push('⏰ Limited time offer — don\'t miss out!');
  lines.push('💬 Tag a friend who needs this deal!');

  return lines.join('\n');
}

// ── Hashtag generator ─────────────────────────────────────────────────────────

/**
 * Generate 10–20 relevant hashtags for a deal.
 * @param {object} deal  { title, platform, discount }
 * @returns {string[]}
 */
function generateHashtags(deal) {
  const tags = new Set(BASE_TAGS);

  // Platform-specific
  (PLATFORM_TAGS[deal.platform] || []).forEach((t) => tags.add(t));

  // Category detection (first rule match only)
  const titleLower = String(deal.title || '').toLowerCase();
  for (const rule of CATEGORY_RULES) {
    if (rule.keywords.some((kw) => titleLower.includes(kw))) {
      rule.tags.forEach((t) => tags.add(t));
      break;
    }
  }

  // Discount magnitude tags
  if (deal.discount >= 40) tags.add('#bigdiscount');
  if (deal.discount >= 60) tags.add('#megasale');
  if (deal.discount >= 70) tags.add('#crazydeals');

  // Ensure max 20, trim to array
  return Array.from(tags).slice(0, 20);
}

// ── Combined helper ───────────────────────────────────────────────────────────

/**
 * Returns both caption and hashtags in one call.
 */
function buildInstagramContent(deal) {
  return {
    caption:  generateCaption(deal),
    hashtags: generateHashtags(deal),
  };
}

module.exports = { generateCaption, generateHashtags, buildInstagramContent };
