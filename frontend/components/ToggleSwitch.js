'use client';

export default function ToggleSwitch({ enabled, onChange, loading = false, disabled = false }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      disabled={disabled || loading}
      onClick={() => !loading && !disabled && onChange(!enabled)}
      className="relative shrink-0 touch-manipulation focus:outline-none"
      style={{
        width: 44,
        height: 26,
        borderRadius: 13,
        background: loading
          ? 'rgba(71,85,105,0.5)'
          : enabled
          ? 'linear-gradient(135deg,#10b981,#059669)'
          : 'rgba(71,85,105,0.5)',
        boxShadow: enabled && !loading
          ? '0 0 14px rgba(16,185,129,0.40)'
          : 'none',
        border: enabled && !loading
          ? '1px solid rgba(16,185,129,0.35)'
          : '1px solid rgba(255,255,255,0.08)',
        transition: 'all 0.25s cubic-bezier(0.34,1.56,0.64,1)',
        opacity: disabled ? 0.45 : 1,
        cursor: disabled || loading ? 'not-allowed' : 'pointer',
      }}
    >
      <span
        style={{
          position: 'absolute',
          top: 3,
          left: enabled ? 21 : 3,
          width: 18,
          height: 18,
          borderRadius: '50%',
          background: loading
            ? 'rgba(148,163,184,0.7)'
            : '#fff',
          boxShadow: '0 1px 4px rgba(0,0,0,0.35)',
          transition: 'left 0.22s cubic-bezier(0.34,1.56,0.64,1)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {loading && (
          <svg
            style={{ width: 10, height: 10, color: '#64748b', animation: 'spin 1s linear infinite' }}
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        )}
      </span>
    </button>
  );
}
