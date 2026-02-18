import { v4 as uuidv4 } from 'uuid';
import { queryOne, queryAll, execute } from '../db/connection.js';
import type { User } from '../types/index.js';

// ─── Lookups ──────────────────────────────────────────────────────────────────

export function findUserById(id: string): User | null {
  return queryOne<User>('SELECT * FROM users WHERE id = ?', [id]) ?? null;
}

export function findUserByEmail(email: string): User | null {
  return queryOne<User>('SELECT * FROM users WHERE email = ?', [email.toLowerCase()]) ?? null;
}

export function findUserByPhone(phone: string): User | null {
  return queryOne<User>('SELECT * FROM users WHERE phone = ?', [phone]) ?? null;
}

export function findUserByFacebookId(facebookId: string): User | null {
  return queryOne<User>('SELECT * FROM users WHERE facebook_id = ?', [facebookId]) ?? null;
}

// ─── Create ───────────────────────────────────────────────────────────────────

export function createUserWithEmail(
  email: string,
  displayName: string,
  passwordHash: string
): User {
  const id = uuidv4();
  execute(
    `INSERT INTO users (id, email, display_name, password_hash, email_verified)
     VALUES (?, ?, ?, ?, 1)`,
    [id, email.toLowerCase(), displayName, passwordHash]
  );
  return findUserById(id)!;
}

export function createUserWithPhone(phone: string, displayName: string): User {
  const id = uuidv4();
  execute(
    `INSERT INTO users (id, phone, display_name, phone_verified) VALUES (?, ?, ?, 1)`,
    [id, phone, displayName]
  );
  return findUserById(id)!;
}

export function createUserWithFacebook(
  facebookId: string,
  displayName: string,
  email?: string
): User {
  const id = uuidv4();
  execute(
    `INSERT INTO users (id, facebook_id, email, display_name, email_verified)
     VALUES (?, ?, ?, ?, ?)`,
    [id, facebookId, email ? email.toLowerCase() : null, displayName, email ? 1 : 0]
  );
  return findUserById(id)!;
}

// ─── Update ───────────────────────────────────────────────────────────────────

export function updateLastLogin(userId: string): void {
  execute(`UPDATE users SET last_login_at = datetime('now') WHERE id = ?`, [userId]);
}

export function linkFacebookToUser(userId: string, facebookId: string): void {
  execute(`UPDATE users SET facebook_id = ? WHERE id = ?`, [facebookId, userId]);
}

// ─── Admin listing ────────────────────────────────────────────────────────────

export function listUsers(
  page = 1,
  limit = 50
): { users: Omit<User, 'password_hash'>[]; total: number } {
  const offset = (page - 1) * limit;
  const users = queryAll<Omit<User, 'password_hash'>>(
    `SELECT id, email, phone, facebook_id, display_name, email_verified, phone_verified,
            role, is_active, created_at, last_login_at
     FROM users ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    [limit, offset]
  );
  const result = queryOne<{ count: number }>('SELECT COUNT(*) as count FROM users');
  return { users, total: result?.count ?? 0 };
}
