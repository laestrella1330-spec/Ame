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
  const [localExpanded, setLocalExpanded] = useState(false);

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
  const { remoteStream, connectionState, sessionId, commonInterests, joinQueue, skip, endChat } = useWebRTC(socket, stream);
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
      interests: settings.interests.length > 0 ? settings.interests : undefined,
    });
  }, [joinQueue, settings, features.smartMatch]);

  const handleShareSocials = useCallback(() => {
    const filled = Object.fromEntries(
      Object.entries(settings.socials).filter(([, v]) => v.trim())
    );
    if (Object.keys(filled).length === 0) return;
    sendMessage('', filled);
  }, [settings.socials, sendMessage]);

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
    <div className="h-screen overflow-hidden flex flex-col">
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
      <div className="flex-shrink-0 flex items-center justify-between px-4 py-3 glass">
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
      <div className="flex-1 flex p-4 gap-4 min-h-0 overflow-hidden">
        {/* Video Section */}
        <div className="flex-1 flex flex-col gap-3 min-h-0">
          {/* Videos row */}
          <div className="flex-1 flex gap-3 min-h-0">
            {/* Remote Video (large) */}
            <div className="flex-1 relative min-h-0">
              <VideoPlayer
                stream={remoteStream}
                className="w-full h-full"
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

            {/* Local Video — expandable */}
            <div className={`relative flex-shrink-0 transition-all duration-300 ${localExpanded ? 'w-72' : 'w-44'}`}>
              <VideoPlayer
                stream={stream}
                muted={true}
                mirror={true}
                className={`aspect-video w-full${features.identityControls && settings.faceBlur ? ' blur-md' : ''}`}
                label="You"
              />
              {/* Expand / collapse button */}
              <button
                onClick={() => setLocalExpanded((v) => !v)}
                title={localExpanded ? 'Shrink camera' : 'Expand camera'}
                className="absolute top-2 left-2 w-7 h-7 flex items-center justify-center rounded-full bg-black/50 hover:bg-black/75 text-white transition-all duration-200 hover:scale-110 backdrop-blur-sm border border-white/20 shadow-lg"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  {localExpanded ? (
                    <>
                      <polyline points="4 14 10 14 10 20" />
                      <polyline points="20 10 14 10 14 4" />
                      <line x1="10" y1="14" x2="3" y2="21" />
                      <line x1="21" y1="3" x2="14" y2="10" />
                    </>
                  ) : (
                    <>
                      <polyline points="15 3 21 3 21 9" />
                      <polyline points="9 21 3 21 3 15" />
                      <line x1="21" y1="3" x2="14" y2="10" />
                      <line x1="3" y1="21" x2="10" y2="14" />
                    </>
                  )}
                </svg>
              </button>
            </div>
          </div>

          {/* Common interests badge — below videos */}
          {connectionState === 'connected' && commonInterests.length > 0 && (
            <div className="flex-shrink-0 flex items-center gap-1.5 flex-wrap px-1">
              <span className="text-xs text-violet-400">🎯 Common:</span>
              {commonInterests.map((tag) => (
                <span key={tag} className="text-xs px-2 py-0.5 bg-violet-600/20 border border-violet-500/30 text-violet-300 rounded-full">
                  #{tag}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Chat Panel — full height */}
        <div className="w-80 flex-shrink-0 h-full">
          <ChatPanel
            messages={messages}
            onSend={sendMessage}
            disabled={connectionState !== 'connected'}
            onShareSocials={handleShareSocials}
            hasSocials={Object.values(settings.socials).some((v) => v.trim())}
          />
        </div>
      </div>

      {/* Controls */}
      <div className="flex-shrink-0 p-4">
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
