'use client';

import ToggleSwitch from './ToggleSwitch';

export default function FeatureCard({
  icon,
  name,
  description,
  enabled,
  onToggle,
  loading = false,
  disabled = false,
  actionLabel,
  onAction,
  actionLoading = false,
  statusText,
  accentColor = '#f97316',
  tag,
}) {
  const accentBg   = hexToRgba(accentColor, 0.10);
  const accentBrd  = hexToRgba(accentColor, 0.22);
  const accentGlow = hexToRgba(accentColor, 0.30);

  return (
    <div
      className="rounded-2xl p-4 flex flex-col gap-3 transition-all duration-200"
      style={{
        background: enabled
          ? `linear-gradient(135deg, ${accentBg}, rgba(15,23,42,0.9))`
          : 'rgba(15,23,42,0.9)',
        border: `1px solid ${enabled ? accentBrd : 'rgba(255,255,255,0.07)'}`,
        boxShadow: enabled ? `0 0 20px ${hexToRgba(accentColor, 0.07)}` : 'none',
      }}
    >
      {/* Top row */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          {/* Icon */}
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center text-base shrink-0"
            style={{
              background: enabled ? accentBg : 'rgba(30,41,59,0.7)',
              border: `1px solid ${enabled ? accentBrd : 'rgba(255,255,255,0.07)'}`,
              boxShadow: enabled ? `0 2px 10px ${accentGlow}` : 'none',
            }}
          >
            {icon}
          </div>
          {/* Name + tag */}
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[13px] font-semibold text-white leading-tight truncate">{name}</span>
              {tag && (
                <span
                  className="text-[9px] font-bold px-1.5 py-0.5 rounded-full shrink-0"
                  style={{
                    background: 'rgba(124,58,237,0.18)',
                    color: '#a78bfa',
                    border: '1px solid rgba(124,58,237,0.28)',
                  }}
                >
                  {tag}
                </span>
              )}
            </div>
            {/* Status text */}
            <p
              className="text-[11px] mt-0.5 transition-colors"
              style={{ color: enabled ? accentColor : '#475569' }}
            >
              {loading ? 'Updating…' : statusText || (enabled ? 'Active' : 'Disabled')}
            </p>
          </div>
        </div>

        {/* Toggle */}
        <ToggleSwitch
          enabled={enabled}
          onChange={onToggle}
          loading={loading}
          disabled={disabled}
        />
      </div>

      {/* Description */}
      <p className="text-[11px] leading-relaxed" style={{ color: '#64748b' }}>
        {description}
      </p>

      {/* Action button */}
      {actionLabel && onAction && (
        <button
          onClick={onAction}
          disabled={actionLoading || disabled}
          className="w-full py-2 rounded-xl text-[12px] font-semibold transition-all active:scale-95 touch-manipulation"
          style={{
            background: actionLoading || disabled
              ? 'rgba(30,41,59,0.6)'
              : accentBg,
            border: `1px solid ${actionLoading || disabled ? 'rgba(255,255,255,0.07)' : accentBrd}`,
            color: actionLoading || disabled ? '#475569' : accentColor,
            cursor: actionLoading || disabled ? 'not-allowed' : 'pointer',
          }}
        >
          {actionLoading ? (
            <span className="flex items-center justify-center gap-1.5">
              <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Running…
            </span>
          ) : actionLabel}
        </button>
      )}
    </div>
  );
}

function hexToRgba(hex, alpha) {
  const h = hex.replace('#', '');
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}
