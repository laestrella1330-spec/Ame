import { v4 as uuidv4 } from 'uuid';
import { Server, Socket } from 'socket.io';
import { execute } from '../db/connection.js';
import { ICE_SERVERS, config } from '../config.js';
import { isBanned, checkAutoban, createUserBan, getActiveUserBan } from '../services/banService.js';
import { createReport } from '../services/reportService.js';
import { isBlockedEither, createBlock } from '../services/blockService.js';
import { logAudit } from '../services/auditService.js';
import type { QueueEntry, ActiveMatch } from '../types/index.js';
// NOTE: do NOT import from socketHandler.ts — that would create a circular dependency.
// Any kick needed inside the matchmaker is done directly via this.io using the known socket ID.
import { generateWarmUp } from '../agents/warmupAgent.js';
import { matchBiasScore } from '../agents/matchBiasAgent.js';

export interface JoinPreferences {
  gender?: string;
  preferredGender?: string;
  country?: string;
  // Phase 2 soft preferences
  energyLevel?: 'chill' | 'normal' | 'hype';
  intent?: 'talk' | 'play' | 'flirt' | 'learn';
  // Common interests
  interests?: string[];
}

export class Matchmaker {
  private queue: Map<string, QueueEntry> = new Map();
  private activeMatches: Map<string, ActiveMatch> = new Map();
  private socketToSession: Map<string, string> = new Map();
  private io: Server;
  private matchRetryInterval: ReturnType<typeof setInterval> | null = null;

  constructor(io: Server) {
    this.io = io;
    // Periodically retry for users whose filters haven't been satisfied
    this.matchRetryInterval = setInterval(() => {
      if (this.queue.size >= 2) this.attemptMatch();
    }, 5000);
  }

  getClientIp(socket: Socket): string {
    return (
      (socket.handshake.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      socket.handshake.address
    );
  }

  addToQueue(socket: Socket, userId: string, prefs?: JoinPreferences): void {
    const ip = this.getClientIp(socket);

    if (isBanned(ip)) {
      socket.emit('banned', { reason: 'You have been banned from the platform.' });
      return;
    }

    const userBan = getActiveUserBan(userId);
    if (userBan) {
      const remainingDays = Math.max(1, Math.ceil(
        (new Date(userBan.expires_at).getTime() - Date.now()) / 86400000
      ));
      socket.emit('banned', {
        reason: userBan.reason ?? 'Violation of Terms of Service',
        expiresAt: userBan.expires_at,
        remainingDays,
      });
      setTimeout(() => socket.disconnect(true), 300);
      return;
    }

    this.removeFromSession(socket.id, 'requeue');

    this.queue.set(socket.id, {
      socketId: socket.id,
      ip,
      userId,
      joinedAt: new Date(),
      gender: prefs?.gender,
      preferredGender: prefs?.preferredGender,
      country: prefs?.country,
      energyLevel: prefs?.energyLevel,
      intent: prefs?.intent,
      interests: prefs?.interests,
    });

    logAudit('queue_join', userId, null, { ip });
    socket.emit('queue-joined', { position: this.queue.size });
    this.attemptMatch();
  }

  removeFromQueue(socketId: string): void {
    this.queue.delete(socketId);
  }

  private isCompatible(a: QueueEntry, b: QueueEntry): boolean {
    // Never match users who have blocked each other
    if (isBlockedEither(a.userId, b.userId)) return false;
    if (
      a.preferredGender && a.preferredGender !== 'any' &&
      b.gender && b.gender !== a.preferredGender
    ) return false;
    if (
      b.preferredGender && b.preferredGender !== 'any' &&
      a.gender && a.gender !== b.preferredGender
    ) return false;
    return true;
  }

  private compatibilityScore(a: QueueEntry, b: QueueEntry): number {
    let score = 0;
    if (a.country && b.country && a.country === b.country) score += 2;
    if (!a.preferredGender || a.preferredGender === 'any' || a.preferredGender === b.gender) score += 1;
    if (!b.preferredGender || b.preferredGender === 'any' || b.preferredGender === a.gender) score += 1;
    // Phase 2: smart match bias (only when feature is enabled)
    if (config.features.smartMatch) {
      score += matchBiasScore(
        { energyLevel: a.energyLevel, intent: a.intent },
        { energyLevel: b.energyLevel, intent: b.intent },
      );
    }
    // Common interests bonus (+1 per shared interest, max +5)
    if (a.interests?.length && b.interests?.length) {
      const bSet = new Set(b.interests.map((i) => i.toLowerCase()));
      const shared = a.interests.filter((i) => bSet.has(i.toLowerCase()));
      score += Math.min(shared.length, 5);
    }
    return score;
  }

  private attemptMatch(): void {
    if (this.queue.size < 2) return;

    const entries = Array.from(this.queue.values());
    const now = Date.now();
    const entryA = entries[0];
    const forceMatch = now - entryA.joinedAt.getTime() > 15000;

    let bestMatch: QueueEntry | null = null;
    let bestScore = -Infinity;

    for (let i = 1; i < entries.length; i++) {
      const candidate = entries[i];
      // Don't match a user with themselves across tabs
      if (candidate.userId === entryA.userId) continue;
      if (!forceMatch && !this.isCompatible(entryA, candidate)) continue;
      const score = this.compatibilityScore(entryA, candidate);
      if (score > bestScore) { bestScore = score; bestMatch = candidate; }
    }

    if (bestMatch) {
      this.createMatch(entryA, bestMatch);
      this.attemptMatch();
    }
  }

  private createMatch(entryA: QueueEntry, entryB: QueueEntry): void {
    this.queue.delete(entryA.socketId);
    this.queue.delete(entryB.socketId);

    const sessionId = uuidv4();
    execute('INSERT INTO sessions (id, user_a_id, user_b_id) VALUES (?, ?, ?)', [
      sessionId, entryA.userId, entryB.userId,
    ]);
    logAudit('room_create', null, sessionId, { userA: entryA.userId, userB: entryB.userId });

    const match: ActiveMatch = {
      sessionId,
      socketA: entryA.socketId,
      socketB: entryB.socketId,
      userA: entryA.userId,
      userB: entryB.userId,
    };

    // Store startedAt for admin monitoring info
    (match as ActiveMatchInternal).startedAt = new Date().toISOString();

    this.activeMatches.set(sessionId, match);
    this.socketToSession.set(entryA.socketId, sessionId);
    this.socketToSession.set(entryB.socketId, sessionId);

    // Compute common interests
    const commonInterests: string[] = [];
    if (entryA.interests?.length && entryB.interests?.length) {
      const bSet = new Set(entryB.interests.map((i) => i.toLowerCase()));
      entryA.interests.forEach((i) => { if (bSet.has(i.toLowerCase())) commonInterests.push(i.toLowerCase()); });
    }

    this.io.to(entryA.socketId).emit('matched', {
      sessionId, isInitiator: true, iceServers: ICE_SERVERS,
      partnerCountry: entryB.country || null,
      partnerGender: entryB.gender || null,
      commonInterests,
    });
    this.io.to(entryB.socketId).emit('matched', {
      sessionId, isInitiator: false, iceServers: ICE_SERVERS,
      partnerCountry: entryA.country || null,
      partnerGender: entryA.gender || null,
      commonInterests,
    });

    // Phase 1: AI warm-up — fire async, do not block match
    if (config.features.aiWarmup) {
      generateWarmUp().then((warmup) => {
        this.io.to(entryA.socketId).emit('warm-up', warmup);
        this.io.to(entryB.socketId).emit('warm-up', warmup);
        execute(
          `INSERT INTO session_ai_events (session_id, event_type, payload) VALUES (?, 'warmup_sent', ?)`,
          [sessionId, JSON.stringify(warmup)],
        );
      }).catch(() => { /* silent — warmup is optional */ });
    }
  }

  skip(socketId: string): void {
    const sessionId = this.socketToSession.get(socketId);
    if (!sessionId) return;
    const match = this.activeMatches.get(sessionId);
    if (!match) return;
    const peerId = match.socketA === socketId ? match.socketB : match.socketA;
    this.endSession(sessionId, 'skip');
    const socketA = this.io.sockets.sockets.get(socketId);
    const socketB = this.io.sockets.sockets.get(peerId);
    // Re-queue — preserve preferences by re-using addToQueue with existing socket data
    if (socketA) {
      const entry = { userId: match.socketA === socketId ? match.userA : match.userB };
      this.addToQueue(socketA, entry.userId);
    }
    if (socketB) {
      const entry = { userId: match.socketA === socketId ? match.userB : match.userA };
      this.addToQueue(socketB, entry.userId);
    }
  }

  endChat(socketId: string): void {
    const sessionId = this.socketToSession.get(socketId);
    if (!sessionId) return;
    const match = this.activeMatches.get(sessionId);
    if (!match) return;
    const peerId = match.socketA === socketId ? match.socketB : match.socketA;
    this.endSession(sessionId, 'end');
    this.io.to(peerId).emit('peer-disconnected', { reason: 'Partner ended the chat.' });
  }

  handleDisconnect(socketId: string): void {
    this.removeFromQueue(socketId);
    const sessionId = this.socketToSession.get(socketId);
    if (!sessionId) return;
    const match = this.activeMatches.get(sessionId);
    if (!match) return;
    const peerId = match.socketA === socketId ? match.socketB : match.socketA;
    this.endSession(sessionId, 'disconnect');
    this.io.to(peerId).emit('peer-disconnected', { reason: 'Partner disconnected.' });
  }

  reportUser(reporterSocketId: string, reason: string, description: string | null): void {
    const sessionId = this.socketToSession.get(reporterSocketId);
    if (!sessionId) return;
    const match = this.activeMatches.get(sessionId);
    if (!match) return;

    // Use actual user IDs (not socket IDs) so reports accumulate across reconnections
    const reporterUserId = match.socketA === reporterSocketId ? match.userA : match.userB;
    const reportedUserId = match.socketA === reporterSocketId ? match.userB : match.userA;
    const reportedSocketId = match.socketA === reporterSocketId ? match.socketB : match.socketA;

    createReport(sessionId, reporterUserId, reportedUserId, reason, description);

    // Auto-ban: 3+ reports in the last hour triggers a progressive user ban
    if (checkAutoban(reportedUserId)) {
      const ban = createUserBan(reportedUserId, 'Auto-banned: multiple reports within 1 hour', 'system');
      const reportedSocket = this.io.sockets.sockets.get(reportedSocketId);
      if (reportedSocket) {
        const remainingDays = Math.max(1, Math.ceil(
          (new Date(ban.expires_at).getTime() - Date.now()) / 86400000
        ));
        reportedSocket.emit('banned', {
          reason: 'Auto-banned: multiple reports received.',
          expiresAt: ban.expires_at,
          remainingDays,
        });
        setTimeout(() => reportedSocket.disconnect(true), 300);
      }
    }

    this.io.to(reporterSocketId).emit('report-confirmed', {
      message: 'Report submitted. Thank you for helping keep the community safe.',
    });
  }

  /**
   * Block the reported user so they are never matched again.
   * Called when a user emits the 'block-user' socket event.
   */
  blockUser(blockerSocketId: string): void {
    const sessionId = this.socketToSession.get(blockerSocketId);
    if (!sessionId) return;
    const match = this.activeMatches.get(sessionId);
    if (!match) return;

    const blockerUserId = match.socketA === blockerSocketId ? match.userA : match.userB;
    const blockedUserId = match.socketA === blockerSocketId ? match.userB : match.userA;

    createBlock(blockerUserId, blockedUserId);

    this.io.to(blockerSocketId).emit('block-confirmed', {
      message: 'User blocked. You will not be matched with them again.',
    });
  }

  getPeerId(socketId: string): string | null {
    const sessionId = this.socketToSession.get(socketId);
    if (!sessionId) return null;
    const match = this.activeMatches.get(sessionId);
    if (!match) return null;
    return match.socketA === socketId ? match.socketB : match.socketA;
  }

  getSessionId(socketId: string): string | null {
    return this.socketToSession.get(socketId) ?? null;
  }

  /** Returns active session info for admin monitoring. */
  getActiveSession(sessionId: string): (ActiveMatch & { startedAt: string }) | null {
    const m = this.activeMatches.get(sessionId);
    if (!m) return null;
    return m as ActiveMatch & { startedAt: string };
  }

  /** Returns all active sessions (for admin dashboard). */
  getAllActiveSessions(): Array<ActiveMatch & { startedAt: string }> {
    return Array.from(this.activeMatches.values()) as Array<ActiveMatch & { startedAt: string }>;
  }

  private endSession(sessionId: string, reason: string): void {
    const match = this.activeMatches.get(sessionId);
    if (!match) return;
    execute(
      `UPDATE sessions SET ended_at = datetime('now'), end_reason = ?,
       duration_seconds = CAST((julianday('now') - julianday(started_at)) * 86400 AS INTEGER)
       WHERE id = ?`,
      [reason, sessionId]
    );
    logAudit('room_end', null, sessionId, { reason });
    this.socketToSession.delete(match.socketA);
    this.socketToSession.delete(match.socketB);
    this.activeMatches.delete(sessionId);
  }

  private removeFromSession(socketId: string, reason: string): void {
    const sessionId = this.socketToSession.get(socketId);
    if (sessionId) {
      const match = this.activeMatches.get(sessionId);
      if (match) {
        const peerId = match.socketA === socketId ? match.socketB : match.socketA;
        this.endSession(sessionId, reason);
        this.io.to(peerId).emit('peer-disconnected', { reason: 'Partner left.' });
      }
    }
  }

  getStats() {
    return {
      queueSize: this.queue.size,
      activeMatches: this.activeMatches.size,
      activeUsers: this.queue.size + this.activeMatches.size * 2,
    };
  }
}

// Internal extension for startedAt timestamp
interface ActiveMatchInternal extends ActiveMatch {
  startedAt: string;
}
