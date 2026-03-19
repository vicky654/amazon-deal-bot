'use client';

import { useState, useEffect, useRef } from 'react';

// ── URL classification ─────────────────────────────────────────────────────────

const SHORT_DOMAINS  = ['amzn.to', 'amzn.in', 'bit.ly', 'tinyurl.com', 'goo.gl', 't.co', 'rb.gy'];
const AMAZON_DOMAINS = ['amazon.in', 'amazon.com', 'amazon.co.uk', 'amazon.de'];

function classify(raw) {
  if (!raw?.trim()) return 'empty';
  try {
    const host = new URL(raw.trim()).hostname.replace(/^www\./, '');
    if (SHORT_DOMAINS.some((d)  => host === d))                 return 'short';
    if (AMAZON_DOMAINS.some((d) => host === d || host.endsWith('.' + d))) return 'amazon';
    return 'other';
  } catch {
    // Not a valid URL yet (user still typing)
    if (raw.includes('amzn.to') || raw.includes('amzn.in')) return 'short';
    if (raw.includes('amazon'))                               return 'amazon';
    return 'other';
  }
}

function validate(value) {
  if (!value.trim()) return 'Paste a product URL to get started';

  const type = classify(value);

  if (type === 'short')  return '';   // ✅ short links are resolved by backend
  if (type === 'amazon') return '';   // ✅ full Amazon link

  // Full Amazon URL — check it's a product page, not search
  if (type === 'amazon') {
    if (!value.includes('/dp/') && !value.includes('/gp/product/')) {
      return 'Looks like a search or category page — paste a specific product URL';
    }
  }

  return 'URL must be from amazon.in, amazon.com, or a short link (amzn.to)';
}

// ── Loading steps ─────────────────────────────────────────────────────────────

const STEPS = [
  { id: 'resolve',   label: 'Resolving URL…',      icon: '🔗' },
  { id: 'scrape',    label: 'Fetching product…',    icon: '🕷️' },
  { id: 'affiliate', label: 'Generating affiliate…', icon: '🔄' },
  { id: 'saving',    label: 'Saving deal…',          icon: '💾' },
];

// Cycle through steps while loading — purely cosmetic, gives user
// live feedback without needing real server-sent events.
function useLoadingSteps(loading) {
  const [stepIdx, setStepIdx] = useState(0);
  const ref = useRef(null);

  useEffect(() => {
    if (!loading) { setStepIdx(0); return; }
    ref.current = setInterval(() => {
      setStepIdx((i) => Math.min(i + 1, STEPS.length - 1));
    }, 3500);
    return () => clearInterval(ref.current);
  }, [loading]);

  return loading ? STEPS[stepIdx] : null;
}

// ── Sub-components ────────────────────────────────────────────────────────────

function LinkIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
    </svg>
  );
}

function PasteIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
    </svg>
  );
}

function Spinner({ size = 16 }) {
  return (
    <svg width={size} height={size} className="animate-spin" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

// ── ShortLinkBadge ─────────────────────────────────────────────────────────────

function ShortLinkBadge({ url }) {
  const type = classify(url);
  if (type !== 'short') return null;

  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-blue-50 border border-blue-200 text-xs text-blue-700">
      <svg className="h-3.5 w-3.5 shrink-0 text-blue-500 animate-pulse" fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd"
          d="M12.586 4.586a2 2 0 112.828 2.828l-3 3a2 2 0 01-2.828 0 1 1 0 00-1.414 1.414 4 4 0 005.656 0l3-3a4 4 0 00-5.656-5.656l-1.5 1.5a1 1 0 101.414 1.414l1.5-1.5zm-5 5a2 2 0 012.828 0 1 1 0 101.414-1.414 4 4 0 00-5.656 0l-3 3a4 4 0 105.656 5.656l1.5-1.5a1 1 0 10-1.414-1.414l-1.5 1.5a2 2 0 11-2.828-2.828l3-3z"
          clipRule="evenodd" />
      </svg>
      <span>
        <strong>Short link detected</strong> — will resolve to full product URL automatically
      </span>
    </div>
  );
}

// ── LoadingProgress ────────────────────────────────────────────────────────────

function LoadingProgress({ step }) {
  if (!step) return null;

  return (
    <div className="rounded-xl bg-orange-50 border border-orange-200 overflow-hidden">
      {/* Progress bar */}
      <div className="h-1 bg-orange-100">
        <div
          className="h-full bg-orange-400 transition-all duration-[3500ms] ease-in-out"
          style={{ width: step.id === 'saving' ? '90%' : step.id === 'affiliate' ? '65%' : step.id === 'scrape' ? '40%' : '15%' }}
        />
      </div>

      <div className="px-4 py-3 flex items-center gap-3">
        <div className="text-lg shrink-0">{step.icon}</div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-orange-800">{step.label}</p>
          <p className="text-xs text-orange-600 mt-0.5">This may take 15–30 seconds on first run</p>
        </div>
        <Spinner size={18} />
      </div>

      {/* Step dots */}
      <div className="px-4 pb-3 flex items-center gap-2">
        {STEPS.map((s) => (
          <div
            key={s.id}
            className={`flex items-center gap-1.5 text-[10px] font-medium transition-all ${
              s.id === step.id
                ? 'text-orange-700'
                : STEPS.findIndex((x) => x.id === s.id) < STEPS.findIndex((x) => x.id === step.id)
                ? 'text-emerald-600'
                : 'text-orange-300'
            }`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${
              s.id === step.id
                ? 'bg-orange-500 animate-pulse'
                : STEPS.findIndex((x) => x.id === s.id) < STEPS.findIndex((x) => x.id === step.id)
                ? 'bg-emerald-500'
                : 'bg-orange-200'
            }`} />
            <span className="hidden sm:inline">{s.label.replace('…', '')}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

/**
 * Props:
 *   onGenerate: (url: string) => Promise<void>
 *   loading: boolean
 *   error: string | null   — error from parent (e.g. scrape failed)
 */
export default function DealGeneratorForm({ onGenerate, loading, error: parentError }) {
  const [url,             setUrl]             = useState('');
  const [validationError, setValidationError] = useState('');
  const [pasteFeedback,   setPasteFeedback]   = useState(false);
  const inputRef = useRef(null);

  const currentStep = useLoadingSteps(loading);
  const urlType     = classify(url);
  const displayError = validationError || parentError || '';

  async function handleSubmit(e) {
    e.preventDefault();
    const err = validate(url);
    if (err) { setValidationError(err); return; }
    setValidationError('');
    await onGenerate(url.trim());
  }

  async function handlePaste() {
    try {
      const text = await navigator.clipboard.readText();
      if (text?.trim()) {
        setUrl(text.trim());
        setValidationError('');
        setPasteFeedback(true);
        setTimeout(() => setPasteFeedback(false), 1500);
        // Auto-focus input after paste
        setTimeout(() => inputRef.current?.focus(), 50);
      }
    } catch {
      // Clipboard API blocked (e.g. Firefox) — silently ignore, user pastes manually
    }
  }

  function handleChange(e) {
    setUrl(e.target.value);
    if (validationError) setValidationError('');
  }

  function handleClear() {
    setUrl('');
    setValidationError('');
    inputRef.current?.focus();
  }

  const hasUrl    = url.trim().length > 0;
  const isInvalid = !!displayError;

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      {/* ── Header ── */}
      <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-orange-50 border border-orange-100 flex items-center justify-center text-lg shrink-0">
          🛒
        </div>
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-slate-900">Generate Deal</h2>
          <p className="text-sm text-slate-500 mt-0.5 truncate">
            Amazon URL or short link (amzn.to) — we handle the rest
          </p>
        </div>
      </div>

      {/* ── Form body ── */}
      <form onSubmit={handleSubmit} noValidate className="p-4 sm:p-5 space-y-3">

        {/* ── Supported formats chips ── */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {['amazon.in', 'amazon.com', 'amzn.to', 'bit.ly'].map((d) => (
            <span
              key={d}
              className={`text-[10px] font-mono font-medium px-2 py-0.5 rounded-full border transition-colors ${
                url && classify(url) === 'short' && (d === 'amzn.to' || d === 'bit.ly')
                  ? 'bg-blue-100 border-blue-300 text-blue-700'
                  : url && classify(url) === 'amazon' && (d === 'amazon.in' || d === 'amazon.com')
                  ? 'bg-orange-100 border-orange-300 text-orange-700'
                  : 'bg-gray-100 border-gray-200 text-gray-400'
              }`}
            >
              {d}
            </span>
          ))}
        </div>

        {/* ── URL input row ── */}
        <div className="space-y-2">
          <div className="flex gap-2">
            {/* Input */}
            <div className="relative flex-1">
              <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                <LinkIcon />
              </div>
              <input
                ref={inputRef}
                type="url"
                inputMode="url"
                value={url}
                onChange={handleChange}
                placeholder="https://amzn.to/4snfmzE or amazon.in/dp/..."
                disabled={loading}
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="none"
                spellCheck={false}
                className={`w-full pl-9 ${hasUrl ? 'pr-8' : 'pr-3'} py-3 text-sm rounded-xl border bg-slate-50 text-slate-900
                  placeholder-slate-400 focus:outline-none focus:ring-2 focus:bg-white transition-all
                  disabled:opacity-50 disabled:cursor-not-allowed
                  ${isInvalid
                    ? 'border-red-300 focus:ring-red-200 bg-red-50/30'
                    : urlType === 'short'
                    ? 'border-blue-300 focus:ring-blue-200'
                    : urlType === 'amazon'
                    ? 'border-orange-300 focus:ring-orange-200'
                    : 'border-slate-200 focus:ring-orange-200 focus:border-orange-400'}`}
              />
              {/* Clear button */}
              {hasUrl && !loading && (
                <button
                  type="button"
                  onClick={handleClear}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors touch-manipulation"
                  aria-label="Clear"
                >
                  <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </button>
              )}
            </div>

            {/* Paste button */}
            <button
              type="button"
              onClick={handlePaste}
              disabled={loading}
              title="Paste from clipboard"
              className={`px-3.5 py-3 rounded-xl border text-sm font-medium transition-all shrink-0 touch-manipulation
                ${pasteFeedback
                  ? 'bg-emerald-50 border-emerald-300 text-emerald-700'
                  : 'border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-500 hover:text-slate-700'}
                disabled:opacity-50`}
            >
              {pasteFeedback ? (
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              ) : (
                <PasteIcon />
              )}
            </button>
          </div>

          {/* Short link detection banner */}
          {!loading && <ShortLinkBadge url={url} />}

          {/* Validation / parent error */}
          {displayError && (
            <div className="flex items-start gap-2 px-3 py-2 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700">
              <svg className="w-3.5 h-3.5 shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              <span>{displayError}</span>
            </div>
          )}
        </div>

        {/* ── Live step progress (while loading) ── */}
        <LoadingProgress step={currentStep} />

        {/* ── Generate button ── */}
        <button
          type="submit"
          disabled={loading || !hasUrl}
          className={`w-full py-3.5 px-6 rounded-xl text-sm font-bold text-white
            transition-all duration-200 flex items-center justify-center gap-2 touch-manipulation
            ${loading || !hasUrl
              ? 'bg-slate-300 cursor-not-allowed'
              : 'bg-orange-500 hover:bg-orange-600 active:scale-[0.99] shadow-lg shadow-orange-500/30'}`}
        >
          {loading ? (
            <><Spinner size={16} /> {currentStep?.label || 'Processing…'}</>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              Generate Deal
            </>
          )}
        </button>
      </form>

      {/* ── Footer hint ── */}
      <div className="px-5 py-3 border-t border-slate-100 bg-slate-50 flex items-center gap-4 flex-wrap">
        <span className="text-[11px] text-slate-400">
          Supports: <span className="font-mono">amazon.in · amazon.com · amzn.to · bit.ly</span>
        </span>
        <span className="text-[11px] text-slate-400 ml-auto hidden sm:block">
          ASIN extracted automatically
        </span>
      </div>
    </div>
  );
}
