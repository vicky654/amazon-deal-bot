/**
 * Multi-Platform Category Definitions
 *
 * Each category drives the extractor to harvest product URLs.
 * Amazon categories use axios+cheerio (fast, no browser).
 * Flipkart / Myntra / Ajio use Puppeteer because their listing pages
 * require JS execution.
 */

// ─── AMAZON INDIA ─────────────────────────────────────────────────────────────
// Uses Amazon's node-based navigation with discount filter
const AMAZON_DISCOUNT_FILTER = 'p_n_pct-off-with-tax:2675327031'; // 40%+ off

const AMAZON_CATEGORIES = [
  {
    id:       'mobiles',
    name:     'Mobiles & Smartphones',
    platform: 'amazon',
    node:     '1389401031',
    maxPages: 5,
  },
  {
    id:       'laptops',
    name:     'Laptops & Computers',
    platform: 'amazon',
    node:     '1375424031',
    maxPages: 4,
  },
  {
    id:       'headphones',
    name:     'Headphones & Audio',
    platform: 'amazon',
    node:     '1388921031',
    maxPages: 3,
  },
  {
    id:       'smartwatches',
    name:     'Smartwatches & Wearables',
    platform: 'amazon',
    node:     '2454178031',
    maxPages: 3,
  },
  {
    id:       'cameras',
    name:     'Cameras & Photography',
    platform: 'amazon',
    node:     '1738558031',
    maxPages: 3,
  },
  {
    id:       'televisions',
    name:     'Televisions',
    platform: 'amazon',
    node:     '1389396031',
    maxPages: 4,
  },
  {
    id:       'home-kitchen',
    name:     'Home & Kitchen',
    platform: 'amazon',
    node:     '976455031',
    maxPages: 3,
  },
  {
    id:       'sports',
    name:     'Sports & Fitness',
    platform: 'amazon',
    node:     '1984443031',
    maxPages: 3,
  },
];

// ─── FLIPKART ─────────────────────────────────────────────────────────────────
const FLIPKART_CATEGORIES = [
  {
    id:        'fk-mobiles',
    name:      'Flipkart Mobiles',
    platform:  'flipkart',
    url:       'https://www.flipkart.com/mobiles/pr?sid=tyy,4io&otracker=categorytree&p[]=facets.discount_range_v1%255B%255D=40%2525+and+above',
    maxPages:  4,
    pageParam: 'page',
  },
  {
    id:        'fk-electronics',
    name:      'Flipkart Electronics',
    platform:  'flipkart',
    url:       'https://www.flipkart.com/electronics/pr?sid=tyy&otracker=categorytree&p[]=facets.discount_range_v1%255B%255D=40%2525+and+above',
    maxPages:  3,
    pageParam: 'page',
  },
  {
    id:        'fk-fashion',
    name:      'Flipkart Fashion',
    platform:  'flipkart',
    url:       'https://www.flipkart.com/clothing-and-accessories/pr?sid=clo&otracker=categorytree&p[]=facets.discount_range_v1%255B%255D=50%2525+and+above',
    maxPages:  3,
    pageParam: 'page',
  },
];

// ─── MYNTRA ───────────────────────────────────────────────────────────────────
const MYNTRA_CATEGORIES = [
  {
    id:        'myntra-men',
    name:      'Myntra Men',
    platform:  'myntra',
    url:       'https://www.myntra.com/men',
    maxPages:  3,
    pageParam: 'p',
  },
  {
    id:        'myntra-women',
    name:      'Myntra Women',
    platform:  'myntra',
    url:       'https://www.myntra.com/women',
    maxPages:  3,
    pageParam: 'p',
  },
  {
    id:        'myntra-sale',
    name:      'Myntra Sale',
    platform:  'myntra',
    url:       'https://www.myntra.com/sale',
    maxPages:  4,
    pageParam: 'p',
  },
];

// ─── AJIO ──────────────────────────────────────────────────────────────────────
const AJIO_CATEGORIES = [
  {
    id:        'ajio-men',
    name:      'Ajio Men',
    platform:  'ajio',
    url:       'https://www.ajio.com/men/c/830200000',
    maxPages:  3,
    pageParam: 'pageNum',
  },
  {
    id:        'ajio-women',
    name:      'Ajio Women',
    platform:  'ajio',
    url:       'https://www.ajio.com/women/c/830300000',
    maxPages:  3,
    pageParam: 'pageNum',
  },
];

// All categories combined — ordered by expected deal density
const CATEGORIES = [
  ...AMAZON_CATEGORIES,
  ...FLIPKART_CATEGORIES,
  ...MYNTRA_CATEGORIES,
  ...AJIO_CATEGORIES,
];

/**
 * Build a paginated URL for an Amazon category.
 */
function buildAmazonPageUrl(category, page) {
  const base = `https://www.amazon.in/s?rh=n%3A${category.node}%2C${AMAZON_DISCOUNT_FILTER}&sort=discount-rank`;
  return page === 1 ? base : `${base}&page=${page}`;
}

/**
 * Build a paginated URL for a non-Amazon category.
 */
function buildPageUrl(category, page) {
  if (category.platform === 'amazon') return buildAmazonPageUrl(category, page);
  if (page === 1) return category.url;
  return `${category.url}&${category.pageParam || 'page'}=${page}`;
}

module.exports = { CATEGORIES, AMAZON_CATEGORIES, FLIPKART_CATEGORIES, MYNTRA_CATEGORIES, AJIO_CATEGORIES, buildPageUrl };
