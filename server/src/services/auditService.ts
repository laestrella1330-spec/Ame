import { execute } from '../db/connection.js';

/**
 * Log a moderation / security event.
 *
 * event_type values (convention):
 *   login_success  login_fail  register  phone_otp_sent  facebook_login
 *   consent_accepted  ban_user  unban_user
 *   monitor_start  monitor_stop  room_create  room_end
 */
export function logAudit(
  eventType: string,
  actorId: string | null,
  targetId: string | null,
  details: Record<string, unknown> | null,
  ipAddress?: string
): void {
  try {
    execute(
      `INSERT INTO audit_logs (event_type, actor_id, target_id, details, ip_address)
       VALUES (?, ?, ?, ?, ?)`,
      [
        eventType,
        actorId,
        targetId,
        details ? JSON.stringify(details) : null,
        ipAddress ?? null,
      ]
    );
  } catch {
    // Never let audit logging crash the server
  }
}
