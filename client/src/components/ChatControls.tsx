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

  return (
    <div className="flex items-center justify-center gap-3 p-4 glass rounded-xl">
      {/* Mute */}
      <button
        onClick={onToggleMute}
        className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
          isMuted
            ? 'bg-red-600 hover:bg-red-700 text-white'
            : 'bg-white/10 hover:bg-white/20 text-white border border-white/10'
        }`}
      >
        {isMuted ? 'Unmute' : 'Mute'}
      </button>

      {/* Camera */}
      <button
        onClick={onToggleCamera}
        className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
          isCameraOff
            ? 'bg-red-600 hover:bg-red-700 text-white'
            : 'bg-white/10 hover:bg-white/20 text-white border border-white/10'
        }`}
      >
        {isCameraOff ? 'Camera On' : 'Camera Off'}
      </button>

      {/* Start / Skip */}
      {connectionState === 'idle' || connectionState === 'disconnected' ? (
        <button
          onClick={onJoinQueue}
          className="px-6 py-2 rounded-lg text-sm font-medium btn-gradient text-white"
        >
          {connectionState === 'disconnected' ? 'Find New Partner' : 'Start Chat'}
        </button>
      ) : isInChat ? (
        <button
          onClick={onSkip}
          className="px-6 py-2 rounded-lg text-sm font-medium bg-violet-600 hover:bg-violet-700 text-white transition-colors"
        >
          Skip
        </button>
      ) : isSearching ? (
        <button
          onClick={onEndChat}
          className="px-6 py-2 rounded-lg text-sm font-medium bg-yellow-600 hover:bg-yellow-700 text-white transition-colors"
        >
          Cancel
        </button>
      ) : null}

      {/* Report */}
      {isInChat && (
        <button
          onClick={onReport}
          className="px-4 py-2 rounded-lg text-sm font-medium bg-orange-600 hover:bg-orange-700 text-white transition-colors"
        >
          Report
        </button>
      )}

      {/* End Chat */}
      {isInChat && (
        <button
          onClick={onEndChat}
          className="px-4 py-2 rounded-lg text-sm font-medium bg-red-600 hover:bg-red-700 text-white transition-colors"
        >
          End Chat
        </button>
      )}
    </div>
  );
}
