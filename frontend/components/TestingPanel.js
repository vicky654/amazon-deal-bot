'use client';

import { useState, useCallback } from 'react';
import { systemApi } from '../lib/api';

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(iso) {
  if (!iso) return '—';
  return new Intl.DateTimeFormat('en-IN', { timeStyle: 'medium', hour12: true }).format(new Date(iso));
}

// ── Status badge ──────────────────────────────────────────────────────────────

function Badge({ ok, label }) {
  if (ok === null) return (
    <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-gray-100 text-gray-500">
      <span className="h-1.5 w-1.5 rounded-full bg-gray-400" />
      {label || 'Not tested'}
    </span>
  );
  return ok ? (
    <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
      {label || 'Success'}
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-red-100 text-red-700">
      <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
      {label || 'Failed'}
    </span>
  );
}

function Spinner() {
  return (
    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

// ── Single test card ──────────────────────────────────────────────────────────

function TestCard({ test, onRun }) {
  const { id, label, description, icon, result, loading } = test;

  return (
    <div className={`bg-white rounded-2xl border shadow-sm overflow-hidden transition-all ${
      result === null ? 'border-gray-200' :
      result?.ok     ? 'border-emerald-200 shadow-emerald-50' : 'border-red-200 shadow-red-50'
    }`}>
      {/* Card header */}
      <div className={`px-4 py-3 flex items-center gap-3 border-b ${
        result === null ? 'bg-gray-50 border-gray-100' :
        result?.ok     ? 'bg-emerald-50 border-emerald-100' : 'bg-red-50 border-red-100'
      }`}>
        <div className="text-2xl shrink-0">{icon}</div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900">{label}</p>
          <p className="text-[11px] text-gray-500 truncate">{description}</p>
        </div>
        {result !== null && <Badge ok={result?.ok} />}
      </div>

      {/* Result body */}
      <div className="px-4 py-3 space-y-3">
        {result !== null && (
          <div className="space-y-1.5">
            {result.error && (
              <div className="bg-red-50 border border-red-100 rounded-xl px-3 py-2">
                <p className="text-[11px] font-mono text-red-600 break-all">{result.error}</p>
              </div>
            )}
            {result.message && (
              <p className="text-xs text-gray-600 bg-gray-50 rounded-xl px-3 py-2">{result.message}</p>
            )}
            {result.affiliateLink && (
              <div className="bg-blue-50 border border-blue-100 rounded-xl px-3 py-2">
                <p className="text-[10px] text-gray-500 mb-0.5">Affiliate link generated:</p>
                <p className="text-[11px] font-mono text-blue-700 break-all line-clamp-2">{result.affiliateLink}</p>
              </div>
            )}
            {result.product?.title && (
              <div className="bg-green-50 border border-green-100 rounded-xl px-3 py-2">
                <p className="text-[10px] text-gray-500 mb-0.5">Scraped product:</p>
                <p className="text-[11px] text-gray-800 line-clamp-2">{result.product.title}</p>
                {result.product.price && <p className="text-[11px] font-bold text-emerald-700 mt-0.5">₹{Number(result.product.price).toLocaleString('en-IN')}</p>}
              </div>
            )}
            <div className="flex items-center justify-between text-[10px] text-gray-400">
              <span>Tested at {fmt(result.testedAt)}</span>
              {result.ms && <span>{result.ms}ms</span>}
            </div>
          </div>
        )}

        <button
          onClick={() => onRun(id)}
          disabled={loading}
          className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all touch-manipulation ${
            loading
              ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
              : result?.ok
              ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
              : result?.ok === false
              ? 'bg-red-600 hover:bg-red-700 text-white'
              : 'bg-slate-800 hover:bg-slate-900 text-white'
          }`}
        >
          {loading ? <><Spinner /> Running…</> : result !== null ? 'Run Again' : 'Run Test'}
        </button>
      </div>
    </div>
  );
}

// ── Summary table ─────────────────────────────────────────────────────────────

function SummaryTable({ tests }) {
  const tested = tests.filter((t) => t.result !== null);
  if (tested.length === 0) return null;

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
        <h3 className="text-sm font-semibold text-gray-800">Test Results Summary</h3>
      </div>

      {/* Mobile: stacked */}
      <div className="sm:hidden divide-y divide-gray-100">
        {tests.map((t) => (
          <div key={t.id} className="px-4 py-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-base shrink-0">{t.icon}</span>
              <span className="text-sm font-medium text-gray-800 truncate">{t.label}</span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Badge ok={t.result?.ok ?? null} />
              {t.result?.testedAt && (
                <span className="text-[10px] text-gray-400 hidden xs:block">{fmt(t.result.testedAt)}</span>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Desktop: table */}
      <div className="hidden sm:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 text-xs font-semibold text-gray-500 uppercase tracking-wide">
              <th className="px-4 py-2.5 text-left">Feature</th>
              <th className="px-4 py-2.5 text-center">Status</th>
              <th className="px-4 py-2.5 text-right">Last Tested</th>
              <th className="px-4 py-2.5 text-right">Response</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {tests.map((t) => (
              <tr key={t.id} className="hover:bg-gray-50/60 transition-colors">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{t.icon}</span>
                    <div>
                      <p className="font-medium text-gray-800">{t.label}</p>
                      <p className="text-[11px] text-gray-400">{t.description}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 text-center">
                  <Badge ok={t.result?.ok ?? null} />
                </td>
                <td className="px-4 py-3 text-right text-xs text-gray-400">
                  {t.result?.testedAt ? fmt(t.result.testedAt) : '—'}
                </td>
                <td className="px-4 py-3 text-right text-xs text-gray-500 tabular-nums">
                  {t.result?.ms ? `${t.result.ms}ms` : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Footer counts */}
      <div className="px-4 py-3 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
        <span>
          {tested.length} tested ·{' '}
          <span className="text-emerald-600 font-medium">{tested.filter((t) => t.result?.ok).length} passed</span>
          {tested.filter((t) => !t.result?.ok).length > 0 && (
            <span className="text-red-600 font-medium"> · {tested.filter((t) => !t.result?.ok).length} failed</span>
          )}
        </span>
        <span className="text-gray-400">{tests.length - tested.length} not yet tested</span>
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

const INITIAL_TESTS = [
  {
    id: 'telegram',
    label: 'Telegram Message',
    description: 'Sends a test message to your Telegram channel',
    icon: '📨',
    result: null,
    loading: false,
  },
  {
    id: 'cron',
    label: 'Cron Trigger',
    description: 'Manually fires one full crawl cycle',
    icon: '⏱️',
    result: null,
    loading: false,
  },
  {
    id: 'affiliate',
    label: 'Affiliate Link',
    description: 'Generates an EarnKaro affiliate link for a test product',
    icon: '🔗',
    result: null,
    loading: false,
  },
  {
    id: 'scraper',
    label: 'Product Scraper',
    description: 'Scrapes a known Amazon product and verifies data extraction',
    icon: '🕷️',
    result: null,
    loading: false,
  },
];

const RUNNERS = {
  telegram:  systemApi.testTelegram,
  cron:      systemApi.testCron,
  affiliate: systemApi.testAffiliate,
  scraper:   systemApi.testScraper,
};

export default function TestingPanel() {
  const [tests, setTests] = useState(INITIAL_TESTS);

  const setTest = useCallback((id, patch) => {
    setTests((prev) => prev.map((t) => t.id === id ? { ...t, ...patch } : t));
  }, []);

  const runTest = useCallback(async (id) => {
    setTest(id, { loading: true });
    try {
      const data = await RUNNERS[id]();
      setTest(id, { loading: false, result: { ...data, testedAt: new Date().toISOString() } });
    } catch (err) {
      setTest(id, { loading: false, result: { ok: false, error: err.message, testedAt: new Date().toISOString() } });
    }
  }, [setTest]);

  const runAll = useCallback(async () => {
    for (const t of INITIAL_TESTS) {
      await runTest(t.id);
    }
  }, [runTest]);

  const allTested = tests.every((t) => t.result !== null);
  const anyLoading = tests.some((t) => t.loading);

  return (
    <div className="space-y-6">
      {/* Header actions */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-sm text-slate-500">
          Run individual tests or all at once to verify each system component.
        </p>
        <button
          onClick={runAll}
          disabled={anyLoading}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold bg-slate-800 hover:bg-slate-900 text-white disabled:opacity-50 transition-all touch-manipulation"
        >
          {anyLoading ? <><Spinner /> Running…</> : '▶ Run All Tests'}
        </button>
      </div>

      {/* Test cards grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {tests.map((t) => (
          <TestCard key={t.id} test={t} onRun={runTest} />
        ))}
      </div>

      {/* Summary table (appears after first test) */}
      <SummaryTable tests={tests} />

      {/* Pro tip */}
      {!allTested && (
        <div className="flex items-start gap-2.5 text-xs text-blue-700 bg-blue-50 border border-blue-100 rounded-xl p-3">
          <svg className="h-4 w-4 shrink-0 mt-0.5 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd"/>
          </svg>
          <span>
            <strong>Tip:</strong> Use "Run All Tests" after deployment to quickly verify all integrations are working in production.
            Scraper and Cron tests may take 15–45 seconds.
          </span>
        </div>
      )}
    </div>
  );
}
