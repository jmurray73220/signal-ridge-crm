import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Sparkles, X, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { createTrack } from '../api';
import { useAuth } from '../AuthContext';
import { useClientContext } from '../ClientContext';

type Stage = 'input' | 'creating';

export function QuickOpportunity() {
  const { user } = useAuth();
  const canEdit = user?.workflowRole === 'WorkflowAdmin' || user?.workflowRole === 'WorkflowEditor';
  const { clients, selectedClientId } = useClientContext();
  const qc = useQueryClient();
  const nav = useNavigate();

  const [open, setOpen] = useState(false);
  const [clientId, setClientId] = useState<string>('');
  const [url, setUrl] = useState('');
  const [stage, setStage] = useState<Stage>('input');

  useEffect(() => {
    if (open) {
      setClientId(selectedClientId || clients[0]?.id || '');
      setStage('input');
      setUrl('');
    }
  }, [open, selectedClientId, clients]);

  if (!canEdit) return null;

  function close() {
    setOpen(false);
  }

  // Create the track immediately with just the URL; the server reads the
  // opportunity (SAM.gov API + attachments, or a direct fetch) in the
  // background and the track page polls until the fields fill in.
  async function submitUrl(e: FormEvent) {
    e.preventDefault();
    if (!clientId || !url.trim()) return;
    setStage('creating');
    try {
      const track = await createTrack({
        workflowClientId: clientId,
        title: 'New opportunity',
        isContractOpportunity: true,
        opportunityUrl: url.trim(),
      });
      qc.invalidateQueries({ queryKey: ['tracks'] });
      toast.success('Track created — Claude is reading the opportunity');
      close();
      if (track?.id) nav(`/tracks/${track.id}`);
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Failed to create track');
      setStage('input');
    }
  }

  const busy = stage === 'creating';

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
                disabled={busy}
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
                onChange={e => setUrl(e.target.value)}
                placeholder="https://sam.gov/opp/… or DSIP / grants.gov / etc."
                autoFocus
                disabled={busy}
              />
              {stage === 'input' && (
                <p className="text-xs text-text-muted mt-1.5">
                  The track is created right away. Claude reads the opportunity (including SAM.gov attachments) in the background and the page fills in on its own.
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
                  Create &amp; analyze
                </button>
              </div>
            )}
          </form>

          {busy && (
            <div className="px-4 pb-4 flex items-center gap-2 text-sm text-text-primary">
              <Loader2 size={14} className="animate-spin text-accent" />
              <span>Creating the track…</span>
            </div>
          )}
        </div>
      )}
    </>
  );
}
