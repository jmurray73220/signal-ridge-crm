import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Bookmark, X, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import {
  getBookmarkCapture,
  consumeBookmarkCapture,
  createTrack,
  extractTrackFromText,
  type BookmarkCapture,
} from '../api';
import { useClientContext } from '../ClientContext';
import { useAuth } from '../AuthContext';

// When the bookmarklet form-submits to /workflow/from-bookmark, the server
// redirects the user to /workflow/?capture=<id>. This component watches for
// that param, fetches the capture, and walks the user through turning it
// into a contract opportunity track.

export function BookmarkCapturePickup() {
  const { user } = useAuth();
  const isAdmin = user?.workflowRole === 'WorkflowAdmin';
  const { clients, selectedClientId } = useClientContext();
  const qc = useQueryClient();
  const nav = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const captureId = searchParams.get('capture');

  const [capture, setCapture] = useState<BookmarkCapture | null>(null);
  const [clientId, setClientId] = useState('');
  const [creating, setCreating] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!captureId) {
      setCapture(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    getBookmarkCapture(captureId)
      .then(c => {
        if (cancelled) return;
        setCapture(c);
        setClientId(selectedClientId || clients[0]?.id || '');
      })
      .catch(() => toast.error('Capture not found or expired'))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [captureId, selectedClientId, clients]);

  if (!isAdmin || !captureId) return null;

  function dismiss() {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      next.delete('capture');
      return next;
    });
    setCapture(null);
  }

  async function createFromCapture() {
    if (!capture || !clientId) return;
    setCreating(true);
    try {
      const track = await createTrack({
        workflowClientId: clientId,
        title: 'New opportunity',
        isContractOpportunity: true,
        opportunityUrl: capture.pageUrl,
      });
      // Run extraction against the captured text instead of refetching the URL.
      if (track?.id) {
        await extractTrackFromText(track.id, capture.pageText).catch(() => undefined);
      }
      await consumeBookmarkCapture(capture.id).catch(() => undefined);
      qc.invalidateQueries({ queryKey: ['tracks'] });
      toast.success('Track created from captured page');
      dismiss();
      if (track?.id) nav(`/tracks/${track.id}`);
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Failed to create track');
    } finally {
      setCreating(false);
    }
  }

  if (loading || !capture) {
    if (loading) {
      return (
        <div
          className="fixed bottom-5 right-5 z-50 px-4 py-2 rounded-lg shadow-lg flex items-center gap-2 text-sm"
          style={{ background: '#12213a', border: '1px solid #24375a', color: '#e6edf3' }}
        >
          <Loader2 size={14} className="animate-spin" /> Loading capture…
        </div>
      );
    }
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.7)' }}
    >
      <div
        className="w-full max-w-lg rounded-xl"
        style={{ background: '#12213a', border: '1px solid #24375a', borderTop: '2px solid #c9a84c' }}
      >
        <div
          className="flex items-center justify-between px-5 py-3 border-b"
          style={{ borderColor: '#24375a' }}
        >
          <div className="flex items-center gap-2">
            <Bookmark size={16} className="text-accent" />
            <span className="text-sm font-semibold">Captured page</span>
          </div>
          <button onClick={dismiss} className="text-text-muted hover:text-accent">
            <X size={16} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div>
            <div className="text-xs text-text-muted uppercase tracking-wider">From</div>
            <a
              href={capture.pageUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-accent break-all hover:underline"
            >
              {capture.pageUrl}
            </a>
          </div>

          <div>
            <div className="text-xs text-text-muted uppercase tracking-wider mb-1">Page text preview</div>
            <div
              className="text-xs text-text-muted whitespace-pre-wrap rounded p-2 max-h-32 overflow-y-auto"
              style={{ background: '#0d1117', border: '1px solid #24375a' }}
            >
              {capture.pageText.slice(0, 600)}
              {capture.pageText.length > 600 && '…'}
            </div>
            <div className="text-xs text-text-muted mt-1">
              {capture.pageText.length.toLocaleString()} characters captured
            </div>
          </div>

          <div>
            <label className="label">Client</label>
            <select
              className="input"
              value={clientId}
              onChange={e => setClientId(e.target.value)}
              disabled={creating}
            >
              <option value="">— Pick a client —</option>
              {clients.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <button type="button" className="btn-secondary" onClick={dismiss} disabled={creating}>
              Discard
            </button>
            <button
              type="button"
              className="btn-primary flex items-center gap-1.5"
              onClick={createFromCapture}
              disabled={creating || !clientId}
            >
              {creating && <Loader2 size={14} className="animate-spin" />}
              {creating ? 'Creating…' : 'Create track from this page'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
