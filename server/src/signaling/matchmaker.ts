import { v4 as uuidv4 } from 'uuid';
import { Server, Socket } from 'socket.io';
import { execute } from '../db/connection.js';
import { ICE_SERVERS } from '../config.js';
import { isBanned, checkAutoban, createBan } from '../services/banService.js';
import { createReport } from '../services/reportService.js';
import type { QueueEntry, ActiveMatch } from '../types/index.js';

export interface JoinPreferences {
  gender?: string;
  preferredGender?: string;
  country?: string;
}

export class Matchmaker {
  private queue: Map<string, QueueEntry> = new Map();
  private activeMatches: Map<string, ActiveMatch> = new Map();
  // Maps socketId -> sessionId for quick lookups
  private socketToSession: Map<string, string> = new Map();
  private io: Server;
  private matchRetryInterval: ReturnType<typeof setInterval> | null = null;

  constructor(io: Server) {
    this.io = io;
    // Periodically retry matching for users whose filters couldn't be satisfied immediately
    this.matchRetryInterval = setInterval(() => {
      if (this.queue.size >= 2) {
        this.attemptMatch();
      }
    }, 5000);
  }

  getClientIp(socket: Socket): string {
    return (
      (socket.handshake.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      socket.handshake.address
    );
  }

  addToQueue(socket: Socket, prefs?: JoinPreferences): void {
    const ip = this.getClientIp(socket);

    if (isBanned(ip)) {
      socket.emit('banned', { reason: 'You have been banned from the platform.' });
      return;
    }

    // Remove from any existing session first
    this.removeFromSession(socket.id, 'requeue');

    this.queue.set(socket.id, {
      socketId: socket.id,
      ip,
      joinedAt: new Date(),
      gender: prefs?.gender,
      preferredGender: prefs?.preferredGender,
      country: prefs?.country,
    });

    socket.emit('queue-joined', { position: this.queue.size });
    this.attemptMatch();
  }

  removeFromQueue(socketId: string): void {
    this.queue.delete(socketId);
  }

  private isCompatible(a: QueueEntry, b: QueueEntry): boolean {
    // Gender preference: if A wants a specific gender, B must match it (and vice versa)
    if (
      a.preferredGender &&
      a.preferredGender !== 'any' &&
      b.gender &&
      b.gender !== a.preferredGender
    ) {
      return false;
    }
    if (
      b.preferredGender &&
      b.preferredGender !== 'any' &&
      a.gender &&
      a.gender !== b.preferredGender
    ) {
      return false;
    }
    return true;
  }

  private compatibilityScore(a: QueueEntry, b: QueueEntry): number {
    let score = 0;
    // Same country = bonus
    if (a.country && b.country && a.country === b.country) {
      score += 2;
    }
    // Gender preferences satisfied = bonus
    if (
      (!a.preferredGender || a.preferredGender === 'any' || a.preferredGender === b.gender)
    ) {
      score += 1;
    }
    if (
      (!b.preferredGender || b.preferredGender === 'any' || b.preferredGender === a.gender)
    ) {
      score += 1;
    }
    return score;
  }

  private attemptMatch(): void {
    if (this.queue.size < 2) return;

    const entries = Array.from(this.queue.values());
    const now = Date.now();

    // Start from the longest-waiting user
    const entryA = entries[0];
    const waitMs = now - entryA.joinedAt.getTime();
    const forceMatch = waitMs > 15000; // After 15s, match anyone

    let bestMatch: QueueEntry | null = null;
    let bestScore = -Infinity;

    for (let i = 1; i < entries.length; i++) {
      const candidate = entries[i];
      if (!forceMatch && !this.isCompatible(entryA, candidate)) continue;
      const score = this.compatibilityScore(entryA, candidate);
      if (score > bestScore) {
        bestScore = score;
        bestMatch = candidate;
      }
    }

    if (bestMatch) {
      this.createMatch(entryA, bestMatch);
      // Recursively try to match remaining users
      this.attemptMatch();
    }
  }

  private createMatch(entryA: QueueEntry, entryB: QueueEntry): void {
    this.queue.delete(entryA.socketId);
    this.queue.delete(entryB.socketId);

    const sessionId = uuidv4();

    // Create session in DB
    execute('INSERT INTO sessions (id, user_a_id, user_b_id) VALUES (?, ?, ?)', [
      sessionId,
      entryA.socketId,
      entryB.socketId,
    ]);

    const match: ActiveMatch = {
      sessionId,
      socketA: entryA.socketId,
      socketB: entryB.socketId,
    };

    this.activeMatches.set(sessionId, match);
    this.socketToSession.set(entryA.socketId, sessionId);
    this.socketToSession.set(entryB.socketId, sessionId);

    // Notify both users (include partner's country so client can display flag)
    this.io.to(entryA.socketId).emit('matched', {
      sessionId,
      isInitiator: true,
      iceServers: ICE_SERVERS,
      partnerCountry: entryB.country || null,
      partnerGender: entryB.gender || null,
    });

    this.io.to(entryB.socketId).emit('matched', {
      sessionId,
      isInitiator: false,
      iceServers: ICE_SERVERS,
      partnerCountry: entryA.country || null,
      partnerGender: entryA.gender || null,
    });
  }

  skip(socketId: string): void {
    const sessionId = this.socketToSession.get(socketId);
    if (!sessionId) return;

    const match = this.activeMatches.get(sessionId);
    if (!match) return;

    const peerId = match.socketA === socketId ? match.socketB : match.socketA;

    this.endSession(sessionId, 'skip');

    // Re-queue both users (preserve their preferences)
    const socketA = this.io.sockets.sockets.get(socketId);
    const socketB = this.io.sockets.sockets.get(peerId);

    if (socketA) this.addToQueue(socketA);
    if (socketB) this.addToQueue(socketB);
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

  reportUser(
    reporterSocketId: string,
    reason: string,
    description: string | null
  ): void {
    const sessionId = this.socketToSession.get(reporterSocketId);
    if (!sessionId) return;

    const match = this.activeMatches.get(sessionId);
    if (!match) return;

    const reportedId =
      match.socketA === reporterSocketId ? match.socketB : match.socketA;

    createReport(sessionId, reporterSocketId, reportedId, reason, description);

    // Check autoban
    if (checkAutoban(reportedId)) {
      const reportedSocket = this.io.sockets.sockets.get(reportedId);
      if (reportedSocket) {
        const ip = this.getClientIp(reportedSocket);
        createBan(ip, 'ip', 'Auto-ban: multiple reports', null, 'system');
        reportedSocket.emit('banned', {
          reason: 'You have been banned due to multiple reports.',
        });
        reportedSocket.disconnect();
      }
    }

    this.io.to(reporterSocketId).emit('report-confirmed', {
      message: 'Report submitted. Thank you for helping keep the community safe.',
    });
  }

  getPeerId(socketId: string): string | null {
    const sessionId = this.socketToSession.get(socketId);
    if (!sessionId) return null;
    const match = this.activeMatches.get(sessionId);
    if (!match) return null;
    return match.socketA === socketId ? match.socketB : match.socketA;
  }

  private endSession(sessionId: string, reason: string): void {
    const match = this.activeMatches.get(sessionId);
    if (!match) return;

    execute(
      `UPDATE sessions SET ended_at = datetime('now'), end_reason = ?, duration_seconds = CAST((julianday('now') - julianday(started_at)) * 86400 AS INTEGER) WHERE id = ?`,
      [reason, sessionId]
    );

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
