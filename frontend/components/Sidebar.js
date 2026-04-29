'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Plus, Package, Activity, MessageSquare,
  Wallet, Info, BarChart2, ListChecks,
  Cpu, MousePointerClick, LayoutDashboard, Bug, SlidersHorizontal,
  BadgePercent, TrendingDown, Sparkles, Tags, ShoppingCart, ChevronDown, ChevronRight, Award, Zap
} from 'lucide-react';

const MENU = [
  {
    section: 'Overview',
    items: [
      { label: 'Dashboard',         href: '/admin',          icon: LayoutDashboard },
    ],
  },
  {
    section: 'Smart Deals',
    items: [
      { 
        label: 'Explore Deals', 
        href: '/admin/smart-deals', 
        icon: Sparkles,
        subItems: [
          { label: '🔥 Trending',      href: '/admin/smart-deals/trending', icon: Award },
          { label: '📉 Lowest Price',  href: '/admin/smart-deals/lowest-price', icon: TrendingDown },
          { label: '⚡ Lightning',    href: '/admin/smart-deals/lightning', icon: Zap },
          { label: '👟 Shoes',         href: '/admin/smart-deals/shoes' },
          { label: '👕 Fashion',       href: '/admin/smart-deals/fashion' },
          { label: '📱 Electronics',   href: '/admin/smart-deals/electronics' },
          { label: '⌚ Watches',       href: '/admin/smart-deals/watches' },
          { label: '💄 Beauty',        href: '/admin/smart-deals/beauty' },
          { label: '🏠 Home & Kitchen',href: '/admin/smart-deals/home-kitchen' },
          { label: '🎮 Gaming',        href: '/admin/smart-deals/gaming' },
        ]
      },
    ],
  },
  {
    section: 'Tools',
    items: [
      { label: 'Generate Deal',     href: '/admin/generate', icon: Plus               },
      { label: 'All Deals',         href: '/admin/deals',    icon: Package            },
      { label: 'Crawler',           href: '/admin/crawler',  icon: Activity           },
      { label: 'Features',          href: '/admin/features', icon: SlidersHorizontal, badge: 'New' },
      { label: 'Custom Message',    href: '/admin/message',  icon: MessageSquare      },
    ],
  },
  {
    section: 'Affiliate',
    items: [
      { label: 'EarnKaro Settings', href: '/admin/settings',           icon: Wallet            },
      { label: 'Affiliate History', href: '/admin/affiliate-history',  icon: ListChecks        },
      { label: 'EarnKaro Debug',    href: '/admin/earnkaro-debug',     icon: Bug,   badge: 'New'  },
      { label: 'Analytics',         href: '/admin/analytics',          icon: MousePointerClick },
    ],
  },
  {
    section: 'System',
    items: [
      { label: 'Cron Monitor',   href: '/admin/system',       icon: Cpu,        badge: 'Live' },
      { label: 'Testing Panel',  href: '/admin/testing',      icon: ListChecks, badge: 'New'  },
      { label: 'How It Works',   href: '/admin/how-it-works', icon: Info        },
      { label: 'Metrics',        href: '/admin/metrics',      icon: BarChart2   },
    ],
  },
];

const BADGE_COLORS = {
  Live: 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30',
  New:  'bg-violet-500/20  text-violet-400  border border-violet-500/30',
};

export default function Sidebar({ open = false, onClose = () => {} }) {
  const pathname = usePathname();
  const [expanded, setExpanded] = React.useState({ 'Explore Deals': true });

  function isActive(href) {
    if (href === '/admin') return pathname === '/admin';
    return pathname === href || pathname?.startsWith(`${href}/`);
  }

  const toggleExpand = (label) => {
    setExpanded(prev => ({ ...prev, [label]: !prev[label] }));
  };

  return (
    <>
      {/* Mobile backdrop */}
      {open && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-20 lg:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      <aside
        className={[
          'fixed inset-y-0 left-0 z-30',
          'w-64 xl:w-72',
          'flex flex-col',
          'transform transition-transform duration-300 ease-in-out',
          open ? 'translate-x-0' : '-translate-x-full',
          'lg:relative lg:translate-x-0 lg:h-screen lg:shrink-0',
        ].join(' ')}
        style={{
          background: 'rgba(2, 6, 23, 0.95)',
          backdropFilter: 'blur(20px)',
          borderRight: '1px solid rgba(255,255,255,0.06)',
        }}
      >
        {/* Logo */}
        <div
          className="shrink-0 flex items-center gap-3 px-5 py-5"
          style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}
        >
          <div
            className="w-10 h-10 rounded-2xl flex items-center justify-center text-base shrink-0 shadow-lg"
            style={{
              background: 'linear-gradient(135deg,#f97316,#ea580c)',
              boxShadow: '0 4px 16px rgba(249,115,22,0.35)',
            }}
          >
            🔥
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold text-white tracking-tight truncate">DealBot</p>
            <p className="text-[11px] text-slate-500 truncate">Admin Panel</p>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 min-h-0 overflow-y-auto px-3 py-4 space-y-6 scrollbar-none">
          {MENU.map((group) => (
            <div key={group.section}>
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-600 mb-2 px-2">
                {group.section}
              </p>
              <div className="space-y-0.5">
                {group.items.map((item) => {
                  const active = isActive(item.href);
                  const Icon   = item.icon;
                  const hasSub = item.subItems && item.subItems.length > 0;
                  const isExpanded = expanded[item.label];

                  return (
                    <div key={item.label}>
                      {hasSub ? (
                        <button
                          onClick={() => toggleExpand(item.label)}
                          className={[
                            'w-full group flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-medium transition-all touch-manipulation',
                            active || isExpanded ? 'text-white' : 'text-slate-400 hover:text-white',
                          ].join(' ')}
                        >
                          <Icon
                            className={`w-4 h-4 shrink-0 transition-colors ${
                              active || isExpanded ? 'text-orange-400' : 'text-slate-600 group-hover:text-slate-400'
                            }`}
                          />
                          <span className="flex-1 text-left truncate">{item.label}</span>
                          {isExpanded ? <ChevronDown size={14} className="text-slate-600" /> : <ChevronRight size={14} className="text-slate-600" />}
                        </button>
                      ) : (
                        <Link
                          href={item.href}
                          onClick={onClose}
                          className={[
                            'group flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-medium transition-all touch-manipulation',
                            active ? 'text-white' : 'text-slate-400 hover:text-white',
                          ].join(' ')}
                          style={active ? {
                            background: 'linear-gradient(135deg, rgba(249,115,22,0.18), rgba(234,88,12,0.10))',
                            border: '1px solid rgba(249,115,22,0.25)',
                          } : {
                            border: '1px solid transparent',
                          }}
                        >
                          <Icon
                            className={`w-4 h-4 shrink-0 transition-colors ${
                              active ? 'text-orange-400' : 'text-slate-600 group-hover:text-slate-400'
                            }`}
                            strokeWidth={active ? 2.5 : 1.75}
                          />
                          <span className="flex-1 truncate">{item.label}</span>
                          {item.badge && (
                            <span className={`shrink-0 text-[9px] font-bold px-1.5 py-0.5 rounded-full ${BADGE_COLORS[item.badge] ?? ''}`}>
                              {item.badge}
                            </span>
                          )}
                        </Link>
                      )}

                      {/* Sub Items */}
                      {hasSub && isExpanded && (
                        <div className="mt-1 ml-4 pl-3 border-l border-slate-800 space-y-1">
                          {item.subItems.map(sub => {
                            const subActive = isActive(sub.href);
                            const SubIcon = sub.icon;
                            return (
                              <Link
                                key={sub.label}
                                href={sub.href}
                                onClick={onClose}
                                className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-[12px] font-medium transition-colors ${
                                  subActive ? 'text-orange-400 bg-orange-500/5' : 'text-slate-500 hover:text-slate-300'
                                }`}
                              >
                                {SubIcon && <SubIcon size={12} />}
                                {sub.label}
                              </Link>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Footer */}
        <div
          className="shrink-0 px-5 py-4"
          style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}
        >
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
            <span className="text-xs text-slate-500">Backend connected</span>
          </div>
          <p className="text-[11px] text-slate-700 mt-1">Amazon · Flipkart · Telegram</p>
        </div>
      </aside>
    </>
  );
}
