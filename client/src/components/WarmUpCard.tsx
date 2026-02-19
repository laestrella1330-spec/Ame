/**
 * WarmUpCard — Phase 1
 *
 * Displayed as a small overlay after a match is made.
 * Auto-dismisses after 10 seconds. User can also swipe/click away.
 */
import { useEffect, useState } from 'react';
import type { WarmUpData } from '../hooks/useWarmUp';

interface WarmUpCardProps {
  warmUp: WarmUpData;
  onDismiss: () => void;
}

export default function WarmUpCard({ warmUp, onDismiss }: WarmUpCardProps) {
  const [progress, setProgress] = useState(100);
  const AUTO_DISMISS_MS = 10000;

  useEffect(() => {
    const start = Date.now();
    const interval = setInterval(() => {
      const elapsed = Date.now() - start;
      const pct = Math.max(0, 100 - (elapsed / AUTO_DISMISS_MS) * 100);
      setProgress(pct);
      if (pct <= 0) { clearInterval(interval); onDismiss(); }
    }, 100);
    return () => clearInterval(interval);
  }, [onDismiss]);

  return (
    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-30 w-full max-w-sm px-4 pointer-events-none">
      <div className="glass rounded-2xl p-4 shadow-lg glow-purple pointer-events-auto animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-violet-400 font-semibold uppercase tracking-wider">
            ✨ Icebreaker · {warmUp.topic}
          </span>
          <button
            onClick={onDismiss}
            className="text-slate-500 hover:text-white transition-colors text-sm leading-none"
            aria-label="Dismiss"
          >
            ✕
          </button>
        </div>

        {/* Icebreaker text */}
        <p className="text-white text-sm leading-relaxed">{warmUp.icebreaker}</p>

        {/* Auto-dismiss progress bar */}
        <div className="mt-3 h-0.5 bg-white/10 rounded-full overflow-hidden">
          <div
            className="h-full bg-violet-500 transition-none"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    </div>
  );
}
