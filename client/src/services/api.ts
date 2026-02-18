const API_BASE = '/api';

function getAdminHeaders(): HeadersInit {
  const token = localStorage.getItem('admin_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function getUserHeaders(): HeadersInit {
  const token = localStorage.getItem('user_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

// ── Admin API helpers ─────────────────────────────────────────────────────────

export async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, { headers: getAdminHeaders() });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getAdminHeaders() },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function apiPatch<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...getAdminHeaders() },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function apiDelete(path: string): Promise<void> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'DELETE',
    headers: getAdminHeaders(),
  });
  if (!res.ok) throw new Error(await res.text());
}

// ── User API helpers (use user_token) ─────────────────────────────────────────

export async function userGet<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, { headers: getUserHeaders() });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText })) as Record<string, unknown>;
    throw Object.assign(new Error(String(err.error || res.statusText)), { status: res.status, data: err });
  }
  return res.json();
}

export async function userPost<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getUserHeaders() },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText })) as Record<string, unknown>;
    throw Object.assign(new Error(String(err.error || res.statusText)), { status: res.status, data: err });
  }
  return res.json();
}
