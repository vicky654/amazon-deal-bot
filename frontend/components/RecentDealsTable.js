'use client';

import { useState } from 'react';

function timeAgo(dateString) {
  const diff = Date.now() - new Date(dateString).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function DealRow({ deal }) {
  const [imgError, setImgError] = useState(false);
  const [copied, setCopied] = useState(false);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(deal.link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* silent */ }
  }

  const dealPrice = deal.price ? `₹${deal.price.toLocaleString('en-IN')}` : '—';
  const originalPrice = deal.originalPrice ? `₹${deal.originalPrice.toLocaleString('en-IN')}` : null;

  return (
    <div className="flex items-center gap-4 p-4 rounded-xl hover:bg-slate-50 border border-transparent hover:border-slate-100 transition-all group">
      {/* Thumbnail */}
      <div className="w-14 h-14 rounded-lg bg-slate-100 border border-slate-200 overflow-hidden flex items-center justify-center shrink-0">
        {deal.image && !imgError ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={deal.image}
            alt={deal.title}
            onError={() => setImgError(true)}
            className="w-full h-full object-contain p-1.5"
          />
        ) : (
          <svg className="w-6 h-6 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        )}
      </div>

      {/* Title */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-slate-800 line-clamp-2 leading-snug mb-1">
          {deal.title}
        </p>
        <div className="flex items-center gap-2 flex-wrap">
          {deal.asin && (
            <span className="text-xs font-mono text-slate-400">{deal.asin}</span>
          )}
          {deal.posted && (
            <span className="inline-flex items-center gap-1 text-xs text-blue-600 bg-blue-50 border border-blue-100 rounded-full px-2 py-0.5">
              <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
                <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
              </svg>
              Posted
            </span>
          )}
        </div>
      </div>

      {/* Price column */}
      <div className="text-right shrink-0 hidden sm:block">
        <p className="text-sm font-bold text-orange-500">{dealPrice}</p>
        {originalPrice && (
          <p className="text-xs text-slate-400 line-through">{originalPrice}</p>
        )}
      </div>

      {/* Savings badge */}
      <div className="shrink-0 hidden md:block">
        {deal.savings != null ? (
          <span className="bg-green-100 text-green-700 text-xs font-bold px-2.5 py-1 rounded-full">
            {deal.savings}%
          </span>
        ) : (
          <span className="bg-slate-100 text-slate-400 text-xs px-2.5 py-1 rounded-full">—</span>
        )}
      </div>

      {/* Time */}
      <div className="shrink-0 hidden lg:block">
        <p className="text-xs text-slate-400">{timeAgo(deal.createdAt)}</p>
      </div>

      {/* Copy button */}
      <button
        onClick={copyLink}
        title="Copy affiliate link"
        className={`shrink-0 p-2 rounded-lg border transition-all opacity-0 group-hover:opacity-100
          ${copied
            ? 'bg-green-50 border-green-200 text-green-600'
            : 'bg-white border-slate-200 text-slate-400 hover:text-slate-700 hover:border-slate-300'}`}
      >
        {copied ? (
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        ) : (
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
        )}
      </button>
    </div>
  );
}

/**
 * Props:
 *   deals: array
 *   loading: boolean
 *   onRefresh: () => void
 */
export default function RecentDealsTable({ deals, loading, onRefresh }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
        <div>
          <h2 className="text-base font-semibold text-slate-900">Recent Deals</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            {deals.length} deal{deals.length !== 1 ? 's' : ''} saved
          </p>
        </div>
        <button
          onClick={onRefresh}
          disabled={loading}
          className="flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-800
            bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg px-3 py-2 transition-all
            disabled:opacity-50"
        >
          <svg
            className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Refresh
        </button>
      </div>

      {/* Column labels */}
      {deals.length > 0 && (
        <div className="flex items-center gap-4 px-4 py-2 bg-slate-50 border-b border-slate-100">
          <div className="w-14 shrink-0" />
          <p className="flex-1 text-xs font-semibold text-slate-400 uppercase tracking-wider">Product</p>
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider hidden sm:block w-20 text-right">Price</p>
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider hidden md:block w-14 text-center">Off</p>
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider hidden lg:block w-16">When</p>
          <div className="w-8 shrink-0" />
        </div>
      )}

      {/* Loading state */}
      {loading && deals.length === 0 && (
        <div className="px-4 py-8 flex flex-col items-center gap-3">
          <svg className="w-6 h-6 text-orange-400 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <p className="text-sm text-slate-400">Loading deals...</p>
        </div>
      )}

      {/* Empty state */}
      {!loading && deals.length === 0 && (
        <div className="px-4 py-12 flex flex-col items-center gap-3 text-center">
          <div className="w-14 h-14 rounded-full bg-slate-100 flex items-center justify-center text-2xl">
            📦
          </div>
          <div>
            <p className="text-sm font-medium text-slate-600">No deals yet</p>
            <p className="text-xs text-slate-400 mt-1">
              Generated deals will appear here automatically.
            </p>
          </div>
        </div>
      )}

      {/* Deals list */}
      {deals.length > 0 && (
        <div className="divide-y divide-slate-50 px-1">
          {deals.map((deal) => (
            <DealRow key={deal._id} deal={deal} />
          ))}
        </div>
      )}
    </div>
  );
}
