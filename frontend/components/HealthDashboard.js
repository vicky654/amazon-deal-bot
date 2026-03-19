'use client';

import { useState, useEffect, useCallback } from 'react';
import { systemApi } from '../lib/api';

// ── Helpers ───────────────────────────────────────────────────────────────────

function StatusDot({ ok, pulse = false }) {
  return (
    <span className={`inline-block h-2.5 w-2.5 rounded-full shrink-0 ${
      ok === null  ? 'bg-gray-300' :
      ok           ? 'bg-emerald-500' : 'bg-red-500'
    } ${pulse && ok ? 'animate-pulse' : ''}`} />
  );
}

// ── Single health card ────────────────────────────────────────────────────────

function HealthCard({ icon, label, ok, detail, sub }) {
  return (
    <div className={`flex items-center gap-3 p-4 rounded-2xl border transition-all ${
      ok === null
        ? 'bg-gray-50 border-gray-200'
        : ok
        ? 'bg-emerald-50 border-emerald-200'
        : 'bg-red-50 border-red-200'
    }`}>
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0 ${
        ok === null ? 'bg-gray-100' : ok ? 'bg-emerald-100' : 'bg-red-100'
      }`}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <StatusDot ok={ok} pulse={ok === true && label === 'Cron'} />
          <p className="text-xs font-semibold text-gray-700 uppercase tracking-wide">{label}</p>
        </div>
        <p className={`text-sm font-bold mt-0.5 ${
          ok === null ? 'text-gray-500' : ok ? 'text-emerald-700' : 'text-red-700'
        }`}>
          {detail}
        </p>
        {sub && <p className="text-[11px] text-gray-400 truncate mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function HealthDashboard() {
  const [health,    setHealth]    = useState(null);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState(null);

  const fetch = useCallback(async () => {
    try {
      const data = await systemApi.health();
      setHealth(data);
      setError(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetch();
    const iv = setInterval(fetch, 30_000);
    return () => clearInterval(iv);
  }, [fetch]);

  const s = health?.services;

  const cards = [
    {
      icon: '🗄️',
      label: 'MongoDB',
      ok:   s ? s.mongodb.ok : null,
      detail: s ? (s.mongodb.ok ? 'Connected' : s.mongodb.status) : '…',
      sub: 'Database connection',
    },
    {
      icon: '📨',
      label: 'Telegram',
      ok:   s ? s.telegram.ok : null,
      detail: s ? (s.telegram.ok ? 'Configured' : 'Config error') : '…',
      sub: s ? (s.telegram.tokenSet && s.telegram.chatIdSet ? 'Token + Chat ID set' : 'Missing env vars') : '',
    },
    {
      icon: '⏱️',
      label: 'Cron',
      ok:   s ? true : null,
      detail: s ? (s.cron.running ? 'Running' : 'Idle') : '…',
      sub: s?.cron.lastRun ? `Last: ${new Date(s.cron.lastRun).toLocaleTimeString('en-IN')}` : 'Not run yet',
    },
    {
      icon: '🔗',
      label: 'EarnKaro',
      ok:   s ? s.earnkaro.connected : null,
      detail: s ? (s.earnkaro.connected ? `Connected (${s.earnkaro.score}%)` : 'Disconnected') : '…',
      sub: 'Affiliate session',
    },
    {
      icon: '📋',
      label: 'Queue',
      ok:   s ? s.queue.ok : null,
      detail: s ? `${s.queue.pending} pending · ${s.queue.active} active` : '…',
      sub: s ? `${s.queue.processed} processed total` : '',
    },
    {
      icon: '🎬',
      label: 'Reel Gen',
      ok:   s ? s.reelGen.ok : null,
      detail: s ? 'FFmpeg ready' : '…',
      sub: 'Sharp + FFmpeg pipeline',
    },
  ];

  if (loading && !health) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="h-20 bg-gray-100 rounded-2xl animate-pulse" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center gap-2.5 p-3.5 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700">
        <span>⚠️</span> {error}
        <button onClick={fetch} className="ml-auto text-xs underline touch-manipulation">Retry</button>
      </div>
    );
  }

  const passed = cards.filter((c) => c.ok === true).length;
  const total  = cards.length;

  return (
    <div className="space-y-3">
      {/* Summary bar */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <span className="font-semibold text-gray-800">{passed}/{total}</span> services healthy
        </div>
        <button
          onClick={fetch}
          className="text-xs text-blue-600 hover:text-blue-800 transition-colors touch-manipulation"
        >
          ↻ Refresh
        </button>
      </div>

      {/* Health bar */}
      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{
            width: `${(passed / total) * 100}%`,
            background: passed === total ? '#10b981' : passed >= total / 2 ? '#f59e0b' : '#ef4444',
          }}
        />
      </div>

      {/* Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {cards.map((c) => <HealthCard key={c.label} {...c} />)}
      </div>
    </div>
  );
}
