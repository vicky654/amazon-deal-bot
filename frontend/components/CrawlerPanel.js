'use client';

import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://deal-system-backend.onrender.com';

/* ── Helpers ─────────────────────────────────────────────────────────────── */

function timeAgo(dateString) {
  if (!dateString) return '—';
  const diff = Date.now() - new Date(dateString).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60)  return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60)  return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24)  return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function duration(ms) {
  if (!ms) return '—';
  if (ms < 1000)  return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60000)}m ${Math.round((ms % 60000) / 1000)}s`;
}

/* ── Status badge ─────────────────────────────────────────────────────────── */

function StatusBadge({ status }) {
  const map = {
    running:   { dot: 'bg-blue-400 animate-pulse', text: 'text-blue-700',  bg: 'bg-blue-50  border-blue-200',  label: 'Running'   },
    completed: { dot: 'bg-green-400',              text: 'text-green-700', bg: 'bg-green-50 border-green-200', label: 'Completed' },
    failed:    { dot: 'bg-red-400',                text: 'text-red-700',   bg: 'bg-red-50   border-red-200',   label: 'Failed'    },
  };
  const s = map[status] || map.completed;
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2 py-0.5 rounded-full border ${s.bg} ${s.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
      {s.label}
    </span>
  );
}

/* ── Stat mini-card ───────────────────────────────────────────────────────── */

function MiniStat({ label, value, color = 'slate' }) {
  const colors = {
    orange: 'bg-orange-50 border-orange-100 text-orange-600',
    green:  'bg-green-50  border-green-100  text-green-600',
    blue:   'bg-blue-50   border-blue-100   text-blue-600',
    slate:  'bg-slate-50  border-slate-100  text-slate-600',
    red:    'bg-red-50    border-red-100    text-red-600',
  };
  return (
    <div className={`rounded-lg border px-3 py-2 ${colors[color]}`}>
      <p className="text-lg font-bold leading-none">{value ?? '—'}</p>
      <p className="text-[10px] font-medium mt-0.5 opacity-70">{label}</p>
    </div>
  );
}

/* ── Single run row ───────────────────────────────────────────────────────── */

function RunRow({ run }) {
  const [expanded, setExpanded] = useState(false);
  const s = run.stats || {};

  return (
    <div className="border border-slate-100 rounded-xl overflow-hidden">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors text-left"
      >
        <StatusBadge status={run.status} />
        <span className="text-xs text-slate-500 shrink-0">{timeAgo(run.startedAt)}</span>
        <div className="flex-1 flex flex-wrap gap-2">
          {s.productsScanned != null && <span className="text-xs text-slate-600 font-semibold">{s.productsScanned} scraped</span>}
          {s.dealsFound != null && <span className="text-xs text-green-700 font-semibold">{s.dealsFound} deals</span>}
          {s.dealsPosted != null && <span className="text-xs text-blue-600 font-semibold">{s.dealsPosted} posted</span>}
        </div>
        <span className="text-xs text-slate-400 shrink-0">{duration(run.durationMs)}</span>
        <svg className={`w-3.5 h-3.5 text-slate-400 shrink-0 transition-transform ${expanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
      </button>

      {expanded && (
        <div className="border-t border-slate-100 bg-slate-50 px-4 py-3">
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 mb-3">
            <MiniStat label="Categories" value={s.categoriesScanned} color="slate" />
            <MiniStat label="Links"      value={s.linksExtracted}    color="slate" />
            <MiniStat label="Scraped"    value={s.productsScanned}   color="orange" />
            <MiniStat label="Deals"      value={s.dealsFound}        color="green" />
            <MiniStat label="Posted"     value={s.dealsPosted}       color="blue" />
            <MiniStat label="Errors"     value={s.errors}            color={s.errors > 0 ? 'red' : 'slate'} />
          </div>
          {run.error && (
            <div className="mt-2 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
              <p className="text-xs text-red-600 font-mono">{run.error}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ── Main Panel ───────────────────────────────────────────────────────────── */

export default function CrawlerPanel({ onToast }) {
  const [status, setStatus]   = useState(null);   // { running, status, currentCategory, ... }
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [localStatus, setLocalStatus] = useState(null); // 'restarting' etc.

  const fetchStatus = useCallback(async () => {
    try {
      const { data } = await axios.get(`${API_URL}/api/crawler/status`);
      setStatus(data);
    } catch {
      // Silently keep stale data
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
    const timer = setInterval(fetchStatus, 10000);
    return () => clearInterval(timer);
  }, [fetchStatus]);

  async function handleAction(action) {
    if (actionLoading) return;
    
    setActionLoading(true);
    if (action === 'restart') setLocalStatus('restarting');
    
    try {
      const { data } = await axios.post(`${API_URL}/api/crawler/${action}`);
      onToast({ type: 'success', message: data.message });
      // Quick poll
      setTimeout(fetchStatus, 2000);
    } catch (err) {
      const msg = err.response?.data?.error || `Failed to ${action} crawler`;
      onToast({ type: 'error', message: msg });
    } finally {
      setActionLoading(false);
      setLocalStatus(null);
    }
  }

  const isRunning      = status?.running ?? false;
  const currentStatus  = localStatus || status?.status || 'stopped';
  const lastRun        = status?.lastRun;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      
      {/* ── Main Control Panel (Left 2/3) ── */}
      <div className="lg:col-span-2 space-y-4">
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-6 sm:p-8">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 mb-8">
              <div className="flex items-center gap-4">
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-2xl shrink-0 transition-all duration-500 ${isRunning ? 'bg-emerald-50 border border-emerald-100 rotate-12' : 'bg-slate-50 border border-slate-100'}`}>
                  {isRunning ? '🟢' : '🔴'}
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <h2 className="text-xl font-bold text-slate-900">Amazon Crown</h2>
                    <CrawlerStatusBadge status={currentStatus} />
                  </div>
                  <p className="text-sm text-slate-500">
                    {isRunning ? `Currently scanning ${status.currentCategory}` : 'Standby — waiting for manual start or next cron'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleAction('start')}
                  disabled={isRunning || actionLoading}
                  className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all ${isRunning || actionLoading ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'bg-emerald-500 text-white hover:bg-emerald-600 hover:shadow-lg hover:shadow-emerald-200 active:scale-95'}`}
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" /></svg>
                  Start
                </button>
                <button
                  onClick={() => handleAction('stop')}
                  disabled={!isRunning || actionLoading}
                  className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all ${!isRunning || actionLoading ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'bg-rose-500 text-white hover:bg-rose-600 hover:shadow-lg hover:shadow-rose-200 active:scale-95'}`}
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M9 10h6v4H9z" /></svg>
                  Stop
                </button>
                <button
                  onClick={() => handleAction('restart')}
                  disabled={actionLoading}
                  className={`p-2.5 rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 transition-all ${actionLoading ? 'opacity-50 cursor-not-allowed' : 'active:rotate-180'}`}
                  title="Restart Crawler"
                >
                  <svg className={`w-5 h-5 ${currentStatus === 'restarting' ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                </button>
              </div>
            </div>

            {/* Live Stats Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <LiveStatCard label="Products Scanned" value={status?.productsScanned} icon="🔍" />
              <LiveStatCard label="Deals Sent"      value={status?.dealsSent}       icon="🔥" color="orange" />
              <LiveStatCard label="Active Pages"    value={status?.browserPages}    icon="📄" />
              <LiveStatCard label="Queue Size"      value={status?.queueSize}       icon="📥" />
            </div>
          </div>

          {/* Current Category Bar */}
          {isRunning && (
            <div className="px-6 py-4 bg-emerald-50 border-t border-emerald-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                <span className="text-xs font-bold text-emerald-700 uppercase tracking-wider">Now Scanning</span>
              </div>
              <span className="text-sm font-semibold text-emerald-900">{status.currentCategory}</span>
            </div>
          )}
        </div>

        {/* Recent Run Row (if exists) */}
        {lastRun && (
          <div className="bg-white rounded-2xl border border-slate-200 p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <StatusBadge status={lastRun.status} />
              <span className="text-sm text-slate-500">Last cycle ended {timeAgo(lastRun.finishedAt || lastRun.startedAt)}</span>
            </div>
            <span className="text-sm font-medium text-slate-700">{lastRun.stats?.dealsPosted || 0} deals found</span>
          </div>
        )}
      </div>

      {/* ── Secondary Info (Right 1/3) ── */}
      <div className="space-y-4">
        <div className="bg-slate-900 rounded-3xl p-6 text-white shadow-xl shadow-slate-200">
          <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-6">System Health</h3>
          <div className="space-y-5">
            <HealthItem label="Browser Singleton" status="Stable" icon="🌐" />
            <HealthItem label="Anti-Bot Guard"    status="Active" icon="🛡️" />
            <HealthItem label="Proxy Rotation"    status="Standby" icon="🔄" />
            <HealthItem label="Affiliate Engine"   status="Healthy" icon="🔗" />
          </div>
          
          <div className="mt-8 pt-6 border-t border-slate-800">
            <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider mb-2">Last Run Error</p>
            <p className="text-xs text-slate-300 font-mono line-clamp-2">
              {status?.lastRun?.error || 'None — system clear'}
            </p>
          </div>
        </div>

        <div className="bg-white rounded-3xl border border-slate-200 p-6">
          <h3 className="text-sm font-bold text-slate-900 mb-4">Cron Schedule</h3>
          <div className="flex items-center justify-between bg-slate-50 rounded-2xl p-4">
            <span className="text-xs font-bold text-slate-500 uppercase">Interval</span>
            <span className="text-sm font-bold text-slate-900">Every 5 min</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function CrawlerStatusBadge({ status }) {
  const configs = {
    running:    { label: 'Running',    bg: 'bg-emerald-100', text: 'text-emerald-700', dot: 'bg-emerald-500' },
    stopped:    { label: 'Stopped',    bg: 'bg-slate-100',   text: 'text-slate-600',   dot: 'bg-slate-400'   },
    restarting: { label: 'Restarting', bg: 'bg-amber-100',   text: 'text-amber-700',   dot: 'bg-amber-500 animate-ping' },
  };
  const config = configs[status] || configs.stopped;
  return (
    <span className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${config.bg} ${config.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${config.dot}`} />
      {config.label}
    </span>
  );
}

function LiveStatCard({ label, value, icon, color = 'slate' }) {
  const colors = {
    slate:  'text-slate-900',
    orange: 'text-orange-600',
  };
  return (
    <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100">
      <div className="text-lg mb-1">{icon}</div>
      <div className={`text-xl font-black ${colors[color]}`}>{value ?? 0}</div>
      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">{label}</div>
    </div>
  );
}

function HealthItem({ label, status, icon }) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3">
        <span className="text-lg">{icon}</span>
        <span className="text-xs font-semibold text-slate-300">{label}</span>
      </div>
      <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">{status}</span>
    </div>
  );
}
