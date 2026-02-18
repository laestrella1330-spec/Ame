import { Router, Response } from 'express';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';
import { listReports, updateReportStatus } from '../services/reportService.js';

const router = Router();

router.get('/', authMiddleware, (req: AuthRequest, res: Response) => {
  const status = req.query.status as string | undefined;
  const page = parseInt(req.query.page as string) || 1;
  const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
  const result = listReports(status || null, page, limit);
  res.json(result);
});

router.patch('/:id', authMiddleware, (req: AuthRequest, res: Response) => {
  const id = parseInt(req.params.id as string);
  const { status } = req.body;
  if (!['reviewed', 'actioned', 'dismissed'].includes(status)) {
    res.status(400).json({ error: 'Invalid status' });
    return;
  }
  const report = updateReportStatus(id, status, req.admin!.username);
  if (!report) {
    res.status(404).json({ error: 'Report not found' });
    return;
  }
  res.json(report);
});

export default router;
