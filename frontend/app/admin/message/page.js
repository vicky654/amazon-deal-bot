'use client';

import { useRef, useState } from 'react';
import CustomMessagePanel from '../../../components/CustomMessagePanel';
import Toast from '../../../components/Toast';
import { telegramApi } from '../../../lib/api';

export default function MessagePage() {
  const [toast,   setToast]   = useState(null);
  const [loading, setLoading] = useState(false);
  const toastId = useRef(0);

  function showToast(type, message) {
    toastId.current += 1;
    setToast({ type, message, id: toastId.current });
  }

  async function handleSend(message) {
    setLoading(true);
    try {
      await telegramApi.sendMessage(message);
      showToast('success', 'Message sent to Telegram!');
    } catch (err) {
      showToast('error', err.message || 'Message send failed.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold text-slate-900">Custom Message</h1>
        <p className="text-sm text-slate-500">Send a one-off message to your Telegram channel.</p>
      </header>

      <CustomMessagePanel onSend={handleSend} loading={loading} />

      <Toast toast={toast} onDismiss={() => setToast(null)} />
    </div>
  );
}
