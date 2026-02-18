import { v4 as uuidv4 } from 'uuid';
import { Server, Socket } from 'socket.io';
import { execute } from '../db/connection.js';
import { ICE_SERVERS } from '../config.js';
import { isBanned, checkAutoban, createBan } from '../services/banService.js';
import { createReport } from '../services/reportService.js';
import type { QueueEntry, ActiveMatch } from '../types/index.js';

export class Matchmaker {
  private queue: Map<string, QueueEntry> = new Map();
  private activeMatches: Map<string, ActiveMatch> = new Map();
  // Maps socketId -> sessionId for quick lookups
  private socketToSession: Map<string, string> = new Map();
  private io: Server;

  constructor(io: Server) {
    this.io = io;
  }

  getClientIp(socket: Socket): string {
    return (
      (socket.handshake.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      socket.handshake.address
    );
  }

  addToQueue(socket: Socket): void {
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
    });

    socket.emit('queue-joined', { position: this.queue.size });
    this.attemptMatch();
  }

  removeFromQueue(socketId: string): void {
    this.queue.delete(socketId);
  }

  private attemptMatch(): void {
    if (this.queue.size < 2) return;

    const entries = Array.from(this.queue.entries());
    const [idA, entryA] = entries[0];
    const [idB, entryB] = entries[1];

    this.queue.delete(idA);
    this.queue.delete(idB);

    const sessionId = uuidv4();

    // Create session in DB
    execute('INSERT INTO sessions (id, user_a_id, user_b_id) VALUES (?, ?, ?)', [sessionId, idA, idB]);

    const match: ActiveMatch = {
      sessionId,
      socketA: idA,
      socketB: idB,
    };

    this.activeMatches.set(sessionId, match);
    this.socketToSession.set(idA, sessionId);
    this.socketToSession.set(idB, sessionId);

    // Notify both users
    this.io.to(idA).emit('matched', {
      sessionId,
      isInitiator: true,
      iceServers: ICE_SERVERS,
    });

    this.io.to(idB).emit('matched', {
      sessionId,
      isInitiator: false,
      iceServers: ICE_SERVERS,
    });
  }

  skip(socketId: string): void {
    const sessionId = this.socketToSession.get(socketId);
    if (!sessionId) return;

    const match = this.activeMatches.get(sessionId);
    if (!match) return;

    const peerId = match.socketA === socketId ? match.socketB : match.socketA;

    this.endSession(sessionId, 'skip');

    // Re-queue both users
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
