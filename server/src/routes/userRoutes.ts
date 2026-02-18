/**
 * User-facing and admin user-management endpoints.
 *
 * User endpoints (require valid user JWT):
 *   GET  /api/users/me               → current user profile + ban status + consent status
 *   POST /api/users/accept-consent   → record monitoring consent
 *
 * Admin endpoints (require admin JWT):
 *   GET  /api/users                  → paginated user list
 *   GET  /api/users/:id/bans         → ban history for a user
 *   POST /api/users/:id/ban          → ban a user (progressive)
 *   DELETE /api/users/:id/ban        → lift active ban
 *   GET  /api/users/active-sessions  → currently active chat sessions
 */
import { Router, Response } from 'express';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';
import { userAuthMiddleware, UserAuthRequest } from '../middleware/userAuth.js';
import { findUserById, listUsers } from '../services/userService.js';
import {
  getActiveUserBan,
  createUserBan,
  liftUserBan,
  getUserBanHistory,
  listActiveUserBans,
} from '../services/banService.js';
import { logAudit } from '../services/auditService.js';
import { queryOne, queryAll, execute } from '../db/connection.js';
import type { UserConsent } from '../types/index.js';
import { kickUser } from '../signaling/socketHandler.js';

const router = Router();

function getIp(req: UserAuthRequest | AuthRequest): string {
  return (
    (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
    req.socket.remoteAddress ||
    'unknown'
  );
}

// ── GET /api/users/me ─────────────────────────────────────────────────────────
router.get('/me', userAuthMiddleware, (req: UserAuthRequest, res: Response) => {
  const user = findUserById(req.user!.userId);
  if (!user) {
    res.status(404).json({ error: 'User not found' });
    return;
  }

  const activeBan = getActiveUserBan(user.id);
  const consent = queryOne<UserConsent>(
    `SELECT * FROM user_consents WHERE user_id = ? AND consent_type = 'monitoring_warning'`,
    [user.id]
  );

  res.json({
    id: user.id,
    displayName: user.display_name,
    email: user.email,
    phone: user.phone,
    role: user.role,
    createdAt: user.created_at,
    hasAcceptedConsent: !!consent,
    activeBan: activeBan
      ? {
          reason: activeBan.reason,
          expiresAt: activeBan.expires_at,
          remainingDays: Math.ceil(
            (new Date(activeBan.expires_at).getTime() - Date.now()) / 86400000
          ),
          banNumber: activeBan.ban_number,
        }
      : null,
  });
});

// ── POST /api/users/accept-consent ───────────────────────────────────────────
router.post('/accept-consent', userAuthMiddleware, (req: UserAuthRequest, res: Response) => {
  const userId = req.user!.userId;

  // Upsert consent record (UNIQUE constraint on user_id + consent_type)
  execute(
    `INSERT OR REPLACE INTO user_consents (user_id, consent_type, ip_address, user_agent)
     VALUES (?, 'monitoring_warning', ?, ?)`,
    [userId, getIp(req), req.headers['user-agent'] ?? null]
  );

  logAudit('consent_accepted', userId, null, { consent_type: 'monitoring_warning' }, getIp(req));
  res.json({ success: true });
});

// ── GET /api/users (admin) ────────────────────────────────────────────────────
router.get('/', authMiddleware, (req: AuthRequest, res: Response) => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
  const result = listUsers(page, limit);
  // Annotate with active ban status
  const enriched = result.users.map((u) => ({
    ...u,
    isBanned: !!getActiveUserBan(u.id),
  }));
  res.json({ users: enriched, total: result.total });
});

// ── GET /api/users/active-sessions (admin) ────────────────────────────────────
router.get('/active-sessions', authMiddleware, (_req: AuthRequest, res: Response) => {
  const sessions = queryAll<{
    id: string;
    user_a_id: string;
    user_b_id: string | null;
    started_at: string;
  }>(`SELECT id, user_a_id, user_b_id, started_at FROM sessions WHERE ended_at IS NULL ORDER BY started_at DESC`);
  res.json({ sessions, count: sessions.length });
});

// ── GET /api/users/active-user-bans (admin) ───────────────────────────────────
router.get('/active-user-bans', authMiddleware, (req: AuthRequest, res: Response) => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
  res.json(listActiveUserBans(page, limit));
});

// ── GET /api/users/:id/bans (admin) ──────────────────────────────────────────
router.get('/:id/bans', authMiddleware, (req: AuthRequest, res: Response) => {
  const history = getUserBanHistory(req.params.id as string);
  res.json({ bans: history });
});

// ── POST /api/users/:id/ban (admin) ──────────────────────────────────────────
router.post('/:id/ban', authMiddleware, (req: AuthRequest, res: Response) => {
  const userId = req.params.id as string;
  const { reason } = req.body;

  const user = findUserById(userId);
  if (!user) {
    res.status(404).json({ error: 'User not found' });
    return;
  }

  // Don't ban admins
  if (user.role === 'admin') {
    res.status(400).json({ error: 'Cannot ban admin accounts' });
    return;
  }

  const existing = getActiveUserBan(userId);
  if (existing) {
    res.status(409).json({ error: 'User is already banned' });
    return;
  }

  const ban = createUserBan(userId, reason ?? null, req.admin!.username);
  logAudit('ban_user', `admin:${req.admin!.username}`, userId, {
    reason,
    banNumber: ban.ban_number,
    durationDays: ban.duration_days,
  }, getIp(req));

  // Immediately disconnect any active sockets belonging to this user
  kickUser(userId);

  res.status(201).json(ban);
});

// ── DELETE /api/users/:id/ban (admin) ─────────────────────────────────────────
router.delete('/:id/ban', authMiddleware, (req: AuthRequest, res: Response) => {
  const userId = req.params.id as string;
  const lifted = liftUserBan(userId, req.admin!.username);
  if (!lifted) {
    res.status(404).json({ error: 'No active ban found for this user' });
    return;
  }
  logAudit('unban_user', `admin:${req.admin!.username}`, userId, {}, getIp(req));
  res.json({ success: true });
});

export default router;
