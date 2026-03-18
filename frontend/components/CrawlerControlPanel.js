'use client';

import { useState, useEffect, useCallback } from 'react';
import { crawlerApi, ApiError } from '../lib/api';

function StatBox({ label, value, color = 'gray' }) {
  const colors = {
    blue:  'bg-blue-50 text-blue-700 border-blue-200',
    green: 'bg-green-50 text-green-700 border-green-200',
    red:   'bg-red-50 text-red-700 border-red-200',
    gray:  'bg-gray-50 text-gray-700 border-gray-200',
  };
  return (
    <div className={`rounded-lg border px-4 py-3 text-center ${colors[color]}`}>
      <p className="text-2xl font-bold">{value ?? '—'}</p>
      <p className="text-xs mt-0.5 opacity-75">{label}</p>
    </div>
  );
}

function QueueStats({ stats }) {
  if (!stats) return null;
  return (
    <div className="mt-4 grid grid-cols-2 gap-3">
      <div className="rounded-lg border border-blue-100 bg-blue-50 p-3">
        <p className="text-xs font-medium text-blue-600 mb-2">Scrape Queue</p>
        <div className="flex justify-between text-xs text-blue-900">
          <span>Pending: <b>{stats.scrape?.pending ?? 0}</b></span>
          <span>Active: <b>{stats.scrape?.active ?? 0}</b></span>
          <span>Workers: <b>{stats.scrape?.concurrency ?? 2}</b></span>
        </div>
      </div>
      <div className="rounded-lg border border-purple-100 bg-purple-50 p-3">
        <p className="text-xs font-medium text-purple-600 mb-2">Affiliate Queue</p>
        <div className="flex justify-between text-xs text-purple-900">
          <span>Pending: <b>{stats.affiliate?.pending ?? 0}</b></span>
          <span>Active: <b>{stats.affiliate?.active ?? 0}</b></span>
          <span>Workers: <b>{stats.affiliate?.concurrency ?? 1}</b></span>
        </div>
      </div>
    </div>
  );
}

function RunCard({ run }) {
  const [expanded, setExpanded] = useState(false);

  const statusColors = {
    completed: 'bg-green-100 text-green-700 border-green-200',
    running:   'bg-blue-100 text-blue-700 border-blue-200',
    failed:    'bg-red-100 text-red-700 border-red-200',
  };

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 text-left transition-colors">
        <div className="flex items-center gap-3">
          <span className={`text-xs font-medium px-2.5 py-1 rounded-full border ${statusColors[run.status] || statusColors.completed}`}>
            {run.status}
          </span>
          <span className="text-sm text-gray-700">
            {new Date(run.startedAt).toLocaleString()}
          </span>
          {run.durationMs && (
            <span className="text-xs text-gray-400">{Math.round(run.durationMs / 1000)}s</span>
          )}
        </div>
        <svg className={`h-4 w-4 text-gray-400 transition-transform ${expanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/></svg>
      </button>

      {expanded && (
        <div className="px-4 pb-4 pt-3">
          {run.stats && (
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 mb-4">
              <StatBox label="Categories"  value={run.stats.categoriesScanned} color="gray" />
              <StatBox label="Links"       value={run.stats.linksExtracted}    color="gray" />
              <StatBox label="Scraped"     value={run.stats.productsScanned}   color="blue" />
              <StatBox label="Deals"       value={run.stats.dealsFound}        color="green" />
              <StatBox label="Posted"      value={run.stats.dealsPosted}       color="green" />
              <StatBox label="Errors"      value={run.stats.errors}            color="red" />
            </div>
          )}

          {run.categoryStats?.length > 0 && (
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Category Breakdown</p>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead><tr className="text-gray-400 border-b border-gray-100">
                    <th className="pb-1 text-left">Category</th>
                    <th className="pb-1 text-left">Platform</th>
                    <th className="pb-1 text-right">Found</th>
                    <th className="pb-1 text-right">New</th>
                  </tr></thead>
                  <tbody>
                    {run.categoryStats.map((s, i) => (
                      <tr key={i} className="border-b border-gray-50">
                        <td className="py-1 text-gray-700">{s.categoryName}</td>
                        <td className="py-1 text-gray-500 capitalize">{s.platform}</td>
                        <td className="py-1 text-right text-gray-700">{s.linksFound}</td>
                        <td className="py-1 text-right text-blue-600 font-medium">{s.newLinks}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {run.error && (
            <div className="mt-3 text-xs text-red-700 bg-red-50 border border-red-200 rounded px-3 py-2">
              <b>Error:</b> {run.error}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function CrawlerControlPanel() {
  const [status,   setStatus]   = useState(null);
  const [loading,  setLoading]  = useState(true);
  const [starting, setStarting] = useState(false);
  const [toast,    setToast]    = useState('');
  const [runs,     setRuns]     = useState([]);

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 3000); };

  const fetchStatus = useCallback(async () => {
    try {
      const data = await crawlerApi.status();
      setStatus(data);
      setRuns(data.recentRuns || []);
    } catch { /* silent refresh */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 10000);
    return () => clearInterval(interval);
  }, [fetchStatus]);

  const handleStart = async () => {
    setStarting(true);
    try {
      await crawlerApi.start();
      showToast('Crawl cycle started!');
      setTimeout(fetchStatus, 1000);
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : 'Failed to start crawler');
    } finally {
      setStarting(false);
    }
  };

  const isRunning = status?.isRunning;

  return (
    <div className="space-y-4">
      {/* Status card */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-sm font-semibold text-gray-900">Crawler Status</h2>
            <div className="flex items-center gap-2 mt-1">
              <span className={`h-2 w-2 rounded-full ${isRunning ? 'bg-green-500 animate-pulse' : 'bg-gray-300'}`} />
              <span className="text-xs text-gray-500">{isRunning ? 'Running' : 'Idle'}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={fetchStatus}
              className="text-xs border border-gray-300 px-3 py-1.5 rounded-lg text-gray-600 hover:bg-gray-50 flex items-center gap-1">
              <svg className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
              Refresh
            </button>
            <button onClick={handleStart} disabled={isRunning || starting}
              className="text-xs bg-blue-600 text-white px-4 py-1.5 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 font-medium">
              {starting || isRunning
                ? <><svg className="h-3.5 w-3.5 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg> Running</>
                : <><svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg> Start Crawl</>
              }
            </button>
          </div>
        </div>

        {/* Queue stats */}
        {status?.queueStats && <QueueStats stats={status.queueStats} />}
      </div>

      {/* Run history */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-200">
          <h2 className="text-sm font-semibold text-gray-900">Run History</h2>
          <p className="text-xs text-gray-500 mt-0.5">Last {runs.length} crawl cycles</p>
        </div>
        <div className="p-4 space-y-2">
          {loading && runs.length === 0 ? (
            <div className="py-6 text-center text-sm text-gray-400">Loading...</div>
          ) : runs.length === 0 ? (
            <div className="py-6 text-center text-sm text-gray-400">No crawl runs yet</div>
          ) : (
            runs.map((run) => <RunCard key={run._id || run.startedAt} run={run} />)
          )}
        </div>
      </div>

      {toast && (
        <div className="fixed bottom-6 right-6 z-50 bg-gray-900 text-white text-sm px-4 py-2.5 rounded-lg shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
}
