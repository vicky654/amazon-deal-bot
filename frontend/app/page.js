'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';

import Sidebar from '../components/Sidebar';
import Navbar from '../components/Navbar';
import DealGeneratorForm from '../components/DealGeneratorForm';
import DealPreviewCard from '../components/DealPreviewCard';
import LoadingSkeleton from '../components/LoadingSkeleton';
import RecentDealsTable from '../components/RecentDealsTable';
import CustomMessagePanel from '../components/CustomMessagePanel';
import CrawlerPanel from '../components/CrawlerPanel';
import Toast from '../components/Toast';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

export default function Dashboard() {
  // ── Navigation ──────────────────────────────────────────────────────────────
  const [activeSection, setActiveSection] = useState('generate');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // ── Deal generation ──────────────────────────────────────────────────────────
  const [deal, setDeal] = useState(null);
  const [generating, setGenerating] = useState(false);

  // ── Recent deals ─────────────────────────────────────────────────────────────
  const [recentDeals, setRecentDeals] = useState([]);
  const [recentLoading, setRecentLoading] = useState(false);

  // ── Telegram ─────────────────────────────────────────────────────────────────
  const [telegramLoading, setTelegramLoading] = useState(false);
  const [messageLoading, setMessageLoading] = useState(false);

  // ── Toast ────────────────────────────────────────────────────────────────────
  const [toast, setToast] = useState(null);
  const toastId = useRef(0);

  function showToast(type, message) {
    toastId.current += 1;
    setToast({ type, message, id: toastId.current });
  }

  // ── Fetch recent deals ───────────────────────────────────────────────────────
  const fetchRecentDeals = useCallback(async () => {
    setRecentLoading(true);
    try {
      const { data } = await axios.get(`${API_URL}/api/deals`);
      setRecentDeals(data);
    } catch {
      showToast('error', 'Could not load recent deals — is the backend running?');
    } finally {
      setRecentLoading(false);
    }
  }, []);

  // Auto-fetch on mount and when switching to the recent section
  useEffect(() => {
    fetchRecentDeals();
  }, [fetchRecentDeals]);

  useEffect(() => {
    if (activeSection === 'recent') fetchRecentDeals();
  }, [activeSection, fetchRecentDeals]);

  // ── Generate deal ─────────────────────────────────────────────────────────────
  async function handleGenerate(url) {
    setGenerating(true);
    setDeal(null);
    try {
      const { data } = await axios.post(`${API_URL}/generate`, { url });
      setDeal(data);
      showToast('success', 'Deal scraped successfully!');
      // Refresh recent deals in background
      fetchRecentDeals();
    } catch (err) {
      const msg = err.response?.data?.error || 'Failed to generate deal. Check the URL and try again.';
      showToast('error', msg);
    } finally {
      setGenerating(false);
    }
  }

  // ── Post deal to Telegram ─────────────────────────────────────────────────────
  async function handlePostTelegram() {
    if (!deal) return;
    setTelegramLoading(true);
    try {
      await axios.post(`${API_URL}/telegram`, {
        title: deal.title,
        price: deal.price,
        image: deal.image,
        link: deal.link,
        originalPrice: deal.originalPrice,
        savings: deal.savings,
      });
      showToast('success', 'Deal posted to Telegram channel!');
    } catch (err) {
      const msg = err.response?.data?.error || 'Telegram post failed. Check your bot config.';
      showToast('error', msg);
    } finally {
      setTelegramLoading(false);
    }
  }

  // ── Send custom message ───────────────────────────────────────────────────────
  async function handleSendMessage(message) {
    setMessageLoading(true);
    try {
      await axios.post(`${API_URL}/telegram-message`, { message });
      showToast('success', 'Message sent to Telegram!');
    } catch (err) {
      const msg = err.response?.data?.error || 'Message send failed.';
      showToast('error', msg);
    } finally {
      setMessageLoading(false);
    }
  }

  // ── Stats for the generate section header ────────────────────────────────────
  const totalDeals = recentDeals.length;
  const postedCount = recentDeals.filter((d) => d.posted).length;
  const avgSavings =
    recentDeals.length > 0
      ? Math.round(
          recentDeals.reduce((sum, d) => sum + (d.savings || 0), 0) / recentDeals.length
        )
      : 0;

  return (
    <div className="flex h-screen overflow-hidden bg-slate-100">
      {/* Sidebar */}
      <Sidebar
        activeSection={activeSection}
        onNavigate={setActiveSection}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      {/* Main area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top navbar */}
        <Navbar
          activeSection={activeSection}
          onMenuToggle={() => setSidebarOpen((v) => !v)}
        />

        {/* Scrollable content */}
        <main className="flex-1 overflow-y-auto">
          <div className="max-w-4xl mx-auto px-4 lg:px-6 py-6 space-y-5">

            {/* ── GENERATE SECTION ──────────────────────────────────────── */}
            {activeSection === 'generate' && (
              <>
                {/* Stats row */}
                <div className="grid grid-cols-3 gap-3">
                  <StatCard
                    label="Total Deals"
                    value={totalDeals}
                    icon="📦"
                    color="orange"
                  />
                  <StatCard
                    label="Posted"
                    value={postedCount}
                    icon="📤"
                    color="blue"
                  />
                  <StatCard
                    label="Avg Savings"
                    value={avgSavings > 0 ? `${avgSavings}%` : '—'}
                    icon="💰"
                    color="green"
                  />
                </div>

                {/* URL form */}
                <DealGeneratorForm onGenerate={handleGenerate} loading={generating} />

                {/* Loading skeleton */}
                {generating && <LoadingSkeleton />}

                {/* Deal preview */}
                {!generating && deal && (
                  <DealPreviewCard
                    deal={deal}
                    onPostTelegram={handlePostTelegram}
                    telegramLoading={telegramLoading}
                  />
                )}

                {/* Empty state — no deal yet */}
                {!generating && !deal && (
                  <div className="bg-white rounded-2xl border border-slate-200 border-dashed p-10 flex flex-col items-center gap-3 text-center">
                    <div className="w-16 h-16 rounded-2xl bg-orange-50 border border-orange-100 flex items-center justify-center text-3xl">
                      🔍
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-600">No deal generated yet</p>
                      <p className="text-xs text-slate-400 mt-1">
                        Paste an Amazon product URL above and click Generate Deal.
                      </p>
                    </div>
                  </div>
                )}
              </>
            )}

            {/* ── RECENT DEALS SECTION ──────────────────────────────────── */}
            {activeSection === 'recent' && (
              <RecentDealsTable
                deals={recentDeals}
                loading={recentLoading}
                onRefresh={fetchRecentDeals}
              />
            )}

            {/* ── CRAWLER SECTION ───────────────────────────────────────── */}
            {activeSection === 'crawler' && (
              <CrawlerPanel onToast={showToast} />
            )}

            {/* ── CUSTOM MESSAGE SECTION ────────────────────────────────── */}
            {activeSection === 'message' && (
              <CustomMessagePanel
                onSend={handleSendMessage}
                loading={messageLoading}
              />
            )}
          </div>
        </main>
      </div>

      {/* Toast */}
      <Toast toast={toast} onDismiss={() => setToast(null)} />
    </div>
  );
}

/* ── Stat card sub-component ───────────────────────────────────────────────── */

const STAT_COLORS = {
  orange: {
    bg: 'bg-orange-50',
    border: 'border-orange-100',
    text: 'text-orange-600',
  },
  blue: {
    bg: 'bg-blue-50',
    border: 'border-blue-100',
    text: 'text-blue-600',
  },
  green: {
    bg: 'bg-green-50',
    border: 'border-green-100',
    text: 'text-green-600',
  },
};

function StatCard({ label, value, icon, color }) {
  const c = STAT_COLORS[color] || STAT_COLORS.orange;
  return (
    <div className={`rounded-xl border ${c.border} ${c.bg} p-4`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-base">{icon}</span>
      </div>
      <p className={`text-xl font-bold ${c.text}`}>{value}</p>
      <p className="text-xs text-slate-500 mt-0.5 font-medium">{label}</p>
    </div>
  );
}
