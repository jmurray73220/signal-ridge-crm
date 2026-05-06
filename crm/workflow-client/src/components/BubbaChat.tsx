import { useEffect, useRef, useState } from 'react';
import { Sparkles, X, Send, Loader2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { bubbaChat } from '../api';

type ChatMessage = { role: 'user' | 'assistant'; content: string };

const INITIAL_MESSAGE: ChatMessage = {
  role: 'assistant',
  content:
    "Hi, I'm Bubba. Tell me what you need — e.g. \"create a track for [client] from [URL]\" and I'll set it up.",
};

// Renders inline Markdown-ish "[track:UUID]" tokens as actual links into the
// app, so Bubba's confirmation messages are clickable.
function renderMessage(content: string) {
  const parts = content.split(/(\[track:[a-f0-9-]+\])/i);
  return parts.map((part, i) => {
    const m = part.match(/^\[track:([a-f0-9-]+)\]$/i);
    if (m) {
      return (
        <Link key={i} to={`/tracks/${m[1]}`} className="text-accent underline">
          Open track →
        </Link>
      );
    }
    return <span key={i}>{part}</span>;
  });
}

export function BubbaChat() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([INITIAL_MESSAGE]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, open]);

  async function send() {
    const text = input.trim();
    if (!text || sending) return;
    const next = [...messages, { role: 'user' as const, content: text }];
    setMessages(next);
    setInput('');
    setSending(true);
    try {
      // Strip the initial greeting from what we send to the server — Claude
      // doesn't need to see its own canned hello.
      const apiMessages = next.filter(m => m !== INITIAL_MESSAGE);
      const { reply } = await bubbaChat(apiMessages);
      setMessages([...next, { role: 'assistant', content: reply }]);
    } catch (err: any) {
      setMessages([
        ...next,
        { role: 'assistant', content: `Error: ${err?.response?.data?.error || 'Bubba is unavailable'}` },
      ]);
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      {/* Floating launcher */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-5 right-5 z-40 flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-medium shadow-lg hover:scale-105 transition-transform"
          style={{ background: '#c9a84c', color: '#0d1117' }}
        >
          <Sparkles size={16} /> Ask Bubba
        </button>
      )}

      {/* Drawer */}
      {open && (
        <div
          className="fixed bottom-5 right-5 z-40 flex flex-col rounded-xl shadow-2xl"
          style={{
            background: '#12213a',
            border: '1px solid #24375a',
            borderTop: '2px solid #c9a84c',
            width: 'min(420px, calc(100vw - 2rem))',
            height: 'min(560px, calc(100vh - 6rem))',
          }}
        >
          <div
            className="flex items-center justify-between px-4 py-3 border-b"
            style={{ borderColor: '#24375a' }}
          >
            <div className="flex items-center gap-2">
              <Sparkles size={16} className="text-accent" />
              <span className="text-sm font-semibold">Bubba</span>
              <span className="text-xs text-text-muted">workflow assistant</span>
            </div>
            <button onClick={() => setOpen(false)} className="text-text-muted hover:text-accent">
              <X size={16} />
            </button>
          </div>

          <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
            {messages.map((m, i) => (
              <div
                key={i}
                className={`text-sm whitespace-pre-wrap ${
                  m.role === 'user' ? 'text-right' : 'text-left'
                }`}
              >
                <div
                  className={`inline-block px-3 py-2 rounded-lg max-w-[88%] ${
                    m.role === 'user'
                      ? 'bg-accent text-bg-deep'
                      : 'bg-bg-deep text-text-primary border border-border-soft'
                  }`}
                  style={m.role === 'user' ? { background: '#c9a84c', color: '#0d1117' } : {}}
                >
                  {renderMessage(m.content)}
                </div>
              </div>
            ))}
            {sending && (
              <div className="flex items-center gap-2 text-xs text-text-muted">
                <Loader2 size={12} className="animate-spin" /> Bubba is thinking…
              </div>
            )}
          </div>

          <div className="px-3 py-3 border-t" style={{ borderColor: '#24375a' }}>
            <div className="flex gap-2">
              <input
                className="input flex-1 text-sm"
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    send();
                  }
                }}
                placeholder="Ask Bubba anything…"
                disabled={sending}
                autoFocus
              />
              <button
                onClick={send}
                disabled={sending || !input.trim()}
                className="btn-primary px-3"
                aria-label="Send"
              >
                <Send size={14} />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
