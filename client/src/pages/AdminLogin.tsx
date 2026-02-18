import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiPost } from '../services/api';

export default function AdminLogin() {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const data = await apiPost<{ token: string }>('/auth/login', { username, password });
      localStorage.setItem('admin_token', data.token);
      navigate('/admin');
    } catch {
      setError('Invalid credentials');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <form onSubmit={handleLogin} className="glass rounded-2xl p-6 max-w-sm w-full glow-purple">
        <h1 className="text-xl font-bold text-gradient mb-4">Ame Admin</h1>

        {error && (
          <div className="bg-red-600/20 text-red-400 text-sm p-3 rounded-lg mb-4">{error}</div>
        )}

        <div className="space-y-4">
          <div>
            <label className="block text-sm text-slate-400 mb-1">Username</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full p-2 bg-white/5 text-white rounded-lg border border-white/10 focus:border-violet-500 focus:outline-none"
              required
            />
          </div>
          <div>
            <label className="block text-sm text-slate-400 mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full p-2 bg-white/5 text-white rounded-lg border border-white/10 focus:border-violet-500 focus:outline-none"
              required
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full py-2 btn-gradient disabled:bg-slate-600 text-white rounded-lg font-medium"
          >
            {loading ? 'Logging in...' : 'Login'}
          </button>
        </div>
      </form>
    </div>
  );
}
