export interface Session {
  id: string;
  user_a_id: string;
  user_b_id: string | null;
  started_at: string;
  ended_at: string | null;
  end_reason: string | null;
  duration_seconds: number | null;
}

export interface Report {
  id: number;
  session_id: string;
  reporter_id: string;
  reported_id: string;
  reason: string;
  description: string | null;
  status: 'pending' | 'reviewed' | 'actioned' | 'dismissed';
  is_priority: number; // 1 = underage/CSAM — requires urgent review
  created_at: string;
  reviewed_at: string | null;
  reviewed_by: string | null;
}

export interface Ban {
  id: number;
  identifier: string;
  identifier_type: 'ip' | 'fingerprint';
  reason: string | null;
  banned_at: string;
  expires_at: string | null;
  banned_by: string | null;
}

export interface Admin {
  id: number;
  username: string;
  password_hash: string;
  created_at: string;
}

// ─── User account ──────────────────────────────────────────────────────────────
export interface User {
  id: string;
  email: string | null;
  phone: string | null;
  facebook_id: string | null;
  display_name: string;
  password_hash: string | null;
  email_verified: number;
  phone_verified: number;
  role: 'user' | 'admin';
  is_active: number;
  dob: string | null;        // YYYY-MM-DD
  deleted_at: string | null; // set on GDPR account deletion
  created_at: string;
  last_login_at: string | null;
}

// ─── User block ───────────────────────────────────────────────────────────────
export interface UserBlock {
  id: number;
  blocker_id: string;
  blocked_id: string;
  created_at: string;
}

// ─── Progressive user ban ─────────────────────────────────────────────────────
export interface UserBan {
  id: number;
  user_id: string;
  reason: string | null;
  banned_at: string;
  expires_at: string;
  lifted_at: string | null;
  lifted_by: string | null;
  banned_by: string | null;
  ban_number: number;
  duration_days: number;
}

// ─── Monitoring consent ───────────────────────────────────────────────────────
export interface UserConsent {
  id: number;
  user_id: string;
  consent_type: string;
  accepted_at: string;
  ip_address: string | null;
  user_agent: string | null;
}

// ─── Phone OTP ────────────────────────────────────────────────────────────────
export interface OtpCode {
  id: number;
  phone: string;
  code: string;
  expires_at: string;
  used: number;
  created_at: string;
}

// ─── Audit log ────────────────────────────────────────────────────────────────
export interface AuditLog {
  id: number;
  event_type: string;
  actor_id: string | null;
  target_id: string | null;
  details: string | null;
  ip_address: string | null;
  created_at: string;
}

// ─── Matchmaker internals ─────────────────────────────────────────────────────
export interface QueueEntry {
  socketId: string;
  ip: string;
  userId: string;
  joinedAt: Date;
  gender?: string;
  preferredGender?: string;
  country?: string;
  // Phase 2: smart match soft preferences
  energyLevel?: 'chill' | 'normal' | 'hype';
  intent?: 'talk' | 'play' | 'flirt' | 'learn';
  // Common interests
  interests?: string[];
}

export interface ActiveMatch {
  sessionId: string;
  socketA: string;
  socketB: string;
  userA: string;
  userB: string;
}
