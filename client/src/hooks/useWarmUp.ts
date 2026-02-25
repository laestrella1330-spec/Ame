/**
 * useWarmUp
 *
 * Listens for 'warm-up' socket events emitted after a match.
 * Returns the current icebreaker (cleared when searching/idle).
 */
import { useState, useEffect, useRef } from 'react';
import { Socket } from 'socket.io-client';
import type { ConnectionState } from './useWebRTC';

export interface WarmUpData {
  icebreaker: string;
  topic: string;
  source: 'ai' | 'static';
}

export function useWarmUp(socket: Socket | null, connectionState: ConnectionState) {
  const [warmUp, setWarmUp] = useState<WarmUpData | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clear when no longer connected to a partner
  useEffect(() => {
    if (connectionState === 'idle' || connectionState === 'searching') {
      if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
      setWarmUp(null);
    }
  }, [connectionState]);

  useEffect(() => {
    if (!socket) return;

    const handleWarmUp = (data: WarmUpData) => {
      // Delay display by 20–30 s so users settle before seeing the suggestion
      const delay = 20000 + Math.random() * 10000;
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => { setWarmUp(data); }, delay);
    };

    socket.on('warm-up', handleWarmUp);
    return () => {
      socket.off('warm-up', handleWarmUp);
      if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
    };
  }, [socket]);

  return { warmUp, dismiss: () => setWarmUp(null) };
}
