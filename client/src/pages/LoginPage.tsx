import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { API_BASE } from '../services/api';

type Mode = 'choose' | 'email-login' | 'email-register' | 'phone';

interface BanInfo {
  reason: string;
  days: string;
}

export default function LoginPage() {
  const navigate = useNavigate();
  const { user, isLoading, login } = useAuth();
  const [mode, setMode] = useState<Mode>('choose');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [banInfo, setBanInfo] = useState<BanInfo | null>(null);

  // Email fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');

  // Phone fields
  const [phone, setPhone] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [devOtpNote, setDevOtpNote] = useState(false);
  const [devOtpCode, setDevOtpCode] = useState('');

  // Hash-based error from Facebook redirect
  useEffect(() => {
    const hash = window.location.hash;
    if (hash.includes('auth-error=banned')) {
      const reason = sessionStorage.getItem('banned_reason') ?? 'TOS violation';
      const days = sessionStorage.getItem('banned_days') ?? '0';
      setBanInfo({ reason, days });
      sessionStorage.removeItem('banned_reason');
      sessionStorage.removeItem('banned_days');
    }
    if (hash.includes('auth-error=')) {
      const errorCode = hash.match(/auth-error=([^&]+)/)?.[1] ?? 'unknown';
      if (!hash.includes('banned')) {
        setError(`Login failed: ${errorCode.replace(/_/g, ' ')}`);
      }
      window.history.replaceState(null, '', window.location.pathname);
    }
  }, []);

  // Already logged in → redirect
  useEffect(() => {
    if (!isLoading && user) {
      navigate(user.activeBan ? '/' : '/chat', { replace: true });
    }
  }, [user, isLoading, navigate]);

  const handleBannedResponse = (data: Record<string, unknown>) => {
    setBanInfo({
      reason: String(data.reason ?? 'TOS violation'),
      days: String(data.remainingDays ?? 0),
    });
  };

  // ── Email Login ──────────────────────────────────────────────────────────────
  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/auth/login/email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json() as Record<string, unknown>;
      if (!res.ok) {
        if (data.error === 'account_banned') { handleBannedResponse(data); return; }
        setError(String(data.error ?? 'Login failed'));
        return;
      }
      login(data.token as string, data.user as { id: string; displayName: string });
      navigate('/chat');
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // ── Email Register ───────────────────────────────────────────────────────────
  const handleEmailRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, displayName }),
      });
      const data = await res.json() as Record<string, unknown>;
      if (!res.ok) {
        setError(String(data.error ?? 'Registration failed'));
        return;
      }
      login(data.token as string, data.user as { id: string; displayName: string });
      navigate('/chat');
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // ── Phone OTP ────────────────────────────────────────────────────────────────
  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/auth/phone/send-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone }),
      });
      const data = await res.json() as Record<string, unknown>;
      if (!res.ok) { setError(String(data.error ?? 'Failed to send OTP')); return; }
      setOtpSent(true);
      if (data.devMode) {
        setDevOtpNote(true);
        if (data.devCode) setDevOtpCode(String(data.devCode));
      }
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/auth/phone/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, code: otpCode, displayName: displayName || undefined }),
      });
      const data = await res.json() as Record<string, unknown>;
      if (!res.ok) {
        if (data.error === 'account_banned') { handleBannedResponse(data); return; }
        setError(String(data.error ?? 'Verification failed'));
        return;
      }
      login(data.token as string, data.user as { id: string; displayName: string });
      navigate('/chat');
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-slate-400">Loading…</div>
      </div>
    );
  }

  // Ban screen
  if (banInfo) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="glass rounded-2xl p-8 max-w-md w-full text-center glow-purple">
          <div className="text-5xl mb-4">🚫</div>
          <h1 className="text-2xl font-bold text-red-400 mb-2">Account Banned</h1>
          <p className="text-slate-300 mb-4">
            Your account has been suspended for violating our Terms of Service.
          </p>
          <div className="bg-red-600/10 border border-red-600/30 rounded-xl p-4 mb-6">
            <p className="text-sm text-slate-300">
              <span className="text-slate-400">Reason:</span> {banInfo.reason}
            </p>
            <p className="text-sm text-slate-300 mt-1">
              <span className="text-slate-400">Remaining:</span> {banInfo.days} day(s)
            </p>
          </div>
          <p className="text-slate-500 text-xs">
            If you believe this is a mistake, contact our support team.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8 animate-float">
          <img src="/logo.svg" alt="Ame" className="h-14 mx-auto mb-3" />
          <p className="text-slate-400 text-sm">Sign in to start chatting</p>
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-600/20 border border-red-600/30 text-red-400 text-sm p-3 rounded-xl mb-4">
            {error}
          </div>
        )}

        {/* ── Method chooser ── */}
        {mode === 'choose' && (
          <div className="glass rounded-2xl p-6 glow-purple space-y-3">
            <h2 className="text-white font-semibold text-center mb-4">Choose how to sign in</h2>

            <button
              onClick={() => setMode('email-login')}
              className="w-full py-3 rounded-xl bg-white/5 hover:bg-white/10 text-white border border-white/10 flex items-center gap-3 px-4 transition-all"
            >
              <span className="text-xl">✉️</span>
              <span>Email & Password</span>
            </button>

            <button
              onClick={() => setMode('phone')}
              className="w-full py-3 rounded-xl bg-white/5 hover:bg-white/10 text-white border border-white/10 flex items-center gap-3 px-4 transition-all"
            >
              <span className="text-xl">📱</span>
              <span>Phone Number (OTP)</span>
            </button>

            <a
              href="/api/auth/facebook/start"
              className="w-full py-3 rounded-xl bg-blue-700/30 hover:bg-blue-700/50 text-white border border-blue-600/30 flex items-center gap-3 px-4 transition-all block text-center"
            >
              <span className="text-xl">📘</span>
              <span>Continue with Facebook</span>
            </a>

            <p className="text-center text-slate-500 text-xs pt-2">
              No account?{' '}
              <button
                onClick={() => setMode('email-register')}
                className="text-violet-400 hover:underline"
              >
                Register with email
              </button>
            </p>
          </div>
        )}

        {/* ── Email Login ── */}
        {mode === 'email-login' && (
          <form onSubmit={handleEmailLogin} className="glass rounded-2xl p-6 glow-purple space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <button type="button" onClick={() => setMode('choose')} className="text-slate-400 hover:text-white text-sm">← Back</button>
              <h2 className="text-white font-semibold">Sign In</h2>
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Email</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required
                className="w-full p-2.5 bg-white/5 text-white rounded-lg border border-white/10 focus:border-violet-500 focus:outline-none text-sm" />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Password</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required
                className="w-full p-2.5 bg-white/5 text-white rounded-lg border border-white/10 focus:border-violet-500 focus:outline-none text-sm" />
            </div>
            <button type="submit" disabled={loading}
              className="w-full py-2.5 btn-gradient text-white rounded-lg font-medium disabled:opacity-50">
              {loading ? 'Signing in…' : 'Sign In'}
            </button>
            <p className="text-center text-slate-500 text-xs">
              No account?{' '}
              <button type="button" onClick={() => setMode('email-register')} className="text-violet-400 hover:underline">
                Register
              </button>
            </p>
          </form>
        )}

        {/* ── Email Register ── */}
        {mode === 'email-register' && (
          <form onSubmit={handleEmailRegister} className="glass rounded-2xl p-6 glow-purple space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <button type="button" onClick={() => setMode('choose')} className="text-slate-400 hover:text-white text-sm">← Back</button>
              <h2 className="text-white font-semibold">Create Account</h2>
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Display Name</label>
              <input type="text" value={displayName} onChange={(e) => setDisplayName(e.target.value)} required maxLength={50}
                className="w-full p-2.5 bg-white/5 text-white rounded-lg border border-white/10 focus:border-violet-500 focus:outline-none text-sm" />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Email</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required
                className="w-full p-2.5 bg-white/5 text-white rounded-lg border border-white/10 focus:border-violet-500 focus:outline-none text-sm" />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Password (min 8 chars)</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8}
                className="w-full p-2.5 bg-white/5 text-white rounded-lg border border-white/10 focus:border-violet-500 focus:outline-none text-sm" />
            </div>
            <button type="submit" disabled={loading}
              className="w-full py-2.5 btn-gradient text-white rounded-lg font-medium disabled:opacity-50">
              {loading ? 'Creating account…' : 'Create Account'}
            </button>
            <p className="text-center text-slate-500 text-xs">
              Already registered?{' '}
              <button type="button" onClick={() => setMode('email-login')} className="text-violet-400 hover:underline">
                Sign in
              </button>
            </p>
          </form>
        )}

        {/* ── Phone OTP ── */}
        {mode === 'phone' && (
          <div className="glass rounded-2xl p-6 glow-purple space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <button onClick={() => setMode('choose')} className="text-slate-400 hover:text-white text-sm">← Back</button>
              <h2 className="text-white font-semibold">Phone Verification</h2>
            </div>

            {devOtpNote && (
              <div className="bg-yellow-600/20 border border-yellow-600/30 text-yellow-400 text-xs p-3 rounded-lg space-y-1">
                <p className="font-medium">Dev mode — Twilio not configured</p>
                {devOtpCode ? (
                  <p>Your code: <span className="font-mono text-base tracking-widest text-yellow-300">{devOtpCode}</span></p>
                ) : (
                  <p>Check the server console for the OTP code.</p>
                )}
              </div>
            )}

            {!otpSent ? (
              <form onSubmit={handleSendOtp} className="space-y-4">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Phone Number (with country code)</label>
                  <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} required
                    placeholder="+1 555 000 1234"
                    className="w-full p-2.5 bg-white/5 text-white rounded-lg border border-white/10 focus:border-violet-500 focus:outline-none text-sm" />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Display Name (optional)</label>
                  <input type="text" value={displayName} onChange={(e) => setDisplayName(e.target.value)} maxLength={50}
                    placeholder="How others will see you"
                    className="w-full p-2.5 bg-white/5 text-white rounded-lg border border-white/10 focus:border-violet-500 focus:outline-none text-sm" />
                </div>
                <button type="submit" disabled={loading}
                  className="w-full py-2.5 btn-gradient text-white rounded-lg font-medium disabled:opacity-50">
                  {loading ? 'Sending…' : 'Send OTP'}
                </button>
              </form>
            ) : (
              <form onSubmit={handleVerifyOtp} className="space-y-4">
                <p className="text-slate-300 text-sm">
                  A 6-digit code was sent to <span className="text-white">{phone}</span>
                </p>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Enter OTP Code</label>
                  <input type="text" inputMode="numeric" pattern="[0-9]*" maxLength={6}
                    value={otpCode} onChange={(e) => setOtpCode(e.target.value)} required
                    placeholder="123456"
                    className="w-full p-2.5 bg-white/5 text-white rounded-lg border border-white/10 focus:border-violet-500 focus:outline-none text-sm tracking-widest text-center text-lg" />
                </div>
                <button type="submit" disabled={loading || otpCode.length !== 6}
                  className="w-full py-2.5 btn-gradient text-white rounded-lg font-medium disabled:opacity-50">
                  {loading ? 'Verifying…' : 'Verify & Sign In'}
                </button>
                <button type="button" onClick={() => { setOtpSent(false); setOtpCode(''); }}
                  className="w-full text-slate-400 text-sm hover:text-white">
                  Change number
                </button>
              </form>
            )}
          </div>
        )}

        <p className="text-center text-slate-600 text-xs mt-4">
          By signing in you agree to our{' '}
          <Link to="/terms" className="text-violet-500 hover:underline">Terms</Link>{' '}
          and{' '}
          <Link to="/privacy" className="text-violet-500 hover:underline">Privacy Policy</Link>
        </p>
      </div>
    </div>
  );
}
