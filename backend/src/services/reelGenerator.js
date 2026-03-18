/**
 * Reel Generator Service v2
 *
 * Generates a 1080×1920 Instagram Reel for a deal.
 *   Scene 1 (2s)  — Brand intro: gradient + headline + brand handle
 *   Scene 2 (5s)  — Product:  edge-to-edge image + safe-zone text + discount badge
 *   Scene 3 (3s)  — CTA: BUY NOW + Link in Bio + brand footer
 *
 * Safe zones: top 250px / bottom 250px (per Instagram spec)
 * Templates: dark | sale | minimal
 * Cache: backend/public/reels/{dealId}_{template}.mp4
 */

const path         = require('path');
const fs           = require('fs');
const os           = require('os');
const { execFile } = require('child_process');

const sharp      = require('sharp');
const axios      = require('axios');
const ffmpegPath = require('ffmpeg-static');

const _PQueue = require('p-queue');
const PQueue  = _PQueue.default || _PQueue;
const logger  = require('../../utils/logger');

// ── Constants ─────────────────────────────────────────────────────────────────

const W  = 1080;
const H  = 1920;
const SAFE_TOP = 250;     // Instagram UI covers top 250px
const SAFE_BOT = 250;     // Instagram UI covers bottom 250px
const SAFE_BOT_Y = H - SAFE_BOT; // y = 1670

const REELS_DIR     = path.resolve(__dirname, '../../public/reels');
const BRAND_HANDLE  = process.env.REEL_BRAND_HANDLE || '@dailydealsecommerce';
const BRAND_NAME    = process.env.REEL_BRAND_NAME   || 'Daily Deals';
const TG_LINK       = process.env.REEL_TG_URL       || 't.me/DailyDeals';

fs.mkdirSync(REELS_DIR, { recursive: true });

const reelQueue = new PQueue({ concurrency: 1 });

// ── Themes ────────────────────────────────────────────────────────────────────

const THEMES = {
  dark: {
    bg1: '#0d0221', bg2: '#1a0040',
    accent: '#ff3cac', accentAlt: '#7b2fff',
    text: '#ffffff', subtext: '#c8b8e8', mutedText: '#8a7aac',
    deco1: '#ff3cac', deco2: '#7b2fff',
    discBg: '#ff4500', discRing: 'rgba(255,107,53,0.35)', discText: '#ffffff',
    ctaBg: '#ff3cac', ctaText: '#ffffff',
    brandBg: 'rgba(255,255,255,0.07)', brandBorder: 'rgba(255,255,255,0.15)',
    overlayStart: 'rgba(13,2,33,0)', overlayMid: 'rgba(13,2,33,0.55)', overlayEnd: 'rgba(13,2,33,0.92)',
    imgBg: { r: 0, g: 0, b: 0, alpha: 0 },
  },
  sale: {
    bg1: '#5c0000', bg2: '#b30000',
    accent: '#ffd700', accentAlt: '#ff6b35',
    text: '#ffffff', subtext: '#ffe8e8', mutedText: '#ffcccc',
    deco1: '#ffd700', deco2: '#ff6b35',
    discBg: '#ff4500', discRing: 'rgba(255,107,53,0.35)', discText: '#ffffff',
    ctaBg: '#ffd700', ctaText: '#1a1a1a',
    brandBg: 'rgba(255,255,255,0.08)', brandBorder: 'rgba(255,255,255,0.20)',
    overlayStart: 'rgba(92,0,0,0)', overlayMid: 'rgba(92,0,0,0.50)', overlayEnd: 'rgba(20,0,0,0.90)',
    imgBg: { r: 0, g: 0, b: 0, alpha: 0 },
  },
  minimal: {
    bg1: '#f8f9fa', bg2: '#e8ecf0',
    accent: '#e53e3e', accentAlt: '#c53030',
    text: '#1a202c', subtext: '#4a5568', mutedText: '#718096',
    deco1: '#e53e3e', deco2: '#feb2b2',
    discBg: '#e53e3e', discRing: 'rgba(229,62,62,0.20)', discText: '#ffffff',
    ctaBg: '#1a202c', ctaText: '#ffffff',
    brandBg: 'rgba(0,0,0,0.04)', brandBorder: 'rgba(0,0,0,0.10)',
    overlayStart: 'rgba(248,249,250,0)', overlayMid: 'rgba(248,249,250,0.35)', overlayEnd: 'rgba(232,236,240,0.92)',
    imgBg: { r: 255, g: 255, b: 255, alpha: 0 },
  },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function esc(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function fmtINR(n) {
  if (n == null || n === 0) return '';
  return `Rs.${Number(n).toLocaleString('en-IN')}`;
}

function wrapTitle(text, maxChars = 28, maxLines = 2) {
  const words = String(text).trim().toUpperCase().split(/\s+/);
  const lines = [];
  let cur = '';
  for (const w of words) {
    if (lines.length >= maxLines) break;
    const candidate = cur ? `${cur} ${w}` : w;
    if (candidate.length > maxChars) {
      if (cur) lines.push(cur);
      cur = w.length > maxChars ? `${w.slice(0, maxChars - 1)}\u2026` : w;
    } else {
      cur = candidate;
    }
  }
  if (cur && lines.length < maxLines) lines.push(cur);
  if (lines.length === maxLines) {
    // Truncate last line if original had more content
    const usedWords = lines.join(' ').split(' ');
    if (usedWords.length < words.length) {
      const last = lines[lines.length - 1];
      if (last.length > maxChars - 1) {
        lines[lines.length - 1] = `${last.slice(0, maxChars - 1)}\u2026`;
      } else if (!last.endsWith('\u2026') && usedWords.length < words.length) {
        lines[lines.length - 1] = `${last}\u2026`.slice(0, maxChars);
      }
    }
  }
  return lines;
}

async function downloadImage(url) {
  if (!url) return null;
  try {
    const resp = await axios.get(url, {
      responseType: 'arraybuffer',
      timeout: 15000,
      headers: { 'User-Agent': 'Mozilla/5.0' },
    });
    return Buffer.from(resp.data);
  } catch {
    return null;
  }
}

function runFFmpeg(args, timeoutMs = 180_000) {
  return new Promise((resolve, reject) => {
    const proc = execFile(ffmpegPath, args, { timeout: timeoutMs }, (err, _out, stderr) => {
      if (err) reject(new Error(`FFmpeg: ${stderr?.slice(-600) || err.message}`));
      else     resolve();
    });
    proc.stderr?.on('data', (d) => logger.debug(`[FFmpeg] ${String(d).trim()}`));
  });
}

const FONT = 'Arial, Helvetica, Liberation Sans, sans-serif';

// ── Scene 1 — Brand Intro ─────────────────────────────────────────────────────

async function buildScene1(theme) {
  const t = THEMES[theme] || THEMES.dark;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%"   stop-color="${t.bg1}"/>
      <stop offset="100%" stop-color="${t.bg2}"/>
    </linearGradient>
    <linearGradient id="accentGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%"   stop-color="${t.accent}"/>
      <stop offset="100%" stop-color="${t.accentAlt}"/>
    </linearGradient>
  </defs>

  <!-- Background -->
  <rect width="${W}" height="${H}" fill="url(#bg)"/>

  <!-- Decorative glow circles -->
  <circle cx="1080" cy="380"  r="480" fill="${t.deco1}" fill-opacity="0.10"/>
  <circle cx="-60"  cy="1600" r="440" fill="${t.accentAlt}" fill-opacity="0.10"/>
  <circle cx="580"  cy="980"  r="600" fill="${t.deco1}" fill-opacity="0.04"/>

  <!-- Top brand area (inside safe zone = below y=250) -->
  <!-- Brand handle pill -->
  <rect x="290" y="285" width="500" height="70" rx="35"
        fill="${t.brandBg}" stroke="${t.brandBorder}" stroke-width="1.5"/>
  <text x="540" y="321" text-anchor="middle" dominant-baseline="middle"
        fill="${t.accent}" font-size="32" font-weight="bold" letter-spacing="1"
        font-family="${FONT}">${esc(BRAND_HANDLE)}</text>

  <!-- HOT DEAL pill badge -->
  <rect x="330" y="590" width="420" height="80" rx="40" fill="url(#accentGrad)"/>
  <text x="540" y="630" text-anchor="middle" dominant-baseline="middle"
        fill="white" font-size="38" font-weight="bold" letter-spacing="3"
        font-family="${FONT}">&#9733; HOT DEAL &#9733;</text>

  <!-- Main headline -->
  <text x="540" y="820"
        text-anchor="middle" fill="${t.text}"
        font-size="148" font-weight="bold" letter-spacing="4"
        font-family="${FONT}">CRAZY</text>
  <text x="540" y="985"
        text-anchor="middle" fill="${t.accent}"
        font-size="156" font-weight="bold" letter-spacing="4"
        font-family="${FONT}">DEAL!</text>

  <!-- Accent bar -->
  <rect x="180" y="1040" width="720" height="5" rx="3" fill="${t.accent}" fill-opacity="0.6"/>

  <!-- Subtext -->
  <text x="540" y="1110" text-anchor="middle" fill="${t.subtext}"
        font-size="46" font-family="${FONT}">Limited Time Only</text>

  <!-- Deal type indicators -->
  <rect x="200" y="1180" width="680" height="1.5" fill="${t.deco1}" fill-opacity="0.25"/>

  <!-- CTA hint -->
  <text x="540" y="1380" text-anchor="middle" fill="${t.mutedText}"
        font-size="40" font-family="${FONT}">Swipe to see the deal</text>
  <!-- Down arrow (Unicode &#9660; = ▼) -->
  <text x="540" y="1450" text-anchor="middle" fill="${t.accent}"
        font-size="52" font-family="${FONT}">&#9660;</text>

  <!-- Stars -->
  <text x="540" y="1600" text-anchor="middle" fill="${t.accent}"
        font-size="48" letter-spacing="20" font-family="${FONT}">
    &#9733; &#9733; &#9733; &#9733; &#9733;
  </text>

  <!-- Bottom brand footer (above safe bottom = below y=1670) -->
  <text x="540" y="1790" text-anchor="middle" fill="${t.mutedText}"
        font-size="34" font-family="${FONT}">${esc(BRAND_NAME)} | ${esc(TG_LINK)}</text>
</svg>`;

  return sharp(Buffer.from(svg)).resize(W, H).png().toBuffer();
}

// ── Scene 2 — Product ─────────────────────────────────────────────────────────

async function buildScene2(deal, imgBuffer, theme) {
  const t      = THEMES[theme] || THEMES.dark;
  const lines  = wrapTitle(deal.title, 28, 2);
  const price  = fmtINR(deal.price);
  const orig   = fmtINR(deal.originalPrice);
  const disc   = deal.discount ? `${Math.round(Number(deal.discount))}%` : '';
  const saving = (deal.originalPrice && deal.price && deal.originalPrice > deal.price)
    ? fmtINR(Number(deal.originalPrice) - Number(deal.price))
    : '';

  // Layout constants — all content between safe zones (250 to 1670)
  const hasImage   = !!imgBuffer;
  const IMG_MAX    = 900;                          // max image dimension
  const IMG_LEFT   = Math.floor((W - IMG_MAX) / 2); // 90
  const IMG_TOP    = 260;                          // just inside safe top
  const IMG_BOT    = hasImage ? IMG_TOP + IMG_MAX : 540; // 1160 or 540

  const TEXT_START = IMG_BOT + 55;                // 1215 or 595
  const LINE_H     = 80;
  const N_LINES    = lines.length;
  const SEP_Y      = TEXT_START + N_LINES * LINE_H + 10;
  const PRICE_Y    = SEP_Y + 95;                  // large price baseline
  const ORIG_Y     = PRICE_Y + 100;               // strikethrough baseline
  const SAVE_Y     = ORIG_Y + 68;                 // savings line
  const CTA_TOP    = Math.min(SAVE_Y + 55, 1560); // CTA button top
  const CTA_H      = 96;
  const CTA_BOT    = CTA_TOP + CTA_H;
  const BIO_Y      = Math.min(CTA_BOT + 38, 1648);
  const FOOTER_Y   = 1785;

  // Discount badge (right side, vertically aligned with price)
  const BADGE_CX   = 922;
  const BADGE_CY   = PRICE_Y - 15;
  const BADGE_R    = 120;

  // ── 1. Gradient background ─────────────────────────────────────────────────
  const bgSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
    <defs>
      <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%"   stop-color="${t.bg1}"/>
        <stop offset="100%" stop-color="${t.bg2}"/>
      </linearGradient>
    </defs>
    <rect width="${W}" height="${H}" fill="url(#bg)"/>
    <circle cx="1050" cy="1820" r="320" fill="${t.deco1}" fill-opacity="0.06"/>
    <circle cx="-40"  cy="100"  r="260" fill="${t.deco1}" fill-opacity="0.06"/>
  </svg>`;

  const composites = [];

  // ── 2. Product image (edge-to-edge, contained, no card wrapper) ────────────
  if (imgBuffer) {
    try {
      const productPng = await sharp(imgBuffer)
        .resize(IMG_MAX, IMG_MAX, { fit: 'contain', background: t.imgBg })
        .png()
        .toBuffer();
      composites.push({ input: productPng, top: IMG_TOP, left: IMG_LEFT });
    } catch (e) {
      logger.warn(`[ReelGen] Image compose failed: ${e.message}`);
    }
  }

  // ── 3. Gradient overlay (bottom → readability for text on image) ───────────
  const overlaySvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
    <defs>
      <linearGradient id="ov" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%"   stop-color="${t.overlayStart}"/>
        <stop offset="45%"  stop-color="${t.overlayMid}"/>
        <stop offset="72%"  stop-color="${t.overlayEnd}"/>
        <stop offset="100%" stop-color="${t.overlayEnd}"/>
      </linearGradient>
    </defs>
    <rect y="${hasImage ? IMG_BOT - 300 : 0}" width="${W}" height="${H}" fill="url(#ov)"/>
  </svg>`;
  composites.push({ input: Buffer.from(overlaySvg), top: 0, left: 0 });

  // ── 4. Text + badge SVG overlay ────────────────────────────────────────────
  const textSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
    <defs>
      <linearGradient id="ag" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%"   stop-color="${t.accent}"/>
        <stop offset="100%" stop-color="${t.accentAlt}"/>
      </linearGradient>
      <linearGradient id="ctaGrad" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%"   stop-color="${t.ctaBg}"/>
        <stop offset="100%" stop-color="${t.accent}"/>
      </linearGradient>
    </defs>

    <!-- Brand handle (top, inside safe zone) -->
    <rect x="305" y="275" width="470" height="64" rx="32"
          fill="${t.brandBg}" stroke="${t.brandBorder}" stroke-width="1.5"/>
    <text x="540" y="307" text-anchor="middle" dominant-baseline="middle"
          fill="${t.accent}" font-size="30" font-weight="bold" letter-spacing="0.5"
          font-family="${FONT}">${esc(BRAND_HANDLE)}</text>

    <!-- Product title (max 2 lines) -->
    ${lines.map((l, i) => `
    <text x="540" y="${TEXT_START + i * LINE_H}"
          text-anchor="middle" fill="${t.text}"
          font-size="64" font-weight="bold" letter-spacing="0.5"
          font-family="${FONT}">${esc(l)}</text>`).join('')}

    <!-- Separator -->
    <rect x="160" y="${SEP_Y}" width="760" height="3" rx="2"
          fill="${t.accent}" fill-opacity="0.50"/>

    <!-- Price (left-aligned, large) -->
    ${price ? `<text x="88" y="${PRICE_Y}"
          text-anchor="start" fill="${t.accent}"
          font-size="106" font-weight="bold"
          font-family="${FONT}">${esc(price)}</text>` : ''}

    <!-- Original price (strikethrough) -->
    ${orig ? `<text x="88" y="${ORIG_Y}"
          text-anchor="start" fill="${t.subtext}"
          font-size="50" text-decoration="line-through"
          font-family="${FONT}">${esc(orig)}</text>` : ''}

    <!-- Savings text -->
    ${saving ? `<text x="88" y="${SAVE_Y}"
          text-anchor="start" fill="${t.mutedText}"
          font-size="38" font-family="${FONT}">You save ${esc(saving)}</text>` : ''}

    <!-- Discount badge (right side) -->
    ${disc ? `
    <!-- Outer glow ring -->
    <circle cx="${BADGE_CX}" cy="${BADGE_CY}" r="${BADGE_R + 14}" fill="${t.discRing}"/>
    <!-- Main circle -->
    <circle cx="${BADGE_CX}" cy="${BADGE_CY}" r="${BADGE_R}" fill="${t.discBg}"/>
    <!-- Inner white ring -->
    <circle cx="${BADGE_CX}" cy="${BADGE_CY}" r="${BADGE_R - 12}"
            fill="none" stroke="white" stroke-width="2.5" stroke-opacity="0.55"/>
    <!-- Percentage text -->
    <text x="${BADGE_CX}" y="${BADGE_CY - 12}" text-anchor="middle"
          fill="${t.discText}" font-size="64" font-weight="bold"
          font-family="${FONT}">${esc(disc)}</text>
    <!-- OFF label -->
    <text x="${BADGE_CX}" y="${BADGE_CY + 52}" text-anchor="middle"
          fill="${t.discText}" font-size="40" font-weight="bold" letter-spacing="3"
          font-family="${FONT}">OFF</text>` : ''}

    <!-- CTA button -->
    <rect x="88" y="${CTA_TOP}" width="${disc ? 740 : 904}" height="${CTA_H}" rx="${CTA_H / 2}"
          fill="url(#ctaGrad)"/>
    <text x="${disc ? 88 + 370 : 88 + 452}" y="${CTA_TOP + CTA_H / 2}" text-anchor="middle"
          dominant-baseline="middle"
          fill="${t.ctaText}" font-size="54" font-weight="bold" letter-spacing="2"
          font-family="${FONT}">BUY NOW &#9660;</text>

    <!-- Link in Bio -->
    <text x="540" y="${BIO_Y}" text-anchor="middle"
          fill="${t.subtext}" font-size="40" font-weight="bold"
          font-family="${FONT}">&#128279; Link in Bio</text>

    <!-- Bottom brand footer -->
    <text x="540" y="${FOOTER_Y}" text-anchor="middle" fill="${t.mutedText}"
          font-size="32" font-family="${FONT}">${esc(BRAND_NAME)} | ${esc(TG_LINK)}</text>
  </svg>`;

  composites.push({ input: Buffer.from(textSvg), top: 0, left: 0 });

  return sharp(Buffer.from(bgSvg))
    .composite(composites)
    .resize(W, H)
    .png()
    .toBuffer();
}

// ── Scene 3 — CTA ─────────────────────────────────────────────────────────────

async function buildScene3(theme) {
  const t = THEMES[theme] || THEMES.dark;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%"   stop-color="${t.bg1}"/>
      <stop offset="100%" stop-color="${t.bg2}"/>
    </linearGradient>
    <linearGradient id="btnGrad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%"   stop-color="${t.ctaBg}"/>
      <stop offset="100%" stop-color="${t.accent}"/>
    </linearGradient>
  </defs>

  <!-- Background -->
  <rect width="${W}" height="${H}" fill="url(#bg)"/>
  <circle cx="180"  cy="450"  r="360" fill="${t.deco1}" fill-opacity="0.09"/>
  <circle cx="960"  cy="1550" r="400" fill="${t.accentAlt}" fill-opacity="0.08"/>

  <!-- Brand handle at top (safe zone) -->
  <rect x="305" y="285" width="470" height="64" rx="32"
        fill="${t.brandBg}" stroke="${t.brandBorder}" stroke-width="1.5"/>
  <text x="540" y="317" text-anchor="middle" dominant-baseline="middle"
        fill="${t.accent}" font-size="30" font-weight="bold" letter-spacing="0.5"
        font-family="${FONT}">${esc(BRAND_HANDLE)}</text>

  <!-- Large shopping icon area (concentric circles) -->
  <circle cx="540" cy="620" r="230" fill="${t.accent}" fill-opacity="0.12"/>
  <circle cx="540" cy="620" r="180" fill="${t.accent}" fill-opacity="0.18"/>
  <circle cx="540" cy="620" r="130" fill="${t.accent}" fill-opacity="0.28"/>
  <!-- Shopping bag icon (simplified SVG path) -->
  <g transform="translate(478, 558)">
    <rect x="0"  y="24" width="124" height="96" rx="8" fill="${t.ctaText}" fill-opacity="0.9"/>
    <path d="M24 24 C24 0 100 0 100 24" fill="none" stroke="${t.ctaText}" stroke-width="10"
          stroke-linecap="round" stroke-opacity="0.9"/>
    <circle cx="44" cy="24" r="5" fill="${t.accent}"/>
    <circle cx="80" cy="24" r="5" fill="${t.accent}"/>
  </g>

  <!-- Main CTA heading -->
  <text x="540" y="890" text-anchor="middle" fill="${t.text}"
        font-size="90" font-weight="bold" letter-spacing="2"
        font-family="${FONT}">GET IT NOW!</text>

  <!-- BUY NOW button -->
  <rect x="110" y="960" width="860" height="120" rx="60" fill="url(#btnGrad)"/>
  <text x="540" y="1020" text-anchor="middle" dominant-baseline="middle"
        fill="${t.ctaText}" font-size="68" font-weight="bold" letter-spacing="4"
        font-family="${FONT}">BUY NOW &#9660;</text>

  <!-- Link in Bio -->
  <text x="540" y="1135" text-anchor="middle" fill="${t.text}"
        font-size="68" font-weight="bold"
        font-family="${FONT}">&#128279; Link in Bio</text>
  <text x="540" y="1210" text-anchor="middle" fill="${t.subtext}"
        font-size="42" font-family="${FONT}">Tap the link above to grab the deal</text>

  <!-- Divider -->
  <rect x="200" y="1285" width="680" height="3" rx="2" fill="${t.accent}" fill-opacity="0.40"/>

  <!-- Telegram CTA -->
  <text x="540" y="1370" text-anchor="middle" fill="${t.text}"
        font-size="46" font-weight="bold" font-family="${FONT}">More deals on Telegram</text>
  <text x="540" y="1450" text-anchor="middle" fill="${t.accent}"
        font-size="50" font-weight="bold" font-family="${FONT}">${esc(TG_LINK)}</text>

  <!-- Follow text -->
  <text x="540" y="1545" text-anchor="middle" fill="${t.subtext}"
        font-size="40" font-family="${FONT}">Follow for daily hot deals!</text>

  <!-- Stars -->
  <text x="540" y="1635" text-anchor="middle" fill="${t.accent}"
        font-size="50" letter-spacing="18" font-family="${FONT}">
    &#9733; &#9733; &#9733; &#9733; &#9733;
  </text>

  <!-- Brand footer -->
  <text x="540" y="1790" text-anchor="middle" fill="${t.mutedText}"
        font-size="34" font-family="${FONT}">${esc(BRAND_NAME)} | ${esc(TG_LINK)}</text>
</svg>`;

  return sharp(Buffer.from(svg)).resize(W, H).png().toBuffer();
}

// ── FFmpeg encoding ───────────────────────────────────────────────────────────

async function framesToVideo(frames, outputPath) {
  const id       = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const tmpFiles = frames.map((_, i) => path.join(os.tmpdir(), `reel_${id}_s${i}.png`));

  try {
    await Promise.all(frames.map((buf, i) => fs.promises.writeFile(tmpFiles[i], buf)));

    const durations = [2, 5, 3];
    const fadeDur   = 0.45;

    // Per-clip fade in/out, then concat to single stream
    const filterParts = frames.map((_, i) => {
      const d = durations[i];
      const parts = [];
      if (i > 0)              parts.push(`fade=t=in:st=0:d=${fadeDur}`);
      if (i < frames.length - 1) parts.push(`fade=t=out:st=${d - fadeDur}:d=${fadeDur}`);
      const chain = parts.length ? `[${i}:v]${parts.join(',')},` : `[${i}:v]`;
      return `${chain.replace(/,$/, '')}[v${i}]`;
    });
    const concatInputs = frames.map((_, i) => `[v${i}]`).join('');
    filterParts.push(
      `${concatInputs}concat=n=${frames.length}:v=1:a=0,scale=${W}:${H},format=yuv420p[out]`
    );

    const args = [
      '-y',
      '-loop', '1', '-framerate', '24', '-t', String(durations[0]), '-i', tmpFiles[0],
      '-loop', '1', '-framerate', '24', '-t', String(durations[1]), '-i', tmpFiles[1],
      '-loop', '1', '-framerate', '24', '-t', String(durations[2]), '-i', tmpFiles[2],
      '-filter_complex', filterParts.join(';'),
      '-map', '[out]',
      '-c:v', 'libx264', '-preset', 'fast', '-crf', '22',
      '-movflags', '+faststart',
      outputPath,
    ];

    await runFFmpeg(args);
  } finally {
    await Promise.all(tmpFiles.map((f) => fs.promises.unlink(f).catch(() => {})));
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

async function generateReel(deal, template = 'dark') {
  const validTemplates = Object.keys(THEMES);
  const tpl    = validTemplates.includes(template) ? template : 'dark';
  const dealId = String(deal._id || deal.id || 'unknown');

  const filename   = `${dealId}_${tpl}.mp4`;
  const outputPath = path.join(REELS_DIR, filename);
  const videoUrl   = `/reels/${filename}`;

  if (fs.existsSync(outputPath)) {
    logger.info(`[ReelGen] Cache hit: ${filename}`);
    return { videoUrl, cached: true };
  }

  return reelQueue.add(async () => {
    logger.info(`[ReelGen] Starting: deal=${dealId} template=${tpl}`);

    // Double-check after acquiring queue lock
    if (fs.existsSync(outputPath)) {
      return { videoUrl, cached: true };
    }

    const imgBuffer = await downloadImage(deal.image);

    const [scene1, scene2, scene3] = await Promise.all([
      buildScene1(tpl),
      buildScene2(deal, imgBuffer, tpl),
      buildScene3(tpl),
    ]);

    await framesToVideo([scene1, scene2, scene3], outputPath);
    logger.info(`[ReelGen] Done: ${filename}`);
    return { videoUrl, cached: false };
  });
}

function deleteReelCache(dealId) {
  const id = String(dealId);
  Object.keys(THEMES).forEach((tpl) => {
    const p = path.join(REELS_DIR, `${id}_${tpl}.mp4`);
    try { fs.unlinkSync(p); } catch (_) {}
  });
}

function reelExists(dealId, template = 'dark') {
  return fs.existsSync(path.join(REELS_DIR, `${dealId}_${template}.mp4`));
}

module.exports = { generateReel, deleteReelCache, reelExists, THEMES };
