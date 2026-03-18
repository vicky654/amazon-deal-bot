'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';

// Lazy-load modal so it doesn't bloat the initial table bundle
const ReelModal = dynamic(() => import('./ReelModal'), { ssr: false });

/**
 * ReelButton — inline "Create Reel" button for a deal row.
 * Opens ReelModal in a portal overlay when clicked.
 */
export default function ReelButton({ deal }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        title="Generate Instagram Reel for this deal"
        className="inline-flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-full border border-purple-200 bg-purple-50 text-purple-700 hover:bg-purple-100 hover:border-purple-300 transition-colors whitespace-nowrap"
      >
        <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M15 10l4.553-2.069A1 1 0 0121 8.87v6.26a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"/>
        </svg>
        Reel
      </button>

      {open && (
        <ReelModal deal={deal} onClose={() => setOpen(false)} />
      )}
    </>
  );
}
