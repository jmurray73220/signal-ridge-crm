import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Users, Briefcase } from 'lucide-react';
import toast from 'react-hot-toast';
import {
  listClients,
  createClient,
  listWorkflowUsers,
  setUserWorkflowRole,
} from '../api';
import type { WorkflowClient } from '../types';

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

  async function add() {
    const name = window.prompt('Client name?');
    if (!name) return;
    try {
      await createClient(name);
      toast.success('Client created');
      qc.invalidateQueries({ queryKey: ['clients'] });
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Failed');
    }
  }

  return (
    <div>
      <button className="btn-primary flex items-center gap-1 mb-4" onClick={add}>
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
    </div>
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
