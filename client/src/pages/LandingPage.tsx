import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';

export default function LandingPage() {
  const navigate = useNavigate();
  const [ageConfirmed, setAgeConfirmed] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);

  const canStart = ageConfirmed && termsAccepted;

  const handleStart = () => {
    if (!canStart) return;
    sessionStorage.setItem('consent_given', 'true');
    navigate('/chat');
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="max-w-lg w-full">
        <div className="text-center mb-8 animate-float">
          <img src="/logo.svg" alt="Ame" className="h-14 mx-auto mb-3" />
          <p className="text-slate-400">Meet new people through random video conversations</p>
        </div>

        <div className="glass rounded-2xl p-6 mb-6 glow-purple">
          <h2 className="text-white font-semibold mb-3">Before you start</h2>
          <div className="bg-white/5 rounded-lg p-4 mb-4 text-sm text-slate-300 space-y-2">
            <p>This platform connects you with random strangers via live video and audio.</p>
            <p>Your video and audio are transmitted directly to your chat partner (peer-to-peer). We do not record or store any video or audio content.</p>
            <p>We collect your IP address solely for safety and moderation purposes (e.g., banning abusive users).</p>
            <p>You can report inappropriate behavior using the Report button during any chat.</p>
          </div>

          <div className="space-y-3">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={ageConfirmed}
                onChange={(e) => setAgeConfirmed(e.target.checked)}
                className="mt-1 accent-violet-500"
              />
              <span className="text-sm text-slate-300">
                I confirm that I am 18 years of age or older
              </span>
            </label>

            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={termsAccepted}
                onChange={(e) => setTermsAccepted(e.target.checked)}
                className="mt-1 accent-violet-500"
              />
              <span className="text-sm text-slate-300">
                I have read and agree to the{' '}
                <Link to="/terms" className="text-violet-400 hover:underline">
                  Terms of Service
                </Link>{' '}
                and{' '}
                <Link to="/privacy" className="text-violet-400 hover:underline">
                  Privacy Policy
                </Link>
              </span>
            </label>
          </div>
        </div>

        <button
          onClick={handleStart}
          disabled={!canStart}
          className={`w-full py-3 rounded-xl text-lg font-semibold transition-all ${
            canStart
              ? 'btn-gradient text-white cursor-pointer'
              : 'bg-slate-700 text-slate-500 cursor-not-allowed'
          }`}
        >
          Start Chatting
        </button>

        <p className="text-center text-slate-500 text-xs mt-4">
          By using this service you agree to behave respectfully toward other users.
        </p>
      </div>
    </div>
  );
}
