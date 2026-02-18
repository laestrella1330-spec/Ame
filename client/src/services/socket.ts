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
    socket = io(window.location.origin, {
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
