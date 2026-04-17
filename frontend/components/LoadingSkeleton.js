'use client';

export default function LoadingSkeleton() {
  return (
    <div
      className="rounded-2xl p-5 sm:p-6"
      style={{ background: 'rgba(15,23,42,0.90)', border: '1px solid rgba(255,255,255,0.07)' }}
    >
      {/* Header */}
      <div className="flex items-center gap-2 mb-5">
        <div className="skeleton h-4 w-28 rounded-lg" />
        <div className="skeleton h-4 w-16 rounded-full" />
      </div>

      <div className="grid md:grid-cols-5 gap-6">
        {/* Image */}
        <div className="md:col-span-2">
          <div className="skeleton w-full aspect-square rounded-2xl" />
        </div>

        {/* Details */}
        <div className="md:col-span-3 flex flex-col gap-4">
          <div className="space-y-2">
            <div className="skeleton h-4 w-full rounded-lg" />
            <div className="skeleton h-4 w-5/6 rounded-lg" />
            <div className="skeleton h-4 w-4/6 rounded-lg" />
          </div>
          <div className="flex items-center gap-3">
            <div className="skeleton h-8 w-24 rounded-xl" />
            <div className="skeleton h-5 w-16 rounded-lg" />
            <div className="skeleton h-6 w-14 rounded-full" />
          </div>
          <div className="flex gap-2">
            <div className="skeleton h-8 w-24 rounded-xl" />
            <div className="skeleton h-8 w-32 rounded-xl" />
          </div>
          <div className="skeleton h-10 w-full rounded-2xl" />
          <div className="skeleton h-14 w-full rounded-2xl" />
          <div className="skeleton h-12 w-full rounded-2xl" />
        </div>
      </div>

      {/* Footer */}
      <div
        className="mt-5 pt-4 flex items-center gap-2"
        style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}
      >
        <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24" style={{ color: '#f97316' }}>
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        <p className="text-xs text-slate-600">Scraping product — 10–30 seconds…</p>
      </div>
    </div>
  );
}
