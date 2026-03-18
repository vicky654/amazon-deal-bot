'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Plus,
  Package,
  Activity,
  MessageSquare,
  Wallet,
  Info,
  BarChart2,
  ListChecks,
  Video,
} from 'lucide-react';

const MENU = [
  {
    section: 'Tools',
    items: [
      { label: 'Generate Deal',     href: '/admin/generate', icon: Plus    },
      { label: 'Recent Deals',      href: '/admin/deals',    icon: Package },
      { label: 'Instagram Reels',   href: '/admin/deals',    icon: Video,  badge: 'New' },
      { label: 'Crawler Status',    href: '/admin/crawler',  icon: Activity },
      { label: 'Custom Message',    href: '/admin/message',  icon: MessageSquare },
    ],
  },
  {
    section: 'Affiliate',
    items: [
      { label: 'EarnKaro Settings', href: '/admin/settings', icon: Wallet },
      { label: 'Affiliate History', href: '/admin/affiliate-history', icon: ListChecks },
    ],
  },
  {
    section: 'System',
    items: [
      { label: 'How It Works', href: '/admin/how-it-works', icon: Info }, // FIXED
      { label: 'System Metrics', href: '/admin/metrics', icon: BarChart2 },
    ],
  },
];

export default function Sidebar({ open = false, onClose = () => {} }) {
  const pathname = usePathname();

  function isActive(href) {
    if (href === '/') return pathname === '/';
    return pathname === href || pathname?.startsWith(`${href}/`);
  }

  return (
    <>
      {/* Mobile backdrop */}
      {open && (
        <div
          className="fixed inset-0 bg-black/50 z-20 lg:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed inset-y-0 left-0 w-72 bg-slate-900 text-white flex flex-col z-30
          transform transition-transform duration-300 ease-in-out
          ${open ? 'translate-x-0' : '-translate-x-full'}
          
          lg:translate-x-0 lg:static lg:h-screen lg:flex-shrink-0
        `}
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-6 py-5 border-b border-slate-700/60">
          <div className="w-10 h-10 rounded-xl bg-orange-500 flex items-center justify-center text-lg shrink-0">
            🔥
          </div>
          <div>
            <p className="text-sm font-bold tracking-tight">DealBots</p>
            <p className="text-xs text-slate-300">Admin Dashboard</p>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-4 py-5 space-y-5 overflow-y-auto">
          {MENU.map((group) => (
            <div key={group.section}>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                {group.section}
              </p>

              <div className="space-y-1">
                {group.items.map((item) => {
                  const active = isActive(item.href);
                  const Icon = item.icon;

                  return (
                    <Link
                      key={item.label}
                      href={item.href}
                      onClick={onClose}
                      className={`
                        group flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all
                        ${
                          active
                            ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/30'
                            : 'text-slate-200 hover:text-white hover:bg-slate-800'
                        }
                      `}
                    >
                      <Icon
                        className={`w-5 h-5 shrink-0 ${
                          active
                            ? 'text-white'
                            : 'text-slate-400 group-hover:text-white'
                        }`}
                      />
                      <span className="flex-1">{item.label}</span>
                      {item.badge && (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-violet-500 text-white shrink-0">
                          {item.badge}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-700/60">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs text-slate-300">
              Backend connected
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            amazon.in · Telegram
          </p>
        </div>
      </aside>
    </>
  );
}