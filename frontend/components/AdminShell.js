'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Menu, X, LogOut } from 'lucide-react';

import Sidebar  from './Sidebar';
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
    <div className="min-h-screen flex bg-slate-50 overflow-hidden">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex-1 flex flex-col min-w-0">
        <header className="sticky top-0 z-20 bg-white/70 backdrop-blur border-b border-slate-200">
          <div className="max-w-7xl w-full mx-auto px-4 py-3 flex items-center justify-between gap-4">
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

              {/* Logout button */}
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

        {/* pb-16 reserves space for the mobile bottom nav bar */}
        <main className="flex-1 overflow-y-auto w-full [-webkit-overflow-scrolling:touch] pb-16 lg:pb-0">
          <div className="mx-auto w-full max-w-7xl px-3 sm:px-4 py-4 sm:py-6">{children}</div>
        </main>
      </div>

      {/* Mobile bottom navigation — hidden on lg+ */}
      <BottomNav />
    </div>
  );
}
