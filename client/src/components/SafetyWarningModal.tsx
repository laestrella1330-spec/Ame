import { useState } from 'react';
import { userPost } from '../services/api';
import { useAuth } from '../context/AuthContext';

interface Props {
  onAccepted: () => void;
}

export default function SafetyWarningModal({ onAccepted }: Props) {
  const { setConsentAccepted } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleAccept = async () => {
    setLoading(true);
    setError('');
    try {
      await userPost('/users/accept-consent');
      setConsentAccepted();
      onAccepted();
    } catch {
      setError('Failed to save consent. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="glass rounded-2xl p-8 max-w-md w-full glow-purple">
        <div className="text-center mb-6">
          <div className="text-4xl mb-3">🛡️</div>
          <h2 className="text-xl font-bold text-white mb-1">Safety Notice</h2>
          <p className="text-slate-400 text-sm">Please read before continuing</p>
        </div>

        <div className="bg-white/5 border border-white/10 rounded-xl p-4 mb-6 text-sm text-slate-300 space-y-3">
          <p>
            <span className="text-violet-400 font-medium">Session Monitoring:</span>{' '}
            Chat sessions on Ame may be monitored by our moderation team to ensure the safety
            of all users and compliance with our Terms of Service.
          </p>
          <p>
            <span className="text-violet-400 font-medium">What we monitor:</span>{' '}
            Text messages sent during chat sessions may be reviewed. Video and audio are
            transmitted peer-to-peer and are not recorded or stored by our servers.
          </p>
          <p>
            <span className="text-violet-400 font-medium">Why:</span>{' '}
            Monitoring helps us detect and remove users who violate our community standards,
            keeping Ame safe for everyone.
          </p>
          <p>
            <span className="text-violet-400 font-medium">Your rights:</span>{' '}
            You may stop using the service at any time. Continued use constitutes acceptance
            of our monitoring practices.
          </p>
        </div>

        {error && (
          <div className="bg-red-600/20 border border-red-600/30 text-red-400 text-sm p-3 rounded-xl mb-4">
            {error}
          </div>
        )}

        <button
          onClick={handleAccept}
          disabled={loading}
          className="w-full py-3 btn-gradient text-white rounded-xl font-semibold disabled:opacity-50 transition-all"
        >
          {loading ? 'Saving…' : 'I Understand & Accept'}
        </button>

        <p className="text-center text-slate-600 text-xs mt-4">
          You must accept to use Ame. This consent is recorded with your account.
        </p>
      </div>
    </div>
  );
}
