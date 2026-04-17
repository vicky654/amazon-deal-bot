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

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || 'https://deal-system-backend.onrender.com').replace(/\/$/, '');

// ── AffiliateBadge ────────────────────────────────────────────────────────────

function AffiliateBadge({ deal, fullWidth = false }) {
  const [copied, setCopied] = useState(false);
  const link = deal?.finalLink || deal?.affiliateLink || deal?.link;
  if (!link) return <span className="text-xs text-slate-600">—</span>;

  const isAffiliate = !!(deal?.affiliateLink && deal.affiliateLink !== deal?.originalLink && deal.affiliateLink !== deal?.link);
  const redirectUrl = deal?._id ? `${API_BASE}/r/${deal._id}` : link;

  const copy = async () => {
    await navigator.clipboard.writeText(redirectUrl).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1400);
  };

  return (
    <div className={`flex items-center gap-1.5 ${fullWidth ? 'w-full' : ''}`}>
      {/* Link type badge */}
      <span
        className="shrink-0 text-[9px] font-bold px-1.5 py-0.5 rounded-full"
        style={isAffiliate
          ? { background: 'rgba(16,185,129,0.12)', color: '#34d399', border: '1px solid rgba(16,185,129,0.22)' }
          : { background: 'rgba(71,85,105,0.15)', color: '#64748b', border: '1px solid rgba(71,85,105,0.22)' }
        }
      >
        {isAffiliate ? 'Aff' : 'Direct'}
      </span>

      {/* Copy redirect link */}
      <button
        onClick={copy}
        title={redirectUrl}
        className={`inline-flex items-center justify-center gap-1 text-xs px-2.5 py-1 rounded-full font-medium transition-all active:scale-95 ${fullWidth ? 'flex-1' : ''}`}
        style={copied
          ? { background: 'rgba(52,211,153,0.12)', border: '1px solid rgba(52,211,153,0.25)', color: '#34d399' }
          : { background: 'rgba(96,165,250,0.10)', border: '1px solid rgba(96,165,250,0.22)', color: '#60a5fa' }
        }
      >
        {copied ? (
          <><svg className="h-3 w-3 shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/></svg>Copied!</>
        ) : (
          <><svg className="h-3 w-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"/></svg>Link</>
        )}
      </button>
    </div>
  );
}

// ── ClicksBadge ───────────────────────────────────────────────────────────────

function ClicksBadge({ clicks }) {
  if (!clicks) return null;
  return (
    <span
      className="inline-flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
      style={{ background: 'rgba(249,115,22,0.10)', color: '#fb923c', border: '1px solid rgba(249,115,22,0.18)' }}
    >
      👆 {clicks}
    </span>
  );
}

// ── ProductImage ──────────────────────────────────────────────────────────────

function ProductImage({ src, alt, className }) {
  return src ? (
    <img
      src={src}
      alt={alt || ''}
      loading="lazy"
      className={`object-contain ${className}`}
      style={{ background: 'rgba(30,41,59,0.6)' }}
    />
  ) : (
    <div className={`flex items-center justify-center ${className}`} style={{ background: 'rgba(30,41,59,0.6)' }}>
      <svg className="h-5 w-5 text-slate-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
          d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/>
      </svg>
    </div>
  );
}

// ── DealCard  (mobile ≤ sm) ───────────────────────────────────────────────────

function DealCard({ deal, isLatest }) {

  return (
    <div
      className="rounded-2xl overflow-hidden active:scale-[0.99] transition-transform"
      style={{ background: 'rgba(15,23,42,0.9)', border: '1px solid rgba(255,255,255,0.07)' }}
    >
      <div className="flex items-start gap-3 p-4">
        <ProductImage
          src={deal.image}
          alt={deal.title}
          className="h-16 w-16 rounded-xl shrink-0"
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <PlatformBadge platform={deal.platform} size="xs" />
            {isLatest && (
              <span
                className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
                style={{ background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.25)', color: '#fbbf24' }}
              >
                <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" />
                Latest
              </span>
            )}
          </div>
          <p className="text-sm font-semibold text-slate-200 leading-snug line-clamp-2">{deal.title}</p>
          {deal.asin && <p className="text-[10px] text-slate-600 font-mono mt-0.5 truncate">{deal.asin}</p>}
        </div>
      </div>

      <div className="px-4 pb-3 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-baseline gap-2 flex-wrap">
          <span className="text-lg font-bold" style={{ color: '#34d399' }}>{fmtPrice(deal.price) || 'Check Price'}</span>
          {deal.originalPrice && <span className="text-xs text-slate-600 line-through">{fmtPrice(deal.originalPrice)}</span>}
        </div>
        <div className="flex items-center gap-2">
          {deal.discount && (
            <span
              className="text-xs font-bold px-2.5 py-1 rounded-full"
              style={{ background: 'rgba(239,68,68,0.12)', color: '#f87171' }}
            >
              {deal.discount}% off
            </span>
          )}
          {deal.posted ? (
            <span
              className="inline-flex items-center gap-1 text-xs rounded-full px-2 py-0.5"
              style={{ background: 'rgba(52,211,153,0.12)', border: '1px solid rgba(52,211,153,0.22)', color: '#34d399' }}
            >
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> Posted
            </span>
          ) : (
            <span
              className="text-xs rounded-full px-2 py-0.5"
              style={{ background: 'rgba(71,85,105,0.3)', color: '#64748b' }}
            >
              Pending
            </span>
          )}
        </div>
      </div>

      <div style={{ height: '1px', background: 'rgba(255,255,255,0.05)', margin: '0 1rem' }} />

      <div className="p-3 flex flex-col gap-2">
        <div className="flex items-center justify-between text-xs text-slate-600 px-1">
          <span>{timeAgo(deal.createdAt)}</span>
          <ClicksBadge clicks={deal.clicks} />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <AffiliateBadge deal={deal} fullWidth />
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
    <tr
      className="group transition-colors border-b"
      style={{ borderColor: 'rgba(255,255,255,0.05)' }}
    >
      <td
        className="sticky left-0 z-[1] px-4 py-3 min-w-[220px] max-w-[260px] transition-colors"
        style={{ background: 'rgba(2,6,23,0.97)' }}
      >
        <div className="flex items-center gap-3">
          <ProductImage src={deal.image} alt={deal.title} className="h-11 w-11 rounded-xl shrink-0" />
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
              <p className="text-sm font-medium text-slate-200 line-clamp-1">{deal.title}</p>
              {isLatest && (
                <span
                  className="inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded-full shrink-0 whitespace-nowrap"
                  style={{ background: 'rgba(245,158,11,0.15)', color: '#fbbf24', border: '1px solid rgba(245,158,11,0.22)' }}
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" /> Latest
                </span>
              )}
            </div>
            {deal.asin && <p className="text-[10px] text-slate-600 font-mono truncate">{deal.asin}</p>}
          </div>
        </div>
      </td>

      <td className="px-4 py-3 whitespace-nowrap">
        <PlatformBadge platform={deal.platform} size="xs" />
      </td>

      <td className="px-4 py-3 text-right whitespace-nowrap">
        <p className="text-sm font-bold" style={{ color: '#34d399' }}>{fmtPrice(deal.price) || '—'}</p>
        {deal.originalPrice && <p className="text-xs text-slate-600 line-through">{fmtPrice(deal.originalPrice)}</p>}
      </td>

      <td className="px-4 py-3 text-center whitespace-nowrap">
        {deal.discount
          ? <span className="inline-block text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: 'rgba(239,68,68,0.12)', color: '#f87171' }}>{deal.discount}% off</span>
          : <span className="text-slate-700 text-xs">—</span>
        }
      </td>

      <td className="px-4 py-3 whitespace-nowrap">
        <AffiliateBadge deal={deal} />
      </td>

      <td className="px-4 py-3 text-center whitespace-nowrap">
        {deal.posted ? (
          <span className="inline-flex items-center gap-1 text-xs rounded-full px-2 py-0.5" style={{ background: 'rgba(52,211,153,0.12)', border: '1px solid rgba(52,211,153,0.22)', color: '#34d399' }}>
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> Posted
          </span>
        ) : (
          <span className="text-xs rounded-full px-2 py-0.5" style={{ background: 'rgba(71,85,105,0.3)', color: '#64748b' }}>Pending</span>
        )}
      </td>

      <td className="px-4 py-3 text-center whitespace-nowrap">
        <ClicksBadge clicks={deal.clicks} />
      </td>

      <td className="px-4 py-3 text-right text-xs text-slate-600 whitespace-nowrap">
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
    <div className="rounded-2xl p-4 space-y-3" style={{ background: 'rgba(15,23,42,0.9)', border: '1px solid rgba(255,255,255,0.06)' }}>
      <div className="flex gap-3">
        <div className="h-16 w-16 rounded-xl skeleton shrink-0" />
        <div className="flex-1 space-y-2 pt-1">
          <div className="skeleton h-3 w-1/3 rounded-lg" />
          <div className="skeleton h-4 w-full rounded-lg" />
          <div className="skeleton h-3 w-2/3 rounded-lg" />
        </div>
      </div>
      <div className="flex gap-2">
        <div className="skeleton h-8 rounded-full flex-1" />
        <div className="skeleton h-8 rounded-full flex-1" />
      </div>
    </div>
  );
}

function RowSkeleton() {
  return (
    <tr className="animate-pulse border-b" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
      {[220, 80, 90, 80, 110, 80, 60, 70, 80].map((w, i) => (
        <td key={i} className="px-4 py-3">
          <div className="skeleton h-4 rounded-lg" style={{ width: `${w * 0.6}px` }} />
        </td>
      ))}
    </tr>
  );
}

// ── ScrollHint ────────────────────────────────────────────────────────────────

function ScrollHint({ show }) {
  if (!show) return null;
  return (
    <div
      className="pointer-events-none absolute inset-y-0 right-0 w-14 z-10 flex items-center justify-end pr-2"
      style={{ background: 'linear-gradient(to left, rgba(2,6,23,0.95), transparent)' }}
    >
      <svg className="w-3.5 h-3.5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/>
      </svg>
    </div>
  );
}

// ── Filters bar ───────────────────────────────────────────────────────────────

function FiltersBar({ platform, setPlatform, postedFilter, setPostedFilter, loading, onRefresh, count }) {
  return (
    <div className="px-4 sm:px-5 py-4 space-y-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
      <div className="flex items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-bold text-white">Recent Deals</h2>
          <p className="text-xs text-slate-600 mt-0.5 hidden sm:block">
            Showing {count} deals ·
            <span className="ml-1 text-slate-500">auto-cleaned, max 20</span>
          </p>
        </div>
        <button
          onClick={onRefresh}
          className="p-2 rounded-xl text-slate-500 hover:text-white transition-colors touch-manipulation active:scale-95"
          style={{ background: 'rgba(30,41,59,0.6)', border: '1px solid rgba(255,255,255,0.06)' }}
        >
          <svg className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
          </svg>
        </button>
      </div>

      <div className="flex items-center gap-2 overflow-x-auto pb-0.5 scrollbar-none">
        {[
          { key: 'platform', value: platform, set: setPlatform, options: PLATFORMS.map(p => ({ value: p, label: p === 'all' ? 'All Platforms' : p.charAt(0).toUpperCase() + p.slice(1) })) },
          { key: 'status', value: postedFilter, set: setPostedFilter, options: [{ value: 'all', label: 'All Status' }, { value: 'posted', label: 'Posted' }, { value: 'pending', label: 'Pending' }] },
        ].map(({ key, value, set, options }) => (
          <select
            key={key}
            value={value}
            onChange={(e) => set(e.target.value)}
            className="text-xs px-3 py-1.5 rounded-xl focus:outline-none shrink-0 touch-manipulation text-slate-300"
            style={{ background: 'rgba(30,41,59,0.8)', border: '1px solid rgba(255,255,255,0.08)' }}
          >
            {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        ))}
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
    <div className="rounded-2xl overflow-hidden" style={{ background: 'rgba(15,23,42,0.9)', border: '1px solid rgba(255,255,255,0.07)' }}>

      {/* ── Filters ── */}
      <FiltersBar
        platform={platform}       setPlatform={setPlatform}
        postedFilter={postedFilter} setPostedFilter={setPostedFilter}
        loading={loading}          onRefresh={fetchDeals}
        count={deals.length}
      />

      {error && (
        <div
          className="mx-4 my-3 flex items-center gap-2 text-sm px-4 py-3 rounded-2xl"
          style={{ background: 'rgba(239,68,68,0.10)', border: '1px solid rgba(239,68,68,0.20)', color: '#f87171' }}
        >
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
        <div className="p-12 text-center">
          <p className="text-4xl mb-3">🛍️</p>
          <p className="text-sm font-semibold text-slate-400">No deals found</p>
          <p className="text-xs text-slate-600 mt-1">
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
              className="overflow-x-auto [-webkit-overflow-scrolling:touch] scrollbar-none"
            >
              <table className="w-full min-w-[800px]">
                <thead>
                  <tr
                    className="text-xs font-bold text-slate-600 uppercase tracking-wide"
                    style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', background: 'rgba(30,41,59,0.5)' }}
                  >
                    <th
                      className="sticky left-0 z-10 px-4 py-2.5 text-left"
                      style={{ background: 'rgba(15,23,42,0.97)' }}
                    >
                      Product
                    </th>
                    <th className="px-4 py-2.5 text-left whitespace-nowrap">Platform</th>
                    <th className="px-4 py-2.5 text-right whitespace-nowrap">Price</th>
                    <th className="px-4 py-2.5 text-center whitespace-nowrap">Discount</th>
                    <th className="px-4 py-2.5 text-left whitespace-nowrap">Link</th>
                    <th className="px-4 py-2.5 text-center whitespace-nowrap">Status</th>
                    <th className="px-4 py-2.5 text-center whitespace-nowrap">Clicks</th>
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
        <div
          className="px-4 sm:px-5 py-3 flex items-center justify-between text-xs text-slate-600"
          style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}
        >
          <span>{deals.length} deal{deals.length !== 1 ? 's' : ''} loaded</span>
          <button onClick={fetchDeals} className="text-slate-400 hover:text-white font-medium transition-colors touch-manipulation">
            Reload
          </button>
        </div>
      )}
    </div>
  );
}
