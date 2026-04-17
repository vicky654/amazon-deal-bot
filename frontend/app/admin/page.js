'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { dashboardApi, systemApi } from '../../lib/api';
import {
  MousePointerClick, Package, Send, Star, RefreshCw,
  AlertTriangle, TrendingUp, Clock, Activity, CheckCircle2,
  XCircle, Zap, ChevronRight, Flame,
} from 'lucide-react';
import AutoModeWidget from '../../components/AutoModeWidget';

const REFRESH_MS = 30_000;

function timeAgo(iso) {
  if (!iso) return null;
  const diff = Date.now() - new Date(iso).getTime();
  const sec  = Math.floor(diff / 1000);
  if (sec < 60)  return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60)  return `${min}m ago`;
  return `${Math.floor(min / 60)}h ago`;
}

function fmt(n) {
  return n != null ? Number(n).toLocaleString('en-IN') : '—';
}

function platformEmoji(p) {
  return { amazon: '🛒', flipkart: '🟡', myntra: '👗', ajio: '👠' }[p] || '🛍️';
}

// ── Stat card ──────────────────────────────────────────────────────────────────

const STAT_STYLES = {
  orange:  { bg: 'rgba(249,115,22,0.10)',  border: 'rgba(249,115,22,0.20)',  icon: 'rgba(249,115,22,0.20)',  iconFg: '#fb923c', val: '#fb923c'  },
  emerald: { bg: 'rgba(52,211,153,0.08)',  border: 'rgba(52,211,153,0.18)',  icon: 'rgba(52,211,153,0.20)',  iconFg: '#34d399', val: '#34d399'  },
  blue:    { bg: 'rgba(96,165,250,0.08)',  border: 'rgba(96,165,250,0.18)',  icon: 'rgba(96,165,250,0.20)',  iconFg: '#60a5fa', val: '#60a5fa'  },
  violet:  { bg: 'rgba(167,139,250,0.08)', border: 'rgba(167,139,250,0.18)', icon: 'rgba(167,139,250,0.20)', iconFg: '#a78bfa', val: '#a78bfa' },
};

function StatCard({ icon: Icon, label, value, sub, color = 'slate' }) {
  const s = STAT_STYLES[color];
  return (
    <div
      className="rounded-2xl p-4 flex items-center gap-3 transition-transform active:scale-[0.98]"
      style={{ background: s.bg, border: `1px solid ${s.border}` }}
    >
      <div
        className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
        style={{ background: s.icon }}
      >
        <Icon className="w-5 h-5" style={{ color: s.iconFg }} />
      </div>
      <div className="min-w-0">
        <p className="text-[11px] text-slate-500 font-medium">{label}</p>
        <p className="text-xl font-bold leading-tight" style={{ color: s.val }}>{value}</p>
        {sub && <p className="text-[10px] text-slate-600 truncate">{sub}</p>}
      </div>
    </div>
  );
}

function StatSkeleton() {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="h-20 rounded-2xl skeleton" />
      ))}
    </div>
  );
}

// ── Score pill ─────────────────────────────────────────────────────────────────

function ScorePill({ score }) {
  const { label, bg, color } =
    score >= 75 ? { label: '🔥 Hot',    bg: 'rgba(249,115,22,0.15)', color: '#fb923c' } :
    score >= 50 ? { label: '✅ Good',   bg: 'rgba(52,211,153,0.12)', color: '#34d399' } :
    score >= 30 ? { label: '👍 Decent', bg: 'rgba(96,165,250,0.12)', color: '#60a5fa' } :
                  { label: '💤 Weak',   bg: 'rgba(100,116,139,0.15)', color: '#64748b' };
  return (
    <span
      className="text-[9px] font-bold px-2 py-0.5 rounded-full"
      style={{ background: bg, color }}
    >
      {label}
    </span>
  );
}

// ── Section wrapper ────────────────────────────────────────────────────────────

function Section({ icon: Icon, title, children, action }) {
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500">
          <Icon className="w-3.5 h-3.5" />
          {title}
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}

// ── Dark card ─────────────────────────────────────────────────────────────────

function Card({ children, className = '' }) {
  return (
    <div
      className={`rounded-2xl p-3 sm:p-4 ${className}`}
      style={{ background: 'rgba(15,23,42,0.8)', border: '1px solid rgba(255,255,255,0.06)' }}
    >
      {children}
    </div>
  );
}

// ── Top deals ─────────────────────────────────────────────────────────────────

function TopDealsList({ deals }) {
  if (!deals?.length) {
    return (
      <Card className="flex flex-col items-center justify-center py-8 gap-2">
        <MousePointerClick className="w-7 h-7 text-slate-700" />
        <p className="text-sm text-slate-600">No click data yet</p>
      </Card>
    );
  }
  return (
    <div className="space-y-2">
      {deals.map((deal, i) => (
        <div
          key={deal._id}
          className="flex items-center gap-3 p-3 rounded-2xl transition-colors active:scale-[0.99]"
          style={{ background: 'rgba(15,23,42,0.8)', border: '1px solid rgba(255,255,255,0.06)' }}
        >
          <span
            className="w-6 h-6 rounded-lg text-xs font-bold flex items-center justify-center shrink-0"
            style={{ background: 'rgba(249,115,22,0.15)', color: '#fb923c' }}
          >
            {i + 1}
          </span>
          {deal.image && (
            <img
              src={deal.image}
              alt=""
              className="w-10 h-10 object-contain rounded-xl shrink-0"
              style={{ background: 'rgba(30,41,59,0.8)' }}
            />
          )}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-slate-200 truncate">{deal.title}</p>
            <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
              <ScorePill score={deal.score || 0} />
              <span className="text-[10px] text-slate-600">{platformEmoji(deal.platform)} {deal.platform}</span>
              {deal.discount > 0 && (
                <span className="text-[10px] font-semibold" style={{ color: '#fb923c' }}>{deal.discount}% off</span>
              )}
            </div>
          </div>
          <div
            className="flex items-center gap-1 px-2 py-1 rounded-xl shrink-0"
            style={{ background: 'rgba(249,115,22,0.12)', border: '1px solid rgba(249,115,22,0.20)' }}
          >
            <MousePointerClick className="w-3 h-3" style={{ color: '#fb923c' }} />
            <span className="text-xs font-bold" style={{ color: '#fb923c' }}>{deal.clicks}</span>
          </div>
        </div>
      ))}
      <Link
        href="/admin/analytics"
        className="flex items-center justify-center gap-1 py-2 text-xs font-semibold text-slate-500 hover:text-slate-300 transition"
      >
        View full analytics <ChevronRight className="w-3 h-3" />
      </Link>
    </div>
  );
}

// ── System status ──────────────────────────────────────────────────────────────

function SystemStatusCard({ status }) {
  if (!status) return null;
  const items = [
    { label: 'MongoDB',  ok: status.mongodb?.ok,  sub: status.mongodb?.status             },
    { label: 'Telegram', ok: status.telegram?.ok, sub: status.telegram?.ok ? 'Ready' : 'Check env' },
    { label: 'EarnKaro', ok: status.earnkaro?.ok, sub: status.earnkaro?.ok ? `Score ${status.earnkaro?.score ?? '—'}` : 'Session expired' },
    { label: 'Cron',     ok: status.cron?.ok,
      sub: status.cron?.running ? 'Running' : status.cron?.lastRun ? `Last: ${timeAgo(status.cron.lastRun)}` : 'Idle' },
  ];
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2">
        {items.map(({ label, ok, sub }) => (
          <div
            key={label}
            className="flex items-center gap-2.5 p-3 rounded-2xl"
            style={{
              background: ok ? 'rgba(52,211,153,0.08)' : 'rgba(239,68,68,0.08)',
              border: `1px solid ${ok ? 'rgba(52,211,153,0.18)' : 'rgba(239,68,68,0.18)'}`,
            }}
          >
            {ok
              ? <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              : <XCircle      className="w-4 h-4 text-red-400 shrink-0" />
            }
            <div className="min-w-0">
              <p className="text-xs font-semibold text-slate-300">{label}</p>
              <p className={`text-[10px] truncate ${ok ? 'text-emerald-500' : 'text-red-500'}`}>{sub}</p>
            </div>
          </div>
        ))}
      </div>
      {status.queue && (
        <div
          className="flex items-center gap-2 p-3 rounded-2xl"
          style={{ background: 'rgba(96,165,250,0.08)', border: '1px solid rgba(96,165,250,0.15)' }}
        >
          <Zap className="w-4 h-4 text-blue-400 shrink-0" />
          <p className="text-xs text-slate-400">
            Queue — <span className="font-semibold text-white">{status.queue.pending}</span> pending ·{' '}
            <span className="font-semibold text-white">{status.queue.active}</span> active
          </p>
        </div>
      )}
      <Link
        href="/admin/system"
        className="flex items-center justify-center gap-1 py-2 text-xs font-semibold text-slate-500 hover:text-slate-300 transition"
      >
        Full system status <ChevronRight className="w-3 h-3" />
      </Link>
    </div>
  );
}

// ── Recent activity ────────────────────────────────────────────────────────────

function RecentActivity({ deals, lastRun }) {
  if (!deals?.length) {
    return (
      <Card className="flex flex-col items-center justify-center py-8 gap-2">
        <Activity className="w-7 h-7 text-slate-700" />
        <p className="text-sm text-slate-600">No recent deals yet</p>
      </Card>
    );
  }
  return (
    <div className="space-y-2">
      {lastRun && (
        <div
          className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs"
          style={{ background: 'rgba(96,165,250,0.08)', border: '1px solid rgba(96,165,250,0.15)', color: '#60a5fa' }}
        >
          <Clock className="w-3.5 h-3.5 shrink-0" />
          Last crawl: <span className="font-semibold">{timeAgo(lastRun)}</span>
        </div>
      )}
      {deals.map((deal) => (
        <div
          key={deal._id}
          className="flex items-center gap-3 p-3 rounded-2xl"
          style={{ background: 'rgba(15,23,42,0.8)', border: '1px solid rgba(255,255,255,0.06)' }}
        >
          <span className="text-base shrink-0">{platformEmoji(deal.platform)}</span>
          <div className="flex-1 min-w-0">
            <p className="text-sm text-slate-200 font-medium truncate">{deal.title}</p>
            <p className="text-[11px] text-slate-600">{timeAgo(deal.createdAt)} · {deal.platform}</p>
          </div>
          <span
            className="shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full"
            style={deal.posted
              ? { background: 'rgba(52,211,153,0.15)', color: '#34d399' }
              : { background: 'rgba(100,116,139,0.15)', color: '#64748b' }
            }
          >
            {deal.posted ? '📨 Posted' : '💾 Saved'}
          </span>
        </div>
      ))}
      <Link
        href="/admin/deals"
        className="flex items-center justify-center gap-1 py-2 text-xs font-semibold text-slate-500 hover:text-slate-300 transition"
      >
        View all deals <ChevronRight className="w-3 h-3" />
      </Link>
    </div>
  );
}

// ── Quick links ────────────────────────────────────────────────────────────────

const QUICK_LINKS = [
  { href: '/admin/generate', emoji: '➕', label: 'Generate',  color: 'rgba(249,115,22,0.12)',  border: 'rgba(249,115,22,0.20)'  },
  { href: '/admin/deals',    emoji: '📦', label: 'Deals',     color: 'rgba(96,165,250,0.10)',  border: 'rgba(96,165,250,0.18)'  },
  { href: '/admin/analytics',emoji: '📈', label: 'Analytics', color: 'rgba(167,139,250,0.10)', border: 'rgba(167,139,250,0.18)' },
  { href: '/admin/testing',  emoji: '🧪', label: 'Tests',     color: 'rgba(52,211,153,0.10)',  border: 'rgba(52,211,153,0.18)'  },
];

// ── Page ───────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const [data,        setData]    = useState(null);
  const [loading,     setLoading] = useState(true);
  const [error,       setError]   = useState(null);
  const [refreshedAt, setRefAt]   = useState(null);
  const timerRef = useRef(null);

  const fetchDashboard = useCallback(async () => {
    try {
      const res = await dashboardApi.get();
      setData(res);
      setError(null);
      setRefAt(new Date());
    } catch (e) {
      setError(e.message || 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboard();
    timerRef.current = setInterval(fetchDashboard, REFRESH_MS);
    return () => clearInterval(timerRef.current);
  }, [fetchDashboard]);

  const skeleton = loading && !data;

  return (
    <div className="space-y-6">

      {/* ── Page header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Flame className="w-5 h-5 text-orange-400" />
            Dashboard
          </h1>
          <p className="text-xs text-slate-600 mt-0.5">
            {refreshedAt ? `Updated ${timeAgo(refreshedAt.toISOString())}` : 'Loading…'}
          </p>
        </div>
        <button
          onClick={fetchDashboard}
          disabled={loading}
          className="p-2.5 rounded-xl text-slate-400 hover:text-white transition touch-manipulation active:scale-95 disabled:opacity-40"
          style={{ background: 'rgba(30,41,59,0.8)', border: '1px solid rgba(255,255,255,0.06)' }}
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* ── Error ── */}
      {error && (
        <div
          className="flex items-start gap-3 p-4 rounded-2xl text-sm"
          style={{ background: 'rgba(239,68,68,0.10)', border: '1px solid rgba(239,68,68,0.20)', color: '#f87171' }}
        >
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
          {error}
        </div>
      )}

      {/* ── Stat cards ── */}
      {skeleton ? <StatSkeleton /> : (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 stagger-children">
          <StatCard icon={MousePointerClick} label="Total Clicks"  value={fmt(data?.totalClicks)}  color="orange"  sub="affiliate clicks" />
          <StatCard icon={Package}           label="Total Deals"   value={fmt(data?.totalDeals)}   color="blue"    sub="in database"     />
          <StatCard icon={Send}              label="Posted"        value={fmt(data?.postedDeals)}  color="emerald" sub="to Telegram"     />
          <StatCard icon={Star}              label="Avg Score"     value={data?.avgScore ?? '—'}   color="violet"  sub="deal quality"    />
        </div>
      )}

      {/* ── Main grid ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

        <Section icon={TrendingUp} title="Top Deals by Clicks">
          {skeleton
            ? <div className="space-y-2">{[...Array(3)].map((_, i) => <div key={i} className="h-16 rounded-2xl skeleton" />)}</div>
            : <TopDealsList deals={data?.topDeals} />
          }
        </Section>

        <Section icon={Activity} title="System Status">
          {skeleton
            ? <div className="grid grid-cols-2 gap-2">{[...Array(4)].map((_, i) => <div key={i} className="h-16 rounded-2xl skeleton" />)}</div>
            : <SystemStatusCard status={data?.systemStatus} />
          }
        </Section>

        <Section icon={Clock} title="Recent Activity">
          {skeleton
            ? <div className="space-y-2">{[...Array(3)].map((_, i) => <div key={i} className="h-14 rounded-2xl skeleton" />)}</div>
            : <RecentActivity deals={data?.recentDeals} lastRun={data?.systemStatus?.cron?.lastRun} />
          }
        </Section>

        <Section icon={Zap} title="Automation Control">
          <AutoModeWidget />
          <div className="grid grid-cols-2 gap-2 mt-1">
            {QUICK_LINKS.map(({ href, emoji, label, color, border }) => (
              <Link
                key={href}
                href={href}
                className="flex items-center gap-2.5 p-3 rounded-2xl transition-all active:scale-[0.97] touch-manipulation"
                style={{ background: color, border: `1px solid ${border}` }}
              >
                <span className="text-lg">{emoji}</span>
                <span className="text-xs font-semibold text-slate-300">{label}</span>
              </Link>
            ))}
          </div>
        </Section>
      </div>
    </div>
  );
}
