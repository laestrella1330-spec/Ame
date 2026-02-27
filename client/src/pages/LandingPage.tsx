import { useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function LandingPage() {
  const navigate = useNavigate();
  const { user, isLoading } = useAuth();

  // Authenticated non-banned users go straight to chat
  useEffect(() => {
    if (!isLoading && user && !user.activeBan) {
      navigate('/chat', { replace: true });
    }
  }, [user, isLoading, navigate]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-slate-400">Loading…</div>
      </div>
    );
  }

  // Banned user screen
  if (user?.activeBan) {
    const ban = user.activeBan;
    const expiryDate = new Date(ban.expiresAt).toLocaleDateString('en-US', {
      year: 'numeric', month: 'long', day: 'numeric',
    });
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="glass rounded-2xl p-8 max-w-md w-full text-center glow-purple">
          <div className="text-5xl mb-4">🚫</div>
          <h1 className="text-2xl font-bold text-red-400 mb-2">Account Suspended</h1>
          <p className="text-slate-300 mb-4">
            Your account has been suspended for violating our Terms of Service.
          </p>
          <div className="bg-red-600/10 border border-red-600/30 rounded-xl p-4 mb-6 text-sm space-y-2">
            {ban.reason && (
              <p className="text-slate-300">
                <span className="text-slate-400">Reason:</span> {ban.reason}
              </p>
            )}
            <p className="text-slate-300">
              <span className="text-slate-400">Expires:</span> {expiryDate}
            </p>
            <p className="text-slate-300">
              <span className="text-slate-400">Days remaining:</span> {ban.remainingDays}
            </p>
            <p className="text-slate-300">
              <span className="text-slate-400">Ban #{ban.banNumber}</span>
            </p>
          </div>
          <p className="text-slate-500 text-xs">
            If you believe this is a mistake, please contact our support team.
          </p>
        </div>
      </div>
    );
  }

  // Default: welcome / marketing page
  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ position: 'relative', overflow: 'hidden' }}>
      {/* Background dot grid */}
      <div style={{ position: 'fixed', inset: 0, backgroundImage: 'radial-gradient(rgba(139,92,246,0.12) 1px, transparent 1px)', backgroundSize: '26px 26px', pointerEvents: 'none', zIndex: 0 }} />
      {/* Ambient orbs */}
      <div style={{ position: 'fixed', top: '10%', right: '5%', width: 240, height: 240, borderRadius: '50%', background: 'radial-gradient(circle, rgba(109,40,217,0.28) 0%, transparent 70%)', filter: 'blur(55px)', pointerEvents: 'none', zIndex: 0 }} />
      <div style={{ position: 'fixed', bottom: '10%', left: '3%', width: 200, height: 200, borderRadius: '50%', background: 'radial-gradient(circle, rgba(124,58,237,0.2) 0%, transparent 70%)', filter: 'blur(45px)', pointerEvents: 'none', zIndex: 0 }} />

      <div className="max-w-lg w-full" style={{ position: 'relative', zIndex: 1 }}>
        {/* Hero */}
        <div className="text-center mb-8 animate-float">
          <img src="/logo.png" alt="Ame" style={{ height: 90, margin: '0 auto 14px', filter: 'drop-shadow(0 0 22px rgba(139,92,246,0.55))' }} />
          <h1 className="neon-text" style={{ fontFamily: "'Orbitron', sans-serif", fontSize: 20, fontWeight: 700, color: '#fff', margin: '0 0 6px', letterSpacing: '0.08em', textShadow: '0 0 16px rgba(139,92,246,0.9)' }}>
            Meet the World
          </h1>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 4 }}>
            <div style={{ width: 28, height: 1, background: 'linear-gradient(90deg, transparent, rgba(167,139,250,0.6))' }} />
            <p style={{ fontFamily: "'Rajdhani', sans-serif", fontSize: 11, color: 'rgba(167,139,250,0.7)', margin: 0, letterSpacing: '0.24em', textTransform: 'uppercase' }}>Random Video Chat</p>
            <div style={{ width: 28, height: 1, background: 'linear-gradient(90deg, rgba(167,139,250,0.6), transparent)' }} />
          </div>
        </div>

        {/* Feature cards */}
        <div style={{ background: 'rgba(255,255,255,0.03)', backdropFilter: 'blur(12px)', border: '1px solid rgba(139,92,246,0.25)', borderRadius: 20, padding: '20px 20px 16px', marginBottom: 18, boxShadow: '0 0 30px rgba(139,92,246,0.15)' }}>
          <p style={{ fontFamily: "'Orbitron', sans-serif", fontSize: 11, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'rgba(167,139,250,0.7)', margin: '0 0 14px' }}>Core Features</p>
          <div style={{ display: 'grid', gap: 10 }}>
            {[
              { icon: '⚡', text: 'Instant live video & text with strangers worldwide' },
              { icon: '🔒', text: 'Peer-to-peer — never recorded or stored' },
              { icon: '🛡️', text: 'Moderated platform, zero tolerance for abuse' },
              { icon: '🌍', text: 'Filter by country & gender in settings' },
            ].map(({ icon, text }) => (
              <div key={text} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', background: 'rgba(139,92,246,0.07)', border: '1px solid rgba(139,92,246,0.15)', borderRadius: 12 }}>
                <span style={{ fontSize: 18, flexShrink: 0 }}>{icon}</span>
                <span style={{ fontFamily: "'Rajdhani', sans-serif", fontSize: 14, color: 'rgba(226,232,240,0.85)', letterSpacing: '0.02em' }}>{text}</span>
              </div>
            ))}
          </div>
        </div>

        {/* 18+ notice */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 14 }}>
          <span style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.4)', color: '#f87171', fontFamily: "'Orbitron', sans-serif", fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', padding: '3px 10px', borderRadius: 6 }}>18+</span>
          <span style={{ fontFamily: "'Rajdhani', sans-serif", fontSize: 13, color: 'rgba(226,232,240,0.6)', letterSpacing: '0.04em' }}>This platform is for adults only. You must be 18 or older to use Ame.</span>
        </div>

        {/* CTA */}
        <button onClick={() => navigate('/age-gate')}
          className="active:scale-95 transition-all"
          style={{ width: '100%', padding: '16px', background: 'linear-gradient(135deg, #6d28d9, #8B5CF6, #7c3aed)', border: 'none', borderRadius: 40, color: 'white', fontFamily: "'Orbitron', sans-serif", fontSize: 13, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', cursor: 'pointer', boxShadow: '0 0 28px rgba(139,92,246,0.65), 0 0 56px rgba(139,92,246,0.2)', marginBottom: 16 }}>
          Get Started
        </button>

        <p className="text-center" style={{ fontFamily: "'Rajdhani', sans-serif", fontSize: 12, color: 'rgba(100,116,139,0.8)', letterSpacing: '0.04em' }}>
          By using this service you confirm you are 18+ and agree to our{' '}
          <Link to="/terms" style={{ color: 'rgba(167,139,250,0.8)' }}>Terms of Service</Link>
          {' '}and{' '}
          <Link to="/privacy" style={{ color: 'rgba(167,139,250,0.8)' }}>Privacy Policy</Link>.
        </p>
      </div>
    </div>
  );
}
