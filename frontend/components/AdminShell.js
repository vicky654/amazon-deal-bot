'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { Menu, X, LogOut, Zap } from 'lucide-react';

import Sidebar          from './Sidebar';
import BottomNav        from './BottomNav';
import FAB             from './FAB';
import QuickActionBar  from './QuickActionBar';
import { ToastProvider } from './ToastProvider';
import { CrawlerProvider } from '../context/CrawlerContext';
import { removeToken } from '../lib/auth';

/* Map pathname → page title shown in mobile header */
const PAGE_TITLES = {
  '/admin':                   'Dashboard',
  '/admin/generate':          'Generate Deal',
  '/admin/deals':             'All Deals',
  '/admin/analytics':         'Analytics',
  '/admin/crawler':           'Crawler',
  '/admin/system':            'System',
  '/admin/settings':          'Settings',
  '/admin/testing':           'Testing',
  '/admin/message':           'Custom Message',
  '/admin/metrics':           'Metrics',
  '/admin/how-it-works':      'How It Works',
  '/admin/earnkaro-debug':    'EarnKaro Debug',
  '/admin/affiliate-history': 'Affiliate History',
  '/admin/features':          'Features',
};

export default function AdminShell({ children }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const router   = useRouter();
  const pathname = usePathname();
  const title    = PAGE_TITLES[pathname] ?? 'DealBot';

  function handleLogout() {
    removeToken();
    router.replace('/admin/login');
  }

  return (
    <ToastProvider>
    <CrawlerProvider>
    <div className="h-screen flex overflow-hidden bg-slate-950">

      {/* ── Sidebar ── */}
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* ── Right column ── */}
      <div className="flex-1 flex flex-col min-w-0 min-h-0 overflow-hidden">

        {/* ── Header ── */}
        <header
          className="shrink-0 sticky top-0 z-20 safe-top"
          style={{
            background: 'rgba(2, 6, 23, 0.85)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            borderBottom: '1px solid rgba(255,255,255,0.06)',
          }}
        >
          <div className="w-full max-w-7xl mx-auto px-4 h-14 flex items-center justify-between gap-3">

            {/* Left: hamburger + logo/title */}
            <div className="flex items-center gap-3 min-w-0">
              <button
                type="button"
                onClick={() => setSidebarOpen((v) => !v)}
                className="lg:hidden p-2 -ml-1 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition touch-manipulation"
                aria-label="Toggle menu"
              >
                {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>

              {/* Desktop: logo link */}
              <Link href="/admin" className="hidden lg:flex items-center gap-2.5 shrink-0">
                <div className="w-8 h-8 rounded-xl flex items-center justify-center text-sm"
                  style={{ background: 'linear-gradient(135deg,#f97316,#ea580c)' }}>
                  🔥
                </div>
                <span className="text-sm font-bold text-white">DealBot</span>
              </Link>

              {/* Mobile: page title */}
              <h1 className="lg:hidden text-base font-bold text-white truncate">{title}</h1>
            </div>

            {/* Right: status pill + logout */}
            <div className="flex items-center gap-2 shrink-0">
              {/* Live indicator */}
              <div
                className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold"
                style={{
                  background: 'rgba(249,115,22,0.12)',
                  border: '1px solid rgba(249,115,22,0.25)',
                  color: '#fb923c',
                }}
              >
                <Zap className="w-3 h-3" />
                Live
              </div>

              <button
                onClick={handleLogout}
                title="Logout"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition touch-manipulation"
              >
                <LogOut className="w-4 h-4" />
                <span className="hidden sm:inline">Logout</span>
              </button>
            </div>
          </div>
        </header>

        {/* ── Scrollable content ── */}
        <main
          className="flex-1 overflow-y-auto overflow-x-hidden [-webkit-overflow-scrolling:touch] pb-24 lg:pb-6"
        >
          <div className="w-full max-w-7xl mx-auto px-3 sm:px-5 py-4 sm:py-6 animate-fade-in-up">
            {children}
          </div>
        </main>
      </div>

      {/* Mobile bottom nav */}
      <BottomNav />

      {/* FAB — mobile only */}
      <FAB className="lg:hidden" />

      {/* Quick Action Bar — mobile only, above BottomNav */}
      <QuickActionBar />
    </div>
    </CrawlerProvider>
    </ToastProvider>
  );
}
