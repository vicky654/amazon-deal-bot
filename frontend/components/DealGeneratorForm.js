'use client';

import { useState } from 'react';

/**
 * Props:
 *   onGenerate: (url: string) => Promise<void>
 *   loading: boolean
 */
export default function DealGeneratorForm({ onGenerate, loading }) {
  const [url, setUrl] = useState('');
  const [validationError, setValidationError] = useState('');

  function validateUrl(value) {
    if (!value.trim()) return 'Please paste an Amazon product URL';
    if (!value.includes('amazon')) return 'URL must be from amazon.in or amazon.com';
    if (!value.includes('/dp/') && !value.includes('/gp/product/')) {
      return 'Looks like a search page — paste a specific product URL';
    }
    return '';
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const err = validateUrl(url);
    if (err) { setValidationError(err); return; }
    setValidationError('');
    await onGenerate(url.trim());
  }

  async function handlePaste() {
    try {
      const text = await navigator.clipboard.readText();
      setUrl(text);
      setValidationError('');
    } catch {
      // Clipboard API not available — silently ignore
    }
  }

  function handleChange(e) {
    setUrl(e.target.value);
    if (validationError) setValidationError('');
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
      {/* Header */}
      <div className="flex items-start gap-3 mb-5">
        <div className="w-10 h-10 rounded-xl bg-orange-50 border border-orange-100 flex items-center justify-center text-lg shrink-0">
          🛒
        </div>
        <div>
          <h2 className="text-base font-semibold text-slate-900">Generate Deal</h2>
          <p className="text-sm text-slate-500 mt-0.5">
            Paste any Amazon product URL — we'll scrape the price and build your deal.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} noValidate>
        {/* URL input row */}
        <div className="flex gap-2 mb-3">
          <div className="relative flex-1">
            {/* Amazon logo icon inside input */}
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
              </svg>
            </div>
            <input
              type="url"
              value={url}
              onChange={handleChange}
              placeholder="https://www.amazon.in/dp/..."
              disabled={loading}
              className={`w-full pl-9 pr-4 py-3 text-sm rounded-xl border bg-slate-50 text-slate-900 placeholder-slate-400
                focus:outline-none focus:ring-2 focus:bg-white transition-all
                ${validationError
                  ? 'border-red-300 focus:ring-red-200'
                  : 'border-slate-200 focus:ring-orange-200 focus:border-orange-400'}
                disabled:opacity-50 disabled:cursor-not-allowed`}
            />
          </div>

          {/* Paste button */}
          <button
            type="button"
            onClick={handlePaste}
            disabled={loading}
            title="Paste from clipboard"
            className="px-3 py-3 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100
              text-slate-500 hover:text-slate-700 transition-colors disabled:opacity-50 shrink-0"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          </button>
        </div>

        {/* Validation error */}
        {validationError && (
          <p className="text-xs text-red-500 mb-3 flex items-center gap-1.5">
            <svg className="w-3.5 h-3.5 shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            {validationError}
          </p>
        )}

        {/* Generate button */}
        <button
          type="submit"
          disabled={loading || !url.trim()}
          className={`w-full py-3 px-6 rounded-xl text-sm font-semibold text-white
            transition-all duration-200 flex items-center justify-center gap-2
            ${loading || !url.trim()
              ? 'bg-slate-300 cursor-not-allowed'
              : 'bg-orange-500 hover:bg-orange-600 shadow-md shadow-orange-500/30 hover:shadow-orange-500/40 active:scale-[0.99]'}`}
        >
          {loading ? (
            <>
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Scraping product...
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              Generate Deal
            </>
          )}
        </button>
      </form>

      {/* Hint */}
      <p className="text-xs text-slate-400 mt-3 text-center">
        Works with amazon.in product pages · ASIN extracted automatically
      </p>
    </div>
  );
}
