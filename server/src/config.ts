import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const nodeEnv = process.env.NODE_ENV || 'development';

export const config = {
  port: parseInt(process.env.PORT || '3001', 10),
  nodeEnv,
  dbPath: process.env.DB_PATH || './data/videochat.db',
  jwtSecret: process.env.JWT_SECRET || 'dev-secret',
  adminUsername: process.env.ADMIN_USERNAME || 'admin',
  adminPassword: process.env.ADMIN_PASSWORD || 'admin123',
  // In production (same-origin), set CORS_ORIGIN to the Render URL or leave unset
  corsOrigin: process.env.CORS_ORIGIN || (nodeEnv === 'production' ? false as const : 'http://localhost:5173'),
};

export const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
];
