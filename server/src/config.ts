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

  // JWT secret shared between admin and user tokens
  jwtSecret: process.env.JWT_SECRET || 'dev-secret',

  // Admin credentials (auto-seeded on startup)
  adminUsername: process.env.ADMIN_USERNAME || 'admin',
  adminPassword: process.env.ADMIN_PASSWORD || 'admin123',

  // CORS — in production (same-origin) leave unset; set for local dev
  corsOrigin: process.env.CORS_ORIGIN || (nodeEnv === 'production' ? false as const : 'http://localhost:5173'),

  // Facebook OAuth — create app at https://developers.facebook.com
  facebookAppId: process.env.FACEBOOK_APP_ID || '',
  facebookAppSecret: process.env.FACEBOOK_APP_SECRET || '',
  facebookCallbackUrl: process.env.FACEBOOK_CALLBACK_URL || 'http://localhost:3001/api/auth/facebook/callback',

  // Twilio SMS OTP — if not set, OTP is logged to console (dev mode)
  twilioAccountSid: process.env.TWILIO_ACCOUNT_SID || '',
  twilioAuthToken: process.env.TWILIO_AUTH_TOKEN || '',
  twilioPhoneNumber: process.env.TWILIO_PHONE_NUMBER || '',

  // Anthropic API — used by AI agents
  anthropicApiKey: process.env.ANTHROPIC_API_KEY || '',

  // ─── AI Feature flags ──────────────────────────────────────────────────────
  // All off by default — enable in .env or Render dashboard
  features: {
    aiWarmup:          process.env.AI_WARMUP_ENABLED === 'true',
    smartMatch:        process.env.SMART_MATCH_ENABLED === 'true',
    aiCohost:          process.env.AI_COHOST_ENABLED === 'true',
    aiSafety:          process.env.AI_SAFETY_ENABLED === 'true',
    postChatFeedback:  process.env.POST_CHAT_FEEDBACK_ENABLED === 'true',
    identityControls:  process.env.IDENTITY_CONTROLS_ENABLED === 'true',
  },
};

export const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
];
