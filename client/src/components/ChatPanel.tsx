import { useState, useRef, useEffect } from 'react';
import type { ChatMessage } from '../hooks/useChat';

const SOCIAL_ICONS: Record<string, string> = {
  instagram: '📸',
  snapchat: '👻',
  twitter: '🐦',
  discord: '🎮',
};

interface ChatPanelProps {
  messages: ChatMessage[];
  onSend: (text: string, socials?: Record<string, string>) => void;
  disabled: boolean;
  onShareSocials?: () => void;
  hasSocials?: boolean;
}

const EMOJI_LIST = [
  '😀','😂','😍','🥰','😎','🤔','😴','🥺','😭','😡',
  '🤩','🙄','😅','😬','🤯','🫠','🤣','😏','🤫','🤭',
  '😮','😱','🥹','😈','🤡','🥳','🫡','🙏','💪','🤦',
  '🤷','👋','👍','👎','🤝','👀','💀','🫶','💋','❤️',
  '🔥','✨','🎉','💯','💫','🌟','⚡','🎶','🎮','🍕',
  '🍔','🍜','☕','🍺','🌮','🎂','🍦','🍫','🤙','✌️',
];

export default function ChatPanel({ messages, onSend, disabled, onShareSocials, hasSocials }: ChatPanelProps) {
  const [input, setInput] = useState('');
  const [showEmojis, setShowEmojis] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const emojiRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Close emoji picker when clicking outside
  useEffect(() => {
    if (!showEmojis) return;
    const handler = (e: MouseEvent) => {
      if (emojiRef.current && !emojiRef.current.contains(e.target as Node)) {
        setShowEmojis(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showEmojis]);

  const handleSend = () => {
    if (!input.trim() || disabled) return;
    onSend(input);
    setInput('');
    setShowEmojis(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const insertEmoji = (emoji: string) => {
    setInput((prev) => (prev + emoji).slice(0, 500));
  };

  return (
    <div className="chat-panel-bg rounded-2xl flex flex-col h-full overflow-hidden relative">
      {/* Animated background orbs */}
      <div className="orb orb-1" />
      <div className="orb orb-2" />
      <div className="orb orb-3" />

      {/* Header */}
      <div className="relative z-10 px-4 py-3 border-b border-white/10">
        <h2 className="text-sm font-semibold text-white">Chat</h2>
      </div>

      {/* Messages */}
      <div className="relative z-10 flex-1 overflow-y-auto p-3 space-y-2 min-h-0">
        {messages.length === 0 && (
          <div className="text-center text-slate-500 text-xs mt-8">
            {disabled ? 'Connect to a partner to start chatting' : 'Say hello! 👋'}
          </div>
        )}
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.isSelf ? 'justify-end' : 'justify-start'}`}
          >
            {msg.type === 'socials-card' && msg.socials ? (
              <div className={`max-w-[90%] px-3 py-2 rounded-xl text-sm ${
                msg.isSelf
                  ? 'bg-violet-600/30 border border-violet-500/40 rounded-br-sm'
                  : 'bg-white/10 border border-white/15 rounded-bl-sm'
              }`}>
                <p className="text-xs text-violet-300 font-medium mb-1.5">
                  {msg.isSelf ? 'You shared your socials' : 'Partner shared their socials'}
                </p>
                <div className="flex flex-col gap-1">
                  {Object.entries(msg.socials)
                    .filter(([, v]) => v)
                    .map(([platform, handle]) => (
                      <span key={platform} className="text-xs text-slate-200 flex items-center gap-1.5">
                        <span>{SOCIAL_ICONS[platform] ?? '🔗'}</span>
                        <span className="font-medium capitalize">{platform === 'twitter' ? 'X' : platform}:</span>
                        <span className="text-violet-300">{handle}</span>
                      </span>
                    ))
                  }
                </div>
              </div>
            ) : (
              <div
                className={`max-w-[85%] px-3 py-2 rounded-xl text-sm break-words ${
                  msg.isSelf
                    ? 'bg-violet-600/50 text-white rounded-br-sm shadow-[0_0_10px_rgba(139,92,246,0.3)]'
                    : 'bg-white/10 text-slate-200 rounded-bl-sm'
                }`}
              >
                {msg.text}
              </div>
            )}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Emoji picker */}
      {showEmojis && (
        <div
          ref={emojiRef}
          className="relative z-20 mx-3 mb-1 p-2 bg-slate-900/95 border border-white/10 rounded-xl grid grid-cols-10 gap-0.5"
        >
          {EMOJI_LIST.map((emoji) => (
            <button
              key={emoji}
              onClick={() => insertEmoji(emoji)}
              className="text-lg hover:bg-white/10 rounded p-0.5 transition-colors leading-tight"
            >
              {emoji}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="relative z-10 py-3 px-4 border-t border-white/10">
        <div className="flex gap-2">
          <button
            onClick={() => setShowEmojis((v) => !v)}
            disabled={disabled}
            className={`px-2 py-2 rounded-lg text-lg leading-none transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
              showEmojis ? 'bg-violet-600/40' : 'bg-white/5 hover:bg-white/10'
            }`}
            title="Emoji"
          >
            😊
          </button>
          {onShareSocials && (
            <button
              onClick={onShareSocials}
              disabled={disabled || !hasSocials}
              className="px-2 py-2 rounded-lg text-lg leading-none bg-white/5 hover:bg-white/10 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              title={hasSocials ? 'Share your socials' : 'Add socials in Settings first'}
            >
              📋
            </button>
          )}
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value.slice(0, 500))}
            onKeyDown={handleKeyDown}
            placeholder={disabled ? 'Not connected' : 'Type a message...'}
            disabled={disabled}
            className="flex-1 min-w-0 px-3 py-2 bg-white/5 text-white text-sm rounded-lg border border-white/10 focus:border-violet-500 focus:outline-none disabled:opacity-40 disabled:cursor-not-allowed placeholder-slate-500"
          />
          <button
            onClick={handleSend}
            disabled={disabled || !input.trim()}
            className="flex-none w-9 h-9 flex items-center justify-center btn-gradient text-white rounded-lg disabled:opacity-40 disabled:cursor-not-allowed active:scale-90 transition-all"
            title="Send"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
