'use client';

const PLATFORMS = {
  amazon:   { label: 'Amazon',   bg: 'bg-orange-100', text: 'text-orange-700', border: 'border-orange-200', dot: 'bg-orange-500' },
  flipkart: { label: 'Flipkart', bg: 'bg-yellow-100',  text: 'text-yellow-700', border: 'border-yellow-200', dot: 'bg-yellow-500' },
  myntra:   { label: 'Myntra',   bg: 'bg-pink-100',    text: 'text-pink-700',   border: 'border-pink-200',   dot: 'bg-pink-500'   },
  ajio:     { label: 'Ajio',     bg: 'bg-red-100',     text: 'text-red-700',    border: 'border-red-200',    dot: 'bg-red-500'    },
  manual:   { label: 'Manual',   bg: 'bg-blue-100',    text: 'text-blue-700',   border: 'border-blue-200',   dot: 'bg-blue-500'   },
};

export default function PlatformBadge({ platform = 'manual', size = 'sm' }) {
  const meta = PLATFORMS[platform] || PLATFORMS.manual;
  const padding = size === 'xs' ? 'px-1.5 py-0.5 text-xs' : 'px-2.5 py-1 text-xs font-medium';

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border ${meta.bg} ${meta.text} ${meta.border} ${padding}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
      {meta.label}
    </span>
  );
}
