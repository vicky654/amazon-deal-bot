'use client';

import { useState, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { Copy, Check, ChevronDown } from 'lucide-react';
import { systemApi } from '../lib/api';

const ReelModal = dynamic(() => import('./reels/ReelModal'), { ssr: false });

function ScoreBadge({ score }) {
  if (score == null) return null;
  const { label, bg, color } =
    score >= 75 ? { label: '🔥 Hot',    bg: 'rgba(249,115,22,0.15)', color: '#fb923c' } :
    score >= 55 ? { label: '✅ Good',   bg: 'rgba(52,211,153,0.12)', color: '#34d399' } :
    score >= 35 ? { label: '👍 Decent', bg: 'rgba(96,165,250,0.12)', color: '#60a5fa' } :
                  { label: '💤 Weak',   bg: 'rgba(100,116,139,0.12)', color: '#64748b' };
  return (
    <span
      className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full"
      style={{ background: bg, color }}
    >
      {label} <span style={{ opacity: 0.6 }}>({score})</span>
    </span>
  );
}

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
    <div className="space-y-2">
      <p className="text-[11px] font-bold uppercase tracking-wider text-slate-600">Pipeline</p>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {PIPELINE.map(({ key, label, icon, retryable }) => {
          const step = steps[key];
          const done = step?.done;
          const err  = step?.error;
          return (
            <div
              key={key}
              className="rounded-2xl p-2.5 text-center"
              style={{
                background: done ? 'rgba(52,211,153,0.08)' : err ? 'rgba(239,68,68,0.08)' : 'rgba(30,41,59,0.6)',
                border: `1px solid ${done ? 'rgba(52,211,153,0.20)' : err ? 'rgba(239,68,68,0.20)' : 'rgba(255,255,255,0.06)'}`,
              }}
            >
              <div className="text-base mb-1">{icon}</div>
              <p className="text-[10px] font-semibold text-slate-400">{label}</p>
              <p
                className="text-[10px] font-bold mt-0.5"
                style={{ color: done ? '#34d399' : err ? '#f87171' : '#475569' }}
              >
                {done ? '✓ Done' : err ? '✗ Failed' : '– Pending'}
              </p>
              {err && retryable && (
                <button
                  onClick={() => onRetry(key)}
                  className="mt-1.5 text-[9px] font-semibold px-2 py-0.5 rounded-full touch-manipulation"
                  style={{ background: 'rgba(239,68,68,0.15)', color: '#f87171' }}
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

export default function DealPreviewCard({ deal, onPostTelegram, telegramLoading }) {
  const [imgError,     setImgError]     = useState(false);
  const [copied,       setCopied]       = useState(false);
  const [showPreview,  setShowPreview]  = useState(true);
  const [reelOpen,     setReelOpen]     = useState(false);
  const [retrying,     setRetrying]     = useState(null);
  const [retryResult,  setRetryResult]  = useState(null);

  const handleRetry = useCallback(async (step) => {
    setRetrying(step);
    setRetryResult(null);
    try {
      const fn  = step === 'telegram' ? systemApi.retryTelegram : systemApi.retryAffiliate;
      const res = await fn(deal._id);
      setRetryResult({ ok: res.ok, step, error: res.error });
    } catch (e) {
      setRetryResult({ ok: false, step, error: e.message });
    } finally {
      setRetrying(null);
    }
  }, [deal._id]);

  const discountPct    = deal.discount ?? deal.savings;
  const formattedPrice = deal.price         ? `₹${deal.price.toLocaleString('en-IN')}`         : 'N/A';
  const formattedMRP   = deal.originalPrice ? `₹${deal.originalPrice.toLocaleString('en-IN')}` : null;
  const rupeeSaved     = (deal.originalPrice && deal.price)
    ? (deal.originalPrice - deal.price).toLocaleString('en-IN')
    : null;

  const telegramText = [
    '🔥 Amazon Deal', '',
    deal.title, '',
    formattedMRP ? `~~${formattedMRP}~~  →  *${formattedPrice}*` : `*${formattedPrice}*`,
    deal.savings ? `💰 Save ${deal.savings}% off` : '',
    '', '🛒 Buy Now:', deal.link,
  ].filter((l, i, a) => !(l === '' && a[i - 1] === '')).join('\n');

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(deal.link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* silent */ }
  }

  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{ background: 'rgba(15,23,42,0.9)', border: '1px solid rgba(255,255,255,0.08)' }}
    >
      {/* Header bar */}
      <div
        className="px-4 sm:px-5 py-3 flex items-center justify-between gap-2"
        style={{ background: 'linear-gradient(135deg, rgba(249,115,22,0.20), rgba(234,88,12,0.10))', borderBottom: '1px solid rgba(249,115,22,0.15)' }}
      >
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-white font-bold text-sm">Deal Preview</span>
          {discountPct != null && (
            <span
              className="text-xs font-bold px-2 py-0.5 rounded-full"
              style={{ background: 'rgba(249,115,22,0.25)', color: '#fb923c', border: '1px solid rgba(249,115,22,0.30)' }}
            >
              {discountPct}% OFF
            </span>
          )}
          <ScoreBadge score={deal.score} />
        </div>
        {deal.asin && (
          <span className="text-slate-500 text-xs font-mono truncate max-w-[100px] sm:max-w-none">
            {deal.asin}
          </span>
        )}
      </div>

      <div className="p-4 sm:p-5">
        <div className="grid md:grid-cols-5 gap-5">

          {/* Product image */}
          <div className="md:col-span-2">
            <div
              className="aspect-square rounded-2xl overflow-hidden flex items-center justify-center"
              style={{ background: 'rgba(30,41,59,0.6)', border: '1px solid rgba(255,255,255,0.06)' }}
            >
              {deal.image && !imgError ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={deal.image}
                  alt={deal.title}
                  onError={() => setImgError(true)}
                  className="w-full h-full object-contain p-4"
                />
              ) : (
                <div className="flex flex-col items-center gap-2 text-slate-700">
                  <svg className="w-12 h-12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <span className="text-xs">No image</span>
                </div>
              )}
            </div>
          </div>

          {/* Details */}
          <div className="md:col-span-3 flex flex-col gap-4">

            {/* Title */}
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-600 mb-1">Product</p>
              <h2 className="text-slate-100 font-semibold text-base leading-snug line-clamp-3">{deal.title}</h2>
            </div>

            {/* Price */}
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-2xl font-bold" style={{ color: '#fb923c' }}>{formattedPrice}</span>
              {formattedMRP && (
                <span className="text-base text-slate-600 line-through">{formattedMRP}</span>
              )}
              {discountPct != null && (
                <span
                  className="text-sm font-bold px-2.5 py-0.5 rounded-full"
                  style={{ background: 'rgba(52,211,153,0.12)', color: '#34d399' }}
                >
                  {discountPct}% off
                </span>
              )}
            </div>

            {/* Chips */}
            <div className="flex flex-wrap gap-2">
              {rupeeSaved && (
                <div
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold"
                  style={{ background: 'rgba(52,211,153,0.10)', border: '1px solid rgba(52,211,153,0.18)', color: '#34d399' }}
                >
                  💰 Save ₹{rupeeSaved}
                </div>
              )}
              {deal.clicks > 0 && (
                <div
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold"
                  style={{ background: 'rgba(249,115,22,0.10)', border: '1px solid rgba(249,115,22,0.18)', color: '#fb923c' }}
                >
                  👆 {deal.clicks} click{deal.clicks !== 1 ? 's' : ''}
                </div>
              )}
            </div>

            {/* Pipeline */}
            <PipelineSteps deal={deal} onRetry={handleRetry} />

            {retryResult && (
              <div
                className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium"
                style={{
                  background: retryResult.ok ? 'rgba(52,211,153,0.10)' : 'rgba(239,68,68,0.10)',
                  border: `1px solid ${retryResult.ok ? 'rgba(52,211,153,0.20)' : 'rgba(239,68,68,0.20)'}`,
                  color: retryResult.ok ? '#34d399' : '#f87171',
                }}
              >
                <span>{retryResult.ok ? '✅' : '❌'}</span>
                <span className="flex-1">
                  {retryResult.ok ? `${retryResult.step} retry succeeded` : `Retry failed: ${retryResult.error}`}
                </span>
                <button onClick={() => setRetryResult(null)} style={{ opacity: 0.5 }}>✕</button>
              </div>
            )}

            {/* Affiliate link */}
            <div className="flex items-center gap-2">
              <div
                className="flex-1 px-3 py-2.5 rounded-xl overflow-hidden"
                style={{ background: 'rgba(30,41,59,0.8)', border: '1px solid rgba(255,255,255,0.06)' }}
              >
                <p className="text-[10px] text-slate-600 font-medium mb-0.5">Affiliate link</p>
                <p className="text-xs text-slate-400 truncate font-mono">{deal.link}</p>
              </div>
              <button
                onClick={copyLink}
                title="Copy link"
                className="shrink-0 p-2.5 rounded-xl transition-all touch-manipulation active:scale-95"
                style={copied
                  ? { background: 'rgba(52,211,153,0.15)', border: '1px solid rgba(52,211,153,0.25)', color: '#34d399' }
                  : { background: 'rgba(30,41,59,0.8)', border: '1px solid rgba(255,255,255,0.06)', color: '#64748b' }
                }
              >
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>

            {/* Telegram preview toggle */}
            <div>
              <button
                onClick={() => setShowPreview((v) => !v)}
                className="flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-slate-400 transition-colors mb-2 touch-manipulation"
              >
                <ChevronDown
                  className="w-3.5 h-3.5 transition-transform"
                  style={{ transform: showPreview ? 'rotate(180deg)' : 'none' }}
                />
                Telegram preview
              </button>
              {showPreview && (
                <div
                  className="rounded-2xl p-4"
                  style={{ background: '#17212b', border: '1px solid rgba(255,255,255,0.08)' }}
                >
                  <div
                    className="flex items-center gap-2 mb-3 pb-2"
                    style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}
                  >
                    <div className="w-7 h-7 rounded-full bg-blue-500 flex items-center justify-center text-white text-xs font-bold shrink-0">D</div>
                    <div>
                      <p className="text-white text-xs font-semibold leading-none">Daily Amazon Deals</p>
                      <p className="text-[10px]" style={{ color: 'rgba(255,255,255,0.3)' }}>Channel</p>
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
              <button
                onClick={onPostTelegram}
                disabled={telegramLoading || retrying === 'telegram'}
                className="w-full py-3 px-4 rounded-2xl text-sm font-semibold text-white flex items-center justify-center gap-2 transition-all touch-manipulation active:scale-[0.98]"
                style={telegramLoading || retrying === 'telegram'
                  ? { background: 'rgba(71,85,105,0.5)', cursor: 'not-allowed' }
                  : { background: 'linear-gradient(135deg,#3b82f6,#2563eb)', boxShadow: '0 4px 16px rgba(59,130,246,0.30)' }
                }
              >
                {telegramLoading ? (
                  <>
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Posting…
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

              {deal._id && (
                <button
                  onClick={() => setReelOpen(true)}
                  className="w-full py-3 px-4 rounded-2xl text-sm font-semibold text-white flex items-center justify-center gap-2 transition-all active:scale-[0.98] touch-manipulation"
                  style={{ background: 'linear-gradient(135deg,#7c3aed,#ec4899)', boxShadow: '0 4px 16px rgba(124,58,237,0.25)' }}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M15 10l4.553-2.069A1 1 0 0121 8.87v6.26a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  Create Instagram Reel
                </button>
              )}
            </div>

            {reelOpen && <ReelModal deal={deal} onClose={() => setReelOpen(false)} />}
          </div>
        </div>
      </div>
    </div>
  );
}
