import { Server, Socket } from 'socket.io';
import { z } from 'zod';
import { Matchmaker, type JoinPreferences } from './matchmaker.js';

const reportSchema = z.object({
  reason: z.enum(['inappropriate', 'harassment', 'spam', 'underage', 'other']),
  description: z.string().max(500).nullable().optional(),
});

const chatMessageSchema = z.object({
  text: z.string().min(1).max(500),
});

const joinQueueSchema = z.object({
  gender: z.enum(['male', 'female', 'other', '']).optional(),
  preferredGender: z.enum(['male', 'female', 'any']).optional(),
  country: z.string().max(2).optional(),
}).optional();

// Strip HTML tags to prevent XSS
function sanitizeText(text: string): string {
  return text.replace(/<[^>]*>/g, '').trim();
}

// Per-IP connection tracking
const ipConnectionCount = new Map<string, number>();
const MAX_CONNECTIONS_PER_IP = 3;

// Per-socket chat rate limiting
const socketMessageTimestamps = new Map<string, number[]>();
const MAX_MESSAGES_PER_SECOND = 5;

function isMessageRateLimited(socketId: string): boolean {
  const now = Date.now();
  const timestamps = socketMessageTimestamps.get(socketId) || [];
  // Keep only timestamps from the last second
  const recent = timestamps.filter((t) => now - t < 1000);
  if (recent.length >= MAX_MESSAGES_PER_SECOND) {
    return true;
  }
  recent.push(now);
  socketMessageTimestamps.set(socketId, recent);
  return false;
}

function getClientIp(socket: Socket): string {
  return (
    (socket.handshake.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
    socket.handshake.address
  );
}

export function setupSocketHandlers(io: Server): Matchmaker {
  const matchmaker = new Matchmaker(io);

  // Per-IP connection limit middleware
  io.use((socket, next) => {
    const ip = getClientIp(socket);
    const count = ipConnectionCount.get(ip) || 0;
    if (count >= MAX_CONNECTIONS_PER_IP) {
      return next(new Error('Too many connections from this IP'));
    }
    ipConnectionCount.set(ip, count + 1);
    next();
  });

  io.on('connection', (socket: Socket) => {
    const ip = getClientIp(socket);
    console.log(`User connected: ${socket.id} (${ip})`);

    socket.on('join-queue', (data?: unknown) => {
      const parsed = joinQueueSchema.safeParse(data);
      const prefs: JoinPreferences = parsed.success && parsed.data ? parsed.data : {};
      matchmaker.addToQueue(socket, prefs);
    });

    socket.on('leave-queue', () => {
      matchmaker.removeFromQueue(socket.id);
    });

    // WebRTC signaling - forward to peer (with basic validation)
    socket.on('offer', (data: unknown) => {
      if (!data || typeof data !== 'object' || !('sdp' in data)) return;
      const peerId = matchmaker.getPeerId(socket.id);
      if (peerId) {
        io.to(peerId).emit('offer', { sdp: (data as { sdp: unknown }).sdp });
      }
    });

    socket.on('answer', (data: unknown) => {
      if (!data || typeof data !== 'object' || !('sdp' in data)) return;
      const peerId = matchmaker.getPeerId(socket.id);
      if (peerId) {
        io.to(peerId).emit('answer', { sdp: (data as { sdp: unknown }).sdp });
      }
    });

    socket.on('ice-candidate', (data: unknown) => {
      if (!data || typeof data !== 'object' || !('candidate' in data)) return;
      const peerId = matchmaker.getPeerId(socket.id);
      if (peerId) {
        io.to(peerId).emit('ice-candidate', { candidate: (data as { candidate: unknown }).candidate });
      }
    });

    // Text chat — ephemeral, forwarded to peer only
    socket.on('chat-message', (data: unknown) => {
      // Rate limit
      if (isMessageRateLimited(socket.id)) {
        socket.emit('error', { code: 'RATE_LIMITED', message: 'Sending messages too fast.' });
        return;
      }

      // Validate
      const parsed = chatMessageSchema.safeParse(data);
      if (!parsed.success) {
        socket.emit('error', { code: 'INVALID_MESSAGE', message: 'Invalid message.' });
        return;
      }

      // Sanitize and forward
      const sanitized = sanitizeText(parsed.data.text);
      if (!sanitized) return;

      const peerId = matchmaker.getPeerId(socket.id);
      if (peerId) {
        io.to(peerId).emit('chat-message', { text: sanitized, from: socket.id });
      }
    });

    socket.on('skip', () => {
      matchmaker.skip(socket.id);
    });

    socket.on('end-chat', () => {
      matchmaker.endChat(socket.id);
    });

    socket.on('report-user', (data: unknown) => {
      const parsed = reportSchema.safeParse(data);
      if (!parsed.success) {
        socket.emit('error', { code: 'INVALID_REPORT', message: 'Invalid report data.' });
        return;
      }
      matchmaker.reportUser(socket.id, parsed.data.reason, parsed.data.description ?? null);
    });

    socket.on('disconnect', () => {
      console.log(`User disconnected: ${socket.id}`);
      matchmaker.handleDisconnect(socket.id);

      // Clean up rate limit tracking
      socketMessageTimestamps.delete(socket.id);

      // Decrement IP connection count
      const count = ipConnectionCount.get(ip) || 0;
      if (count <= 1) {
        ipConnectionCount.delete(ip);
      } else {
        ipConnectionCount.set(ip, count - 1);
      }
    });
  });

  return matchmaker;
}
