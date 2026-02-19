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
}

export type ConnectionState = 'idle' | 'searching' | 'connecting' | 'connected' | 'disconnected';

export interface JoinPrefs {
  gender?: string;
  preferredGender?: string;
  country?: string;
}

export function useWebRTC(socket: Socket | null, localStream: MediaStream | null) {
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [connectionState, setConnectionState] = useState<ConnectionState>('idle');
  const [sessionId, setSessionId] = useState<string | null>(null);

  // Shadow peer connection for admin monitoring (one-way: user→admin)
  const adminPcRef = useRef<RTCPeerConnection | null>(null);
  const adminSocketIdRef = useRef<string | null>(null);
  // Keep a ref so admin event handlers always see the latest localStream
  const localStreamRef = useRef<MediaStream | null>(localStream);
  useEffect(() => { localStreamRef.current = localStream; }, [localStream]);

  const cleanup = useCallback(() => {
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

      const pc = new RTCPeerConnection({ iceServers });

      pc.onicecandidate = (event) => {
        if (event.candidate && socket) {
          socket.emit('ice-candidate', { candidate: event.candidate });
        }
      };

      pc.ontrack = (event) => {
        setRemoteStream(event.streams[0]);
        setConnectionState('connected');
      };

      pc.onconnectionstatechange = () => {
        if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
          setConnectionState('disconnected');
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
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      socket.emit('answer', { sdp: pc.localDescription });
    };

    const handleAnswer = async (data: { sdp: RTCSessionDescriptionInit }) => {
      const pc = pcRef.current;
      if (!pc) return;
      await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
    };

    const handleIceCandidate = async (data: { candidate: RTCIceCandidateInit }) => {
      const pc = pcRef.current;
      if (!pc) return;
      try {
        await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
      } catch {
        // Candidate may arrive before remote description is set
      }
    };

    const handlePeerDisconnected = () => {
      cleanup();
      setConnectionState('disconnected');
      setSessionId(null);
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
  }, [socket, createPeerConnection, cleanup]);

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

  return {
    remoteStream,
    connectionState,
    sessionId,
    joinQueue,
    leaveQueue,
    skip,
    endChat,
    cleanup,
  };
}
