import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { FileText, Plus } from 'lucide-react';
import toast from 'react-hot-toast';
import { listClients, listSOWs, createSOW } from '../api';
import type { WorkflowClient, WorkflowSOW } from '../types';
import { useAuth } from '../AuthContext';
import { StatusBadge } from './Dashboard';

export function SOWList() {
  const { user } = useAuth();
  const isAdmin = user?.workflowRole === 'WorkflowAdmin';
  const qc = useQueryClient();
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);

  const clientsQuery = useQuery<WorkflowClient[]>({
    queryKey: ['clients'],
    queryFn: listClients,
  });

  useEffect(() => {
    if (!selectedClientId && clientsQuery.data && clientsQuery.data.length > 0) {
      const defaultId =
        user?.workflowClientId && clientsQuery.data.find((c) => c.id === user.workflowClientId)
          ? user.workflowClientId
          : clientsQuery.data[0].id;
      setSelectedClientId(defaultId);
    }
  }, [clientsQuery.data, selectedClientId, user]);

  const sowsQuery = useQuery<WorkflowSOW[]>({
    queryKey: ['sows', selectedClientId],
    queryFn: () => listSOWs(selectedClientId!),
    enabled: !!selectedClientId,
  });

  async function addSow() {
    if (!selectedClientId) return;
    const title = window.prompt('SOW title?');
    if (!title) return;
    try {
      const sow = await createSOW({ workflowClientId: selectedClientId, title });
      toast.success('SOW created');
      qc.invalidateQueries({ queryKey: ['sows'] });
      window.location.href = `/workflow/sows/${sow.id}`;
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Failed');
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-accent">Statements of Work</h1>
          <p className="text-text-muted text-sm mt-1">
            Scope documents by funding track, versioned automatically on edit.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isAdmin && clientsQuery.data && clientsQuery.data.length > 1 && (
            <select
              className="input max-w-xs"
              value={selectedClientId || ''}
              onChange={(e) => setSelectedClientId(e.target.value)}
            >
              {clientsQuery.data.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          )}
          {isAdmin && (
            <button className="btn-primary flex items-center gap-1" onClick={addSow}>
              <Plus size={14} /> New SOW
            </button>
          )}
        </div>
      </div>

      {sowsQuery.isLoading && <div className="text-text-muted">Loading…</div>}
      <div className="space-y-2">
        {sowsQuery.data?.map((sow) => (
          <Link key={sow.id} to={`/sows/${sow.id}`} className="block card-hover">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <FileText size={18} className="mt-0.5 text-accent" />
                <div>
                  <div className="font-medium">{sow.title}</div>
                  <div className="text-xs text-text-muted mt-1 flex items-center gap-2">
                    <span>v{sow.version}</span>
                    {sow.track && <span>· Track: {sow.track.title}</span>}
                    <span>· Updated {new Date(sow.updatedAt).toLocaleDateString()}</span>
                  </div>
                </div>
              </div>
              <StatusBadge status={sow.status} />
            </div>
          </Link>
        ))}
        {sowsQuery.data && sowsQuery.data.length === 0 && (
          <div className="card text-text-muted text-center">No SOWs yet.</div>
        )}
      </div>
    </div>
  );
}
