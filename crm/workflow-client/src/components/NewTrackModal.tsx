import { useState, type FormEvent } from 'react';
import { Loader2 } from 'lucide-react';
import { Modal } from './Modal';

type Stage = 'type' | 'no-title' | 'opp-url' | 'creating';

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

  function pickType(opp: boolean) {
    setStage(opp ? 'opp-url' : 'no-title');
  }

  async function submitNonOpp(e: FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    onSubmit({ title: title.trim(), isContractOpportunity: false });
  }

  // Create the track immediately with just the URL. The server reads the
  // opportunity (SAM.gov API + attachments, or a direct fetch) in the
  // background and fills the fields in; the track page polls until it's done.
  async function submitUrl(e: FormEvent) {
    e.preventDefault();
    if (!url.trim()) return;
    setStage('creating');
    await onSubmit({
      title: 'New opportunity',
      isContractOpportunity: true,
      opportunityUrl: url.trim(),
    });
  }

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
              onChange={e => setUrl(e.target.value)}
              placeholder="https://sam.gov/opp/… or DSIP / grants.gov / etc."
              autoFocus
            />
            <p className="text-xs text-text-muted mt-1.5">
              The track is created right away. Claude reads the opportunity (including SAM.gov attachments) in the background and fills in the details — the track page updates on its own when it's done.
            </p>
          </div>
          <div className="flex justify-between pt-2">
            <button type="button" className="btn-secondary" onClick={() => setStage('type')}>← Back</button>
            <div className="flex gap-3">
              <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
              <button type="submit" className="btn-primary" disabled={!url.trim()}>Create &amp; analyze</button>
            </div>
          </div>
        </form>
      )}

      {stage === 'creating' && (
        <div className="flex items-center gap-2 text-sm text-text-primary py-3">
          <Loader2 size={14} className="animate-spin text-accent" />
          <span>Creating the track…</span>
        </div>
      )}
    </Modal>
  );
}
