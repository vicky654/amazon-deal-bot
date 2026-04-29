# Anti-Bot Hardening TODO

- [x] 1. `backend/src/crawler/antiBot.js` — add homepage-redirect stats, longer blacklist, update detection rate
- [x] 2. `backend/src/crawler/categories.js` — reduce maxPages for all categories
- [x] 3. `backend/src/scraper/browser.js` — flip headless default, add human helpers, random viewport, diagnostics
- [x] 4. `backend/src/scraper/amazon.js` — human behavior, anti-bot classification, diagnostics, debug snapshots
- [x] 5. `backend/src/crawler/extractor.js` — slower delays, wrong-layout/homepage-redirect recovery, pass finalUrl to classifyPage
- [x] 6. `backend/src/crawler/index.js` — reduce cycle count, log browser diagnostics at start

