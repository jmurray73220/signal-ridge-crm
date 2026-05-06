import { useState, type FormEvent } from 'react';
import { Modal } from './Modal';

interface Props {
  loading: boolean;
  onClose: () => void;
  onSubmit: (data: { title: string; isContractOpportunity: boolean; opportunityUrl?: string }) => void | Promise<void>;
}

export function NewTrackModal({ loading, onClose, onSubmit }: Props) {
  const [step, setStep] = useState<'type' | 'details'>('type');
  const [isOpp, setIsOpp] = useState<boolean | null>(null);
  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');

  function pickType(opp: boolean) {
    setIsOpp(opp);
    setStep('details');
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const t = title.trim();
    if (!t && !isOpp) return;
    if (isOpp && !url.trim() && !t) return;
    onSubmit({
      title: t || 'New opportunity',
      isContractOpportunity: !!isOpp,
      opportunityUrl: isOpp ? url.trim() || undefined : undefined,
    });
  }

  return (
    <Modal title="New track" onClose={onClose}>
      {step === 'type' && (
        <div className="space-y-4">
          <p className="text-sm text-text-primary">Is this a contract opportunity?</p>
          <p className="text-xs text-text-muted">
            Contract opportunities get proposal-cycle phases pre-seeded and let you attach an SOW. Other tracks (relationship building, internal projects, etc.) skip both.
          </p>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" className="btn-secondary" onClick={() => pickType(false)}>
              No
            </button>
            <button type="button" className="btn-primary" onClick={() => pickType(true)}>
              Yes
            </button>
          </div>
        </div>
      )}

      {step === 'details' && (
        <form onSubmit={handleSubmit} className="space-y-4">
          {isOpp && (
            <div>
              <label className="label">Opportunity URL</label>
              <input
                className="input"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://sam.gov/opp/… or DSIP, grants.gov, etc."
                autoFocus
              />
              <p className="text-xs text-text-muted mt-1.5">
                Claude will fetch this URL and fill in solicitation #, vehicle type, due date, funding ceiling, and objective. You can edit anything afterwards.
              </p>
            </div>
          )}
          <div>
            <label className="label">Title{isOpp ? ' (optional — Claude will rename if blank)' : ''}</label>
            <input
              className="input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={isOpp ? 'Leave blank to auto-fill from URL' : 'e.g. Genesis Resubmission'}
              autoFocus={!isOpp}
            />
          </div>
          <div className="flex justify-between pt-2">
            <button
              type="button"
              className="btn-secondary"
              onClick={() => setStep('type')}
              disabled={loading}
            >
              ← Back
            </button>
            <div className="flex gap-3">
              <button type="button" className="btn-secondary" onClick={onClose} disabled={loading}>
                Cancel
              </button>
              <button
                type="submit"
                className="btn-primary"
                disabled={loading || (!isOpp && !title.trim()) || (!!isOpp && !url.trim() && !title.trim())}
              >
                {loading ? 'Creating…' : 'Create track'}
              </button>
            </div>
          </div>
        </form>
      )}
    </Modal>
  );
}
