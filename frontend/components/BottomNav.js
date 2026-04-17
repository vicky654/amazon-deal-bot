'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Plus, Package, Activity, SlidersHorizontal } from 'lucide-react';

const NAV = [
  { href: '/admin',          icon: LayoutDashboard,   label: 'Home'     },
  { href: '/admin/deals',    icon: Package,           label: 'Deals'    },
  { href: '/admin/generate', icon: Plus,              label: 'Generate' },
  { href: '/admin/features', icon: SlidersHorizontal, label: 'Features' },
  { href: '/admin/crawler',  icon: Activity,          label: 'Crawler'  },
];

export default function BottomNav() {
  const pathname = usePathname();

  function isActive(href) {
    if (href === '/admin') return pathname === '/admin';
    return pathname === href || pathname?.startsWith(`${href}/`);
  }

  return (
    <nav className="lg:hidden fixed bottom-0 inset-x-0 z-40">
      {/* Glass base */}
      <div
        className="safe-bottom"
        style={{
          background: 'rgba(2, 6, 23, 0.85)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          borderTop: '1px solid rgba(255,255,255,0.06)',
        }}
      >
        <div className="flex items-center justify-around h-16 px-2">
          {NAV.map(({ href, icon: Icon, label }) => {
            const active = isActive(href);
            const isCenter = href === '/admin/generate';

            /* Centre tab — elevated pill style */
            if (isCenter) {
              return (
                <Link
                  key={href}
                  href={href}
                  className="flex flex-col items-center justify-center -mt-5 touch-manipulation"
                >
                  <div
                    className="w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg transition-transform active:scale-90"
                    style={{
                      background: active
                        ? 'linear-gradient(135deg,#f97316,#ea580c)'
                        : 'linear-gradient(135deg,#374151,#1f2937)',
                      boxShadow: active
                        ? '0 4px 20px rgba(249,115,22,0.40)'
                        : '0 4px 16px rgba(0,0,0,0.4)',
                    }}
                  >
                    <Icon className="w-6 h-6 text-white" strokeWidth={active ? 2.5 : 2} />
                  </div>
                  <span
                    className="text-[9px] font-semibold mt-1 transition-colors"
                    style={{ color: active ? '#f97316' : '#64748b' }}
                  >
                    {label}
                  </span>
                </Link>
              );
            }

            return (
              <Link
                key={href}
                href={href}
                className="relative flex flex-col items-center justify-center gap-1 px-3 py-1 rounded-xl touch-manipulation transition-all active:scale-95"
              >
                {/* Active dot */}
                {active && (
                  <span
                    className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-0.5 w-1 h-1 rounded-full"
                    style={{ background: '#f97316' }}
                  />
                )}
                <Icon
                  className="w-[22px] h-[22px] transition-all"
                  style={{ color: active ? '#f97316' : '#64748b' }}
                  strokeWidth={active ? 2.5 : 1.75}
                />
                <span
                  className="text-[9px] font-semibold transition-colors"
                  style={{ color: active ? '#f97316' : '#64748b' }}
                >
                  {label}
                </span>
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
