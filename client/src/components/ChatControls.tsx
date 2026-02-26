import type { ConnectionState } from '../hooks/useWebRTC';

interface ChatControlsProps {
  connectionState: ConnectionState;
  isMuted: boolean;
  isCameraOff: boolean;
  onToggleMute: () => void;
  onToggleCamera: () => void;
  onSkip: () => void;
  onEndChat: () => void;
  onReport: () => void;
  onJoinQueue: () => void;
}

const circleBtn = 'w-13 h-13 flex items-center justify-center rounded-full transition-all active:scale-90 select-none';

export default function ChatControls({
  connectionState,
  isMuted,
  isCameraOff,
  onToggleMute,
  onToggleCamera,
  onSkip,
  onEndChat,
  onReport,
  onJoinQueue,
}: ChatControlsProps) {
  const isIdle = connectionState === 'idle' || connectionState === 'disconnected';
  const isInChat = connectionState === 'connected' || connectionState === 'connecting';
  const isSearching = connectionState === 'searching';

  return (
    <div className="flex items-center justify-between px-1">

      {/* ── Left: mic · cam ── */}
      <div className="flex items-center gap-3">

        {/* Mic toggle */}
        <button
          onClick={onToggleMute}
          className={`${circleBtn} ${
            isMuted
              ? 'bg-red-500 shadow-lg shadow-red-500/40'
              : 'bg-white/15 border border-white/20 backdrop-blur-sm'
          }`}
          style={{ width: 52, height: 52 }}
        >
          {isMuted ? (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="1" y1="1" x2="23" y2="23" />
              <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6" />
              <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23" />
              <line x1="12" y1="19" x2="12" y2="23" />
              <line x1="8" y1="23" x2="16" y2="23" />
            </svg>
          ) : (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
              <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
              <line x1="12" y1="19" x2="12" y2="23" />
              <line x1="8" y1="23" x2="16" y2="23" />
            </svg>
          )}
        </button>

        {/* Camera toggle */}
        <button
          onClick={onToggleCamera}
          className={`${circleBtn} ${
            isCameraOff
              ? 'bg-red-500 shadow-lg shadow-red-500/40'
              : 'bg-white/15 border border-white/20 backdrop-blur-sm'
          }`}
          style={{ width: 52, height: 52 }}
        >
          {isCameraOff ? (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="1" y1="1" x2="23" y2="23" />
              <path d="M21 21H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h3m3-3h6l2 3h4a2 2 0 0 1 2 2v9.34" />
              <circle cx="12" cy="13" r="3" />
            </svg>
          ) : (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M23 7l-7 5 7 5V7z" />
              <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
            </svg>
          )}
        </button>

        {/* End call (only when in chat) */}
        {isInChat && (
          <button
            onClick={onEndChat}
            className={`${circleBtn} bg-red-500 shadow-lg shadow-red-500/40`}
            style={{ width: 52, height: 52 }}
            title="End call"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10.68 13.31a16 16 0 0 0 3.41 2.6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7 2 2 0 0 1 1.72 2v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.42 19.42 0 0 1 4.43 13a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.34 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L7.32 9.9a16 16 0 0 0 3.36 3.41z" />
              <line x1="23" y1="1" x2="1" y2="23" />
            </svg>
          </button>
        )}

      </div>

      {/* ── Right: action buttons ── */}
      <div className="flex items-center gap-2.5">

        {/* Report (only when in chat) */}
        {isInChat && (
          <button
            onClick={onReport}
            style={{ width: 44, height: 44 }}
            className="rounded-full bg-white/10 border border-white/15 backdrop-blur-sm flex items-center justify-center active:scale-90 transition-all"
            title="Report"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
              <line x1="4" y1="22" x2="4" y2="15" />
            </svg>
          </button>
        )}

        {/* Start */}
        {isIdle && (
          <button
            onClick={onJoinQueue}
            className="px-8 py-3.5 rounded-full btn-gradient text-white font-bold text-base active:scale-95 transition-all shadow-lg shadow-violet-600/40"
          >
            Start
          </button>
        )}

        {/* Cancel (searching) */}
        {isSearching && (
          <button
            onClick={onEndChat}
            className="px-8 py-3.5 rounded-full bg-white/15 border border-white/20 backdrop-blur-sm text-white font-medium text-sm active:scale-95 transition-all"
          >
            Cancel
          </button>
        )}

        {/* Next (connected/connecting) */}
        {isInChat && (
          <button
            onClick={onSkip}
            className="px-8 py-3.5 rounded-full btn-gradient text-white font-bold text-base active:scale-95 transition-all shadow-lg shadow-violet-600/40"
          >
            Next
          </button>
        )}
      </div>
    </div>
  );
}
