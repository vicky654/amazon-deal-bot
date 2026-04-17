'use client';

import { useEffect, useState } from 'react';

export default function Toast({ toast, onDismiss }) {
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    if (!toast) return;
    setExiting(false);
    const t1 = setTimeout(() => setExiting(true), 3750);
    const t2 = setTimeout(() => onDismiss(), 4000);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [toast, onDismiss]);

  if (!toast) return null;

  const STYLES = {
    success: { bar: '#10b981', iconColor: '#34d399', icon: 'M5 13l4 4L19 7' },
    error:   { bar: '#ef4444', iconColor: '#f87171', icon: 'M6 18L18 6M6 6l12 12' },
    info:    { bar: '#3b82f6', iconColor: '#60a5fa', icon: 'M13 16h-1v-4h-1m1-4h.01' },
  };
  const s = STYLES[toast.type] ?? STYLES.info;

  return (
    <div className="fixed bottom-24 lg:bottom-6 right-4 lg:right-6 z-[60] pointer-events-none">
      <div
        className={`pointer-events-auto rounded-2xl overflow-hidden max-w-sm w-full shadow-2xl ${exiting ? 'toast-exit' : 'toast-enter'}`}
        style={{ background: 'rgba(15,23,42,0.97)', border: '1px solid rgba(255,255,255,0.10)' }}
      >
        {/* Progress bar */}
        <div className="h-0.5" style={{ background: 'rgba(255,255,255,0.06)' }}>
          <div
            className="h-full transition-all ease-linear"
            style={{ width: exiting ? '0%' : '100%', transitionDuration: '4000ms', background: s.bar }}
          />
        </div>

        <div className="flex items-start gap-3 p-4">
          <div className="mt-0.5 shrink-0">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} style={{ color: s.iconColor }}>
              <path strokeLinecap="round" strokeLinejoin="round" d={s.icon} />
            </svg>
          </div>
          <p className="text-sm text-slate-200 flex-1 font-medium leading-snug">{toast.message}</p>
          <button
            onClick={() => { setExiting(true); setTimeout(onDismiss, 250); }}
            className="shrink-0 text-slate-600 hover:text-slate-400 transition-colors touch-manipulation"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
