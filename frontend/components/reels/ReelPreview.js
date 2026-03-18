'use client';

/**
 * ReelPreview — premium phone-frame video player for Instagram Reels.
 * Aspect ratio: 9:16 (1080×1920) | Frame: 240×427px
 */
export default function ReelPreview({ videoUrl }) {
  if (!videoUrl) return null;

  return (
    <div className="flex flex-col items-center gap-3">
      {/* Phone frame */}
      <div
        className="relative overflow-hidden shadow-2xl"
        style={{
          width: 240,
          height: 427,
          background: '#111',
          borderRadius: 28,
          border: '5px solid #222',
          boxShadow: '0 0 0 1px #444, 0 30px 60px rgba(0,0,0,0.6), inset 0 0 0 1px rgba(255,255,255,0.05)',
        }}
      >
        {/* Status bar notch */}
        <div
          className="absolute top-0 left-1/2 -translate-x-1/2 z-20 bg-[#111]"
          style={{ width: 72, height: 18, borderRadius: '0 0 12px 12px' }}
        />

        {/* Side button indicators */}
        <div className="absolute left-0 top-16 w-1 h-8 bg-[#333] rounded-r-full" />
        <div className="absolute left-0 top-28 w-1 h-12 bg-[#333] rounded-r-full" />
        <div className="absolute right-0 top-20 w-1 h-14 bg-[#333] rounded-l-full" />

        {/* Video */}
        <video
          src={videoUrl}
          controls
          playsInline
          autoPlay
          muted
          loop
          className="w-full h-full object-cover"
          style={{ display: 'block' }}
        />

        {/* Instagram Reels badge overlay */}
        <div className="absolute top-5 right-2 z-10">
          <span
            className="text-white font-bold"
            style={{
              fontSize: 9,
              background: 'rgba(0,0,0,0.55)',
              backdropFilter: 'blur(4px)',
              padding: '3px 7px',
              borderRadius: 99,
              letterSpacing: '0.08em',
            }}
          >
            REEL
          </span>
        </div>

        {/* Screen edge glare */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: 'linear-gradient(135deg, rgba(255,255,255,0.04) 0%, transparent 50%)',
            borderRadius: 23,
          }}
        />
      </div>

      {/* Meta info */}
      <div className="flex items-center gap-2 text-[11px] text-gray-400">
        <span className="px-2 py-0.5 bg-gray-100 rounded-full font-mono">1080×1920</span>
        <span className="text-gray-300">·</span>
        <span className="px-2 py-0.5 bg-gray-100 rounded-full font-mono">9:16</span>
        <span className="text-gray-300">·</span>
        <span className="px-2 py-0.5 bg-gray-100 rounded-full font-mono">H.264</span>
      </div>
    </div>
  );
}
