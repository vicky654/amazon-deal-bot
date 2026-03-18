'use client';

import { useState, useEffect, useCallback } from 'react';
import { dealsApi, ApiError } from '../lib/api';
import PlatformBadge from './PlatformBadge';
import ReelButton from './reels/ReelButton';

const PLATFORMS = ['all', 'amazon', 'flipkart', 'myntra', 'ajio'];

function timeAgo(dateStr) {
  const diff = Math.floor((Date.now() - new Date(dateStr)) / 1000);
  if (diff < 60)    return `${diff}s ago`;
  if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function AffiliateBadge({ link }) {
  const [copied, setCopied] = useState(false);
  if (!link) return <span className="text-xs text-gray-400">—</span>;

  const copy = async () => {
    await navigator.clipboard.writeText(link).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  };

  return (
    <button onClick={copy} title={link}
      className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border transition-colors ${
        copied
          ? 'bg-green-50 border-green-200 text-green-700'
          : 'bg-blue-50 border-blue-200 text-blue-600 hover:bg-blue-100'
      }`}>
      {copied
        ? <><svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/></svg> Copied</>
        : <><svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/></svg> Affiliate</>
      }
    </button>
  );
}

function DealRow({ deal, isLatest }) {
  return (
    <tr className="hover:bg-gray-50 transition-colors">
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          {deal.image
            ? <img src={deal.image} alt="" className="h-12 w-12 rounded-lg object-contain bg-gray-50 border border-gray-100 shrink-0" />
            : <div className="h-12 w-12 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
                <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
              </div>
          }
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-sm font-medium text-gray-900 line-clamp-1">{deal.title}</p>
              {isLatest && (
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-200 shrink-0">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" /> Latest
                </span>
              )}
            </div>
            {deal.asin && <p className="text-xs text-gray-400 font-mono mt-0.5">{deal.asin}</p>}
          </div>
        </div>
      </td>

      <td className="px-4 py-3">
        <PlatformBadge platform={deal.platform} size="xs" />
      </td>

      <td className="px-4 py-3 text-right">
        <p className="text-sm font-bold text-emerald-700">₹{Number(deal.price).toLocaleString('en-IN')}</p>
        {deal.originalPrice && (
          <p className="text-xs text-gray-400 line-through">₹{Number(deal.originalPrice).toLocaleString('en-IN')}</p>
        )}
      </td>

      <td className="px-4 py-3 text-center">
        {deal.discount
          ? <span className="inline-block bg-red-100 text-red-700 text-xs font-bold px-2 py-0.5 rounded-full">{deal.discount}% off</span>
          : <span className="text-gray-400 text-xs">—</span>
        }
      </td>

      <td className="px-4 py-3">
        <AffiliateBadge link={deal.affiliateLink || deal.link} />
      </td>

      <td className="px-4 py-3 text-center">
        {deal.posted
          ? <span className="inline-flex items-center gap-1 text-xs text-green-700 bg-green-50 border border-green-200 rounded-full px-2 py-0.5">
              <span className="h-1.5 w-1.5 rounded-full bg-green-500" /> Posted
            </span>
          : <span className="text-xs text-gray-400">Pending</span>
        }
      </td>

      <td className="px-4 py-3 text-right text-xs text-gray-400 whitespace-nowrap">
        {deal.createdAt ? timeAgo(deal.createdAt) : '—'}
      </td>

      <td className="px-4 py-3 text-center">
        <ReelButton deal={deal} />
      </td>
    </tr>
  );
}

export default function EnhancedDealsTable() {
  const [deals,        setDeals]        = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState('');
  const [platform,     setPlatform]     = useState('all');
  const [postedFilter, setPostedFilter] = useState('all');

  const fetchDeals = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = {};
      if (platform !== 'all')       params.platform = platform;
      if (postedFilter === 'posted')  params.posted = true;
      if (postedFilter === 'pending') params.posted = false;

      const data = await dealsApi.list(params);
      setDeals(data.deals || []);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load deals');
    } finally {
      setLoading(false);
    }
  }, [platform, postedFilter]);

  useEffect(() => { fetchDeals(); }, [fetchDeals]);

  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-gray-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-gray-900">Recent Deals</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Showing latest {deals.length} deals
            <span className="ml-1.5 inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-600 border border-blue-100">
              auto-cleaned · max 20
            </span>
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <select value={platform} onChange={(e) => setPlatform(e.target.value)}
            className="text-xs border border-gray-300 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
            {PLATFORMS.map((p) => (
              <option key={p} value={p}>{p === 'all' ? 'All Platforms' : p.charAt(0).toUpperCase() + p.slice(1)}</option>
            ))}
          </select>

          <select value={postedFilter} onChange={(e) => setPostedFilter(e.target.value)}
            className="text-xs border border-gray-300 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
            <option value="all">All Status</option>
            <option value="posted">Posted</option>
            <option value="pending">Pending</option>
          </select>

          <button onClick={fetchDeals}
            className="text-xs text-gray-600 border border-gray-300 px-2.5 py-1.5 rounded-lg hover:bg-gray-50 flex items-center gap-1.5 transition-colors">
            <svg className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
            </svg>
            Refresh
          </button>
        </div>
      </div>

      {/* Info banner */}
      <div className="px-5 py-2.5 bg-blue-50 border-b border-blue-100 flex items-center gap-2 text-xs text-blue-700">
        <svg className="h-3.5 w-3.5 shrink-0" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd"/>
        </svg>
        Showing latest 20 deals (auto-cleaned) — older deals are automatically removed to keep the system lean.
      </div>

      {error && (
        <div className="mx-5 my-4 flex items-center gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
          <svg className="h-4 w-4 shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd"/></svg>
          {error}
        </div>
      )}

      {loading ? (
        <div className="p-10 text-center">
          <svg className="h-6 w-6 animate-spin text-blue-500 mx-auto" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
          </svg>
          <p className="mt-2 text-sm text-gray-400">Loading deals...</p>
        </div>
      ) : deals.length === 0 ? (
        <div className="p-10 text-center">
          <p className="text-3xl mb-3">🛍️</p>
          <p className="text-sm font-medium text-gray-600">No deals found</p>
          <p className="text-xs text-gray-400 mt-1">
            {platform !== 'all' || postedFilter !== 'all'
              ? 'Try adjusting the filters above.'
              : 'Deals will appear here once the crawler runs.'}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50 text-xs font-medium text-gray-500 uppercase tracking-wide">
                <th className="px-4 py-2.5 text-left">Product</th>
                <th className="px-4 py-2.5 text-left">Platform</th>
                <th className="px-4 py-2.5 text-right">Price</th>
                <th className="px-4 py-2.5 text-center">Discount</th>
                <th className="px-4 py-2.5 text-left">Affiliate</th>
                <th className="px-4 py-2.5 text-center">Status</th>
                <th className="px-4 py-2.5 text-right">Time</th>
                <th className="px-4 py-2.5 text-center">Reel</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {deals.map((deal, idx) => (
                <DealRow key={deal._id} deal={deal} isLatest={idx === 0} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
