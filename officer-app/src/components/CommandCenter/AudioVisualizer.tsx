'use client';

import React from 'react';

/**
 * AudioVisualizer — CSS-only animated bars.
 * Replaces 12 individual framer-motion animations with pure CSS
 * for dramatically lower CPU overhead.
 */
export const AudioVisualizer = React.memo(({ active }: { active: boolean }) => {
  return (
    <>
      <style jsx>{`
        .viz-bar {
          width: 6px;
          border-radius: 9999px;
          transition: height 0.3s ease, background-color 0.3s ease;
        }
        .viz-bar.idle {
          height: 10px;
          background-color: #1f2937;
        }
        .viz-bar.active {
          background-color: #ef4444;
          animation: vizPulse 0.6s ease-in-out infinite alternate;
        }
        .viz-bar.active:nth-child(1) { animation-delay: 0s; }
        .viz-bar.active:nth-child(2) { animation-delay: 0.05s; }
        .viz-bar.active:nth-child(3) { animation-delay: 0.1s; }
        .viz-bar.active:nth-child(4) { animation-delay: 0.15s; }
        .viz-bar.active:nth-child(5) { animation-delay: 0.2s; }
        .viz-bar.active:nth-child(6) { animation-delay: 0.25s; }
        .viz-bar.active:nth-child(7) { animation-delay: 0.3s; }
        .viz-bar.active:nth-child(8) { animation-delay: 0.35s; }
        .viz-bar.active:nth-child(9) { animation-delay: 0.4s; }
        .viz-bar.active:nth-child(10) { animation-delay: 0.45s; }
        .viz-bar.active:nth-child(11) { animation-delay: 0.5s; }
        .viz-bar.active:nth-child(12) { animation-delay: 0.55s; }
        @keyframes vizPulse {
          0% { height: 10px; }
          100% { height: var(--bar-height); }
        }
      `}</style>
      <div className="flex items-end justify-center space-x-1 h-12 w-full px-4 py-2 bg-red-500/5 rounded-xl border border-red-500/10">
        {[35, 25, 15, 35, 20, 30, 15, 35, 25, 15, 30, 20].map((h, i) => (
          <div
            key={i}
            className={`viz-bar ${active ? 'active' : 'idle'}`}
            style={{ '--bar-height': `${h}px` } as React.CSSProperties}
          />
        ))}
      </div>
    </>
  );
});

AudioVisualizer.displayName = 'AudioVisualizer';
