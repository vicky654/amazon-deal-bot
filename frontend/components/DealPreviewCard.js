'use client';

import { useState, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { systemApi } from '../lib/api';

const ReelModal = dynamic(() => import('./reels/ReelModal'), { ssr: false });

// ── Deal score badge ──────────────────────────────────────────────────────────

function ScoreBadge({ score }) {
  if (score == null) return null;
  const tier =
    score >= 75 ? { label: '🔥 Hot',    cls: 'bg-red-100 text-red-700 border-red-200' } :
    score >= 55 ? { label: '✅ Good',    cls: 'bg-emerald-100 text-emerald-700 border-emerald-200' } :
    score >= 35 ? { label: '👍 Decent',  cls: 'bg-blue-100 text-blue-700 border-blue-200' } :
                  { label: '💤 Weak',    cls: 'bg-gray-100 text-gray-500 border-gray-200' };
  return (
    <span className={`inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${tier.cls}`}>
      {tier.label} <span className="opacity-70">({score})</span>
    </span>
  );
}

// ── Pipeline step row ─────────────────────────────────────────────────────────

function PipelineSteps({ deal, onRetry }) {
  const steps = deal.steps;
  if (!steps) return null;

  const PIPELINE = [
    { key: 'scrape',    label: 'Scrape',    icon: '🕷️' },
    { key: 'filter',    label: 'Filter',    icon: '🔍' },
    { key: 'affiliate', label: 'Affiliate', icon: '🔗', retryable: true },
    { key: 'telegram',  label: 'Telegram',  icon: '📨', retryable: true },
  ];

  return (
    <div className="space-y-1.5">
      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Pipeline</p>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {PIPELINE.map(({ key, label, icon, retryable }) => {
          const step = steps[key];
          const done = step?.done;
          const err  = step?.error;
          return (
            <div key={key} className={`rounded-xl border p-2.5 text-center transition-all ${
              done ? 'bg-emerald-50 border-emerald-200' :
              err  ? 'bg-red-50 border-red-200' :
                     'bg-gray-50 border-gray-200'
            }`}>
              <div className="text-base mb-1">{icon}</div>
              <p className="text-[10px] font-semibold text-gray-700">{label}</p>
              <p className={`text-[10px] font-bold mt-0.5 ${
                done ? 'text-emerald-600' : err ? 'text-red-600' : 'text-gray-400'
              }`}>
                {done ? '✓ Done' : err ? '✗ Failed' : '– Pending'}
              </p>
              {err && retryable && (
                <button
                  onClick={() => onRetry(key)}
                  className="mt-1.5 text-[9px] font-semibold px-2 py-0.5 rounded-full bg-red-100 text-red-700 hover:bg-red-200 transition-colors touch-manipulation"
                >
                  Retry
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Props:
 *   deal: object — deal data from the API
 *   onPostTelegram: () => Promise<void>
 *   telegramLoading: boolean
 */
export default function DealPreviewCard({ deal, onPostTelegram, telegramLoading }) {
  const [imgError,            setImgError]            = useState(false);
  const [copied,              setCopied]              = useState(false);
  const [showTelegramPreview, setShowTelegramPreview] = useState(true);
  const [reelOpen,            setReelOpen]            = useState(false);
  const [retrying,            setRetrying]            = useState(null);   // 'telegram' | 'affiliate' | null
  const [retryResult,         setRetryResult]         = useState(null);

  const handleRetry = useCallback(async (step) => {
    setRetrying(step);
    setRetryResult(null);
    try {
      const fn = step === 'telegram' ? systemApi.retryTelegram : systemApi.retryAffiliate;
      const res = await fn(deal._id);
      setRetryResult({ ok: res.ok, step, error: res.error });
    } catch (e) {
      setRetryResult({ ok: false, step, error: e.message });
    } finally {
      setRetrying(null);
    }
  }, [deal._id]);

  // `discount` = percentage off; `savings` = rupees saved (model has both)
  const discountPct = deal.discount ?? deal.savings;

  const formattedPrice    = deal.price         ? `₹${deal.price.toLocaleString('en-IN')}`         : 'N/A';
  const formattedOriginal = deal.originalPrice ? `₹${deal.originalPrice.toLocaleString('en-IN')}` : null;
  const rupeeSaved        = (deal.originalPrice && deal.price)
    ? (deal.originalPrice - deal.price).toLocaleString('en-IN')
    : null;

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(deal.link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Silently fail
    }
  }

  // Build Telegram message preview
  const telegramText = [
    '🔥 Amazon Deal',
    '',
    deal.title,
    '',
    formattedOriginal ? `~~${formattedOriginal}~~  →  *${formattedPrice}*` : `*${formattedPrice}*`,
    deal.savings ? `💰 Save ${deal.savings}% off` : '',
    '',
    '🛒 Buy Now:',
    deal.link,
  ].filter((line, i, arr) => !(line === '' && arr[i - 1] === '')).join('\n');

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      {/* Deal header bar */}
      <div className="bg-gradient-to-r from-orange-500 to-orange-400 px-4 sm:px-5 py-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          <span className="text-white font-semibold text-sm">Deal Preview</span>
          {discountPct != null && (
            <span className="bg-white text-orange-600 text-xs font-bold px-2 py-0.5 rounded-full">
              {discountPct}% OFF
            </span>
          )}
          <ScoreBadge score={deal.score} />
        </div>
        {deal.asin && (
          <span className="text-orange-100 text-xs font-mono truncate max-w-[120px] sm:max-w-none">
            ASIN: {deal.asin}
          </span>
        )}
      </div>

      <div className="p-4 sm:p-5">
        <div className="grid md:grid-cols-5 gap-5">
          {/* Product image */}
          <div className="md:col-span-2">
            <div className="aspect-square rounded-xl bg-slate-50 border border-slate-100 overflow-hidden flex items-center justify-center">
              {deal.image && !imgError ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={deal.image}
                  alt={deal.title}
                  onError={() => setImgError(true)}
                  className="w-full h-full object-contain p-4"
                />
              ) : (
                <div className="flex flex-col items-center gap-2 text-slate-300">
                  <svg className="w-12 h-12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <span className="text-xs">No image</span>
                </div>
              )}
            </div>
          </div>

          {/* Product details */}
          <div className="md:col-span-3 flex flex-col gap-4">
            {/* Title */}
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Product</p>
              <h2 className="text-slate-900 font-semibold text-base leading-snug line-clamp-3">
                {deal.title}
              </h2>
            </div>

            {/* Price block */}
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-2xl font-bold text-orange-500">{formattedPrice}</span>

              {formattedOriginal && (
                <span className="text-base text-slate-400 line-through">{formattedOriginal}</span>
              )}

              {discountPct != null ? (
                <span className="bg-green-100 text-green-700 text-sm font-bold px-2.5 py-0.5 rounded-full">
                  {discountPct}% off
                </span>
              ) : (
                <span className="bg-slate-100 text-slate-500 text-xs px-2 py-0.5 rounded-full">
                  No savings data
                </span>
              )}
            </div>

            {/* Stats chips */}
            <div className="flex flex-wrap gap-2">
              {rupeeSaved && (
                <div className="flex items-center gap-1.5 bg-green-50 border border-green-200 rounded-lg px-3 py-1.5">
                  <svg className="w-3.5 h-3.5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                  </svg>
                  <span className="text-xs font-semibold text-green-700">Saving ₹{rupeeSaved}</span>
                </div>
              )}

              {deal.asin && (
                <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5">
                  <svg className="w-3.5 h-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" />
                  </svg>
                  <span className="text-xs font-mono text-slate-500">{deal.asin}</span>
                </div>
              )}

              {deal.clicks > 0 && (
                <div className="flex items-center gap-1.5 bg-orange-50 border border-orange-200 rounded-lg px-3 py-1.5">
                  <svg className="w-3.5 h-3.5 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5" />
                  </svg>
                  <span className="text-xs font-semibold text-orange-700">{deal.clicks} click{deal.clicks !== 1 ? 's' : ''}</span>
                </div>
              )}
            </div>

            {/* Pipeline steps */}
            <PipelineSteps deal={deal} onRetry={handleRetry} />

            {/* Retry result banner */}
            {retryResult && (
              <div className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium border ${
                retryResult.ok
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                  : 'bg-red-50 border-red-200 text-red-700'
              }`}>
                <span>{retryResult.ok ? '✅' : '❌'}</span>
                <span>
                  {retryResult.ok
                    ? `${retryResult.step} retry succeeded`
                    : `Retry failed: ${retryResult.error}`}
                </span>
                <button onClick={() => setRetryResult(null)} className="ml-auto opacity-50 hover:opacity-80 touch-manipulation">✕</button>
              </div>
            )}

            {/* Affiliate link */}
            <div className="flex items-center gap-2">
              <div className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 overflow-hidden">
                <p className="text-xs text-slate-400 font-medium mb-0.5">Affiliate link</p>
                <p className="text-xs text-slate-600 truncate font-mono">{deal.link}</p>
              </div>
              <button
                onClick={copyLink}
                title="Copy affiliate link"
                className={`shrink-0 p-2.5 rounded-xl border transition-all
                  ${copied
                    ? 'bg-green-50 border-green-200 text-green-600'
                    : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100 hover:text-slate-700'}`}
              >
                {copied ? (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                )}
              </button>
            </div>

            {/* Telegram preview toggle */}
            <div>
              <button
                onClick={() => setShowTelegramPreview((v) => !v)}
                className="flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-700 transition-colors mb-2"
              >
                <svg
                  className={`w-3.5 h-3.5 transition-transform ${showTelegramPreview ? 'rotate-90' : ''}`}
                  fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
                Telegram message preview
              </button>

              {showTelegramPreview && (
                <div className="bg-[#17212b] rounded-xl p-4 relative">
                  {/* Telegram mock header */}
                  <div className="flex items-center gap-2 mb-3 pb-2 border-b border-white/10">
                    <div className="w-7 h-7 rounded-full bg-blue-500 flex items-center justify-center text-white text-xs font-bold">
                      D
                    </div>
                    <div>
                      <p className="text-white text-xs font-semibold leading-none">Daily Amazon Deals</p>
                      <p className="text-white/40 text-[10px]">Channel</p>
                    </div>
                  </div>
                  <pre className="text-[11px] text-[#b0bec5] whitespace-pre-wrap font-sans leading-relaxed break-all">
                    {telegramText}
                  </pre>
                </div>
              )}
            </div>

            {/* Action buttons */}
            <div className="flex flex-col gap-2">
              {/* Post to Telegram */}
              <button
                onClick={onPostTelegram}
                disabled={telegramLoading || retrying === 'telegram'}
                className={`w-full py-3 px-4 rounded-xl text-sm font-semibold text-white
                  flex items-center justify-center gap-2 transition-all duration-200 touch-manipulation
                  ${telegramLoading || retrying === 'telegram'
                    ? 'bg-slate-300 cursor-not-allowed'
                    : 'bg-blue-500 hover:bg-blue-600 shadow-md shadow-blue-500/30 hover:shadow-blue-500/40 active:scale-[0.99]'}`}
              >
                {telegramLoading ? (
                  <>
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Posting to Telegram...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
                    </svg>
                    Post to Telegram
                  </>
                )}
              </button>

              {/* Create Instagram Reel */}
              {deal._id && (
                <button
                  onClick={() => setReelOpen(true)}
                  className="w-full py-3 px-4 rounded-xl text-sm font-semibold text-white
                    flex items-center justify-center gap-2 transition-all active:scale-[0.99]"
                  style={{ background: 'linear-gradient(135deg,#7c3aed,#ec4899)', boxShadow: '0 4px 14px rgba(124,58,237,0.25)' }}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M15 10l4.553-2.069A1 1 0 0121 8.87v6.26a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  Create Instagram Reel
                </button>
              )}
            </div>

            {reelOpen && (
              <ReelModal deal={deal} onClose={() => setReelOpen(false)} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
