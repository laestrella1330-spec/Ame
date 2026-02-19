/**
 * useWarmUp
 *
 * Listens for 'warm-up' socket events emitted after a match.
 * Returns the current icebreaker (cleared when searching/idle).
 */
import { useState, useEffect } from 'react';
import { Socket } from 'socket.io-client';
import type { ConnectionState } from './useWebRTC';

export interface WarmUpData {
  icebreaker: string;
  topic: string;
  source: 'ai' | 'static';
}

export function useWarmUp(socket: Socket | null, connectionState: ConnectionState) {
  const [warmUp, setWarmUp] = useState<WarmUpData | null>(null);

  // Clear when no longer connected to a partner
  useEffect(() => {
    if (connectionState === 'idle' || connectionState === 'searching') {
      setWarmUp(null);
    }
  }, [connectionState]);

  useEffect(() => {
    if (!socket) return;

    const handleWarmUp = (data: WarmUpData) => {
      setWarmUp(data);
    };

    socket.on('warm-up', handleWarmUp);
    return () => { socket.off('warm-up', handleWarmUp); };
  }, [socket]);

  return { warmUp, dismiss: () => setWarmUp(null) };
}
