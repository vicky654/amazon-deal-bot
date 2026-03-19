'use client';

import TestingPanel from '../../../components/TestingPanel';

export default function TestingPage() {
  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-violet-100 border border-violet-200 flex items-center justify-center text-lg shrink-0">
            🧪
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Testing Panel</h1>
            <p className="text-sm text-slate-500">
              Verify all integrations are working — Telegram, Cron, Affiliate, Scraper.
            </p>
          </div>
        </div>
      </header>

      <TestingPanel />
    </div>
  );
}
