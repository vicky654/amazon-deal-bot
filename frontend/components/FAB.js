'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, X, Link2, Play, Zap } from 'lucide-react';
import { systemApi } from '../lib/api';

const ACTIONS = [
  {
    icon: Link2,
    label: 'Generate Deal',
    href: '/admin/generate',
    color: '#f97316',
    bg: 'linear-gradient(135deg,#f97316,#ea580c)',
    glow: 'rgba(249,115,22,0.40)',
  },
  {
    icon: Play,
    label: 'Start Crawler',
    action: 'crawler',
    color: '#60a5fa',
    bg: 'linear-gradient(135deg,#3b82f6,#2563eb)',
    glow: 'rgba(59,130,246,0.35)',
  },
  {
    icon: Zap,
    label: 'Toggle Auto Mode',
    action: 'automode',
    color: '#a78bfa',
    bg: 'linear-gradient(135deg,#7c3aed,#6d28d9)',
    glow: 'rgba(124,58,237,0.35)',
  },
];

export default function FAB({ className = '' }) {
  const [open,    setOpen]    = useState(false);
  const [loading, setLoading] = useState(null);
  const [toast,   setToast]   = useState(null);
  const router = useRouter();

  // Close on outside tap
  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    document.addEventListener('touchstart', close, { passive: true });
    return () => document.removeEventListener('touchstart', close);
  }, [open]);

  function showToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  }

  async function handleAction(item, e) {
    e.stopPropagation();
    setOpen(false);

    if (item.href) {
      router.push(item.href);
      return;
    }

    if (item.action === 'crawler') {
      setLoading('crawler');
      try {
        await systemApi.triggerCron?.() || await fetch('/api/crawler/start', { method: 'POST' });
        showToast('Crawler started!');
      } catch { showToast('Failed to start crawler'); }
      finally { setLoading(null); }
    }

    if (item.action === 'automode') {
      setLoading('automode');
      try {
        const current = await systemApi.getAutoMode();
        const next    = await systemApi.setAutoMode(!current.enabled);
        showToast(`Auto Mode ${next.enabled ? 'ON ✅' : 'OFF ⏸️'}`);
      } catch { showToast('Failed to toggle Auto Mode'); }
      finally { setLoading(null); }
    }
  }

  return (
    <>
      {/* Toast */}
      {toast && (
        <div
          className="fixed bottom-32 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-2xl text-sm font-semibold text-white shadow-xl"
          style={{ background: 'rgba(15,23,42,0.95)', border: '1px solid rgba(255,255,255,0.12)', whiteSpace: 'nowrap' }}
        >
          {toast}
        </div>
      )}

      {/* FAB group */}
      <div className={`fixed bottom-20 right-4 z-50 flex flex-col-reverse items-end gap-3 ${className}`}>

        {/* Speed-dial actions */}
        {ACTIONS.map((item, i) => (
          <div
            key={item.label}
            className="flex items-center gap-2 transition-all duration-200"
            style={{
              opacity: open ? 1 : 0,
              transform: open ? 'translateY(0) scale(1)' : `translateY(${(ACTIONS.length - i) * 8}px) scale(0.8)`,
              pointerEvents: open ? 'auto' : 'none',
              transitionDelay: open ? `${i * 40}ms` : '0ms',
            }}
          >
            {/* Label */}
            <span
              className="text-xs font-semibold px-3 py-1.5 rounded-xl shadow-lg"
              style={{ background: 'rgba(15,23,42,0.95)', border: '1px solid rgba(255,255,255,0.10)', color: '#cbd5e1', whiteSpace: 'nowrap' }}
            >
              {item.label}
            </span>

            {/* Icon button */}
            <button
              onTouchStart={(e) => e.stopPropagation()}
              onClick={(e) => handleAction(item, e)}
              disabled={loading === item.action}
              className="w-12 h-12 rounded-2xl flex items-center justify-center transition-all active:scale-90 touch-manipulation shadow-lg"
              style={{
                background: item.bg,
                boxShadow: `0 4px 16px ${item.glow}`,
                opacity: loading === item.action ? 0.6 : 1,
              }}
            >
              {loading === item.action ? (
                <svg className="w-5 h-5 text-white animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              ) : (
                <item.icon className="w-5 h-5 text-white" />
              )}
            </button>
          </div>
        ))}

        {/* Main FAB */}
        <button
          onTouchStart={(e) => { e.stopPropagation(); setOpen((v) => !v); }}
          onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}
          className="w-14 h-14 rounded-2xl flex items-center justify-center transition-all active:scale-90 touch-manipulation shadow-2xl"
          style={{
            background: open
              ? 'linear-gradient(135deg,#374151,#1f2937)'
              : 'linear-gradient(135deg,#f97316,#ea580c)',
            boxShadow: open
              ? '0 4px 20px rgba(0,0,0,0.5)'
              : '0 4px 24px rgba(249,115,22,0.50)',
            transform: open ? 'rotate(45deg)' : 'rotate(0deg)',
            transition: 'all 0.25s cubic-bezier(0.34,1.56,0.64,1)',
          }}
        >
          {open
            ? <X className="w-6 h-6 text-white" />
            : <Plus className="w-6 h-6 text-white" />
          }
        </button>
      </div>
    </>
  );
}
