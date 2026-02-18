import { useState, useRef, useEffect } from 'react';
import type { ChatMessage } from '../hooks/useChat';

interface ChatPanelProps {
  messages: ChatMessage[];
  onSend: (text: string) => void;
  disabled: boolean;
}

export default function ChatPanel({ messages, onSend, disabled }: ChatPanelProps) {
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = () => {
    if (!input.trim() || disabled) return;
    onSend(input);
    setInput('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="glass rounded-2xl flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-3 border-b border-white/10">
        <h2 className="text-sm font-semibold text-white">Chat</h2>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2 min-h-0">
        {messages.length === 0 && (
          <div className="text-center text-slate-500 text-xs mt-8">
            {disabled ? 'Connect to a partner to start chatting' : 'Say hello!'}
          </div>
        )}
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.isSelf ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[85%] px-3 py-2 rounded-xl text-sm break-words ${
                msg.isSelf
                  ? 'bg-violet-600/40 text-white rounded-br-sm'
                  : 'bg-white/10 text-slate-200 rounded-bl-sm'
              }`}
            >
              {msg.text}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-3 border-t border-white/10">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value.slice(0, 500))}
            onKeyDown={handleKeyDown}
            placeholder={disabled ? 'Not connected' : 'Type a message...'}
            disabled={disabled}
            className="flex-1 px-3 py-2 bg-white/5 text-white text-sm rounded-lg border border-white/10 focus:border-violet-500 focus:outline-none disabled:opacity-40 disabled:cursor-not-allowed placeholder-slate-500"
          />
          <button
            onClick={handleSend}
            disabled={disabled || !input.trim()}
            className="px-3 py-2 btn-gradient text-white rounded-lg text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
