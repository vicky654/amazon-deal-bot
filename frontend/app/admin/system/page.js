'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { systemApi } from '../../../lib/api';
import HealthDashboard  from '../../../components/HealthDashboard';
import AutoModeWidget   from '../../../components/AutoModeWidget';
import {
  Activity,
  CheckCircle2,
  XCircle,
  Clock,
  RefreshCw,
  AlertTriangle,
  Terminal,
} from 'lucide-react';

const REFRESH_INTERVAL_MS = 8000;

function formatDate(iso) {
  if (!iso) return '—';
  try {
    return new Intl.DateTimeFormat('en-IN', {
      dateStyle: 'short', timeStyle: 'medium', hour12: true,
    }).format(new Date(iso));
  } catch { return iso; }
}

function timeAgo(iso) {
  if (!iso) return null;
  const diff = Date.now() - new Date(iso).getTime();
  const sec  = Math.floor(diff / 1000);
  if (sec < 60)  return `${sec}s ago`;
  const min  = Math.floor(sec / 60);
  if (min < 60)  return `${min}m ago`;
  const hr   = Math.floor(min / 60);
  return `${hr}h ago`;
}

export default function SystemPage() {
  const [status,      setStatus]      = useState(null);
  const [tgDebug,     setTgDebug]     = useState(null);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState(null);
  const [refreshedAt, setRefreshedAt] = useState(null);
  const intervalRef = useRef(null);

  const fetchAll = useCallback(async () => {
    try {
      const [cron, tg] = await Promise.all([
        systemApi.cronStatus(),
        systemApi.telegramDebug(),
      ]);
      setStatus(cron);
      setTgDebug(tg);
      setError(null);
      setRefreshedAt(new Date());
    } catch (e) {
      setError(e.message || 'Failed to fetch system status');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
    intervalRef.current = setInterval(fetchAll, REFRESH_INTERVAL_MS);
    return () => clearInterval(intervalRef.current);
  }, [fetchAll]);

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900">System Status</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Health dashboard · Cron monitor · Telegram diagnostics
          </p>
        </div>
        <div className="flex items-center gap-3">
          {refreshedAt && (
            <span className="text-xs text-slate-400">Updated {timeAgo(refreshedAt.toISOString())}</span>
          )}
          <button
            onClick={fetchAll}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 transition touch-manipulation"
          >
            <RefreshCw className="w-4 h-4" />
            <span className="hidden sm:inline">Refresh</span>
          </button>
        </div>
      </div>

      {/* ── Error banner ── */}
      {error && (
        <div className="flex items-start gap-3 p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* ══════════════════════════════════════════
          SECTION 0: Auto Mode toggle
      ══════════════════════════════════════════ */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider">
          Automation Control
        </h2>
        <AutoModeWidget />
      </section>

      {/* ══════════════════════════════════════════
          SECTION 1: All-services health cards
      ══════════════════════════════════════════ */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider">
          Service Health
        </h2>
        <HealthDashboard />
      </section>

      {/* ══════════════════════════════════════════
          SECTION 2: Cron timing cards
      ══════════════════════════════════════════ */}
      {loading && !status ? (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => <div key={i} className="h-24 bg-slate-100 rounded-xl animate-pulse" />)}
        </div>
      ) : (
        <>
          <section className="space-y-3">
            <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider">Cron Job</h2>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Running state */}
              <div className={`rounded-xl border p-4 flex items-center gap-4 ${
                status?.running ? 'bg-emerald-50 border-emerald-200' : 'bg-white border-slate-200'
              }`}>
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                  status?.running ? 'bg-emerald-100' : 'bg-slate-100'
                }`}>
                  <Activity className={`w-5 h-5 ${status?.running ? 'text-emerald-600 animate-pulse' : 'text-slate-400'}`} />
                </div>
                <div>
                  <p className="text-xs text-slate-500">Status</p>
                  <p className={`text-base font-bold ${status?.running ? 'text-emerald-700' : 'text-slate-700'}`}>
                    {status?.running ? '🟢 Running' : '⚪ Idle'}
                  </p>
                </div>
              </div>

              {/* Last run */}
              <div className="rounded-xl border border-slate-200 bg-white p-4 flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center shrink-0">
                  <Clock className="w-5 h-5 text-slate-500" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-slate-500">Last Run</p>
                  <p className="text-sm font-semibold text-slate-800 truncate">{formatDate(status?.lastRun)}</p>
                  {status?.lastRun && <p className="text-xs text-slate-400">{timeAgo(status.lastRun)}</p>}
                </div>
              </div>

              {/* Next run */}
              <div className="rounded-xl border border-slate-200 bg-white p-4 flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center shrink-0">
                  <Clock className="w-5 h-5 text-blue-500" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-slate-500">Next Run</p>
                  <p className="text-sm font-semibold text-slate-800 truncate">{formatDate(status?.nextRun)}</p>
                  {status?.nextRun && <p className="text-xs text-slate-400">in {timeAgo(status.nextRun)?.replace(' ago','') || '—'}</p>}
                </div>
              </div>
            </div>
          </section>

          {/* ── Live logs ── */}
          <section className="space-y-3">
            <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-2">
              <Terminal className="w-4 h-4" />
              Live Logs
              <span className="text-xs font-normal normal-case text-slate-400">
                ({status?.logs?.length ?? 0} entries)
              </span>
            </h2>

            <div className="bg-slate-900 rounded-xl overflow-hidden border border-slate-700">
              <div className="px-4 py-2 bg-slate-800 flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-red-500" />
                <span className="w-2.5 h-2.5 rounded-full bg-yellow-500" />
                <span className="w-2.5 h-2.5 rounded-full bg-green-500" />
                <span className="ml-2 text-xs text-slate-400 font-mono">cron.log</span>
                <span className="ml-auto text-[10px] text-slate-500 font-mono">
                  auto-refresh {REFRESH_INTERVAL_MS / 1000}s
                </span>
              </div>

              <div className="p-4 h-56 sm:h-64 overflow-y-auto font-mono text-xs space-y-1 [-webkit-overflow-scrolling:touch]" style={{ scrollbarWidth: 'thin' }}>
                {!status?.logs?.length ? (
                  <p className="text-slate-500 italic">No log entries yet. Waiting for next cron tick…</p>
                ) : (
                  status.logs.map((line, i) => (
                    <p key={i} className={`leading-relaxed break-all ${
                      line.includes('Error') || line.includes('error')   ? 'text-red-400' :
                      line.includes('Skipped') || line.includes('skip')  ? 'text-yellow-400' :
                      line.includes('completed') || line.includes('done')? 'text-green-400' :
                      'text-emerald-400'
                    }`}>
                      {line}
                    </p>
                  ))
                )}
              </div>
            </div>
          </section>

          {/* ── Telegram diagnostics ── */}
          {tgDebug && (
            <section className="space-y-3">
              <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider">Telegram Config</h2>

              <div className={`rounded-xl border p-4 sm:p-5 space-y-4 ${
                tgDebug.ok ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'
              }`}>
                <div className="flex items-center gap-3">
                  {tgDebug.ok
                    ? <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                    : <XCircle      className="w-5 h-5 text-red-500 shrink-0" />
                  }
                  <p className={`font-semibold text-sm ${tgDebug.ok ? 'text-emerald-800' : 'text-red-800'}`}>
                    {tgDebug.ok ? 'Configuration OK' : 'Configuration Issues Detected'}
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                  <div className="bg-white/60 rounded-lg p-3">
                    <p className="text-xs text-slate-500 mb-1">Bot Token</p>
                    <code className="font-mono text-slate-800 break-all">{tgDebug.token}</code>
                  </div>
                  <div className="bg-white/60 rounded-lg p-3">
                    <p className="text-xs text-slate-500 mb-1">Chat ID</p>
                    <code className="font-mono text-slate-800">{tgDebug.chatId}</code>
                  </div>
                </div>

                {tgDebug.issues?.length > 0 && (
                  <ul className="space-y-2">
                    {tgDebug.issues.map((issue, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-red-700">
                        <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                        {issue}
                      </li>
                    ))}
                  </ul>
                )}

                <p className="text-xs text-slate-600 italic">{tgDebug.hint}</p>
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
