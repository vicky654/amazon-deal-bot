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
  Cpu,
  MousePointerClick,
  LayoutDashboard,
  Bug,
} from 'lucide-react';

const MENU = [
  {
    section: 'Overview',
    items: [
      { label: 'Dashboard',         href: '/admin',          icon: LayoutDashboard },
    ],
  },
  {
    section: 'Tools',
    items: [
      { label: 'Generate Deal',     href: '/admin/generate', icon: Plus        },
      { label: 'Recent Deals',      href: '/admin/deals',    icon: Package     },
      { label: 'Crawler Status',    href: '/admin/crawler',  icon: Activity    },
      { label: 'Custom Message',    href: '/admin/message',  icon: MessageSquare },
    ],
  },
  {
    section: 'Affiliate',
    items: [
      { label: 'EarnKaro Settings', href: '/admin/settings',           icon: Wallet           },
      { label: 'Affiliate History', href: '/admin/affiliate-history',  icon: ListChecks       },
      { label: 'EarnKaro Debug',    href: '/admin/earnkaro-debug',     icon: Bug,             badge: 'New' },
      { label: 'Analytics',         href: '/admin/analytics',          icon: MousePointerClick },
    ],
  },
  {
    section: 'System',
    items: [
      { label: 'Cron Monitor',   href: '/admin/system',       icon: Cpu,        badge: 'Live' },
      { label: 'Testing Panel',  href: '/admin/testing',      icon: ListChecks, badge: 'New'  },
      { label: 'How It Works',   href: '/admin/how-it-works', icon: Info        },
      { label: 'System Metrics', href: '/admin/metrics',      icon: BarChart2   },
    ],
  },
];

export default function Sidebar({ open = false, onClose = () => {} }) {
  const pathname = usePathname();

  function isActive(href) {
    if (href === '/admin') return pathname === '/admin';
    return pathname === href || pathname?.startsWith(`${href}/`);
  }

  return (
    <>
      {/* Mobile backdrop — sits below sidebar (z-20), above content */}
      {open && (
        <div
          className="fixed inset-0 bg-black/50 z-20 lg:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/*
       * SIDEBAR:
       *
       * Mobile  → fixed, full-height, slides in/out via translate
       * Desktop → static, h-screen, shrink-0 so it never collapses
       *
       * h-screen + flex flex-col ensures the sidebar fills the viewport
       * and the nav area (flex-1 overflow-y-auto) scrolls independently.
       */}
      <aside
        className={[
          // Base — mobile: fixed overlay
          'fixed inset-y-0 left-0 z-30',
          'w-64 xl:w-72',
          'bg-slate-900 text-white',
          'flex flex-col',
          'transform transition-transform duration-300 ease-in-out',
          open ? 'translate-x-0' : '-translate-x-full',
          // Desktop: back in flow, exact viewport height, no translate
          'lg:relative lg:translate-x-0 lg:h-screen lg:shrink-0',
        ].join(' ')}
      >
        {/* Logo header */}
        <div className="shrink-0 flex items-center gap-3 px-5 py-5 border-b border-slate-700/60">
          <div className="w-9 h-9 rounded-xl bg-orange-500 flex items-center justify-center text-base shrink-0">
            🔥
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold tracking-tight truncate">DealBots</p>
            <p className="text-xs text-slate-400 truncate">Admin Dashboard</p>
          </div>
        </div>

        {/* Nav — scrolls independently when menu is long */}
        <nav className="flex-1 min-h-0 overflow-y-auto px-3 py-4 space-y-5">
          {MENU.map((group) => (
            <div key={group.section}>
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1.5 px-2">
                {group.section}
              </p>

              <div className="space-y-0.5">
                {group.items.map((item) => {
                  const active = isActive(item.href);
                  const Icon   = item.icon;

                  return (
                    <Link
                      key={item.label}
                      href={item.href}
                      onClick={onClose}
                      className={[
                        'group flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all',
                        active
                          ? 'bg-orange-500 text-white shadow-md shadow-orange-500/25'
                          : 'text-slate-300 hover:text-white hover:bg-slate-800',
                      ].join(' ')}
                    >
                      <Icon
                        className={`w-4 h-4 shrink-0 ${
                          active ? 'text-white' : 'text-slate-500 group-hover:text-white'
                        }`}
                      />
                      <span className="flex-1 truncate">{item.label}</span>
                      {item.badge && (
                        <span className="shrink-0 text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-violet-500 text-white">
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
        <div className="shrink-0 px-5 py-3 border-t border-slate-700/60">
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs text-slate-400">Backend connected</span>
          </div>
          <p className="text-[11px] text-slate-600 mt-0.5">amazon.in · Telegram</p>
        </div>
      </aside>
    </>
  );
}
