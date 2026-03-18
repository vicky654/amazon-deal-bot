'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';

const ReelModal = dynamic(() => import('./reels/ReelModal'), { ssr: false });

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
      <div className="bg-gradient-to-r from-orange-500 to-orange-400 px-5 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-white font-semibold text-sm">Deal Preview</span>
          {discountPct != null && (
            <span className="bg-white text-orange-600 text-xs font-bold px-2 py-0.5 rounded-full">
              {discountPct}% OFF
            </span>
          )}
        </div>
        {deal.asin && (
          <span className="text-orange-100 text-xs font-mono">ASIN: {deal.asin}</span>
        )}
      </div>

      <div className="p-5">
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
            </div>

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
                disabled={telegramLoading}
                className={`w-full py-3 px-4 rounded-xl text-sm font-semibold text-white
                  flex items-center justify-center gap-2 transition-all duration-200
                  ${telegramLoading
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
