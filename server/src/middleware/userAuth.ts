import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config.js';

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
