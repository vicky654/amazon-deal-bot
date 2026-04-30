'use client';

import { RefreshCw } from 'lucide-react';

export default function LoadingSkeleton() {
  return (
    <div
      className="rounded-2xl p-5 sm:p-6 bg-card border border-border shadow-sm animate-pulse"
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
        className="mt-5 pt-4 flex items-center gap-2 border-t border-border"
      >
        <RefreshCw className="w-4 h-4 animate-spin text-primary" />
        <p className="text-xs text-muted-foreground">Scraping product — 10–30 seconds…</p>
      </div>
    </div>
  );
}
