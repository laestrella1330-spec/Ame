/**
 * PostChatPanel — Phase 5
 *
 * Shown after a chat ends (peer disconnected or end-chat clicked).
 * Collects mood feedback anonymously. Only displayed when post_chat_feedback
 * feature flag is enabled.
 *
 * Feedback is sent to POST /api/feedback and used only for:
 * - Match quality weighting (future)
 * - Internal safety signals
 */
import { useState } from 'react';
import { userPost } from '../services/api';

type Mood = 'fun' | 'awkward' | 'uncomfortable';

interface PostChatPanelProps {
  sessionId: string;
  onClose: () => void;
  onFindNext: () => void;
}

const MOODS: { value: Mood; emoji: string; label: string; color: string }[] = [
  { value: 'fun',          emoji: '😄', label: 'That was fun!',         color: 'hover:border-green-500/60 hover:bg-green-500/10' },
  { value: 'awkward',      emoji: '😬', label: 'A bit awkward',         color: 'hover:border-yellow-500/60 hover:bg-yellow-500/10' },
  { value: 'uncomfortable',emoji: '😔', label: 'Felt uncomfortable',    color: 'hover:border-red-500/60 hover:bg-red-500/10' },
];

export default function PostChatPanel({ sessionId, onClose, onFindNext }: PostChatPanelProps) {
  const [selected, setSelected] = useState<Mood | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const handleSelect = async (mood: Mood) => {
    setSelected(mood);
    try {
      await userPost('/feedback', { sessionId, mood });
    } catch {
      // Silent — feedback is optional
    }
    setSubmitted(true);
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="glass rounded-2xl p-6 w-full max-w-sm glow-purple text-center">
        {!submitted ? (
          <>
            <p className="text-white font-semibold text-lg mb-1">Chat ended</p>
            <p className="text-slate-400 text-sm mb-5">How was that conversation?</p>

            <div className="flex gap-3 mb-6">
              {MOODS.map(({ value, emoji, label, color }) => (
                <button
                  key={value}
                  onClick={() => handleSelect(value)}
                  className={`flex-1 py-3 rounded-xl border border-white/10 bg-white/5 transition-all text-center ${color}`}
                >
                  <div className="text-2xl mb-1">{emoji}</div>
                  <div className="text-xs text-slate-300 leading-tight">{label}</div>
                </button>
              ))}
            </div>

            <button
              onClick={onClose}
              className="w-full py-2 text-slate-500 hover:text-slate-300 text-sm transition-colors"
            >
              Skip
            </button>
          </>
        ) : (
          <>
            <div className="text-4xl mb-3">
              {MOODS.find(m => m.value === selected)?.emoji}
            </div>
            <p className="text-white font-semibold mb-1">Thanks for the feedback</p>
            <p className="text-slate-400 text-sm mb-5">
              It helps us make better matches.
            </p>
            <button
              onClick={onFindNext}
              className="w-full py-2.5 btn-gradient text-white rounded-lg text-sm font-semibold mb-2"
            >
              Find next person
            </button>
            <button
              onClick={onClose}
              className="w-full py-2 text-slate-500 hover:text-slate-300 text-sm transition-colors"
            >
              Go back
            </button>
          </>
        )}
      </div>
    </div>
  );
}
