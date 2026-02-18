import { queryOne, queryAll, execute, lastInsertRowId } from '../db/connection.js';
import type { Ban } from '../types/index.js';

export function isBanned(identifier: string): boolean {
  const ban = queryOne<Ban>(
    `SELECT id FROM bans WHERE identifier = ? AND (expires_at IS NULL OR expires_at > datetime('now'))`,
    [identifier]
  );
  return !!ban;
}

export function createBan(
  identifier: string,
  identifierType: 'ip' | 'fingerprint',
  reason: string | null,
  expiresAt: string | null,
  bannedBy: string
): Ban {
  execute(
    'INSERT INTO bans (identifier, identifier_type, reason, expires_at, banned_by) VALUES (?, ?, ?, ?, ?)',
    [identifier, identifierType, reason, expiresAt, bannedBy]
  );
  const id = lastInsertRowId();
  return queryOne<Ban>('SELECT * FROM bans WHERE id = ?', [id])!;
}

export function listBans(page: number = 1, limit: number = 20): { bans: Ban[]; total: number } {
  const offset = (page - 1) * limit;
  const bans = queryAll<Ban>(
    `SELECT * FROM bans WHERE expires_at IS NULL OR expires_at > datetime('now') ORDER BY banned_at DESC LIMIT ? OFFSET ?`,
    [limit, offset]
  );
  const result = queryOne<{ count: number }>(
    `SELECT COUNT(*) as count FROM bans WHERE expires_at IS NULL OR expires_at > datetime('now')`
  );
  return { bans, total: result?.count ?? 0 };
}

export function removeBan(id: number): boolean {
  const before = queryOne<Ban>('SELECT * FROM bans WHERE id = ?', [id]);
  if (!before) return false;
  execute('DELETE FROM bans WHERE id = ?', [id]);
  return true;
}

export function checkAutoban(reportedId: string): boolean {
  const result = queryOne<{ count: number }>(
    `SELECT COUNT(*) as count FROM reports WHERE reported_id = ? AND created_at > datetime('now', '-1 hour')`,
    [reportedId]
  );
  return (result?.count ?? 0) >= 3;
}
