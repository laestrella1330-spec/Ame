import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import helmet from 'helmet';
import path from 'path';
import { fileURLToPath } from 'url';
import { config } from './config.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
import bcrypt from 'bcryptjs';
import { initDb, saveDb, queryOne, execute } from './db/connection.js';
import { apiLimiter, authLimiter } from './middleware/rateLimit.js';
import { setupSocketHandlers } from './signaling/socketHandler.js';
import authRoutes from './routes/auth.js';
import reportRoutes from './routes/reports.js';
import banRoutes from './routes/bans.js';
import sessionRoutes from './routes/sessions.js';
import { authMiddleware } from './middleware/auth.js';

async function main() {
  // Initialize database
  await initDb();
  console.log('Database initialized.');

  // Auto-seed admin user if none exists
  const existingAdmin = queryOne('SELECT id FROM admins WHERE username = ?', [config.adminUsername]);
  if (!existingAdmin) {
    const hash = bcrypt.hashSync(config.adminPassword, 12);
    execute('INSERT INTO admins (username, password_hash) VALUES (?, ?)', [config.adminUsername, hash]);
    saveDb();
    console.log(`Admin user "${config.adminUsername}" created.`);
  }

  const app = express();
  const httpServer = createServer(app);

  // Trust proxy when behind reverse proxy (Render, Railway, etc.)
  if (config.nodeEnv === 'production') {
    app.set('trust proxy', 1);
  }

  const io = new Server(httpServer, {
    cors: {
      origin: config.corsOrigin,
      methods: ['GET', 'POST'],
    },
    maxHttpBufferSize: 1e5, // 100KB max per socket message
  });

  // Security middleware
  app.use(helmet({
    contentSecurityPolicy: config.nodeEnv === 'production' ? {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "blob:", "data:"],
        connectSrc: ["'self'", "wss:", "ws:", "https://stun.l.google.com", "https://stun1.l.google.com"],
        mediaSrc: ["'self'", "blob:"],
        frameSrc: ["'none'"],
      },
    } : false,
  }));
  app.use(cors({ origin: config.corsOrigin }));
  app.use(express.json({ limit: '10kb' }));
  app.use('/api', apiLimiter);
  app.use('/api/auth', authLimiter);

  // Routes
  app.use('/api/auth', authRoutes);
  app.use('/api/reports', reportRoutes);
  app.use('/api/bans', banRoutes);
  app.use('/api/sessions', sessionRoutes);

  // Socket.IO
  const matchmaker = setupSocketHandlers(io);

  // Health check (public, minimal info)
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  // Stats (protected — admin only)
  app.get('/api/stats', authMiddleware, (_req, res) => {
    res.json(matchmaker.getStats());
  });

  // Serve client build in production
  if (config.nodeEnv === 'production') {
    const clientDist = path.resolve(__dirname, '../../client/dist');
    app.use(express.static(clientDist));
    // SPA fallback — all non-API routes serve index.html
    app.get('*', (_req, res) => {
      res.sendFile(path.join(clientDist, 'index.html'));
    });
  }

  // Graceful shutdown
  process.on('SIGINT', () => {
    console.log('\nSaving database and shutting down...');
    saveDb();
    process.exit(0);
  });

  httpServer.listen(config.port, () => {
    console.log(`Server running on http://localhost:${config.port}`);
    console.log(`Environment: ${config.nodeEnv}`);
  });
}

main().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
