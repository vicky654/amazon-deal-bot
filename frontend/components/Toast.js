'use client';

import { useEffect, useState } from 'react';

/**
 * Toast notification component.
 *
 * Props:
 *   toast: { type: 'success' | 'error' | 'info', message: string } | null
 *   onDismiss: () => void
 */
export default function Toast({ toast, onDismiss }) {
  const [exiting, setExiting] = useState(false);

  // Auto-dismiss after 4 seconds
  useEffect(() => {
    if (!toast) return;
    setExiting(false);

    const dismissTimer = setTimeout(() => {
      setExiting(true);
    }, 3750);

    const removeTimer = setTimeout(() => {
      onDismiss();
    }, 4000);

    return () => {
      clearTimeout(dismissTimer);
      clearTimeout(removeTimer);
    };
  }, [toast, onDismiss]);

  if (!toast) return null;

  const styles = {
    success: {
      bar: 'bg-green-500',
      icon: (
        <svg className="w-5 h-5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      ),
    },
    error: {
      bar: 'bg-red-500',
      icon: (
        <svg className="w-5 h-5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      ),
    },
    info: {
      bar: 'bg-blue-500',
      icon: (
        <svg className="w-5 h-5 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01" />
        </svg>
      ),
    },
  };

  const style = styles[toast.type] || styles.info;

  return (
    <div className="fixed bottom-6 right-6 z-50 pointer-events-none">
      <div
        className={`pointer-events-auto bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden max-w-sm w-full ${
          exiting ? 'toast-exit' : 'toast-enter'
        }`}
      >
        {/* Progress bar */}
        <div
          className={`h-1 ${style.bar} transition-all duration-[4000ms] ease-linear`}
          style={{ width: exiting ? '0%' : '100%' }}
        />

        <div className="flex items-start gap-3 p-4">
          <div className="mt-0.5 shrink-0">{style.icon}</div>
          <p className="text-sm text-slate-700 flex-1 font-medium leading-snug">
            {toast.message}
          </p>
          <button
            onClick={() => { setExiting(true); setTimeout(onDismiss, 250); }}
            className="shrink-0 text-slate-400 hover:text-slate-600 transition-colors"
            aria-label="Dismiss"
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
