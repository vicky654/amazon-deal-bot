/**
 * Amazon India Category Definitions
 *
 * Allowed categories: Electronics · Shoes/Footwear · Clothing · Beauty · Gym/Fitness
 *
 * URLs use search-index (i=) + optional node (rh=n%3A...) + sort=discount-rank.
 * The stale facet filter (p_n_pct-off-with-tax) has been removed — it silently
 * returns 0 results when the internal Amazon ID expires.
 */

const AMAZON_CATEGORIES = [
  // ── Electronics / Gadgets ────────────────────────────────────────────────────
  {
    id: 'mobiles', name: 'Mobiles & Smartphones', platform: 'amazon',
    url: 'https://www.amazon.in/s?i=mobile&sort=discount-rank',
    maxPages: 3,
  },
  {
    id: 'laptops', name: 'Laptops & Computers', platform: 'amazon',
    url: 'https://www.amazon.in/s?i=computers&sort=discount-rank',
    maxPages: 2,
  },
  {
    id: 'headphones', name: 'Headphones & Audio', platform: 'amazon',
    url: 'https://www.amazon.in/s?i=electronics&rh=n%3A1388921031&sort=discount-rank',
    maxPages: 2,
  },
  {
    id: 'smartwatches', name: 'Smartwatches & Wearables', platform: 'amazon',
    url: 'https://www.amazon.in/s?i=electronics&rh=n%3A2454178031&sort=discount-rank',
    maxPages: 2,
  },
  {
    id: 'cameras', name: 'Cameras & Photography', platform: 'amazon',
    url: 'https://www.amazon.in/s?i=cameras&sort=discount-rank',
    maxPages: 1,
  },
  {
    id: 'televisions', name: 'Televisions', platform: 'amazon',
    url: 'https://www.amazon.in/s?i=electronics&rh=n%3A1389396031&sort=discount-rank',
    maxPages: 2,
  },

  // ── Shoes / Footwear ─────────────────────────────────────────────────────────
  {
    id: 'shoes', name: 'Shoes & Footwear', platform: 'amazon',
    url: 'https://www.amazon.in/s?i=shoes&sort=discount-rank',
    maxPages: 2,
  },

  // ── Clothing / Fashion ───────────────────────────────────────────────────────
  {
    id: 'men-clothing', name: "Men's Clothing", platform: 'amazon',
    url: 'https://www.amazon.in/s?i=apparel&rh=n%3A1968024031&sort=discount-rank',
    maxPages: 2,
  },
  {
    id: 'women-clothing', name: "Women's Clothing", platform: 'amazon',
    url: 'https://www.amazon.in/s?i=apparel&rh=n%3A1968025031&sort=discount-rank',
    maxPages: 2,
  },

  // ── Makeup / Beauty ──────────────────────────────────────────────────────────
  {
    id: 'beauty', name: 'Beauty & Personal Care', platform: 'amazon',
    url: 'https://www.amazon.in/s?i=beauty&sort=discount-rank',
    maxPages: 2,
  },

  // ── Gym / Fitness ────────────────────────────────────────────────────────────
  {
    id: 'fitness', name: 'Sports & Fitness', platform: 'amazon',
    url: 'https://www.amazon.in/s?i=sporting-goods&sort=discount-rank',
    maxPages: 2,
  },
];

const CATEGORIES = [...AMAZON_CATEGORIES];

function buildPageUrl(category, page) {
  if (page === 1) return category.url;
  return `${category.url}&page=${page}`;
}

module.exports = { CATEGORIES, AMAZON_CATEGORIES, buildPageUrl };
