'use client';

import { useCrawler } from '../context/CrawlerContext';
import { useToast }   from './ToastProvider';

export default function QuickActionBar() {
  const { crawlerStatus, crawlerLoad, autoMode, autoLoading, startCrawler, stopCrawler, toggleAutoMode } = useCrawler();
  const { show } = useToast();

  const isRunning  = crawlerStatus === 'running';
  const isStopping = crawlerStatus === 'stopping';

  async function handleStart() {
    if (isRunning || isStopping || crawlerLoad) return;
    await startCrawler();
    show('Crawler Started', 'success');
  }

  async function handleStop() {
    if (!isRunning || crawlerLoad) return;
    await stopCrawler();
    show('Crawler Stopped', 'info');
  }

  async function handleAutoMode() {
    const next = !autoMode;
    await toggleAutoMode(next);
    show(next ? 'Auto Mode enabled' : 'Auto Mode paused', next ? 'success' : 'info');
  }

  return (
    <div
      className="lg:hidden fixed bottom-16 inset-x-0 z-30 px-3 pb-2"
      style={{ pointerEvents: 'none' }}
    >
      <div
        className="flex items-center gap-2 p-2 rounded-2xl shadow-2xl"
        style={{
          background: 'rgba(2,6,23,0.92)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          border: '1px solid rgba(255,255,255,0.09)',
          pointerEvents: 'auto',
        }}
      >
        {/* Status dot */}
        <div className="shrink-0 pl-1 flex items-center gap-1.5">
          <span
            className="w-1.5 h-1.5 rounded-full"
            style={{
              background: isRunning ? '#10b981' : isStopping ? '#fbbf24' : '#ef4444',
              boxShadow: isRunning ? '0 0 6px rgba(16,185,129,0.7)' : 'none',
              animation: isRunning ? 'pulse 2s infinite' : 'none',
            }}
          />
          <span className="text-[10px] font-semibold" style={{ color: isRunning ? '#34d399' : isStopping ? '#fbbf24' : '#64748b' }}>
            {isRunning ? 'Live' : isStopping ? 'Stopping' : 'Idle'}
          </span>
        </div>

        <div className="flex-1 flex items-center gap-2">
          {/* Start */}
          <button
            onClick={handleStart}
            disabled={crawlerLoad || isRunning || isStopping}
            className="flex-1 py-2 rounded-xl text-[11px] font-bold transition-all active:scale-95 touch-manipulation"
            style={{
              background: crawlerLoad || isRunning || isStopping
                ? 'rgba(30,41,59,0.6)'
                : 'rgba(16,185,129,0.15)',
              border: `1px solid ${crawlerLoad || isRunning || isStopping ? 'rgba(255,255,255,0.06)' : 'rgba(16,185,129,0.30)'}`,
              color: crawlerLoad || isRunning || isStopping ? '#334155' : '#34d399',
              cursor: crawlerLoad || isRunning || isStopping ? 'not-allowed' : 'pointer',
            }}
          >
            ▶ Start
          </button>

          {/* Stop */}
          <button
            onClick={handleStop}
            disabled={crawlerLoad || !isRunning}
            className="flex-1 py-2 rounded-xl text-[11px] font-bold transition-all active:scale-95 touch-manipulation"
            style={{
              background: crawlerLoad || !isRunning
                ? 'rgba(30,41,59,0.6)'
                : 'rgba(239,68,68,0.15)',
              border: `1px solid ${crawlerLoad || !isRunning ? 'rgba(255,255,255,0.06)' : 'rgba(239,68,68,0.30)'}`,
              color: crawlerLoad || !isRunning ? '#334155' : '#f87171',
              cursor: crawlerLoad || !isRunning ? 'not-allowed' : 'pointer',
            }}
          >
            ■ Stop
          </button>

          {/* Auto Mode */}
          <button
            onClick={handleAutoMode}
            disabled={autoLoading}
            className="flex-1 py-2 rounded-xl text-[11px] font-bold transition-all active:scale-95 touch-manipulation"
            style={{
              background: autoMode
                ? 'rgba(249,115,22,0.15)'
                : 'rgba(30,41,59,0.6)',
              border: `1px solid ${autoMode ? 'rgba(249,115,22,0.30)' : 'rgba(255,255,255,0.06)'}`,
              color: autoMode ? '#fb923c' : '#475569',
              cursor: autoLoading ? 'not-allowed' : 'pointer',
            }}
          >
            ⚡ {autoMode ? 'Auto ON' : 'Auto OFF'}
          </button>
        </div>
      </div>
    </div>
  );
}
