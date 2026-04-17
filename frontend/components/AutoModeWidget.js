'use client';

import { useState, useEffect, useCallback } from 'react';
import { systemApi } from '../lib/api';

export default function AutoModeWidget() {
  const [enabled,   setEnabled]   = useState(true);
  const [loading,   setLoading]   = useState(true);
  const [toggling,  setToggling]  = useState(false);
  const [updatedAt, setUpdatedAt] = useState(null);

  const fetchState = useCallback(async () => {
    try {
      const data = await systemApi.getAutoMode();
      setEnabled(data.enabled);
      setUpdatedAt(data.updatedAt);
    } catch {}
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchState(); }, [fetchState]);

  async function toggle() {
    setToggling(true);
    try {
      const data = await systemApi.setAutoMode(!enabled);
      setEnabled(data.enabled);
      setUpdatedAt(data.updatedAt);
    } catch {}
    finally { setToggling(false); }
  }

  if (loading) {
    return <div className="h-[72px] rounded-2xl skeleton" />;
  }

  return (
    <div
      className="flex items-center justify-between gap-4 p-4 rounded-2xl transition-all"
      style={enabled
        ? { background: 'rgba(52,211,153,0.08)', border: '1px solid rgba(52,211,153,0.22)' }
        : { background: 'rgba(30,41,59,0.6)', border: '1px solid rgba(255,255,255,0.06)' }
      }
    >
      <div className="flex items-center gap-3 min-w-0">
        <div
          className="w-10 h-10 rounded-2xl flex items-center justify-center text-xl shrink-0"
          style={{ background: enabled ? 'rgba(52,211,153,0.15)' : 'rgba(71,85,105,0.3)' }}
        >
          {enabled ? '🤖' : '⏸️'}
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-bold text-white">Auto Mode</p>
            <span
              className="text-[10px] font-bold px-2 py-0.5 rounded-full"
              style={enabled
                ? { background: '#10b981', color: 'white' }
                : { background: 'rgba(71,85,105,0.5)', color: '#64748b' }
              }
            >
              {enabled ? 'ON' : 'OFF'}
            </span>
          </div>
          <p className="text-[11px] text-slate-500 mt-0.5 truncate">
            {enabled ? 'Auto-post qualifying deals to Telegram' : 'Save only — manual review required'}
          </p>
          {updatedAt && (
            <p className="text-[10px] text-slate-700 mt-0.5">
              Updated {new Date(updatedAt).toLocaleTimeString('en-IN')}
            </p>
          )}
        </div>
      </div>

      {/* Toggle */}
      <button
        onClick={toggle}
        disabled={toggling}
        aria-label={enabled ? 'Disable auto mode' : 'Enable auto mode'}
        className="relative shrink-0 h-7 w-12 rounded-full transition-all duration-300 touch-manipulation"
        style={{
          background: enabled ? '#10b981' : 'rgba(71,85,105,0.5)',
          opacity: toggling ? 0.6 : 1,
          cursor: toggling ? 'not-allowed' : 'pointer',
          boxShadow: enabled ? '0 0 12px rgba(16,185,129,0.4)' : 'none',
        }}
      >
        <span
          className="absolute top-0.5 h-6 w-6 rounded-full bg-white shadow-md transition-all duration-300"
          style={{ left: enabled ? '22px' : '2px' }}
        />
      </button>
    </div>
  );
}
