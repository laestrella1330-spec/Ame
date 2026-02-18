import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { queryOne } from '../db/connection.js';
import type { Admin } from '../types/index.js';

const router = Router();

router.post('/login', (req: Request, res: Response) => {
  const { username, password } = req.body;
  if (!username || !password) {
    res.status(400).json({ error: 'Username and password are required' });
    return;
  }

  const admin = queryOne<Admin>('SELECT * FROM admins WHERE username = ?', [username]);
  if (!admin) {
    res.status(401).json({ error: 'Invalid credentials' });
    return;
  }

  if (!bcrypt.compareSync(password, admin.password_hash)) {
    res.status(401).json({ error: 'Invalid credentials' });
    return;
  }

  const token = jwt.sign({ username: admin.username }, config.jwtSecret, { expiresIn: '24h' });
  res.json({ token, username: admin.username });
});

export default router;
