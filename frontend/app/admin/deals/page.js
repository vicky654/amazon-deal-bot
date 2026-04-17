'use client';

import EnhancedDealsTable from '../../../components/EnhancedDealsTable';

export default function DealsPage() {
  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold text-white">Recent Deals</h1>
        <p className="text-sm text-slate-500">
          System stores only the latest 20 deals — older records are automatically purged.
        </p>
      </header>

      <EnhancedDealsTable />
    </div>
  );
}
