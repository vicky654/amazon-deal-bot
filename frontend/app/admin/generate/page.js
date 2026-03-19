'use client';

import { useRef, useState } from 'react';
import dynamic from 'next/dynamic';

import DealGeneratorForm from '../../../components/DealGeneratorForm';
import DealPreviewCard   from '../../../components/DealPreviewCard';
import LoadingSkeleton   from '../../../components/LoadingSkeleton';
import Toast             from '../../../components/Toast';
import { dealsApi, telegramApi } from '../../../lib/api';

const ReelModal = dynamic(() => import('../../../components/reels/ReelModal'), { ssr: false });

export default function GeneratePage() {
  const [deal,            setDeal]            = useState(null);
  const [generating,      setGenerating]      = useState(false);
  const [generateError,   setGenerateError]   = useState(null);
  const [telegramLoading, setTelegramLoading] = useState(false);
  const [reelOpen,        setReelOpen]        = useState(false);
  const [toast,           setToast]           = useState(null);
  const toastId   = useRef(0);
  const previewRef = useRef(null);

  function showToast(type, message) {
    toastId.current += 1;
    setToast({ type, message, id: toastId.current });
  }

  async function handleGenerate(url) {
    setGenerating(true);
    setDeal(null);
    setGenerateError(null);
    setReelOpen(false);
    try {
      const res      = await dealsApi.generate(url);
      const dealData = res.deal || res;
      setDeal(dealData);
      showToast('success', 'Deal scraped successfully!');
      // Scroll to preview on mobile after a short tick
      setTimeout(() => previewRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 150);
    } catch (err) {
      const msg = err.message || 'Failed to generate deal. Check the URL and try again.';
      setGenerateError(msg);
      showToast('error', msg);
    } finally {
      setGenerating(false);
    }
  }

  async function handlePostTelegram() {
    if (!deal) return;
    setTelegramLoading(true);
    try {
      await telegramApi.send(
        deal.title,
        deal.price,
        deal.image,
        deal.affiliateLink || deal.link,
        deal.originalPrice,
        deal.discount ?? deal.savings,
        deal.platform,
      );
      showToast('success', 'Deal posted to Telegram channel!');
    } catch (err) {
      showToast('error', err.message || 'Telegram post failed. Check your bot config.');
    } finally {
      setTelegramLoading(false);
    }
  }

  return (
    <div className="space-y-5">
      {/* ── Page header ── */}
      <header className="space-y-1">
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Generate Deal</h1>
        <p className="text-sm text-slate-500">
          Paste any Amazon URL or short link — price, discount, and affiliate link extracted automatically.
        </p>
      </header>

      {/* ── Generator form ── */}
      <DealGeneratorForm
        onGenerate={handleGenerate}
        loading={generating}
        error={generateError}
      />

      {/* ── Loading skeleton ── */}
      {generating && <LoadingSkeleton />}

      {/* ── Deal preview ── */}
      {!generating && deal && (
        <div ref={previewRef} className="space-y-4">
          <DealPreviewCard
            deal={deal}
            onPostTelegram={handlePostTelegram}
            telegramLoading={telegramLoading}
          />

          {/* Reel CTA */}
          {deal._id && (
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-4 sm:px-5 py-4 bg-gradient-to-r from-violet-50 to-pink-50 border border-violet-200 rounded-2xl">
              <div className="flex items-center gap-3">
                <div
                  className="h-10 w-10 rounded-xl flex items-center justify-center text-lg shrink-0"
                  style={{ background: 'linear-gradient(135deg,#7c3aed,#ec4899)' }}
                >
                  🎬
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900">Create Instagram Reel</p>
                  <p className="text-xs text-gray-500">Generate a viral 1080×1920 MP4 + caption</p>
                </div>
              </div>
              <button
                onClick={() => setReelOpen(true)}
                className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold text-white rounded-xl transition-all active:scale-[0.97] touch-manipulation"
                style={{ background: 'linear-gradient(135deg,#7c3aed,#ec4899)', boxShadow: '0 4px 14px rgba(124,58,237,0.30)' }}
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M15 10l4.553-2.069A1 1 0 0121 8.87v6.26a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                Create Reel
              </button>
            </div>
          )}
        </div>
      )}

      {reelOpen && deal && (
        <ReelModal deal={deal} onClose={() => setReelOpen(false)} />
      )}

      <Toast toast={toast} onDismiss={() => setToast(null)} />
    </div>
  );
}
