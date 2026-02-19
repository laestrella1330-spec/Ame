import { useState, useCallback, useEffect } from 'react';
import { Socket } from 'socket.io-client';
import type { ConnectionState } from './useWebRTC';

export interface ChatMessage {
  id: string;
  text: string;
  isSelf: boolean;
  timestamp: number;
  type?: 'text' | 'socials-card';
  socials?: Record<string, string>;
}

const MAX_MESSAGES = 100;

export function useChat(socket: Socket | null, connectionState: ConnectionState) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  // Clear messages when connection changes (new partner or disconnect)
  useEffect(() => {
    if (connectionState === 'searching' || connectionState === 'idle' || connectionState === 'connecting') {
      setMessages([]);
    }
  }, [connectionState]);

  // Listen for incoming messages
  useEffect(() => {
    if (!socket) return;

    const handleMessage = (data: { text: string; from: string; socials?: Record<string, string> }) => {
      setMessages((prev) => {
        const next = [...prev, {
          id: `${Date.now()}-${Math.random()}`,
          text: data.text,
          isSelf: false,
          timestamp: Date.now(),
          type: data.socials ? 'socials-card' as const : 'text' as const,
          socials: data.socials,
        }];
        return next.length > MAX_MESSAGES ? next.slice(-MAX_MESSAGES) : next;
      });
    };

    socket.on('chat-message', handleMessage);
    return () => {
      socket.off('chat-message', handleMessage);
    };
  }, [socket]);

  const sendMessage = useCallback((text: string, socials?: Record<string, string>) => {
    if (!socket || connectionState !== 'connected') return;

    if (socials) {
      socket.emit('chat-message', { text: '📋 Shared social profiles', socials });
      setMessages((prev) => {
        const next = [...prev, {
          id: `${Date.now()}-${Math.random()}`,
          text: '📋 Shared social profiles',
          isSelf: true,
          timestamp: Date.now(),
          type: 'socials-card' as const,
          socials,
        }];
        return next.length > MAX_MESSAGES ? next.slice(-MAX_MESSAGES) : next;
      });
      return;
    }

    if (!text.trim()) return;
    const trimmed = text.trim().slice(0, 500);
    socket.emit('chat-message', { text: trimmed });

    setMessages((prev) => {
      const next = [...prev, {
        id: `${Date.now()}-${Math.random()}`,
        text: trimmed,
        isSelf: true,
        timestamp: Date.now(),
        type: 'text' as const,
      }];
      return next.length > MAX_MESSAGES ? next.slice(-MAX_MESSAGES) : next;
    });
  }, [socket, connectionState]);

  return { messages, sendMessage };
}
