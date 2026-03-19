'use client';

import { useState, useEffect, useCallback } from 'react';
import { systemApi } from '../lib/api';

export default function AutoModeWidget() {
  const [enabled,    setEnabled]    = useState(true);
  const [loading,    setLoading]    = useState(true);
  const [toggling,   setToggling]   = useState(false);
  const [updatedAt,  setUpdatedAt]  = useState(null);

  const fetch = useCallback(async () => {
    try {
      const data = await systemApi.getAutoMode();
      setEnabled(data.enabled);
      setUpdatedAt(data.updatedAt);
    } catch {}
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

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
    return <div className="h-16 bg-gray-100 rounded-2xl animate-pulse" />;
  }

  return (
    <div className={`flex items-center justify-between gap-4 p-4 rounded-2xl border-2 transition-all ${
      enabled
        ? 'bg-emerald-50 border-emerald-300'
        : 'bg-gray-50 border-gray-200'
    }`}>
      <div className="flex items-center gap-3 min-w-0">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0 ${
          enabled ? 'bg-emerald-100' : 'bg-gray-100'
        }`}>
          {enabled ? '🤖' : '⏸️'}
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-bold text-gray-900">Auto Mode</p>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
              enabled
                ? 'bg-emerald-500 text-white'
                : 'bg-gray-300 text-gray-600'
            }`}>
              {enabled ? 'ON' : 'OFF'}
            </span>
          </div>
          <p className="text-xs text-gray-500 mt-0.5 truncate">
            {enabled
              ? 'Scrape → Filter → Post to Telegram automatically'
              : 'Scrape + save only — manual review before posting'}
          </p>
          {updatedAt && (
            <p className="text-[10px] text-gray-400 mt-0.5">
              Updated {new Date(updatedAt).toLocaleTimeString('en-IN')}
            </p>
          )}
        </div>
      </div>

      {/* Toggle switch */}
      <button
        onClick={toggle}
        disabled={toggling}
        aria-label={enabled ? 'Disable auto mode' : 'Enable auto mode'}
        className={`relative shrink-0 h-7 w-12 rounded-full transition-all duration-300 touch-manipulation ${
          toggling ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'
        } ${enabled ? 'bg-emerald-500' : 'bg-gray-300'}`}
      >
        <span className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow-sm transition-all duration-300 ${
          enabled ? 'left-[22px]' : 'left-0.5'
        }`} />
      </button>
    </div>
  );
}
