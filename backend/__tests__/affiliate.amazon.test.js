/**
 * Amazon Affiliate — Unit Tests
 */

const {
  buildAmazonAffiliateLink,
  extractAsin,
  isAmazonUrl,
} = require('../src/affiliate/amazon');

const TRACKING_ID = process.env.AMAZON_TRACKING_ID || 'test-track-21';

describe('extractAsin()', () => {
  const cases = [
    ['standard /dp/ URL',          'https://www.amazon.in/dp/B08N5WRWNW',                              'B08N5WRWNW'],
    ['/dp/ with query params',     'https://www.amazon.in/dp/B08N5WRWNW?ref=sr_1_1&th=1',             'B08N5WRWNW'],
    ['/gp/product/ URL',           'https://www.amazon.in/gp/product/B0ABCD12EF',                     'B0ABCD12EF'],
    ['/gp/product/ with params',   'https://www.amazon.in/gp/product/B0ABCD12EF?ie=UTF8',             'B0ABCD12EF'],
    ['amazon.com domain',          'https://www.amazon.com/dp/B09X8D5XBN',                             'B09X8D5XBN'],
    ['slug before /dp/',           'https://www.amazon.in/Samsung-Galaxy-S24/dp/B0CVFCL9RH',          'B0CVFCL9RH'],
    ['uppercase normalisation',    'https://www.amazon.in/dp/b08n5wrwnw',                              'B08N5WRWNW'],
  ];

  it.each(cases)('%s', (_label, url, expected) => {
    expect(extractAsin(url)).toBe(expected);
  });

  it('returns null for search URL',      () => expect(extractAsin('https://www.amazon.in/s?k=phones')).toBeNull());
  it('returns null for non-Amazon URL',  () => expect(extractAsin('https://www.flipkart.com/dp/FAKE')).toBeNull());
  it('returns null for null input',      () => expect(extractAsin(null)).toBeNull());
  it('returns null for empty string',    () => expect(extractAsin('')).toBeNull());
  it('returns null for undefined input', () => expect(extractAsin(undefined)).toBeNull());
});

describe('buildAmazonAffiliateLink()', () => {
  it('builds clean affiliate link with tag', () => {
    const link = buildAmazonAffiliateLink('https://www.amazon.in/dp/B08N5WRWNW');
    expect(link).toBe(`https://www.amazon.in/dp/B08N5WRWNW?tag=${TRACKING_ID}`);
  });

  it('strips all existing query params', () => {
    const link = buildAmazonAffiliateLink(
      'https://www.amazon.in/dp/B08N5WRWNW?ref=sr&linkCode=ll1&tag=old-tag&th=1'
    );
    expect(link).toBe(`https://www.amazon.in/dp/B08N5WRWNW?tag=${TRACKING_ID}`);
    expect(link).not.toContain('ref=');
    expect(link).not.toContain('linkCode=');
  });

  it('works with slug-based URLs', () => {
    const link = buildAmazonAffiliateLink(
      'https://www.amazon.in/Apple-iPhone-15-128-GB/dp/B0CHX1W1XY'
    );
    expect(link).toContain('/dp/B0CHX1W1XY');
    expect(link).toContain(`tag=${TRACKING_ID}`);
  });

  it('returns original URL when ASIN cannot be extracted', () => {
    const url = 'https://www.amazon.in/s?k=wireless+earbuds';
    expect(buildAmazonAffiliateLink(url)).toBe(url);
  });

  it('always uses amazon.in domain', () => {
    const link = buildAmazonAffiliateLink('https://www.amazon.com/dp/B09X8D5XBN');
    expect(link).toContain('amazon.in');
  });
});

describe('isAmazonUrl()', () => {
  it('returns true for amazon.in /dp/ URL',          () => expect(isAmazonUrl('https://www.amazon.in/dp/B08N5WRWNW')).toBe(true));
  it('returns true for amazon.in /gp/product/ URL',  () => expect(isAmazonUrl('https://www.amazon.in/gp/product/B08N5WRWNW')).toBe(true));
  it('returns true for amazon.com /dp/ URL',         () => expect(isAmazonUrl('https://www.amazon.com/dp/B08N5WRWNW')).toBe(true));
  it('returns false for amazon search URL',           () => expect(isAmazonUrl('https://www.amazon.in/s?k=phones')).toBe(false));
  it('returns false for Flipkart URL',               () => expect(isAmazonUrl('https://www.flipkart.com/product')).toBe(false));
  it('returns false for null input',                 () => expect(isAmazonUrl(null)).toBe(false));
});
