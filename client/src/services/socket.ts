import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;

/**
 * Returns (or creates) the singleton Socket.IO connection.
 * The user JWT in localStorage is passed in the handshake auth so the server
 * can validate identity and check bans on connect.
 */
export function getSocket(): Socket {
  if (!socket) {
    const token = localStorage.getItem('user_token') ?? '';
    // In a Capacitor mobile build, VITE_API_URL is baked in at build time.
    // In web builds, fall back to window.location.origin (same-origin).
    const serverUrl = (import.meta.env.VITE_API_URL as string | undefined) || window.location.origin;
    socket = io(serverUrl, {
      autoConnect: false,
      auth: { token },
    });
  }
  return socket;
}

export function disconnectSocket(): void {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
