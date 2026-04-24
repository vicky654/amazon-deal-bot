'use strict';
/**
 * Browser diagnostics — run with: npm run browser:diag
 *
 * Kills Chrome, validates profile JSON, tests all headless modes,
 * captures dumpio stderr, verifies executable, checks lock files.
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const fs   = require('fs');
const path = require('path');
const { exec } = require('child_process');

const puppeteerVanilla = require('puppeteer');
const CHROME_PROFILE_DIR = path.join(__dirname, '..', 'chrome-profile');
const LOCK_FILES = ['SingletonLock', 'SingletonCookie', 'SingletonSocket'];

// ── Helpers ───────────────────────────────────────────────────────────────────

function sep(label) {
  console.log(`\n${'─'.repeat(60)}`);
  console.log(`  ${label}`);
  console.log('─'.repeat(60));
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function execAsync(cmd) {
  return new Promise(resolve =>
    exec(cmd, (err, stdout, stderr) =>
      resolve({ err, stdout: stdout || '', stderr: stderr || '' })
    )
  );
}

async function countChromeProcesses() {
  if (process.platform !== 'win32') return 0;
  const { stdout } = await execAsync('tasklist /FI "IMAGENAME eq chrome.exe" /FO CSV /NH 2>NUL');
  return (stdout.match(/chrome\.exe/gi) || []).length;
}

// ── Step 1: Kill Chrome ───────────────────────────────────────────────────────

async function killChrome() {
  sep('STEP 1 — Kill lingering chrome.exe');
  const before = await countChromeProcesses();
  console.log(`  chrome.exe running: ${before}`);
  if (before === 0) { console.log('  Nothing to kill.'); return; }

  const { err } = await execAsync('taskkill /F /IM chrome.exe /T 2>NUL');
  if (err) console.log(`  taskkill warning: ${err.message}`);
  else     console.log(`  Sent SIGKILL to all chrome.exe`);

  let waited = 0;
  while (waited < 8000) {
    await sleep(400);
    waited += 400;
    const count = await countChromeProcesses();
    process.stdout.write(`\r  Waiting ${waited}ms … ${count} remaining   `);
    if (count === 0) {
      console.log(`\n  ✅ All chrome.exe gone after ${waited}ms`);
      return;
    }
  }
  const remaining = await countChromeProcesses();
  console.log(`\n  ⚠️  ${remaining} chrome.exe still present after 8s`);
}

// ── Step 2: Lock files ────────────────────────────────────────────────────────

function checkLockFiles() {
  sep('STEP 2 — Check lock files');
  for (const name of LOCK_FILES) {
    const lockPath = path.join(CHROME_PROFILE_DIR, name);
    const exists   = fs.existsSync(lockPath);
    console.log(`  ${name}: ${exists ? '⚠️  PRESENT' : '✅ absent'}`);
    if (exists) {
      try   { fs.unlinkSync(lockPath); console.log('    → Deleted OK'); }
      catch (e) { console.log(`    → Could not delete: ${e.message}`); }
    }
  }
}

// ── Step 3: Validate profile JSON ────────────────────────────────────────────

function validateProfileJson() {
  sep('STEP 3 — Validate profile JSON');
  const files = [
    { label: 'Local State',         path: path.join(CHROME_PROFILE_DIR, 'Local State') },
    { label: 'Default/Preferences', path: path.join(CHROME_PROFILE_DIR, 'Default', 'Preferences') },
  ];
  for (const { label, path: filePath } of files) {
    if (!fs.existsSync(filePath)) {
      console.log(`  ${label}: absent (Chrome will create it on first launch)`);
      continue;
    }
    try {
      const raw = fs.readFileSync(filePath, 'utf8');
      JSON.parse(raw);
      console.log(`  ${label}: ✅ valid JSON (${raw.length} bytes)`);
    } catch (e) {
      console.log(`  ${label}: ❌ CORRUPT — ${e.message}`);
      try {
        fs.writeFileSync(filePath, '{}', 'utf8');
        console.log(`    → Reset to {} OK`);
      } catch (we) {
        console.log(`    → Could not write: ${we.message}`);
      }
    }
  }
}

// ── Step 4: Verify executable ─────────────────────────────────────────────────

function checkExecutable() {
  sep('STEP 4 — Verify Chromium executable');
  try {
    const exePath = puppeteerVanilla.executablePath();
    const exists  = fs.existsSync(exePath);
    console.log(`  Path  : ${exePath}`);
    console.log(`  Exists: ${exists ? '✅ yes' : '❌ NO — Chromium not downloaded!'}`);
    if (!exists) console.log('  Fix   : npm install  (puppeteer postinstall re-downloads Chromium)');
    return exists ? exePath : null;
  } catch (e) {
    console.log(`  ❌ executablePath() threw: ${e.message}`);
    return null;
  }
}

// ── Step 5: Test launch ───────────────────────────────────────────────────────

async function testLaunch(exePath, headlessMode, label) {
  sep(`STEP 5 — Test launch (${label})`);
  console.log(`  headless: ${JSON.stringify(headlessMode)}, dumpio: true (Chrome stderr shown below)`);
  try {
    const puppeteer     = require('puppeteer-extra');
    const StealthPlugin = require('puppeteer-extra-plugin-stealth');
    puppeteer.use(StealthPlugin());

    const browser = await puppeteer.launch({
      headless:          headlessMode,
      executablePath:    exePath,
      userDataDir:       CHROME_PROFILE_DIR,
      args:              ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage',
                          '--disable-gpu', '--no-first-run', '--no-default-browser-check'],
      ignoreHTTPSErrors: true,
      timeout:           30000,
      dumpio:            true,
    });

    const page  = await browser.newPage();
    await page.goto('about:blank', { timeout: 10000 });
    const title = await page.title();
    await page.close();
    await browser.close();
    console.log(`\n  ✅ PASSED — title: "${title}"`);
    return true;
  } catch (e) {
    console.log(`\n  ❌ FAILED — ${e.message}`);
    return false;
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║              BROWSER DIAGNOSTICS                          ║');
  console.log('╚════════════════════════════════════════════════════════════╝');

  sep('SYSTEM INFO');
  const mem = process.memoryUsage();
  console.log(`  Node.js    : ${process.version}`);
  console.log(`  Platform   : ${process.platform} (${process.arch})`);
  console.log(`  Node RSS   : ${Math.round(mem.rss / 1024 / 1024)} MB`);
  console.log(`  Node heap  : ${Math.round(mem.heapUsed / 1024 / 1024)}/${Math.round(mem.heapTotal / 1024 / 1024)} MB`);
  console.log(`  Profile dir: ${CHROME_PROFILE_DIR}`);
  const chromeCount = await countChromeProcesses();
  console.log(`  chrome.exe : ${chromeCount} running`);

  await killChrome();
  checkLockFiles();
  validateProfileJson();
  const exePath = checkExecutable();

  if (!exePath) {
    console.log('\n❌ FATAL: Chromium binary missing. Cannot run launch tests.');
    process.exit(1);
  }

  const newOk = await testLaunch(exePath, 'new', 'headless="new"');
  if (!newOk) {
    await execAsync('taskkill /F /IM chrome.exe /T 2>NUL');
    await sleep(3000);
    await testLaunch(exePath, true, 'headless=true (legacy)');
  }

  sep('SUMMARY');
  const finalCount = await countChromeProcesses();
  console.log(`  chrome.exe after tests: ${finalCount}`);
  console.log('\nDone.\n');
}

main().catch(e => { console.error(e); process.exit(1); });
