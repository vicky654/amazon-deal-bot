'use client';

import { useState, useEffect, useCallback } from 'react';
import { systemApi } from '../lib/api';
import { cn } from '@/lib/utils';
import { Toggle } from '@/components/ui/Toggle';

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
    return <div className="h-[72px] rounded-2xl animate-pulse bg-muted" />;
  }

  return (
    <div
      className={cn(
        "flex items-center justify-between gap-4 p-5 rounded-2xl transition-all border",
        enabled ? "bg-success/5 border-success/10 shadow-sm shadow-success/5" : "bg-surface border-border"
      )}
    >
      <div className="flex items-center gap-3 min-w-0">
        <div
          className={cn(
            "w-12 h-12 rounded-2xl flex items-center justify-center text-2xl shrink-0 border transition-colors",
            enabled ? "bg-success/10 border-success/20 shadow-sm" : "bg-accent border-border"
          )}
        >
          {enabled ? '🤖' : '⏸️'}
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <p className="text-sm font-black text-foreground uppercase tracking-tight">Auto Pilot</p>
            <span
              className={cn(
                "text-[9px] font-black px-2 py-0.5 rounded-full",
                enabled ? "bg-success text-success-foreground" : "bg-muted text-muted-foreground"
              )}
            >
              {enabled ? 'ACTIVE' : 'PAUSED'}
            </span>
          </div>
          <p className="text-[11px] font-medium text-muted-foreground leading-snug">
            {enabled ? 'System is automatically posting verified deals.' : 'Manual review required for all deals.'}
          </p>
        </div>
      </div>

      <div className="shrink-0 pl-2">
        <Toggle 
          pressed={enabled} 
          onPressedChange={toggle} 
          disabled={toggling}
          className={toggling ? "opacity-50" : ""}
        />
      </div>
    </div>
  );
}
