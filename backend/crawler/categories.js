/**
 * Amazon India category definitions for the crawler.
 *
 * URL strategy:
 *   - Uses Amazon India search with discount filter applied at URL level
 *   - p_n_pct-off-with-tax:2675327031 = 50%+ off (pre-filters before our 60% engine filter)
 *   - Results sorted by discount rank so the best deals appear on page 1
 *
 * Node IDs are Amazon India-specific. Update this file if URLs stop returning results.
 * Pagination uses the standard `&page=N` parameter (Amazon supports up to ~20 pages).
 */

const BASE = 'https://www.amazon.in';

// Amazon India discount filter facet (50%+ off)
const DISCOUNT_FILTER = 'p_n_pct-off-with-tax:2675327031';

const CATEGORIES = [
  {
    id: 'mobiles',
    name: 'Mobiles & Smartphones',
    // Node 1389401031 = Mobile Phones (Amazon India)
    url: `${BASE}/s?rh=n:1389401031,${DISCOUNT_FILTER}&s=discount-rank`,
    maxPages: 5,
  },
  {
    id: 'laptops',
    name: 'Laptops & Computers',
    // Node 1375424031 = Laptops (Amazon India)
    url: `${BASE}/s?rh=n:1375424031,${DISCOUNT_FILTER}&s=discount-rank`,
    maxPages: 4,
  },
  {
    id: 'audio',
    name: 'Headphones & Audio',
    // Node 1388921031 = Headphones (Amazon India)
    url: `${BASE}/s?rh=n:1388921031,${DISCOUNT_FILTER}&s=discount-rank`,
    maxPages: 3,
  },
  {
    id: 'smartwatches',
    name: 'Smartwatches & Wearables',
    url: `${BASE}/s?k=smartwatch+india&rh=${DISCOUNT_FILTER}&s=discount-rank`,
    maxPages: 3,
  },
  {
    id: 'cameras',
    name: 'Cameras & Photography',
    // Node 1738558031 = Cameras (Amazon India)
    url: `${BASE}/s?rh=n:1738558031,${DISCOUNT_FILTER}&s=discount-rank`,
    maxPages: 3,
  },
  {
    id: 'televisions',
    name: 'Televisions',
    // Node 1389396031 = Televisions (Amazon India)
    url: `${BASE}/s?rh=n:1389396031,${DISCOUNT_FILTER}&s=discount-rank`,
    maxPages: 3,
  },
  {
    id: 'home-kitchen',
    name: 'Home & Kitchen',
    // Node 976455031 = Home & Kitchen (Amazon India)
    url: `${BASE}/s?rh=n:976455031,${DISCOUNT_FILTER}&s=discount-rank`,
    maxPages: 3,
  },
  {
    id: 'fashion',
    name: 'Fashion & Clothing',
    // Node 1571271031 = Clothing (Amazon India)
    url: `${BASE}/s?rh=n:1571271031,${DISCOUNT_FILTER}&s=discount-rank`,
    maxPages: 3,
  },
  {
    id: 'sports',
    name: 'Sports & Fitness',
    // Node 1984443031 = Sports (Amazon India)
    url: `${BASE}/s?rh=n:1984443031,${DISCOUNT_FILTER}&s=discount-rank`,
    maxPages: 3,
  },
  {
    id: 'deals-page',
    name: 'Amazon Deals Page',
    // The main deals page — always a rich source
    url: `${BASE}/deals`,
    maxPages: 5,
  },
];

/**
 * Build a paginated URL for a given category and page number.
 * Amazon search pagination uses &page=N.
 */
function buildPageUrl(category, page) {
  if (page === 1) return category.url;
  // Avoid double-appending &page for deals page (uses different pagination)
  if (category.id === 'deals-page') {
    return `${category.url}?page=${page}`;
  }
  return `${category.url}&page=${page}`;
}

/**
 * Returns total maximum pages across all categories (used for progress reporting).
 */
function totalMaxPages() {
  return CATEGORIES.reduce((sum, c) => sum + c.maxPages, 0);
}

module.exports = { CATEGORIES, buildPageUrl, totalMaxPages };
