import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSocket } from '../hooks/useSocket';
import { useMediaStream } from '../hooks/useMediaStream';
import { useWebRTC } from '../hooks/useWebRTC';
import { useChat } from '../hooks/useChat';
import VideoPlayer from '../components/VideoPlayer';
import ChatControls from '../components/ChatControls';
import ConnectionStatus from '../components/ConnectionStatus';
import ReportModal from '../components/ReportModal';
import ChatPanel from '../components/ChatPanel';

export default function ChatPage() {
  const navigate = useNavigate();
  const [showReport, setShowReport] = useState(false);

  // Check consent
  useEffect(() => {
    if (!sessionStorage.getItem('consent_given')) {
      navigate('/', { replace: true });
    }
  }, [navigate]);

  const { socket, isConnected } = useSocket();
  const { stream, error, isMuted, isCameraOff, startMedia, stopMedia, toggleMute, toggleCamera } =
    useMediaStream();
  const { remoteStream, connectionState, joinQueue, skip, endChat } = useWebRTC(socket, stream);
  const { messages, sendMessage } = useChat(socket, connectionState);

  // Start media on mount
  useEffect(() => {
    startMedia();
    return () => {
      stopMedia();
    };
  }, [startMedia, stopMedia]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="glass rounded-2xl p-6 max-w-md text-center glow-purple">
          <div className="text-red-400 text-lg font-semibold mb-2">Camera Access Required</div>
          <p className="text-slate-300 text-sm mb-4">{error}</p>
          <button
            onClick={() => navigate('/')}
            className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg text-sm border border-white/10"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 glass">
        <img src="/logo.svg" alt="Ame" className="h-8" />
        <div className="flex items-center gap-4">
          <ConnectionStatus state={connectionState} />
          {isConnected ? (
            <span className="text-xs text-green-400">Server connected</span>
          ) : (
            <span className="text-xs text-red-400">Server disconnected</span>
          )}
        </div>
      </div>

      {/* Main Area: Video + Chat */}
      <div className="flex-1 flex p-4 gap-4 min-h-0">
        {/* Video Section */}
        <div className="flex-1 flex items-center justify-center gap-4">
          {/* Remote Video (large) */}
          <div className="flex-1 max-w-3xl">
            <VideoPlayer
              stream={remoteStream}
              className="aspect-video w-full"
              label="Partner"
            />
          </div>

          {/* Local Video (small) */}
          <div className="w-48">
            <VideoPlayer
              stream={stream}
              muted={true}
              className="aspect-video w-full"
              label="You"
            />
          </div>
        </div>

        {/* Chat Panel */}
        <div className="w-80 flex-shrink-0">
          <ChatPanel
            messages={messages}
            onSend={sendMessage}
            disabled={connectionState !== 'connected'}
          />
        </div>
      </div>

      {/* Controls */}
      <div className="p-4">
        <ChatControls
          connectionState={connectionState}
          isMuted={isMuted}
          isCameraOff={isCameraOff}
          onToggleMute={toggleMute}
          onToggleCamera={toggleCamera}
          onSkip={skip}
          onEndChat={endChat}
          onReport={() => setShowReport(true)}
          onJoinQueue={joinQueue}
        />
      </div>

      {/* Report Modal */}
      {showReport && (
        <ReportModal socket={socket} onClose={() => setShowReport(false)} />
      )}
    </div>
  );
}
