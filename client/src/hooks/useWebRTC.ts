import { useRef, useState, useCallback, useEffect } from 'react';
import { Socket } from 'socket.io-client';

interface RTCIceServer {
  urls: string | string[];
  username?: string;
  credential?: string;
}

interface MatchData {
  sessionId: string;
  isInitiator: boolean;
  iceServers: RTCIceServer[];
  commonInterests?: string[];
  partnerCountry?: string | null;
}

export type ConnectionState = 'idle' | 'searching' | 'connecting' | 'connected' | 'disconnected';

export interface JoinPrefs {
  gender?: string;
  preferredGender?: string;
  country?: string;
  // Phase 2: smart match soft preferences
  energyLevel?: 'chill' | 'normal' | 'hype';
  intent?: 'talk' | 'play' | 'flirt' | 'learn';
  // Common interests
  interests?: string[];
}

export function useWebRTC(socket: Socket | null, localStream: MediaStream | null) {
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [connectionState, setConnectionState] = useState<ConnectionState>('idle');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [commonInterests, setCommonInterests] = useState<string[]>([]);
  const [partnerCountry, setPartnerCountry] = useState<string | null>(null);

  // Buffer ICE candidates that arrive before remote description is set
  const iceCandidateBufferRef = useRef<RTCIceCandidateInit[]>([]);

  // Shadow peer connection for admin monitoring (one-way: user→admin)
  const adminPcRef = useRef<RTCPeerConnection | null>(null);
  const adminSocketIdRef = useRef<string | null>(null);
  // Keep a ref so admin event handlers always see the latest localStream
  const localStreamRef = useRef<MediaStream | null>(localStream);
  useEffect(() => { localStreamRef.current = localStream; }, [localStream]);

  const cleanup = useCallback(() => {
    iceCandidateBufferRef.current = [];
    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }
    if (adminPcRef.current) {
      adminPcRef.current.close();
      adminPcRef.current = null;
    }
    adminSocketIdRef.current = null;
    setRemoteStream(null);
  }, []);

  const createPeerConnection = useCallback(
    (iceServers: RTCIceServer[]) => {
      cleanup();
      iceCandidateBufferRef.current = [];

      const pc = new RTCPeerConnection({ iceServers });

      pc.onicecandidate = (event) => {
        if (event.candidate && socket) {
          socket.emit('ice-candidate', { candidate: event.candidate });
        }
      };

      pc.ontrack = (event) => {
        if (event.streams && event.streams[0]) {
          setRemoteStream(event.streams[0]);
        } else {
          // Fallback for browsers that don't include streams in the event
          setRemoteStream((prev) => {
            const s = prev ?? new MediaStream();
            s.addTrack(event.track);
            return new MediaStream(s.getTracks());
          });
        }
        setConnectionState('connected');
      };

      pc.onconnectionstatechange = () => {
        if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
          setConnectionState('disconnected');
        }
      };

      // Monitor ICE-layer connectivity — restart ICE on failure so video recovers
      // without requiring the user to manually skip/reconnect.
      pc.oniceconnectionstatechange = () => {
        if (pc.iceConnectionState === 'failed') {
          pc.restartIce();
        }
      };

      // Add local tracks
      if (localStream) {
        localStream.getTracks().forEach((track) => {
          pc.addTrack(track, localStream);
        });
      }

      pcRef.current = pc;
      return pc;
    },
    [socket, localStream, cleanup]
  );

  // Flush ICE candidates that were buffered before remote description was set
  const flushIceCandidates = useCallback(async (pc: RTCPeerConnection) => {
    const buffered = iceCandidateBufferRef.current.splice(0);
    for (const candidate of buffered) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch { /* ignore stale */ }
    }
  }, []);

  const joinQueue = useCallback((prefs?: JoinPrefs) => {
    if (!socket) return;
    setConnectionState('searching');
    socket.emit('join-queue', prefs || {});
  }, [socket]);

  const leaveQueue = useCallback(() => {
    if (!socket) return;
    socket.emit('leave-queue');
    setConnectionState('idle');
  }, [socket]);

  const skip = useCallback(() => {
    if (!socket) return;
    cleanup();
    socket.emit('skip');
    // Will auto re-queue via server
    setConnectionState('searching');
  }, [socket, cleanup]);

  const endChat = useCallback(() => {
    if (!socket) return;
    cleanup();
    socket.emit('end-chat');
    setConnectionState('idle');
    setSessionId(null);
  }, [socket, cleanup]);

  useEffect(() => {
    if (!socket) return;

    const handleMatched = async (data: MatchData) => {
      setSessionId(data.sessionId);
      setConnectionState('connecting');
      setCommonInterests(data.commonInterests || []);
      setPartnerCountry(data.partnerCountry || null);

      const pc = createPeerConnection(data.iceServers);

      if (data.isInitiator) {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        socket.emit('offer', { sdp: pc.localDescription });
      }
    };

    const handleOffer = async (data: { sdp: RTCSessionDescriptionInit }) => {
      const pc = pcRef.current;
      if (!pc) return;
      await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
      // Flush any candidates that arrived before this remote description
      await flushIceCandidates(pc);
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      socket.emit('answer', { sdp: pc.localDescription });
    };

    const handleAnswer = async (data: { sdp: RTCSessionDescriptionInit }) => {
      const pc = pcRef.current;
      if (!pc) return;
      await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
      // Flush any candidates that arrived before this remote description
      await flushIceCandidates(pc);
    };

    const handleIceCandidate = async (data: { candidate: RTCIceCandidateInit }) => {
      const pc = pcRef.current;
      if (!pc) return;
      // Buffer candidates that arrive before remote description is set to avoid
      // silent drops that leave the connection stuck in "connecting" state.
      if (!pc.remoteDescription) {
        iceCandidateBufferRef.current.push(data.candidate);
        return;
      }
      try {
        await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
      } catch { /* ignore stale candidates */ }
    };

    const handlePeerDisconnected = () => {
      cleanup();
      setConnectionState('disconnected');
      setSessionId(null);
      setCommonInterests([]);
      setPartnerCountry(null);
    };

    const handleBanned = (data: { reason: string }) => {
      cleanup();
      setConnectionState('idle');
      setSessionId(null);
      alert(data.reason);
    };

    socket.on('matched', handleMatched);
    socket.on('offer', handleOffer);
    socket.on('answer', handleAnswer);
    socket.on('ice-candidate', handleIceCandidate);
    socket.on('peer-disconnected', handlePeerDisconnected);
    socket.on('banned', handleBanned);

    return () => {
      socket.off('matched', handleMatched);
      socket.off('offer', handleOffer);
      socket.off('answer', handleAnswer);
      socket.off('ice-candidate', handleIceCandidate);
      socket.off('peer-disconnected', handlePeerDisconnected);
      socket.off('banned', handleBanned);
    };
  }, [socket, createPeerConnection, cleanup, flushIceCandidates]);

  // ── Mobile resilience: restart ICE when app returns from background ──────────
  // On iOS/Android the network path changes when the screen locks or the app is
  // backgrounded, causing the ICE connection to go stale. Calling restartIce()
  // on visibility:visible triggers fresh candidate gathering over the existing
  // signalling channel so the call recovers without user intervention.
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState !== 'visible') return;
      const pc = pcRef.current;
      if (!pc) return;
      const { iceConnectionState } = pc;
      if (iceConnectionState === 'disconnected' || iceConnectionState === 'failed') {
        pc.restartIce();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, []);

  // ── Admin monitoring: respond to admin's recvonly offer with local video ──────
  // Admin sends an offer (recvonly), user answers with their live stream (sendonly).
  useEffect(() => {
    if (!socket) return;

    const handleAdminStreamOffer = async (data: { sdp: RTCSessionDescriptionInit; fromSocketId: string }) => {
      const stream = localStreamRef.current;
      if (!stream) return;

      // Close any prior admin monitoring connection
      if (adminPcRef.current) {
        adminPcRef.current.close();
        adminPcRef.current = null;
      }
      adminSocketIdRef.current = data.fromSocketId; // admin's socket id

      const pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });

      pc.onicecandidate = (event) => {
        if (event.candidate && adminSocketIdRef.current) {
          socket.emit('admin-relay', {
            to: adminSocketIdRef.current,
            event: 'admin-stream-ice',
            data: { candidate: event.candidate },
          });
        }
      };

      adminPcRef.current = pc;

      try {
        // Set admin's recvonly offer as remote description
        await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
        // Add local tracks — browser will negotiate sendonly since remote is recvonly
        stream.getTracks().forEach((track) => pc.addTrack(track, stream));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socket.emit('admin-relay', {
          to: data.fromSocketId,
          event: 'admin-stream-answer',
          data: { sdp: pc.localDescription },
        });
      } catch (err) {
        console.error('[Monitor] Failed to answer admin offer:', err);
      }
    };

    const handleAdminStreamIce = async (data: { candidate: RTCIceCandidateInit }) => {
      const pc = adminPcRef.current;
      if (!pc) return;
      try {
        await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
      } catch {
        // Ignore stale candidates
      }
    };

    const handleAdminViewerLeave = () => {
      if (adminPcRef.current) {
        adminPcRef.current.close();
        adminPcRef.current = null;
      }
      adminSocketIdRef.current = null;
    };

    socket.on('admin-stream-offer', handleAdminStreamOffer);
    socket.on('admin-stream-ice', handleAdminStreamIce);
    socket.on('admin-viewer-leave', handleAdminViewerLeave);

    return () => {
      socket.off('admin-stream-offer', handleAdminStreamOffer);
      socket.off('admin-stream-ice', handleAdminStreamIce);
      socket.off('admin-viewer-leave', handleAdminViewerLeave);
    };
  }, [socket]); // localStreamRef is a ref — no dep needed

  const replaceVideoTrack = useCallback(async (newTrack: MediaStreamTrack) => {
    const pc = pcRef.current;
    if (!pc) return;
    const sender = pc.getSenders().find((s) => s.track?.kind === 'video');
    if (sender) await sender.replaceTrack(newTrack);
  }, []);

  return {
    remoteStream,
    connectionState,
    sessionId,
    commonInterests,
    partnerCountry,
    joinQueue,
    leaveQueue,
    skip,
    endChat,
    cleanup,
    replaceVideoTrack,
  };
}
