import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiGet, apiPatch, apiPost, apiDelete } from '../services/api';

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

interface Ban {
  id: number;
  identifier: string;
  identifier_type: string;
  reason: string | null;
  banned_at: string;
  expires_at: string | null;
}

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<Stats | null>(null);
  const [reports, setReports] = useState<Report[]>([]);
  const [bans, setBans] = useState<Ban[]>([]);
  const [activeTab, setActiveTab] = useState<'reports' | 'bans'>('reports');
  const [banIp, setBanIp] = useState('');
  const [banReason, setBanReason] = useState('');

  const fetchData = useCallback(async () => {
    try {
      const [statsData, reportsData, bansData] = await Promise.all([
        apiGet<Stats>('/sessions/stats'),
        apiGet<{ reports: Report[] }>('/reports?status=pending&limit=50'),
        apiGet<{ bans: Ban[] }>('/bans?limit=50'),
      ]);
      setStats(statsData);
      setReports(reportsData.reports);
      setBans(bansData.bans);
    } catch {
      localStorage.removeItem('admin_token');
      navigate('/admin/login');
    }
  }, [navigate]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, [fetchData]);

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

  const handleAddBan = async () => {
    if (!banIp) return;
    await apiPost('/bans', {
      identifier: banIp,
      identifierType: 'ip',
      reason: banReason || null,
    });
    setBanIp('');
    setBanReason('');
    fetchData();
  };

  const handleRemoveBan = async (id: number) => {
    await apiDelete(`/bans/${id}`);
    fetchData();
  };

  const handleLogout = () => {
    localStorage.removeItem('admin_token');
    navigate('/admin/login');
  };

  return (
    <div className="min-h-screen p-4">
      <div className="max-w-6xl mx-auto">
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
        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setActiveTab('reports')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'reports' ? 'btn-gradient text-white' : 'bg-white/10 text-slate-300 border border-white/10'
            }`}
          >
            Reports ({reports.length})
          </button>
          <button
            onClick={() => setActiveTab('bans')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'bans' ? 'btn-gradient text-white' : 'bg-white/10 text-slate-300 border border-white/10'
            }`}
          >
            Bans ({bans.length})
          </button>
        </div>

        {/* Reports Tab */}
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
                  <tr>
                    <td colSpan={6} className="p-6 text-center text-slate-500">
                      No pending reports
                    </td>
                  </tr>
                ) : (
                  reports.map((r) => (
                    <tr key={r.id} className="border-t border-white/5">
                      <td className="p-3 text-white">#{r.id}</td>
                      <td className="p-3 text-white capitalize">{r.reason}</td>
                      <td className="p-3 text-slate-400 max-w-xs truncate">
                        {r.description || '-'}
                      </td>
                      <td className="p-3">
                        <span className="px-2 py-1 rounded text-xs bg-yellow-600/20 text-yellow-400">
                          {r.status}
                        </span>
                      </td>
                      <td className="p-3 text-slate-400">
                        {new Date(r.created_at).toLocaleDateString()}
                      </td>
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
                          Ban User
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Bans Tab */}
        {activeTab === 'bans' && (
          <div>
            {/* Add Ban Form */}
            <div className="glass rounded-2xl p-4 mb-4 flex gap-3 items-end">
              <div className="flex-1">
                <label className="block text-xs text-slate-400 mb-1">IP Address</label>
                <input
                  type="text"
                  value={banIp}
                  onChange={(e) => setBanIp(e.target.value)}
                  placeholder="e.g. 192.168.1.1"
                  className="w-full p-2 bg-white/5 text-white rounded-lg border border-white/10 text-sm focus:border-violet-500 focus:outline-none"
                />
              </div>
              <div className="flex-1">
                <label className="block text-xs text-slate-400 mb-1">Reason</label>
                <input
                  type="text"
                  value={banReason}
                  onChange={(e) => setBanReason(e.target.value)}
                  placeholder="Optional reason"
                  className="w-full p-2 bg-white/5 text-white rounded-lg border border-white/10 text-sm focus:border-violet-500 focus:outline-none"
                />
              </div>
              <button
                onClick={handleAddBan}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm"
              >
                Add Ban
              </button>
            </div>

            {/* Bans Table */}
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
                    <tr>
                      <td colSpan={7} className="p-6 text-center text-slate-500">
                        No active bans
                      </td>
                    </tr>
                  ) : (
                    bans.map((b) => (
                      <tr key={b.id} className="border-t border-white/5">
                        <td className="p-3 text-white">#{b.id}</td>
                        <td className="p-3 text-white font-mono text-xs">{b.identifier}</td>
                        <td className="p-3 text-slate-400">{b.identifier_type}</td>
                        <td className="p-3 text-slate-400">{b.reason || '-'}</td>
                        <td className="p-3 text-slate-400">
                          {new Date(b.banned_at).toLocaleDateString()}
                        </td>
                        <td className="p-3 text-slate-400">
                          {b.expires_at ? new Date(b.expires_at).toLocaleDateString() : 'Never'}
                        </td>
                        <td className="p-3">
                          <button
                            onClick={() => handleRemoveBan(b.id)}
                            className="px-2 py-1 bg-green-600 hover:bg-green-700 text-white rounded text-xs"
                          >
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
      </div>
    </div>
  );
}
