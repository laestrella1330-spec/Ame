import { useState } from 'react';
import { Socket } from 'socket.io-client';

interface ReportModalProps {
  socket: Socket | null;
  onClose: () => void;
}

const REASONS = [
  { value: 'inappropriate', label: 'Inappropriate Content' },
  { value: 'harassment', label: 'Harassment' },
  { value: 'spam', label: 'Spam' },
  { value: 'underage', label: 'Suspected Underage User' },
  { value: 'other', label: 'Other' },
];

export default function ReportModal({ socket, onClose }: ReportModalProps) {
  const [reason, setReason] = useState('');
  const [description, setDescription] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = () => {
    if (!reason || !socket) return;
    socket.emit('report-user', {
      reason,
      description: description.trim() || null,
    });
    setSubmitted(true);
    setTimeout(onClose, 2000);
  };

  if (submitted) {
    return (
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
        <div className="glass p-6 rounded-2xl max-w-md w-full mx-4 text-center glow-purple">
          <div className="text-green-400 text-lg font-semibold mb-2">Report Submitted</div>
          <p className="text-slate-300 text-sm">
            Thank you for helping keep the community safe.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="glass p-6 rounded-2xl max-w-md w-full mx-4 glow-purple">
        <h2 className="text-lg font-semibold text-white mb-4">Report User</h2>

        <div className="space-y-3 mb-4">
          {REASONS.map((r) => (
            <label
              key={r.value}
              className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-all ${
                reason === r.value
                  ? 'bg-violet-600/20 border border-violet-500'
                  : 'bg-white/5 border border-transparent hover:bg-white/10'
              }`}
            >
              <input
                type="radio"
                name="reason"
                value={r.value}
                checked={reason === r.value}
                onChange={(e) => setReason(e.target.value)}
                className="accent-violet-500"
              />
              <span className="text-sm text-white">{r.label}</span>
            </label>
          ))}
        </div>

        <textarea
          placeholder="Additional details (optional, max 500 characters)"
          value={description}
          onChange={(e) => setDescription(e.target.value.slice(0, 500))}
          className="w-full p-3 bg-white/5 text-white text-sm rounded-lg border border-white/10 focus:border-violet-500 focus:outline-none resize-none"
          rows={3}
        />

        <div className="flex gap-3 mt-4">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg text-sm border border-white/10"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!reason}
            className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-slate-600 disabled:cursor-not-allowed text-white rounded-lg text-sm"
          >
            Submit Report
          </button>
        </div>
      </div>
    </div>
  );
}
