import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Sparkles, X, Loader2, AlertTriangle } from 'lucide-react';
import toast from 'react-hot-toast';
import { createTrack, probeOpportunityUrl, extractTrackFromText } from '../api';
import { useAuth } from '../AuthContext';
import { useClientContext } from '../ClientContext';

const REASON_COPY: Record<string, string> = {
  http_error: 'The website returned an error (often a login wall or block).',
  unreadable_body: 'The page could not be read.',
  js_only_or_empty: 'The page is JavaScript-rendered or empty when fetched directly — Claude can\'t read it from the server.',
  timeout: 'The fetch timed out.',
  fetch_failed: 'Could not reach the URL.',
  invalid_url: 'That doesn\'t look like a valid http/https URL.',
};

export function QuickOpportunity() {
  const { user } = useAuth();
  const isAdmin = user?.workflowRole === 'WorkflowAdmin';
  const { clients, selectedClientId } = useClientContext();
  const qc = useQueryClient();
  const nav = useNavigate();

  const [open, setOpen] = useState(false);
  const [clientId, setClientId] = useState<string>('');
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);
  // After a probe fails, we ask the user how they want to proceed.
  const [probeFailed, setProbeFailed] = useState<{ reason: string } | null>(null);
  const [pastedText, setPastedText] = useState('');

  useEffect(() => {
    if (open) {
      setClientId(selectedClientId || clients[0]?.id || '');
      setProbeFailed(null);
      setPastedText('');
    }
  }, [open, selectedClientId, clients]);

  if (!isAdmin) return null;

  function close() {
    setOpen(false);
    setUrl('');
    setProbeFailed(null);
    setPastedText('');
  }

  async function createWithReadableUrl(opportunityUrl: string) {
    const track = await createTrack({
      workflowClientId: clientId,
      title: 'New opportunity',
      isContractOpportunity: true,
      opportunityUrl,
    });
    toast.success('Track created — Claude is reading the URL');
    qc.invalidateQueries({ queryKey: ['tracks'] });
    close();
    if (track?.id) nav(`/tracks/${track.id}`);
  }

  async function createWithPastedText(opportunityUrl: string, text: string) {
    const track = await createTrack({
      workflowClientId: clientId,
      title: 'New opportunity',
      isContractOpportunity: true,
      opportunityUrl,
    });
    if (track?.id) {
      await extractTrackFromText(track.id, text).catch(() => undefined);
    }
    toast.success('Track created — Claude is reading the pasted text');
    qc.invalidateQueries({ queryKey: ['tracks'] });
    close();
    if (track?.id) nav(`/tracks/${track.id}`);
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!clientId || !url.trim()) return;
    setBusy(true);
    try {
      const probe = await probeOpportunityUrl(url.trim());
      if (probe.ok) {
        await createWithReadableUrl(url.trim());
      } else {
        setProbeFailed({ reason: probe.reason || 'fetch_failed' });
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Failed');
    } finally {
      setBusy(false);
    }
  }

  async function submitPaste() {
    if (!clientId || !url.trim() || pastedText.trim().length < 100) return;
    setBusy(true);
    try {
      await createWithPastedText(url.trim(), pastedText);
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Failed');
    } finally {
      setBusy(false);
    }
  }

  async function createAnyway() {
    setBusy(true);
    try {
      await createWithReadableUrl(url.trim());
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Failed');
    } finally {
      setBusy(false);
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
            <button onClick={close} className="text-text-muted hover:text-accent">
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
                onChange={e => { setUrl(e.target.value); setProbeFailed(null); }}
                placeholder="https://sam.gov/opp/… or DSIP / grants.gov / etc."
                autoFocus
                disabled={busy}
              />
              <p className="text-xs text-text-muted mt-1.5">
                Claude will fetch this URL and fill in solicitation #, vehicle type, focus areas, due dates, funding, eligibility, POCs, etc.
              </p>
            </div>

            {!probeFailed && (
              <div className="flex justify-end gap-2 pt-1">
                <button type="button" className="btn-secondary" onClick={close} disabled={busy}>Cancel</button>
                <button
                  type="submit"
                  className="btn-primary flex items-center gap-1.5"
                  disabled={busy || !clientId || !url.trim()}
                >
                  {busy && <Loader2 size={14} className="animate-spin" />}
                  {busy ? 'Checking URL…' : 'Create track'}
                </button>
              </div>
            )}
          </form>

          {probeFailed && (
            <div className="px-4 pb-4 space-y-3" style={{ borderTop: '1px solid #24375a' }}>
              <div className="flex items-start gap-2 pt-3">
                <AlertTriangle size={16} className="text-status-amber mt-0.5 shrink-0" />
                <div className="text-xs text-status-amber">
                  <div className="font-semibold mb-1">Claude can't read this URL directly.</div>
                  <div>{REASON_COPY[probeFailed.reason] || 'The page could not be fetched.'}</div>
                </div>
              </div>

              <div>
                <div className="text-xs text-text-muted uppercase tracking-wider mb-1">Option A — Paste page text</div>
                <p className="text-xs text-text-muted mb-2">
                  Open the URL in a tab where you're signed in, Ctrl+A → Ctrl+C → paste below.
                </p>
                <textarea
                  className="input"
                  rows={5}
                  value={pastedText}
                  onChange={e => setPastedText(e.target.value)}
                  placeholder="Paste the opportunity page text here…"
                  style={{ resize: 'vertical', fontFamily: 'monospace', fontSize: '12px' }}
                  disabled={busy}
                />
                <div className="flex justify-end mt-2">
                  <button
                    type="button"
                    className="btn-primary text-sm flex items-center gap-1.5"
                    onClick={submitPaste}
                    disabled={busy || pastedText.trim().length < 100}
                  >
                    {busy && <Loader2 size={14} className="animate-spin" />}
                    Create + extract from pasted text
                  </button>
                </div>
              </div>

              <div className="text-xs text-text-muted">
                <span className="font-semibold uppercase tracking-wider">Option B — Bookmarklet</span>
                <span className="ml-1">(advanced; install once from Admin → Advanced)</span>
              </div>

              <div className="flex justify-between gap-2 pt-2" style={{ borderTop: '1px solid #24375a' }}>
                <button type="button" className="btn-secondary text-xs" onClick={close} disabled={busy}>
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn-secondary text-xs"
                  onClick={createAnyway}
                  disabled={busy}
                  title="Create the track now and fill in fields manually later"
                >
                  Create track anyway (fill manually)
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
}
