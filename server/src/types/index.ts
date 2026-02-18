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

export interface QueueEntry {
  socketId: string;
  ip: string;
  joinedAt: Date;
}

export interface ActiveMatch {
  sessionId: string;
  socketA: string;
  socketB: string;
}
