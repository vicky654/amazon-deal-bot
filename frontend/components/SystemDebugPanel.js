'use client';

import { useState, useEffect, useCallback } from 'react';

const BASE = (process.env.NEXT_PUBLIC_API_URL || 'https://deal-system-backend.onrender.com').replace(/\/$/, '');

function Badge({ ok, label }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-semibold ${
      ok ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
    }`}>
      <span>{ok ? '✓' : '✗'}</span>{label}
    </span>
  );
}

function Row({ label, value, mono = false }) {
  return (
    <div className="flex items-start justify-between gap-4 py-1.5 border-b border-gray-100 last:border-0">
      <span className="text-xs text-gray-500 shrink-0">{label}</span>
      <span className={`text-xs font-medium text-right break-all ${mono ? 'font-mono' : ''}`}>{value ?? '—'}</span>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
      <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-200">
        <h3 className="text-xs font-semibold text-gray-700 uppercase tracking-wide">{title}</h3>
      </div>
      <div className="px-4 py-2">{children}</div>
    </div>
  );
}

export default function SystemDebugPanel() {
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState(null);
  const [lastFetched, setLastFetched] = useState(null);

  const fetchDebug = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${BASE}/api/debug/crawler`, { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setData(json);
      setLastFetched(new Date().toLocaleTimeString());
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDebug();
    const id = setInterval(fetchDebug, 15000);
    return () => clearInterval(id);
  }, [fetchDebug]);

  return (
    <div className="p-4 space-y-3 max-w-2xl mx-auto">

      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-gray-900">System Debug</h2>
        <div className="flex items-center gap-2">
          {lastFetched && <span className="text-xs text-gray-400">Updated {lastFetched}</span>}
          <button
            onClick={fetchDebug}
            disabled={loading}
            className="text-xs px-3 py-1.5 rounded-lg bg-blue-600 text-white font-medium disabled:opacity-50"
          >
            {loading ? 'Loading…' : 'Refresh'}
          </button>
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          <b>Failed to reach backend:</b> {error}
          <div className="mt-1 text-xs text-red-500">Calling: {BASE}/api/debug/crawler</div>
        </div>
      )}

      {data && (
        <>
          {/* Crawler Status */}
          <Section title="Crawler">
            <div className="flex flex-wrap gap-2 py-2">
              <Badge ok={data.status === 'running'} label={data.status === 'running' ? 'Running' : 'Stopped'} />
              <Badge ok={data.autoMode} label={`Auto Mode ${data.autoMode ? 'ON' : 'OFF'}`} />
            </div>
            <Row label="Deals Scraped"  value={data.crawler?.dealsScraped ?? 0} />
            <Row label="Deals Posted"   value={data.crawler?.dealsPosted  ?? 0} />
            <Row label="Last Run"       value={data.crawler?.lastRun ? new Date(data.crawler.lastRun).toLocaleString() : 'Never'} />
            {data.crawler?.lastError && (
              <div className="mt-2 rounded bg-red-50 border border-red-200 px-3 py-2">
                <p className="text-xs font-semibold text-red-600">Last Error</p>
                <p className="text-xs text-red-700 font-mono mt-0.5">{data.crawler.lastError}</p>
              </div>
            )}
          </Section>

          {/* Telegram */}
          <Section title="Telegram">
            <div className="flex flex-wrap gap-2 py-2">
              <Badge ok={data.telegram?.tokenSet}        label="Token Set" />
              <Badge ok={data.telegram?.chatIdSet}       label="Chat ID Set" />
              <Badge ok={data.telegram?.isTelegramWorking} label="Bot Working" />
            </div>
            <Row label="Chat ID Preview" value={data.telegram?.chatId} mono />
            {data.telegram?.error && (
              <div className="mt-2 rounded bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700 font-mono">
                {data.telegram.error}
              </div>
            )}
          </Section>

          {/* DB */}
          <Section title="Database">
            <Row label="Total Deals"    value={data.db?.totalDeals} />
            <Row label="Posted Deals"   value={data.db?.postedDeals} />
            <Row label="Unposted Deals" value={data.db?.unpostedDeals} />
          </Section>

          {/* Last DB Run */}
          {data.lastDbRun && (
            <Section title="Last Crawl Run">
              <Row label="Status"     value={data.lastDbRun.status} />
              <Row label="Started"    value={data.lastDbRun.startedAt ? new Date(data.lastDbRun.startedAt).toLocaleString() : null} />
              <Row label="Duration"   value={data.lastDbRun.durationMs ? `${(data.lastDbRun.durationMs/1000).toFixed(1)}s` : null} />
              <Row label="Scraped"    value={data.lastDbRun.stats?.productsScanned} />
              <Row label="Deals Found" value={data.lastDbRun.stats?.dealsFound} />
              <Row label="Posted"     value={data.lastDbRun.stats?.dealsPosted} />
              <Row label="Errors"     value={data.lastDbRun.stats?.errors} />
              {data.lastDbRun.error && (
                <div className="mt-2 rounded bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700 font-mono">
                  {data.lastDbRun.error}
                </div>
              )}
            </Section>
          )}

          {/* Chrome */}
          <Section title="Chrome / Puppeteer">
            <div className="flex flex-wrap gap-2 py-2">
              <Badge ok={data.chrome?.found} label={data.chrome?.found ? 'Chrome Found' : 'Chrome Missing'} />
            </div>
            <Row label="Executable"  value={data.chrome?.path || 'Not found'} mono />
            <Row label="Env Path"    value={data.chrome?.envPath || 'Not set'} mono />
          </Section>

          {/* Env Vars */}
          <Section title="Environment Variables">
            {data.env && Object.entries(data.env).map(([key, val]) => (
              <div key={key} className="flex items-center justify-between py-1.5 border-b border-gray-100 last:border-0">
                <span className="text-xs font-mono text-gray-600">{key}</span>
                <Badge ok={val.set} label={val.set ? (val.preview || 'Set') : 'NOT SET'} />
              </div>
            ))}
          </Section>

          {/* System */}
          <Section title="System">
            <Row label="Node"     value={data.system?.nodeVersion} mono />
            <Row label="Platform" value={data.system?.platform} />
            <Row label="Uptime"   value={data.system?.uptime != null ? `${Math.floor(data.system.uptime / 60)}m ${data.system.uptime % 60}s` : null} />
            <Row label="Heap Used"  value={data.system?.memory?.usedMB  != null ? `${data.system.memory.usedMB} MB`  : null} />
            <Row label="Heap Total" value={data.system?.memory?.totalMB != null ? `${data.system.memory.totalMB} MB` : null} />
            <Row label="RSS"        value={data.system?.memory?.rssMB   != null ? `${data.system.memory.rssMB} MB`   : null} />
          </Section>

          {/* Cron Logs */}
          {data.cron?.recentLogs?.length > 0 && (
            <Section title="Cron Logs (last 10)">
              <div className="space-y-1 py-1">
                {data.cron.recentLogs.map((log, i) => (
                  <p key={i} className="text-xs font-mono text-gray-600 break-all">{log}</p>
                ))}
              </div>
            </Section>
          )}

          {/* API URL sanity */}
          <div className="text-xs text-gray-400 text-center pt-1">
            Backend: <span className="font-mono">{BASE}</span>
          </div>
        </>
      )}
    </div>
  );
}
