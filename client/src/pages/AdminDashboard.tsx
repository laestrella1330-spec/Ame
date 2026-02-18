import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiGet, apiPatch, apiPost, apiDelete } from '../services/api';
import { io, Socket } from 'socket.io-client';

interface Stats {
  todaySessions: number;
  avgDuration: number;
  totalSessions: number;
  activeBans: number;
  pendingReports: number;
}

interface Report {
  id: number;
  session_id: string;
  reporter_id: string;
  reported_id: string;
  reason: string;
  description: string | null;
  status: string;
  created_at: string;
}

interface IpBan {
  id: number;
  identifier: string;
  identifier_type: string;
  reason: string | null;
  banned_at: string;
  expires_at: string | null;
}

interface AppUser {
  id: string;
  display_name: string;
  email: string | null;
  phone: string | null;
  role: string;
  created_at: string;
  last_login_at: string | null;
  isBanned: boolean;
}

interface UserBan {
  id: number;
  user_id: string;
  reason: string | null;
  banned_at: string;
  expires_at: string;
  lifted_at: string | null;
  ban_number: number;
  duration_days: number;
  banned_by: string | null;
}

interface ActiveSession {
  id: string;
  user_a_id: string;
  user_b_id: string | null;
  started_at: string;
}

interface MonitorMessage {
  sessionId: string;
  fromUserId: string;
  text: string;
  timestamp: string;
}

type Tab = 'reports' | 'bans' | 'users' | 'sessions';

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<Stats | null>(null);
  const [reports, setReports] = useState<Report[]>([]);
  const [bans, setBans] = useState<IpBan[]>([]);
  const [users, setUsers] = useState<AppUser[]>([]);
  const [activeSessions, setActiveSessions] = useState<ActiveSession[]>([]);
  const [activeTab, setActiveTab] = useState<Tab>('reports');

  // Ban form
  const [banIp, setBanIp] = useState('');
  const [banReason, setBanReason] = useState('');

  // User ban
  const [banUserId, setBanUserId] = useState<string | null>(null);
  const [banUserReason, setBanUserReason] = useState('');
  const [userBanHistory, setUserBanHistory] = useState<{ userId: string; bans: UserBan[] } | null>(null);

  // Monitoring
  const adminSocketRef = useRef<Socket | null>(null);
  const [monitoredSession, setMonitoredSession] = useState<string | null>(null);
  const [monitorMessages, setMonitorMessages] = useState<MonitorMessage[]>([]);
  const [monitorInfo, setMonitorInfo] = useState<{ userA: string; userB: string; startedAt: string } | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const [statsData, reportsData, bansData] = await Promise.all([
        apiGet<Stats>('/sessions/stats'),
        apiGet<{ reports: Report[] }>('/reports?status=pending&limit=50'),
        apiGet<{ bans: IpBan[] }>('/bans?limit=50'),
      ]);
      setStats(statsData);
      setReports(reportsData.reports);
      setBans(bansData.bans);
    } catch {
      localStorage.removeItem('admin_token');
      navigate('/admin/login');
    }
  }, [navigate]);

  const fetchUsers = useCallback(async () => {
    try {
      const data = await apiGet<{ users: AppUser[]; total: number }>('/users?limit=100');
      setUsers(data.users);
    } catch { /* ignore */ }
  }, []);

  const fetchSessions = useCallback(async () => {
    try {
      const data = await apiGet<{ sessions: ActiveSession[] }>('/users/active-sessions');
      setActiveSessions(data.sessions);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, [fetchData]);

  useEffect(() => {
    if (activeTab === 'users') fetchUsers();
    if (activeTab === 'sessions') fetchSessions();
  }, [activeTab, fetchUsers, fetchSessions]);

  // Admin Socket for monitoring
  useEffect(() => {
    const token = localStorage.getItem('admin_token') ?? '';
    const sock = io(window.location.origin, { autoConnect: false, auth: { token } });
    adminSocketRef.current = sock;
    sock.connect();

    sock.on('monitor-started', (data: { sessionId: string; userA: string; userB: string; startedAt: string }) => {
      setMonitoredSession(data.sessionId);
      setMonitorInfo({ userA: data.userA, userB: data.userB, startedAt: data.startedAt });
      setMonitorMessages([]);
    });

    sock.on('monitor-chat-message', (msg: MonitorMessage) => {
      setMonitorMessages((prev) => [...prev.slice(-199), msg]);
    });

    sock.on('monitor-ended', () => {
      setMonitoredSession(null);
      setMonitorInfo(null);
    });

    return () => {
      sock.disconnect();
    };
  }, []);

  const handleMonitor = (sessionId: string) => {
    adminSocketRef.current?.emit('admin-monitor-room', { sessionId });
  };

  const handleStopMonitor = () => {
    if (monitoredSession) {
      adminSocketRef.current?.emit('admin-stop-monitor', { sessionId: monitoredSession });
      setMonitoredSession(null);
      setMonitorInfo(null);
      setMonitorMessages([]);
    }
  };

  const handleReportAction = async (id: number, status: string) => {
    await apiPatch(`/reports/${id}`, { status });
    fetchData();
  };

  const handleBanFromReport = async (report: Report) => {
    await apiPost('/bans', {
      identifier: report.reported_id,
      identifierType: 'ip',
      reason: `Report #${report.id}: ${report.reason}`,
    });
    await apiPatch(`/reports/${report.id}`, { status: 'actioned' });
    fetchData();
  };

  const handleAddIpBan = async () => {
    if (!banIp) return;
    await apiPost('/bans', { identifier: banIp, identifierType: 'ip', reason: banReason || null });
    setBanIp('');
    setBanReason('');
    fetchData();
  };

  const handleRemoveIpBan = async (id: number) => {
    await apiDelete(`/bans/${id}`);
    fetchData();
  };

  const handleBanUser = async () => {
    if (!banUserId) return;
    await apiPost(`/users/${banUserId}/ban`, { reason: banUserReason || null });
    setBanUserId(null);
    setBanUserReason('');
    fetchUsers();
  };

  const handleUnbanUser = async (userId: string) => {
    await apiDelete(`/users/${userId}/ban`);
    fetchUsers();
  };

  const handleViewBanHistory = async (userId: string) => {
    const data = await apiGet<{ bans: UserBan[] }>(`/users/${userId}/bans`);
    setUserBanHistory({ userId, bans: data.bans });
  };

  const handleLogout = () => {
    localStorage.removeItem('admin_token');
    navigate('/admin/login');
  };

  const tabs: { key: Tab; label: string; count?: number }[] = [
    { key: 'reports', label: 'Reports', count: reports.length },
    { key: 'bans', label: 'IP Bans', count: bans.length },
    { key: 'users', label: 'Users', count: users.length },
    { key: 'sessions', label: 'Live Sessions', count: activeSessions.length },
  ];

  return (
    <div className="min-h-screen p-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gradient">Ame Admin</h1>
          <button
            onClick={handleLogout}
            className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg text-sm border border-white/10"
          >
            Logout
          </button>
        </div>

        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
            {[
              { label: 'Sessions Today', value: stats.todaySessions },
              { label: 'Avg Duration', value: `${stats.avgDuration}s` },
              { label: 'Total Sessions', value: stats.totalSessions },
              { label: 'Active Bans', value: stats.activeBans },
              { label: 'Pending Reports', value: stats.pendingReports },
            ].map((stat) => (
              <div key={stat.label} className="glass rounded-xl p-4">
                <div className="text-slate-400 text-xs">{stat.label}</div>
                <div className="text-white text-2xl font-bold">{stat.value}</div>
              </div>
            ))}
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-2 mb-4 flex-wrap">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === t.key
                  ? 'btn-gradient text-white'
                  : 'bg-white/10 text-slate-300 border border-white/10'
              }`}
            >
              {t.label}{t.count !== undefined ? ` (${t.count})` : ''}
            </button>
          ))}
        </div>

        {/* ── Reports Tab ── */}
        {activeTab === 'reports' && (
          <div className="glass rounded-2xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-white/5 text-slate-300">
                  <th className="p-3 text-left">ID</th>
                  <th className="p-3 text-left">Reason</th>
                  <th className="p-3 text-left">Description</th>
                  <th className="p-3 text-left">Status</th>
                  <th className="p-3 text-left">Date</th>
                  <th className="p-3 text-left">Actions</th>
                </tr>
              </thead>
              <tbody>
                {reports.length === 0 ? (
                  <tr><td colSpan={6} className="p-6 text-center text-slate-500">No pending reports</td></tr>
                ) : (
                  reports.map((r) => (
                    <tr key={r.id} className="border-t border-white/5">
                      <td className="p-3 text-white">#{r.id}</td>
                      <td className="p-3 text-white capitalize">{r.reason}</td>
                      <td className="p-3 text-slate-400 max-w-xs truncate">{r.description || '-'}</td>
                      <td className="p-3">
                        <span className="px-2 py-1 rounded text-xs bg-yellow-600/20 text-yellow-400">{r.status}</span>
                      </td>
                      <td className="p-3 text-slate-400">{new Date(r.created_at).toLocaleDateString()}</td>
                      <td className="p-3 flex gap-2">
                        <button
                          onClick={() => handleReportAction(r.id, 'dismissed')}
                          className="px-2 py-1 bg-white/10 hover:bg-white/20 text-white rounded text-xs border border-white/10"
                        >
                          Dismiss
                        </button>
                        <button
                          onClick={() => handleBanFromReport(r)}
                          className="px-2 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-xs"
                        >
                          IP Ban
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* ── IP Bans Tab ── */}
        {activeTab === 'bans' && (
          <div>
            <div className="glass rounded-2xl p-4 mb-4 flex gap-3 items-end flex-wrap">
              <div className="flex-1 min-w-40">
                <label className="block text-xs text-slate-400 mb-1">IP Address</label>
                <input
                  type="text"
                  value={banIp}
                  onChange={(e) => setBanIp(e.target.value)}
                  placeholder="e.g. 192.168.1.1"
                  className="w-full p-2 bg-white/5 text-white rounded-lg border border-white/10 text-sm focus:border-violet-500 focus:outline-none"
                />
              </div>
              <div className="flex-1 min-w-40">
                <label className="block text-xs text-slate-400 mb-1">Reason</label>
                <input
                  type="text"
                  value={banReason}
                  onChange={(e) => setBanReason(e.target.value)}
                  placeholder="Optional reason"
                  className="w-full p-2 bg-white/5 text-white rounded-lg border border-white/10 text-sm focus:border-violet-500 focus:outline-none"
                />
              </div>
              <button onClick={handleAddIpBan} className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm">
                Add Ban
              </button>
            </div>
            <div className="glass rounded-2xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-white/5 text-slate-300">
                    <th className="p-3 text-left">ID</th>
                    <th className="p-3 text-left">Identifier</th>
                    <th className="p-3 text-left">Type</th>
                    <th className="p-3 text-left">Reason</th>
                    <th className="p-3 text-left">Banned At</th>
                    <th className="p-3 text-left">Expires</th>
                    <th className="p-3 text-left">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {bans.length === 0 ? (
                    <tr><td colSpan={7} className="p-6 text-center text-slate-500">No active IP bans</td></tr>
                  ) : (
                    bans.map((b) => (
                      <tr key={b.id} className="border-t border-white/5">
                        <td className="p-3 text-white">#{b.id}</td>
                        <td className="p-3 text-white font-mono text-xs">{b.identifier}</td>
                        <td className="p-3 text-slate-400">{b.identifier_type}</td>
                        <td className="p-3 text-slate-400">{b.reason || '-'}</td>
                        <td className="p-3 text-slate-400">{new Date(b.banned_at).toLocaleDateString()}</td>
                        <td className="p-3 text-slate-400">{b.expires_at ? new Date(b.expires_at).toLocaleDateString() : 'Never'}</td>
                        <td className="p-3">
                          <button onClick={() => handleRemoveIpBan(b.id)} className="px-2 py-1 bg-green-600 hover:bg-green-700 text-white rounded text-xs">
                            Unban
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── Users Tab ── */}
        {activeTab === 'users' && (
          <div>
            {/* Ban user confirmation form */}
            {banUserId && (
              <div className="glass rounded-2xl p-4 mb-4 border border-red-600/30">
                <p className="text-red-400 text-sm mb-3">
                  Ban user <span className="font-mono">{banUserId.slice(0, 12)}…</span>?
                </p>
                <div className="flex gap-3 items-end">
                  <div className="flex-1">
                    <label className="block text-xs text-slate-400 mb-1">Reason (optional)</label>
                    <input
                      type="text"
                      value={banUserReason}
                      onChange={(e) => setBanUserReason(e.target.value)}
                      placeholder="e.g. harassment"
                      className="w-full p-2 bg-white/5 text-white rounded-lg border border-white/10 text-sm focus:border-violet-500 focus:outline-none"
                    />
                  </div>
                  <button onClick={handleBanUser} className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm">
                    Confirm Ban
                  </button>
                  <button onClick={() => setBanUserId(null)} className="px-4 py-2 bg-white/10 hover:bg-white/20 text-slate-300 rounded-lg text-sm border border-white/10">
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* Ban history panel */}
            {userBanHistory && (
              <div className="glass rounded-2xl p-4 mb-4 border border-slate-600/30">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-slate-300 text-sm font-medium">
                    Ban history for <span className="font-mono text-xs">{userBanHistory.userId.slice(0, 12)}…</span>
                  </span>
                  <button onClick={() => setUserBanHistory(null)} className="text-slate-500 hover:text-white text-xs">Close</button>
                </div>
                {userBanHistory.bans.length === 0 ? (
                  <p className="text-slate-500 text-sm">No ban history.</p>
                ) : (
                  <div className="space-y-2">
                    {userBanHistory.bans.map((b) => (
                      <div key={b.id} className="bg-white/5 rounded-lg p-3 text-xs text-slate-300">
                        <span className="text-red-400">Ban #{b.ban_number}</span>{' '}
                        — {b.duration_days}d — {b.reason || 'No reason'} —{' '}
                        {b.lifted_at ? <span className="text-green-400">Lifted</span> : <span className="text-yellow-400">Active</span>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="glass rounded-2xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-white/5 text-slate-300">
                    <th className="p-3 text-left">User</th>
                    <th className="p-3 text-left">Contact</th>
                    <th className="p-3 text-left">Role</th>
                    <th className="p-3 text-left">Joined</th>
                    <th className="p-3 text-left">Last Login</th>
                    <th className="p-3 text-left">Status</th>
                    <th className="p-3 text-left">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.length === 0 ? (
                    <tr><td colSpan={7} className="p-6 text-center text-slate-500">No users found</td></tr>
                  ) : (
                    users.map((u) => (
                      <tr key={u.id} className="border-t border-white/5">
                        <td className="p-3">
                          <div className="text-white text-sm">{u.display_name}</div>
                          <div className="text-slate-500 text-xs font-mono">{u.id.slice(0, 10)}…</div>
                        </td>
                        <td className="p-3 text-slate-400 text-xs">
                          {u.email || u.phone || 'Facebook'}
                        </td>
                        <td className="p-3">
                          <span className={`px-2 py-0.5 rounded text-xs ${u.role === 'admin' ? 'bg-violet-600/30 text-violet-400' : 'bg-white/10 text-slate-400'}`}>
                            {u.role}
                          </span>
                        </td>
                        <td className="p-3 text-slate-400 text-xs">{new Date(u.created_at).toLocaleDateString()}</td>
                        <td className="p-3 text-slate-400 text-xs">
                          {u.last_login_at ? new Date(u.last_login_at).toLocaleDateString() : '-'}
                        </td>
                        <td className="p-3">
                          <span className={`px-2 py-0.5 rounded text-xs ${u.isBanned ? 'bg-red-600/20 text-red-400' : 'bg-green-600/20 text-green-400'}`}>
                            {u.isBanned ? 'Banned' : 'Active'}
                          </span>
                        </td>
                        <td className="p-3">
                          <div className="flex gap-1 flex-wrap">
                            <button
                              onClick={() => handleViewBanHistory(u.id)}
                              className="px-2 py-1 bg-white/10 hover:bg-white/20 text-slate-300 rounded text-xs border border-white/10"
                            >
                              History
                            </button>
                            {u.isBanned ? (
                              <button
                                onClick={() => handleUnbanUser(u.id)}
                                className="px-2 py-1 bg-green-600 hover:bg-green-700 text-white rounded text-xs"
                              >
                                Unban
                              </button>
                            ) : (
                              u.role !== 'admin' && (
                                <button
                                  onClick={() => setBanUserId(u.id)}
                                  className="px-2 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-xs"
                                >
                                  Ban
                                </button>
                              )
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── Active Sessions Tab ── */}
        {activeTab === 'sessions' && (
          <div className="space-y-4">
            <div className="flex justify-end">
              <button
                onClick={fetchSessions}
                className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-slate-300 rounded-lg text-sm border border-white/10"
              >
                Refresh
              </button>
            </div>

            {/* Sessions list */}
            <div className="glass rounded-2xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-white/5 text-slate-300">
                    <th className="p-3 text-left">Session ID</th>
                    <th className="p-3 text-left">User A</th>
                    <th className="p-3 text-left">User B</th>
                    <th className="p-3 text-left">Started</th>
                    <th className="p-3 text-left">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {activeSessions.length === 0 ? (
                    <tr><td colSpan={5} className="p-6 text-center text-slate-500">No active sessions right now</td></tr>
                  ) : (
                    activeSessions.map((s) => (
                      <tr key={s.id} className={`border-t border-white/5 ${monitoredSession === s.id ? 'bg-violet-600/10' : ''}`}>
                        <td className="p-3 text-white font-mono text-xs">{s.id.slice(0, 12)}…</td>
                        <td className="p-3 text-slate-400 font-mono text-xs">{s.user_a_id.slice(0, 10)}…</td>
                        <td className="p-3 text-slate-400 font-mono text-xs">{s.user_b_id?.slice(0, 10) ?? '(waiting)'}</td>
                        <td className="p-3 text-slate-400 text-xs">{new Date(s.started_at).toLocaleTimeString()}</td>
                        <td className="p-3">
                          {monitoredSession === s.id ? (
                            <span className="inline-flex items-center gap-1.5 px-2 py-1 bg-violet-600/20 text-violet-400 rounded text-xs border border-violet-600/30">
                              <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-pulse" />
                              Monitoring
                            </span>
                          ) : (
                            <button
                              onClick={() => handleMonitor(s.id)}
                              className="px-3 py-1 bg-violet-600/30 hover:bg-violet-600/50 text-violet-400 rounded text-xs border border-violet-600/30 transition-all"
                            >
                              Monitor Room
                            </button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Inline monitoring room — appears when a session is being monitored */}
            {monitoredSession && (
              <div className="glass rounded-2xl border border-violet-500/40 overflow-hidden">
                {/* Room header */}
                <div className="flex items-center justify-between px-4 py-3 bg-violet-600/10 border-b border-violet-500/20">
                  <div className="flex items-center gap-3">
                    <span className="w-2 h-2 rounded-full bg-violet-400 animate-pulse" />
                    <span className="text-violet-300 font-semibold text-sm">Live Monitor Room</span>
                    <span className="text-slate-500 text-xs font-mono">#{monitoredSession.slice(0, 8)}</span>
                    {monitorInfo && (
                      <span className="text-slate-400 text-xs">
                        {monitorInfo.userA.slice(0, 8)}… ↔ {monitorInfo.userB?.slice(0, 8) ?? '?'}…
                      </span>
                    )}
                  </div>
                  <button
                    onClick={handleStopMonitor}
                    className="px-3 py-1 bg-red-600/20 hover:bg-red-600/40 text-red-400 rounded-lg text-xs border border-red-600/30 transition-all"
                  >
                    Stop Monitoring
                  </button>
                </div>

                {/* Message feed */}
                <div className="h-72 overflow-y-auto p-4 space-y-2 bg-black/20">
                  {monitorMessages.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-slate-600 text-sm gap-2">
                      <span className="text-2xl">👁️</span>
                      <p>Monitoring active — waiting for messages…</p>
                      <p className="text-xs">Text messages sent by users in this room will appear here.</p>
                    </div>
                  ) : (
                    monitorMessages.map((m, i) => (
                      <div key={i} className="flex items-start gap-3 text-sm">
                        <span className="text-slate-600 text-xs shrink-0 pt-0.5 w-16">
                          {new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </span>
                        <span className="text-violet-400 text-xs shrink-0 font-mono pt-0.5">
                          {m.fromUserId.slice(0, 8)}…
                        </span>
                        <span className="text-slate-200 break-words">{m.text}</span>
                      </div>
                    ))
                  )}
                </div>

                <div className="px-4 py-2 bg-black/10 border-t border-white/5 text-xs text-slate-600">
                  Read-only observer mode — users cannot see that you are monitoring.
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
