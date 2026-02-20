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

// SVG icon helpers
function MicIcon({ muted }: { muted: boolean }) {
  return muted ? (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="1" y1="1" x2="23" y2="23" />
      <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6" />
      <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23" />
      <line x1="12" y1="19" x2="12" y2="23" />
      <line x1="8" y1="23" x2="16" y2="23" />
    </svg>
  ) : (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <line x1="12" y1="19" x2="12" y2="23" />
      <line x1="8" y1="23" x2="16" y2="23" />
    </svg>
  );
}

function CamIcon({ off }: { off: boolean }) {
  return off ? (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="1" y1="1" x2="23" y2="23" />
      <path d="M21 21H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h3m3-3h6l2 3h4a2 2 0 0 1 2 2v9.34" />
      <circle cx="12" cy="13" r="3" />
    </svg>
  ) : (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M23 7l-7 5 7 5V7z" />
      <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
    </svg>
  );
}

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
  const isInChat = connectionState === 'connected' || connectionState === 'connecting';
  const isSearching = connectionState === 'searching';

  const btnBase =
    'min-w-[44px] min-h-[44px] flex items-center justify-center gap-1.5 px-3 sm:px-4 py-2 rounded-lg text-sm font-medium transition-all';

  return (
    <div className="flex items-center justify-center gap-2 sm:gap-3 p-3 sm:p-4 glass rounded-xl flex-wrap">
      {/* Mute */}
      <button
        onClick={onToggleMute}
        className={`${btnBase} ${
          isMuted
            ? 'bg-red-600 hover:bg-red-700 text-white'
            : 'bg-white/10 hover:bg-white/20 text-white border border-white/10'
        }`}
      >
        <MicIcon muted={isMuted} />
        <span className="hidden sm:inline">{isMuted ? 'Unmute' : 'Mute'}</span>
      </button>

      {/* Camera */}
      <button
        onClick={onToggleCamera}
        className={`${btnBase} ${
          isCameraOff
            ? 'bg-red-600 hover:bg-red-700 text-white'
            : 'bg-white/10 hover:bg-white/20 text-white border border-white/10'
        }`}
      >
        <CamIcon off={isCameraOff} />
        <span className="hidden sm:inline">{isCameraOff ? 'Cam On' : 'Cam Off'}</span>
      </button>

      {/* Start / Skip / Cancel */}
      {connectionState === 'idle' || connectionState === 'disconnected' ? (
        <button
          onClick={onJoinQueue}
          className={`${btnBase} btn-gradient text-white`}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="5 3 19 12 5 21 5 3" />
          </svg>
          <span className="hidden xs:inline sm:inline">
            {connectionState === 'disconnected' ? 'Next' : 'Start'}
          </span>
        </button>
      ) : isInChat ? (
        <button
          onClick={onSkip}
          className={`${btnBase} bg-violet-600 hover:bg-violet-700 text-white`}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="5 4 15 12 5 20 5 4" />
            <line x1="19" y1="5" x2="19" y2="19" />
          </svg>
          <span className="hidden sm:inline">Skip</span>
        </button>
      ) : isSearching ? (
        <button
          onClick={onEndChat}
          className={`${btnBase} bg-yellow-600 hover:bg-yellow-700 text-white`}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="15" y1="9" x2="9" y2="15" />
            <line x1="9" y1="9" x2="15" y2="15" />
          </svg>
          <span className="hidden sm:inline">Cancel</span>
        </button>
      ) : null}

      {/* Report */}
      {isInChat && (
        <button
          onClick={onReport}
          className={`${btnBase} bg-orange-600 hover:bg-orange-700 text-white`}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
            <line x1="4" y1="22" x2="4" y2="15" />
          </svg>
          <span className="hidden sm:inline">Report</span>
        </button>
      )}

      {/* End Chat */}
      {isInChat && (
        <button
          onClick={onEndChat}
          className={`${btnBase} bg-red-600 hover:bg-red-700 text-white`}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10.68 13.31a16 16 0 0 0 3.41 2.6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7 2 2 0 0 1 1.72 2v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.42 19.42 0 0 1 4.43 13a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.34 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.3 9.91" />
            <line x1="23" y1="1" x2="1" y2="23" />
          </svg>
          <span className="hidden sm:inline">End</span>
        </button>
      )}
    </div>
  );
}
