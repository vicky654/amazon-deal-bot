'use client';

/**
 * Skeleton loader — mirrors the DealPreviewCard layout.
 * Shown while the scraper is running.
 */
export default function LoadingSkeleton() {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 animate-pulse">
      {/* Header label */}
      <div className="flex items-center gap-2 mb-5">
        <div className="skeleton h-4 w-28 rounded-md" />
        <div className="skeleton h-4 w-16 rounded-full" />
      </div>

      <div className="grid md:grid-cols-5 gap-6">
        {/* Left — image */}
        <div className="md:col-span-2">
          <div className="skeleton w-full aspect-square rounded-xl" />
        </div>

        {/* Right — details */}
        <div className="md:col-span-3 flex flex-col gap-4">
          {/* Title */}
          <div className="space-y-2">
            <div className="skeleton h-4 w-full rounded-md" />
            <div className="skeleton h-4 w-5/6 rounded-md" />
            <div className="skeleton h-4 w-4/6 rounded-md" />
          </div>

          {/* Prices */}
          <div className="flex items-center gap-3">
            <div className="skeleton h-8 w-24 rounded-lg" />
            <div className="skeleton h-5 w-16 rounded-md" />
            <div className="skeleton h-6 w-14 rounded-full" />
          </div>

          {/* Stats row */}
          <div className="flex gap-2">
            <div className="skeleton h-8 w-24 rounded-lg" />
            <div className="skeleton h-8 w-32 rounded-lg" />
          </div>

          {/* Link */}
          <div className="skeleton h-10 w-full rounded-xl" />

          {/* Telegram preview header */}
          <div className="skeleton h-14 w-full rounded-xl" />

          {/* Button */}
          <div className="skeleton h-12 w-full rounded-xl" />
        </div>
      </div>

      {/* Progress hint */}
      <div className="mt-5 pt-4 border-t border-slate-100 flex items-center gap-2">
        <svg className="w-4 h-4 text-orange-400 animate-spin" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        <p className="text-xs text-slate-400">
          Scraping product page — this can take 10–30 seconds…
        </p>
      </div>
    </div>
  );
}
