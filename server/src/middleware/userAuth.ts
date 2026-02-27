import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { getActiveUserBan } from '../services/banService.js';

export interface UserPayload {
  type: 'user';
  userId: string;
}

export interface UserAuthRequest extends Request {
  user?: UserPayload;
}

/**
 * Middleware that requires a valid user JWT.
 * Token must be in Authorization: Bearer <token>
 */
export function userAuthMiddleware(
  req: UserAuthRequest,
  res: Response,
  next: NextFunction
): void {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'No token provided' });
    return;
  }

  const token = authHeader.slice(7);
  try {
    const decoded = jwt.verify(token, config.jwtSecret) as { type: string; userId: string };
    if (decoded.type !== 'user') {
      res.status(401).json({ error: 'Invalid token type' });
      return;
    }
    // Reject banned users at the API level
    const ban = getActiveUserBan(decoded.userId);
    if (ban) {
      const remainingDays = Math.max(1, Math.ceil(
        (new Date(ban.expires_at).getTime() - Date.now()) / 86400000
      ));
      res.status(403).json({
        error: 'account_banned',
        reason: ban.reason ?? 'Violation of Terms of Service',
        expiresAt: ban.expires_at,
        remainingDays,
      });
      return;
    }
    req.user = { type: 'user', userId: decoded.userId };
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
}

/** Issue a signed user JWT (24-hour expiry). */
export function issueUserToken(userId: string): string {
  return jwt.sign({ type: 'user', userId }, config.jwtSecret, { expiresIn: '24h' });
}
