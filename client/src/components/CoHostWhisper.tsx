/**
 * CoHostWhisper — Phase 3
 *
 * A soft, dismissible whisper from the AI co-host.
 * Appears when silence is detected (>7s). Never speaks aloud.
 * The user's partner never sees this.
 */
interface CoHostWhisperProps {
  prompt: string;
  onDismiss: () => void;
}

export default function CoHostWhisper({ prompt, onDismiss }: CoHostWhisperProps) {
  return (
    <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 w-full max-w-xs px-4 pointer-events-none">
      <div className="bg-slate-900/90 border border-white/10 rounded-xl p-3 shadow-lg pointer-events-auto backdrop-blur-sm animate-fade-in">
        <div className="flex items-start gap-2">
          <span className="text-lg flex-shrink-0">💬</span>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-violet-400 font-medium mb-0.5">Suggestion (only you see this)</p>
            <p className="text-sm text-slate-200 leading-snug">{prompt}</p>
          </div>
          <button
            onClick={onDismiss}
            className="flex-shrink-0 text-slate-500 hover:text-white transition-colors text-sm leading-none mt-0.5"
            aria-label="Dismiss"
          >
            ✕
          </button>
        </div>
      </div>
    </div>
  );
}
