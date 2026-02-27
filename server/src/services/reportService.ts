import { queryOne, queryAll, execute, lastInsertRowId } from '../db/connection.js';
import type { Report } from '../types/index.js';

// Reasons that require immediate admin attention (CSAM / child safety)
const PRIORITY_REASONS = new Set(['underage', 'csam']);

export function createReport(
  sessionId: string,
  reporterId: string,
  reportedId: string,
  reason: string,
  description: string | null
): Report {
  const isPriority = PRIORITY_REASONS.has(reason) ? 1 : 0;
  execute(
    `INSERT INTO reports (session_id, reporter_id, reported_id, reason, description, is_priority)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [sessionId, reporterId, reportedId, reason, description, isPriority]
  );
  const id = lastInsertRowId();
  return queryOne<Report>('SELECT * FROM reports WHERE id = ?', [id])!;
}

export function listReports(
  status: string | null,
  page: number = 1,
  limit: number = 20
): { reports: Report[]; total: number } {
  const offset = (page - 1) * limit;
  let query = 'SELECT * FROM reports';
  let countQuery = 'SELECT COUNT(*) as count FROM reports';
  const params: (string | number)[] = [];
  const countParams: (string | number)[] = [];

  if (status) {
    query += ' WHERE status = ?';
    countQuery += ' WHERE status = ?';
    params.push(status);
    countParams.push(status);
  }

  query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
  params.push(limit, offset);

  const reports = queryAll<Report>(query, params);
  const result = queryOne<{ count: number }>(countQuery, countParams);
  return { reports, total: result?.count ?? 0 };
}

export function updateReportStatus(
  id: number,
  status: string,
  reviewedBy: string
): Report | null {
  execute(
    `UPDATE reports SET status = ?, reviewed_at = datetime('now'), reviewed_by = ? WHERE id = ?`,
    [status, reviewedBy, id]
  );
  return queryOne<Report>('SELECT * FROM reports WHERE id = ?', [id]) ?? null;
}

export function getPendingReportsCount(): number {
  const result = queryOne<{ count: number }>(
    "SELECT COUNT(*) as count FROM reports WHERE status = 'pending'"
  );
  return result?.count ?? 0;
}
