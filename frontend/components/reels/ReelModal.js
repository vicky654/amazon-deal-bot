'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { reelsApi, ApiError } from '../../lib/api';
import ReelPreview from './ReelPreview';

// ── Constants ─────────────────────────────────────────────────────────────────

const TEMPLATES = [
  {
    id: 'dark',
    label: 'Dark',
    desc: 'Purple / neon',
    preview: 'linear-gradient(135deg,#0d0221,#7b2fff)',
    accent: '#ff3cac',
  },
  {
    id: 'sale',
    label: 'Sale',
    desc: 'Red / gold',
    preview: 'linear-gradient(135deg,#6b0000,#cc0000)',
    accent: '#ffd700',
  },
  {
    id: 'minimal',
    label: 'Minimal',
    desc: 'Clean white',
    preview: 'linear-gradient(135deg,#f8f9fa,#e8ecf0)',
    accent: '#e53e3e',
  },
];

const IG_CAPTION_LIMIT = 2200;

const STEPS = [
  { icon: '⬇️', label: 'Download the video',            action: 'download'   },
  { icon: '📋', label: 'Copy caption + hashtags',        action: 'copy'       },
  { icon: '📱', label: 'Open Instagram → tap +',         action: 'instagram'  },
  { icon: '🎬', label: 'Select Reel → pick your video',  action: null         },
  { icon: '✏️', label: 'Paste caption → tap Share',      action: null         },
];

// ── Micro components ──────────────────────────────────────────────────────────

function Spinner({ size = 20, color = 'currentColor' }) {
  return (
    <svg
      width={size} height={size}
      viewBox="0 0 24 24" fill="none"
      style={{ animation: 'spin 0.8s linear infinite', display: 'inline-block' }}
    >
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      <circle cx="12" cy="12" r="9" stroke={color} strokeWidth="3" strokeOpacity="0.25" />
      <path d="M12 3a9 9 0 0 1 9 9" stroke={color} strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

function CheckIcon({ size = 14 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="currentColor">
      <path fillRule="evenodd"
        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
        clipRule="evenodd" />
    </svg>
  );
}

function CopyButton({ label, onCopy, copied, className = '' }) {
  return (
    <button
      onClick={onCopy}
      className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg transition-all duration-200 ${
        copied
          ? 'bg-emerald-500 text-white scale-95'
          : 'bg-gray-100 hover:bg-gray-200 text-gray-700 hover:scale-105'
      } ${className}`}
    >
      {copied ? (
        <><CheckIcon size={12} /> Copied!</>
      ) : (
        <>
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
          {label}
        </>
      )}
    </button>
  );
}

// ── Tab bar ───────────────────────────────────────────────────────────────────

function TabBar({ active, onChange }) {
  const tabs = [
    { id: 'video',   label: 'Video',   icon: '🎬' },
    { id: 'caption', label: 'Caption', icon: '✍️'  },
    { id: 'publish', label: 'Publish', icon: '📱'  },
  ];
  return (
    <div className="flex border-b border-gray-100 bg-white shrink-0">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onChange(tab.id)}
          className={`flex-1 flex items-center justify-center gap-1.5 py-3 text-xs font-semibold transition-all border-b-2 ${
            active === tab.id
              ? 'border-violet-500 text-violet-700 bg-violet-50/40'
              : 'border-transparent text-gray-400 hover:text-gray-600 hover:bg-gray-50'
          }`}
        >
          <span>{tab.icon}</span>{tab.label}
        </button>
      ))}
    </div>
  );
}

// ── Caption Panel ─────────────────────────────────────────────────────────────

function CaptionPanel({ caption, setCaption, hashtags, activeHashtags, toggleHashtag,
                        onCopyCaption, onCopyAll, captionCopied, allCopied }) {
  const charCount   = caption.length;
  const overLimit   = charCount > IG_CAPTION_LIMIT;
  const selectedTags = hashtags.filter((t) => activeHashtags.has(t));

  const selectAll  = () => hashtags.forEach((t) => { if (!activeHashtags.has(t)) toggleHashtag(t); });
  const clearAll   = () => hashtags.forEach((t) => { if (activeHashtags.has(t)) toggleHashtag(t); });

  return (
    <div className="space-y-4">

      {/* Caption textarea */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-gray-700">Instagram Caption</span>
          <div className="flex items-center gap-2">
            <span className={`text-[10px] font-mono tabular-nums ${overLimit ? 'text-red-500 font-bold' : 'text-gray-400'}`}>
              {charCount.toLocaleString()} / {IG_CAPTION_LIMIT.toLocaleString()}
            </span>
            <CopyButton label="Copy" onCopy={onCopyCaption} copied={captionCopied} />
          </div>
        </div>

        <div className="relative">
          <textarea
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            rows={7}
            spellCheck={false}
            className={`w-full text-xs text-gray-800 bg-gray-50 border rounded-xl px-3.5 py-3 resize-none
              focus:outline-none focus:ring-2 leading-relaxed font-mono transition-colors ${
              overLimit
                ? 'border-red-300 focus:ring-red-300 bg-red-50/30'
                : 'border-gray-200 focus:ring-violet-300'
            }`}
          />
          {overLimit && (
            <div className="mt-1 flex items-center gap-1 text-[10px] text-red-500">
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd"/>
              </svg>
              Over limit — trim {charCount - IG_CAPTION_LIMIT} characters
            </div>
          )}
        </div>
      </div>

      {/* Hashtag pills */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-gray-700">
            Hashtags
            <span className="ml-1.5 text-[10px] font-normal text-gray-400">
              {selectedTags.length}/{hashtags.length} selected
            </span>
          </span>
          <div className="flex items-center gap-2 text-[10px]">
            <button onClick={selectAll} className="text-violet-600 hover:text-violet-800 font-medium">
              Select all
            </button>
            <span className="text-gray-200">|</span>
            <button onClick={clearAll} className="text-gray-400 hover:text-gray-600">
              Clear
            </button>
          </div>
        </div>

        <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto pr-0.5 pb-1"
             style={{ scrollbarWidth: 'thin' }}>
          {hashtags.map((tag) => {
            const on = activeHashtags.has(tag);
            return (
              <button
                key={tag}
                onClick={() => toggleHashtag(tag)}
                className={`text-[11px] px-2.5 py-1 rounded-full border font-medium transition-all ${
                  on
                    ? 'bg-violet-100 border-violet-300 text-violet-700 shadow-sm'
                    : 'bg-gray-50 border-gray-200 text-gray-400 line-through opacity-60'
                }`}
              >
                {tag}
              </button>
            );
          })}
        </div>

        {selectedTags.length > 0 && (
          <p className="text-[10px] text-gray-400 leading-relaxed font-mono line-clamp-2 bg-gray-50 rounded-lg px-2.5 py-1.5 border border-gray-100">
            {selectedTags.join(' ')}
          </p>
        )}
      </div>

      {/* Copy all CTA */}
      <button
        onClick={onCopyAll}
        className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold transition-all duration-200 border-2 ${
          allCopied
            ? 'bg-emerald-500 border-emerald-500 text-white scale-[0.98]'
            : 'bg-white border-violet-400 text-violet-700 hover:bg-violet-50 hover:border-violet-500'
        }`}
      >
        {allCopied ? (
          <><CheckIcon size={16} /> Copied to clipboard!</>
        ) : (
          <>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
            Copy Caption + Hashtags
          </>
        )}
      </button>
    </div>
  );
}

// ── Posting Guide ─────────────────────────────────────────────────────────────

function PostingGuide({ onDownload, onCopyAll, allCopied }) {
  const [done, setDone] = useState([false, false, false, false, false]);
  const toggle = (i) => setDone((prev) => prev.map((v, idx) => (idx === i ? !v : v)));
  const allDone = done.every(Boolean);

  return (
    <div className="rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
      {/* Header */}
      <div className="px-4 py-3 bg-gradient-to-r from-violet-50 to-pink-50 border-b border-gray-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-base">📋</span>
          <span className="text-xs font-semibold text-gray-700">Publishing Steps</span>
        </div>
        {allDone ? (
          <span className="text-[10px] font-semibold text-emerald-600 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
            All done! ✓
          </span>
        ) : (
          <span className="text-[10px] text-gray-400">
            {done.filter(Boolean).length} / {STEPS.length}
          </span>
        )}
      </div>

      {/* Steps */}
      <div className="divide-y divide-gray-50">
        {STEPS.map((step, i) => (
          <button
            key={i}
            onClick={() => {
              toggle(i);
              if (step.action === 'download') onDownload();
              if (step.action === 'copy')     onCopyAll();
              if (step.action === 'instagram') window.open('https://www.instagram.com/create/reels/', '_blank', 'noopener,noreferrer');
            }}
            className={`w-full flex items-center gap-3 px-4 py-3.5 text-left transition-all ${
              done[i] ? 'bg-emerald-50/60' : 'bg-white hover:bg-gray-50/80'
            }`}
          >
            {/* Step circle */}
            <div className={`h-7 w-7 rounded-full flex items-center justify-center shrink-0 text-[11px] font-bold transition-all duration-300 ${
              done[i]
                ? 'bg-emerald-500 text-white shadow-sm shadow-emerald-200'
                : 'bg-white border-2 border-gray-200 text-gray-400'
            }`}>
              {done[i] ? <CheckIcon size={13} /> : i + 1}
            </div>

            {/* Icon */}
            <span className="text-base shrink-0">{step.icon}</span>

            {/* Label */}
            <span className={`text-xs flex-1 ${done[i] ? 'text-emerald-700 line-through decoration-emerald-300' : 'text-gray-700'}`}>
              {step.label}
            </span>

            {/* Chevron */}
            {!done[i] && step.action && (
              <svg className="h-3.5 w-3.5 text-gray-300 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/>
              </svg>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Generating Animation ──────────────────────────────────────────────────────

function GeneratingState() {
  const STAGE_LABELS = [
    'Downloading product image…',
    'Compositing intro scene…',
    'Rendering product card…',
    'Building CTA scene…',
    'Encoding H.264 MP4…',
    'Generating caption…',
    'Almost ready…',
  ];
  const [stageIdx, setStageIdx] = useState(0);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const TOTAL = 28000; // ms estimate
    const tick  = 220;
    let elapsed = 0;
    const iv = setInterval(() => {
      elapsed += tick;
      const pct = Math.min((elapsed / TOTAL) * 100, 91);
      setProgress(pct);
      setStageIdx(Math.min(Math.floor(pct / (100 / STAGE_LABELS.length)), STAGE_LABELS.length - 1));
    }, tick);
    return () => clearInterval(iv);
  }, []);

  return (
    <div className="py-8 flex flex-col items-center gap-5">
      {/* Animated icon */}
      <div className="relative">
        <div
          className="h-24 w-24 rounded-full flex items-center justify-center"
          style={{ background: 'linear-gradient(135deg,#ede9fe,#fce7f3)' }}
        >
          <Spinner size={42} color="#7c3aed" />
        </div>
        <span className="absolute -bottom-1 -right-1 text-2xl select-none">🎬</span>
      </div>

      {/* Status text */}
      <div className="text-center space-y-1.5 max-w-xs">
        <p className="text-sm font-semibold text-gray-800">Generating reel…</p>
        <p className="text-xs text-violet-600 font-medium min-h-[18px] transition-all">
          {STAGE_LABELS[stageIdx]}
        </p>
        <p className="text-[11px] text-gray-400">Takes 15–35 seconds</p>
      </div>

      {/* Progress bar */}
      <div className="w-full max-w-xs space-y-1.5">
        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-300"
            style={{
              width: `${progress}%`,
              background: 'linear-gradient(90deg,#7c3aed,#ec4899)',
            }}
          />
        </div>
        <p className="text-[10px] text-gray-400 text-right tabular-nums">{Math.round(progress)}%</p>
      </div>
    </div>
  );
}

// ── Toast ─────────────────────────────────────────────────────────────────────

function Toast({ toast, onDismiss }) {
  if (!toast) return null;
  const styles = {
    success: 'bg-emerald-50 border-emerald-200 text-emerald-800',
    error:   'bg-red-50 border-red-200 text-red-800',
    info:    'bg-blue-50 border-blue-200 text-blue-800',
  };
  return (
    <div
      className={`mx-4 mb-3 shrink-0 flex items-center gap-2.5 text-xs px-3.5 py-2.5 rounded-xl border shadow-sm ${styles[toast.type] || styles.info}`}
      style={{ animation: 'slideUp 0.25s ease' }}
    >
      <style>{`@keyframes slideUp{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}`}</style>
      <span className="flex-1 font-medium">{toast.msg}</span>
      <button onClick={onDismiss} className="opacity-40 hover:opacity-70 transition-opacity">
        <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd"
            d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
            clipRule="evenodd" />
        </svg>
      </button>
    </div>
  );
}

// ── Main Modal ────────────────────────────────────────────────────────────────

export default function ReelModal({ deal, onClose }) {
  const [template,      setTemplate]      = useState('dark');
  const [status,        setStatus]        = useState('idle');       // idle|generating|done|error
  const [videoUrl,      setVideoUrl]      = useState(null);
  const [cached,        setCached]        = useState(false);
  const [error,         setError]         = useState('');
  const [toast,         setToast]         = useState(null);
  const [activeTab,     setActiveTab]     = useState('video');

  const [caption,       setCaption]       = useState('');
  const [hashtags,      setHashtags]      = useState([]);
  const [activeHashtags,setActiveHashtags]= useState(new Set());

  const [captionCopied, setCaptionCopied] = useState(false);
  const [allCopied,     setAllCopied]     = useState(false);

  const toastTimer = useRef(null);

  const BASE         = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000').replace(/\/$/, '');
  const fullVideoUrl = videoUrl ? `${BASE}${videoUrl}` : null;

  // Escape key + scroll lock
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  const showToast = useCallback((type, msg, duration = 3200) => {
    setToast({ type, msg });
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), duration);
  }, []);

  // ── Generate ────────────────────────────────────────────────────────────────

  const handleGenerate = useCallback(async () => {
    setStatus('generating');
    setError('');
    setVideoUrl(null);
    setActiveTab('video');
    try {
      const result = await reelsApi.generate(deal._id, template);
      setVideoUrl(result.videoUrl);
      setCached(result.cached ?? false);
      if (result.caption)          setCaption(result.caption);
      if (result.hashtags?.length) {
        setHashtags(result.hashtags);
        setActiveHashtags(new Set(result.hashtags));
      }
      setStatus('done');
      showToast(result.cached ? 'info' : 'success',
        result.cached ? 'Loaded from cache — ready to use!' : 'Reel generated successfully!');
    } catch (err) {
      setStatus('error');
      setError(err instanceof ApiError ? err.message : err?.message || 'Generation failed');
      showToast('error', 'Generation failed — see details below');
    }
  }, [deal._id, template, showToast]);

  // ── Download (fetch → blob → anchor — works cross-origin, no page nav) ─────

  const [downloading, setDownloading] = useState(false);

  const handleDownload = useCallback(async () => {
    if (!fullVideoUrl || downloading) return;
    setDownloading(true);
    try {
      const res = await fetch(fullVideoUrl);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob    = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a       = document.createElement('a');
      a.href        = blobUrl;
      a.download    = `reel_${deal._id}_${template}.mp4`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(blobUrl), 30_000);
      showToast('success', 'Download started!');
    } catch {
      showToast('error', 'Download failed — right-click the video → Save video as');
    } finally {
      setDownloading(false);
    }
  }, [fullVideoUrl, deal._id, template, showToast, downloading]);

  // ── Copy helpers ─────────────────────────────────────────────────────────────

  const copyText = useCallback((text, setter) => {
    navigator.clipboard.writeText(text)
      .then(() => { setter(true); setTimeout(() => setter(false), 2200); })
      .catch(() => showToast('error', 'Clipboard unavailable'));
  }, [showToast]);

  const handleCopyCaption = useCallback(() => {
    copyText(caption, setCaptionCopied);
  }, [caption, copyText]);

  const handleCopyAll = useCallback(() => {
    const selected = hashtags.filter((t) => activeHashtags.has(t));
    const text     = selected.length
      ? `${caption}\n\n${selected.join(' ')}`
      : caption;
    copyText(text, setAllCopied);
    showToast('success', 'Caption + hashtags copied!');
    reelsApi.recordCopied(deal._id, template).catch(() => {});
  }, [caption, hashtags, activeHashtags, deal._id, template, copyText, showToast]);

  const toggleHashtag = useCallback((tag) => {
    setActiveHashtags((prev) => {
      const next = new Set(prev);
      next.has(tag) ? next.delete(tag) : next.add(tag);
      return next;
    });
  }, []);

  const handleReset = useCallback(() => {
    setStatus('idle');
    setVideoUrl(null);
    setError('');
    setCaption('');
    setHashtags([]);
    setActiveHashtags(new Set());
    setAllCopied(false);
    setCaptionCopied(false);
    setCached(false);
  }, []);

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-3 sm:p-6"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl flex flex-col max-h-[93vh] overflow-hidden"
           style={{ boxShadow: '0 25px 80px rgba(0,0,0,0.35), 0 0 0 1px rgba(0,0,0,0.06)' }}>

        {/* ── Header ── */}
        <div className="px-5 py-4 border-b border-gray-100 flex items-start justify-between gap-3 shrink-0 bg-white">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className="h-9 w-9 rounded-xl flex items-center justify-center text-lg shrink-0"
              style={{ background: 'linear-gradient(135deg,#7c3aed,#ec4899)' }}
            >
              🎬
            </div>
            <div className="min-w-0">
              <h2 className="text-sm font-bold text-gray-900">Instagram Reel Assistant</h2>
              <p className="text-[11px] text-gray-400 truncate mt-0.5">{deal.title}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="shrink-0 h-8 w-8 flex items-center justify-center rounded-full text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-all"
          >
            <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd"
                d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                clipRule="evenodd" />
            </svg>
          </button>
        </div>

        {/* ── Tabs (after generation) ── */}
        {status === 'done' && <TabBar active={activeTab} onChange={setActiveTab} />}

        {/* ── Body ── */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4" style={{ scrollbarWidth: 'thin' }}>

          {/* ══ IDLE ══ */}
          {status === 'idle' && (
            <>
              {/* Deal preview card */}
              <div className="flex items-center gap-3 p-3.5 bg-gray-50 rounded-xl border border-gray-100">
                {deal.image && (
                  <img
                    src={deal.image} alt=""
                    className="h-16 w-16 rounded-xl object-contain bg-white border border-gray-100 shrink-0"
                  />
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-gray-800 line-clamp-2">{deal.title}</p>
                  <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                    {deal.price && (
                      <span className="text-sm font-bold text-emerald-600">
                        ₹{Number(deal.price).toLocaleString('en-IN')}
                      </span>
                    )}
                    {deal.originalPrice && (
                      <span className="text-xs text-gray-400 line-through">
                        ₹{Number(deal.originalPrice).toLocaleString('en-IN')}
                      </span>
                    )}
                    {deal.discount && (
                      <span className="text-[11px] bg-red-100 text-red-700 font-bold px-2 py-0.5 rounded-full">
                        {deal.discount}% OFF
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Template picker */}
              <div>
                <p className="text-xs font-semibold text-gray-700 mb-2.5">Choose Template</p>
                <div className="grid grid-cols-3 gap-2.5">
                  {TEMPLATES.map((tpl) => (
                    <button
                      key={tpl.id}
                      onClick={() => setTemplate(tpl.id)}
                      className={`group flex flex-col items-center gap-2 p-3.5 rounded-xl border-2 transition-all text-center ${
                        template === tpl.id
                          ? 'border-violet-500 shadow-sm shadow-violet-100'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      {/* Mini preview swatch */}
                      <div
                        className="h-10 w-full rounded-lg border border-black/10"
                        style={{ background: tpl.preview }}
                      >
                        {template === tpl.id && (
                          <div className="h-full w-full flex items-center justify-center">
                            <div className="h-5 w-5 rounded-full bg-white/90 flex items-center justify-center">
                              <CheckIcon size={10} />
                            </div>
                          </div>
                        )}
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-gray-800">{tpl.label}</p>
                        <p className="text-[10px] text-gray-400 mt-0.5">{tpl.desc}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Info note */}
              <div className="flex items-start gap-2.5 text-xs text-blue-700 bg-blue-50 border border-blue-100 rounded-xl p-3">
                <svg className="h-4 w-4 shrink-0 mt-0.5 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd"
                    d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                    clipRule="evenodd" />
                </svg>
                <span>
                  Generates <strong>1080×1920 MP4</strong> + ready-to-paste Instagram caption + hashtags.
                  Download & post manually — no Instagram automation.
                </span>
              </div>

              {/* Generate button */}
              <button
                onClick={handleGenerate}
                className="w-full flex items-center justify-center gap-2.5 px-4 py-3.5 rounded-xl text-sm font-bold text-white transition-all active:scale-[0.98]"
                style={{ background: 'linear-gradient(135deg,#7c3aed,#ec4899)', boxShadow: '0 4px 20px rgba(124,58,237,0.30)' }}
              >
                <svg className="h-4.5 w-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M15 10l4.553-2.069A1 1 0 0121 8.87v6.26a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                Generate Reel + Caption
              </button>
            </>
          )}

          {/* ══ GENERATING ══ */}
          {status === 'generating' && <GeneratingState />}

          {/* ══ DONE ══ */}
          {status === 'done' && fullVideoUrl && (
            <>
              {/* ─ VIDEO TAB ─ */}
              {activeTab === 'video' && (
                <div className="space-y-4">
                  {/* Status banner */}
                  <div className="flex items-center gap-2 px-3.5 py-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 font-medium">
                    <div className="h-5 w-5 rounded-full bg-emerald-500 flex items-center justify-center shrink-0">
                      <CheckIcon size={11} />
                    </div>
                    {cached ? 'Loaded from cache — ready to use' : 'Reel generated successfully!'}
                    <span className="ml-auto text-[10px] text-emerald-600 opacity-70">
                      {template} template
                    </span>
                  </div>

                  {/* Video preview */}
                  <ReelPreview videoUrl={fullVideoUrl} />

                  {/* Action buttons */}
                  <div className="grid grid-cols-2 gap-2.5">
                    <button
                      onClick={handleDownload}
                      disabled={downloading}
                      className="flex items-center justify-center gap-2 px-3 py-3 bg-gray-900 hover:bg-black disabled:bg-gray-400 text-white text-xs font-bold rounded-xl transition-all active:scale-[0.97]"
                    >
                      {downloading
                        ? <><Spinner size={14} color="white" /> Downloading…</>
                        : <><svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                              d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                          </svg> Download MP4</>
                      }
                    </button>

                    <a
                      href="https://www.instagram.com/create/reels/"
                      target="_blank" rel="noopener noreferrer"
                      className="flex items-center justify-center gap-2 px-3 py-3 text-white text-xs font-bold rounded-xl hover:opacity-90 transition-all active:scale-[0.97]"
                      style={{ background: 'linear-gradient(135deg,#833ab4,#fd1d1d,#fcb045)' }}
                    >
                      <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                      </svg>
                      Open Instagram
                    </a>
                  </div>

                  {/* Quick copy row */}
                  <div className="flex gap-2">
                    <CopyButton label="Copy Caption" onCopy={handleCopyCaption} copied={captionCopied} className="flex-1 justify-center py-2" />
                    <CopyButton label="Caption + Tags" onCopy={handleCopyAll} copied={allCopied} className="flex-1 justify-center py-2" />
                  </div>

                  {/* Template / regenerate row */}
                  <div className="flex gap-2">
                    <button
                      onClick={handleReset}
                      className="flex-1 text-xs text-gray-500 border border-gray-200 rounded-xl py-2 hover:bg-gray-50 transition-colors"
                    >
                      Change template
                    </button>
                    <button
                      onClick={handleGenerate}
                      className="flex-1 text-xs text-violet-600 border border-violet-200 rounded-xl py-2 hover:bg-violet-50 transition-colors"
                    >
                      Regenerate
                    </button>
                  </div>
                </div>
              )}

              {/* ─ CAPTION TAB ─ */}
              {activeTab === 'caption' && (
                <CaptionPanel
                  caption={caption}
                  setCaption={setCaption}
                  hashtags={hashtags}
                  activeHashtags={activeHashtags}
                  toggleHashtag={toggleHashtag}
                  onCopyCaption={handleCopyCaption}
                  onCopyAll={handleCopyAll}
                  captionCopied={captionCopied}
                  allCopied={allCopied}
                />
              )}

              {/* ─ PUBLISH TAB ─ */}
              {activeTab === 'publish' && (
                <div className="space-y-4">
                  <PostingGuide
                    onDownload={handleDownload}
                    onCopyAll={handleCopyAll}
                    allCopied={allCopied}
                  />

                  {/* Quick actions */}
                  <div className="grid grid-cols-2 gap-2.5">
                    <button
                      onClick={handleDownload}
                      disabled={downloading}
                      className="flex items-center justify-center gap-2 py-3 bg-gray-900 hover:bg-black disabled:bg-gray-400 text-white text-xs font-bold rounded-xl transition-all"
                    >
                      {downloading
                        ? <><Spinner size={13} color="white" /> Fetching…</>
                        : <><svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                              d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                          </svg> Download</>
                      }
                    </button>
                    <button
                      onClick={handleCopyAll}
                      className={`flex items-center justify-center gap-2 py-3 text-xs font-bold rounded-xl transition-all border-2 ${
                        allCopied
                          ? 'bg-emerald-500 border-emerald-500 text-white'
                          : 'border-violet-400 text-violet-700 hover:bg-violet-50'
                      }`}
                    >
                      {allCopied
                        ? <><CheckIcon size={13} /> Copied!</>
                        : <><svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg> Copy Caption</>
                      }
                    </button>
                  </div>

                  <a
                    href="https://www.instagram.com/create/reels/"
                    target="_blank" rel="noopener noreferrer"
                    className="w-full flex items-center justify-center gap-2.5 py-3.5 text-white text-sm font-bold rounded-xl hover:opacity-90 transition-all"
                    style={{ background: 'linear-gradient(135deg,#833ab4,#fd1d1d,#fcb045)', boxShadow: '0 4px 16px rgba(131,58,180,0.25)' }}
                  >
                    <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                    </svg>
                    Open Instagram Reels
                  </a>
                </div>
              )}
            </>
          )}

          {/* ══ ERROR ══ */}
          {status === 'error' && (
            <div className="space-y-4">
              <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-xl">
                <div className="h-8 w-8 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                  <svg className="h-4 w-4 text-red-500" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd"
                      d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                      clipRule="evenodd" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-semibold text-red-800">Generation failed</p>
                  <p className="text-xs text-red-600 mt-1.5 font-mono bg-red-100/60 rounded-lg px-2.5 py-2 leading-relaxed">
                    {error}
                  </p>
                </div>
              </div>
              <button
                onClick={handleReset}
                className="w-full text-sm font-semibold text-gray-700 border border-gray-200 rounded-xl py-2.5 hover:bg-gray-50 transition-colors"
              >
                Try again
              </button>
            </div>
          )}
        </div>

        {/* ── Toast ── */}
        <Toast toast={toast} onDismiss={() => setToast(null)} />
      </div>
    </div>
  );
}
