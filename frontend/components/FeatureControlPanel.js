'use client';

import { useState, useEffect } from 'react';
import FeatureCard from './FeatureCard';
import { useCrawler } from '../context/CrawlerContext';
import { useToast }   from './ToastProvider';
import { earnkaroApi } from '../lib/api';

const LS_KEY = 'dealbot_features';

function loadLocal() {
  try { return JSON.parse(localStorage.getItem(LS_KEY) || '{}'); } catch { return {}; }
}
function saveLocal(patch) {
  try {
    const prev = loadLocal();
    localStorage.setItem(LS_KEY, JSON.stringify({ ...prev, ...patch }));
  } catch {}
}

export default function FeatureControlPanel() {
  const { show } = useToast();

  const {
    crawlerStatus, crawlerLoad, progress,
    autoMode, autoLoading,
    startCrawler, stopCrawler, toggleAutoMode,
    sseConnected,
  } = useCrawler();

  const isRunning  = crawlerStatus === 'running';
  const isStopping = crawlerStatus === 'stopping';

  // ── EarnKaro (local state — not in context) ───────────────────────────────
  const [ekConnected, setEkConnected] = useState(false);
  const [ekLoading,   setEkLoading]   = useState(true);
  const [ekAction,    setEkAction]    = useState(false);

  useEffect(() => {
    earnkaroApi.status()
      .then(d => setEkConnected(d?.connected ?? false))
      .catch(() => {})
      .finally(() => setEkLoading(false));
  }, []);

  const handleToggleEarnkaro = async (val) => {
    setEkLoading(true);
    try {
      if (!val) { await earnkaroApi.disconnect(); setEkConnected(false); show('EarnKaro disconnected', 'info'); }
      else      { const s = await earnkaroApi.status(); setEkConnected(s?.connected ?? false); }
    } catch { show('EarnKaro update failed', 'error'); }
    setEkLoading(false);
  };

  const handleTestEarnkaro = async () => {
    setEkAction(true);
    try { await earnkaroApi.test(); show('EarnKaro connection OK', 'success'); }
    catch { show('EarnKaro test failed', 'error'); }
    setEkAction(false);
  };

  // ── localStorage toggles ──────────────────────────────────────────────────
  const [local, setLocal] = useState({
    duplicatePrev:   true,
    noBooksFilter:   true,
    noSameDay:       true,
    priceDropRepeat: true,
    priceAlerts:     false,
    captionGen:      true,
    reelGen:         false,
    multiChannel:    false,
  });

  useEffect(() => {
    setLocal(prev => ({ ...prev, ...loadLocal() }));
  }, []);

  function setLocalFeature(key, val) {
    setLocal(prev => { const next = { ...prev, [key]: val }; saveLocal({ [key]: val }); return next; });
  }

  // ── Crawler action wrappers with toasts ───────────────────────────────────
  const handleStart = async () => { await startCrawler(); show('Crawler Started', 'success'); };
  const handleStop  = async () => { await stopCrawler();  show('Crawler Stopped', 'info');    };
  const handleAutoMode = async (val) => {
    await toggleAutoMode(val);
    show(val ? 'Auto Mode enabled' : 'Auto Mode paused', val ? 'success' : 'info');
  };

  return (
    <div className="space-y-6">

      {/* ── SSE indicator ── */}
      <div className="flex items-center gap-2">
        <span
          className="w-1.5 h-1.5 rounded-full"
          style={{
            background: sseConnected ? '#10b981' : '#ef4444',
            boxShadow: sseConnected ? '0 0 6px rgba(16,185,129,0.6)' : 'none',
            animation: sseConnected ? 'pulse 2s infinite' : 'none',
          }}
        />
        <span className="text-[11px]" style={{ color: sseConnected ? '#34d399' : '#64748b' }}>
          {sseConnected ? 'Real-time connected' : 'Reconnecting…'}
        </span>
      </div>

      {/* ── Automation Core ── */}
      <Section title="Automation Core" icon="🤖">
        <FeatureCard
          icon="⚡"
          name="Auto Mode"
          description="Auto-posts qualifying deals to Telegram as soon as the crawler finds them. Respects all smart rules."
          enabled={autoMode}
          onToggle={handleAutoMode}
          loading={autoLoading}
          accentColor="#10b981"
          statusText={autoMode ? 'Running — auto-posting enabled' : 'Paused — manual only'}
        />

        {/* Crawler card — Start/Stop + progress */}
        <div
          className="rounded-2xl p-4 flex flex-col gap-3 transition-all duration-200"
          style={{
            background: isRunning
              ? 'linear-gradient(135deg, rgba(249,115,22,0.10), rgba(15,23,42,0.9))'
              : 'rgba(15,23,42,0.9)',
            border: `1px solid ${isRunning ? 'rgba(249,115,22,0.22)' : 'rgba(255,255,255,0.07)'}`,
          }}
        >
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2.5 min-w-0">
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center text-base shrink-0"
                style={{
                  background: isRunning ? 'rgba(249,115,22,0.12)' : 'rgba(30,41,59,0.7)',
                  border: `1px solid ${isRunning ? 'rgba(249,115,22,0.22)' : 'rgba(255,255,255,0.07)'}`,
                }}
              >
                🕷️
              </div>
              <div className="min-w-0">
                <span className="text-[13px] font-semibold text-white">Crawler Control</span>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span
                    className="w-1.5 h-1.5 rounded-full"
                    style={{
                      background: isRunning ? '#10b981' : isStopping ? '#fbbf24' : '#ef4444',
                      boxShadow: isRunning ? '0 0 6px rgba(16,185,129,0.6)' : 'none',
                      animation: isRunning ? 'pulse 2s infinite' : 'none',
                    }}
                  />
                  <p className="text-[11px]" style={{ color: isRunning ? '#f97316' : isStopping ? '#fbbf24' : '#475569' }}>
                    {crawlerLoad ? 'Updating…' : isRunning ? 'Crawling live' : isStopping ? 'Stopping…' : 'Idle'}
                  </p>
                </div>
              </div>
            </div>
            <span
              className="shrink-0 text-[10px] font-bold px-2 py-1 rounded-full"
              style={{
                background: isRunning ? 'rgba(16,185,129,0.12)' : 'rgba(71,85,105,0.15)',
                color: isRunning ? '#34d399' : '#64748b',
                border: isRunning ? '1px solid rgba(16,185,129,0.22)' : '1px solid rgba(71,85,105,0.22)',
              }}
            >
              {isRunning ? '🟢 Running' : isStopping ? '🟡 Stopping' : '🔴 Stopped'}
            </span>
          </div>

          <p className="text-[11px] leading-relaxed" style={{ color: '#64748b' }}>
            Scrapes Amazon, Flipkart, Myntra & Ajio. Smart rules apply before Telegram posting.
          </p>

          {/* Live progress bar */}
          {isRunning && progress && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-semibold" style={{ color: '#64748b' }}>
                  {progress.currentCategory} · {progress.currentPlatform}
                </span>
                <span className="text-[10px]" style={{ color: '#64748b' }}>
                  {progress.categoriesScanned}/{progress.totalCategories}
                </span>
              </div>
              <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(30,41,59,0.8)' }}>
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${Math.round((progress.categoriesScanned / (progress.totalCategories || 1)) * 100)}%`,
                    background: 'linear-gradient(90deg, #f97316, #ea580c)',
                  }}
                />
              </div>
              <div className="flex gap-3">
                {[
                  { label: 'Scanned',  val: progress.productsScanned },
                  { label: 'Deals',    val: progress.dealsFound      },
                  { label: 'Posted',   val: progress.dealsPosted     },
                ].map(({ label, val }) => (
                  <div key={label} className="flex flex-col items-center gap-0.5">
                    <span className="text-[13px] font-bold text-white">{val ?? 0}</span>
                    <span className="text-[9px]" style={{ color: '#475569' }}>{label}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={handleStart}
              disabled={crawlerLoad || isRunning || isStopping}
              className="py-2 rounded-xl text-[12px] font-semibold transition-all active:scale-95 touch-manipulation"
              style={{
                background: crawlerLoad || isRunning || isStopping ? 'rgba(30,41,59,0.6)' : 'rgba(16,185,129,0.12)',
                border: `1px solid ${crawlerLoad || isRunning || isStopping ? 'rgba(255,255,255,0.07)' : 'rgba(16,185,129,0.25)'}`,
                color: crawlerLoad || isRunning || isStopping ? '#475569' : '#34d399',
                cursor: crawlerLoad || isRunning || isStopping ? 'not-allowed' : 'pointer',
              }}
            >
              ▶ Start
            </button>
            <button
              onClick={handleStop}
              disabled={crawlerLoad || !isRunning}
              className="py-2 rounded-xl text-[12px] font-semibold transition-all active:scale-95 touch-manipulation"
              style={{
                background: crawlerLoad || !isRunning ? 'rgba(30,41,59,0.6)' : 'rgba(239,68,68,0.12)',
                border: `1px solid ${crawlerLoad || !isRunning ? 'rgba(255,255,255,0.07)' : 'rgba(239,68,68,0.25)'}`,
                color: crawlerLoad || !isRunning ? '#475569' : '#f87171',
                cursor: crawlerLoad || !isRunning ? 'not-allowed' : 'pointer',
              }}
            >
              ■ Stop
            </button>
          </div>
        </div>

        <FeatureCard
          icon="🔐"
          name="EarnKaro Affiliate"
          description="Session-based affiliate link conversion. Converts product URLs to tracked affiliate links automatically."
          enabled={ekConnected}
          onToggle={handleToggleEarnkaro}
          loading={ekLoading}
          actionLabel="Test Connection"
          onAction={handleTestEarnkaro}
          actionLoading={ekAction}
          accentColor="#3b82f6"
          statusText={ekConnected ? 'Session active' : 'Not connected'}
        />
      </Section>

      {/* ── Smart Filters ── */}
      <Section title="Smart Filters" icon="🧠">
        <FeatureCard
          icon="📚"
          name="No Books Filter"
          description="Skips books, textbooks, and magazines. Applied before Telegram posting."
          enabled={local.noBooksFilter}
          onToggle={v => setLocalFeature('noBooksFilter', v)}
          accentColor="#f97316"
        />
        <FeatureCard
          icon="🔁"
          name="No Same-Day Repeats"
          description="Prevents posting the same product more than once per day unless the price dropped."
          enabled={local.noSameDay}
          onToggle={v => setLocalFeature('noSameDay', v)}
          accentColor="#f97316"
        />
        <FeatureCard
          icon="📉"
          name="Price Drop Repeat Rule"
          description="Overrides the same-day block: if price drops, the deal gets re-posted regardless."
          enabled={local.priceDropRepeat}
          onToggle={v => setLocalFeature('priceDropRepeat', v)}
          accentColor="#10b981"
          tag="Smart"
        />
        <FeatureCard
          icon="🛡️"
          name="Duplicate Prevention"
          description="Compares incoming deals against stored records and silently skips exact URL matches."
          enabled={local.duplicatePrev}
          onToggle={v => setLocalFeature('duplicatePrev', v)}
          accentColor="#3b82f6"
        />
      </Section>

      {/* ── Content Generation ── */}
      <Section title="Content Generation" icon="✨">
        <FeatureCard
          icon="💬"
          name="AI Caption Generator"
          description="Generates punchy Telegram captions with emoji, savings summary, and CTA automatically."
          enabled={local.captionGen}
          onToggle={v => setLocalFeature('captionGen', v)}
          accentColor="#ec4899"
          tag="AI"
        />
        <FeatureCard
          icon="🎬"
          name="Reel Generator"
          description="Creates deal highlight reels using dark, sale, or minimal templates. Generated per deal."
          enabled={local.reelGen}
          onToggle={v => setLocalFeature('reelGen', v)}
          accentColor="#7c3aed"
          tag="Beta"
        />
      </Section>

      {/* ── Alerts & Distribution ── */}
      <Section title="Alerts & Distribution" icon="📡">
        <FeatureCard
          icon="🔔"
          name="Price Drop Alerts"
          description="Watches tracked products and fires a Telegram alert the moment a price drop is detected."
          enabled={local.priceAlerts}
          onToggle={v => setLocalFeature('priceAlerts', v)}
          accentColor="#fbbf24"
          tag="Soon"
          disabled
          statusText="Coming soon"
        />
        <FeatureCard
          icon="📲"
          name="Multi-Channel Posting"
          description="Post deals to multiple Telegram channels simultaneously with per-channel customisation."
          enabled={local.multiChannel}
          onToggle={v => setLocalFeature('multiChannel', v)}
          accentColor="#f97316"
          tag="Soon"
          disabled
          statusText="Coming soon"
        />
      </Section>

      {/* ── Active Rules Summary ── */}
      <div
        className="rounded-2xl p-4 space-y-3"
        style={{ background: 'rgba(15,23,42,0.9)', border: '1px solid rgba(255,255,255,0.07)' }}
      >
        <p className="text-[11px] font-bold uppercase tracking-widest" style={{ color: '#475569' }}>
          Active Automation Rules
        </p>
        <div className="space-y-2">
          {[
            { on: local.noBooksFilter,   icon: '❌', text: 'Books filtered from all deal runs' },
            { on: local.noSameDay,       icon: '⏱️', text: 'No same-day repeats unless price dropped' },
            { on: local.priceDropRepeat, icon: '📉', text: 'Price drop overrides same-day block' },
            { on: local.duplicatePrev,   icon: '🛡️', text: 'Duplicate URLs silently skipped' },
            { on: local.captionGen,      icon: '💬', text: 'AI captions auto-generated on each deal' },
            { on: autoMode,              icon: '⚡', text: 'Auto mode posting every scheduled interval' },
            { on: isRunning,             icon: '🕷️', text: 'Crawler actively scanning platforms' },
          ].map(({ on, icon, text }) => (
            <div key={text} className="flex items-center gap-2.5">
              <span className="text-[13px]">{icon}</span>
              <span className="text-[12px]" style={{ color: on ? '#94a3b8' : '#334155', textDecoration: on ? 'none' : 'line-through' }}>
                {text}
              </span>
              <span
                className="ml-auto shrink-0 text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                style={{
                  background: on ? 'rgba(16,185,129,0.12)' : 'rgba(71,85,105,0.15)',
                  color: on ? '#34d399' : '#475569',
                  border: on ? '1px solid rgba(16,185,129,0.22)' : '1px solid rgba(71,85,105,0.22)',
                }}
              >
                {on ? 'ON' : 'OFF'}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Section({ title, icon, children }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-base">{icon}</span>
        <h2 className="text-[13px] font-bold uppercase tracking-widest" style={{ color: '#475569' }}>
          {title}
        </h2>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {children}
      </div>
    </div>
  );
}
