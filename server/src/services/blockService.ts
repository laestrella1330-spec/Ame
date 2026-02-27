import { queryOne, execute } from '../db/connection.js';

/**
 * Returns true if blocker_id has blocked blocked_id.
 * Used in matchmaker.isCompatible() to prevent re-matching.
 */
export function isBlocked(blockerId: string, blockedId: string): boolean {
  const row = queryOne<{ id: number }>(
    'SELECT id FROM user_blocks WHERE blocker_id = ? AND blocked_id = ?',
    [blockerId, blockedId]
  );
  return !!row;
}

/**
 * Returns true if EITHER user has blocked the other.
 * Convenience wrapper used in matchmaking.
 */
export function isBlockedEither(userA: string, userB: string): boolean {
  const row = queryOne<{ id: number }>(
    `SELECT id FROM user_blocks
     WHERE (blocker_id = ? AND blocked_id = ?)
        OR (blocker_id = ? AND blocked_id = ?)
     LIMIT 1`,
    [userA, userB, userB, userA]
  );
  return !!row;
}

/**
 * Create a block. Silently succeeds if the block already exists.
 */
export function createBlock(blockerId: string, blockedId: string): void {
  execute(
    `INSERT OR IGNORE INTO user_blocks (blocker_id, blocked_id) VALUES (?, ?)`,
    [blockerId, blockedId]
  );
}

/**
 * Remove a block.
 */
export function removeBlock(blockerId: string, blockedId: string): void {
  execute(
    `DELETE FROM user_blocks WHERE blocker_id = ? AND blocked_id = ?`,
    [blockerId, blockedId]
  );
}
