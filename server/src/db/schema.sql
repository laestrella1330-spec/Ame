-- ─── Core chat sessions ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    user_a_id TEXT NOT NULL,
    user_b_id TEXT,
    started_at TEXT NOT NULL DEFAULT (datetime('now')),
    ended_at TEXT,
    end_reason TEXT,
    duration_seconds INTEGER
);

-- ─── Reports ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS reports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL REFERENCES sessions(id),
    reporter_id TEXT NOT NULL,
    reported_id TEXT NOT NULL,
    reason TEXT NOT NULL,
    description TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    is_priority INTEGER NOT NULL DEFAULT 0,  -- 1 = underage/CSAM, requires urgent review
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    reviewed_at TEXT,
    reviewed_by TEXT
);

-- ─── Legacy IP bans (kept for auto-ban and backward compat) ───────────────────
CREATE TABLE IF NOT EXISTS bans (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    identifier TEXT NOT NULL,
    identifier_type TEXT NOT NULL,
    reason TEXT,
    banned_at TEXT NOT NULL DEFAULT (datetime('now')),
    expires_at TEXT,
    banned_by TEXT
);

-- ─── Admin accounts ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS admins (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ─── User accounts ────────────────────────────────────────────────────────────
-- A user can register via email, phone, or Facebook.
-- All three identifiers are optional individually but at least one must be set.
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE,
    phone TEXT UNIQUE,
    facebook_id TEXT UNIQUE,
    display_name TEXT NOT NULL,
    password_hash TEXT,
    email_verified INTEGER NOT NULL DEFAULT 0,
    phone_verified INTEGER NOT NULL DEFAULT 0,
    role TEXT NOT NULL DEFAULT 'user',
    is_active INTEGER NOT NULL DEFAULT 1,
    dob TEXT,                          -- YYYY-MM-DD, for age verification
    deleted_at TEXT,                   -- set on account deletion (GDPR right to erasure)
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    last_login_at TEXT
);

-- ─── Progressive user bans ────────────────────────────────────────────────────
-- 1st ban = 7 days, 2nd = 14 days, 3rd+ = 30 days
CREATE TABLE IF NOT EXISTS user_bans (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL REFERENCES users(id),
    reason TEXT,
    banned_at TEXT NOT NULL DEFAULT (datetime('now')),
    expires_at TEXT NOT NULL,
    lifted_at TEXT,
    lifted_by TEXT,
    banned_by TEXT,
    ban_number INTEGER NOT NULL,
    duration_days INTEGER NOT NULL
);

-- ─── Monitoring / safety consent ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_consents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL REFERENCES users(id),
    consent_type TEXT NOT NULL DEFAULT 'monitoring_warning',
    accepted_at TEXT NOT NULL DEFAULT (datetime('now')),
    ip_address TEXT,
    user_agent TEXT,
    UNIQUE(user_id, consent_type)
);

-- ─── Phone OTP codes ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS otp_codes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    phone TEXT NOT NULL,
    code TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    used INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ─── Audit log ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS audit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_type TEXT NOT NULL,
    actor_id TEXT,
    target_id TEXT,
    details TEXT,
    ip_address TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ─── AI / Smart-match preferences (stored per-user, updated on queue join) ───
CREATE TABLE IF NOT EXISTS user_match_prefs (
    user_id TEXT PRIMARY KEY REFERENCES users(id),
    energy_level TEXT,           -- 'chill' | 'normal' | 'hype'
    intent TEXT,                 -- 'talk' | 'play' | 'flirt' | 'learn'
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ─── Post-chat feedback ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS chat_feedback (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL REFERENCES sessions(id),
    user_id TEXT NOT NULL REFERENCES users(id),
    mood TEXT NOT NULL,          -- 'fun' | 'awkward' | 'uncomfortable'
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(session_id, user_id)
);

-- ─── AI session metadata (warm-up prompts, co-host events) ────────────────────
CREATE TABLE IF NOT EXISTS session_ai_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL REFERENCES sessions(id),
    event_type TEXT NOT NULL,    -- 'warmup_sent' | 'cohost_prompt' | 'silence_detected'
    payload TEXT,                -- JSON blob
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ─── User blocks ─────────────────────────────────────────────────────────────
-- Prevents blocked users from being matched together again.
CREATE TABLE IF NOT EXISTS user_blocks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    blocker_id TEXT NOT NULL REFERENCES users(id),
    blocked_id TEXT NOT NULL REFERENCES users(id),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(blocker_id, blocked_id)
);

-- ─── Schema migrations (safe to re-run) ──────────────────────────────────────
-- Add columns that may not exist in databases created before this migration.
-- SQLite does not support IF NOT EXISTS for ALTER TABLE columns,
-- so errors are silently swallowed by the app on startup.
-- (Handled in db/connection.ts)

-- ─── Indexes ──────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_bans_identifier ON bans(identifier);
CREATE INDEX IF NOT EXISTS idx_reports_status ON reports(status);
CREATE INDEX IF NOT EXISTS idx_sessions_active ON sessions(ended_at) WHERE ended_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone);
CREATE INDEX IF NOT EXISTS idx_users_facebook ON users(facebook_id);
CREATE INDEX IF NOT EXISTS idx_user_bans_user ON user_bans(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_event ON audit_logs(event_type);
CREATE INDEX IF NOT EXISTS idx_otp_phone ON otp_codes(phone, used);
CREATE INDEX IF NOT EXISTS idx_chat_feedback_session ON chat_feedback(session_id);
CREATE INDEX IF NOT EXISTS idx_session_ai_events ON session_ai_events(session_id);
CREATE INDEX IF NOT EXISTS idx_user_blocks_blocker ON user_blocks(blocker_id);
CREATE INDEX IF NOT EXISTS idx_user_blocks_blocked ON user_blocks(blocked_id);
CREATE INDEX IF NOT EXISTS idx_reports_priority ON reports(is_priority, status);
