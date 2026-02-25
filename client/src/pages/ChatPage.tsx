import { useState, useEffect, useCallback, useRef } from 'react';
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
import ConnectionStatus from '../components/ConnectionStatus';
import ReportModal from '../components/ReportModal';
import ChatPanel from '../components/ChatPanel';
import SettingsPanel from '../components/SettingsPanel';
import SafetyWarningModal from '../components/SafetyWarningModal';
import WarmUpCard from '../components/WarmUpCard';
import PostChatPanel from '../components/PostChatPanel';
import CoHostWhisper from '../components/CoHostWhisper';

// ── Emoji reactions (scrollable) ────────────────────────
const REACTIONS = [
  '😊','👍','✌️','😮','❤️','😎',
  '😂','🔥','😍','👏','🙌','💪',
  '🤣','😆','😜','🥳','😏','🤯',
  '🥺','😤','🤩','😘','👋','🫶',
  '💀','😴','🤔','😑','😅','🙄',
];

// Convert 2-letter ISO country code → emoji flag
function countryFlag(code: string | null): string {
  if (!code || code.length !== 2) return '';
  return code.toUpperCase().replace(/./g, (c) =>
    String.fromCodePoint(c.charCodeAt(0) + 127397)
  );
}

export default function ChatPage() {
  const navigate = useNavigate();
  const { user, isLoading, logout } = useAuth();
  const features = useFeatures();

  const [showReport, setShowReport] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [consentAccepted, setConsentAccepted] = useState(false);
  const [postChatSessionId, setPostChatSessionId] = useState<string | null>(null);
  const [onlineCount, setOnlineCount] = useState<number>(0);

  const { settings, updateSettings } = useSettings();

  // Auth guard
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

  const { socket } = useSocket();
  const {
    stream, error, isMuted, isCameraOff,
    startMedia, stopMedia, toggleMute, toggleCamera, switchCamera,
  } = useMediaStream();
  const {
    remoteStream, connectionState, sessionId, commonInterests, partnerCountry,
    joinQueue, skip, endChat, replaceVideoTrack,
  } = useWebRTC(socket, stream);
  const { messages, sendMessage } = useChat(socket, connectionState);

  const { warmUp, dismiss: dismissWarmUp } = useWarmUp(socket, connectionState);
  const { whisper, dismiss: dismissWhisper } = useCoHost(
    remoteStream, connectionState, features.aiCohost,
  );

  // Voice-only privacy
  useEffect(() => {
    if (!stream) return;
    stream.getVideoTracks().forEach((t) => { t.enabled = !settings.voiceOnly; });
  }, [stream, settings.voiceOnly]);

  // Post-chat feedback
  useEffect(() => {
    if (connectionState === 'disconnected' && sessionId && features.postChatFeedback) {
      setPostChatSessionId(sessionId);
    }
  }, [connectionState, sessionId, features.postChatFeedback]);

  // Live online count from server
  useEffect(() => {
    const s = socket;
    if (!s) return;
    const handler = (count: number) => setOnlineCount(count);
    s.on('online_count', handler);
    return () => { s.off('online_count', handler); };
  }, [socket]);

  // DO NOT auto-start camera — user must explicitly grant permission via ALLOW ACCESS
  // (stopMedia cleanup is handled inside useMediaStream's own unmount effect)

  // "ALLOW ACCESS" button handler — called once by the user
  const handleAllowAccess = useCallback(async () => {
    await startMedia();
  }, [startMedia]);

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

  // ── Fix #1: back camera support ─────────────────────────
  const isSwitchingCameraRef = useRef(false);
  const handleSwitchCamera = useCallback(async () => {
    if (isSwitchingCameraRef.current) return; // block overlapping calls
    isSwitchingCameraRef.current = true;
    try {
      const newTrack = await switchCamera();
      if (newTrack) await replaceVideoTrack(newTrack);
    } finally {
      isSwitchingCameraRef.current = false;
    }
  }, [switchCamera, replaceVideoTrack]);

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

  // ── Fix #4: swipe left/up to skip ───────────────────────
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  }, []);
  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    const dy = e.changedTouches[0].clientY - touchStartY.current;
    const absDx = Math.abs(dx);
    const absDy = Math.abs(dy);
    const isInChat = connectionState === 'connected' || connectionState === 'connecting';
    // Swipe left (horizontal) OR swipe up (vertical) → skip / join
    if ((absDx > absDy && dx < -60) || (absDy > absDx && dy < -60)) {
      if (isInChat) skip();
      else if (connectionState === 'idle' || connectionState === 'disconnected') handleJoinQueue();
    }
    // Swipe right → end call
    if (absDx > absDy && dx > 60 && isInChat) {
      endChat();
    }
  }, [connectionState, skip, endChat, handleJoinQueue]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#1a1a1a]">
        <div className="text-slate-400">Loading…</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-[#1a1a1a]">
        <div className="rounded-2xl p-6 max-w-md text-center bg-[#2d2d2d] border border-white/10">
          <div className="text-red-400 text-lg font-semibold mb-2">Camera Access Required</div>
          <p className="text-slate-300 text-sm mb-4">{error}</p>
          <button onClick={() => navigate('/')} className="px-4 py-2 bg-white/10 text-white rounded-lg text-sm border border-white/10">
            Go Back
          </button>
        </div>
      </div>
    );
  }

  const isInChat = connectionState === 'connected' || connectionState === 'connecting';
  const isConnected = connectionState === 'connected';
  const localBlur = features.identityControls && settings.faceBlur;
  const flag = countryFlag(partnerCountry);

  // ── Derive standby state (mirrors StandbyStates from the JS spec) ──
  type StandbyState = 'permission_request' | 'ready' | 'searching' | 'error' | 'disconnected';
  const standbyState: StandbyState = (() => {
    if (error) return 'error';
    if (!stream) return 'permission_request';
    if (connectionState === 'searching') return 'searching';
    if (connectionState === 'disconnected') return 'disconnected';
    return 'ready';
  })();

  // ── Shared standby UI helpers ──────────────────────────────────────
  const STANDBY_BG: React.CSSProperties = {
    minHeight: '100dvh',
    background: 'radial-gradient(ellipse at 50% 25%, #1e0a4e 0%, #0d0720 45%, #06050f 100%)',
    padding: '16px 20px',
    color: 'white',
    position: 'relative',
    overflowX: 'hidden',
    overflowY: 'auto',
  };
  const primaryBtn: React.CSSProperties = {
    background: 'linear-gradient(135deg, #6d28d9, #8B5CF6, #7c3aed)',
    color: 'white',
    border: 'none',
    padding: '16px 52px',
    borderRadius: 40,
    fontSize: 14,
    fontWeight: 700,
    fontFamily: "'Orbitron', sans-serif",
    textTransform: 'uppercase',
    cursor: 'pointer',
    boxShadow: '0 0 28px rgba(139,92,246,0.7), 0 0 60px rgba(139,92,246,0.2)',
    minWidth: 240,
    letterSpacing: '0.12em',
  };
  const cancelBtn: React.CSSProperties = {
    background: 'transparent',
    color: 'rgba(167,139,250,0.75)',
    border: '1px solid rgba(139,92,246,0.4)',
    padding: '10px 28px',
    borderRadius: 30,
    fontSize: 12,
    fontFamily: "'Orbitron', sans-serif",
    letterSpacing: '0.1em',
    textTransform: 'uppercase',
    cursor: 'pointer',
    marginTop: 12,
  };

  // ══════════════════════════════════════════════════════
  // STANDBY SCREEN — all non-chat states
  // ══════════════════════════════════════════════════════
  if (standbyState !== 'ready' || connectionState === 'idle' || connectionState === 'disconnected') {
    // Derive per-state content
    const stateContent = {
      permission_request: {
        statusMessage: 'AME needs camera and microphone access',
        actionLabel: 'ALLOW ACCESS',
        onAction: handleAllowAccess,
        showCancel: false,
        showCamera: false,
      },
      ready: {
        statusMessage: 'You look great! Ready to connect?',
        actionLabel: 'START CHAT',
        onAction: handleJoinQueue,
        showCancel: false,
        showCamera: true,
      },
      searching: {
        statusMessage: 'Looking for someone to connect with...',
        actionLabel: 'CANCEL',
        onAction: endChat,
        showCancel: false,
        showCamera: true,
      },
      error: {
        statusMessage: error ?? 'Something went wrong.',
        actionLabel: 'TRY AGAIN',
        onAction: handleAllowAccess,
        showCancel: false,
        showCamera: false,
      },
      disconnected: {
        statusMessage: 'Chat ended. Find someone new?',
        actionLabel: 'FIND NEXT',
        onAction: handleJoinQueue,
        showCancel: false,
        showCamera: true,
      },
    }[standbyState];

    return (
      <div className="flex flex-col items-center justify-center" style={STANDBY_BG}>
        {/* Background dot grid */}
        <div style={{ position: 'absolute', inset: 0, backgroundImage: 'radial-gradient(rgba(139,92,246,0.13) 1px, transparent 1px)', backgroundSize: '26px 26px', pointerEvents: 'none' }} />
        {/* Ambient glow orbs */}
        <div style={{ position: 'absolute', top: '8%', left: '5%', width: 220, height: 220, borderRadius: '50%', background: 'radial-gradient(circle, rgba(109,40,217,0.3) 0%, transparent 70%)', filter: 'blur(50px)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', bottom: '12%', right: '3%', width: 180, height: 180, borderRadius: '50%', background: 'radial-gradient(circle, rgba(124,58,237,0.2) 0%, transparent 70%)', filter: 'blur(45px)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', top: '45%', left: '50%', width: 140, height: 140, borderRadius: '50%', transform: 'translate(-50%,-50%)', background: 'radial-gradient(circle, rgba(167,139,250,0.08) 0%, transparent 70%)', filter: 'blur(30px)', pointerEvents: 'none' }} />

        {/* Safety consent modal */}
        {user && !consentAccepted && (
          <SafetyWarningModal onAccepted={() => setConsentAccepted(true)} />
        )}

        {/* ── Logo ── */}
        <div className="flex flex-col items-center animate-float" style={{ marginBottom: 16, position: 'relative', zIndex: 1 }}>
          <img src="/logo.png" alt="AME" style={{ width: 90, height: 'auto', marginBottom: 8, filter: 'drop-shadow(0 0 24px rgba(139,92,246,0.55))' }} />
          <p className="neon-text" style={{ fontFamily: "'Orbitron', sans-serif", fontSize: 14, fontWeight: 700, color: '#fff', margin: 0, letterSpacing: '0.1em', textShadow: '0 0 16px rgba(139,92,246,1), 0 0 32px rgba(139,92,246,0.5)' }}>
            Connect with the World
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
            <div style={{ width: 32, height: 1, background: 'linear-gradient(90deg, transparent, rgba(167,139,250,0.7))' }} />
            <p style={{ fontFamily: "'Rajdhani', sans-serif", fontSize: 11, fontWeight: 500, color: 'rgba(167,139,250,0.7)', margin: 0, letterSpacing: '0.28em', textTransform: 'uppercase' }}>Stay Anonymous</p>
            <div style={{ width: 32, height: 1, background: 'linear-gradient(90deg, rgba(167,139,250,0.7), transparent)' }} />
          </div>
        </div>

        {/* ── Camera preview with layered rings ── */}
        <div style={{ position: 'relative', zIndex: 1 }}>
          {stateContent.showCamera ? (
            <div style={{ position: 'relative', width: 220, height: 220 }}>
              {/* Outer pulse ring */}
              <div className="pulse-ring" style={{ position: 'absolute', inset: -16, borderRadius: '50%', border: '1px solid rgba(139,92,246,0.4)' }} />
              {/* Mid glow ring */}
              <div style={{ position: 'absolute', inset: -6, borderRadius: '50%', border: '1px solid rgba(167,139,250,0.55)', boxShadow: '0 0 18px rgba(139,92,246,0.4)' }} />
              {/* Video circle */}
              <div style={{ width: 220, height: 220, borderRadius: '50%', overflow: 'hidden', border: '2px solid #8B5CF6', boxShadow: '0 0 40px rgba(139,92,246,0.55), inset 0 0 20px rgba(0,0,0,0.4)' }}>
                <VideoPlayer stream={stream} muted={true} mirror={true}
                  className={`w-full h-full${localBlur ? ' blur-md' : ''}`}
                  videoStyle={{ filter: 'brightness(1.08) contrast(1.05) saturate(1.2)' }} />
              </div>
              {/* Camera controls */}
              {standbyState !== 'searching' && (
                <div className="absolute flex gap-2" style={{ bottom: 8, right: 8 }}>
                  <button onClick={toggleMute}
                    className="w-9 h-9 flex items-center justify-center rounded-full text-white active:scale-90 transition-all"
                    style={{ background: isMuted ? '#ef4444' : 'rgba(13,7,32,0.85)', border: `1px solid ${isMuted ? '#ef4444' : 'rgba(139,92,246,0.5)'}` }}
                    title={isMuted ? 'Unmute' : 'Mute'}>
                    {isMuted ? (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="1" y1="1" x2="23" y2="23" />
                        <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6" />
                        <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23" />
                        <line x1="12" y1="19" x2="12" y2="23" /><line x1="8" y1="23" x2="16" y2="23" />
                      </svg>
                    ) : (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                        <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                        <line x1="12" y1="19" x2="12" y2="23" /><line x1="8" y1="23" x2="16" y2="23" />
                      </svg>
                    )}
                  </button>
                  <button onClick={handleSwitchCamera}
                    className="w-9 h-9 flex items-center justify-center rounded-full text-white active:scale-90 transition-all"
                    style={{ background: 'rgba(13,7,32,0.85)', border: '1px solid rgba(139,92,246,0.5)' }}
                    title="Flip camera">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M1 4v6h6" /><path d="M23 20v-6h-6" />
                      <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10" />
                      <path d="M3.51 15a9 9 0 0 0 14.85 3.36L23 14" />
                    </svg>
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div style={{ position: 'relative', width: 220, height: 220 }}>
              <div className="pulse-ring" style={{ position: 'absolute', inset: -16, borderRadius: '50%', border: '1px solid rgba(139,92,246,0.4)' }} />
              <div style={{ position: 'absolute', inset: -6, borderRadius: '50%', border: '1px solid rgba(167,139,250,0.55)', boxShadow: '0 0 18px rgba(139,92,246,0.4)' }} />
              <div style={{ width: 220, height: 220, borderRadius: '50%', border: '2px solid rgba(139,92,246,0.6)', boxShadow: '0 0 40px rgba(139,92,246,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(13,7,32,0.7)' }}>
                {standbyState === 'error' ? (
                  <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="rgba(167,139,250,0.8)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                ) : (
                  <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="rgba(167,139,250,0.8)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M23 7l-7 5 7 5V7z" /><rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
                  </svg>
                )}
              </div>
            </div>
          )}

          {/* Searching spinner */}
          {standbyState === 'searching' && (
            <div className="absolute inset-0 flex items-center justify-center rounded-full" style={{ background: 'rgba(6,5,15,0.65)' }}>
              <div style={{ width: 52, height: 52, borderRadius: '50%', border: '3px solid rgba(139,92,246,0.2)', borderTop: '3px solid #8B5CF6', animation: 'spin-ring 1.2s linear infinite' }} />
            </div>
          )}
        </div>

        {/* ── Status message ── */}
        <p style={{ fontFamily: "'Rajdhani', sans-serif", fontSize: 16, fontWeight: 500, margin: '14px 0 0', textAlign: 'center', color: 'rgba(255,255,255,0.85)', letterSpacing: '0.04em', position: 'relative', zIndex: 1 }}>
          {stateContent.statusMessage}
        </p>

        {/* ── Online count ── */}
        <div className="flex items-center gap-2" style={{ margin: '6px 0 14px', position: 'relative', zIndex: 1 }}>
          <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#10B981', boxShadow: '0 0 8px #10B981, 0 0 14px rgba(16,185,129,0.4)' }} />
          <span style={{ fontFamily: "'Rajdhani', sans-serif", fontSize: 12, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'rgba(167,139,250,0.75)' }}>
            {onlineCount > 0 ? `${onlineCount.toLocaleString()} Users Online` : 'Users Online'}
          </span>
        </div>

        {/* ── Primary action button ── */}
        <div className="flex flex-col items-center" style={{ position: 'relative', zIndex: 1 }}>
          <button onClick={stateContent.onAction} className="active:scale-95 transition-all"
            style={standbyState === 'searching' ? { ...primaryBtn, background: 'rgba(109,40,217,0.25)', boxShadow: 'none', cursor: 'default' } : primaryBtn}>
            {stateContent.actionLabel}
          </button>
          {standbyState === 'searching' && (
            <button onClick={endChat} className="active:scale-95 transition-all" style={cancelBtn}>Cancel</button>
          )}
          <button onClick={() => setShowSettings(true)} className="active:opacity-60 transition-opacity"
            style={{ background: 'transparent', border: 'none', color: 'rgba(139,92,246,0.5)', fontSize: 10, fontFamily: "'Orbitron', sans-serif", letterSpacing: '0.14em', textTransform: 'uppercase', cursor: 'pointer', marginTop: 14, display: 'flex', alignItems: 'center', gap: 5 }}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
            Settings
          </button>
        </div>

        {showSettings && (
          <SettingsPanel settings={settings} onUpdate={updateSettings}
            onClose={() => setShowSettings(false)}
            onLogout={() => { logout(); navigate('/login', { replace: true }); }} />
        )}
      </div>
    );
  }

  // ══════════════════════════════════════════════════════
  // CHAT SCREEN — split-screen when connected
  // ══════════════════════════════════════════════════════
  return (
    <div
      className="flex flex-col overflow-hidden bg-[#1a1a1a]"
      style={{ height: '100dvh' }}
    >
      {/* Post-chat feedback */}
      {postChatSessionId && features.postChatFeedback && (
        <PostChatPanel
          sessionId={postChatSessionId}
          onClose={() => setPostChatSessionId(null)}
          onFindNext={handleFindNext}
        />
      )}

      {/* ═══════════════════════════════════════════════
          TOP PANEL — Stranger's video (50dvh)
          ═══════════════════════════════════════════════ */}
      <div
        className="relative flex-none overflow-hidden"
        style={{ height: '50dvh' }}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <VideoPlayer stream={remoteStream} muted={false} mirror={false} className="w-full h-full" />

        {/* Top-left: Logo */}
        <div className="absolute top-0 left-0 z-10 px-3 py-3 safe-top">
          <img src="/logo.png" alt="Ame" className="h-7" />
        </div>

        {/* Top-right: Connected badge + Report + Settings */}
        <div className="absolute top-3 right-3 z-10 flex items-center gap-2 safe-top">
          {isConnected && (
            <span className="text-xs font-semibold" style={{ color: '#22c55e' }}>
              Connected
            </span>
          )}
          {isInChat && (
            <button
              onClick={() => setShowReport(true)}
              className="w-9 h-9 flex items-center justify-center rounded-full text-white active:scale-90 transition-all"
              style={{ background: 'rgba(0,0,0,0.5)' }}
              title="Report"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
                <line x1="4" y1="22" x2="4" y2="15" />
              </svg>
            </button>
          )}
          <button
            onClick={() => setShowSettings(true)}
            className="w-9 h-9 flex items-center justify-center rounded-full text-white active:scale-90 transition-all"
            style={{ background: 'rgba(0,0,0,0.5)' }}
            title="Settings"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
          </button>
        </div>

        {/* Bottom-left: flag + country + common interests */}
        <div className="absolute bottom-3 left-3 z-10 flex flex-col gap-1.5 items-start">
          <div className="flex items-center gap-1.5">
            {flag && <span className="text-xl leading-none">{flag}</span>}
            <span className="text-white text-xs font-semibold px-3 py-1 rounded-full"
              style={{ background: 'rgba(0,0,0,0.6)' }}>
              {partnerCountry ? partnerCountry.toUpperCase() : 'Stranger'}
            </span>
          </div>
          {isInChat && commonInterests.length > 0 && (
            <div className="flex gap-1 flex-wrap">
              {commonInterests.map((tag) => (
                <span key={tag} className="text-xs px-2 py-0.5 rounded-full text-white"
                  style={{ background: 'rgba(139,92,246,0.65)', border: '1px solid rgba(139,92,246,0.4)' }}>
                  #{tag}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* AI overlays */}
        {features.aiWarmup && warmUp && isConnected && (
          <WarmUpCard warmUp={warmUp} onDismiss={dismissWarmUp} />
        )}
        {features.aiCohost && whisper && isConnected && (
          <CoHostWhisper prompt={whisper} onDismiss={dismissWhisper} />
        )}
      </div>

      {/* ═══════════════════════════════════════════════
          BOTTOM PANEL — Your video (50dvh)
          ═══════════════════════════════════════════════ */}
      <div
        className="relative flex-none overflow-hidden"
        style={{ height: '50dvh' }}
        onClick={(e) => {
          if ((e.target as Element).closest('button')) return;
          setShowControls((v) => !v);
        }}
      >
        <VideoPlayer
          stream={stream}
          muted={true}
          mirror={true}
          className={`w-full h-full${localBlur ? ' blur-md' : ''}`}
          videoStyle={{ filter: 'brightness(1.08) contrast(1.05) saturate(1.2)' }}
        />

        {/* You label */}
        <div className="absolute top-3 left-3 z-10">
          <span className="text-white text-xs font-semibold px-3 py-1 rounded-full"
            style={{ background: 'rgba(0,0,0,0.6)' }}>
            You
          </span>
        </div>

        {/* Top-right: Mic · Cam · Flip */}
        <div className="absolute top-3 right-3 z-10 flex gap-2">
          <button onClick={toggleMute}
            className="w-9 h-9 flex items-center justify-center rounded-full text-white active:scale-90 transition-all"
            style={{ background: isMuted ? '#ef4444' : 'rgba(0,0,0,0.5)' }}
            title={isMuted ? 'Unmute' : 'Mute'}>
            {isMuted ? (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="1" y1="1" x2="23" y2="23" />
                <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6" />
                <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23" />
                <line x1="12" y1="19" x2="12" y2="23" /><line x1="8" y1="23" x2="16" y2="23" />
              </svg>
            ) : (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                <line x1="12" y1="19" x2="12" y2="23" /><line x1="8" y1="23" x2="16" y2="23" />
              </svg>
            )}
          </button>

          <button onClick={toggleCamera}
            className="w-9 h-9 flex items-center justify-center rounded-full text-white active:scale-90 transition-all"
            style={{ background: isCameraOff ? '#ef4444' : 'rgba(0,0,0,0.5)' }}
            title={isCameraOff ? 'Camera on' : 'Camera off'}>
            {isCameraOff ? (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="1" y1="1" x2="23" y2="23" />
                <path d="M21 21H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h3m3-3h6l2 3h4a2 2 0 0 1 2 2v9.34" />
                <circle cx="12" cy="13" r="3" />
              </svg>
            ) : (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M23 7l-7 5 7 5V7z" />
                <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
              </svg>
            )}
          </button>

          <button onClick={handleSwitchCamera}
            className="w-9 h-9 flex items-center justify-center rounded-full text-white active:scale-90 transition-all"
            style={{ background: 'rgba(0,0,0,0.5)' }}
            title="Flip camera">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M1 4v6h6" />
              <path d="M23 20v-6h-6" />
              <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10" />
              <path d="M3.51 15a9 9 0 0 0 14.85 3.36L23 14" />
            </svg>
          </button>
        </div>

        {/* ── BOTTOM CONTROLS BAR ── */}
        {showControls && <div className="absolute bottom-0 left-0 right-0 z-10 safe-bottom"
          style={{ background: 'rgba(0,0,0,0.65)' }}>
          <div className="flex items-center gap-2 px-3 py-2.5">

            {/* Scrollable emoji reactions */}
            <div className="flex-1 flex items-center gap-3 overflow-x-auto"
              style={{ scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' }}>
              {REACTIONS.map((emoji) => (
                <button key={emoji} onClick={() => sendMessage(emoji)}
                  disabled={!isConnected}
                  className="flex-none text-xl leading-none active:scale-90 transition-all disabled:opacity-30"
                  title={`Send ${emoji}`}>
                  {emoji}
                </button>
              ))}
            </div>

            {/* Chat */}
            <button
              onClick={() => setShowChat((v) => !v)}
              className="relative flex-none w-11 h-11 flex items-center justify-center rounded-full text-white active:scale-90 transition-all"
              style={{ background: 'rgba(255,255,255,0.12)' }}
              title="Chat"
            >
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
              {messages.length > 0 && !showChat && (
                <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-[#8B5CF6] rounded-full border border-black/30" />
              )}
            </button>
          </div>
        </div>}
      </div>

      {/* Chat bottom sheet */}
      {showChat && (
        <div className="fixed inset-0 z-40" style={{ background: 'rgba(0,0,0,0.5)' }}
          onClick={() => setShowChat(false)} />
      )}
      <div className={`fixed inset-x-0 bottom-0 z-50 transition-transform duration-300 ease-out ${showChat ? 'translate-y-0' : 'translate-y-full'}`}
        style={{ height: '42dvh' }}>
        <div className="h-full flex flex-col rounded-t-2xl overflow-hidden"
          style={{ background: 'rgba(18,18,18,0.97)', backdropFilter: 'blur(16px)', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
          <div className="flex-shrink-0 flex items-center justify-center pt-2 pb-1">
            <div className="w-10 h-1 rounded-full" style={{ background: 'rgba(255,255,255,0.25)' }} />
          </div>
          <div className="flex-1 min-h-0">
            <ChatPanel
              messages={messages}
              onSend={sendMessage}
              disabled={!isConnected}
              onShareSocials={handleShareSocials}
              hasSocials={Object.values(settings.socials).some((v) => v.trim())}
            />
          </div>
        </div>
      </div>

      {/* Modals */}
      {showReport && <ReportModal socket={socket} onClose={() => setShowReport(false)} />}
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
