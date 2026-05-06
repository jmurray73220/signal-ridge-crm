import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Sparkles, X, Loader2, AlertTriangle } from 'lucide-react';
import toast from 'react-hot-toast';
import { createTrack, extractPreview } from '../api';
import { useAuth } from '../AuthContext';
import { useClientContext } from '../ClientContext';

const REASON_COPY: Record<string, string> = {
  http_error: 'The website returned an error (often a login wall or block).',
  unreadable_body: 'The page could not be read.',
  js_only_or_empty: 'The page is JavaScript-rendered or empty when fetched directly — Claude can\'t read it from the server.',
  timeout: 'The fetch timed out.',
  fetch_failed: 'Could not reach the URL.',
  invalid_input: 'A URL or pasted text is required.',
};

type Stage = 'input' | 'fetching' | 'paste' | 'extracting-paste' | 'creating';

export function QuickOpportunity() {
  const { user } = useAuth();
  const isAdmin = user?.workflowRole === 'WorkflowAdmin';
  const { clients, selectedClientId } = useClientContext();
  const qc = useQueryClient();
  const nav = useNavigate();

  const [open, setOpen] = useState(false);
  const [clientId, setClientId] = useState<string>('');
  const [url, setUrl] = useState('');
  const [pastedText, setPastedText] = useState('');
  const [stage, setStage] = useState<Stage>('input');
  const [failedReason, setFailedReason] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setClientId(selectedClientId || clients[0]?.id || '');
      setStage('input');
      setFailedReason(null);
      setUrl('');
      setPastedText('');
    }
  }, [open, selectedClientId, clients]);

  if (!isAdmin) return null;

  function close() {
    setOpen(false);
  }

  async function persistTrack(opportunityUrl: string, fields: Record<string, any>) {
    setStage('creating');
    const track = await createTrack({
      workflowClientId: clientId,
      title: typeof fields.title === 'string' && fields.title.trim() ? fields.title : 'New opportunity',
      isContractOpportunity: true,
      opportunityUrl,
      extractedFields: fields,
    });
    qc.invalidateQueries({ queryKey: ['tracks'] });
    toast.success('Track created');
    close();
    if (track?.id) nav(`/tracks/${track.id}`);
  }

  async function submitUrl(e: FormEvent) {
    e.preventDefault();
    if (!clientId || !url.trim()) return;
    setStage('fetching');
    setFailedReason(null);
    try {
      const result = await extractPreview({ url: url.trim() });
      if (result.ok && result.fields) {
        await persistTrack(url.trim(), result.fields);
      } else {
        setFailedReason(result.reason || 'fetch_failed');
        setStage('paste');
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Extraction failed');
      setStage('input');
    }
  }

  async function submitPaste() {
    if (!clientId || pastedText.trim().length < 100) return;
    setStage('extracting-paste');
    try {
      const result = await extractPreview({ url: url.trim() || undefined, text: pastedText });
      if (result.ok && result.fields) {
        await persistTrack(url.trim(), result.fields);
      } else {
        toast.error('Extraction failed — try pasting more of the page');
        setStage('paste');
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Extraction failed');
      setStage('paste');
    }
  }

  const busy = stage !== 'input' && stage !== 'paste';
  const stageLabel: Record<Stage, string> = {
    input: '',
    fetching: 'Fetching the page…',
    paste: '',
    'extracting-paste': 'Reading the pasted text with Claude…',
    creating: 'Creating the track…',
  };

  return (
    <>
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-5 right-5 z-40 flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-medium shadow-lg hover:scale-105 transition-transform"
          style={{ background: '#c9a84c', color: '#0d1117' }}
          title="Quick-add a contract opportunity"
        >
          <Sparkles size={16} /> New opportunity
        </button>
      )}

      {open && (
        <div
          className="fixed bottom-5 right-5 z-40 flex flex-col rounded-xl shadow-2xl"
          style={{
            background: '#12213a',
            border: '1px solid #24375a',
            borderTop: '2px solid #c9a84c',
            width: 'min(480px, calc(100vw - 2rem))',
            maxHeight: 'calc(100vh - 2rem)',
            overflowY: 'auto',
          }}
        >
          <div
            className="flex items-center justify-between px-4 py-3 border-b sticky top-0"
            style={{ borderColor: '#24375a', background: '#12213a' }}
          >
            <div className="flex items-center gap-2">
              <Sparkles size={16} className="text-accent" />
              <span className="text-sm font-semibold">New opportunity</span>
            </div>
            <button onClick={close} className="text-text-muted hover:text-accent" disabled={busy}>
              <X size={16} />
            </button>
          </div>

          <form onSubmit={submitUrl} className="p-4 space-y-3">
            <div>
              <label className="label">Client</label>
              <select
                className="input"
                value={clientId}
                onChange={e => setClientId(e.target.value)}
                disabled={busy || stage === 'paste'}
              >
                {clients.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Opportunity URL</label>
              <input
                className="input"
                value={url}
                onChange={e => { setUrl(e.target.value); setFailedReason(null); }}
                placeholder="https://sam.gov/opp/… or DSIP / grants.gov / etc."
                autoFocus
                disabled={busy || stage === 'paste'}
              />
              {stage === 'input' && (
                <p className="text-xs text-text-muted mt-1.5">
                  Claude will analyze the page and create the track once it has the details.
                </p>
              )}
            </div>

            {stage === 'input' && (
              <div className="flex justify-end gap-2 pt-1">
                <button type="button" className="btn-secondary" onClick={close}>Cancel</button>
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={!clientId || !url.trim()}
                >
                  Analyze URL
                </button>
              </div>
            )}
          </form>

          {(stage === 'fetching' || stage === 'extracting-paste' || stage === 'creating') && (
            <div className="px-4 pb-4 flex items-center gap-2 text-sm text-text-primary">
              <Loader2 size={14} className="animate-spin text-accent" />
              <span>{stage === 'fetching' ? 'Working — fetching and analyzing with Claude (this can take 20–40 seconds)…' : stageLabel[stage]}</span>
            </div>
          )}

          {stage === 'paste' && (
            <div className="px-4 pb-4 space-y-3" style={{ borderTop: '1px solid #24375a' }}>
              <div className="flex items-start gap-2 pt-3">
                <AlertTriangle size={16} className="text-status-amber mt-0.5 shrink-0" />
                <div className="text-xs text-status-amber">
                  <div className="font-semibold mb-1">Claude can't read this URL directly.</div>
                  <div>{REASON_COPY[failedReason || 'fetch_failed']}</div>
                </div>
              </div>

              <div>
                <div className="text-xs text-text-muted uppercase tracking-wider mb-1">Paste the page text</div>
                <p className="text-xs text-text-muted mb-2">
                  Open the URL in a tab where you're signed in, Ctrl+A → Ctrl+C → paste below. Or use the bookmarklet from Admin → Advanced.
                </p>
                <textarea
                  className="input"
                  rows={6}
                  value={pastedText}
                  onChange={e => setPastedText(e.target.value)}
                  placeholder="Paste the opportunity page text here…"
                  style={{ resize: 'vertical', fontFamily: 'monospace', fontSize: '12px' }}
                  autoFocus
                />
                <div className="flex justify-end mt-2 gap-2">
                  <button type="button" className="btn-secondary text-sm" onClick={close}>Cancel</button>
                  <button
                    type="button"
                    className="btn-primary text-sm"
                    onClick={submitPaste}
                    disabled={pastedText.trim().length < 100}
                  >
                    Analyze pasted text
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
}
