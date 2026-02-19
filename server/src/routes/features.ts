import { Router } from 'express';
import { config } from '../config.js';

const router = Router();

// Public endpoint — clients poll this to know which AI features are on.
// No auth required (flags are non-sensitive).
router.get('/', (_req, res) => {
  res.json(config.features);
});

export default router;
