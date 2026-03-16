'use client';

import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

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
      {/* Summary row */}
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors text-left"
      >
        <StatusBadge status={run.status} />

        <span className="text-xs text-slate-500 shrink-0">{timeAgo(run.startedAt)}</span>

        <div className="flex-1 flex flex-wrap gap-2">
          {s.productsScanned != null && (
            <span className="text-xs text-slate-600">
              <span className="font-semibold">{s.productsScanned}</span> scraped
            </span>
          )}
          {s.dealsFound != null && (
            <span className="text-xs text-green-700">
              <span className="font-semibold">{s.dealsFound}</span> deals
            </span>
          )}
          {s.dealsPosted != null && (
            <span className="text-xs text-blue-600">
              <span className="font-semibold">{s.dealsPosted}</span> posted
            </span>
          )}
          {s.errors > 0 && (
            <span className="text-xs text-red-500">
              <span className="font-semibold">{s.errors}</span> errors
            </span>
          )}
        </div>

        <span className="text-xs text-slate-400 shrink-0">{duration(run.durationMs)}</span>

        <svg
          className={`w-3.5 h-3.5 text-slate-400 shrink-0 transition-transform ${expanded ? 'rotate-180' : ''}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Expanded detail */}
      {expanded && (
        <div className="border-t border-slate-100 bg-slate-50 px-4 py-3">
          {/* Stats grid */}
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 mb-3">
            <MiniStat label="Categories" value={s.categoriesScanned} color="slate"  />
            <MiniStat label="Links"      value={s.linksExtracted}    color="slate"  />
            <MiniStat label="Scraped"    value={s.productsScanned}   color="orange" />
            <MiniStat label="Deals"      value={s.dealsFound}        color="green"  />
            <MiniStat label="Posted"     value={s.dealsPosted}       color="blue"   />
            <MiniStat label="Errors"     value={s.errors}            color={s.errors > 0 ? 'red' : 'slate'} />
          </div>

          {/* Category breakdown */}
          {run.categoryStats && run.categoryStats.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                Category breakdown
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                {run.categoryStats.map((cat) => (
                  <div key={cat.categoryId} className="flex items-center justify-between bg-white border border-slate-100 rounded-lg px-3 py-1.5">
                    <span className="text-xs text-slate-600 truncate mr-2">{cat.categoryName}</span>
                    <span className="text-xs font-semibold text-slate-800 shrink-0">{cat.linksFound}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

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

/* ── Main panel ───────────────────────────────────────────────────────────── */

/**
 * Props:
 *   onToast: ({ type, message }) => void
 */
export default function CrawlerPanel({ onToast }) {
  const [status, setStatus]   = useState(null);   // { isRunning, queueStats, recentRuns }
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);

  const fetchStatus = useCallback(async () => {
    try {
      const { data } = await axios.get(`${API_URL}/api/crawler/status`);
      setStatus(data);
    } catch {
      // Silently keep stale data — backend may be starting up
    } finally {
      setLoading(false);
    }
  }, []);

  // Poll every 10 seconds while panel is visible
  useEffect(() => {
    fetchStatus();
    const timer = setInterval(fetchStatus, 10000);
    return () => clearInterval(timer);
  }, [fetchStatus]);

  async function handleStart() {
    if (status?.isRunning) return;
    setStarting(true);
    try {
      await axios.post(`${API_URL}/api/crawler/start`);
      onToast({ type: 'success', message: 'Crawl cycle started!' });
      // Poll quickly to pick up the new "running" status
      setTimeout(fetchStatus, 1500);
    } catch (err) {
      const msg = err.response?.data?.error || 'Failed to start crawler';
      onToast({ type: 'error', message: msg });
    } finally {
      setStarting(false);
    }
  }

  const isRunning   = status?.isRunning ?? false;
  const queueStats  = status?.queueStats ?? {};
  const recentRuns  = status?.recentRuns ?? [];
  const lastRun     = recentRuns[0];

  return (
    <div className="space-y-4">

      {/* Live status card */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg shrink-0 ${isRunning ? 'bg-blue-50 border border-blue-100' : 'bg-orange-50 border border-orange-100'}`}>
              {isRunning ? '⚙️' : '🔍'}
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-900">Crawler Status</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                {isRunning ? 'Crawl cycle in progress…' : 'Idle — scheduled every 5 min'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={fetchStatus}
              className="p-2 rounded-lg border border-slate-200 bg-slate-50 text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition-all"
              title="Refresh status"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
            <button
              onClick={handleStart}
              disabled={isRunning || starting}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-white transition-all
                ${isRunning || starting
                  ? 'bg-slate-300 cursor-not-allowed'
                  : 'bg-orange-500 hover:bg-orange-600 shadow-sm shadow-orange-500/30'}`}
            >
              {isRunning || starting ? (
                <>
                  <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                  </svg>
                  Running…
                </>
              ) : (
                <>
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Run Now
                </>
              )}
            </button>
          </div>
        </div>

        {/* Live queue stats (visible while running) */}
        {isRunning && (
          <div className="grid grid-cols-4 gap-2 mb-4 p-3 bg-blue-50 border border-blue-100 rounded-xl">
            <MiniStat label="Pending"   value={queueStats.pending}        color="blue"   />
            <MiniStat label="Active"    value={queueStats.active}         color="orange" />
            <MiniStat label="Processed" value={queueStats.processed}      color="green"  />
            <MiniStat label="Seen"      value={queueStats.seenThisCycle}  color="slate"  />
          </div>
        )}

        {/* Last run summary */}
        {!loading && lastRun && (
          <div className="flex flex-wrap items-center gap-3 pt-3 border-t border-slate-100">
            <span className="text-xs text-slate-500">Last run:</span>
            <StatusBadge status={lastRun.status} />
            <span className="text-xs text-slate-400">{timeAgo(lastRun.startedAt)}</span>
            <span className="text-xs text-slate-400">·</span>
            <span className="text-xs text-slate-500">
              {lastRun.stats?.dealsPosted ?? 0} deals posted in {duration(lastRun.durationMs)}
            </span>
          </div>
        )}

        {loading && (
          <div className="flex items-center gap-2 pt-3 border-t border-slate-100">
            <svg className="w-3.5 h-3.5 text-slate-400 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
            </svg>
            <span className="text-xs text-slate-400">Loading status…</span>
          </div>
        )}
      </div>

      {/* Run history */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Run History</h3>
            <p className="text-xs text-slate-400 mt-0.5">Last {recentRuns.length} crawl cycles · auto-refreshes every 10s</p>
          </div>
        </div>

        {loading && recentRuns.length === 0 && (
          <div className="px-5 py-8 flex items-center justify-center gap-2">
            <svg className="w-5 h-5 text-slate-300 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
            </svg>
            <span className="text-sm text-slate-400">Loading history…</span>
          </div>
        )}

        {!loading && recentRuns.length === 0 && (
          <div className="px-5 py-10 flex flex-col items-center gap-3 text-center">
            <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-2xl">🕐</div>
            <div>
              <p className="text-sm font-medium text-slate-600">No runs yet</p>
              <p className="text-xs text-slate-400 mt-1">Click "Run Now" to start the first crawl cycle.</p>
            </div>
          </div>
        )}

        {recentRuns.length > 0 && (
          <div className="p-3 space-y-2">
            {recentRuns.map((run) => (
              <RunRow key={run._id} run={run} />
            ))}
          </div>
        )}
      </div>

      {/* Architecture info */}
      <div className="bg-slate-900 rounded-2xl p-5">
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Architecture</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {[
            { icon: '🔍', label: 'Category Extractor', sub: 'axios + cheerio' },
            { icon: '⚙️', label: 'Product Queue',      sub: `concurrency ${queueStats.concurrency ?? 2}` },
            { icon: '🤖', label: 'Puppeteer Scraper',  sub: 'singleton browser' },
            { icon: '🧠', label: 'Deal Filter',         sub: '60% off / price drop' },
          ].map((item) => (
            <div key={item.label} className="bg-slate-800 rounded-xl p-3">
              <span className="text-base">{item.icon}</span>
              <p className="text-xs font-semibold text-slate-200 mt-1.5 leading-tight">{item.label}</p>
              <p className="text-[10px] text-slate-500 mt-0.5">{item.sub}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
