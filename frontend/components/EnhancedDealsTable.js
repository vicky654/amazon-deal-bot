'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { dealsApi, ApiError } from '../lib/api';
import PlatformBadge from './PlatformBadge';
import ReelButton from './reels/ReelButton';

const PLATFORMS = ['all', 'amazon', 'flipkart', 'myntra', 'ajio'];

// ── Helpers ───────────────────────────────────────────────────────────────────

function timeAgo(dateStr) {
  if (!dateStr) return '—';
  const diff = Math.floor((Date.now() - new Date(dateStr)) / 1000);
  if (diff < 60)    return `${diff}s ago`;
  if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function fmtPrice(n) {
  return n ? `₹${Number(n).toLocaleString('en-IN')}` : null;
}

// ── AffiliateBadge ────────────────────────────────────────────────────────────

function AffiliateBadge({ link, fullWidth = false }) {
  const [copied, setCopied] = useState(false);
  if (!link) return <span className="text-xs text-gray-400">—</span>;

  const copy = async () => {
    await navigator.clipboard.writeText(link).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1400);
  };

  return (
    <button
      onClick={copy}
      title={link}
      className={`inline-flex items-center justify-center gap-1.5 text-xs px-3 py-1.5 rounded-full border font-medium transition-all active:scale-95
        ${copied
          ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
          : 'bg-blue-50 border-blue-200 text-blue-600 hover:bg-blue-100'}
        ${fullWidth ? 'w-full' : ''}
      `}
    >
      {copied ? (
        <>
          <svg className="h-3 w-3 shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/>
          </svg>
          Copied!
        </>
      ) : (
        <>
          <svg className="h-3 w-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/>
          </svg>
          Affiliate
        </>
      )}
    </button>
  );
}

// ── ProductImage ──────────────────────────────────────────────────────────────

function ProductImage({ src, alt, className }) {
  return src ? (
    <img
      src={src}
      alt={alt || ''}
      loading="lazy"
      className={`object-contain bg-gray-50 ${className}`}
    />
  ) : (
    <div className={`bg-gray-100 flex items-center justify-center ${className}`}>
      <svg className="h-5 w-5 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
          d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/>
      </svg>
    </div>
  );
}

// ── DealCard  (mobile ≤ sm) ───────────────────────────────────────────────────

function DealCard({ deal, isLatest }) {
  const affiliateLink = deal.affiliateLink || deal.link;

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden active:scale-[0.99] transition-transform">
      {/* Top row: image + title */}
      <div className="flex items-start gap-3 p-4">
        <ProductImage
          src={deal.image}
          alt={deal.title}
          className="h-16 w-16 rounded-xl border border-gray-100 shrink-0"
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <PlatformBadge platform={deal.platform} size="xs" />
            {isLatest && (
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-200">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
                Latest
              </span>
            )}
          </div>
          <p className="text-sm font-semibold text-gray-900 leading-snug line-clamp-2">
            {deal.title}
          </p>
          {deal.asin && (
            <p className="text-[10px] text-gray-400 font-mono mt-0.5 truncate">{deal.asin}</p>
          )}
        </div>
      </div>

      {/* Price row */}
      <div className="px-4 pb-3 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-baseline gap-2 flex-wrap">
          <span className="text-lg font-bold text-emerald-700">
            {fmtPrice(deal.price) || 'Check Price'}
          </span>
          {deal.originalPrice && (
            <span className="text-xs text-gray-400 line-through">
              {fmtPrice(deal.originalPrice)}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {deal.discount && (
            <span className="bg-red-100 text-red-700 text-xs font-bold px-2.5 py-1 rounded-full">
              {deal.discount}% off
            </span>
          )}
          {/* Posted status */}
          {deal.posted ? (
            <span className="inline-flex items-center gap-1 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2 py-0.5">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              Posted
            </span>
          ) : (
            <span className="text-xs text-gray-400 bg-gray-100 rounded-full px-2 py-0.5">
              Pending
            </span>
          )}
        </div>
      </div>

      {/* Divider */}
      <div className="h-px bg-gray-100 mx-4" />

      {/* Footer: time + actions */}
      <div className="p-3 flex flex-col gap-2">
        <div className="flex items-center justify-between text-xs text-gray-400 px-1">
          <span>{timeAgo(deal.createdAt)}</span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <AffiliateBadge link={affiliateLink} fullWidth />
          {/* Full-width reel button */}
          <div className="[&>button]:w-full [&>button]:justify-center [&>button]:py-1.5 [&>button]:rounded-xl [&>button]:text-xs">
            <ReelButton deal={deal} />
          </div>
        </div>
      </div>
    </div>
  );
}

// ── DealRow  (desktop table) ──────────────────────────────────────────────────

function DealRow({ deal, isLatest }) {
  return (
    <tr className="group hover:bg-slate-50/80 transition-colors border-b border-gray-100 last:border-0">
      {/* Sticky product column */}
      <td className="sticky left-0 z-[1] bg-white group-hover:bg-slate-50/80 transition-colors px-4 py-3 min-w-[220px] max-w-[260px]">
        <div className="flex items-center gap-3">
          <ProductImage
            src={deal.image}
            alt={deal.title}
            className="h-11 w-11 rounded-lg border border-gray-100 shrink-0"
          />
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
              <p className="text-sm font-medium text-gray-900 line-clamp-1">{deal.title}</p>
              {isLatest && (
                <span className="inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-200 shrink-0 whitespace-nowrap">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" /> Latest
                </span>
              )}
            </div>
            {deal.asin && (
              <p className="text-[10px] text-gray-400 font-mono truncate">{deal.asin}</p>
            )}
          </div>
        </div>
      </td>

      <td className="px-4 py-3 whitespace-nowrap">
        <PlatformBadge platform={deal.platform} size="xs" />
      </td>

      <td className="px-4 py-3 text-right whitespace-nowrap">
        <p className="text-sm font-bold text-emerald-700">{fmtPrice(deal.price) || '—'}</p>
        {deal.originalPrice && (
          <p className="text-xs text-gray-400 line-through">{fmtPrice(deal.originalPrice)}</p>
        )}
      </td>

      <td className="px-4 py-3 text-center whitespace-nowrap">
        {deal.discount
          ? <span className="inline-block bg-red-100 text-red-700 text-xs font-bold px-2 py-0.5 rounded-full">{deal.discount}% off</span>
          : <span className="text-gray-300 text-xs">—</span>
        }
      </td>

      <td className="px-4 py-3 whitespace-nowrap">
        <AffiliateBadge link={deal.affiliateLink || deal.link} />
      </td>

      <td className="px-4 py-3 text-center whitespace-nowrap">
        {deal.posted ? (
          <span className="inline-flex items-center gap-1 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2 py-0.5">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Posted
          </span>
        ) : (
          <span className="text-xs text-gray-400 bg-gray-100 rounded-full px-2 py-0.5">Pending</span>
        )}
      </td>

      <td className="px-4 py-3 text-right text-xs text-gray-400 whitespace-nowrap">
        {timeAgo(deal.createdAt)}
      </td>

      <td className="px-4 py-3 text-center whitespace-nowrap">
        <ReelButton deal={deal} />
      </td>
    </tr>
  );
}

// ── Skeleton loaders ──────────────────────────────────────────────────────────

function CardSkeleton() {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3 animate-pulse">
      <div className="flex gap-3">
        <div className="h-16 w-16 rounded-xl bg-gray-200 shrink-0" />
        <div className="flex-1 space-y-2 pt-1">
          <div className="h-3 bg-gray-200 rounded w-1/3" />
          <div className="h-4 bg-gray-200 rounded w-full" />
          <div className="h-3 bg-gray-200 rounded w-2/3" />
        </div>
      </div>
      <div className="flex gap-2">
        <div className="h-8 bg-gray-200 rounded-full flex-1" />
        <div className="h-8 bg-gray-200 rounded-full flex-1" />
      </div>
    </div>
  );
}

function RowSkeleton() {
  return (
    <tr className="animate-pulse border-b border-gray-100">
      {[220, 80, 90, 80, 90, 80, 70, 80].map((w, i) => (
        <td key={i} className="px-4 py-3">
          <div className="h-4 bg-gray-200 rounded" style={{ width: `${w * 0.6}px` }} />
        </td>
      ))}
    </tr>
  );
}

// ── ScrollHint ────────────────────────────────────────────────────────────────

function ScrollHint({ show }) {
  if (!show) return null;
  return (
    <div className="pointer-events-none absolute inset-y-0 right-0 w-14 bg-gradient-to-l from-white via-white/60 to-transparent z-10 flex items-center justify-end pr-2">
      <span className="text-gray-400 text-xs font-medium select-none flex items-center gap-0.5">
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/>
        </svg>
      </span>
    </div>
  );
}

// ── Filters bar ───────────────────────────────────────────────────────────────

function FiltersBar({ platform, setPlatform, postedFilter, setPostedFilter, loading, onRefresh, count }) {
  return (
    <div className="px-4 sm:px-5 py-3 sm:py-4 border-b border-gray-200 space-y-3">
      {/* Title row */}
      <div className="flex items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-gray-900">Recent Deals</h2>
          <p className="text-xs text-gray-500 mt-0.5 hidden sm:block">
            Showing latest {count} deals
            <span className="ml-1.5 inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-600 border border-blue-100">
              auto-cleaned · max 20
            </span>
          </p>
        </div>
        {/* Mobile: refresh icon only */}
        <button
          onClick={onRefresh}
          className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 active:bg-gray-200 transition-colors touch-manipulation"
          aria-label="Refresh"
        >
          <svg className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
          </svg>
        </button>
      </div>

      {/* Filters row — horizontally scrollable on mobile */}
      <div className="flex items-center gap-2 overflow-x-auto pb-0.5 [-webkit-overflow-scrolling:touch] scrollbar-none">
        <select
          value={platform}
          onChange={(e) => setPlatform(e.target.value)}
          className="text-xs border border-gray-300 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white shrink-0 touch-manipulation"
        >
          {PLATFORMS.map((p) => (
            <option key={p} value={p}>
              {p === 'all' ? 'All Platforms' : p.charAt(0).toUpperCase() + p.slice(1)}
            </option>
          ))}
        </select>

        <select
          value={postedFilter}
          onChange={(e) => setPostedFilter(e.target.value)}
          className="text-xs border border-gray-300 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white shrink-0 touch-manipulation"
        >
          <option value="all">All Status</option>
          <option value="posted">Posted</option>
          <option value="pending">Pending</option>
        </select>

        {/* Refresh button — visible on sm+ */}
        <button
          onClick={onRefresh}
          className="hidden sm:flex text-xs text-gray-600 border border-gray-300 px-2.5 py-1.5 rounded-lg hover:bg-gray-50 items-center gap-1.5 transition-colors shrink-0"
        >
          <svg className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
          </svg>
          Refresh
        </button>
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function EnhancedDealsTable() {
  const [deals,        setDeals]        = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState('');
  const [platform,     setPlatform]     = useState('all');
  const [postedFilter, setPostedFilter] = useState('all');
  const [canScrollRight, setCanScrollRight] = useState(false);
  const tableScrollRef = useRef(null);

  const fetchDeals = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = {};
      if (platform !== 'all')          params.platform = platform;
      if (postedFilter === 'posted')   params.posted   = true;
      if (postedFilter === 'pending')  params.posted   = false;

      const data = await dealsApi.list(params);
      setDeals(data.deals || []);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load deals');
    } finally {
      setLoading(false);
    }
  }, [platform, postedFilter]);

  useEffect(() => { fetchDeals(); }, [fetchDeals]);

  // Track whether table has horizontal scroll room left
  useEffect(() => {
    const el = tableScrollRef.current;
    if (!el) return;

    const check = () => setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 4);
    check();
    el.addEventListener('scroll', check, { passive: true });
    window.addEventListener('resize', check, { passive: true });
    return () => {
      el.removeEventListener('scroll', check);
      window.removeEventListener('resize', check);
    };
  }, [deals]);

  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">

      {/* ── Filters ── */}
      <FiltersBar
        platform={platform}       setPlatform={setPlatform}
        postedFilter={postedFilter} setPostedFilter={setPostedFilter}
        loading={loading}          onRefresh={fetchDeals}
        count={deals.length}
      />

      {/* ── Info banner ── */}
      <div className="px-4 sm:px-5 py-2 bg-blue-50 border-b border-blue-100 flex items-center gap-2 text-xs text-blue-700">
        <svg className="h-3.5 w-3.5 shrink-0" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd"/>
        </svg>
        <span className="line-clamp-1 sm:line-clamp-none">
          Latest 20 deals shown — older records auto-purged to keep the system lean.
        </span>
      </div>

      {/* ── Error ── */}
      {error && (
        <div className="mx-4 my-3 flex items-center gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
          <svg className="h-4 w-4 shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd"/>
          </svg>
          {error}
        </div>
      )}

      {/* ── Loading ── */}
      {loading ? (
        <>
          {/* Mobile skeletons */}
          <div className="sm:hidden p-4 space-y-3">
            {[...Array(3)].map((_, i) => <CardSkeleton key={i} />)}
          </div>
          {/* Desktop skeleton */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full min-w-[800px]">
              <tbody>
                {[...Array(5)].map((_, i) => <RowSkeleton key={i} />)}
              </tbody>
            </table>
          </div>
        </>
      ) : deals.length === 0 ? (
        <div className="p-10 text-center">
          <p className="text-4xl mb-3">🛍️</p>
          <p className="text-sm font-semibold text-gray-700">No deals found</p>
          <p className="text-xs text-gray-400 mt-1">
            {platform !== 'all' || postedFilter !== 'all'
              ? 'Try adjusting the filters above.'
              : 'Deals will appear here once the crawler runs.'}
          </p>
        </div>
      ) : (
        <>
          {/* ══════════════════════════════════════════
              MOBILE LAYOUT: Card stack (< sm = 640px)
          ══════════════════════════════════════════ */}
          <div className="sm:hidden p-4 space-y-3">
            {deals.map((deal, idx) => (
              <DealCard key={deal._id} deal={deal} isLatest={idx === 0} />
            ))}
          </div>

          {/* ══════════════════════════════════════════
              DESKTOP LAYOUT: Scrollable table (≥ sm)
          ══════════════════════════════════════════ */}
          <div className="hidden sm:block relative">
            {/* Right-edge scroll fade + hint */}
            <ScrollHint show={canScrollRight} />

            {/* Scrollable table container */}
            <div
              ref={tableScrollRef}
              className="overflow-x-auto [-webkit-overflow-scrolling:touch] scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent"
            >
              <table className="w-full min-w-[800px]">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/80 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    {/* Sticky header cell for product */}
                    <th className="sticky left-0 z-10 bg-gray-50/80 backdrop-blur-sm px-4 py-2.5 text-left">
                      Product
                    </th>
                    <th className="px-4 py-2.5 text-left whitespace-nowrap">Platform</th>
                    <th className="px-4 py-2.5 text-right whitespace-nowrap">Price</th>
                    <th className="px-4 py-2.5 text-center whitespace-nowrap">Discount</th>
                    <th className="px-4 py-2.5 text-left whitespace-nowrap">Affiliate</th>
                    <th className="px-4 py-2.5 text-center whitespace-nowrap">Status</th>
                    <th className="px-4 py-2.5 text-right whitespace-nowrap">Time</th>
                    <th className="px-4 py-2.5 text-center whitespace-nowrap">Reel</th>
                  </tr>
                </thead>
                <tbody>
                  {deals.map((deal, idx) => (
                    <DealRow key={deal._id} deal={deal} isLatest={idx === 0} />
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* ── Footer count ── */}
      {!loading && deals.length > 0 && (
        <div className="px-4 sm:px-5 py-3 border-t border-gray-100 flex items-center justify-between text-xs text-gray-400">
          <span>{deals.length} deal{deals.length !== 1 ? 's' : ''} loaded</span>
          <button
            onClick={fetchDeals}
            className="text-blue-500 hover:text-blue-700 font-medium transition-colors touch-manipulation"
          >
            Reload
          </button>
        </div>
      )}
    </div>
  );
}
