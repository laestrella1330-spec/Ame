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
  const [monitorInfo, setMonitorInfo] = useState<{ userA: string; userB: string; startedAt: string; socketA: string; socketB: string } | null>(null);
  const [monitorError, setMonitorError] = useState<string | null>(null);
  const monitorPanelRef = useRef<HTMLDivElement>(null);
  const monitorMsgsEndRef = useRef<HTMLDivElement>(null);
  // Video monitoring — one RTCPeerConnection per user socket
  const adminPcsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const socketUserMapRef = useRef<{ socketA: string; socketB: string } | null>(null);
  const [streamA, setStreamA] = useState<MediaStream | null>(null);
  const [streamB, setStreamB] = useState<MediaStream | null>(null);
  const videoARef = useRef<HTMLVideoElement>(null);
  const videoBRef = useRef<HTMLVideoElement>(null);

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

  // Scroll the monitor panel into view when monitoring starts
  useEffect(() => {
    if (monitoredSession && monitorPanelRef.current) {
      setTimeout(() => monitorPanelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
    }
  }, [monitoredSession]);

  // Auto-scroll message feed to latest message
  useEffect(() => {
    monitorMsgsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [monitorMessages]);

  // Bind video streams to video elements (srcObject can't be set via JSX)
  // Call play() explicitly to bypass browser autoplay policies.
  useEffect(() => {
    if (videoARef.current) {
      videoARef.current.srcObject = streamA;
      if (streamA) videoARef.current.play().catch(() => {});
    }
  }, [streamA]);
  useEffect(() => {
    if (videoBRef.current) {
      videoBRef.current.srcObject = streamB;
      if (streamB) videoBRef.current.play().catch(() => {});
    }
  }, [streamB]);

  // Admin Socket for monitoring
  useEffect(() => {
    const token = localStorage.getItem('admin_token') ?? '';
    const sock = io(window.location.origin, { autoConnect: false, auth: { token } });
    adminSocketRef.current = sock;
    sock.connect();

    // Admin-initiates: after monitor-started, admin sends recvonly offers to each user.
    // Users respond with their video stream (sendonly answer).
    sock.on('monitor-started', async (data: { sessionId: string; userA: string; userB: string; startedAt: string; socketA: string; socketB: string }) => {
      setMonitoredSession(data.sessionId);
      setMonitorInfo({ userA: data.userA, userB: data.userB, startedAt: data.startedAt, socketA: data.socketA, socketB: data.socketB });
      socketUserMapRef.current = { socketA: data.socketA, socketB: data.socketB };
      setMonitorMessages([]);
      setStreamA(null);
      setStreamB(null);

      // Initiate a recvonly WebRTC connection to each user socket
      for (const [userSocketId, isUserA] of [[data.socketA, true], [data.socketB, false]] as const) {
        try {
          const pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });

          pc.onicecandidate = (event) => {
            if (event.candidate) {
              sock.emit('admin-relay', {
                to: userSocketId,
                event: 'admin-stream-ice',
                data: { candidate: event.candidate },
              });
            }
          };

          pc.ontrack = (event) => {
            const stream = (event.streams && event.streams[0]) || new MediaStream([event.track]);
            if (isUserA) setStreamA(stream);
            else setStreamB(stream);
          };

          adminPcsRef.current.set(userSocketId, pc);

          // recvonly transceivers — admin only receives, never sends
          pc.addTransceiver('video', { direction: 'recvonly' });
          pc.addTransceiver('audio', { direction: 'recvonly' });

          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);

          sock.emit('admin-relay', {
            to: userSocketId,
            event: 'admin-stream-offer',
            data: { sdp: pc.localDescription },
          });
        } catch (err) {
          if (import.meta.env.DEV) console.error('[Admin monitor] Offer error for', userSocketId, err);
        }
      }
    });

    sock.on('monitor-error', (data: { message: string }) => {
      setMonitorError(data.message);
      setTimeout(() => setMonitorError(null), 5000);
    });

    sock.on('monitor-chat-message', (msg: MonitorMessage) => {
      setMonitorMessages((prev) => [...prev.slice(-199), msg]);
    });

    sock.on('monitor-ended', () => {
      setMonitoredSession(null);
      setMonitorInfo(null);
    });

    // Receive user's answer after they respond to our offer
    sock.on('admin-stream-answer', async (data: { sdp: RTCSessionDescriptionInit; fromSocketId: string }) => {
      const pc = adminPcsRef.current.get(data.fromSocketId);
      if (!pc) return;
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
      } catch (err) {
        if (import.meta.env.DEV) console.error('[Admin monitor] Answer error:', err);
      }
    });

    // Receive ICE candidates from users
    sock.on('admin-stream-ice', (data: { candidate: RTCIceCandidateInit; fromSocketId: string }) => {
      const pc = adminPcsRef.current.get(data.fromSocketId);
      if (!pc) return;
      pc.addIceCandidate(new RTCIceCandidate(data.candidate)).catch(() => {});
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
      // Close all video peer connections
      for (const [, pc] of adminPcsRef.current) pc.close();
      adminPcsRef.current.clear();
      socketUserMapRef.current = null;
      setStreamA(null);
      setStreamB(null);
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

            {/* ── Live Monitor Room (shown first when active) ── */}
            {monitoredSession && (
              <div ref={monitorPanelRef} className="glass rounded-2xl border border-violet-500/40 overflow-hidden">
                {/* Room header */}
                <div className="flex items-center justify-between px-5 py-4 bg-violet-600/15 border-b border-violet-500/25">
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="w-2.5 h-2.5 rounded-full bg-green-400 animate-pulse shrink-0" />
                    <span className="text-white font-semibold">Live Monitor Room</span>
                    <span className="text-slate-500 text-xs font-mono">#{monitoredSession.slice(0, 8)}</span>
                    {monitorInfo && (
                      <>
                        <span className="hidden sm:block text-slate-600 text-xs">|</span>
                        <span className="text-slate-400 text-xs">
                          <span className="text-blue-400">User A</span> {monitorInfo.userA.slice(0, 10)}…
                          {' '}<span className="text-slate-600">↔</span>{' '}
                          <span className="text-emerald-400">User B</span> {monitorInfo.userB?.slice(0, 10) ?? '?'}…
                        </span>
                        <span className="text-slate-600 text-xs">
                          started {new Date(monitorInfo.startedAt).toLocaleTimeString()}
                        </span>
                      </>
                    )}
                  </div>
                  <button
                    onClick={handleStopMonitor}
                    className="px-3 py-1.5 bg-red-600/20 hover:bg-red-600/40 text-red-400 rounded-lg text-xs border border-red-600/30 transition-all shrink-0"
                  >
                    Stop Monitoring
                  </button>
                </div>

                {/* Live Video Feeds */}
                <div className="grid grid-cols-2 gap-3 p-4 bg-black/40 border-b border-white/5">
                  {/* User A video — always in DOM so ref + srcObject never loses the element */}
                  <div>
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="text-xs text-blue-400 font-medium">User A — Live Video</span>
                      {streamA && <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />}
                    </div>
                    {/* padding-bottom trick for reliable 16:9 ratio (no aspect-ratio CSS needed) */}
                    <div className="relative w-full rounded-xl overflow-hidden border border-blue-500/30 bg-slate-800/60" style={{ paddingBottom: '56.25%' }}>
                      <video
                        ref={videoARef}
                        autoPlay
                        playsInline
                        muted
                        className="absolute inset-0 w-full h-full object-cover"
                        style={{ display: streamA ? 'block' : 'none' }}
                      />
                      {!streamA && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-slate-400">
                          <span className="text-3xl">📷</span>
                          <span className="text-xs font-medium">Connecting…</span>
                        </div>
                      )}
                    </div>
                  </div>
                  {/* User B video */}
                  <div>
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="text-xs text-emerald-400 font-medium">User B — Live Video</span>
                      {streamB && <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />}
                    </div>
                    <div className="relative w-full rounded-xl overflow-hidden border border-emerald-500/30 bg-slate-800/60" style={{ paddingBottom: '56.25%' }}>
                      <video
                        ref={videoBRef}
                        autoPlay
                        playsInline
                        muted
                        className="absolute inset-0 w-full h-full object-cover"
                        style={{ display: streamB ? 'block' : 'none' }}
                      />
                      {!streamB && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-slate-400">
                          <span className="text-3xl">📷</span>
                          <span className="text-xs font-medium">Connecting…</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Legend */}
                <div className="flex gap-4 px-5 py-2 bg-black/10 border-b border-white/5 text-xs">
                  <span className="text-blue-400 font-medium">■ User A</span>
                  <span className="text-emerald-400 font-medium">■ User B</span>
                  <span className="text-slate-600 ml-auto">Read-only · users cannot see you</span>
                </div>

                {/* Message feed */}
                <div className="h-72 overflow-y-auto p-5 space-y-3 bg-black/20">
                  {monitorMessages.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-slate-600 text-sm gap-3">
                      <span className="text-4xl opacity-40">💬</span>
                      <p className="font-medium">Monitoring active</p>
                      <p className="text-xs text-slate-700">
                        Text messages sent by users will appear here in real-time.
                      </p>
                    </div>
                  ) : (
                    <>
                      {monitorMessages.map((m, i) => {
                        const isUserA = monitorInfo && m.fromUserId === monitorInfo.userA;
                        return (
                          <div
                            key={i}
                            className={`flex gap-3 ${isUserA ? 'justify-start' : 'justify-end'}`}
                          >
                            {isUserA && (
                              <div className="shrink-0 w-7 h-7 rounded-full bg-blue-600/30 border border-blue-500/30 flex items-center justify-center text-xs text-blue-400 font-bold">
                                A
                              </div>
                            )}
                            <div className={`max-w-[65%] ${isUserA ? '' : 'order-first'}`}>
                              <div
                                className={`px-3 py-2 rounded-2xl text-sm break-words ${
                                  isUserA
                                    ? 'bg-blue-600/20 text-blue-100 rounded-tl-sm border border-blue-500/20'
                                    : 'bg-emerald-600/20 text-emerald-100 rounded-tr-sm border border-emerald-500/20'
                                }`}
                              >
                                {m.text}
                              </div>
                              <div className={`text-xs text-slate-600 mt-0.5 ${isUserA ? 'text-left' : 'text-right'}`}>
                                {new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                              </div>
                            </div>
                            {!isUserA && (
                              <div className="shrink-0 w-7 h-7 rounded-full bg-emerald-600/30 border border-emerald-500/30 flex items-center justify-center text-xs text-emerald-400 font-bold">
                                B
                              </div>
                            )}
                          </div>
                        );
                      })}
                      <div ref={monitorMsgsEndRef} />
                    </>
                  )}
                </div>
              </div>
            )}

            {/* Monitor error toast */}
            {monitorError && (
              <div className="flex items-center gap-2 px-4 py-3 bg-red-600/15 border border-red-500/30 rounded-xl text-red-400 text-sm">
                <span>⚠️</span>
                <span>{monitorError}</span>
              </div>
            )}

            {/* Sessions list header */}
            <div className="flex items-center justify-between">
              <h3 className="text-slate-300 text-sm font-medium">
                {activeSessions.length === 0 ? 'No active sessions' : `${activeSessions.length} active session${activeSessions.length !== 1 ? 's' : ''}`}
              </h3>
              <button
                onClick={fetchSessions}
                className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-slate-300 rounded-lg text-sm border border-white/10"
              >
                Refresh
              </button>
            </div>

            {/* Sessions table */}
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
                      <tr key={s.id} className={`border-t border-white/5 transition-colors ${monitoredSession === s.id ? 'bg-violet-600/10' : 'hover:bg-white/[0.02]'}`}>
                        <td className="p-3 text-white font-mono text-xs">{s.id.slice(0, 12)}…</td>
                        <td className="p-3 text-blue-400/70 font-mono text-xs">{s.user_a_id.slice(0, 10)}…</td>
                        <td className="p-3 text-emerald-400/70 font-mono text-xs">{s.user_b_id?.slice(0, 10) ?? '(waiting)'}</td>
                        <td className="p-3 text-slate-400 text-xs">{new Date(s.started_at).toLocaleTimeString()}</td>
                        <td className="p-3">
                          {monitoredSession === s.id ? (
                            <span className="inline-flex items-center gap-1.5 px-2 py-1 bg-violet-600/20 text-violet-300 rounded text-xs border border-violet-600/30">
                              <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                              Live
                            </span>
                          ) : (
                            <button
                              onClick={() => handleMonitor(s.id)}
                              className="px-3 py-1.5 bg-violet-600/30 hover:bg-violet-600/50 text-violet-300 rounded-lg text-xs border border-violet-600/30 transition-all font-medium"
                            >
                              Open Room
                            </button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
