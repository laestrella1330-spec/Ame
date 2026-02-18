import { Router, Response } from 'express';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';
import { listBans, createBan, removeBan } from '../services/banService.js';

const router = Router();

router.get('/', authMiddleware, (req: AuthRequest, res: Response) => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
  const result = listBans(page, limit);
  res.json(result);
});

router.post('/', authMiddleware, (req: AuthRequest, res: Response) => {
  const { identifier, identifierType, reason, expiresAt } = req.body;
  if (!identifier || !identifierType) {
    res.status(400).json({ error: 'identifier and identifierType are required' });
    return;
  }
  if (!['ip', 'fingerprint'].includes(identifierType)) {
    res.status(400).json({ error: 'identifierType must be ip or fingerprint' });
    return;
  }
  const ban = createBan(identifier, identifierType, reason || null, expiresAt || null, req.admin!.username);
  res.status(201).json(ban);
});

router.delete('/:id', authMiddleware, (req: AuthRequest, res: Response) => {
  const id = parseInt(req.params.id as string);
  const removed = removeBan(id);
  if (!removed) {
    res.status(404).json({ error: 'Ban not found' });
    return;
  }
  res.json({ success: true });
});

export default router;
