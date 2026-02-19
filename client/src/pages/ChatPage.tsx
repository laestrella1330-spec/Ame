import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useFeatures } from '../context/FeaturesContext';
import { useSocket } from '../hooks/useSocket';
import { useMediaStream } from '../hooks/useMediaStream';
import { useWebRTC } from '../hooks/useWebRTC';
import { useChat } from '../hooks/useChat';
import { useSettings } from '../hooks/useSettings';
import { useWarmUp } from '../hooks/useWarmUp';
import { useCoHost } from '../hooks/useCoHost';
import VideoPlayer from '../components/VideoPlayer';
import ChatControls from '../components/ChatControls';
import ConnectionStatus from '../components/ConnectionStatus';
import ReportModal from '../components/ReportModal';
import ChatPanel from '../components/ChatPanel';
import SettingsPanel from '../components/SettingsPanel';
import SafetyWarningModal from '../components/SafetyWarningModal';
import WarmUpCard from '../components/WarmUpCard';
import PostChatPanel from '../components/PostChatPanel';
import CoHostWhisper from '../components/CoHostWhisper';

export default function ChatPage() {
  const navigate = useNavigate();
  const { user, isLoading, logout } = useAuth();
  const features = useFeatures();

  const [showReport, setShowReport] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [consentAccepted, setConsentAccepted] = useState(false);

  // Post-chat panel state (Phase 5)
  const [postChatSessionId, setPostChatSessionId] = useState<string | null>(null);

  const { settings, updateSettings } = useSettings();

  // Auth guard: redirect to /login if not authenticated
  useEffect(() => {
    if (!isLoading) {
      if (!user) {
        navigate('/login', { replace: true });
      } else if (user.activeBan) {
        navigate('/', { replace: true });
      } else if (user.hasAcceptedConsent) {
        setConsentAccepted(true);
      }
    }
  }, [user, isLoading, navigate]);

  const { socket, isConnected } = useSocket();
  const { stream, error, isMuted, isCameraOff, startMedia, stopMedia, toggleMute, toggleCamera } =
    useMediaStream();
  const { remoteStream, connectionState, sessionId, joinQueue, skip, endChat } = useWebRTC(socket, stream);
  const { messages, sendMessage } = useChat(socket, connectionState);

  // Phase 1: AI warm-up
  const { warmUp, dismiss: dismissWarmUp } = useWarmUp(socket, connectionState);

  // Phase 3: AI co-host (silence detection)
  const { whisper, dismiss: dismissWhisper } = useCoHost(
    remoteStream,
    connectionState,
    features.aiCohost,
  );

  // Phase 6: Apply voice-only privacy control to local stream
  useEffect(() => {
    if (!stream) return;
    stream.getVideoTracks().forEach((track) => {
      track.enabled = !settings.voiceOnly;
    });
  }, [stream, settings.voiceOnly]);

  // Show post-chat panel when chat ends (Phase 5)
  useEffect(() => {
    if (connectionState === 'disconnected' && sessionId && features.postChatFeedback) {
      setPostChatSessionId(sessionId);
    }
  }, [connectionState, sessionId, features.postChatFeedback]);

  // Start media on mount
  useEffect(() => {
    startMedia();
    return () => { stopMedia(); };
  }, [startMedia, stopMedia]);

  const handleJoinQueue = useCallback(() => {
    joinQueue({
      gender: settings.gender || undefined,
      preferredGender: settings.preferredGender !== 'any' ? settings.preferredGender : undefined,
      country: settings.country || undefined,
      energyLevel: (features.smartMatch && settings.energyLevel) ? settings.energyLevel as 'chill' | 'normal' | 'hype' : undefined,
      intent: (features.smartMatch && settings.intent) ? settings.intent as 'talk' | 'play' | 'flirt' | 'learn' : undefined,
    });
  }, [joinQueue, settings, features.smartMatch]);

  const handleFindNext = useCallback(() => {
    setPostChatSessionId(null);
    handleJoinQueue();
  }, [handleJoinQueue]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-slate-400">Loading…</div>
      </div>
    );
  }

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
      {/* Safety Warning Modal — shown before consent is recorded */}
      {user && !consentAccepted && (
        <SafetyWarningModal onAccepted={() => setConsentAccepted(true)} />
      )}

      {/* Post-chat feedback panel (Phase 5) */}
      {postChatSessionId && features.postChatFeedback && (
        <PostChatPanel
          sessionId={postChatSessionId}
          onClose={() => setPostChatSessionId(null)}
          onFindNext={handleFindNext}
        />
      )}

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 glass">
        <img src="/logo.svg" alt="Ame" className="h-8" />
        <div className="flex items-center gap-3">
          {user && (
            <span className="text-xs text-slate-400 hidden sm:block">
              {user.displayName}
            </span>
          )}
          <ConnectionStatus state={connectionState} />
          {isConnected ? (
            <span className="text-xs text-green-400">Server connected</span>
          ) : (
            <span className="text-xs text-red-400">Server disconnected</span>
          )}
          <button
            onClick={() => setShowSettings(true)}
            className="px-3 py-1.5 rounded-lg text-sm bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10 transition-colors flex items-center gap-1.5"
            title="Preferences"
          >
            <span>⚙️</span>
            <span className="hidden sm:inline">Settings</span>
          </button>
        </div>
      </div>

      {/* Main Area: Video + Chat */}
      <div className="flex-1 flex p-4 gap-4 min-h-0">
        {/* Video Section */}
        <div className="flex-1 flex items-center justify-center gap-4">
          {/* Remote Video (large) — relative for overlay positioning */}
          <div className="flex-1 max-w-3xl relative">
            <VideoPlayer
              stream={remoteStream}
              className="aspect-video w-full"
              label="Partner"
            />

            {/* Phase 1: Warm-up card overlay */}
            {features.aiWarmup && warmUp && connectionState === 'connected' && (
              <WarmUpCard warmUp={warmUp} onDismiss={dismissWarmUp} />
            )}

            {/* Phase 3: Co-host silence whisper */}
            {features.aiCohost && whisper && connectionState === 'connected' && (
              <CoHostWhisper prompt={whisper} onDismiss={dismissWhisper} />
            )}
          </div>

          {/* Local Video (small) — blur applied via CSS for Phase 6 */}
          <div className="w-48">
            <VideoPlayer
              stream={stream}
              muted={true}
              className={`aspect-video w-full${features.identityControls && settings.faceBlur ? ' blur-md' : ''}`}
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
          onJoinQueue={handleJoinQueue}
        />
      </div>

      {/* Report Modal */}
      {showReport && (
        <ReportModal socket={socket} onClose={() => setShowReport(false)} />
      )}

      {/* Settings Panel */}
      {showSettings && (
        <SettingsPanel
          settings={settings}
          onUpdate={updateSettings}
          onClose={() => setShowSettings(false)}
          onLogout={() => { logout(); navigate('/login', { replace: true }); }}
        />
      )}
    </div>
  );
}
