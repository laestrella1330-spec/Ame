import { queryOne, queryAll, execute, lastInsertRowId } from '../db/connection.js';
import type { Ban, UserBan } from '../types/index.js';

// ─── Legacy IP bans ────────────────────────────────────────────────────────────

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

export function listBans(page = 1, limit = 20): { bans: Ban[]; total: number } {
  const offset = (page - 1) * limit;
  const bans = queryAll<Ban>(
    `SELECT * FROM bans WHERE expires_at IS NULL OR expires_at > datetime('now')
     ORDER BY banned_at DESC LIMIT ? OFFSET ?`,
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

// ─── Progressive user bans ────────────────────────────────────────────────────

/** Active ban for a user (null = not currently banned). */
export function getActiveUserBan(userId: string): UserBan | null {
  return (
    queryOne<UserBan>(
      `SELECT * FROM user_bans
       WHERE user_id = ? AND lifted_at IS NULL AND expires_at > datetime('now')
       ORDER BY banned_at DESC LIMIT 1`,
      [userId]
    ) ?? null
  );
}

/** Total number of bans ever applied to a user. */
export function getUserBanCount(userId: string): number {
  return (
    queryOne<{ count: number }>(
      'SELECT COUNT(*) as count FROM user_bans WHERE user_id = ?',
      [userId]
    )?.count ?? 0
  );
}

/** Create a progressive ban. 1st=7d, 2nd=14d, 3rd+=30d. */
export function createUserBan(
  userId: string,
  reason: string | null,
  bannedBy: string
): UserBan {
  const currentCount = getUserBanCount(userId);
  const banNumber = currentCount + 1;
  const durationDays = banNumber === 1 ? 7 : banNumber === 2 ? 14 : 30;
  const expiresAt = new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000)
    .toISOString()
    .replace('T', ' ')
    .slice(0, 19);

  execute(
    `INSERT INTO user_bans (user_id, reason, expires_at, banned_by, ban_number, duration_days)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [userId, reason, expiresAt, bannedBy, banNumber, durationDays]
  );
  const id = lastInsertRowId();
  return queryOne<UserBan>('SELECT * FROM user_bans WHERE id = ?', [id])!;
}

/** Manually lift a user ban (admin only). */
export function liftUserBan(userId: string, liftedBy: string): boolean {
  const active = getActiveUserBan(userId);
  if (!active) return false;
  execute(
    `UPDATE user_bans SET lifted_at = datetime('now'), lifted_by = ? WHERE id = ?`,
    [liftedBy, active.id]
  );
  return true;
}

/** Full ban history for a user. */
export function getUserBanHistory(userId: string): UserBan[] {
  return queryAll<UserBan>(
    'SELECT * FROM user_bans WHERE user_id = ? ORDER BY banned_at DESC',
    [userId]
  );
}

/** All currently active user bans (for admin dashboard). */
export function listActiveUserBans(
  page = 1,
  limit = 50
): { bans: UserBan[]; total: number } {
  const offset = (page - 1) * limit;
  const bans = queryAll<UserBan>(
    `SELECT * FROM user_bans
     WHERE lifted_at IS NULL AND expires_at > datetime('now')
     ORDER BY banned_at DESC LIMIT ? OFFSET ?`,
    [limit, offset]
  );
  const result = queryOne<{ count: number }>(
    `SELECT COUNT(*) as count FROM user_bans
     WHERE lifted_at IS NULL AND expires_at > datetime('now')`
  );
  return { bans, total: result?.count ?? 0 };
}
