import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { queryOne, execute } from '../db/connection.js';
import type { Admin } from '../types/index.js';
import {
  findUserByEmail,
  findUserByPhone,
  findUserByFacebookId,
  createUserWithEmail,
  createUserWithPhone,
  createUserWithFacebook,
  updateLastLogin,
} from '../services/userService.js';
import { getActiveUserBan } from '../services/banService.js';
import { issueUserToken } from '../middleware/userAuth.js';
import { logAudit } from '../services/auditService.js';

const router = Router();

function getIp(req: Request): string {
  return (
    (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
    req.socket.remoteAddress ||
    'unknown'
  );
}

function rejectIfBanned(userId: string, res: Response): boolean {
  const ban = getActiveUserBan(userId);
  if (!ban) return false;
  const remaining = Math.ceil(
    (new Date(ban.expires_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
  );
  res.status(403).json({
    error: 'account_banned',
    reason: ban.reason ?? 'Violation of terms of service',
    expiresAt: ban.expires_at,
    remainingDays: remaining,
    banNumber: ban.ban_number,
  });
  return true;
}

// ── Admin login ───────────────────────────────────────────────────────────────
router.post('/login', (req: Request, res: Response) => {
  const { username, password } = req.body;
  if (!username || !password) {
    res.status(400).json({ error: 'Username and password are required' });
    return;
  }

  const admin = queryOne<Admin>('SELECT * FROM admins WHERE username = ?', [username]);
  if (!admin || !bcrypt.compareSync(password, admin.password_hash)) {
    logAudit('login_fail', `admin:${username}`, null, { method: 'admin' }, getIp(req));
    res.status(401).json({ error: 'Invalid credentials' });
    return;
  }

  logAudit('login_success', `admin:${username}`, null, { method: 'admin' }, getIp(req));
  // Admin tokens carry type:'admin' to distinguish from user tokens
  const token = jwt.sign({ type: 'admin', username: admin.username }, config.jwtSecret, {
    expiresIn: '24h',
  });
  res.json({ token, username: admin.username });
});

// ── User register (email + password) ─────────────────────────────────────────
router.post('/register', (req: Request, res: Response) => {
  const { email, password, displayName } = req.body;
  if (!email || !password || !displayName) {
    res.status(400).json({ error: 'email, password, and displayName are required' });
    return;
  }
  if ((password as string).length < 8) {
    res.status(400).json({ error: 'Password must be at least 8 characters' });
    return;
  }
  if (findUserByEmail(email)) {
    res.status(409).json({ error: 'An account with this email already exists' });
    return;
  }

  const hash = bcrypt.hashSync(password as string, 12);
  const user = createUserWithEmail(email as string, (displayName as string).trim().slice(0, 50), hash);
  logAudit('register', user.id, null, { method: 'email' }, getIp(req));

  const token = issueUserToken(user.id);
  res.status(201).json({ token, user: { id: user.id, displayName: user.display_name, email: user.email } });
});

// ── User login (email + password) ────────────────────────────────────────────
router.post('/login/email', (req: Request, res: Response) => {
  const { email, password } = req.body;
  if (!email || !password) {
    res.status(400).json({ error: 'email and password are required' });
    return;
  }

  const user = findUserByEmail(email as string);
  if (!user || !user.password_hash || !bcrypt.compareSync(password as string, user.password_hash)) {
    logAudit('login_fail', null, null, { method: 'email', email }, getIp(req));
    res.status(401).json({ error: 'Invalid email or password' });
    return;
  }

  if (rejectIfBanned(user.id, res)) return;

  updateLastLogin(user.id);
  logAudit('login_success', user.id, null, { method: 'email' }, getIp(req));
  const token = issueUserToken(user.id);
  res.json({ token, user: { id: user.id, displayName: user.display_name, email: user.email } });
});

// ── Phone OTP: send ───────────────────────────────────────────────────────────
router.post('/phone/send-otp', async (req: Request, res: Response) => {
  const { phone } = req.body;
  if (!phone || typeof phone !== 'string') {
    res.status(400).json({ error: 'phone is required' });
    return;
  }

  const normalised = (phone as string).replace(/[^\d+]/g, '');
  if (normalised.length < 7) {
    res.status(400).json({ error: 'Invalid phone number' });
    return;
  }

  // Rate limit: max 3 OTPs per 10 minutes
  const recentCount = queryOne<{ count: number }>(
    `SELECT COUNT(*) as count FROM otp_codes
     WHERE phone = ? AND used = 0 AND created_at > datetime('now', '-10 minutes')`,
    [normalised]
  )?.count ?? 0;
  if (recentCount >= 3) {
    res.status(429).json({ error: 'Too many OTP requests. Wait before retrying.' });
    return;
  }

  const code = String(Math.floor(100000 + Math.random() * 900000));
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000)
    .toISOString().replace('T', ' ').slice(0, 19);
  execute('INSERT INTO otp_codes (phone, code, expires_at) VALUES (?, ?, ?)', [normalised, code, expiresAt]);

  const { twilioAccountSid, twilioAuthToken, twilioPhoneNumber } = config;
  if (twilioAccountSid && twilioAuthToken && twilioPhoneNumber) {
    try {
      const creds = Buffer.from(`${twilioAccountSid}:${twilioAuthToken}`).toString('base64');
      const resp = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}/Messages.json`,
        {
          method: 'POST',
          headers: { Authorization: `Basic ${creds}`, 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            From: twilioPhoneNumber,
            To: normalised,
            Body: `Your Ame verification code is: ${code}. Valid for 10 minutes.`,
          }).toString(),
        }
      );
      if (!resp.ok) {
        console.error('[Twilio] Failed:', await resp.text());
        res.status(500).json({ error: 'Failed to send SMS' });
        return;
      }
    } catch (err) {
      console.error('[Twilio] Error:', err);
      res.status(500).json({ error: 'Failed to send SMS' });
      return;
    }
  } else {
    console.log(`\n[DEV MODE] OTP for ${normalised}: ${code}\n`);
  }

  logAudit('phone_otp_sent', null, null, { phone: normalised }, getIp(req));
  // In dev mode (no Twilio), return the code in the response so the UI can display it
  res.json({
    message: 'OTP sent',
    devMode: !twilioAccountSid,
    ...(twilioAccountSid ? {} : { devCode: code }),
  });
});

// ── Phone OTP: verify ─────────────────────────────────────────────────────────
router.post('/phone/verify', (req: Request, res: Response) => {
  const { phone, code, displayName } = req.body;
  if (!phone || !code) {
    res.status(400).json({ error: 'phone and code are required' });
    return;
  }

  const normalised = (phone as string).replace(/[^\d+]/g, '');
  const otp = queryOne<{ id: number; code: string }>(
    `SELECT id, code FROM otp_codes
     WHERE phone = ? AND used = 0 AND expires_at > datetime('now')
     ORDER BY created_at DESC LIMIT 1`,
    [normalised]
  );

  if (!otp || otp.code !== String(code)) {
    res.status(401).json({ error: 'Invalid or expired OTP' });
    return;
  }

  execute('UPDATE otp_codes SET used = 1 WHERE id = ?', [otp.id]);

  let user = findUserByPhone(normalised);
  if (!user) {
    const name = (displayName as string | undefined)?.trim().slice(0, 50) || `User${normalised.slice(-4)}`;
    user = createUserWithPhone(normalised, name);
    logAudit('register', user.id, null, { method: 'phone' }, getIp(req));
  }

  if (rejectIfBanned(user.id, res)) return;

  updateLastLogin(user.id);
  logAudit('login_success', user.id, null, { method: 'phone' }, getIp(req));
  const token = issueUserToken(user.id);
  res.json({ token, user: { id: user.id, displayName: user.display_name, phone: user.phone } });
});

// ── Facebook OAuth: redirect ──────────────────────────────────────────────────
router.get('/facebook/start', (req: Request, res: Response) => {
  if (!config.facebookAppId) {
    res.status(501).json({ error: 'Facebook login is not configured' });
    return;
  }
  // mobile=1 → encode in state so the callback redirects via the deep-link scheme
  const isMobile = req.query.mobile === '1';
  const params = new URLSearchParams({
    client_id: config.facebookAppId,
    redirect_uri: config.facebookCallbackUrl,
    scope: 'public_profile',
    response_type: 'code',
    state: isMobile ? 'ame_oauth_mobile' : 'ame_oauth',
  });
  res.redirect(`https://www.facebook.com/v21.0/dialog/oauth?${params}`);
});

// ── Facebook OAuth: callback ──────────────────────────────────────────────────
router.get('/facebook/callback', async (req: Request, res: Response) => {
  const { code, error, state } = req.query as Record<string, string>;
  // Use Android deep-link scheme for mobile, hash-fragment for web
  const isMobile = state === 'ame_oauth_mobile';
  const base = isMobile ? 'com.ame.videochat://' : '/';

  if (error || !code) {
    res.redirect(`${base}#auth-error=facebook_cancelled`);
    return;
  }

  try {
    // Exchange code for token
    const tokenParams = new URLSearchParams({
      client_id: config.facebookAppId,
      client_secret: config.facebookAppSecret,
      redirect_uri: config.facebookCallbackUrl,
      code,
    });
    const tokenResp = await fetch(`https://graph.facebook.com/v18.0/oauth/access_token?${tokenParams}`);
    const tokenData = await tokenResp.json() as { access_token?: string };
    if (!tokenData.access_token) {
      res.redirect(`${base}#auth-error=facebook_token_failed`);
      return;
    }

    // Fetch profile
    const profileResp = await fetch(
      `https://graph.facebook.com/me?fields=id,name,email&access_token=${tokenData.access_token}`
    );
    const profile = await profileResp.json() as { id: string; name: string; email?: string };
    if (!profile.id) {
      res.redirect(`${base}#auth-error=facebook_profile_failed`);
      return;
    }

    // Find or create user
    let user = findUserByFacebookId(profile.id);
    if (!user) {
      if (profile.email) {
        const byEmail = findUserByEmail(profile.email);
        if (byEmail) {
          execute('UPDATE users SET facebook_id = ? WHERE id = ?', [profile.id, byEmail.id]);
          user = byEmail;
        }
      }
      if (!user) {
        user = createUserWithFacebook(profile.id, profile.name, profile.email);
        logAudit('register', user.id, null, { method: 'facebook' }, getIp(req));
      }
    }

    const ban = getActiveUserBan(user.id);
    if (ban) {
      const remaining = Math.ceil((new Date(ban.expires_at).getTime() - Date.now()) / 86400000);
      res.redirect(`${base}#auth-error=banned&reason=${encodeURIComponent(ban.reason ?? 'TOS violation')}&days=${remaining}`);
      return;
    }

    updateLastLogin(user.id);
    logAudit('facebook_login', user.id, null, {}, getIp(req));
    const jwtToken = issueUserToken(user.id);
    res.redirect(`${base}#facebook-auth-success?token=${jwtToken}&displayName=${encodeURIComponent(user.display_name)}&userId=${user.id}`);
  } catch (err) {
    console.error('[Facebook OAuth]', err);
    res.redirect(`${base}#auth-error=facebook_server_error`);
  }
});

// ── Facebook token exchange (JS SDK popup flow) ───────────────────────────────
// Web clients use FB.login() popup, then POST the access token here
router.post('/facebook/token', async (req: Request, res: Response) => {
  const { accessToken, userID } = req.body;
  if (!accessToken || !userID) {
    res.status(400).json({ error: 'accessToken and userID are required' });
    return;
  }
  try {
    const profileResp = await fetch(
      `https://graph.facebook.com/me?fields=id,name,email&access_token=${accessToken}`
    );
    const profile = await profileResp.json() as { id: string; name: string; email?: string; error?: { message: string } };
    if (profile.error || profile.id !== userID) {
      res.status(401).json({ error: 'Invalid Facebook token' });
      return;
    }

    let user = findUserByFacebookId(profile.id);
    if (!user) {
      if (profile.email) {
        const byEmail = findUserByEmail(profile.email);
        if (byEmail) {
          execute('UPDATE users SET facebook_id = ? WHERE id = ?', [profile.id, byEmail.id]);
          user = byEmail;
        }
      }
      if (!user) {
        user = createUserWithFacebook(profile.id, profile.name, profile.email);
        logAudit('register', user.id, null, { method: 'facebook' }, getIp(req));
      }
    }

    if (rejectIfBanned(user.id, res)) return;

    updateLastLogin(user.id);
    logAudit('facebook_login', user.id, null, { method: 'sdk' }, getIp(req));
    const token = issueUserToken(user.id);
    res.json({ token, user: { id: user.id, displayName: user.display_name } });
  } catch (err) {
    console.error('[Facebook SDK token]', err);
    res.status(500).json({ error: 'Facebook authentication failed' });
  }
});

// ── Facebook data deletion callback ──────────────────────────────────────────
// Required by Meta for apps using Facebook Login
router.get('/delete-data', (_req: Request, res: Response) => {
  res.send(`
    <html><body style="font-family:sans-serif;max-width:600px;margin:40px auto">
      <h2>Data Deletion</h2>
      <p>To delete your Ame account and all associated data, email us at
      <a href="mailto:amethystcareer@gmail.com">amethystcareer@gmail.com</a>
      with subject "Delete my data".</p>
      <p>We will process your request within 30 days.</p>
    </body></html>
  `);
});

router.post('/delete-data', (_req: Request, res: Response) => {
  // Facebook sends a signed_request when a user deletes app from their FB settings
  res.json({ url: `${config.appUrl}/api/auth/delete-data`, confirmation_code: `DEL-${Date.now()}` });
});

export default router;
