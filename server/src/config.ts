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

  // Public URL of the app (used in emails, callbacks, etc.)
  appUrl: process.env.APP_URL || 'https://ame-cn8y.onrender.com',

  // CORS — Capacitor mobile apps always send these origins (iOS/Android WebView).
  // In production, only these + any CORS_ORIGIN env var are allowed (same-origin
  // requests from the web client don't send an Origin header so they pass through).
  corsOrigin: (() => {
    const capacitorOrigins = ['capacitor://localhost', 'http://localhost', 'https://localhost', 'ionic://localhost'];
    const customDomains = ['https://amechatme.app', 'https://www.amechatme.app'];
    if (process.env.CORS_ORIGIN) return [process.env.CORS_ORIGIN, ...customDomains, ...capacitorOrigins];
    if (nodeEnv === 'production') return [...customDomains, ...capacitorOrigins];
    return ['http://localhost:5173', ...customDomains, ...capacitorOrigins];
  })(),

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

// TURN relay servers — set TURN_URL, TURN_USERNAME, TURN_CREDENTIAL in env to enable.
// A TURN server masks peer IP addresses from chat partners.
// Set TURN_URL to the base turn: URL, e.g. "turn:global.relay.metered.ca:80"
// All four connectivity variants (UDP/TCP on port 80 + 443 + TLS) are derived automatically.
const turnServers = (() => {
  const url = process.env.TURN_URL;
  const username = process.env.TURN_USERNAME;
  const credential = process.env.TURN_CREDENTIAL;
  if (!url || !username || !credential) return [];

  // Extract host from the base URL (e.g. "turn:global.relay.metered.ca:80" → "global.relay.metered.ca")
  const host = url.replace(/^turns?:/, '').split(':')[0];
  return [
    { urls: `turn:${host}:80`,                        username, credential },
    { urls: `turn:${host}:80?transport=tcp`,           username, credential },
    { urls: `turn:${host}:443`,                        username, credential },
    { urls: `turns:${host}:443?transport=tcp`,         username, credential },
  ];
})();

export const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  ...turnServers,
];
