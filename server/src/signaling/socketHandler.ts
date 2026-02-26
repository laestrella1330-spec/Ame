/**
 * Socket.IO handler.
 *
 * Authentication:
 *   Every connecting socket must supply a JWT in handshake auth:
 *     { auth: { token: '<jwt>' } }
 *   User tokens  → { type: 'user',  userId: string }
 *   Admin tokens → { type: 'admin', username: string }
 *
 * Admin monitoring:
 *   Admin sockets can call admin-monitor-room / admin-stop-monitor.
 *   Monitored rooms forward all chat messages to the admin (invisibly).
 *   Video monitoring is not available without an SFU; only metadata + chat
 *   are surfaced to the admin.
 */
import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { config } from '../config.js';
import { execute } from '../db/connection.js';
import { Matchmaker, type JoinPreferences } from './matchmaker.js';
import { getActiveUserBan } from '../services/banService.js';
import { logAudit } from '../services/auditService.js';

// ─── Schemas ──────────────────────────────────────────────────────────────────
const reportSchema = z.object({
  reason: z.enum(['inappropriate', 'harassment', 'spam', 'underage', 'other']),
  description: z.string().max(500).nullable().optional(),
});

const chatMessageSchema = z.object({
  text: z.string().min(1).max(500),
  socials: z.object({
    instagram: z.string().max(50),
    snapchat: z.string().max(50),
    twitter: z.string().max(50),
    discord: z.string().max(50),
  }).optional(),
});

const joinQueueSchema = z
  .object({
    gender: z.enum(['male', 'female', 'other', '']).optional(),
    preferredGender: z.enum(['male', 'female', 'any']).optional(),
    country: z.string().max(2).optional(),
    // Phase 2: smart match preferences
    energyLevel: z.enum(['chill', 'normal', 'hype']).optional(),
    intent: z.enum(['talk', 'play', 'flirt', 'learn']).optional(),
    // Common interests
    interests: z.array(z.string().max(30)).max(10).optional(),
  })
  .optional();

// ─── Helpers ──────────────────────────────────────────────────────────────────
function sanitizeText(text: string): string {
  return text.replace(/<[^>]*>/g, '').trim();
}

function getClientIp(socket: Socket): string {
  return (
    (socket.handshake.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
    socket.handshake.address
  );
}

// ─── Rate limiting ────────────────────────────────────────────────────────────
const ipConnectionCount = new Map<string, number>();
const MAX_CONNECTIONS_PER_IP = 3;
const socketMessageTimestamps = new Map<string, number[]>();
const MAX_MESSAGES_PER_SECOND = 5;

function isMessageRateLimited(socketId: string): boolean {
  const now = Date.now();
  const recent = (socketMessageTimestamps.get(socketId) || []).filter((t) => now - t < 1000);
  if (recent.length >= MAX_MESSAGES_PER_SECOND) return true;
  recent.push(now);
  socketMessageTimestamps.set(socketId, recent);
  return false;
}

// ─── Admin monitoring state ───────────────────────────────────────────────────
// Maps sessionId → Set of monitoring admin socket IDs
const monitoringSessions = new Map<string, Set<string>>();
// Maps adminSocketId → Set of sessionIds being monitored
const adminMonitoring = new Map<string, Set<string>>();

// ─── Active user socket tracking (for forced kick on ban) ─────────────────────
// Maps userId → Set of socket IDs currently connected
const userIdToSockets = new Map<string, Set<string>>();
let ioInstance: Server | null = null;
let matchmakerInstance: Matchmaker | null = null;

/** Returns currently active sessions from in-memory matchmaker state (authoritative). */
export function getActiveSessions(): Array<{ id: string; user_a_id: string; user_b_id: string; started_at: string }> {
  if (!matchmakerInstance) return [];
  return matchmakerInstance.getAllActiveSessions().map((m) => ({
    id: m.sessionId,
    user_a_id: m.userA,
    user_b_id: m.userB,
    started_at: (m as { startedAt?: string }).startedAt ?? new Date().toISOString(),
  }));
}

/**
 * Force-disconnect all sockets belonging to a user (called when user is banned).
 * Includes the ban reason and expiry so the client can show a proper notification.
 */
export function kickUser(userId: string, reason?: string, expiresAt?: string): void {
  const socketIds = userIdToSockets.get(userId);
  if (!socketIds || !ioInstance) return;
  const remainingDays = expiresAt
    ? Math.max(1, Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 86400000))
    : undefined;
  for (const socketId of Array.from(socketIds)) {
    const socket = ioInstance.sockets.sockets.get(socketId);
    if (socket) {
      socket.emit('banned', {
        reason: reason ?? 'Your account has been suspended.',
        expiresAt,
        remainingDays,
      });
      socket.disconnect(true);
    }
  }
}

export function setupSocketHandlers(io: Server): Matchmaker {
  ioInstance = io;
  const matchmaker = new Matchmaker(io);
  matchmakerInstance = matchmaker;

  // On startup: mark any sessions left open from a previous server run as ended.
  // The in-memory activeMatches is empty on boot, so DB-only open sessions are stale.
  execute(
    `UPDATE sessions SET ended_at = datetime('now'), end_reason = 'server_restart'
     WHERE ended_at IS NULL`,
    []
  );

  // ── Auth middleware ──────────────────────────────────────────────────────────
  io.use((socket, next) => {
    // IP connection limit
    const ip = getClientIp(socket);
    const ipCount = ipConnectionCount.get(ip) || 0;
    if (ipCount >= MAX_CONNECTIONS_PER_IP) {
      return next(new Error('Too many connections from this IP'));
    }

    // Validate JWT
    const token = socket.handshake.auth?.token as string | undefined;
    if (!token) {
      return next(new Error('Authentication required'));
    }

    let decoded: { type: string; userId?: string; username?: string };
    try {
      decoded = jwt.verify(token, config.jwtSecret) as typeof decoded;
    } catch {
      return next(new Error('Invalid token'));
    }

    if (decoded.type === 'user') {
      if (!decoded.userId) return next(new Error('Invalid token'));
      // Check if user is currently banned
      const ban = getActiveUserBan(decoded.userId);
      if (ban) {
        const remaining = Math.ceil(
          (new Date(ban.expires_at).getTime() - Date.now()) / 86400000
        );
        const err = new Error('account_banned') as Error & { data: unknown };
        err.data = { reason: ban.reason, expiresAt: ban.expires_at, remainingDays: remaining };
        return next(err);
      }
      (socket as SocketWithUser).userId = decoded.userId;
      (socket as SocketWithUser).isAdmin = false;
    } else if (decoded.type === 'admin') {
      (socket as SocketWithUser).userId = `admin:${decoded.username}`;
      (socket as SocketWithUser).isAdmin = true;
      (socket as SocketWithUser).adminUsername = decoded.username;
    } else {
      return next(new Error('Invalid token type'));
    }

    ipConnectionCount.set(ip, ipCount + 1);
    next();
  });

  // ── Connection handler ───────────────────────────────────────────────────────
  io.on('connection', (socket: Socket) => {
    const s = socket as SocketWithUser;
    const ip = getClientIp(socket);
    console.log(`Socket connected: ${socket.id} user=${s.userId} admin=${s.isAdmin}`);

    // Track user socket for ban enforcement
    if (!s.isAdmin && s.userId) {
      if (!userIdToSockets.has(s.userId)) userIdToSockets.set(s.userId, new Set());
      userIdToSockets.get(s.userId)!.add(socket.id);
    }

    // Broadcast live online count to all clients
    io.emit('online_count', io.sockets.sockets.size);

    // ── WebRTC relay for admin video monitoring (all socket types) ─────────────
    // Relays WebRTC signaling between users and admin for live video monitoring.
    // Only cross-type relay allowed (user↔admin), never user→user or admin→admin.
    socket.on('admin-relay', (data: unknown) => {
      const { to, event: relayEvent, data: payload } = data as {
        to: string;
        event: string;
        data: Record<string, unknown>;
      };
      const allowed = ['admin-stream-offer', 'admin-stream-answer', 'admin-stream-ice'];
      if (!allowed.includes(relayEvent)) return;
      const targetSocket = io.sockets.sockets.get(to);
      if (!targetSocket) return;
      // Enforce cross-type only (user↔admin)
      if ((targetSocket as SocketWithUser).isAdmin === s.isAdmin) return;
      targetSocket.emit(relayEvent, { ...payload, fromSocketId: socket.id });
    });

    // ── Admin events ───────────────────────────────────────────────────────────
    if (s.isAdmin) {
      socket.on('admin-monitor-room', (data: unknown) => {
        const sessionId = (data as { sessionId?: string })?.sessionId;
        if (!sessionId) return;

        // Verify session exists and is active
        const session = matchmaker.getActiveSession(sessionId);
        if (!session) {
          socket.emit('monitor-error', { message: 'Session not found or not active' });
          return;
        }

        // Track monitoring
        if (!monitoringSessions.has(sessionId)) monitoringSessions.set(sessionId, new Set());
        monitoringSessions.get(sessionId)!.add(socket.id);

        if (!adminMonitoring.has(socket.id)) adminMonitoring.set(socket.id, new Set());
        adminMonitoring.get(socket.id)!.add(sessionId);

        logAudit('monitor_start', s.userId, sessionId, {}, ip);
        socket.emit('monitor-started', {
          sessionId,
          userA: session.userA,
          userB: session.userB,
          socketA: session.socketA,
          socketB: session.socketB,
          startedAt: session.startedAt,
        });

        // Admin will initiate WebRTC offers directly via admin-relay after receiving monitor-started.
      });

      socket.on('admin-stop-monitor', (data: unknown) => {
        const sessionId = (data as { sessionId?: string })?.sessionId;
        if (!sessionId) return;

        // Signal both users to stop streaming to admin
        const session = matchmaker.getActiveSession(sessionId);
        if (session) {
          io.to(session.socketA).emit('admin-viewer-leave');
          io.to(session.socketB).emit('admin-viewer-leave');
        }

        monitoringSessions.get(sessionId)?.delete(socket.id);
        adminMonitoring.get(socket.id)?.delete(sessionId);
        logAudit('monitor_stop', s.userId, sessionId, {}, ip);
        socket.emit('monitor-stopped', { sessionId });
      });

      socket.on('disconnect', () => {
        // Remove from all monitoring sessions
        const sessions = adminMonitoring.get(socket.id);
        if (sessions) {
          for (const sid of sessions) {
            monitoringSessions.get(sid)?.delete(socket.id);
          }
          adminMonitoring.delete(socket.id);
        }
        decrementIpCount(ip);
      });

      return; // Admins don't join the regular chat flows
    }

    // ── Regular user events ────────────────────────────────────────────────────
    socket.on('join-queue', (data?: unknown) => {
      const parsed = joinQueueSchema.safeParse(data);
      const prefs: JoinPreferences = parsed.success && parsed.data ? parsed.data : {};
      matchmaker.addToQueue(socket, s.userId, prefs);
    });

    socket.on('leave-queue', () => {
      matchmaker.removeFromQueue(socket.id);
    });

    socket.on('offer', (data: unknown) => {
      if (!data || typeof data !== 'object' || !('sdp' in data)) return;
      const peerId = matchmaker.getPeerId(socket.id);
      if (peerId) io.to(peerId).emit('offer', { sdp: (data as { sdp: unknown }).sdp });
    });

    socket.on('answer', (data: unknown) => {
      if (!data || typeof data !== 'object' || !('sdp' in data)) return;
      const peerId = matchmaker.getPeerId(socket.id);
      if (peerId) io.to(peerId).emit('answer', { sdp: (data as { sdp: unknown }).sdp });
    });

    socket.on('ice-candidate', (data: unknown) => {
      if (!data || typeof data !== 'object' || !('candidate' in data)) return;
      const peerId = matchmaker.getPeerId(socket.id);
      if (peerId) io.to(peerId).emit('ice-candidate', { candidate: (data as { candidate: unknown }).candidate });
    });

    // Text chat — forwarded to peer AND any monitoring admins
    socket.on('chat-message', (data: unknown) => {
      if (isMessageRateLimited(socket.id)) {
        socket.emit('error', { code: 'RATE_LIMITED', message: 'Sending messages too fast.' });
        return;
      }

      const parsed = chatMessageSchema.safeParse(data);
      if (!parsed.success) {
        socket.emit('error', { code: 'INVALID_MESSAGE', message: 'Invalid message.' });
        return;
      }

      const sanitized = sanitizeText(parsed.data.text);
      if (!sanitized) return;

      const peerId = matchmaker.getPeerId(socket.id);
      if (peerId) {
        io.to(peerId).emit('chat-message', { text: sanitized, from: socket.id, socials: parsed.data.socials });
      }

      // Forward to monitoring admins (silently — users don't know)
      const sessionId = matchmaker.getSessionId(socket.id);
      if (sessionId) {
        const monitors = monitoringSessions.get(sessionId);
        if (monitors && monitors.size > 0) {
          for (const adminSocketId of monitors) {
            io.to(adminSocketId).emit('monitor-chat-message', {
              sessionId,
              fromUserId: s.userId,
              text: sanitized,
              timestamp: Date.now(),
            });
          }
        }
      }
    });

    socket.on('skip', () => { matchmaker.skip(socket.id); });
    socket.on('end-chat', () => { matchmaker.endChat(socket.id); });

    socket.on('report-user', (data: unknown) => {
      const parsed = reportSchema.safeParse(data);
      if (!parsed.success) {
        socket.emit('error', { code: 'INVALID_REPORT', message: 'Invalid report data.' });
        return;
      }
      matchmaker.reportUser(socket.id, parsed.data.reason, parsed.data.description ?? null);
    });

    socket.on('disconnect', () => {
      console.log(`Socket disconnected: ${socket.id}`);
      // Remove from userId tracking
      const sockets = userIdToSockets.get(s.userId);
      if (sockets) {
        sockets.delete(socket.id);
        if (sockets.size === 0) userIdToSockets.delete(s.userId);
      }
      matchmaker.handleDisconnect(socket.id);
      socketMessageTimestamps.delete(socket.id);
      decrementIpCount(ip);
      // Broadcast updated count after this socket leaves
      io.emit('online_count', io.sockets.sockets.size);
    });
  });

  return matchmaker;
}

function decrementIpCount(ip: string): void {
  const count = ipConnectionCount.get(ip) || 0;
  if (count <= 1) ipConnectionCount.delete(ip);
  else ipConnectionCount.set(ip, count - 1);
}

// Augment Socket type locally
interface SocketWithUser extends Socket {
  userId: string;
  isAdmin: boolean;
  adminUsername?: string;
}
