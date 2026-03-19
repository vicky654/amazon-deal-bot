'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Menu, X, LogOut } from 'lucide-react';

import Sidebar   from './Sidebar';
import BottomNav from './BottomNav';
import { removeToken } from '../lib/auth';

export default function AdminShell({ children }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const router = useRouter();

  function handleLogout() {
    removeToken();
    router.replace('/admin/login');
  }

  return (
    /*
     * ROOT:  h-screen + overflow-hidden
     *   → Pins the entire shell to exactly the viewport height.
     *   → `min-h-screen` would let the container grow taller than the viewport,
     *     which breaks independent-scroll isolation between sidebar and content.
     *   → overflow-hidden prevents any document-level scroll (both axes).
     */
    <div className="h-screen flex overflow-hidden bg-slate-50">

      {/* ── Sidebar ── */}
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/*
       * MAIN COLUMN:  flex-1 flex flex-col min-w-0 min-h-0
       *   min-w-0  → allows flex child to shrink below its content width (prevents
       *              sidebar pushing the right column off-screen)
       *   min-h-0  → allows flex child to shrink below its content height (critical
       *              in a flex column so children can scroll independently)
       *   overflow-hidden → clips the column; actual scroll is on <main> below
       */}
      <div className="flex-1 flex flex-col min-w-0 min-h-0 overflow-hidden">

        {/* ── Sticky header ── */}
        <header className="shrink-0 sticky top-0 z-20 bg-white/80 backdrop-blur-sm border-b border-slate-200">
          <div className="w-full max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setSidebarOpen((v) => !v)}
                className="lg:hidden p-2 rounded-md text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition touch-manipulation"
                aria-label="Toggle menu"
              >
                {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
              <Link href="/admin" className="flex items-center gap-2">
                <span className="text-lg">🔥</span>
                <span className="text-sm font-semibold text-slate-900 hover:text-slate-700">
                  DealBot Admin
                </span>
              </Link>
            </div>

            <div className="flex items-center gap-2 sm:gap-4">
              <div className="hidden sm:flex items-center gap-4">
                <Link href="/admin/how-it-works" className="text-xs font-medium text-slate-500 hover:text-slate-800">
                  How It Works
                </Link>
                <Link href="/admin/settings" className="text-xs font-medium text-slate-500 hover:text-slate-800">
                  Settings
                </Link>
              </div>

              <button
                onClick={handleLogout}
                title="Logout"
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-slate-500 hover:text-red-600 hover:bg-red-50 border border-transparent hover:border-red-200 transition touch-manipulation"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Logout</span>
              </button>
            </div>
          </div>
        </header>

        {/*
         * SCROLLABLE CONTENT AREA:
         *   flex-1  → fills remaining vertical space below header
         *   overflow-y-auto → vertical scroll ONLY here (not on body)
         *   overflow-x-hidden → hard-clips any content wider than the column
         *   pb-16 lg:pb-0 → clearance for mobile BottomNav
         */}
        <main className="flex-1 overflow-y-auto overflow-x-hidden [-webkit-overflow-scrolling:touch] pb-16 lg:pb-0">
          <div className="w-full max-w-7xl mx-auto px-3 sm:px-4 py-4 sm:py-6">
            {children}
          </div>
        </main>
      </div>

      {/* Mobile bottom nav — fixed, lg:hidden */}
      <BottomNav />
    </div>
  );
}
