/**
 * POST /api/feedback
 * Submit post-chat mood feedback for a session.
 * Requires a valid user JWT.
 */
import { Router, Response } from 'express';
import { z } from 'zod';
import { execute, queryOne } from '../db/connection.js';
import { userAuthMiddleware, UserAuthRequest } from '../middleware/userAuth.js';

const router = Router();

const feedbackSchema = z.object({
  sessionId: z.string().uuid(),
  mood: z.enum(['fun', 'awkward', 'uncomfortable']),
});

router.post('/', userAuthMiddleware, (req: UserAuthRequest, res: Response) => {
  const parsed = feedbackSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid feedback data' });
    return;
  }

  const userId = req.user!.userId;
  const { sessionId, mood } = parsed.data;

  // Verify the user was part of this session
  const session = queryOne(
    'SELECT id FROM sessions WHERE id = ? AND (user_a_id = ? OR user_b_id = ?)',
    [sessionId, userId, userId],
  );
  if (!session) {
    res.status(403).json({ error: 'Session not found or access denied' });
    return;
  }

  try {
    execute(
      `INSERT INTO chat_feedback (session_id, user_id, mood) VALUES (?, ?, ?)
       ON CONFLICT(session_id, user_id) DO UPDATE SET mood = excluded.mood`,
      [sessionId, userId, mood],
    );
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: 'Could not save feedback' });
  }
});

export default router;
