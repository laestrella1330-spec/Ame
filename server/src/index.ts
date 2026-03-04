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
import userRoutes from './routes/userRoutes.js';
import featuresRoutes from './routes/features.js';
import feedbackRoutes from './routes/feedback.js';
import { authMiddleware } from './middleware/auth.js';

async function main() {
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

  if (config.nodeEnv === 'production') {
    app.set('trust proxy', 1);
  }

  const io = new Server(httpServer, {
    cors: {
      origin: config.corsOrigin,
      methods: ['GET', 'POST'],
    },
    maxHttpBufferSize: 1e5,
  });

  // Security middleware
  app.use(helmet({
    contentSecurityPolicy: config.nodeEnv === 'production' ? {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "https://connect.facebook.net"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        imgSrc: ["'self'", "blob:", "data:"],
        connectSrc: ["'self'", "wss:", "ws:", "https://stun.l.google.com", "https://stun1.l.google.com", "https://graph.facebook.com"],
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
  app.use('/api/users', userRoutes);
  app.use('/api/features', featuresRoutes);
  app.use('/api/feedback', feedbackRoutes);

  // Socket.IO
  const matchmaker = setupSocketHandlers(io);

  // Health check
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  // Stats (admin only)
  app.get('/api/stats', authMiddleware, (_req, res) => {
    res.json(matchmaker.getStats());
  });

  // ─── SEO: robots.txt ────────────────────────────────────────────────────────
  app.get('/robots.txt', (_req, res) => {
    res.type('text/plain').send(`# Ame - Random Video Chat
# https://amechatme.app

User-agent: *
Allow: /
Disallow: /api/
Disallow: /admin/
Disallow: /socket.io/

Sitemap: https://amechatme.app/sitemap.xml
`);
  });

  // ─── SEO: sitemap.xml ───────────────────────────────────────────────────────
  app.get('/sitemap.xml', (_req, res) => {
    res.type('application/xml').send(`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://amechatme.app/</loc>
    <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>https://amechatme.app/about</loc>
    <changefreq>monthly</changefreq>
    <priority>0.8</priority>
  </url>
  <url>
    <loc>https://amechatme.app/privacy</loc>
    <changefreq>yearly</changefreq>
    <priority>0.5</priority>
  </url>
  <url>
    <loc>https://amechatme.app/terms</loc>
    <changefreq>yearly</changefreq>
    <priority>0.5</priority>
  </url>
</urlset>
`);
  });

  // Serve client build in production
  if (config.nodeEnv === 'production') {
    const clientDist = path.resolve(__dirname, '../../client/dist');
    app.use(express.static(clientDist));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(clientDist, 'index.html'));
    });
  }

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
