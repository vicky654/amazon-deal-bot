/**
 * Post Decision — Smart Rules
 *
 * Called BEFORE sending any deal to Telegram.
 * Returns { allow: boolean, reason: string }
 */

const BOOK_KEYWORDS = [
  'book', 'books', 'textbook', 'novel', 'paperback', 'hardcover',
  'ebook', 'comics', 'manga', 'autobiography', 'biography', 'dictionary',
  'encyclopedia', 'kindle', 'guide book', 'workbook',
];

function isBook(deal) {
  const cat   = (deal.category || '').toLowerCase();
  const title = (deal.title    || '').toLowerCase();
  return BOOK_KEYWORDS.some((k) => cat.includes(k) || title.includes(k));
}

function isPostedToday(lastPostedAt) {
  if (!lastPostedAt) return false;
  const last = new Date(lastPostedAt);
  const now  = new Date();
  return (
    last.getFullYear() === now.getFullYear() &&
    last.getMonth()    === now.getMonth()    &&
    last.getDate()     === now.getDate()
  );
}

/**
 * Decide whether a deal should be posted to Telegram.
 *
 * @param {object} product      Scraped product (has .price, .title, .category)
 * @param {object} dbDeal       Mongoose document from DB (has .lastPostedAt, .lastPrice)
 * @returns {{ allow: boolean, reason: string }}
 */
function shouldPostDeal(product, dbDeal) {
  const ref = dbDeal || product;

  // Rule 1: Never post books
  if (isBook(ref)) {
    return { allow: false, reason: 'book-category' };
  }

  // Rule 2 & 3: Same-day repeat check with price-drop override
  if (dbDeal && isPostedToday(dbDeal.lastPostedAt)) {
    const currentPrice = product.price || dbDeal.price;
    const lastPrice    = dbDeal.lastPrice;

    if (lastPrice && currentPrice < lastPrice) {
      return { allow: true, reason: 'price-drop-repeat' };
    }

    return { allow: false, reason: 'same-day-repeat' };
  }

  return { allow: true, reason: 'ok' };
}

module.exports = { shouldPostDeal };
