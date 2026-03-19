'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { dashboardApi, systemApi } from '../../lib/api';
import {
  MousePointerClick,
  Package,
  Send,
  Star,
  RefreshCw,
  AlertTriangle,
  TrendingUp,
  Clock,
  Activity,
  CheckCircle2,
  XCircle,
  Zap,
  ChevronRight,
} from 'lucide-react';
import AutoModeWidget from '../../components/AutoModeWidget';

const REFRESH_MS = 30_000;

// ── Helpers ────────────────────────────────────────────────────────────────────

function timeAgo(iso) {
  if (!iso) return null;
  const diff = Date.now() - new Date(iso).getTime();
  const sec  = Math.floor(diff / 1000);
  if (sec < 60)  return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60)  return `${min}m ago`;
  const hr  = Math.floor(min / 60);
  return `${hr}h ago`;
}

function fmt(n) {
  return n != null ? Number(n).toLocaleString('en-IN') : '—';
}

function platformEmoji(p) {
  return { amazon: '🛒', flipkart: '🟡', myntra: '👗', ajio: '👠' }[p] || '🛍️';
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function StatCard({ icon: Icon, label, value, sub, color = 'slate' }) {
  const palette = {
    orange:  { card: 'bg-orange-50 border-orange-200',   icon: 'bg-orange-100 text-orange-600',   val: 'text-orange-600' },
    emerald: { card: 'bg-emerald-50 border-emerald-200', icon: 'bg-emerald-100 text-emerald-600', val: 'text-emerald-600' },
    blue:    { card: 'bg-blue-50 border-blue-200',       icon: 'bg-blue-100 text-blue-600',       val: 'text-blue-600' },
    violet:  { card: 'bg-violet-50 border-violet-200',   icon: 'bg-violet-100 text-violet-600',   val: 'text-violet-600' },
    slate:   { card: 'bg-white border-slate-200',        icon: 'bg-slate-100 text-slate-500',     val: 'text-slate-800' },
  }[color];

  return (
    <div className={`rounded-xl border p-4 flex items-center gap-3 ${palette.card}`}>
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${palette.icon}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-slate-500 font-medium">{label}</p>
        <p className={`text-xl font-bold leading-tight ${palette.val}`}>{value}</p>
        {sub && <p className="text-[11px] text-slate-400 truncate">{sub}</p>}
      </div>
    </div>
  );
}

function ScorePill({ score }) {
  const { label, cls } =
    score >= 75 ? { label: '🔥 Hot',    cls: 'bg-orange-100 text-orange-700' } :
    score >= 50 ? { label: '✅ Good',   cls: 'bg-emerald-100 text-emerald-700' } :
    score >= 30 ? { label: '👍 Decent', cls: 'bg-blue-100 text-blue-700' } :
                  { label: '💤 Weak',   cls: 'bg-slate-100 text-slate-500' };
  return (
    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${cls}`}>
      {label}
    </span>
  );
}

function TopDealsList({ deals }) {
  if (!deals?.length) {
    return (
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-6 text-center">
        <MousePointerClick className="w-7 h-7 text-slate-300 mx-auto mb-2" />
        <p className="text-sm text-slate-500">No click data yet — share tracking links to start.</p>
      </div>
    );
  }
  return (
    <div className="space-y-2">
      {deals.map((deal, i) => (
        <div key={deal._id} className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 transition">
          <span className="w-6 h-6 rounded-lg bg-orange-100 text-orange-600 text-xs font-bold flex items-center justify-center shrink-0">
            {i + 1}
          </span>
          {deal.image && (
            <img src={deal.image} alt="" className="w-10 h-10 object-contain rounded-lg bg-slate-50 border border-slate-100 shrink-0" />
          )}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-slate-900 truncate">{deal.title}</p>
            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
              <ScorePill score={deal.score || 0} />
              <span className="text-[10px] text-slate-400">{platformEmoji(deal.platform)} {deal.platform}</span>
              {deal.discount > 0 && <span className="text-[10px] font-semibold text-orange-600">{deal.discount}% off</span>}
            </div>
          </div>
          <div className="flex items-center gap-1 bg-orange-50 border border-orange-200 rounded-lg px-2 py-1 shrink-0">
            <MousePointerClick className="w-3 h-3 text-orange-500" />
            <span className="text-xs font-bold text-orange-700">{deal.clicks}</span>
          </div>
        </div>
      ))}
      <Link
        href="/admin/analytics"
        className="flex items-center justify-center gap-1 py-2 text-xs font-semibold text-orange-600 hover:text-orange-700 transition"
      >
        View full analytics <ChevronRight className="w-3 h-3" />
      </Link>
    </div>
  );
}

function SystemStatusCard({ status }) {
  if (!status) return null;
  const items = [
    {
      label: 'MongoDB',
      ok:    status.mongodb?.ok,
      sub:   status.mongodb?.status,
    },
    {
      label: 'Telegram',
      ok:    status.telegram?.ok,
      sub:   status.telegram?.ok ? 'Configured' : 'Check env vars',
    },
    {
      label: 'EarnKaro',
      ok:    status.earnkaro?.ok,
      sub:   status.earnkaro?.ok
               ? `Score ${status.earnkaro?.score ?? '—'}`
               : 'Session expired',
    },
    {
      label: 'Cron',
      ok:    status.cron?.ok,
      sub:   status.cron?.running
               ? '🟢 Running'
               : status.cron?.lastRun
               ? `Last: ${timeAgo(status.cron.lastRun)}`
               : 'Idle',
    },
  ];

  const q = status.queue;
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2">
        {items.map(({ label, ok, sub }) => (
          <div key={label} className={`flex items-center gap-2.5 p-3 rounded-xl border ${
            ok ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'
          }`}>
            {ok
              ? <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
              : <XCircle      className="w-4 h-4 text-red-500 shrink-0" />
            }
            <div className="min-w-0">
              <p className="text-xs font-semibold text-slate-800">{label}</p>
              <p className={`text-[10px] truncate ${ok ? 'text-emerald-600' : 'text-red-600'}`}>{sub}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Queue stats */}
      {q && (
        <div className="flex items-center gap-2 p-3 rounded-xl border border-slate-200 bg-white">
          <Zap className="w-4 h-4 text-blue-500 shrink-0" />
          <p className="text-xs text-slate-600">
            Queue — <span className="font-semibold">{q.pending}</span> pending ·{' '}
            <span className="font-semibold">{q.active}</span> active ·{' '}
            <span className="font-semibold">{q.processed}</span> done
          </p>
        </div>
      )}

      <Link
        href="/admin/system"
        className="flex items-center justify-center gap-1 py-2 text-xs font-semibold text-slate-500 hover:text-slate-700 transition"
      >
        Full system status <ChevronRight className="w-3 h-3" />
      </Link>
    </div>
  );
}

function RecentActivity({ deals, lastRun }) {
  if (!deals?.length) {
    return (
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-6 text-center">
        <Activity className="w-7 h-7 text-slate-300 mx-auto mb-2" />
        <p className="text-sm text-slate-500">No recent deals yet.</p>
      </div>
    );
  }
  return (
    <div className="space-y-2">
      {lastRun && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-blue-50 border border-blue-200 text-xs text-blue-700">
          <Clock className="w-3.5 h-3.5 shrink-0" />
          Last cron run: <span className="font-semibold">{timeAgo(lastRun)}</span>
        </div>
      )}
      {deals.map((deal) => (
        <div key={deal._id} className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 bg-white">
          <span className="text-base shrink-0">{platformEmoji(deal.platform)}</span>
          <div className="flex-1 min-w-0">
            <p className="text-sm text-slate-900 font-medium truncate">{deal.title}</p>
            <p className="text-[11px] text-slate-400">{timeAgo(deal.createdAt)} · {deal.platform}</p>
          </div>
          <span className={`shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full ${
            deal.posted
              ? 'bg-emerald-100 text-emerald-700'
              : 'bg-slate-100 text-slate-500'
          }`}>
            {deal.posted ? '📨 Posted' : '💾 Saved'}
          </span>
        </div>
      ))}
      <Link
        href="/admin/deals"
        className="flex items-center justify-center gap-1 py-2 text-xs font-semibold text-slate-500 hover:text-slate-700 transition"
      >
        View all deals <ChevronRight className="w-3 h-3" />
      </Link>
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const [data,        setData]        = useState(null);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState(null);
  const [refreshedAt, setRefreshedAt] = useState(null);
  const intervalRef = useRef(null);

  const fetchDashboard = useCallback(async () => {
    try {
      const res = await dashboardApi.get();
      setData(res);
      setError(null);
      setRefreshedAt(new Date());
    } catch (e) {
      setError(e.message || 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboard();
    intervalRef.current = setInterval(fetchDashboard, REFRESH_MS);
    return () => clearInterval(intervalRef.current);
  }, [fetchDashboard]);

  const skeleton = loading && !data;

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Dashboard</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {refreshedAt
              ? `Updated ${timeAgo(refreshedAt.toISOString())}`
              : 'Loading…'}
            {' '}· Auto-refreshes every {REFRESH_MS / 1000}s
          </p>
        </div>
        <button
          onClick={fetchDashboard}
          disabled={loading}
          className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium bg-slate-100 hover:bg-slate-200 disabled:opacity-50 text-slate-700 transition touch-manipulation"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          <span className="hidden sm:inline">Refresh</span>
        </button>
      </div>

      {/* ── Error ── */}
      {error && (
        <div className="flex items-start gap-3 p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* ════════════════════════════════════
          SECTION 1: Overview stat cards
      ════════════════════════════════════ */}
      {skeleton ? (
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
            value={fmt(data?.totalClicks)}
            color="orange"
            sub="affiliate link clicks"
          />
          <StatCard
            icon={Package}
            label="Total Deals"
            value={fmt(data?.totalDeals)}
            color="blue"
            sub="saved in database"
          />
          <StatCard
            icon={Send}
            label="Posted"
            value={fmt(data?.postedDeals)}
            color="emerald"
            sub="sent to Telegram"
          />
          <StatCard
            icon={Star}
            label="Avg Score"
            value={data?.avgScore ?? '—'}
            color="violet"
            sub="deal quality (0–100)"
          />
        </div>
      )}

      {/* ════════════════════════════════════
          Main grid: 2 col on desktop
      ════════════════════════════════════ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* ── Section 2: Top Deals ── */}
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-2">
            <TrendingUp className="w-4 h-4" />
            Top Deals by Clicks
          </h2>
          {skeleton ? (
            <div className="space-y-2">
              {[...Array(3)].map((_, i) => <div key={i} className="h-16 bg-slate-100 rounded-xl animate-pulse" />)}
            </div>
          ) : (
            <TopDealsList deals={data?.topDeals} />
          )}
        </section>

        {/* ── Section 3: System Status ── */}
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-2">
            <Activity className="w-4 h-4" />
            System Status
          </h2>
          {skeleton ? (
            <div className="grid grid-cols-2 gap-2">
              {[...Array(4)].map((_, i) => <div key={i} className="h-16 bg-slate-100 rounded-xl animate-pulse" />)}
            </div>
          ) : (
            <SystemStatusCard status={data?.systemStatus} />
          )}
        </section>

        {/* ── Section 4: Recent Activity ── */}
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-2">
            <Clock className="w-4 h-4" />
            Recent Activity
          </h2>
          {skeleton ? (
            <div className="space-y-2">
              {[...Array(3)].map((_, i) => <div key={i} className="h-14 bg-slate-100 rounded-xl animate-pulse" />)}
            </div>
          ) : (
            <RecentActivity
              deals={data?.recentDeals}
              lastRun={data?.systemStatus?.cron?.lastRun}
            />
          )}
        </section>

        {/* ── Section 5: Auto Mode ── */}
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider">
            Automation Control
          </h2>
          <AutoModeWidget />

          {/* Quick links */}
          <div className="grid grid-cols-2 gap-2 mt-2">
            {[
              { href: '/admin/generate', emoji: '➕', label: 'Generate Deal' },
              { href: '/admin/deals',    emoji: '📦', label: 'View Deals'    },
              { href: '/admin/analytics',emoji: '📈', label: 'Analytics'     },
              { href: '/admin/testing',  emoji: '🧪', label: 'Run Tests'     },
            ].map(({ href, emoji, label }) => (
              <Link
                key={href}
                href={href}
                className="flex items-center gap-2 p-3 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 transition"
              >
                <span className="text-base">{emoji}</span>
                <span className="text-xs font-semibold text-slate-700">{label}</span>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
