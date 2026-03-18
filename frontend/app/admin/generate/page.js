'use client';

import { useRef, useState } from 'react';
import dynamic from 'next/dynamic';

import DealGeneratorForm from '../../../components/DealGeneratorForm';
import DealPreviewCard from '../../../components/DealPreviewCard';
import LoadingSkeleton from '../../../components/LoadingSkeleton';
import Toast from '../../../components/Toast';
import { dealsApi, telegramApi } from '../../../lib/api';

// Lazy-load modal — keeps initial bundle tight
const ReelModal = dynamic(() => import('../../../components/reels/ReelModal'), { ssr: false });

export default function GeneratePage() {
  const [deal,           setDeal]           = useState(null);
  const [generating,     setGenerating]     = useState(false);
  const [telegramLoading,setTelegramLoading]= useState(false);
  const [reelOpen,       setReelOpen]       = useState(false);
  const [toast,          setToast]          = useState(null);
  const toastId = useRef(0);

  function showToast(type, message) {
    toastId.current += 1;
    setToast({ type, message, id: toastId.current });
  }

  async function handleGenerate(url) {
    setGenerating(true);
    setDeal(null);
    setReelOpen(false);
    try {
      const res = await dealsApi.generate(url);
      // Backend returns { success, deal, shouldPost, reason } — extract deal
      const dealData = res.deal || res;
      setDeal(dealData);
      showToast('success', 'Deal scraped successfully!');
    } catch (err) {
      showToast('error', err.message || 'Failed to generate deal. Check the URL and try again.');
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
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold text-slate-900">Generate Deal</h1>
        <p className="text-sm text-slate-500">
          Paste a product URL to scrape deal data, post to Telegram, and generate an Instagram Reel.
        </p>
      </header>

      <DealGeneratorForm onGenerate={handleGenerate} loading={generating} />

      {generating && <LoadingSkeleton />}

      {!generating && deal && (
        <>
          <DealPreviewCard
            deal={deal}
            onPostTelegram={handlePostTelegram}
            telegramLoading={telegramLoading}
          />

          {/* Instagram Reel CTA */}
          {deal._id && (
            <div className="flex items-center justify-between px-5 py-4 bg-gradient-to-r from-violet-50 to-pink-50 border border-violet-200 rounded-2xl">
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
                className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white rounded-xl transition-all active:scale-[0.97]"
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
        </>
      )}

      {reelOpen && deal && (
        <ReelModal deal={deal} onClose={() => setReelOpen(false)} />
      )}

      <Toast toast={toast} onDismiss={() => setToast(null)} />
    </div>
  );
}
