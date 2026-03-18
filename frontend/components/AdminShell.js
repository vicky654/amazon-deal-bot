'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Menu, X } from 'lucide-react';

import Sidebar from './Sidebar';

export default function AdminShell({ children }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen flex bg-slate-50 overflow-hidden">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex-1 flex flex-col">
        <header className="sticky top-0 z-20 bg-white/70 backdrop-blur border-b border-slate-200">
          <div className="max-w-7xl w-full mx-auto px-4 py-3 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setSidebarOpen((v) => !v)}
                className="lg:hidden p-2 rounded-md text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition"
                aria-label="Toggle menu"
              >
                {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
              <Link
                href="/"
                className="text-sm font-semibold text-slate-900 hover:text-slate-700"
              >
                DealBot Admin
              </Link>
            </div>
            <div className="hidden sm:flex items-center gap-4">
              <Link
                href="/admin/how-it-works"
                className="text-xs font-medium text-slate-500 hover:text-slate-800"
              >
                How It Works
              </Link>
              <Link
                href="/admin/settings"
                className="text-xs font-medium text-slate-500 hover:text-slate-800"
              >
                Settings
              </Link>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto w-full">
          <div className="mx-auto w-full max-w-7xl px-4 py-6">{children}</div>
        </main>
      </div>
    </div>
  );
}
