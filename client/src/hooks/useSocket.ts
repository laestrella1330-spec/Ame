import { useEffect, useRef, useState } from 'react';
import { Socket } from 'socket.io-client';
import { useNavigate } from 'react-router-dom';
import { getSocket, disconnectSocket } from '../services/socket';
import { useAuth } from '../context/AuthContext';

export function useSocket() {
  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const navigate = useNavigate();
  const { logout } = useAuth();

  useEffect(() => {
    const socket = getSocket();
    socketRef.current = socket;

    socket.on('connect', () => setIsConnected(true));
    socket.on('disconnect', () => setIsConnected(false));

    // Server force-banned this user mid-session
    socket.on('banned', (data?: { reason?: string; expiresAt?: string; remainingDays?: number }) => {
      if (data?.reason) {
        sessionStorage.setItem('banned_reason', data.reason);
        sessionStorage.setItem('banned_days', String(data.remainingDays ?? 0));
      }
      disconnectSocket();
      logout();
      navigate('/login', { replace: true });
    });

    // Server rejected connection because user is banned (socket handshake)
    socket.on('connect_error', (err: Error & { data?: { reason?: string; remainingDays?: number } }) => {
      if (err.message === 'account_banned') {
        const d = err.data;
        if (d?.reason) {
          sessionStorage.setItem('banned_reason', d.reason);
          sessionStorage.setItem('banned_days', String(d.remainingDays ?? 0));
        }
        logout();
        navigate('/login', { replace: true });
      }
    });

    if (!socket.connected) {
      socket.connect();
    } else {
      setIsConnected(true);
    }

    return () => {
      socket.off('connect');
      socket.off('disconnect');
      socket.off('banned');
      socket.off('connect_error');
    };
  }, [navigate, logout]);

  return { socket: socketRef.current, isConnected };
}
