import { useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { RotateCcw, Trash2, AlertTriangle } from 'lucide-react';
import toast from 'react-hot-toast';
import { recycleBinApi, type RecycleBinItem } from '../../api';

const TYPE_LABELS: Record<string, string> = {
  Contact: 'Contacts',
  Entity: 'Organizations',
  Initiative: 'Initiatives',
  Interaction: 'Interactions',
  Task: 'Tasks',
  Reminder: 'Reminders',
  WorkflowTrack: 'Workflow Tracks',
  WorkflowSOW: 'SOWs',
  WorkflowActionItem: 'Workflow Action Items',
};

function daysUntil(iso: string): number {
  const ms = new Date(iso).getTime() - Date.now();
  return Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24)));
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function RecycleBin() {
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['recycle-bin'],
    queryFn: () => recycleBinApi.list().then(r => r.data),
  });

  const restore = useMutation({
    mutationFn: ({ entityType, id }: { entityType: string; id: string }) =>
      recycleBinApi.restore(entityType, id),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['recycle-bin'] });
      qc.invalidateQueries();
      toast.success(`${TYPE_LABELS[vars.entityType] || vars.entityType} restored`);
    },
    onError: (err: any) => toast.error(err?.response?.data?.error || 'Failed to restore'),
  });

  const purge = useMutation({
    mutationFn: ({ entityType, id }: { entityType: string; id: string }) =>
      recycleBinApi.purge(entityType, id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['recycle-bin'] });
      toast.success('Permanently deleted');
    },
    onError: (err: any) => toast.error(err?.response?.data?.error || 'Failed to purge'),
  });

  const totalCount = useMemo(() => {
    if (!data?.items) return 0;
    return Object.values(data.items).reduce((acc, list) => acc + list.length, 0);
  }, [data]);

  return (
    <div>
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold" style={{ color: '#e6edf3' }}>Recycle Bin</h1>
          <p className="text-sm mt-1" style={{ color: '#8b949e' }}>
            {totalCount} deleted item{totalCount === 1 ? '' : 's'}. Items here are auto-purged {data?.retentionDays ?? 90} days after deletion.
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="card text-center text-sm" style={{ color: '#8b949e' }}>Loading…</div>
      ) : totalCount === 0 ? (
        <div className="card text-center text-sm" style={{ color: '#8b949e' }}>
          Nothing in the recycle bin.
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(data!.items).map(([type, list]) =>
            list.length === 0 ? null : (
              <TypeSection
                key={type}
                label={TYPE_LABELS[type] || type}
                items={list}
                onRestore={(id) => restore.mutate({ entityType: type, id })}
                onPurge={(id) => purge.mutate({ entityType: type, id })}
              />
            )
          )}
        </div>
      )}
    </div>
  );
}

function TypeSection({
  label,
  items,
  onRestore,
  onPurge,
}: {
  label: string;
  items: RecycleBinItem[];
  onRestore: (id: string) => void;
  onPurge: (id: string) => void;
}) {
  return (
    <section>
      <h2 className="text-xs uppercase tracking-wider mb-2" style={{ color: '#8b949e' }}>
        {label} <span style={{ color: '#c9a84c' }}>({items.length})</span>
      </h2>
      <div className="card p-0 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr style={{ borderBottom: '1px solid #30363d' }}>
              {['Title', 'Deleted', 'Auto-purge', 'Actions'].map(h => (
                <th key={h} className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider" style={{ color: '#8b949e' }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.map(it => {
              const days = daysUntil(it.purgeAt);
              const soon = days <= 7;
              return (
                <tr key={it.id} style={{ borderBottom: '1px solid #30363d' }}>
                  <td className="px-4 py-3" style={{ color: '#e6edf3' }}>{it.title}</td>
                  <td className="px-4 py-3" style={{ color: '#8b949e' }}>{formatDate(it.deletedAt)}</td>
                  <td className="px-4 py-3">
                    <span
                      className="inline-flex items-center gap-1"
                      style={{ color: soon ? '#f87171' : '#8b949e' }}
                    >
                      {soon && <AlertTriangle size={12} />}
                      in {days} day{days === 1 ? '' : 's'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => onRestore(it.id)}
                        className="flex items-center gap-1 text-xs"
                        style={{ color: '#238636' }}
                        title="Restore"
                      >
                        <RotateCcw size={14} /> Restore
                      </button>
                      <button
                        onClick={() => {
                          if (confirm(`Permanently delete "${it.title}"? This cannot be undone.`)) {
                            onPurge(it.id);
                          }
                        }}
                        className="flex items-center gap-1 text-xs"
                        style={{ color: '#da3633' }}
                        title="Delete permanently"
                      >
                        <Trash2 size={14} /> Purge
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
