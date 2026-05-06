import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Briefcase, X, Download, Bookmark } from 'lucide-react';
import toast from 'react-hot-toast';
import {
  listClients,
  listCrmClientEntities,
  createClient,
  backfillClientsFromCrm,
} from '../api';
import type { WorkflowClient } from '../types';
import { Modal } from '../components/Modal';

export function Admin() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<'clients' | 'tools'>('clients');

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-accent">Admin</h1>
          <p className="text-text-muted text-sm mt-1">
            Manage workflow clients. User access is managed in the CRM.
          </p>
        </div>
        <div className="inline-flex border border-border rounded overflow-hidden">
          <button
            className={`px-3 py-1.5 text-sm flex items-center gap-1 ${
              tab === 'clients' ? 'bg-surface text-accent' : 'text-text-muted'
            }`}
            onClick={() => setTab('clients')}
          >
            <Briefcase size={14} /> Clients
          </button>
          <button
            className={`px-3 py-1.5 text-sm flex items-center gap-1 ${
              tab === 'tools' ? 'bg-surface text-accent' : 'text-text-muted'
            }`}
            onClick={() => setTab('tools')}
          >
            <Bookmark size={14} /> Advanced
          </button>
        </div>
      </div>

      {tab === 'clients' && <ClientsAdmin qc={qc} />}
      {tab === 'tools' && <AdvancedTools />}
    </div>
  );
}

function AdvancedTools() {
  // Build the bookmarklet href against the current origin so it works on
  // localhost or production without recompiling.
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const bookmarkletJs = `(function(){try{var t=document.body.innerText||'';var u=location.href;var f=document.createElement('form');f.method='POST';f.action='${origin}/workflow/from-bookmark';f.target='_blank';f.style.display='none';var a=document.createElement('input');a.name='pageUrl';a.value=u;f.appendChild(a);var b=document.createElement('textarea');b.name='pageText';b.value=t.slice(0,200000);f.appendChild(b);document.body.appendChild(f);f.submit();}catch(e){alert('Capture failed: '+e.message);}})();`;
  const href = 'javascript:' + encodeURIComponent(bookmarkletJs).replace(/'/g, '%27');

  return (
    <div className="space-y-6">
      <div className="card">
        <div className="flex items-center gap-2 mb-2">
          <Bookmark size={16} className="text-accent" />
          <h2 className="text-base font-semibold">Capture-page bookmarklet</h2>
        </div>
        <p className="text-sm text-text-muted">
          For pages Claude can't read directly (login-walled portals, JS-only sites): drag the
          gold link below to your bookmarks bar. When you're on a foreign tab where you're already
          signed in, click the bookmark — it scrapes the page text and posts it back here, where
          you can pick a client and create a contract opportunity track from it.
        </p>

        <div className="mt-4 p-4 rounded" style={{ background: '#0d1117', border: '1px dashed #c9a84c' }}>
          <p className="text-xs text-text-muted mb-3">Drag this to your bookmarks bar:</p>
          {/* eslint-disable-next-line react/jsx-no-target-blank */}
          <a
            href={href}
            className="inline-block px-4 py-2 rounded text-sm font-medium"
            style={{ background: '#c9a84c', color: '#0d1117', textDecoration: 'none' }}
            onClick={(e) => {
              // Clicking it directly does nothing useful — just prevent the
              // browser from trying to navigate to a javascript: URL on this
              // page (which would replace the SPA with whatever the script
              // returns).
              e.preventDefault();
            }}
          >
            Capture for Signal Ridge
          </a>
        </div>

        <ol className="mt-4 text-sm text-text-muted list-decimal list-inside space-y-1">
          <li>Drag the gold link above to your browser's bookmarks bar.</li>
          <li>Open the foreign opportunity page in a tab where you're signed in.</li>
          <li>Click the bookmarklet. A new tab opens here with the captured page.</li>
          <li>Pick the client and confirm — Claude will extract the fields.</li>
        </ol>

        <p className="text-xs text-text-muted mt-3">
          Cap is ~200 KB of page text per capture. Works on most agency portals; sites with strict
          Content-Security-Policy (banks, some intelligence-community portals) may block it.
        </p>
      </div>
    </div>
  );
}

function ClientsAdmin({ qc }: { qc: ReturnType<typeof useQueryClient> }) {
  const { data } = useQuery<WorkflowClient[]>({ queryKey: ['clients'], queryFn: listClients });
  const [open, setOpen] = useState(false);
  const [backfilling, setBackfilling] = useState(false);

  async function runBackfill() {
    setBackfilling(true);
    try {
      const result = await backfillClientsFromCrm();
      if (result.created === 0) {
        toast(`All ${result.alreadyExisted} CRM clients already linked.`);
      } else {
        toast.success(`Created ${result.created} workflow client${result.created === 1 ? '' : 's'} from CRM.`);
      }
      qc.invalidateQueries({ queryKey: ['clients'] });
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Backfill failed');
    } finally {
      setBackfilling(false);
    }
  }

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <button className="btn-primary flex items-center gap-1" onClick={() => setOpen(true)}>
          <Plus size={14} /> Add client
        </button>
        <button
          className="btn-secondary flex items-center gap-1"
          onClick={runBackfill}
          disabled={backfilling}
          title="Create a WorkflowClient for every CRM Entity with type 'Client' that doesn't already have one"
        >
          <Download size={14} /> {backfilling ? 'Backfilling…' : 'Backfill from CRM'}
        </button>
      </div>
      <div className="space-y-2">
        {data?.map((c) => (
          <div key={c.id} className="card flex items-center justify-between">
            <div>
              <div className="font-medium">{c.name}</div>
              <div className="text-xs text-text-muted">
                {c._count?.tracks || 0} tracks · {c._count?.sows || 0} SOWs
              </div>
            </div>
            <code className="text-xs text-text-muted">{c.id.slice(0, 8)}</code>
          </div>
        ))}
        {data && data.length === 0 && (
          <div className="card text-center text-text-muted">No clients yet</div>
        )}
      </div>

      {open && (
        <AddClientModal
          onClose={() => setOpen(false)}
          onCreated={() => {
            setOpen(false);
            qc.invalidateQueries({ queryKey: ['clients'] });
          }}
        />
      )}
    </div>
  );
}

function AddClientModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const { data: crmClients = [], isLoading: crmLoading } = useQuery({
    queryKey: ['crm-client-entities'],
    queryFn: listCrmClientEntities,
  });
  const { data: existingWorkflowClients = [] } = useQuery<WorkflowClient[]>({
    queryKey: ['clients'],
    queryFn: listClients,
  });

  const [selectedCrmId, setSelectedCrmId] = useState<string>('');
  const [customName, setCustomName] = useState('');
  const [useCustom, setUseCustom] = useState(false);
  const [creating, setCreating] = useState(false);

  const linkedCrmIds = useMemo(
    () => new Set(existingWorkflowClients.map((c) => c.clientId).filter(Boolean) as string[]),
    [existingWorkflowClients]
  );

  const availableCrm = useMemo(
    () => crmClients.filter((c) => !linkedCrmIds.has(c.id)),
    [crmClients, linkedCrmIds]
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    let name: string;
    let crmId: string | undefined;

    if (useCustom) {
      if (!customName.trim()) {
        toast.error('Enter a client name');
        return;
      }
      name = customName.trim();
    } else {
      if (!selectedCrmId) {
        toast.error('Pick a CRM client — or switch to custom name');
        return;
      }
      const match = crmClients.find((c) => c.id === selectedCrmId);
      if (!match) {
        toast.error('Selected client not found');
        return;
      }
      name = match.name;
      crmId = match.id;
    }

    setCreating(true);
    try {
      await createClient(name, crmId);
      toast.success('Workflow client created');
      onCreated();
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Failed');
    } finally {
      setCreating(false);
    }
  }

  return (
    <Modal title="New workflow client" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {!useCustom ? (
          <>
            <div>
              <label className="label">Link to a CRM client</label>
              {crmLoading ? (
                <div className="text-sm text-text-muted">Loading CRM clients…</div>
              ) : availableCrm.length === 0 ? (
                <div className="text-sm text-text-muted">
                  No unlinked CRM clients.{' '}
                  {crmClients.length > 0
                    ? 'All CRM clients already have a workflow space.'
                    : (
                      <>
                        Create one in the CRM first (entity type = <span className="text-accent">Client</span>),
                        or switch to a custom name below.
                      </>
                    )}
                </div>
              ) : (
                <select
                  className="input"
                  value={selectedCrmId}
                  onChange={(e) => setSelectedCrmId(e.target.value)}
                >
                  <option value="">— select a CRM client —</option>
                  {availableCrm.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              )}
              <p className="text-xs text-text-muted mt-1">
                The workflow client's name will mirror the CRM entity.
              </p>
            </div>
            <button
              type="button"
              className="text-xs text-accent underline"
              onClick={() => setUseCustom(true)}
            >
              Or enter a custom name (not linked to the CRM)
            </button>
          </>
        ) : (
          <>
            <div>
              <label className="label">Client name</label>
              <input
                className="input"
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                placeholder="e.g. Acme Corp"
                autoFocus
              />
              <p className="text-xs text-text-muted mt-1">
                This workflow client will not be linked to a CRM entity.
              </p>
            </div>
            <button
              type="button"
              className="text-xs text-accent underline flex items-center gap-1"
              onClick={() => setUseCustom(false)}
            >
              <X size={12} /> Back to CRM picker
            </button>
          </>
        )}

        <div className="flex justify-end gap-3 pt-2">
          <button type="button" className="btn-secondary" onClick={onClose} disabled={creating}>
            Cancel
          </button>
          <button type="submit" className="btn-primary" disabled={creating}>
            {creating ? 'Creating…' : 'Create client'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

