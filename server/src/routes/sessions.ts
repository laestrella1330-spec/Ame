import { Router, Response } from 'express';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';
import { queryOne } from '../db/connection.js';
import { getPendingReportsCount } from '../services/reportService.js';

const router = Router();

router.get('/stats', authMiddleware, (_req: AuthRequest, res: Response) => {
  const todaySessions = queryOne<{ count: number }>(
    `SELECT COUNT(*) as count FROM sessions WHERE started_at >= date('now')`
  )?.count ?? 0;

  const avgDuration = queryOne<{ avg: number | null }>(
    `SELECT AVG(duration_seconds) as avg FROM sessions WHERE duration_seconds IS NOT NULL AND started_at >= date('now')`
  )?.avg ?? 0;

  const totalSessions = queryOne<{ count: number }>(
    'SELECT COUNT(*) as count FROM sessions'
  )?.count ?? 0;

  const activeBans = queryOne<{ count: number }>(
    `SELECT COUNT(*) as count FROM bans WHERE expires_at IS NULL OR expires_at > datetime('now')`
  )?.count ?? 0;

  const pendingReports = getPendingReportsCount();

  res.json({
    todaySessions,
    avgDuration: Math.round(avgDuration),
    totalSessions,
    activeBans,
    pendingReports,
  });
});

export default router;
