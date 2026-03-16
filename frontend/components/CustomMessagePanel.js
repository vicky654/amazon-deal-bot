'use client';

import { useState } from 'react';

/**
 * Props:
 *   onSend: (message: string) => Promise<void>
 *   loading: boolean
 */
export default function CustomMessagePanel({ onSend, loading }) {
  const [message, setMessage] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    if (!message.trim()) return;
    await onSend(message.trim());
    setMessage('');
  }

  const charCount = message.length;
  const isNearLimit = charCount > 3500;

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
      {/* Header */}
      <div className="flex items-start gap-3 mb-5">
        <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-lg shrink-0">
          💬
        </div>
        <div>
          <h2 className="text-base font-semibold text-slate-900">Send Custom Message</h2>
          <p className="text-sm text-slate-500 mt-0.5">
            Send any message directly to your Telegram channel.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        {/* Telegram preview mock */}
        <div className="bg-[#17212b] rounded-xl p-4 mb-4">
          <div className="flex items-center gap-2 mb-3 pb-2 border-b border-white/10">
            <div className="w-7 h-7 rounded-full bg-blue-500 flex items-center justify-center text-white text-xs font-bold">
              D
            </div>
            <div>
              <p className="text-white text-xs font-semibold">Daily Amazon Deals</p>
              <p className="text-white/40 text-[10px]">Channel</p>
            </div>
          </div>

          {message.trim() ? (
            <pre className="text-[11px] text-[#b0bec5] whitespace-pre-wrap font-sans leading-relaxed break-all min-h-[40px]">
              {message}
            </pre>
          ) : (
            <p className="text-[11px] text-white/20 italic">Your message will appear here...</p>
          )}
        </div>

        {/* Textarea */}
        <div className="relative mb-4">
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Write your Telegram message here..."
            rows={5}
            disabled={loading}
            className={`w-full px-4 py-3 text-sm rounded-xl border bg-slate-50 text-slate-900
              placeholder-slate-400 resize-none focus:outline-none focus:ring-2 focus:bg-white
              transition-all disabled:opacity-50 disabled:cursor-not-allowed
              ${isNearLimit
                ? 'border-orange-300 focus:ring-orange-200'
                : 'border-slate-200 focus:ring-blue-200 focus:border-blue-400'}`}
          />
          <span
            className={`absolute bottom-3 right-3 text-xs ${isNearLimit ? 'text-orange-500 font-semibold' : 'text-slate-400'}`}
          >
            {charCount} / 4096
          </span>
        </div>

        {/* Send button */}
        <button
          type="submit"
          disabled={loading || !message.trim()}
          className={`w-full py-3 px-6 rounded-xl text-sm font-semibold text-white
            flex items-center justify-center gap-2 transition-all duration-200
            ${loading || !message.trim()
              ? 'bg-slate-300 cursor-not-allowed'
              : 'bg-blue-500 hover:bg-blue-600 shadow-md shadow-blue-500/30 hover:shadow-blue-500/40 active:scale-[0.99]'}`}
        >
          {loading ? (
            <>
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Sending...
            </>
          ) : (
            <>
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
              </svg>
              Send to Telegram
            </>
          )}
        </button>
      </form>

      {/* Tips */}
      <div className="mt-4 p-3 bg-blue-50 rounded-xl border border-blue-100">
        <p className="text-xs font-semibold text-blue-700 mb-1">Tips</p>
        <ul className="text-xs text-blue-600 space-y-0.5">
          <li>• Supports Telegram HTML markup (&#60;b&#62;, &#60;i&#62;, &#60;a&#62;)</li>
          <li>• Maximum 4096 characters per message</li>
          <li>• Message is sent as plain text (no parse_mode)</li>
        </ul>
      </div>
    </div>
  );
}
