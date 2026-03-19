'use client';

import { useState, useEffect, useCallback } from 'react';
import { dealsApi } from '../../../lib/api';
import {
  MousePointerClick,
  TrendingUp,
  Package,
  Send,
  RefreshCw,
  Star,
  ExternalLink,
  AlertTriangle,
} from 'lucide-react';

const BASE = (process.env.NEXT_PUBLIC_API_URL || 'https://deal-system-backend.onrender.com').replace(/\/$/, '');

function redirectUrl(dealId) {
  return `${BASE}/r/${dealId}`;
}

function ScorePill({ score }) {
  const { label, cls } = score >= 75
    ? { label: '🔥 Hot',    cls: 'bg-orange-100 text-orange-700' }
    : score >= 50
    ? { label: '✅ Good',   cls: 'bg-emerald-100 text-emerald-700' }
    : score >= 30
    ? { label: '👍 Decent', cls: 'bg-blue-100 text-blue-700' }
    : { label: '💤 Weak',   cls: 'bg-slate-100 text-slate-500' };

  return (
    <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${cls}`}>
      {label} · {score}
    </span>
  );
}

function StatCard({ icon: Icon, label, value, sub, color = 'slate' }) {
  const ring = {
    orange:  'border-orange-200 bg-orange-50',
    emerald: 'border-emerald-200 bg-emerald-50',
    blue:    'border-blue-200 bg-blue-50',
    slate:   'border-slate-200 bg-white',
  }[color];
  const iconBg = {
    orange:  'bg-orange-100 text-orange-600',
    emerald: 'bg-emerald-100 text-emerald-600',
    blue:    'bg-blue-100 text-blue-600',
    slate:   'bg-slate-100 text-slate-500',
  }[color];

  return (
    <div className={`rounded-xl border p-4 flex items-center gap-4 ${ring}`}>
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${iconBg}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <p className="text-xs text-slate-500">{label}</p>
        <p className="text-xl font-bold text-slate-900">{value}</p>
        {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

export default function AnalyticsPage() {
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);
  const [copied,  setCopied]  = useState(null);

  const fetchData = useCallback(async () => {
    try {
      const res = await dealsApi.analytics();
      setData(res);
      setError(null);
    } catch (e) {
      setError(e.message || 'Failed to load analytics');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  function copyRedirectLink(dealId) {
    const url = redirectUrl(dealId);
    navigator.clipboard.writeText(url).then(() => {
      setCopied(dealId);
      setTimeout(() => setCopied(null), 2000);
    });
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Analytics</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Click tracking · Deal performance · Top earners
          </p>
        </div>
        <button
          onClick={fetchData}
          className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 transition touch-manipulation"
        >
          <RefreshCw className="w-4 h-4" />
          <span className="hidden sm:inline">Refresh</span>
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-start gap-3 p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Stat cards */}
      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-20 bg-slate-100 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard
            icon={MousePointerClick}
            label="Total Clicks"
            value={data?.stats?.totalClicks?.toLocaleString() ?? '0'}
            color="orange"
            sub="across all deals"
          />
          <StatCard
            icon={Package}
            label="Total Deals"
            value={data?.stats?.totalDeals?.toLocaleString() ?? '0'}
            color="blue"
            sub="saved in DB"
          />
          <StatCard
            icon={Send}
            label="Posted"
            value={data?.stats?.postedDeals?.toLocaleString() ?? '0'}
            color="emerald"
            sub="sent to Telegram"
          />
          <StatCard
            icon={Star}
            label="Avg Score"
            value={data?.stats?.avgScore ?? '0'}
            color="slate"
            sub="deal quality"
          />
        </div>
      )}

      {/* Top deals by clicks */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-2">
          <TrendingUp className="w-4 h-4" />
          Top Deals by Clicks
        </h2>

        {loading ? (
          <div className="space-y-2">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-20 bg-slate-100 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : !data?.topDeals?.length ? (
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-8 text-center">
            <MousePointerClick className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p className="text-sm text-slate-500">No clicks tracked yet.</p>
            <p className="text-xs text-slate-400 mt-1">
              Share redirect links from the deals list to start tracking.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {data.topDeals.map((deal, idx) => (
              <div
                key={deal._id}
                className="rounded-xl border border-slate-200 bg-white p-3 sm:p-4 flex gap-3 items-start"
              >
                {/* Rank */}
                <div className="w-7 h-7 rounded-lg bg-orange-100 text-orange-600 text-xs font-bold flex items-center justify-center shrink-0">
                  {idx + 1}
                </div>

                {/* Image */}
                {deal.image && (
                  <img
                    src={deal.image}
                    alt=""
                    className="w-12 h-12 object-contain rounded-lg bg-slate-50 border border-slate-100 shrink-0"
                  />
                )}

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-900 leading-snug line-clamp-2">
                    {deal.title}
                  </p>
                  <div className="flex flex-wrap items-center gap-2 mt-1">
                    <ScorePill score={deal.score || 0} />
                    {deal.discount > 0 && (
                      <span className="text-xs font-bold text-orange-600">{deal.discount}% off</span>
                    )}
                    {deal.price > 0 && (
                      <span className="text-xs text-slate-600">₹{deal.price?.toLocaleString('en-IN')}</span>
                    )}
                  </div>
                </div>

                {/* Right: clicks + actions */}
                <div className="flex flex-col items-end gap-2 shrink-0">
                  <div className="flex items-center gap-1 bg-orange-50 border border-orange-200 rounded-lg px-2 py-1">
                    <MousePointerClick className="w-3.5 h-3.5 text-orange-500" />
                    <span className="text-sm font-bold text-orange-700">{deal.clicks}</span>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => copyRedirectLink(deal._id)}
                      title="Copy tracking link"
                      className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium bg-slate-100 hover:bg-slate-200 text-slate-600 transition touch-manipulation"
                    >
                      {copied === deal._id ? '✓ Copied' : 'Copy link'}
                    </button>
                    {deal.affiliateLink && (
                      <a
                        href={deal.affiliateLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
                        title="Open affiliate link"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Redirect URL info box */}
      <section className="rounded-xl border border-blue-200 bg-blue-50 p-4 space-y-2">
        <p className="text-sm font-semibold text-blue-800">How click tracking works</p>
        <p className="text-xs text-blue-700 leading-relaxed">
          Every deal has a redirect URL at <code className="font-mono bg-blue-100 px-1 rounded">{BASE}/r/[dealId]</code>.
          Share this instead of the raw affiliate link — it increments the click counter before redirecting.
          Use "Copy link" above to grab the tracking URL for any deal.
        </p>
        <p className="text-xs text-blue-600">
          The MIN_DEAL_SCORE env var (default: 30) controls the minimum score for auto-posting to Telegram.
        </p>
      </section>
    </div>
  );
}
