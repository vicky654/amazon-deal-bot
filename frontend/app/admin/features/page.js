'use client';

import FeatureControlPanel from '../../../components/FeatureControlPanel';
import DealActivityLog     from '../../../components/DealActivityLog';

export default function FeaturesPage() {
  return (
    <div className="space-y-6 pb-32 lg:pb-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold text-white">Feature Control</h1>
        <p className="text-sm" style={{ color: '#64748b' }}>
          Toggle automation rules, smart filters, and content generation features.
        </p>
      </header>

      <FeatureControlPanel />

      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <span className="text-base">📋</span>
          <h2 className="text-[13px] font-bold uppercase tracking-widest" style={{ color: '#475569' }}>
            Live Activity
          </h2>
        </div>
        <DealActivityLog />
      </div>
    </div>
  );
}
