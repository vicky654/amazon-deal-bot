'use client';

import { useCrawler } from '../context/CrawlerContext';

const EVENT_CONFIG = {
  'crawler:deal-posted':   { color: '#10b981', bg: 'rgba(16,185,129,0.08)',  border: 'rgba(16,185,129,0.18)', icon: '✅', label: 'Posted'   },
  'crawler:deal-skipped':  { color: '#fbbf24', bg: 'rgba(251,191,36,0.08)',  border: 'rgba(251,191,36,0.18)', icon: '⏭️', label: 'Skipped'  },
  'crawler:deal-error':    { color: '#f87171', bg: 'rgba(248,113,113,0.08)', border: 'rgba(248,113,113,0.18)', icon: '❌', label: 'Error'    },
  'crawler:started':       { color: '#60a5fa', bg: 'rgba(96,165,250,0.08)',  border: 'rgba(96,165,250,0.18)', icon: '▶️', label: 'Started'  },
  'crawler:completed':     { color: '#34d399', bg: 'rgba(52,211,153,0.08)',  border: 'rgba(52,211,153,0.18)', icon: '🏁', label: 'Complete' },
  'crawler:stopped':       { color: '#94a3b8', bg: 'rgba(148,163,184,0.07)', border: 'rgba(148,163,184,0.15)', icon: '⏹️', label: 'Stopped' },
  'crawler:error':         { color: '#f87171', bg: 'rgba(248,113,113,0.08)', border: 'rgba(248,113,113,0.18)', icon: '💥', label: 'Error'   },
};

const PLATFORM_EMOJI = { amazon: '🛒', flipkart: '🟡', myntra: '👗', ajio: '👠' };

const REASON_LABELS = {
  'book-category':   '📚 Book',
  'same-day-repeat': '🔁 Same-day',
  'price-drop-repeat': '📉 Price drop (re-post)',
  'ok':              '✅ OK',
};

function timeAgo(ts) {
  if (!ts) return '';
  const diff = Date.now() - new Date(ts).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60)   return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60)   return `${m}m ago`;
  const h = Math.floor(m / 60);
  return `${h}h ago`;
}

export default function DealActivityLog() {
  const { activity } = useCrawler();

  if (!activity.length) {
    return (
      <div
        className="rounded-2xl p-6 flex flex-col items-center justify-center gap-2 text-center"
        style={{ background: 'rgba(15,23,42,0.9)', border: '1px solid rgba(255,255,255,0.07)', minHeight: 120 }}
      >
        <span className="text-2xl">📭</span>
        <p className="text-[13px] font-medium text-slate-500">No activity yet</p>
        <p className="text-[11px] text-slate-700">Start the crawler to see live deal activity</p>
      </div>
    );
  }

  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{ background: 'rgba(15,23,42,0.9)', border: '1px solid rgba(255,255,255,0.07)' }}
    >
      {/* Header */}
      <div
        className="px-4 py-3 flex items-center justify-between"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}
      >
        <div className="flex items-center gap-2">
          <span className="text-base">📋</span>
          <span className="text-[13px] font-bold text-white">Deal Activity</span>
        </div>
        <span
          className="text-[10px] font-bold px-2 py-0.5 rounded-full"
          style={{ background: 'rgba(249,115,22,0.12)', color: '#fb923c', border: '1px solid rgba(249,115,22,0.22)' }}
        >
          Last {activity.length}
        </span>
      </div>

      {/* Timeline */}
      <div className="divide-y" style={{ '--tw-divide-opacity': 1 }}>
        {activity.map((entry, i) => {
          const cfg = EVENT_CONFIG[entry.event] || EVENT_CONFIG['crawler:error'];
          const pEmoji = PLATFORM_EMOJI[entry.platform] || '🛍️';
          const reasonLabel = REASON_LABELS[entry.reason] || entry.reason || '';

          return (
            <div
              key={entry.id || i}
              className="px-4 py-3 flex items-start gap-3"
              style={{ borderColor: 'rgba(255,255,255,0.04)' }}
            >
              {/* Left: icon + line */}
              <div className="flex flex-col items-center gap-1 shrink-0 pt-0.5">
                <div
                  className="w-7 h-7 rounded-xl flex items-center justify-center text-sm"
                  style={{ background: cfg.bg, border: `1px solid ${cfg.border}` }}
                >
                  {cfg.icon}
                </div>
                {i < activity.length - 1 && (
                  <div className="w-px flex-1 min-h-[12px]" style={{ background: 'rgba(255,255,255,0.06)' }} />
                )}
              </div>

              {/* Right: content */}
              <div className="flex-1 min-w-0 pb-1">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span
                    className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                    style={{ background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}` }}
                  >
                    {cfg.label}
                  </span>
                  {entry.platform && (
                    <span className="text-[11px] text-slate-500">{pEmoji} {entry.platform}</span>
                  )}
                  <span className="ml-auto text-[10px]" style={{ color: '#334155' }}>
                    {timeAgo(entry.timestamp)}
                  </span>
                </div>

                {entry.title && (
                  <p className="text-[12px] text-slate-300 mt-1 leading-snug line-clamp-2">{entry.title}</p>
                )}

                {entry.price && (
                  <p className="text-[11px] mt-0.5" style={{ color: '#f97316' }}>
                    ₹{Number(entry.price).toLocaleString('en-IN')}
                    {entry.discount ? ` · ${entry.discount}% off` : ''}
                  </p>
                )}

                {(reasonLabel || entry.message) && (
                  <p className="text-[11px] mt-0.5" style={{ color: '#475569' }}>
                    {reasonLabel || entry.message}
                  </p>
                )}

                {entry.stats && (
                  <p className="text-[11px] mt-0.5" style={{ color: '#475569' }}>
                    {entry.stats.dealsFound} found · {entry.stats.dealsPosted} posted · {entry.stats.errors} errors
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
