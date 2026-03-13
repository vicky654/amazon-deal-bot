const puppeteer = require("puppeteer");

async function scrapeAmazonProduct(url) {

  let browser;

  try {

    console.log("Launching browser...");

    browser = await puppeteer.launch({
      headless: "new",
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu"
      ]
    });

    const page = await browser.newPage();

    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36"
    );

    console.log("Navigating to:", url);

    await page.goto(url, {
      waitUntil: "networkidle2",
      timeout: 60000
    });

    await page.waitForSelector("#productTitle", { timeout: 15000 });

    await page.waitForTimeout(3000);

    const product = await page.evaluate(() => {

      const title =
        document.querySelector("#productTitle")?.innerText.trim();


      const image =
        document.querySelector("#landingImage")?.src ||
        document.querySelector(".a-dynamic-image")?.src;

      const cleanPrice = (text) => {
        if (!text) return null;

        const number = text.replace(/[^0-9.]/g, "");
        return Math.round(parseFloat(number));
      };
const priceText =
  document.querySelector(".priceToPay .a-offscreen")?.innerText ||
  document.querySelector("#priceblock_dealprice")?.innerText ||
  document.querySelector("#priceblock_ourprice")?.innerText ||
  document.querySelector(".a-price .a-offscreen")?.innerText;

const originalText =
  document.querySelector(".priceBlockStrikePriceString")?.innerText ||
  document.querySelector(".basisPrice .a-offscreen")?.innerText ||
  document.querySelector(".a-price.a-text-price .a-offscreen")?.innerText ||
  document.querySelector(".a-size-small.a-color-secondary.a-text-strike")?.innerText;


      const price = cleanPrice(priceText);
      const originalPrices = cleanPrice(originalText);

      let savings = null;

      if (price && originalPrices) {
        savings = Math.round(((originalPrices - price) / originalPrices) * 100);
      }

      return {
        title,
        price,
        originalPrice: originalPrices,
        savings,
        image,
        merchant: "Amazon",
        link: window.location.href
      };

    });

    console.log("Scraped product:", product.title);
    console.log("Deal price:", product.price);
    console.log("MRP:", product.originalPrices);
    console.log("Savings:", product.savings);


    return product;

  } catch (error) {

    console.error("Scraping error:", error.message);
    throw new Error("Failed to scrape Amazon product");

  } finally {

    if (browser) {
      await browser.close();
    }

  }

}

module.exports = { scrapeAmazonProduct };