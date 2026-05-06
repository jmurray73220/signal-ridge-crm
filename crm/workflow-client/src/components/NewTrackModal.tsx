import { useState, type FormEvent } from 'react';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { Modal } from './Modal';
import { probeOpportunityUrl } from '../api';

const REASON_COPY: Record<string, string> = {
  http_error: 'The website returned an error (often a login wall or block).',
  unreadable_body: 'The page could not be read.',
  js_only_or_empty: 'The page is JavaScript-rendered or empty when fetched directly — Claude can\'t read it from the server.',
  timeout: 'The fetch timed out.',
  fetch_failed: 'Could not reach the URL.',
  invalid_url: 'That doesn\'t look like a valid http/https URL.',
};

interface Props {
  loading: boolean;
  onClose: () => void;
  onSubmit: (data: {
    title: string;
    isContractOpportunity: boolean;
    opportunityUrl?: string;
    pastedText?: string;
  }) => void | Promise<void>;
}

export function NewTrackModal({ loading, onClose, onSubmit }: Props) {
  const [step, setStep] = useState<'type' | 'details'>('type');
  const [isOpp, setIsOpp] = useState<boolean | null>(null);
  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const [probing, setProbing] = useState(false);
  const [probeFailed, setProbeFailed] = useState<{ reason: string } | null>(null);
  const [pastedText, setPastedText] = useState('');

  function pickType(opp: boolean) {
    setIsOpp(opp);
    setStep('details');
    setProbeFailed(null);
    setPastedText('');
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const t = title.trim();

    if (!isOpp) {
      if (!t) return;
      onSubmit({ title: t, isContractOpportunity: false });
      return;
    }

    // Contract opportunity branch — probe the URL first if one was provided.
    if (!url.trim() && !t) return;

    if (url.trim()) {
      setProbing(true);
      try {
        const probe = await probeOpportunityUrl(url.trim());
        if (!probe.ok) {
          setProbeFailed({ reason: probe.reason || 'fetch_failed' });
          setProbing(false);
          return;
        }
      } catch {
        setProbeFailed({ reason: 'fetch_failed' });
        setProbing(false);
        return;
      }
      setProbing(false);
    }

    onSubmit({
      title: t || 'New opportunity',
      isContractOpportunity: true,
      opportunityUrl: url.trim() || undefined,
    });
  }

  function submitWithPaste() {
    if (pastedText.trim().length < 100) return;
    onSubmit({
      title: title.trim() || 'New opportunity',
      isContractOpportunity: true,
      opportunityUrl: url.trim() || undefined,
      pastedText,
    });
  }

  function createAnyway() {
    onSubmit({
      title: title.trim() || 'New opportunity',
      isContractOpportunity: true,
      opportunityUrl: url.trim() || undefined,
    });
  }

  const busy = loading || probing;

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
                onChange={(e) => { setUrl(e.target.value); setProbeFailed(null); }}
                placeholder="https://sam.gov/opp/… or DSIP, grants.gov, etc."
                autoFocus
                disabled={busy}
              />
              <p className="text-xs text-text-muted mt-1.5">
                Claude will fetch this URL and fill in solicitation #, vehicle type, focus areas, due dates, funding, eligibility, POCs.
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
              disabled={busy}
            />
          </div>

          {probeFailed && (
            <div className="space-y-3 pt-2" style={{ borderTop: '1px solid #24375a' }}>
              <div className="flex items-start gap-2 pt-3">
                <AlertTriangle size={16} className="text-status-amber mt-0.5 shrink-0" />
                <div className="text-xs text-status-amber">
                  <div className="font-semibold mb-1">Claude can't read this URL directly.</div>
                  <div>{REASON_COPY[probeFailed.reason] || 'The page could not be fetched.'}</div>
                </div>
              </div>
              <div>
                <div className="text-xs text-text-muted uppercase tracking-wider mb-1">Option A — Paste page text</div>
                <p className="text-xs text-text-muted mb-2">Open the URL in a tab where you're signed in, Ctrl+A → Ctrl+C → paste below.</p>
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
                    onClick={submitWithPaste}
                    disabled={busy || pastedText.trim().length < 100}
                  >
                    Create + extract from pasted text
                  </button>
                </div>
              </div>
              <div className="text-xs text-text-muted">
                <span className="font-semibold uppercase tracking-wider">Option B — Bookmarklet</span>
                <span className="ml-1">(advanced; install once from Admin → Advanced)</span>
              </div>
            </div>
          )}

          <div className="flex justify-between pt-2">
            <button
              type="button"
              className="btn-secondary"
              onClick={() => setStep('type')}
              disabled={busy}
            >
              ← Back
            </button>
            <div className="flex gap-3">
              <button type="button" className="btn-secondary" onClick={onClose} disabled={busy}>
                Cancel
              </button>
              {probeFailed ? (
                <button
                  type="button"
                  className="btn-secondary text-sm"
                  onClick={createAnyway}
                  disabled={busy}
                  title="Create the track now and fill in fields manually"
                >
                  Create anyway (manual)
                </button>
              ) : (
                <button
                  type="submit"
                  className="btn-primary flex items-center gap-1.5"
                  disabled={busy || (!isOpp && !title.trim()) || (!!isOpp && !url.trim() && !title.trim())}
                >
                  {busy && <Loader2 size={14} className="animate-spin" />}
                  {probing ? 'Checking URL…' : loading ? 'Creating…' : 'Create track'}
                </button>
              )}
            </div>
          </div>
        </form>
      )}
    </Modal>
  );
}
