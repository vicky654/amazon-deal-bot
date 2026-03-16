/**
 * Unit tests — affiliate.js
 * Tests: ASIN extraction, affiliate link generation, URL validation
 */

const {
  extractAsin,
  buildAffiliateLink,
  isAmazonProductUrl,
} = require("../utils/affiliate");

const TRACKING_ID = "dailydeal06f0-21";

describe("extractAsin", () => {
  test("extracts ASIN from /dp/ URL", () => {
    expect(extractAsin("https://www.amazon.in/dp/B08N5WRWNW")).toBe("B08N5WRWNW");
  });

  test("extracts ASIN from /dp/ URL with query string", () => {
    expect(extractAsin("https://www.amazon.in/dp/B08N5WRWNW?ref=sr_1_1")).toBe("B08N5WRWNW");
  });

  test("extracts ASIN from /gp/product/ URL", () => {
    expect(extractAsin("https://www.amazon.in/gp/product/B09G9HD9VW")).toBe("B09G9HD9VW");
  });

  test("extracts ASIN from a long product slug URL", () => {
    const url =
      "https://www.amazon.in/Samsung-Galaxy-Awesome-Black-Storage/dp/B09V3KBBCT/ref=sr_1_3";
    expect(extractAsin(url)).toBe("B09V3KBBCT");
  });

  test("returns null for a URL with no ASIN", () => {
    expect(extractAsin("https://www.amazon.in/s?k=headphones")).toBeNull();
  });

  test("returns null for an empty string", () => {
    expect(extractAsin("")).toBeNull();
  });

  test("returns null for null input", () => {
    expect(extractAsin(null)).toBeNull();
  });

  test("returns null for undefined", () => {
    expect(extractAsin(undefined)).toBeNull();
  });

  test("is case-insensitive — returns uppercase ASIN", () => {
    expect(extractAsin("https://www.amazon.in/dp/b08n5wrwnw")).toBe("B08N5WRWNW");
  });
});

describe("buildAffiliateLink", () => {
  test("builds correct affiliate link from /dp/ URL", () => {
    const result = buildAffiliateLink("https://www.amazon.in/dp/B08N5WRWNW");
    expect(result).toBe(`https://www.amazon.in/dp/B08N5WRWNW?tag=${TRACKING_ID}`);
  });

  test("builds correct link from a long product URL", () => {
    const url =
      "https://www.amazon.in/Samsung-Galaxy/dp/B09V3KBBCT/ref=sr_1_1?keywords=samsung";
    const result = buildAffiliateLink(url);
    expect(result).toBe(`https://www.amazon.in/dp/B09V3KBBCT?tag=${TRACKING_ID}`);
  });

  test("strips existing query parameters and applies tracking tag", () => {
    const url = "https://www.amazon.in/dp/B08N5WRWNW?ref=pd_sl&psc=1";
    const result = buildAffiliateLink(url);
    expect(result).toContain(`tag=${TRACKING_ID}`);
    expect(result).not.toContain("psc=1");
  });

  test("throws for a URL with no ASIN", () => {
    expect(() => buildAffiliateLink("https://www.amazon.in/s?k=phone")).toThrow(
      "ASIN not found"
    );
  });

  test("throws for an empty string", () => {
    expect(() => buildAffiliateLink("")).toThrow();
  });
});

describe("isAmazonProductUrl", () => {
  test("returns true for a valid amazon.in product URL", () => {
    expect(isAmazonProductUrl("https://www.amazon.in/dp/B08N5WRWNW")).toBe(true);
  });

  test("returns false for an Amazon search URL", () => {
    expect(isAmazonProductUrl("https://www.amazon.in/s?k=headphones")).toBe(false);
  });

  test("returns false for a non-Amazon URL", () => {
    expect(isAmazonProductUrl("https://www.flipkart.com/product/p/abc")).toBe(false);
  });

  test("returns false for null", () => {
    expect(isAmazonProductUrl(null)).toBe(false);
  });

  test("returns false for empty string", () => {
    expect(isAmazonProductUrl("")).toBe(false);
  });
});
