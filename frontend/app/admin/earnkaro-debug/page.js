'use client';

import { useState, useCallback, useEffect } from 'react';
import { systemApi, earnkaroApi } from '../../../lib/api';
import {
  Play,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Clock,
  SkipForward,
  Copy,
  ExternalLink,
  AlertTriangle,
  Loader2,
  Wifi,
  WifiOff,
} from 'lucide-react';

// ── Step definitions (mirrors backend STEP_DEFS) ──────────────────────────────

const DEFAULT_STEP_DEFS = [
  { key: 'browser',       label: 'Launch Browser' },
  { key: 'cookies',       label: 'Load Cookies' },
  { key: 'loginCheck',    label: 'Check Login Status' },
  { key: 'login',         label: 'Login (if needed)' },
  { key: 'openConverter', label: 'Open Link Converter' },
  { key: 'inputUrl',      label: 'Enter Product URL' },
  { key: 'convert',       label: 'Click Convert' },
  { key: 'extract',       label: 'Extract Affiliate Link' },
];

const PLATFORM_HINTS = [
  { domain: 'flipkart.com', label: 'Flipkart', color: 'text-yellow-600 bg-yellow-50 border-yellow-200' },
  { domain: 'myntra.com',   label: 'Myntra',   color: 'text-pink-600 bg-pink-50 border-pink-200' },
  { domain: 'ajio.com',     label: 'Ajio',     color: 'text-purple-600 bg-purple-50 border-purple-200' },
  { domain: 'meesho.com',   label: 'Meesho',   color: 'text-orange-600 bg-orange-50 border-orange-200' },
];

// ── Sub-components ─────────────────────────────────────────────────────────────

function StatusIcon({ status, size = 'w-5 h-5' }) {
  switch (status) {
    case 'success': return <CheckCircle2 className={`${size} text-emerald-500`} />;
    case 'failed':  return <XCircle      className={`${size} text-red-500`} />;
    case 'running': return <Loader2      className={`${size} text-blue-500 animate-spin`} />;
    case 'skipped': return <SkipForward  className={`${size} text-slate-400`} />;
    default:        return <Clock        className={`${size} text-slate-300`} />;
  }
}

function StepRow({ def, step, index }) {
  const { label } = def;
  const { status = 'pending', error, attempts, duration } = step || {};

  const rowCls = {
    success: 'bg-emerald-50 border-emerald-200',
    failed:  'bg-red-50 border-red-200',
    running: 'bg-blue-50 border-blue-200',
    skipped: 'bg-slate-50 border-slate-200 opacity-60',
    pending: 'bg-white border-slate-200',
  }[status] || 'bg-white border-slate-200';

  const numCls = {
    success: 'bg-emerald-500 text-white',
    failed:  'bg-red-500 text-white',
    running: 'bg-blue-500 text-white',
    skipped: 'bg-slate-300 text-white',
    pending: 'bg-slate-100 text-slate-500',
  }[status] || 'bg-slate-100 text-slate-500';

  return (
    <div className={`flex items-start gap-3 p-3 rounded-xl border transition-all ${rowCls}`}>
      {/* Step number */}
      <div className={`w-6 h-6 rounded-lg text-xs font-bold flex items-center justify-center shrink-0 mt-0.5 ${numCls}`}>
        {index + 1}
      </div>

      {/* Status icon */}
      <div className="shrink-0 mt-0.5">
        <StatusIcon status={status} />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className={`text-sm font-semibold ${
            status === 'failed' ? 'text-red-800' :
            status === 'success' ? 'text-emerald-800' :
            status === 'running' ? 'text-blue-800' :
            'text-slate-600'
          }`}>
            {label}
          </p>

          {attempts > 1 && (
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700">
              {attempts} attempts
            </span>
          )}

          {duration != null && (
            <span className="text-[10px] text-slate-400 font-mono">{duration}ms</span>
          )}
        </div>

        {error && (
          <p className="text-xs text-red-600 mt-0.5 break-words">{error}</p>
        )}

        {status === 'running' && (
          <p className="text-xs text-blue-500 mt-0.5 animate-pulse">In progress…</p>
        )}
      </div>
    </div>
  );
}

function ProgressBar({ value }) {
  const pct = Math.max(0, Math.min(100, value));
  const color = pct === 100 ? 'bg-emerald-500' : pct > 0 ? 'bg-blue-500' : 'bg-slate-200';
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs text-slate-500">
        <span>Progress</span>
        <span className="font-semibold">{pct}%</span>
      </div>
      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function SessionHealthCard({ health }) {
  if (!health) return null;

  const { connected, health: level, cookieAgeHours, hasCredentials, cookiesCount, loginMethod } = health;

  const statusColor = !connected
    ? 'bg-red-50 border-red-200'
    : level === 'healthy'
    ? 'bg-emerald-50 border-emerald-200'
    : level === 'expiring'
    ? 'bg-amber-50 border-amber-200'
    : 'bg-red-50 border-red-200';

  return (
    <div className={`rounded-xl border p-4 space-y-3 ${statusColor}`}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {connected
            ? <Wifi    className="w-4 h-4 text-emerald-600" />
            : <WifiOff className="w-4 h-4 text-red-500" />
          }
          <p className="text-sm font-semibold text-slate-800">
            EarnKaro Session
          </p>
        </div>
        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
          !connected        ? 'bg-red-100 text-red-700' :
          level === 'healthy'   ? 'bg-emerald-100 text-emerald-700' :
          level === 'expiring'  ? 'bg-amber-100 text-amber-700' :
                                  'bg-red-100 text-red-700'
        }`}>
          {!connected ? 'Not Connected' : level === 'healthy' ? '✅ Healthy' : level === 'expiring' ? '⚠️ Expiring' : '❌ Expired'}
        </span>
      </div>

      <div className="grid grid-cols-3 gap-2 text-xs">
        <div className="bg-white/70 rounded-lg p-2">
          <p className="text-slate-500 mb-0.5">Cookies</p>
          <p className="font-semibold text-slate-800">{cookiesCount ?? '—'}</p>
        </div>
        <div className="bg-white/70 rounded-lg p-2">
          <p className="text-slate-500 mb-0.5">Age</p>
          <p className="font-semibold text-slate-800">{cookieAgeHours != null ? `${Math.round(cookieAgeHours * 10) / 10}h` : '—'}</p>
        </div>
        <div className="bg-white/70 rounded-lg p-2">
          <p className="text-slate-500 mb-0.5">Credentials</p>
          <p className={`font-semibold ${hasCredentials ? 'text-emerald-700' : 'text-red-600'}`}>
            {hasCredentials ? 'In memory' : 'None'}
          </p>
        </div>
      </div>

      {!connected && (
        <p className="text-xs text-red-700">
          No active session. Login from{' '}
          <a href="/admin/settings" className="underline font-semibold">Settings → EarnKaro Login</a>
          {' '}before running a test.
        </p>
      )}
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────

export default function EarnkaroDebugPage() {
  const [url,     setUrl]     = useState('');
  const [running, setRunning] = useState(false);
  const [result,  setResult]  = useState(null);
  const [health,  setHealth]  = useState(null);
  const [copied,  setCopied]  = useState(false);
  const [urlError, setUrlError] = useState(null);

  // Detect which platform the URL belongs to
  const detectedPlatform = PLATFORM_HINTS.find((p) => url.includes(p.domain));

  const fetchHealth = useCallback(async () => {
    try {
      const h = await earnkaroApi.health();
      setHealth(h);
    } catch {}
  }, []);

  useEffect(() => { fetchHealth(); }, [fetchHealth]);

  function validateUrl(val) {
    if (!val.trim()) return 'Paste a product URL to test';
    if (val.includes('amazon.in') || val.includes('amazon.com')) {
      return 'Amazon uses direct affiliate links — EarnKaro is for Flipkart / Ajio / Myntra only';
    }
    const supported = PLATFORM_HINTS.some((p) => val.includes(p.domain));
    if (!supported) {
      return 'Supported platforms: Flipkart, Myntra, Ajio, Meesho';
    }
    return null;
  }

  async function handleTest() {
    const err = validateUrl(url);
    if (err) { setUrlError(err); return; }
    setUrlError(null);
    setResult(null);
    setRunning(true);

    try {
      const res = await systemApi.testEarnkaro(url.trim());
      setResult(res);
      // Refresh session health after test
      fetchHealth();
    } catch (e) {
      setResult({ ok: false, error: e.message || 'Request failed', steps: {}, progress: 0, logs: [] });
    } finally {
      setRunning(false);
    }
  }

  function copyLink() {
    if (!result?.affiliateLink) return;
    navigator.clipboard.writeText(result.affiliateLink).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  // Merge returned steps with default definitions
  const stepDefs = result?.stepDefs || DEFAULT_STEP_DEFS;

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900">EarnKaro Debug</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Test affiliate link generation step-by-step with full pipeline visibility
        </p>
      </div>

      {/* ── Session health ── */}
      <SessionHealthCard health={health} />

      {/* ── Input + Run ── */}
      <div className="space-y-3">
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Product URL
          </label>

          {/* Platform chips */}
          <div className="flex flex-wrap gap-1.5 mb-2">
            {PLATFORM_HINTS.map(({ domain, label, color }) => (
              <button
                key={domain}
                type="button"
                onClick={() => {
                  setUrl('');
                  setResult(null);
                  setUrlError(null);
                  // Focus input
                  document.getElementById('ek-url-input')?.focus();
                }}
                className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${color} transition touch-manipulation`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="relative">
            <input
              id="ek-url-input"
              type="url"
              value={url}
              onChange={(e) => { setUrl(e.target.value); setUrlError(null); }}
              onKeyDown={(e) => e.key === 'Enter' && handleTest()}
              placeholder="https://www.flipkart.com/product/p/..."
              className={`w-full px-4 py-3 pr-24 rounded-xl border text-sm transition focus:outline-none focus:ring-2 ${
                urlError
                  ? 'border-red-300 bg-red-50 focus:ring-red-300'
                  : 'border-slate-200 bg-white focus:ring-orange-300'
              }`}
            />
            {url && (
              <button
                type="button"
                onClick={() => { setUrl(''); setResult(null); setUrlError(null); }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-semibold px-1.5 py-0.5 hover:bg-slate-100 rounded"
              >
                Clear
              </button>
            )}
          </div>

          {urlError && (
            <p className="flex items-center gap-1.5 text-xs text-red-600">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
              {urlError}
            </p>
          )}

          {detectedPlatform && !urlError && (
            <p className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full border ${detectedPlatform.color}`}>
              ✓ {detectedPlatform.label} URL detected
            </p>
          )}
        </div>

        <button
          onClick={handleTest}
          disabled={running || !url.trim()}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white text-sm font-semibold transition-all active:scale-[0.98] touch-manipulation"
        >
          {running ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Running pipeline…
            </>
          ) : (
            <>
              <Play className="w-4 h-4" />
              Run EarnKaro Test
            </>
          )}
        </button>
      </div>

      {/* ── Results section ── */}
      {(running || result) && (
        <div className="space-y-4">
          {/* Progress bar */}
          <ProgressBar value={result?.progress ?? 0} />

          {/* Step pipeline */}
          <div className="space-y-2">
            <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider">
              Pipeline Steps
            </h2>
            <div className="space-y-1.5">
              {stepDefs.map((def, i) => (
                <StepRow
                  key={def.key}
                  def={def}
                  step={result?.steps?.[def.key]}
                  index={i}
                />
              ))}
            </div>
          </div>

          {/* Error card */}
          {result && !result.ok && result.error && (
            <div className="flex items-start gap-3 p-4 rounded-xl bg-red-50 border border-red-200">
              <XCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-red-800">Pipeline Failed</p>
                <p className="text-sm text-red-700 mt-0.5">{result.error}</p>
                {result.failedStep && (
                  <p className="text-xs text-red-500 mt-1">
                    Failed at step: <span className="font-semibold">{result.failedStep}</span>
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Success result */}
          {result?.ok && result.affiliateLink && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 space-y-3">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                <p className="text-sm font-semibold text-emerald-800">
                  Affiliate Link Generated! ({result.ms ?? result.duration}ms)
                </p>
              </div>

              <div className="bg-white rounded-lg border border-emerald-200 p-3">
                <p className="text-xs text-slate-500 mb-1">Affiliate Link</p>
                <p className="text-sm font-mono text-slate-800 break-all">{result.affiliateLink}</p>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={copyLink}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white transition touch-manipulation"
                >
                  <Copy className="w-3.5 h-3.5" />
                  {copied ? 'Copied!' : 'Copy Link'}
                </button>
                <a
                  href={result.affiliateLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-white border border-emerald-300 text-emerald-700 hover:bg-emerald-50 transition"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  Open
                </a>
              </div>
            </div>
          )}

          {/* Debug logs */}
          {result?.logs?.length > 0 && (
            <details className="group">
              <summary className="cursor-pointer text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-2 list-none">
                <span className="group-open:rotate-90 transition-transform">▶</span>
                Debug Logs ({result.logs.length} entries)
              </summary>
              <div className="mt-2 bg-slate-900 rounded-xl border border-slate-700 overflow-hidden">
                <div className="px-4 py-2 bg-slate-800 flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-red-500" />
                  <span className="w-2.5 h-2.5 rounded-full bg-yellow-500" />
                  <span className="w-2.5 h-2.5 rounded-full bg-green-500" />
                  <span className="ml-2 text-xs text-slate-400 font-mono">earnkaro.debug.log</span>
                </div>
                <div
                  className="p-4 max-h-56 overflow-y-auto font-mono text-xs space-y-1 [-webkit-overflow-scrolling:touch]"
                  style={{ scrollbarWidth: 'thin' }}
                >
                  {result.logs.map((log, i) => (
                    <p
                      key={i}
                      className={`leading-relaxed break-all ${
                        log.level === 'error' ? 'text-red-400' :
                        log.level === 'warn'  ? 'text-yellow-400' :
                                                'text-emerald-400'
                      }`}
                    >
                      <span className="text-slate-500">[{log.step}]</span>{' '}
                      <span className="text-slate-400">{new Date(log.time).toLocaleTimeString('en-IN')}</span>{' '}
                      {log.message}
                    </p>
                  ))}
                </div>
              </div>
            </details>
          )}
        </div>
      )}

      {/* ── Info box ── */}
      <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 space-y-2">
        <p className="text-sm font-semibold text-blue-800">How EarnKaro integration works</p>
        <ul className="text-xs text-blue-700 space-y-1 leading-relaxed">
          <li>• Amazon → direct affiliate tag appended (no EarnKaro needed)</li>
          <li>• Flipkart / Ajio / Myntra / Meesho → routed through EarnKaro link generator</li>
          <li>• EarnKaro has no public API — Puppeteer automates the link-converter page</li>
          <li>• Cookies are stored in MongoDB and auto-refreshed every 12 hours</li>
          <li>• If session expires, auto re-login triggers using in-memory credentials</li>
        </ul>
      </div>
    </div>
  );
}
