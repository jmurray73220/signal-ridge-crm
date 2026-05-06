import { useState, type FormEvent } from 'react';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { Modal } from './Modal';
import { extractPreview } from '../api';

const REASON_COPY: Record<string, string> = {
  http_error: 'The website returned an error (often a login wall or block).',
  unreadable_body: 'The page could not be read.',
  js_only_or_empty: 'The page is JavaScript-rendered or empty when fetched directly — Claude can\'t read it from the server.',
  timeout: 'The fetch timed out.',
  fetch_failed: 'Could not reach the URL.',
  invalid_input: 'A URL or pasted text is required.',
};

type Stage = 'type' | 'no-title' | 'opp-url' | 'opp-fetching' | 'opp-paste' | 'opp-extracting' | 'creating';

interface Props {
  loading: boolean;
  onClose: () => void;
  onSubmit: (data: {
    title: string;
    isContractOpportunity: boolean;
    opportunityUrl?: string;
    extractedFields?: Record<string, any>;
  }) => void | Promise<void>;
}

export function NewTrackModal({ loading, onClose, onSubmit }: Props) {
  const [stage, setStage] = useState<Stage>('type');
  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const [pastedText, setPastedText] = useState('');
  const [failedReason, setFailedReason] = useState<string | null>(null);

  function pickType(opp: boolean) {
    setFailedReason(null);
    if (opp) setStage('opp-url');
    else setStage('no-title');
  }

  async function submitNonOpp(e: FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    onSubmit({ title: title.trim(), isContractOpportunity: false });
  }

  async function submitUrl(e: FormEvent) {
    e.preventDefault();
    if (!url.trim()) return;
    setStage('opp-fetching');
    setFailedReason(null);
    try {
      const result = await extractPreview({ url: url.trim() });
      if (result.ok && result.fields) {
        setStage('creating');
        await onSubmit({
          title: typeof result.fields.title === 'string' && result.fields.title.trim()
            ? result.fields.title
            : 'New opportunity',
          isContractOpportunity: true,
          opportunityUrl: url.trim(),
          extractedFields: result.fields,
        });
      } else {
        setFailedReason(result.reason || 'fetch_failed');
        setStage('opp-paste');
      }
    } catch {
      setFailedReason('fetch_failed');
      setStage('opp-paste');
    }
  }

  async function submitPaste() {
    if (pastedText.trim().length < 100) return;
    setStage('opp-extracting');
    try {
      const result = await extractPreview({ url: url.trim() || undefined, text: pastedText });
      if (result.ok && result.fields) {
        setStage('creating');
        await onSubmit({
          title: typeof result.fields.title === 'string' && result.fields.title.trim()
            ? result.fields.title
            : 'New opportunity',
          isContractOpportunity: true,
          opportunityUrl: url.trim(),
          extractedFields: result.fields,
        });
      } else {
        setStage('opp-paste');
      }
    } catch {
      setStage('opp-paste');
    }
  }

  const busy = stage === 'opp-fetching' || stage === 'opp-extracting' || stage === 'creating' || loading;

  return (
    <Modal title="New track" onClose={onClose}>
      {stage === 'type' && (
        <div className="space-y-4">
          <p className="text-sm text-text-primary">Is this a contract opportunity?</p>
          <p className="text-xs text-text-muted">
            Contract opportunities get proposal-cycle phases pre-seeded and let you attach an SOW. Other tracks (relationship building, internal projects, etc.) skip both.
          </p>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" className="btn-secondary" onClick={() => pickType(false)}>No</button>
            <button type="button" className="btn-primary" onClick={() => pickType(true)}>Yes</button>
          </div>
        </div>
      )}

      {stage === 'no-title' && (
        <form onSubmit={submitNonOpp} className="space-y-4">
          <div>
            <label className="label">Track title</label>
            <input
              className="input"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="e.g. Genesis Resubmission"
              autoFocus
              disabled={loading}
            />
          </div>
          <div className="flex justify-between pt-2">
            <button type="button" className="btn-secondary" onClick={() => setStage('type')} disabled={loading}>← Back</button>
            <div className="flex gap-3">
              <button type="button" className="btn-secondary" onClick={onClose} disabled={loading}>Cancel</button>
              <button type="submit" className="btn-primary" disabled={loading || !title.trim()}>
                {loading ? 'Creating…' : 'Create track'}
              </button>
            </div>
          </div>
        </form>
      )}

      {stage === 'opp-url' && (
        <form onSubmit={submitUrl} className="space-y-4">
          <div>
            <label className="label">Opportunity URL</label>
            <input
              className="input"
              value={url}
              onChange={e => { setUrl(e.target.value); setFailedReason(null); }}
              placeholder="https://sam.gov/opp/… or DSIP / grants.gov / etc."
              autoFocus
            />
            <p className="text-xs text-text-muted mt-1.5">
              Claude will analyze the page and create the track once it has the details.
            </p>
          </div>
          <div className="flex justify-between pt-2">
            <button type="button" className="btn-secondary" onClick={() => setStage('type')}>← Back</button>
            <div className="flex gap-3">
              <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
              <button type="submit" className="btn-primary" disabled={!url.trim()}>Analyze URL</button>
            </div>
          </div>
        </form>
      )}

      {(stage === 'opp-fetching' || stage === 'opp-extracting' || stage === 'creating') && (
        <div className="flex items-center gap-2 text-sm text-text-primary py-3">
          <Loader2 size={14} className="animate-spin text-accent" />
          <span>
            {stage === 'opp-fetching' && 'Working — fetching and analyzing with Claude (this can take 20–40 seconds)…'}
            {stage === 'opp-extracting' && 'Reading the pasted text with Claude…'}
            {stage === 'creating' && 'Creating the track…'}
          </span>
        </div>
      )}

      {stage === 'opp-paste' && (
        <div className="space-y-3">
          <div className="flex items-start gap-2">
            <AlertTriangle size={16} className="text-status-amber mt-0.5 shrink-0" />
            <div className="text-xs text-status-amber">
              <div className="font-semibold mb-1">Claude can't read this URL directly.</div>
              <div>{REASON_COPY[failedReason || 'fetch_failed']}</div>
            </div>
          </div>
          <div>
            <label className="label">Paste the page text</label>
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
              disabled={busy}
            />
          </div>
          <div className="flex justify-between pt-1">
            <button type="button" className="btn-secondary text-sm" onClick={() => setStage('opp-url')} disabled={busy}>← Back to URL</button>
            <div className="flex gap-2">
              <button type="button" className="btn-secondary text-sm" onClick={onClose} disabled={busy}>Cancel</button>
              <button type="button" className="btn-primary text-sm" onClick={submitPaste} disabled={busy || pastedText.trim().length < 100}>
                Analyze pasted text
              </button>
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}
