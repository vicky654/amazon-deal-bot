'use client';

import {
  Search, Cpu, Filter, Link2, Database, Send,
  Clock, ShoppingBag, Zap, Shield, RefreshCw,
  BarChart2, Play, Wand2, LayoutDashboard,
  CheckCircle2, ArrowRight, Globe, Tag, Cookie,
  TrendingDown, MessageSquare, Layers, Server,
} from 'lucide-react';

// ─── Shared primitives ────────────────────────────────────────────────────────

function Badge({ children, color = 'blue' }) {
  const map = {
    blue:   'bg-blue-50 text-blue-700 ring-blue-200',
    green:  'bg-green-50 text-green-700 ring-green-200',
    purple: 'bg-purple-50 text-purple-700 ring-purple-200',
    orange: 'bg-orange-50 text-orange-700 ring-orange-200',
    pink:   'bg-pink-50 text-pink-700 ring-pink-200',
    red:    'bg-red-50 text-red-700 ring-red-200',
  };
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${map[color]}`}>
      {children}
    </span>
  );
}

function SectionLabel({ children }) {
  return (
    <p className="text-xs font-semibold uppercase tracking-widest text-blue-600 mb-2">{children}</p>
  );
}

function SectionTitle({ children }) {
  return (
    <h2 className="text-2xl font-bold text-gray-900 tracking-tight">{children}</h2>
  );
}

// ─── Hero ─────────────────────────────────────────────────────────────────────

function Hero() {
  return (
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-gray-900 via-blue-950 to-gray-900 px-8 py-14 text-center">
      {/* Grid overlay */}
      <div className="pointer-events-none absolute inset-0 opacity-10"
        style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,.1) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.1) 1px,transparent 1px)', backgroundSize: '40px 40px' }} />

      {/* Glow */}
      <div className="pointer-events-none absolute left-1/2 top-0 -translate-x-1/2 h-64 w-96 rounded-full bg-blue-500 opacity-10 blur-3xl" />

      <div className="relative">
        <span className="mb-4 inline-flex items-center gap-2 rounded-full border border-blue-400/30 bg-blue-500/10 px-4 py-1.5 text-xs font-medium text-blue-300">
          <Zap className="h-3.5 w-3.5" /> Fully Automated · Runs 24/7
        </span>

        <h1 className="mt-4 text-4xl font-extrabold tracking-tight text-white sm:text-5xl">
          How This Deal Automation<br />
          <span className="bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
            System Works
          </span>
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-base text-gray-400">
          From product discovery to Telegram posting — fully automated across Amazon, Flipkart, Myntra &amp; Ajio.
        </p>

        <div className="mt-8 flex flex-wrap justify-center gap-3">
          {['7 Automated Steps', '4 Platforms', 'Cron-Powered', 'Smart Filtering'].map((t) => (
            <span key={t} className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-gray-300">{t}</span>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Step-by-step flow ───────────────────────────────────────────────────────

const STEPS = [
  {
    n:       '01',
    icon:    Search,
    color:   'blue',
    title:   'Product Discovery',
    summary: 'System scans category pages across all 4 platforms',
    detail: [
      'Amazon categories scraped with axios + cheerio (no browser — fast)',
      'Flipkart listing pages crawled via HTTP',
      'Myntra & Ajio use Puppeteer (JavaScript-rendered pages)',
      'Hundreds of product URLs extracted every 5-minute cycle',
    ],
    badge: 'Extraction',
  },
  {
    n:       '02',
    icon:    Cpu,
    color:   'indigo',
    title:   'Scraping Engine',
    summary: 'Deep scrape each product page with Puppeteer',
    detail: [
      'Singleton browser reused across all scrapes (memory efficient)',
      'Random delays + user-agent rotation to avoid bans',
      'Extracts: title · price · original price · discount % · image',
      '3-attempt retry with exponential back-off on failure',
    ],
    badge: 'Puppeteer',
  },
  {
    n:       '03',
    icon:    Filter,
    color:   'violet',
    title:   'Deal Filtering',
    summary: 'Only genuinely high-value deals are selected',
    detail: [
      'Amazon: ≥ 40% discount OR historical price-drop ≥ 30%',
      'Flipkart: ≥ 40% discount',
      'Myntra & Ajio: ≥ 50% discount (fashion standard)',
      'Price history tracked — same deal never posted twice',
    ],
    badge: 'Smart Filter',
  },
  {
    n:       '04',
    icon:    Link2,
    color:   'cyan',
    title:   'Affiliate Link Generation',
    summary: 'Every deal link is monetised automatically',
    detail: [
      'Amazon → direct tag append (instant, no browser)',
      'Flipkart / Myntra / Ajio → EarnKaro Puppeteer automation',
      'EarnKaro uses saved browser cookies (no passwords in code)',
      'Single-concurrency queue ensures session is never blocked',
    ],
    badge: 'Monetisation',
    split: true,
  },
  {
    n:       '05',
    icon:    Database,
    color:   'teal',
    title:   'Database Storage',
    summary: 'Deals saved to MongoDB with full price history',
    detail: [
      'MongoDB Atlas (cloud) — always available',
      'ASIN / product ID used as the deduplication key',
      'Price history array kept (max 50 entries per product)',
      'Posted flag prevents re-posting the same deal',
    ],
    badge: 'MongoDB',
  },
  {
    n:       '06',
    icon:    Send,
    color:   'green',
    title:   'Telegram Posting',
    summary: 'Deal sent to your channel with rich formatting',
    detail: [
      'Photo + caption with 🔥 emojis sent via Bot API',
      'Inline "Buy Now" button included in every message',
      'Platform-specific emojis (🛒 Amazon · 🟡 Flipkart · 👗 Myntra)',
      'Text-only fallback if image fails to load',
    ],
    badge: 'Telegram Bot',
  },
  {
    n:       '07',
    icon:    Clock,
    color:   'orange',
    title:   'Scheduler & Queue',
    summary: 'Cron runs every 5 minutes — fully hands-off',
    detail: [
      'node-cron fires every 5 minutes (configurable)',
      'p-queue manages concurrency: 2 scrape workers, 1 affiliate worker',
      'URL cache (30-min TTL) prevents re-scraping recent products',
      'Metrics tracked: success rate · scrape time · deals/cycle',
    ],
    badge: 'Cron',
  },
];

const stepColors = {
  blue:   { icon: 'bg-blue-100 text-blue-600',   ring: 'ring-blue-200',   num: 'text-blue-500',   bar: 'bg-blue-500'   },
  indigo: { icon: 'bg-indigo-100 text-indigo-600', ring: 'ring-indigo-200', num: 'text-indigo-500', bar: 'bg-indigo-500' },
  violet: { icon: 'bg-violet-100 text-violet-600', ring: 'ring-violet-200', num: 'text-violet-500', bar: 'bg-violet-500' },
  cyan:   { icon: 'bg-cyan-100 text-cyan-600',   ring: 'ring-cyan-200',   num: 'text-cyan-500',   bar: 'bg-cyan-500'   },
  teal:   { icon: 'bg-teal-100 text-teal-600',   ring: 'ring-teal-200',   num: 'text-teal-500',   bar: 'bg-teal-500'   },
  green:  { icon: 'bg-green-100 text-green-600', ring: 'ring-green-200',  num: 'text-green-500',  bar: 'bg-green-500'  },
  orange: { icon: 'bg-orange-100 text-orange-600', ring: 'ring-orange-200', num: 'text-orange-500', bar: 'bg-orange-500' },
};

function AffiliateSubCards() {
  return (
    <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
      <div className="rounded-xl border border-orange-100 bg-orange-50 p-4">
        <div className="flex items-center gap-2 mb-2">
          <Tag className="h-4 w-4 text-orange-600" />
          <span className="text-sm font-semibold text-orange-800">Amazon</span>
        </div>
        <p className="text-xs text-orange-700 leading-relaxed">
          Appends <code className="bg-orange-100 px-1 rounded font-mono text-orange-900">?tag=TRACKING_ID</code> to the clean product URL. Instant — no browser required.
        </p>
      </div>
      <div className="rounded-xl border border-purple-100 bg-purple-50 p-4">
        <div className="flex items-center gap-2 mb-2">
          <Cookie className="h-4 w-4 text-purple-600" />
          <span className="text-sm font-semibold text-purple-800">EarnKaro (FK / Myntra / Ajio)</span>
        </div>
        <p className="text-xs text-purple-700 leading-relaxed">
          Puppeteer loads EarnKaro using saved browser cookies, pastes the product URL into their link generator, and extracts the affiliate link automatically.
        </p>
      </div>
    </div>
  );
}

function StepCard({ step }) {
  const c = stepColors[step.color];
  const Icon = step.icon;

  return (
    <div className={`relative rounded-2xl border border-gray-200 bg-white p-6 shadow-sm ring-1 ring-inset ${c.ring} ring-opacity-40 hover:shadow-md transition-shadow`}>
      <div className={`absolute top-0 left-6 right-6 h-0.5 rounded-b-full ${c.bar}`} />
      <div className="flex items-start gap-4">
        <div className={`flex-shrink-0 rounded-xl p-2.5 ${c.icon}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className={`text-xs font-bold font-mono ${c.num}`}>STEP {step.n}</span>
            <Badge color={
              step.color === 'blue' ? 'blue' :
              step.color === 'green' ? 'green' :
              step.color === 'orange' ? 'orange' :
              step.color === 'cyan' ? 'blue' :
              step.color === 'teal' ? 'green' :
              step.color === 'violet' ? 'purple' : 'purple'
            }>{step.badge}</Badge>
          </div>
          <h3 className="text-base font-bold text-gray-900">{step.title}</h3>
          <p className="text-sm text-gray-500 mt-0.5">{step.summary}</p>

          <ul className="mt-3 space-y-1.5">
            {step.detail.map((d, i) => (
              <li key={i} className="flex items-start gap-2 text-xs text-gray-600">
                <CheckCircle2 className={`h-3.5 w-3.5 mt-0.5 flex-shrink-0 ${c.num}`} />
                {d}
              </li>
            ))}
          </ul>

          {step.split && <AffiliateSubCards />}
        </div>
      </div>
    </div>
  );
}

function SystemFlow() {
  return (
    <section>
      <SectionLabel>System Flow</SectionLabel>
      <SectionTitle>Step-by-Step Automation</SectionTitle>
      <p className="mt-2 text-sm text-gray-500 max-w-xl">
        Every 5 minutes, this pipeline runs automatically from discovery to posting.
      </p>

      <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-4">
        {STEPS.map((step) => <StepCard key={step.n} step={step} />)}
      </div>
    </section>
  );
}

// ─── Platform Breakdown ───────────────────────────────────────────────────────

const PLATFORMS = [
  {
    name:       'Amazon',
    emoji:      '🛒',
    color:      'orange',
    bg:         'from-orange-50 to-amber-50',
    border:     'border-orange-200',
    ring:       'ring-orange-200',
    textAccent: 'text-orange-700',
    affiliate:  'Direct Tag',
    difficulty: 'High anti-bot',
    diffColor:  'text-red-600 bg-red-50',
    threshold:  '≥ 40% off',
    extractor:  'axios + cheerio',
    points: ['Dedicated affiliate ID appended to URL', 'Hard bot detection — random delays needed', 'Multiple CSS selector fallbacks', 'Discount filter URL param used in category scan'],
  },
  {
    name:       'Flipkart',
    emoji:      '🟡',
    color:      'yellow',
    bg:         'from-yellow-50 to-amber-50',
    border:     'border-yellow-200',
    ring:       'ring-yellow-200',
    textAccent: 'text-yellow-700',
    affiliate:  'EarnKaro',
    difficulty: 'Medium difficulty',
    diffColor:  'text-yellow-700 bg-yellow-50',
    threshold:  '≥ 40% off',
    extractor:  'axios + cheerio',
    points: ['SSR listing pages — no browser for extraction', 'Login popup auto-dismissed during scrape', 'EarnKaro generates affiliate link', 'Discount filter applied in URL'],
  },
  {
    name:       'Myntra',
    emoji:      '👗',
    color:      'pink',
    bg:         'from-pink-50 to-rose-50',
    border:     'border-pink-200',
    ring:       'ring-pink-200',
    textAccent: 'text-pink-700',
    affiliate:  'EarnKaro',
    difficulty: 'SPA (Puppeteer)',
    diffColor:  'text-purple-700 bg-purple-50',
    threshold:  '≥ 50% off',
    extractor:  'Puppeteer',
    points: ['Full JavaScript SPA — requires Puppeteer', 'Scroll-triggered lazy loading handled', 'Higher discount threshold (fashion standard)', 'Brand + product name combined for title'],
  },
  {
    name:       'Ajio',
    emoji:      '👠',
    color:      'red',
    bg:         'from-red-50 to-orange-50',
    border:     'border-red-200',
    ring:       'ring-red-200',
    textAccent: 'text-red-700',
    affiliate:  'EarnKaro',
    difficulty: 'SPA (Puppeteer)',
    diffColor:  'text-purple-700 bg-purple-50',
    threshold:  '≥ 50% off',
    extractor:  'Puppeteer',
    points: ['React SPA — networkidle2 wait strategy', 'High-margin fashion & lifestyle deals', 'EarnKaro affiliate link generation', 'Good organic deal volume in sale periods'],
  },
];

function PlatformCard({ p }) {
  return (
    <div className={`rounded-2xl border ${p.border} bg-gradient-to-br ${p.bg} p-5 ring-1 ring-inset ${p.ring} ring-opacity-50 hover:shadow-md transition-shadow`}>
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-2xl">{p.emoji}</span>
          <h3 className="text-base font-bold text-gray-900">{p.name}</h3>
        </div>
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${p.diffColor}`}>{p.difficulty}</span>
      </div>

      <div className="grid grid-cols-2 gap-2 mb-4">
        {[
          { label: 'Affiliate', value: p.affiliate },
          { label: 'Threshold', value: p.threshold },
          { label: 'Extractor', value: p.extractor },
        ].map(({ label, value }) => (
          <div key={label} className="rounded-lg bg-white/60 border border-white/80 px-3 py-2">
            <p className="text-xs text-gray-400">{label}</p>
            <p className={`text-xs font-semibold mt-0.5 ${p.textAccent}`}>{value}</p>
          </div>
        ))}
      </div>

      <ul className="space-y-1.5">
        {p.points.map((pt, i) => (
          <li key={i} className="flex items-start gap-1.5 text-xs text-gray-600">
            <span className={`mt-1 h-1.5 w-1.5 rounded-full flex-shrink-0 ${
              p.color === 'orange' ? 'bg-orange-400' :
              p.color === 'yellow' ? 'bg-yellow-400' :
              p.color === 'pink'   ? 'bg-pink-400' : 'bg-red-400'
            }`} />
            {pt}
          </li>
        ))}
      </ul>
    </div>
  );
}

function PlatformBreakdown() {
  return (
    <section>
      <SectionLabel>Platform Details</SectionLabel>
      <SectionTitle>How Each Platform Is Handled</SectionTitle>
      <p className="mt-2 text-sm text-gray-500">Each platform has a different scraping strategy, anti-bot difficulty, and affiliate method.</p>
      <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {PLATFORMS.map((p) => <PlatformCard key={p.name} p={p} />)}
      </div>
    </section>
  );
}

// ─── Architecture Diagram ─────────────────────────────────────────────────────

const ARCH_NODES = [
  { icon: LayoutDashboard, label: 'Frontend',    sub: 'Next.js dashboard', color: 'bg-slate-100 text-slate-700 border-slate-300' },
  { icon: Server,          label: 'Backend API', sub: 'Express + Node.js', color: 'bg-blue-100 text-blue-700 border-blue-300' },
  { icon: Layers,          label: 'Queue',        sub: 'p-queue concurrency', color: 'bg-indigo-100 text-indigo-700 border-indigo-300' },
  { icon: Cpu,             label: 'Scraper',      sub: 'Puppeteer + axios', color: 'bg-violet-100 text-violet-700 border-violet-300' },
  { icon: Link2,           label: 'Affiliate',    sub: 'Tag / EarnKaro', color: 'bg-cyan-100 text-cyan-700 border-cyan-300' },
  { icon: Database,        label: 'MongoDB',      sub: 'Atlas cloud DB', color: 'bg-teal-100 text-teal-700 border-teal-300' },
  { icon: Send,            label: 'Telegram',     sub: 'Bot API posting', color: 'bg-green-100 text-green-700 border-green-300' },
];

function ArchNode({ node, isLast }) {
  const Icon = node.icon;
  return (
    <div className="flex flex-col sm:flex-row items-center gap-2">
      <div className={`flex flex-col items-center rounded-xl border-2 px-4 py-3 w-36 text-center shadow-sm ${node.color}`}>
        <Icon className="h-5 w-5 mb-1" />
        <p className="text-xs font-bold">{node.label}</p>
        <p className="text-xs opacity-70 mt-0.5 leading-snug">{node.sub}</p>
      </div>
      {!isLast && (
        <ArrowRight className="h-5 w-5 text-gray-300 flex-shrink-0 rotate-90 sm:rotate-0" />
      )}
    </div>
  );
}

function ArchDiagram() {
  return (
    <section>
      <SectionLabel>Architecture</SectionLabel>
      <SectionTitle>System Architecture</SectionTitle>
      <p className="mt-2 text-sm text-gray-500">Data flows through each layer sequentially — every deal takes this exact path.</p>

      <div className="mt-8 rounded-2xl border border-gray-200 bg-gradient-to-br from-gray-50 to-slate-100 p-6 sm:p-10 overflow-x-auto">
        <div className="flex flex-col sm:flex-row items-center justify-start sm:justify-center gap-2 flex-wrap">
          {ARCH_NODES.map((node, i) => (
            <ArchNode key={node.label} node={node} isLast={i === ARCH_NODES.length - 1} />
          ))}
        </div>

        <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            { icon: Clock, label: 'Cron Trigger', desc: 'node-cron fires every 5 minutes triggering a full crawl cycle', color: 'text-orange-600' },
            { icon: RefreshCw, label: 'Deduplication', desc: 'URL cache (TTL 30 min) + ASIN key in DB prevents duplicate processing', color: 'text-blue-600' },
            { icon: BarChart2, label: 'Metrics', desc: 'Every scrape, affiliate call, and deal is counted and timed in-memory', color: 'text-purple-600' },
          ].map(({ icon: Icon, label, desc, color }) => (
            <div key={label} className="rounded-xl border border-white bg-white/60 p-4 shadow-sm">
              <div className="flex items-center gap-2 mb-1">
                <Icon className={`h-4 w-4 ${color}`} />
                <span className="text-xs font-semibold text-gray-800">{label}</span>
              </div>
              <p className="text-xs text-gray-500 leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Automation Highlights ───────────────────────────────────────────────────

const HIGHLIGHTS = [
  { icon: Zap,          label: 'Runs 24/7',              desc: 'Cron executes every 5 minutes — no manual action needed', color: 'text-yellow-600 bg-yellow-50 border-yellow-200' },
  { icon: Shield,       label: 'Anti-Duplicate',         desc: 'ASIN-based deduplication prevents posting the same deal twice', color: 'text-blue-600 bg-blue-50 border-blue-200' },
  { icon: Filter,       label: 'Smart Filtering',        desc: 'Platform-specific discount thresholds filter out weak deals', color: 'text-purple-600 bg-purple-50 border-purple-200' },
  { icon: TrendingDown, label: 'Price History',           desc: 'Historical lows tracked — price drops also trigger posting', color: 'text-teal-600 bg-teal-50 border-teal-200' },
  { icon: Link2,        label: 'Auto Affiliate',         desc: 'Every link monetised automatically — Amazon tag or EarnKaro', color: 'text-cyan-600 bg-cyan-50 border-cyan-200' },
  { icon: MessageSquare, label: 'High-Convert Messages', desc: 'Emojis, price anchoring, and inline buttons maximise CTR', color: 'text-green-600 bg-green-50 border-green-200' },
  { icon: Globe,        label: '4 Platforms',            desc: 'Amazon · Flipkart · Myntra · Ajio covered in every cycle', color: 'text-indigo-600 bg-indigo-50 border-indigo-200' },
  { icon: BarChart2,    label: 'Metrics Tracked',        desc: 'Success rates, scrape times, and deal counts monitored in real time', color: 'text-orange-600 bg-orange-50 border-orange-200' },
];

function AutomationHighlights() {
  return (
    <section>
      <SectionLabel>Capabilities</SectionLabel>
      <SectionTitle>Automation Highlights</SectionTitle>
      <p className="mt-2 text-sm text-gray-500">Core features that make this system production-grade.</p>

      <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {HIGHLIGHTS.map(({ icon: Icon, label, desc, color }) => (
          <div key={label} className={`rounded-xl border p-4 ${color.split(' ').slice(1).join(' ')} hover:shadow-sm transition-shadow`}>
            <div className={`inline-flex items-center justify-center h-9 w-9 rounded-lg bg-white shadow-sm mb-3`}>
              <Icon className={`h-4.5 w-4.5 ${color.split(' ')[0]}`} />
            </div>
            <h4 className="text-sm font-bold text-gray-900">{label}</h4>
            <p className="text-xs text-gray-500 mt-1 leading-relaxed">{desc}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

// ─── Admin Controls ───────────────────────────────────────────────────────────

const ADMIN_CONTROLS = [
  {
    icon:  Play,
    title: 'Manual Crawl Trigger',
    desc:  'Start a full crawl cycle instantly from the dashboard without waiting for the next cron tick.',
    bullets: ['Fires the complete 7-step pipeline', 'Safe to run while cron is active — prevents double-run', 'Returns live queue stats after trigger'],
    color: 'blue',
  },
  {
    icon:  Wand2,
    title: 'Deal Generator',
    desc:  'Paste any product URL from a supported platform and generate an affiliate deal on demand.',
    bullets: ['Works with Amazon · Flipkart · Myntra · Ajio', 'Scrapes, affiliates, and saves in one click', 'Shows deal preview before Telegram posting'],
    color: 'purple',
  },
  {
    icon:  LayoutDashboard,
    title: 'Monitoring Dashboard',
    desc:  'Real-time visibility into crawler health, queue depth, and deal history.',
    bullets: ['Live queue stats (pending / active / concurrency)', 'Run history with per-category breakdown', '/health and /metrics API endpoints'],
    color: 'green',
  },
];

function AdminControls() {
  const colorMap = {
    blue:   { icon: 'bg-blue-100 text-blue-600', border: 'border-blue-100', dot: 'bg-blue-400' },
    purple: { icon: 'bg-purple-100 text-purple-600', border: 'border-purple-100', dot: 'bg-purple-400' },
    green:  { icon: 'bg-green-100 text-green-600', border: 'border-green-100', dot: 'bg-green-400' },
  };

  return (
    <section>
      <SectionLabel>Admin Panel</SectionLabel>
      <SectionTitle>Admin Controls</SectionTitle>
      <p className="mt-2 text-sm text-gray-500">The dashboard gives you full control without touching code.</p>

      <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-5">
        {ADMIN_CONTROLS.map((ctrl) => {
          const Icon = ctrl.icon;
          const c = colorMap[ctrl.color];
          return (
            <div key={ctrl.title} className={`rounded-2xl border ${c.border} bg-white p-6 shadow-sm hover:shadow-md transition-shadow`}>
              <div className={`inline-flex h-10 w-10 items-center justify-center rounded-xl mb-4 ${c.icon}`}>
                <Icon className="h-5 w-5" />
              </div>
              <h3 className="text-sm font-bold text-gray-900">{ctrl.title}</h3>
              <p className="text-xs text-gray-500 mt-1.5 leading-relaxed">{ctrl.desc}</p>
              <ul className="mt-4 space-y-2">
                {ctrl.bullets.map((b) => (
                  <li key={b} className="flex items-start gap-2 text-xs text-gray-600">
                    <span className={`mt-1 h-1.5 w-1.5 rounded-full flex-shrink-0 ${c.dot}`} />
                    {b}
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </section>
  );
}

// ─── Footer strip ─────────────────────────────────────────────────────────────

function FooterStrip() {
  return (
    <div className="rounded-2xl bg-gradient-to-r from-gray-900 to-blue-950 px-8 py-10 flex flex-col sm:flex-row items-center justify-between gap-6">
      <div>
        <p className="text-lg font-bold text-white">Ready to run</p>
        <p className="text-sm text-gray-400 mt-1">The system is fully automated. Use the dashboard to monitor and control it.</p>
      </div>
      <div className="flex flex-wrap gap-3">
        {[
          { label: '24/7 Active', icon: Zap },
          { label: '4 Platforms', icon: Globe },
          { label: 'Auto Affiliate', icon: Link2 },
          { label: 'Telegram Ready', icon: Send },
        ].map(({ label, icon: Icon }) => (
          <span key={label} className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-gray-300">
            <Icon className="h-3 w-3" /> {label}
          </span>
        ))}
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function HowItWorksPage() {
  return (
    <div className="w-full">
      <div className="mx-auto w-full max-w-7xl px-4 py-10 space-y-16">
        <Hero />
        <SystemFlow />
        <PlatformBreakdown />
        <ArchDiagram />
        <AutomationHighlights />
        <AdminControls />
        <FooterStrip />
      </div>
    </div>
  );
}
