'use client';

const PLATFORMS = {
  amazon:   { label: 'Amazon',   bg: 'rgba(249,115,22,0.12)', border: 'rgba(249,115,22,0.25)', color: '#fb923c', dot: '#f97316' },
  flipkart: { label: 'Flipkart', bg: 'rgba(234,179,8,0.12)',  border: 'rgba(234,179,8,0.25)',  color: '#fbbf24', dot: '#eab308' },
  myntra:   { label: 'Myntra',   bg: 'rgba(236,72,153,0.12)', border: 'rgba(236,72,153,0.25)', color: '#f472b6', dot: '#ec4899' },
  ajio:     { label: 'Ajio',     bg: 'rgba(239,68,68,0.12)',  border: 'rgba(239,68,68,0.25)',  color: '#f87171', dot: '#ef4444' },
  manual:   { label: 'Manual',   bg: 'rgba(96,165,250,0.12)', border: 'rgba(96,165,250,0.25)', color: '#60a5fa', dot: '#3b82f6' },
};

export default function PlatformBadge({ platform = 'manual', size = 'sm' }) {
  const meta    = PLATFORMS[platform] ?? PLATFORMS.manual;
  const padding = size === 'xs' ? 'px-1.5 py-0.5 text-[10px]' : 'px-2.5 py-1 text-xs font-medium';

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full font-semibold ${padding}`}
      style={{ background: meta.bg, border: `1px solid ${meta.border}`, color: meta.color }}
    >
      <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ background: meta.dot }} />
      {meta.label}
    </span>
  );
}
