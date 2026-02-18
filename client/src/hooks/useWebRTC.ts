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

export function useWebRTC(socket: Socket | null, localStream: MediaStream | null) {
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [connectionState, setConnectionState] = useState<ConnectionState>('idle');
  const [sessionId, setSessionId] = useState<string | null>(null);

  const cleanup = useCallback(() => {
    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }
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

  const joinQueue = useCallback(() => {
    if (!socket) return;
    setConnectionState('searching');
    socket.emit('join-queue');
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
