#!/usr/bin/env bash
set -e

echo "=== Render build ==="
echo "Node: $(node --version)  npm: $(npm --version)"

# ── Unset ALL puppeteer skip-download vars (puppeteer v21 checks these exact names)
# If any of these are set to true in Render env, Chromium will NOT be downloaded.
# Delete them from Render dashboard → Environment Variables entirely.
unset PUPPETEER_SKIP_DOWNLOAD
unset PUPPETEER_SKIP_CHROME_DOWNLOAD
unset PUPPETEER_SKIP_CHROMIUM_DOWNLOAD
unset PUPPETEER_SKIP_CHROME_HEADLESS_SHELL_DOWNLOAD

echo "PUPPETEER_SKIP_DOWNLOAD=${PUPPETEER_SKIP_DOWNLOAD:-<not set>} (must be unset)"

npm install

echo "=== Verifying bundled Chromium ==="
node -e "
  const puppeteer = require('puppeteer');
  const path = puppeteer.executablePath();
  const fs = require('fs');
  console.log('Chromium path:', path);
  if (!fs.existsSync(path)) {
    console.error('ERROR: Chromium not found at', path);
    console.error('Check that PUPPETEER_SKIP_DOWNLOAD is not set in Render env vars');
    process.exit(1);
  }
  console.log('Chromium: OK');
"

echo "=== Build complete ==="
