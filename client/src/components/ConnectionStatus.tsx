import type { ConnectionState } from '../hooks/useWebRTC';

const statusConfig: Record<ConnectionState, { text: string; color: string; animate: boolean }> = {
  idle: { text: 'Ready to chat', color: 'text-slate-400', animate: false },
  searching: { text: 'Searching for a partner...', color: 'text-violet-400', animate: true },
  connecting: { text: 'Connecting...', color: 'text-purple-400', animate: true },
  connected: { text: 'Connected', color: 'text-green-400', animate: false },
  disconnected: { text: 'Partner disconnected', color: 'text-red-400', animate: false },
};

export default function ConnectionStatus({ state }: { state: ConnectionState }) {
  const { text, color, animate } = statusConfig[state];

  return (
    <div className={`flex items-center gap-2 ${color}`}>
      {animate && (
        <div className="w-2 h-2 rounded-full bg-current animate-pulse" />
      )}
      {!animate && state === 'connected' && (
        <div className="w-2 h-2 rounded-full bg-green-400" />
      )}
      <span className="text-sm font-medium">{text}</span>
    </div>
  );
}
