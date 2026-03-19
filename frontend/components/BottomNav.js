'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

// Bottom nav items — keep to 5 max for mobile UX
const NAV = [
  { href: '/admin',           icon: '🏠', label: 'Home'      },
  { href: '/admin/generate',  icon: '➕', label: 'Generate'  },
  { href: '/admin/deals',     icon: '🛍️', label: 'Deals'     },
  { href: '/admin/analytics', icon: '📈', label: 'Analytics' },
  { href: '/admin/system',    icon: '📊', label: 'Status'    },
];

export default function BottomNav() {
  const pathname = usePathname();

  function isActive(href) {
    if (href === '/admin') return pathname === '/admin';
    return pathname === href || pathname?.startsWith(`${href}/`);
  }

  return (
    // Only visible on mobile (lg:hidden), sits above system chrome
    <nav className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-white border-t border-gray-200 safe-area-inset-bottom">
      <div className="flex items-stretch h-16">
        {NAV.map(({ href, icon, label }) => {
          const active = isActive(href);
          return (
            <Link
              key={href}
              href={href}
              className={`flex-1 flex flex-col items-center justify-center gap-0.5 text-[10px] font-semibold transition-colors touch-manipulation ${
                active
                  ? 'text-orange-500'
                  : 'text-gray-400 hover:text-gray-700'
              }`}
            >
              <span className={`text-xl leading-none transition-transform ${active ? 'scale-110' : ''}`}>
                {icon}
              </span>
              <span className={`transition-all ${active ? 'text-orange-500' : ''}`}>{label}</span>
              {active && (
                <span className="absolute top-0 left-1/2 -translate-x-1/2 h-0.5 w-8 bg-orange-500 rounded-full" />
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
