import { useState, useEffect } from 'react';
import { X, Copy, Loader2 } from 'lucide-react';
import { briefingApi } from '../api';
import ReactMarkdown from 'react-markdown';
import toast from 'react-hot-toast';

interface Props {
  type: 'contact' | 'entity';
  id: string;
  name: string;
  onClose: () => void;
}

export function BriefingModal({ type, id, name, onClose }: Props) {
  const [briefing, setBriefing] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchBriefing = async () => {
      try {
        const res = type === 'contact'
          ? await briefingApi.contact(id)
          : await briefingApi.entity(id);
        setBriefing(res.data.briefing);
      } catch (err: any) {
        setError(err.response?.data?.error || 'Failed to generate briefing. Check your ANTHROPIC_API_KEY.');
      } finally {
        setLoading(false);
      }
    };
    fetchBriefing();
  }, [type, id]);

  const handleCopy = () => {
    navigator.clipboard.writeText(briefing);
    toast.success('Briefing copied to clipboard');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.85)' }}>
      <div className="w-full max-w-3xl h-full max-h-[90vh] flex flex-col rounded-xl overflow-hidden" style={{ background: '#1c2333', border: '1px solid #30363d' }}>
        <div className="flex items-center justify-between px-6 py-4 flex-shrink-0" style={{ borderBottom: '1px solid #30363d' }}>
          <div>
            <h2 className="text-base font-semibold" style={{ color: '#e6edf3' }}>Briefing Memo</h2>
            <p className="text-xs" style={{ color: '#8b949e' }}>{name}</p>
          </div>
          <div className="flex items-center gap-2">
            {!loading && !error && (
              <button onClick={handleCopy} className="btn-secondary flex items-center gap-1.5 text-sm">
                <Copy size={14} /> Copy
              </button>
            )}
            <button onClick={onClose} style={{ color: '#8b949e' }}><X size={18} /></button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {loading && (
            <div className="flex flex-col items-center justify-center h-full gap-3">
              <Loader2 size={32} className="animate-spin" style={{ color: '#c9a84c' }} />
              <p className="text-sm" style={{ color: '#8b949e' }}>Generating briefing memo…</p>
            </div>
          )}
          {error && (
            <div className="text-center py-12">
              <p className="text-sm" style={{ color: '#da3633' }}>{error}</p>
            </div>
          )}
          {!loading && !error && (
            <div
              className="prose prose-invert max-w-none text-sm"
              style={{ color: '#e6edf3', lineHeight: 1.7 }}
            >
              <ReactMarkdown
                components={{
                  h2: ({ children }) => (
                    <h2 className="text-base font-semibold mt-6 mb-2" style={{ color: '#c9a84c' }}>{children}</h2>
                  ),
                  h3: ({ children }) => (
                    <h3 className="text-sm font-semibold mt-4 mb-1" style={{ color: '#e6edf3' }}>{children}</h3>
                  ),
                  p: ({ children }) => (
                    <p className="mb-3" style={{ color: '#8b949e' }}>{children}</p>
                  ),
                  ul: ({ children }) => (
                    <ul className="mb-3 ml-4 space-y-1" style={{ color: '#8b949e', listStyleType: 'disc' }}>{children}</ul>
                  ),
                  li: ({ children }) => <li>{children}</li>,
                  strong: ({ children }) => <strong style={{ color: '#e6edf3' }}>{children}</strong>,
                }}
              >
                {briefing}
              </ReactMarkdown>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
