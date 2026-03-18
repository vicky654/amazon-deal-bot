'use client';

import { useRef, useState } from 'react';

import CrawlerPanel from '../../../components/CrawlerPanel';
import Toast from '../../../components/Toast';

export default function CrawlerPage() {
  const [toast, setToast] = useState(null);
  const toastId = useRef(0);

  function showToast(type, message) {
    toastId.current += 1;
    setToast({ type, message, id: toastId.current });
  }

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold text-slate-900">Crawler Status</h1>
        <p className="text-sm text-slate-500">Monitor scrapes, queue health, and recent crawl runs.</p>
      </header>

      <CrawlerPanel onToast={showToast} />

      <Toast toast={toast} onDismiss={() => setToast(null)} />
    </div>
  );
}
