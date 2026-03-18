'use client';

import { useState } from 'react';
import { dealsApi, telegramApi, ApiError } from '../lib/api';
import PlatformBadge from './PlatformBadge';

function AffiliateLinkBadge({ link }) {
  const [copied, setCopied] = useState(false);

  if (!link) return <span className="text-gray-400 text-xs">—</span>;

  const copy = async () => {
    await navigator.clipboard.writeText(link).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="flex items-center gap-2">
      <a href={link} target="_blank" rel="noopener noreferrer"
        className="text-blue-600 underline text-xs truncate max-w-xs hover:text-blue-800">
        {link}
      </a>
      <button onClick={copy} className="text-gray-400 hover:text-gray-600 shrink-0">
        {copied
          ? <span className="text-green-600 text-xs font-medium">Copied!</span>
          : <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/></svg>
        }
      </button>
    </div>
  );
}

function DealResult({ result, onPost }) {
  const { deal, shouldPost, reason } = result;

  return (
    <div className="mt-6 rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3 bg-gray-50 border-b border-gray-200">
        <div className="flex items-center gap-3">
          <PlatformBadge platform={deal.platform} />
          {deal.discount && (
            <span className="inline-flex items-center gap-1 bg-green-50 text-green-700 border border-green-200 rounded-full px-2.5 py-1 text-xs font-semibold">
              <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M5.293 9.707a1 1 0 010-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 01-1.414 1.414L11 7.414V15a1 1 0 11-2 0V7.414L6.707 9.707a1 1 0 01-1.414 0z" clipRule="evenodd"/></svg>
              {deal.discount}% OFF
            </span>
          )}
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${shouldPost ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
            {shouldPost ? '✓ Qualifies' : '✗ Below threshold'}
          </span>
        </div>
        {deal._id && (
          <button onClick={() => onPost(deal)}
            className="text-xs font-medium bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 transition-colors">
            Post to Telegram
          </button>
        )}
      </div>

      <div className="flex gap-4 p-5">
        {deal.image && (
          <img src={deal.image} alt={deal.title} className="w-24 h-24 object-contain rounded-lg border border-gray-100 bg-gray-50 shrink-0" />
        )}
        <div className="flex-1 min-w-0 space-y-3">
          <h3 className="font-semibold text-gray-900 text-sm leading-snug line-clamp-2">{deal.title}</h3>

          <div className="flex items-baseline gap-3">
            <span className="text-xl font-bold text-gray-900">
              ₹{Number(deal.price).toLocaleString('en-IN')}
            </span>
            {deal.originalPrice && (
              <>
                <span className="text-sm text-gray-400 line-through">
                  ₹{Number(deal.originalPrice).toLocaleString('en-IN')}
                </span>
                {deal.originalPrice > deal.price && (
                  <span className="text-sm text-green-600 font-medium">
                    Save ₹{(deal.originalPrice - deal.price).toLocaleString('en-IN')}
                  </span>
                )}
              </>
            )}
          </div>

          <div className="space-y-1">
            <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Affiliate Link</p>
            <AffiliateLinkBadge link={deal.affiliateLink || deal.link} />
          </div>

          <p className="text-xs text-gray-400 italic">{reason}</p>
        </div>
      </div>
    </div>
  );
}

export default function ManualDealGenerator() {
  const [url,      setUrl]      = useState('');
  const [loading,  setLoading]  = useState(false);
  const [result,   setResult]   = useState(null);
  const [error,    setError]    = useState('');
  const [toast,    setToast]    = useState('');

  const supportedDomains = ['amazon.in', 'amazon.com', 'flipkart.com', 'myntra.com', 'ajio.com'];

  const validate = (u) => {
    try {
      const parsed = new URL(u);
      return supportedDomains.some((d) => parsed.hostname.includes(d));
    } catch { return false; }
  };

  const handleGenerate = async () => {
    setError('');
    setResult(null);

    if (!url.trim()) { setError('Please enter a product URL'); return; }
    if (!validate(url)) {
      setError('URL must be from amazon.in, flipkart.com, myntra.com, or ajio.com');
      return;
    }

    setLoading(true);
    try {
      const data = await dealsApi.generate(url.trim());
      setResult(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to generate deal. Try again.');
    } finally {
      setLoading(false);
    }
  };

  const handlePost = async (deal) => {
    if (!deal._id) return;
    try {
      await dealsApi.postToTelegram(deal._id);
      showToast('Posted to Telegram!');
    } catch (err) {
      showToast('Post failed: ' + err.message);
    }
  };

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  };

  return (
    <div className="space-y-4">
      {/* URL Input */}
      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-gray-900 mb-4">Generate Deal from URL</h2>

        <div className="flex gap-2">
          <div className="flex-1 relative">
            <input
              type="url"
              value={url}
              onChange={(e) => { setUrl(e.target.value); setError(''); }}
              onKeyDown={(e) => e.key === 'Enter' && handleGenerate()}
              placeholder="https://www.amazon.in/dp/B0... or Flipkart/Myntra/Ajio link"
              className={`w-full rounded-lg border px-3.5 py-2.5 text-sm pr-10 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                error ? 'border-red-300 bg-red-50' : 'border-gray-300'
              }`}
            />
            {url && (
              <button onClick={() => setUrl('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
              </button>
            )}
          </div>
          <button
            onClick={handleGenerate}
            disabled={loading || !url.trim()}
            className="px-5 py-2.5 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 whitespace-nowrap transition-colors">
            {loading
              ? <><svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg> Scraping...</>
              : <><svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z"/></svg> Generate</>
            }
          </button>
        </div>

        {error && (
          <p className="mt-2 flex items-center gap-1.5 text-sm text-red-600">
            <svg className="h-4 w-4 shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd"/></svg>
            {error}
          </p>
        )}

        <div className="mt-3 flex gap-1.5 flex-wrap">
          {supportedDomains.map((d) => (
            <span key={d} className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">{d}</span>
          ))}
        </div>
      </div>

      {/* Loading skeleton */}
      {loading && (
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm animate-pulse">
          <div className="flex gap-4">
            <div className="w-24 h-24 bg-gray-200 rounded-lg" />
            <div className="flex-1 space-y-3">
              <div className="h-4 bg-gray-200 rounded w-3/4" />
              <div className="h-3 bg-gray-200 rounded w-1/2" />
              <div className="h-6 bg-gray-200 rounded w-1/3" />
            </div>
          </div>
          <p className="mt-4 text-xs text-center text-gray-400">Scraping product page — 10–30 seconds</p>
        </div>
      )}

      {/* Result */}
      {result && !loading && (
        <DealResult result={result} onPost={handlePost} />
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 bg-gray-900 text-white text-sm px-4 py-2.5 rounded-lg shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
}
