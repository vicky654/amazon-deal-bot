/**
 * Category Definitions — Allowed categories only:
 *   Shoes/Footwear · Electronics/Gadgets · Clothing/Fashion · Makeup/Beauty · Gym/Fitness
 */

// 50%+ off filter for Amazon India
const AMAZON_DISCOUNT_FILTER = 'p_n_pct-off-with-tax:2675329031';

// ─── AMAZON ───────────────────────────────────────────────────────────────────
const AMAZON_CATEGORIES = [
  // Electronics / Gadgets
  { id: 'mobiles',      name: 'Mobiles & Smartphones',   platform: 'amazon', node: '1389401031', maxPages: 5 },
  { id: 'laptops',      name: 'Laptops & Computers',     platform: 'amazon', node: '1375424031', maxPages: 3 },
  { id: 'headphones',   name: 'Headphones & Audio',      platform: 'amazon', node: '1388921031', maxPages: 3 },
  { id: 'smartwatches', name: 'Smartwatches & Wearables',platform: 'amazon', node: '2454178031', maxPages: 3 },
  { id: 'cameras',      name: 'Cameras & Photography',   platform: 'amazon', node: '1738558031', maxPages: 2 },
  { id: 'televisions',  name: 'Televisions',             platform: 'amazon', node: '1389396031', maxPages: 3 },

  // Shoes / Footwear
  { id: 'shoes',        name: 'Shoes & Footwear',        platform: 'amazon', node: '1983518031', maxPages: 4 },

  // Clothing / Fashion
  { id: 'men-clothing',   name: "Men's Clothing",        platform: 'amazon', node: '1968024031', maxPages: 3 },
  { id: 'women-clothing', name: "Women's Clothing",      platform: 'amazon', node: '1968025031', maxPages: 3 },

  // Makeup / Beauty
  { id: 'beauty',       name: 'Beauty & Personal Care',  platform: 'amazon', node: '1355016031', maxPages: 3 },

  // Gym / Fitness
  { id: 'fitness',      name: 'Sports & Fitness',        platform: 'amazon', node: '1984443031', maxPages: 3 },
];

// ─── FLIPKART ─────────────────────────────────────────────────────────────────
const FLIPKART_CATEGORIES = [
  // Electronics / Gadgets
  {
    id: 'fk-electronics', name: 'Flipkart Electronics', platform: 'flipkart',
    url: 'https://www.flipkart.com/electronics/pr?sid=tyy&p[]=facets.discount_range_v1%255B%255D=50%2525+and+above',
    maxPages: 3,
  },
  {
    id: 'fk-mobiles', name: 'Flipkart Mobiles', platform: 'flipkart',
    url: 'https://www.flipkart.com/mobiles/pr?sid=tyy,4io&p[]=facets.discount_range_v1%255B%255D=50%2525+and+above',
    maxPages: 3,
  },

  // Shoes / Footwear
  {
    id: 'fk-shoes', name: 'Flipkart Footwear', platform: 'flipkart',
    url: 'https://www.flipkart.com/footwear/pr?sid=osp&p[]=facets.discount_range_v1%255B%255D=50%2525+and+above',
    maxPages: 3,
  },

  // Clothing / Fashion
  {
    id: 'fk-fashion', name: 'Flipkart Fashion', platform: 'flipkart',
    url: 'https://www.flipkart.com/clothing-and-accessories/pr?sid=clo&p[]=facets.discount_range_v1%255B%255D=50%2525+and+above',
    maxPages: 3,
  },

  // Makeup / Beauty
  {
    id: 'fk-beauty', name: 'Flipkart Beauty', platform: 'flipkart',
    url: 'https://www.flipkart.com/beauty-health/pr?sid=hlth,5ru&p[]=facets.discount_range_v1%255B%255D=50%2525+and+above',
    maxPages: 3,
  },

  // Gym / Fitness
  {
    id: 'fk-fitness', name: 'Flipkart Sports & Fitness', platform: 'flipkart',
    url: 'https://www.flipkart.com/sports-fitness/pr?sid=deg&p[]=facets.discount_range_v1%255B%255D=50%2525+and+above',
    maxPages: 2,
  },
];

// ─── MYNTRA ───────────────────────────────────────────────────────────────────
const MYNTRA_CATEGORIES = [
  // Clothing / Fashion
  { id: 'myntra-men-fashion',   name: 'Myntra Men Fashion',   platform: 'myntra', url: 'https://www.myntra.com/men-clothing',   maxPages: 3, pageParam: 'p' },
  { id: 'myntra-women-fashion', name: 'Myntra Women Fashion', platform: 'myntra', url: 'https://www.myntra.com/women-clothing', maxPages: 3, pageParam: 'p' },

  // Shoes / Footwear
  { id: 'myntra-shoes',         name: 'Myntra Footwear',      platform: 'myntra', url: 'https://www.myntra.com/shoes',          maxPages: 3, pageParam: 'p' },

  // Makeup / Beauty
  { id: 'myntra-beauty',        name: 'Myntra Beauty',        platform: 'myntra', url: 'https://www.myntra.com/beauty',         maxPages: 2, pageParam: 'p' },

  // Sale (cross-category — filtered downstream)
  { id: 'myntra-sale',          name: 'Myntra Sale',          platform: 'myntra', url: 'https://www.myntra.com/sale',           maxPages: 3, pageParam: 'p' },
];

// ─── AJIO ─────────────────────────────────────────────────────────────────────
const AJIO_CATEGORIES = [
  // Clothing / Fashion
  { id: 'ajio-men-fashion',   name: 'Ajio Men Fashion',   platform: 'ajio', url: 'https://www.ajio.com/men/c/830200000',   maxPages: 3, pageParam: 'pageNum' },
  { id: 'ajio-women-fashion', name: 'Ajio Women Fashion', platform: 'ajio', url: 'https://www.ajio.com/women/c/830300000', maxPages: 3, pageParam: 'pageNum' },

  // Shoes / Footwear
  { id: 'ajio-shoes',         name: 'Ajio Footwear',      platform: 'ajio', url: 'https://www.ajio.com/shoes/c/830490039', maxPages: 3, pageParam: 'pageNum' },
];

const CATEGORIES = [...AMAZON_CATEGORIES];

function buildAmazonPageUrl(category, page) {
  const base = `https://www.amazon.in/s?rh=n%3A${category.node}%2C${AMAZON_DISCOUNT_FILTER}&sort=discount-rank`;
  return page === 1 ? base : `${base}&page=${page}`;
}

function buildPageUrl(category, page) {
  if (category.platform === 'amazon') return buildAmazonPageUrl(category, page);
  if (page === 1) return category.url;
  return `${category.url}&${category.pageParam || 'page'}=${page}`;
}

module.exports = { CATEGORIES, AMAZON_CATEGORIES, FLIPKART_CATEGORIES, MYNTRA_CATEGORIES, AJIO_CATEGORIES, buildPageUrl };
