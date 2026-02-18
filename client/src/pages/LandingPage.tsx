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
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="max-w-lg w-full">
        <div className="text-center mb-8 animate-float">
          <img src="/logo.svg" alt="Ame" className="h-14 mx-auto mb-3" />
          <p className="text-slate-400">Meet new people through random video conversations</p>
        </div>

        <div className="glass rounded-2xl p-6 mb-6 glow-purple">
          <h2 className="text-white font-semibold mb-3">How Ame works</h2>
          <div className="bg-white/5 rounded-lg p-4 mb-4 text-sm text-slate-300 space-y-2">
            <p>✨ Instantly connect with strangers via live video and text chat.</p>
            <p>🛡️ Moderated platform — abuse is not tolerated.</p>
            <p>🔒 Video is peer-to-peer and not recorded or stored.</p>
            <p>🌍 Filter by country and gender preference in settings.</p>
            <p>⚡ No account needed to browse, but sign in to chat.</p>
          </div>

          <div className="space-y-3">
            <button
              onClick={() => navigate('/login')}
              className="w-full py-3 btn-gradient text-white rounded-xl font-semibold transition-all"
            >
              Get Started
            </button>
          </div>
        </div>

        <p className="text-center text-slate-500 text-xs">
          By using this service you agree to our{' '}
          <Link to="/terms" className="text-violet-400 hover:underline">Terms of Service</Link>
          {' '}and{' '}
          <Link to="/privacy" className="text-violet-400 hover:underline">Privacy Policy</Link>.
        </p>
      </div>
    </div>
  );
}
