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
import AnimatedBackground from '../components/AnimatedBackground';

export default function ChatPage() {
  const navigate = useNavigate();
  const { user, isLoading, logout } = useAuth();
  const features = useFeatures();

  const [showReport, setShowReport] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [consentAccepted, setConsentAccepted] = useState(false);
  const [localExpanded, setLocalExpanded] = useState(false);
  const [swapped, setSwapped] = useState(false);
  const [showMobileChat, setShowMobileChat] = useState(false);

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

  // Swap: when swapped=true, "You" is the large main video
  const mainStream  = swapped ? stream        : remoteStream;
  const pipStream   = swapped ? remoteStream  : stream;
  const mainLabel   = swapped ? 'You'         : 'Partner';
  const pipLabel    = swapped ? 'Partner'     : 'You';
  const mainMirror  = swapped;                        // mirror only when local is main
  const pipMirror   = !swapped;                       // mirror only when local is pip
  const mainMuted   = swapped;                        // mute only when local stream is main
  const mainBlur    = swapped  && features.identityControls && settings.faceBlur;
  const pipBlur     = !swapped && features.identityControls && settings.faceBlur;

  const pipOverlayBtn =
    'absolute w-8 h-8 flex items-center justify-center rounded-full bg-black/55 hover:bg-black/80 text-white transition-all duration-200 active:scale-95 backdrop-blur-sm border border-white/20 shadow-lg';

  const chatPanelNode = (
    <ChatPanel
      messages={messages}
      onSend={sendMessage}
      disabled={connectionState !== 'connected'}
      onShareSocials={handleShareSocials}
      hasSocials={Object.values(settings.socials).some((v) => v.trim())}
    />
  );

  return (
    /* 100dvh = true visible viewport on mobile (excludes browser chrome) */
    <div
      className="overflow-hidden flex flex-col relative"
      style={{ height: '100dvh' }}
    >
      <AnimatedBackground />

      {/* Safety Warning Modal */}
      {user && !consentAccepted && (
        <SafetyWarningModal onAccepted={() => setConsentAccepted(true)} />
      )}

      {/* Post-chat feedback panel */}
      {postChatSessionId && features.postChatFeedback && (
        <PostChatPanel
          sessionId={postChatSessionId}
          onClose={() => setPostChatSessionId(null)}
          onFindNext={handleFindNext}
        />
      )}

      {/* ── Header ─────────────────────────────────────────── */}
      <div className="flex-shrink-0 relative z-10 flex items-center justify-between px-3 py-2 md:px-4 md:py-3 glass safe-top">
        <img src="/logo.svg" alt="Ame" className="h-7 md:h-8" />
        <div className="flex items-center gap-2 md:gap-3">
          {user && (
            <span className="text-xs text-slate-400 hidden sm:block">{user.displayName}</span>
          )}
          <ConnectionStatus state={connectionState} />
          <span className={`hidden md:inline text-xs ${isConnected ? 'text-green-400' : 'text-red-400'}`}>
            {isConnected ? 'Connected' : 'Disconnected'}
          </span>

          {/* Mobile: chat toggle button */}
          <button
            onClick={() => setShowMobileChat((v) => !v)}
            className="md:hidden relative min-w-[36px] min-h-[36px] flex items-center justify-center rounded-lg text-sm bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10 transition-colors"
            title="Chat"
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
            {messages.length > 0 && !showMobileChat && (
              <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-violet-500 rounded-full border border-black/30" />
            )}
          </button>

          <button
            onClick={() => setShowSettings(true)}
            className="min-w-[36px] min-h-[36px] px-2.5 md:px-3 py-1.5 rounded-lg text-sm bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10 transition-colors flex items-center gap-1.5"
            title="Settings"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
            <span className="hidden sm:inline">Settings</span>
          </button>
        </div>
      </div>

      {/* ── Main Area ───────────────────────────────────────── */}
      {/*
          Mobile:  flex-col, no padding — video fills width, chat is bottom sheet
          Desktop: flex-row with padding — videos on left, chat panel on right
      */}
      <div className="flex-1 flex flex-col md:flex-row md:p-4 md:gap-4 min-h-0 overflow-hidden relative z-10">

        {/* Video Section */}
        <div className="flex-1 flex flex-col min-h-0 md:gap-3">

          {/* Videos row — on mobile PiP is absolutely positioned over main */}
          <div className="flex-1 relative min-h-0 md:flex md:gap-3">

            {/* Main Video */}
            <div className="absolute inset-0 md:static md:flex-1 md:relative md:min-h-0">
              <VideoPlayer
                stream={mainStream}
                muted={mainMuted}
                mirror={mainMirror}
                className={`w-full h-full${mainBlur ? ' blur-md' : ''}`}
                label={mainLabel}
              />
              {features.aiWarmup && warmUp && connectionState === 'connected' && (
                <WarmUpCard warmUp={warmUp} onDismiss={dismissWarmUp} />
              )}
              {features.aiCohost && whisper && connectionState === 'connected' && (
                <CoHostWhisper prompt={whisper} onDismiss={dismissWhisper} />
              )}
            </div>

            {/* PiP Video
                Mobile:  absolute corner overlay (bottom-right)
                Desktop: flex sibling with expand/collapse width
            */}
            <div className={`
              absolute bottom-3 right-3 z-20
              md:static md:flex-shrink-0 md:z-auto md:self-start
              transition-all duration-300
              ${localExpanded ? 'w-36 md:w-72' : 'w-28 md:w-44'}
            `}>
              <VideoPlayer
                stream={pipStream}
                muted={!swapped}
                mirror={pipMirror}
                className={`aspect-video w-full${pipBlur ? ' blur-md' : ''}`}
                label={pipLabel}
              />

              {/* Expand / collapse — top-left */}
              <button
                onClick={() => setLocalExpanded((v) => !v)}
                title={localExpanded ? 'Shrink' : 'Expand'}
                className={`${pipOverlayBtn} top-1.5 left-1.5`}
              >
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
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

              {/* Swap cameras — top-right */}
              <button
                onClick={() => setSwapped((v) => !v)}
                title="Swap cameras"
                className={`${pipOverlayBtn} top-1.5 right-1.5`}
              >
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="17 1 21 5 17 9" />
                  <path d="M3 11V9a4 4 0 0 1 4-4h14" />
                  <polyline points="7 23 3 19 7 15" />
                  <path d="M21 13v2a4 4 0 0 1-4 4H3" />
                </svg>
              </button>
            </div>
          </div>

          {/* Common interests — below videos */}
          {connectionState === 'connected' && commonInterests.length > 0 && (
            <div className="flex-shrink-0 flex items-center gap-1.5 flex-wrap px-3 md:px-1 py-1">
              <span className="text-xs text-violet-400">🎯 Common:</span>
              {commonInterests.map((tag) => (
                <span key={tag} className="text-xs px-2 py-0.5 bg-violet-600/20 border border-violet-500/30 text-violet-300 rounded-full">
                  #{tag}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Desktop: persistent chat sidebar */}
        <div className="hidden md:block w-80 flex-shrink-0 h-full">
          {chatPanelNode}
        </div>
      </div>

      {/* ── Controls ────────────────────────────────────────── */}
      <div className="flex-shrink-0 relative z-10 px-3 py-2 md:p-4 safe-bottom">
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

      {/* ── Mobile: chat bottom sheet ───────────────────────── */}
      {/* Backdrop */}
      {showMobileChat && (
        <div
          className="md:hidden fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
          onClick={() => setShowMobileChat(false)}
        />
      )}
      {/* Sliding panel */}
      <div
        className={`
          md:hidden fixed inset-x-0 bottom-0 z-50
          transition-transform duration-300 ease-out
          ${showMobileChat ? 'translate-y-0' : 'translate-y-full'}
        `}
        style={{ height: '60vh' }}
      >
        {/* Drag handle + close */}
        <div
          className="flex justify-center pt-2 pb-1 cursor-pointer"
          onClick={() => setShowMobileChat(false)}
        >
          <div className="w-10 h-1 bg-white/30 rounded-full" />
        </div>
        <div className="h-[calc(100%-24px)]">
          {chatPanelNode}
        </div>
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
