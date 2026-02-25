import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { API_BASE } from '../services/api';

const FACEBOOK_AUTH_URL = `${API_BASE}/auth/facebook/start?mobile=1`;
const isNativePlatform = !!(window as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor?.isNativePlatform?.();

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

  // ── Facebook JS SDK login (web only) ─────────────────────────────────────────
  const handleFacebookSdkLogin = () => {
    type FBResponse = { authResponse?: { accessToken: string; userID: string } };
    type FBSDK = { login: (cb: (r: FBResponse) => void, opts: { scope: string }) => void };
    const fb = (window as { FB?: FBSDK }).FB;
    if (!fb) { window.location.href = `${API_BASE}/auth/facebook/start`; return; }
    fb.login(async (response) => {
      if (!response.authResponse) { setError('Facebook login was cancelled.'); return; }
      setLoading(true);
      try {
        const res = await fetch(`${API_BASE}/auth/facebook/token`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ accessToken: response.authResponse.accessToken, userID: response.authResponse.userID }),
        });
        const data = await res.json() as Record<string, unknown>;
        if (!res.ok) {
          if (data.error === 'account_banned') { handleBannedResponse(data); return; }
          setError(String(data.error ?? 'Facebook login failed'));
          return;
        }
        login(data.token as string, data.user as { id: string; displayName: string });
        navigate('/chat');
      } catch { setError('Network error. Please try again.'); }
      finally { setLoading(false); }
    }, { scope: 'public_profile,email' });
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
    } catch (err) {
      setError(`Network error: ${err instanceof Error ? err.message : String(err)} [${API_BASE}]`);
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
    } catch (err) {
      setError(`Network error: ${err instanceof Error ? err.message : String(err)} [${API_BASE}]`);
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

  const cyberCard: React.CSSProperties = { background: 'rgba(255,255,255,0.03)', backdropFilter: 'blur(14px)', border: '1px solid rgba(139,92,246,0.3)', borderRadius: 20, padding: '24px 22px', boxShadow: '0 0 32px rgba(139,92,246,0.15)' };
  const cyberInput: React.CSSProperties = { width: '100%', padding: '11px 14px', background: 'rgba(139,92,246,0.08)', color: 'white', borderRadius: 12, border: '1px solid rgba(139,92,246,0.3)', outline: 'none', fontFamily: "'Rajdhani', sans-serif", fontSize: 15, letterSpacing: '0.03em', boxSizing: 'border-box' };
  const cyberLabel: React.CSSProperties = { display: 'block', fontFamily: "'Orbitron', sans-serif", fontSize: 9, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'rgba(167,139,250,0.7)', marginBottom: 6 };
  const cyberSubmit: React.CSSProperties = { width: '100%', padding: '13px', background: 'linear-gradient(135deg, #6d28d9, #8B5CF6)', border: 'none', borderRadius: 40, color: 'white', fontFamily: "'Orbitron', sans-serif", fontSize: 12, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', cursor: 'pointer', boxShadow: '0 0 24px rgba(139,92,246,0.55)' };
  const cyberBack: React.CSSProperties = { background: 'none', border: 'none', color: 'rgba(167,139,250,0.6)', fontFamily: "'Rajdhani', sans-serif", fontSize: 13, letterSpacing: '0.06em', cursor: 'pointer', padding: 0 };

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ position: 'relative', overflow: 'hidden' }}>
      {/* Background grid */}
      <div style={{ position: 'fixed', inset: 0, backgroundImage: 'radial-gradient(rgba(139,92,246,0.12) 1px, transparent 1px)', backgroundSize: '26px 26px', pointerEvents: 'none', zIndex: 0 }} />
      <div style={{ position: 'fixed', top: '8%', right: '4%', width: 220, height: 220, borderRadius: '50%', background: 'radial-gradient(circle, rgba(109,40,217,0.28) 0%, transparent 70%)', filter: 'blur(55px)', pointerEvents: 'none', zIndex: 0 }} />
      <div style={{ position: 'fixed', bottom: '8%', left: '3%', width: 180, height: 180, borderRadius: '50%', background: 'radial-gradient(circle, rgba(124,58,237,0.2) 0%, transparent 70%)', filter: 'blur(45px)', pointerEvents: 'none', zIndex: 0 }} />

      <div className="w-full max-w-md" style={{ position: 'relative', zIndex: 1 }}>
        {/* Logo */}
        <div className="text-center mb-8 animate-float">
          <img src="/logo.png" alt="Ame" style={{ height: 80, margin: '0 auto 12px', filter: 'drop-shadow(0 0 20px rgba(139,92,246,0.55))' }} />
          <p style={{ fontFamily: "'Rajdhani', sans-serif", fontSize: 13, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'rgba(167,139,250,0.65)' }}>Sign in to start chatting</p>
        </div>

        {/* Error */}
        {error && (
          <div style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)', color: '#f87171', fontSize: 13, padding: '10px 14px', borderRadius: 12, marginBottom: 14, fontFamily: "'Rajdhani', sans-serif", letterSpacing: '0.03em' }}>
            {error}
          </div>
        )}

        {/* ── Method chooser ── */}
        {mode === 'choose' && (
          <div style={cyberCard}>
            <p style={{ fontFamily: "'Orbitron', sans-serif", fontSize: 11, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'rgba(167,139,250,0.7)', margin: '0 0 16px', textAlign: 'center' }}>Choose Sign-In Method</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[
                { label: 'Email & Password', icon: '✉️', action: () => setMode('email-login') },
                { label: 'Phone Number (OTP)', icon: '📱', action: () => setMode('phone') },
              ].map(({ label, icon, action }) => (
                <button key={label} onClick={action}
                  style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 16px', background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.25)', borderRadius: 14, color: 'rgba(226,232,240,0.9)', fontFamily: "'Rajdhani', sans-serif", fontSize: 15, letterSpacing: '0.04em', cursor: 'pointer', transition: 'all 0.2s' }}>
                  <span style={{ fontSize: 18 }}>{icon}</span><span>{label}</span>
                </button>
              ))}
              {isNativePlatform ? (
                <a href={FACEBOOK_AUTH_URL}
                  style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 16px', background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.25)', borderRadius: 14, color: 'rgba(226,232,240,0.9)', fontFamily: "'Rajdhani', sans-serif", fontSize: 15, letterSpacing: '0.04em', textDecoration: 'none' }}>
                  <span style={{ fontSize: 18 }}>📘</span><span>Continue with Facebook</span>
                </a>
              ) : (
                <button onClick={handleFacebookSdkLogin} disabled={loading}
                  style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 16px', background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.25)', borderRadius: 14, color: 'rgba(226,232,240,0.9)', fontFamily: "'Rajdhani', sans-serif", fontSize: 15, letterSpacing: '0.04em', cursor: 'pointer', width: '100%', opacity: loading ? 0.5 : 1 }}>
                  <span style={{ fontSize: 18 }}>📘</span><span>Continue with Facebook</span>
                </button>
              )}
            </div>
            <p style={{ textAlign: 'center', fontFamily: "'Rajdhani', sans-serif", fontSize: 12, color: 'rgba(100,116,139,0.8)', marginTop: 14 }}>
              No account?{' '}
              <button onClick={() => setMode('email-register')} style={{ background: 'none', border: 'none', color: 'rgba(167,139,250,0.85)', cursor: 'pointer', fontFamily: 'inherit', fontSize: 'inherit' }}>Register with email</button>
            </p>
          </div>
        )}

        {/* ── Email Login ── */}
        {mode === 'email-login' && (
          <form onSubmit={handleEmailLogin} style={{ ...cyberCard, display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
              <button type="button" onClick={() => setMode('choose')} style={cyberBack}>← Back</button>
              <span style={{ fontFamily: "'Orbitron', sans-serif", fontSize: 11, letterSpacing: '0.14em', color: 'rgba(167,139,250,0.8)' }}>SIGN IN</span>
            </div>
            <div><label style={cyberLabel}>Email</label><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required style={cyberInput} /></div>
            <div><label style={cyberLabel}>Password</label><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required style={cyberInput} /></div>
            <button type="submit" disabled={loading} style={{ ...cyberSubmit, opacity: loading ? 0.5 : 1 }}>{loading ? 'Signing in…' : 'Sign In'}</button>
            <p style={{ textAlign: 'center', fontFamily: "'Rajdhani', sans-serif", fontSize: 12, color: 'rgba(100,116,139,0.8)', margin: 0 }}>
              No account?{' '}<button type="button" onClick={() => setMode('email-register')} style={{ background: 'none', border: 'none', color: 'rgba(167,139,250,0.85)', cursor: 'pointer', fontFamily: 'inherit', fontSize: 'inherit' }}>Register</button>
            </p>
          </form>
        )}

        {/* ── Email Register ── */}
        {mode === 'email-register' && (
          <form onSubmit={handleEmailRegister} style={{ ...cyberCard, display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
              <button type="button" onClick={() => setMode('choose')} style={cyberBack}>← Back</button>
              <span style={{ fontFamily: "'Orbitron', sans-serif", fontSize: 11, letterSpacing: '0.14em', color: 'rgba(167,139,250,0.8)' }}>CREATE ACCOUNT</span>
            </div>
            <div><label style={cyberLabel}>Display Name</label><input type="text" value={displayName} onChange={(e) => setDisplayName(e.target.value)} required maxLength={50} style={cyberInput} /></div>
            <div><label style={cyberLabel}>Email</label><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required style={cyberInput} /></div>
            <div><label style={cyberLabel}>Password (min 8 chars)</label><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} style={cyberInput} /></div>
            <button type="submit" disabled={loading} style={{ ...cyberSubmit, opacity: loading ? 0.5 : 1 }}>{loading ? 'Creating…' : 'Create Account'}</button>
            <p style={{ textAlign: 'center', fontFamily: "'Rajdhani', sans-serif", fontSize: 12, color: 'rgba(100,116,139,0.8)', margin: 0 }}>
              Already registered?{' '}<button type="button" onClick={() => setMode('email-login')} style={{ background: 'none', border: 'none', color: 'rgba(167,139,250,0.85)', cursor: 'pointer', fontFamily: 'inherit', fontSize: 'inherit' }}>Sign in</button>
            </p>
          </form>
        )}

        {/* ── Phone OTP ── */}
        {mode === 'phone' && (
          <div style={cyberCard}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <button onClick={() => setMode('choose')} style={cyberBack}>← Back</button>
              <span style={{ fontFamily: "'Orbitron', sans-serif", fontSize: 11, letterSpacing: '0.14em', color: 'rgba(167,139,250,0.8)' }}>PHONE VERIFY</span>
            </div>
            {devOtpNote && (
              <div style={{ background: 'rgba(234,179,8,0.1)', border: '1px solid rgba(234,179,8,0.3)', color: '#fbbf24', fontSize: 12, padding: '10px 14px', borderRadius: 10, marginBottom: 14, fontFamily: "'Rajdhani', sans-serif" }}>
                <p style={{ margin: '0 0 4px', fontWeight: 600 }}>Dev mode — Twilio not configured</p>
                {devOtpCode ? <p style={{ margin: 0 }}>Code: <span style={{ fontFamily: 'monospace', letterSpacing: '0.2em', color: '#fde047' }}>{devOtpCode}</span></p> : <p style={{ margin: 0 }}>Check server console.</p>}
              </div>
            )}
            {!otpSent ? (
              <form onSubmit={handleSendOtp} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div><label style={cyberLabel}>Phone (with country code)</label><input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} required placeholder="+1 555 000 1234" style={cyberInput} /></div>
                <div><label style={cyberLabel}>Display Name (optional)</label><input type="text" value={displayName} onChange={(e) => setDisplayName(e.target.value)} maxLength={50} placeholder="How others will see you" style={cyberInput} /></div>
                <button type="submit" disabled={loading} style={{ ...cyberSubmit, opacity: loading ? 0.5 : 1 }}>{loading ? 'Sending…' : 'Send OTP'}</button>
              </form>
            ) : (
              <form onSubmit={handleVerifyOtp} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <p style={{ fontFamily: "'Rajdhani', sans-serif", fontSize: 14, color: 'rgba(226,232,240,0.8)', margin: 0 }}>Code sent to <span style={{ color: 'white' }}>{phone}</span></p>
                <div><label style={cyberLabel}>Enter OTP Code</label><input type="text" inputMode="numeric" pattern="[0-9]*" maxLength={6} value={otpCode} onChange={(e) => setOtpCode(e.target.value)} required placeholder="123456" style={{ ...cyberInput, textAlign: 'center', letterSpacing: '0.3em', fontSize: 20 }} /></div>
                <button type="submit" disabled={loading || otpCode.length !== 6} style={{ ...cyberSubmit, opacity: (loading || otpCode.length !== 6) ? 0.5 : 1 }}>{loading ? 'Verifying…' : 'Verify & Sign In'}</button>
                <button type="button" onClick={() => { setOtpSent(false); setOtpCode(''); }} style={{ background: 'none', border: 'none', color: 'rgba(167,139,250,0.6)', fontFamily: "'Rajdhani', sans-serif", fontSize: 13, cursor: 'pointer' }}>Change number</button>
              </form>
            )}
          </div>
        )}

        <p style={{ textAlign: 'center', fontFamily: "'Rajdhani', sans-serif", fontSize: 11, letterSpacing: '0.04em', color: 'rgba(100,116,139,0.7)', marginTop: 14 }}>
          By signing in you agree to our{' '}
          <Link to="/terms" style={{ color: 'rgba(167,139,250,0.75)' }}>Terms</Link>{' '}and{' '}
          <Link to="/privacy" style={{ color: 'rgba(167,139,250,0.75)' }}>Privacy Policy</Link>
        </p>
      </div>
    </div>
  );
}
