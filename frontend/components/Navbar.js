'use client';

const SECTION_LABELS = {
  generate: 'Generate Deal',
  recent: 'Recent Deals',
  message: 'Custom Message',
};

/**
 * Props:
 *   activeSection: string
 *   onMenuToggle: () => void
 */
export default function Navbar({ activeSection, onMenuToggle }) {
  return (
    <header className="sticky top-0 z-10 bg-white border-b border-slate-200 h-14 flex items-center px-4 lg:px-6 gap-4">
      {/* Hamburger — mobile only */}
      <button
        onClick={onMenuToggle}
        className="lg:hidden p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors"
        aria-label="Open menu"
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      {/* Page title */}
      <div className="flex items-center gap-2">
        <h1 className="text-base font-semibold text-slate-900">
          {SECTION_LABELS[activeSection] ?? 'Dashboard'}
        </h1>
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Right side — branding pill */}
      <div className="flex items-center gap-1.5 bg-orange-50 border border-orange-200 rounded-full px-3 py-1">
        <span className="text-orange-500 text-xs font-semibold">amazon.in</span>
        <span className="text-slate-300">·</span>
        <span className="text-blue-500 text-xs font-semibold">Telegram</span>
      </div>
    </header>
  );
}
