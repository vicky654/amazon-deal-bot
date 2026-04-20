/**
 * Reel Generator — Premium Instagram 9:16 (1080×1920)
 *
 * Scene 1 (2s)  — Brand intro: bold headline + urgency pill
 * Scene 2 (5s)  — Product hero: image + price + discount badge + CTA
 * Scene 3 (3s)  — CTA outro: buy now + Telegram channel link
 *
 * Safe zones: top 250px / bottom 250px (Instagram UI overlay)
 * Templates: dark | sale | minimal
 * Output: backend/public/reels/{dealId}_{template}.mp4
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

// ── Canvas ────────────────────────────────────────────────────────────────────

const W        = 1080;
const H        = 1920;
const SAFE_TOP = 260;
const SAFE_BOT = 260;

const REELS_DIR    = path.resolve(__dirname, '../../public/reels');
const BRAND_HANDLE = process.env.REEL_BRAND_HANDLE || '@dailydealsecommerce';
const BRAND_NAME   = process.env.REEL_BRAND_NAME   || 'Daily Deals';
const TG_LINK      = process.env.REEL_TG_URL       || 't.me/DailyDeals';

fs.mkdirSync(REELS_DIR, { recursive: true });

const reelQueue = new PQueue({ concurrency: 1 });

// ── Themes ────────────────────────────────────────────────────────────────────

const THEMES = {
  dark: {
    // backgrounds
    bg1: '#060010', bg2: '#0f0030',
    // neon accents
    accent: '#c850c0', accentAlt: '#4158d0',
    accentMid: '#ffcc70',
    // text
    text: '#ffffff', subtext: '#d4bfff', mutedText: '#8a7aac',
    // glow orbs
    orb1: '#c850c0', orb2: '#4158d0',
    // discount badge
    discBg1: '#ff416c', discBg2: '#ff4b2b',
    discText: '#ffffff',
    discGlow: 'rgba(255,65,108,0.45)',
    // CTA
    ctaBg1: '#c850c0', ctaBg2: '#4158d0', ctaText: '#ffffff',
    // brand pill
    brandBg: 'rgba(255,255,255,0.06)', brandBorder: 'rgba(255,255,255,0.18)',
    // gradient overlay on image
    overlayMid: 'rgba(6,0,16,0.50)', overlayEnd: 'rgba(6,0,16,0.95)',
    // image bg fallback
    imgBg: { r: 10, g: 0, b: 24, alpha: 1 },
  },
  sale: {
    bg1: '#1a0000', bg2: '#3d0000',
    accent: '#ffd700', accentAlt: '#ff6b35', accentMid: '#ff4500',
    text: '#ffffff', subtext: '#ffe8cc', mutedText: '#ffc8a0',
    orb1: '#ff4500', orb2: '#ffd700',
    discBg1: '#ff4500', discBg2: '#ff6b35',
    discText: '#ffffff', discGlow: 'rgba(255,69,0,0.50)',
    ctaBg1: '#ffd700', ctaBg2: '#ff6b35', ctaText: '#1a0000',
    brandBg: 'rgba(255,255,255,0.07)', brandBorder: 'rgba(255,215,0,0.30)',
    overlayMid: 'rgba(26,0,0,0.45)', overlayEnd: 'rgba(26,0,0,0.94)',
    imgBg: { r: 30, g: 5, b: 0, alpha: 1 },
  },
  minimal: {
    bg1: '#0a0a0f', bg2: '#12121c',
    accent: '#00d4ff', accentAlt: '#7b2fff', accentMid: '#ff3c78',
    text: '#ffffff', subtext: '#b0b8d4', mutedText: '#6b7280',
    orb1: '#00d4ff', orb2: '#7b2fff',
    discBg1: '#ff3c78', discBg2: '#c850c0',
    discText: '#ffffff', discGlow: 'rgba(255,60,120,0.40)',
    ctaBg1: '#00d4ff', ctaBg2: '#7b2fff', ctaText: '#ffffff',
    brandBg: 'rgba(255,255,255,0.05)', brandBorder: 'rgba(0,212,255,0.25)',
    overlayMid: 'rgba(10,10,15,0.45)', overlayEnd: 'rgba(10,10,15,0.94)',
    imgBg: { r: 10, g: 10, b: 20, alpha: 1 },
  },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

const FONT = 'Arial, Helvetica, Liberation Sans, sans-serif';

function esc(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function fmtINR(n) {
  if (n == null || n === 0) return '';
  return `₹${Number(n).toLocaleString('en-IN')}`;
}

function wrapTitle(text, maxChars = 26, maxLines = 2) {
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
    const usedWords = lines.join(' ').split(' ');
    if (usedWords.length < words.length) {
      const last = lines[lines.length - 1];
      if (!last.endsWith('\u2026') && last.length <= maxChars - 1) {
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
    <linearGradient id="textGrad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%"   stop-color="${t.accent}"/>
      <stop offset="50%"  stop-color="${t.accentMid}"/>
      <stop offset="100%" stop-color="${t.accentAlt}"/>
    </linearGradient>
    <filter id="glow">
      <feGaussianBlur stdDeviation="18" result="blur"/>
      <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
  </defs>

  <!-- Background -->
  <rect width="${W}" height="${H}" fill="url(#bg)"/>

  <!-- Glow orbs for depth -->
  <circle cx="200"  cy="500"  r="380" fill="${t.orb1}" fill-opacity="0.13"/>
  <circle cx="980"  cy="1500" r="420" fill="${t.orb2}" fill-opacity="0.12"/>
  <circle cx="540"  cy="960"  r="700" fill="${t.orb1}" fill-opacity="0.04"/>

  <!-- Top brand pill -->
  <rect x="300" y="${SAFE_TOP}" width="480" height="66" rx="33"
        fill="${t.brandBg}" stroke="${t.brandBorder}" stroke-width="1.5"/>
  <text x="540" y="${SAFE_TOP + 33}" text-anchor="middle" dominant-baseline="middle"
        fill="${t.accent}" font-size="30" font-weight="bold" letter-spacing="1"
        font-family="${FONT}">${esc(BRAND_HANDLE)}</text>

  <!-- HOT DEAL urgency pill -->
  <rect x="300" y="555" width="480" height="82" rx="41" fill="url(#accentGrad)"/>
  <text x="540" y="596" text-anchor="middle" dominant-baseline="middle"
        fill="white" font-size="38" font-weight="bold" letter-spacing="4"
        font-family="${FONT}">&#9889; LIGHTNING DEAL</text>

  <!-- CRAZY -->
  <text x="540" y="810"
        text-anchor="middle" fill="${t.text}"
        font-size="158" font-weight="bold" letter-spacing="6"
        font-family="${FONT}">CRAZY</text>

  <!-- DEAL! — gradient-fill via rect mask trick -->
  <text x="540" y="985"
        text-anchor="middle" fill="${t.accent}"
        font-size="166" font-weight="bold" letter-spacing="6"
        font-family="${FONT}">DEAL!</text>

  <!-- Accent underline -->
  <rect x="160" y="1035" width="760" height="5" rx="3" fill="${t.accent}" fill-opacity="0.55"/>

  <!-- Subtext -->
  <text x="540" y="1110" text-anchor="middle" fill="${t.subtext}"
        font-size="46" font-family="${FONT}">Limited Time Only</text>

  <!-- Value badges row -->
  <rect x="100"  y="1190" width="248" height="70" rx="35" fill="${t.brandBg}" stroke="${t.brandBorder}" stroke-width="1.5"/>
  <text x="224"  y="1225" text-anchor="middle" dominant-baseline="middle"
        fill="${t.text}" font-size="34" font-weight="bold" font-family="${FONT}">Top Brands</text>

  <rect x="416"  y="1190" width="248" height="70" rx="35" fill="${t.brandBg}" stroke="${t.brandBorder}" stroke-width="1.5"/>
  <text x="540"  y="1225" text-anchor="middle" dominant-baseline="middle"
        fill="${t.text}" font-size="34" font-weight="bold" font-family="${FONT}">50%+ OFF</text>

  <rect x="732"  y="1190" width="248" height="70" rx="35" fill="${t.brandBg}" stroke="${t.brandBorder}" stroke-width="1.5"/>
  <text x="856"  y="1225" text-anchor="middle" dominant-baseline="middle"
        fill="${t.text}" font-size="34" font-weight="bold" font-family="${FONT}">Amazon</text>

  <!-- Swipe hint -->
  <text x="540" y="1420" text-anchor="middle" fill="${t.subtext}"
        font-size="42" font-family="${FONT}">Swipe to see the deal</text>
  <text x="540" y="1494" text-anchor="middle" fill="${t.accent}"
        font-size="56" font-family="${FONT}">&#8964;</text>

  <!-- Stars -->
  <text x="540" y="1635" text-anchor="middle" fill="${t.accent}"
        font-size="50" letter-spacing="22" font-family="${FONT}">&#9733; &#9733; &#9733; &#9733; &#9733;</text>

  <!-- Footer -->
  <text x="540" y="1790" text-anchor="middle" fill="${t.mutedText}"
        font-size="34" font-family="${FONT}">${esc(BRAND_NAME)} | ${esc(TG_LINK)}</text>
</svg>`;

  return sharp(Buffer.from(svg)).resize(W, H).png().toBuffer();
}

// ── Scene 2 — Product Hero ────────────────────────────────────────────────────

async function buildScene2(deal, imgBuffer, theme) {
  const t     = THEMES[theme] || THEMES.dark;
  const lines = wrapTitle(deal.title, 26, 2);
  const price = fmtINR(deal.price);
  const orig  = fmtINR(deal.originalPrice);
  const disc  = deal.discount ? `${Math.round(Number(deal.discount))}%` : '';
  const saving = (deal.originalPrice && deal.price && deal.originalPrice > deal.price)
    ? fmtINR(Number(deal.originalPrice) - Number(deal.price))
    : '';

  // Layout constants — everything within safe zones (260 → 1660)
  const IMG_SIZE  = 860;
  const IMG_LEFT  = Math.floor((W - IMG_SIZE) / 2); // 110
  const IMG_TOP   = SAFE_TOP + 5;                    // 265
  const IMG_BOT   = imgBuffer ? IMG_TOP + IMG_SIZE : 560; // 1125

  const TEXT_Y0   = IMG_BOT + 60;           // title line 1
  const LINE_H    = 82;
  const SEP_Y     = TEXT_Y0 + lines.length * LINE_H + 8;
  const PRICE_Y   = SEP_Y + 100;
  const ORIG_Y    = PRICE_Y + 95;
  const SAVE_Y    = ORIG_Y + 62;
  const CTA_TOP   = Math.min(SAVE_Y + 50, 1548);
  const CTA_H     = 100;
  const BIO_Y     = Math.min(CTA_TOP + CTA_H + 44, 1660);

  // Discount badge position (right side, aligned with price)
  const BADGE_CX  = 930;
  const BADGE_CY  = PRICE_Y - 16;
  const BADGE_R   = 118;

  // ── background ─────────────────────────────────────────────────────────────
  const bgSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
    <defs>
      <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%"   stop-color="${t.bg1}"/>
        <stop offset="100%" stop-color="${t.bg2}"/>
      </linearGradient>
    </defs>
    <rect width="${W}" height="${H}" fill="url(#bg)"/>
    <circle cx="950"  cy="1800" r="300" fill="${t.orb1}" fill-opacity="0.08"/>
    <circle cx="-40"  cy="80"   r="260" fill="${t.orb2}" fill-opacity="0.08"/>
  </svg>`;

  const composites = [];

  // ── product image ──────────────────────────────────────────────────────────
  if (imgBuffer) {
    try {
      const productPng = await sharp(imgBuffer)
        .resize(IMG_SIZE, IMG_SIZE, { fit: 'contain', background: t.imgBg })
        .png()
        .toBuffer();
      composites.push({ input: productPng, top: IMG_TOP, left: IMG_LEFT });
    } catch (e) {
      logger.warn(`[ReelGen] Image compose failed: ${e.message}`);
    }
  }

  // ── gradient overlay (makes text readable over image) ─────────────────────
  const overlayY = imgBuffer ? Math.max(IMG_BOT - 340, IMG_TOP) : 0;
  const overlaySvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
    <defs>
      <linearGradient id="ov" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%"   stop-color="${t.bg1}" stop-opacity="0"/>
        <stop offset="40%"  stop-color="${t.overlayMid}"/>
        <stop offset="65%"  stop-color="${t.overlayEnd}"/>
        <stop offset="100%" stop-color="${t.overlayEnd}"/>
      </linearGradient>
    </defs>
    <rect y="${overlayY}" width="${W}" height="${H}" fill="url(#ov)"/>
  </svg>`;
  composites.push({ input: Buffer.from(overlaySvg), top: 0, left: 0 });

  // ── text + badge layer ─────────────────────────────────────────────────────
  const textSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
    <defs>
      <linearGradient id="accentGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%"   stop-color="${t.accent}"/>
        <stop offset="100%" stop-color="${t.accentAlt}"/>
      </linearGradient>
      <linearGradient id="ctaGrad" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%"   stop-color="${t.ctaBg1}"/>
        <stop offset="100%" stop-color="${t.ctaBg2}"/>
      </linearGradient>
      <linearGradient id="discGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%"   stop-color="${t.discBg1}"/>
        <stop offset="100%" stop-color="${t.discBg2}"/>
      </linearGradient>
    </defs>

    <!-- Brand handle (top safe zone) -->
    <rect x="300" y="${SAFE_TOP}" width="480" height="64" rx="32"
          fill="${t.brandBg}" stroke="${t.brandBorder}" stroke-width="1.5"/>
    <text x="540" y="${SAFE_TOP + 32}" text-anchor="middle" dominant-baseline="middle"
          fill="${t.accent}" font-size="29" font-weight="bold" letter-spacing="0.5"
          font-family="${FONT}">${esc(BRAND_HANDLE)}</text>

    <!-- Product title -->
    ${lines.map((l, i) => `
    <text x="540" y="${TEXT_Y0 + i * LINE_H}"
          text-anchor="middle" fill="${t.text}"
          font-size="68" font-weight="bold" letter-spacing="0.3"
          font-family="${FONT}">${esc(l)}</text>`).join('')}

    <!-- Separator -->
    <rect x="120" y="${SEP_Y}" width="840" height="3" rx="2"
          fill="${t.accent}" fill-opacity="0.45"/>

    <!-- Deal price (left-aligned, XL) -->
    ${price ? `<text x="78" y="${PRICE_Y}"
          text-anchor="start" fill="${t.accent}"
          font-size="116" font-weight="bold"
          font-family="${FONT}">${esc(price)}</text>` : ''}

    <!-- Original price (strikethrough) -->
    ${orig ? `<text x="78" y="${ORIG_Y}"
          text-anchor="start" fill="${t.subtext}"
          font-size="52" text-decoration="line-through" fill-opacity="0.85"
          font-family="${FONT}">${esc(orig)}</text>` : ''}

    <!-- Savings -->
    ${saving ? `<text x="78" y="${SAVE_Y}"
          text-anchor="start" fill="${t.accentMid}"
          font-size="40" font-weight="bold"
          font-family="${FONT}">&#10003; You save ${esc(saving)}</text>` : ''}

    <!-- Discount badge (right) -->
    ${disc ? `
    <!-- outer glow -->
    <circle cx="${BADGE_CX}" cy="${BADGE_CY}" r="${BADGE_R + 22}" fill="${t.discGlow}"/>
    <!-- main filled circle -->
    <circle cx="${BADGE_CX}" cy="${BADGE_CY}" r="${BADGE_R}" fill="url(#discGrad)"/>
    <!-- white inner ring -->
    <circle cx="${BADGE_CX}" cy="${BADGE_CY}" r="${BADGE_R - 14}"
            fill="none" stroke="white" stroke-width="2.5" stroke-opacity="0.45"/>
    <!-- percentage -->
    <text x="${BADGE_CX}" y="${BADGE_CY - 14}" text-anchor="middle"
          fill="${t.discText}" font-size="68" font-weight="bold"
          font-family="${FONT}">${esc(disc)}</text>
    <!-- OFF -->
    <text x="${BADGE_CX}" y="${BADGE_CY + 52}" text-anchor="middle"
          fill="${t.discText}" font-size="42" font-weight="bold" letter-spacing="4"
          font-family="${FONT}">OFF</text>` : ''}

    <!-- CTA button -->
    <rect x="78" y="${CTA_TOP}" width="${disc ? 760 : 924}" height="${CTA_H}" rx="${CTA_H / 2}"
          fill="url(#ctaGrad)"/>
    <text x="${disc ? 78 + 380 : 78 + 462}" y="${CTA_TOP + CTA_H / 2}"
          text-anchor="middle" dominant-baseline="middle"
          fill="${t.ctaText}" font-size="52" font-weight="bold" letter-spacing="3"
          font-family="${FONT}">&#128722; BUY NOW</text>

    <!-- Link in bio -->
    <text x="540" y="${BIO_Y}" text-anchor="middle"
          fill="${t.subtext}" font-size="40" font-weight="bold"
          font-family="${FONT}">&#128279; Link in Bio</text>

    <!-- Footer -->
    <text x="540" y="1792" text-anchor="middle" fill="${t.mutedText}"
          font-size="32" font-family="${FONT}">${esc(BRAND_NAME)} | ${esc(TG_LINK)}</text>
  </svg>`;

  composites.push({ input: Buffer.from(textSvg), top: 0, left: 0 });

  return sharp(Buffer.from(bgSvg))
    .composite(composites)
    .resize(W, H)
    .png()
    .toBuffer();
}

// ── Scene 3 — CTA Outro ───────────────────────────────────────────────────────

async function buildScene3(theme) {
  const t = THEMES[theme] || THEMES.dark;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%"   stop-color="${t.bg1}"/>
      <stop offset="100%" stop-color="${t.bg2}"/>
    </linearGradient>
    <linearGradient id="btnGrad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%"   stop-color="${t.ctaBg1}"/>
      <stop offset="100%" stop-color="${t.ctaBg2}"/>
    </linearGradient>
    <linearGradient id="tgGrad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%"   stop-color="${t.accentAlt}"/>
      <stop offset="100%" stop-color="${t.accent}"/>
    </linearGradient>
  </defs>

  <!-- Background -->
  <rect width="${W}" height="${H}" fill="url(#bg)"/>
  <circle cx="160"  cy="400"  r="360" fill="${t.orb1}" fill-opacity="0.10"/>
  <circle cx="960"  cy="1580" r="420" fill="${t.orb2}" fill-opacity="0.09"/>

  <!-- Brand handle -->
  <rect x="300" y="${SAFE_TOP}" width="480" height="66" rx="33"
        fill="${t.brandBg}" stroke="${t.brandBorder}" stroke-width="1.5"/>
  <text x="540" y="${SAFE_TOP + 33}" text-anchor="middle" dominant-baseline="middle"
        fill="${t.accent}" font-size="30" font-weight="bold" letter-spacing="1"
        font-family="${FONT}">${esc(BRAND_HANDLE)}</text>

  <!-- Central icon (shopping bag concentric rings) -->
  <circle cx="540" cy="640" r="230" fill="${t.accent}" fill-opacity="0.10"/>
  <circle cx="540" cy="640" r="178" fill="${t.accent}" fill-opacity="0.17"/>
  <circle cx="540" cy="640" r="126" fill="${t.accent}" fill-opacity="0.28"/>
  <!-- Shopping bag simplified -->
  <g transform="translate(478,578)">
    <rect x="0"  y="24" width="124" height="96" rx="10" fill="white" fill-opacity="0.88"/>
    <path d="M24 24 C24 0 100 0 100 24" fill="none" stroke="white" stroke-width="10"
          stroke-linecap="round" stroke-opacity="0.88"/>
    <circle cx="44" cy="24" r="5" fill="${t.accent}"/>
    <circle cx="80" cy="24" r="5" fill="${t.accent}"/>
  </g>

  <!-- Main CTA heading -->
  <text x="540" y="910" text-anchor="middle" fill="${t.text}"
        font-size="94" font-weight="bold" letter-spacing="3"
        font-family="${FONT}">GET THIS DEAL!</text>

  <!-- BUY NOW button (large) -->
  <rect x="80" y="975" width="920" height="120" rx="60" fill="url(#btnGrad)"/>
  <text x="540" y="1035" text-anchor="middle" dominant-baseline="middle"
        fill="${t.ctaText}" font-size="64" font-weight="bold" letter-spacing="5"
        font-family="${FONT}">&#128722;  BUY NOW</text>

  <!-- Link in Bio -->
  <text x="540" y="1165" text-anchor="middle" fill="${t.text}"
        font-size="62" font-weight="bold"
        font-family="${FONT}">&#128279; Link in Bio</text>
  <text x="540" y="1240" text-anchor="middle" fill="${t.subtext}"
        font-size="40" font-family="${FONT}">Tap the link above to grab the deal</text>

  <!-- Divider -->
  <rect x="180" y="1300" width="720" height="3" rx="2"
        fill="${t.accent}" fill-opacity="0.38"/>

  <!-- Telegram section -->
  <text x="540" y="1385" text-anchor="middle" fill="${t.text}"
        font-size="48" font-weight="bold" font-family="${FONT}">&#9993; Join Telegram for More</text>
  <!-- Telegram pill -->
  <rect x="200" y="1420" width="680" height="78" rx="39" fill="url(#tgGrad)" fill-opacity="0.18"
        stroke="${t.accent}" stroke-width="1.5"/>
  <text x="540" y="1459" text-anchor="middle" dominant-baseline="middle"
        fill="${t.accent}" font-size="42" font-weight="bold"
        font-family="${FONT}">${esc(TG_LINK)}</text>

  <!-- Follow -->
  <text x="540" y="1560" text-anchor="middle" fill="${t.subtext}"
        font-size="42" font-family="${FONT}">Follow for daily hot deals &#9889;</text>

  <!-- Stars -->
  <text x="540" y="1652" text-anchor="middle" fill="${t.accent}"
        font-size="50" letter-spacing="20" font-family="${FONT}">
    &#9733; &#9733; &#9733; &#9733; &#9733;
  </text>

  <!-- Footer -->
  <text x="540" y="1792" text-anchor="middle" fill="${t.mutedText}"
        font-size="34" font-family="${FONT}">${esc(BRAND_NAME)} | ${esc(TG_LINK)}</text>
</svg>`;

  return sharp(Buffer.from(svg)).resize(W, H).png().toBuffer();
}

// ── FFmpeg video assembly ─────────────────────────────────────────────────────

async function framesToVideo(frames, outputPath) {
  const id       = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const tmpFiles = frames.map((_, i) => path.join(os.tmpdir(), `reel_${id}_s${i}.png`));

  try {
    await Promise.all(frames.map((buf, i) => fs.promises.writeFile(tmpFiles[i], buf)));

    // Scene durations: intro 2s, product 5s, cta 3s
    const durations = [2, 5, 3];
    const fadeDur   = 0.4;

    const filterParts = frames.map((_, i) => {
      const d = durations[i];
      const parts = [];
      if (i > 0)                  parts.push(`fade=t=in:st=0:d=${fadeDur}`);
      if (i < frames.length - 1) parts.push(`fade=t=out:st=${d - fadeDur}:d=${fadeDur}`);
      const chain = parts.length ? `[${i}:v]${parts.join(',')}` : `[${i}:v]`;
      return `${chain}[v${i}]`;
    });
    const concatIn = frames.map((_, i) => `[v${i}]`).join('');
    filterParts.push(
      `${concatIn}concat=n=${frames.length}:v=1:a=0,scale=${W}:${H},format=yuv420p[out]`
    );

    const args = [
      '-y',
      '-loop', '1', '-framerate', '24', '-t', String(durations[0]), '-i', tmpFiles[0],
      '-loop', '1', '-framerate', '24', '-t', String(durations[1]), '-i', tmpFiles[1],
      '-loop', '1', '-framerate', '24', '-t', String(durations[2]), '-i', tmpFiles[2],
      '-filter_complex', filterParts.join(';'),
      '-map', '[out]',
      '-c:v', 'libx264', '-preset', 'fast', '-crf', '20',
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
  const tpl    = Object.keys(THEMES).includes(template) ? template : 'dark';
  const dealId = String(deal._id || deal.id || 'unknown');

  const filename   = `${dealId}_${tpl}.mp4`;
  const outputPath = path.join(REELS_DIR, filename);
  const videoUrl   = `/reels/${filename}`;

  if (fs.existsSync(outputPath)) {
    logger.info(`[ReelGen] Cache hit: ${filename}`);
    return { videoUrl, cached: true };
  }

  return reelQueue.add(async () => {
    if (fs.existsSync(outputPath)) return { videoUrl, cached: true };

    logger.info(`[ReelGen] Generating: deal=${dealId} template=${tpl}`);

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
    try { fs.unlinkSync(path.join(REELS_DIR, `${id}_${tpl}.mp4`)); } catch (_) {}
  });
}

function reelExists(dealId, template = 'dark') {
  return fs.existsSync(path.join(REELS_DIR, `${dealId}_${template}.mp4`));
}

module.exports = { generateReel, deleteReelCache, reelExists, THEMES };
