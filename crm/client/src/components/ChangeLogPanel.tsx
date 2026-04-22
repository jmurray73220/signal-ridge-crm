import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { History, ChevronDown, ChevronRight, Plus, Pencil, Trash2, RotateCcw } from 'lucide-react';
import { changelogApi, type ChangeLogEntry } from '../api';
import { useAuth } from '../contexts/AuthContext';

interface Props {
  entityType: 'Contact' | 'Entity' | 'Initiative' | 'Interaction' | 'Task' | 'Reminder' | 'WorkflowTrack' | 'WorkflowSOW' | 'WorkflowActionItem';
  entityId: string;
}

/**
 * Admin-only history panel. Renders as a collapsible card — safe to drop into
 * any detail page. Returns null when the viewer isn't an Admin.
 */
export function ChangeLogPanel({ entityType, entityId }: Props) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);

  const { data = [], isLoading } = useQuery({
    queryKey: ['changelog', entityType, entityId],
    queryFn: () => changelogApi.list(entityType, entityId).then(r => r.data),
    enabled: open && user?.role === 'Admin',
  });

  if (user?.role !== 'Admin') return null;

  return (
    <div className="card">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 w-full text-left"
      >
        {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        <History size={16} style={{ color: '#c9a84c' }} />
        <span className="font-medium" style={{ color: '#e6edf3' }}>History</span>
        <span className="text-xs ml-auto" style={{ color: '#8b949e' }}>
          {open ? `${data.length} entr${data.length === 1 ? 'y' : 'ies'}` : 'Admin-only change log'}
        </span>
      </button>

      {open && (
        <div className="mt-4 space-y-3">
          {isLoading ? (
            <div className="text-sm italic" style={{ color: '#8b949e' }}>Loading…</div>
          ) : data.length === 0 ? (
            <div className="text-sm italic" style={{ color: '#8b949e' }}>No changes recorded yet.</div>
          ) : (
            data.map((entry) => <ChangeLogRow key={entry.id} entry={entry} />)
          )}
        </div>
      )}
    </div>
  );
}

function ChangeLogRow({ entry }: { entry: ChangeLogEntry }) {
  const when = new Date(entry.createdAt);
  const author = entry.user
    ? `${entry.user.firstName} ${entry.user.lastName}`
    : 'System';

  const icon = (() => {
    switch (entry.action) {
      case 'create':  return <Plus size={14} style={{ color: '#238636' }} />;
      case 'update':  return <Pencil size={14} style={{ color: '#c9a84c' }} />;
      case 'delete':  return <Trash2 size={14} style={{ color: '#da3633' }} />;
      case 'restore': return <RotateCcw size={14} style={{ color: '#238636' }} />;
      case 'purge':   return <Trash2 size={14} style={{ color: '#da3633' }} />;
      default:        return <Pencil size={14} style={{ color: '#8b949e' }} />;
    }
  })();

  return (
    <div
      className="rounded p-3"
      style={{ background: '#0d1117', border: '1px solid #30363d' }}
    >
      <div className="flex items-center justify-between gap-2 text-xs mb-2" style={{ color: '#8b949e' }}>
        <span className="flex items-center gap-2">
          {icon}
          <span style={{ color: '#e6edf3' }}>{author}</span>
          <span>· {entry.action}</span>
        </span>
        <span title={when.toISOString()}>{when.toLocaleString()}</span>
      </div>
      {entry.action === 'update' && entry.diff.fields && (
        <ul className="space-y-1 text-xs">
          {Object.entries(entry.diff.fields).map(([field, change]) => (
            <li key={field}>
              <span style={{ color: '#c9a84c' }}>{field}:</span>{' '}
              <span className="line-through" style={{ color: '#8b949e' }}>{formatValue(change.before)}</span>
              {' → '}
              <span style={{ color: '#e6edf3' }}>{formatValue(change.after)}</span>
            </li>
          ))}
        </ul>
      )}
      {entry.action === 'delete' && (
        <div className="text-xs italic" style={{ color: '#8b949e' }}>
          Moved to recycle bin. Restorable from Settings → Recycle Bin.
        </div>
      )}
      {entry.action === 'restore' && (
        <div className="text-xs italic" style={{ color: '#8b949e' }}>
          Restored from recycle bin.
        </div>
      )}
      {entry.action === 'purge' && (
        <div className="text-xs italic" style={{ color: '#8b949e' }}>
          Permanently deleted.
        </div>
      )}
    </div>
  );
}

function formatValue(v: unknown): string {
  if (v === null || v === undefined || v === '') return '—';
  if (typeof v === 'string') {
    // Try to unwrap JSON-stringified arrays (tags, committees, etc.)
    try {
      const parsed = JSON.parse(v);
      if (Array.isArray(parsed)) return parsed.length === 0 ? '(empty)' : parsed.join(', ');
    } catch { /* not JSON */ }
    return v.length > 80 ? v.slice(0, 77) + '…' : v;
  }
  if (typeof v === 'object') return JSON.stringify(v).slice(0, 80);
  return String(v);
}
