'use client';

import EarnKaroSettings from '../../../components/EarnKaroSettings';

export default function SettingsPage() {
  return (
    <div className="max-w-2xl mx-auto py-8 px-4 space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Settings</h1>
        <p className="text-sm text-gray-500 mt-1">Manage integrations and system configuration</p>
      </div>

      {/* EarnKaro Section */}
      <section>
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Affiliate Integration</h2>
        <EarnKaroSettings />
      </section>

      {/* Platform thresholds info */}
      <section>
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Deal Thresholds</h2>
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm p-5">
          <p className="text-xs text-gray-500 mb-4">
            Configure via environment variables. Restart the backend after changing.
          </p>
          <div className="grid grid-cols-2 gap-3">
            {[
              { platform: 'Amazon',   env: 'AMAZON_MIN_DISCOUNT',   default: '40%' },
              { platform: 'Flipkart', env: 'FLIPKART_MIN_DISCOUNT',  default: '40%' },
              { platform: 'Myntra',   env: 'MYNTRA_MIN_DISCOUNT',    default: '50%' },
              { platform: 'Ajio',     env: 'AJIO_MIN_DISCOUNT',      default: '50%' },
            ].map(({ platform, env, default: def }) => (
              <div key={platform} className="bg-gray-50 border border-gray-200 rounded-lg px-4 py-3">
                <p className="text-sm font-medium text-gray-900">{platform}</p>
                <p className="text-xs text-gray-400 mt-0.5 font-mono">{env}={def}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
