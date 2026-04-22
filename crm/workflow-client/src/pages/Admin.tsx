import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Users, Briefcase, X } from 'lucide-react';
import toast from 'react-hot-toast';
import {
  listClients,
  listCrmClientEntities,
  createClient,
  listWorkflowUsers,
  setUserWorkflowRole,
} from '../api';
import type { WorkflowClient } from '../types';
import { Modal } from '../components/Modal';

export function Admin() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<'clients' | 'users'>('clients');

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-accent">Admin</h1>
          <p className="text-text-muted text-sm mt-1">
            Manage workflow clients and user access.
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
              tab === 'users' ? 'bg-surface text-accent' : 'text-text-muted'
            }`}
            onClick={() => setTab('users')}
          >
            <Users size={14} /> Users
          </button>
        </div>
      </div>

      {tab === 'clients' && <ClientsAdmin qc={qc} />}
      {tab === 'users' && <UsersAdmin qc={qc} />}
    </div>
  );
}

function ClientsAdmin({ qc }: { qc: ReturnType<typeof useQueryClient> }) {
  const { data } = useQuery<WorkflowClient[]>({ queryKey: ['clients'], queryFn: listClients });
  const [open, setOpen] = useState(false);

  return (
    <div>
      <button className="btn-primary flex items-center gap-1 mb-4" onClick={() => setOpen(true)}>
        <Plus size={14} /> Add client
      </button>
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

function UsersAdmin({ qc }: { qc: ReturnType<typeof useQueryClient> }) {
  const usersQuery = useQuery<any[]>({ queryKey: ['workflow-users'], queryFn: listWorkflowUsers });
  const clientsQuery = useQuery<WorkflowClient[]>({ queryKey: ['clients'], queryFn: listClients });

  async function updateRole(id: string, workflowRole: string | null) {
    try {
      await setUserWorkflowRole(id, { workflowRole });
      toast.success('Role updated');
      qc.invalidateQueries({ queryKey: ['workflow-users'] });
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Failed');
    }
  }

  async function updateClient(id: string, workflowClientId: string | null) {
    try {
      await setUserWorkflowRole(id, { workflowClientId });
      toast.success('Client updated');
      qc.invalidateQueries({ queryKey: ['workflow-users'] });
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Failed');
    }
  }

  return (
    <div className="card">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-text-muted text-xs uppercase tracking-wider border-b border-border">
            <th className="pb-2">Name</th>
            <th className="pb-2">Email</th>
            <th className="pb-2">Workflow Role</th>
            <th className="pb-2">Client</th>
          </tr>
        </thead>
        <tbody>
          {usersQuery.data?.map((u) => (
            <tr key={u.id} className="border-b border-border-soft">
              <td className="py-2">{u.firstName} {u.lastName}</td>
              <td className="py-2 text-text-muted">{u.email}</td>
              <td className="py-2">
                <select
                  className="input max-w-[180px]"
                  value={u.workflowRole || ''}
                  onChange={(e) => updateRole(u.id, e.target.value || null)}
                >
                  <option value="">— none —</option>
                  <option value="WorkflowAdmin">WorkflowAdmin</option>
                  <option value="WorkflowEditor">WorkflowEditor</option>
                  <option value="WorkflowViewer">WorkflowViewer</option>
                </select>
              </td>
              <td className="py-2">
                <select
                  className="input max-w-[200px]"
                  value={u.workflowClientId || ''}
                  onChange={(e) => updateClient(u.id, e.target.value || null)}
                >
                  <option value="">— none —</option>
                  {clientsQuery.data?.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </td>
            </tr>
          ))}
          {usersQuery.data && usersQuery.data.length === 0 && (
            <tr><td colSpan={4} className="py-6 text-center text-text-muted">
              No workflow users yet. Assign a role in the CRM user list to enable workflow access.
            </td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
