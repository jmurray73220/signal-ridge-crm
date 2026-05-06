import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Sparkles, X, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { createTrack } from '../api';
import { useAuth } from '../AuthContext';
import { useClientContext } from '../ClientContext';

export function QuickOpportunity() {
  const { user } = useAuth();
  const isAdmin = user?.workflowRole === 'WorkflowAdmin';
  const { clients, selectedClientId } = useClientContext();
  const qc = useQueryClient();
  const nav = useNavigate();

  const [open, setOpen] = useState(false);
  const [clientId, setClientId] = useState<string>('');
  const [url, setUrl] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (open) setClientId(selectedClientId || clients[0]?.id || '');
  }, [open, selectedClientId, clients]);

  if (!isAdmin) return null;

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!clientId || !url.trim()) return;
    setCreating(true);
    try {
      const track = await createTrack({
        workflowClientId: clientId,
        title: 'New opportunity',
        isContractOpportunity: true,
        opportunityUrl: url.trim(),
      });
      toast.success('Track created — Claude is reading the URL');
      qc.invalidateQueries({ queryKey: ['tracks'] });
      setOpen(false);
      setUrl('');
      if (track?.id) nav(`/tracks/${track.id}`);
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Failed to create track');
    } finally {
      setCreating(false);
    }
  }

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
            width: 'min(420px, calc(100vw - 2rem))',
          }}
        >
          <div
            className="flex items-center justify-between px-4 py-3 border-b"
            style={{ borderColor: '#24375a' }}
          >
            <div className="flex items-center gap-2">
              <Sparkles size={16} className="text-accent" />
              <span className="text-sm font-semibold">New opportunity</span>
            </div>
            <button onClick={() => setOpen(false)} className="text-text-muted hover:text-accent">
              <X size={16} />
            </button>
          </div>

          <form onSubmit={submit} className="p-4 space-y-3">
            <div>
              <label className="label">Client</label>
              <select
                className="input"
                value={clientId}
                onChange={e => setClientId(e.target.value)}
                disabled={creating}
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
                disabled={creating}
              />
              <p className="text-xs text-text-muted mt-1.5">
                Claude will fetch this URL and fill in solicitation #, vehicle type, due date, funding ceiling, and objective.
              </p>
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button type="button" className="btn-secondary" onClick={() => setOpen(false)} disabled={creating}>
                Cancel
              </button>
              <button
                type="submit"
                className="btn-primary flex items-center gap-1.5"
                disabled={creating || !clientId || !url.trim()}
              >
                {creating && <Loader2 size={14} className="animate-spin" />}
                {creating ? 'Creating…' : 'Create track'}
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
