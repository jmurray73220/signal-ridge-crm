import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { CheckSquare, ChevronDown, ChevronRight } from 'lucide-react';
import { listMyTasks, type MyTaskAction, type MyTaskStep, type MyTaskPhase } from '../api';

// Compact panel that surfaces every action item, step, and phase the
// logged-in user is the assignee on, across every track they can see.
// Renders above the tracks grid on the dashboard.
export function MyTasksPanel() {
  // Start collapsed — this panel remounts on every dashboard visit, so an
  // open default re-expands each time. Users open it when they want it.
  const [open, setOpen] = useState(false);
  const { data, isLoading } = useQuery({
    queryKey: ['my-tasks'],
    queryFn: listMyTasks,
  });

  const total = (data?.actions.length || 0) + (data?.steps.length || 0) + (data?.phases.length || 0);

  if (isLoading || total === 0) return null;

  return (
    <div className="card mb-6" style={{ background: '#12213a', border: '1px solid #24375a' }}>
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center justify-between w-full text-left"
      >
        <div className="flex items-center gap-2">
          <CheckSquare size={16} className="text-accent" />
          <span className="text-sm font-semibold">Assigned to me</span>
          <span className="text-xs text-text-muted">{total} open</span>
        </div>
        {open ? <ChevronDown size={16} className="text-text-muted" /> : <ChevronRight size={16} className="text-text-muted" />}
      </button>

      {open && (
        <div className="mt-3 space-y-3">
          {data!.actions.length > 0 && (
            <div>
              <div className="text-xs uppercase tracking-wider mb-1.5" style={{ color: '#8b949e' }}>
                Action items ({data!.actions.length})
              </div>
              <div className="space-y-1">
                {data!.actions.map(a => <ActionRow key={a.id} a={a} />)}
              </div>
            </div>
          )}
          {data!.steps.length > 0 && (
            <div>
              <div className="text-xs uppercase tracking-wider mb-1.5" style={{ color: '#8b949e' }}>
                Steps ({data!.steps.length})
              </div>
              <div className="space-y-1">
                {data!.steps.map(s => <StepRow key={s.id} s={s} />)}
              </div>
            </div>
          )}
          {data!.phases.length > 0 && (
            <div>
              <div className="text-xs uppercase tracking-wider mb-1.5" style={{ color: '#8b949e' }}>
                Phases ({data!.phases.length})
              </div>
              <div className="space-y-1">
                {data!.phases.map(p => <PhaseRow key={p.id} p={p} />)}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function dueColor(due?: string | null): string | undefined {
  if (!due) return undefined;
  const days = (new Date(due).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
  if (days < 0) return '#da3633';     // overdue
  if (days <= 3) return '#d29922';    // due soon
  return undefined;
}

function ActionRow({ a }: { a: MyTaskAction }) {
  const t = a.milestone.phase.track;
  return (
    <Link
      to={`/action-items/${a.id}`}
      className="flex items-center gap-3 px-2.5 py-1.5 rounded text-xs hover:bg-surface transition-colors"
      style={{ background: '#0d1117', border: '1px solid #24375a', textDecoration: 'none' }}
    >
      <span className="flex-1 truncate" style={{ color: '#e6edf3' }}>{a.title}</span>
      <span className="truncate max-w-[200px]" style={{ color: '#8b949e' }}>
        {t.workflowClient.name} · {t.title} · {a.milestone.phase.title} · {a.milestone.title}
      </span>
      {a.dueDate && (
        <span style={{ color: dueColor(a.dueDate) || '#8b949e' }}>
          {new Date(a.dueDate).toLocaleDateString()}
        </span>
      )}
    </Link>
  );
}

function StepRow({ s }: { s: MyTaskStep }) {
  const t = s.phase.track;
  return (
    <Link
      to={`/tracks/${t.id}`}
      className="flex items-center gap-3 px-2.5 py-1.5 rounded text-xs hover:bg-surface transition-colors"
      style={{ background: '#0d1117', border: '1px solid #24375a', textDecoration: 'none' }}
    >
      <span className="flex-1 truncate" style={{ color: '#e6edf3' }}>{s.title}</span>
      <span className="truncate max-w-[200px]" style={{ color: '#8b949e' }}>
        {t.workflowClient.name} · {t.title} · {s.phase.title}
      </span>
      {s.dueDate && (
        <span style={{ color: dueColor(s.dueDate) || '#8b949e' }}>
          {new Date(s.dueDate).toLocaleDateString()}
        </span>
      )}
    </Link>
  );
}

function PhaseRow({ p }: { p: MyTaskPhase }) {
  const t = p.track;
  return (
    <Link
      to={`/tracks/${t.id}`}
      className="flex items-center gap-3 px-2.5 py-1.5 rounded text-xs hover:bg-surface transition-colors"
      style={{ background: '#0d1117', border: '1px solid #24375a', textDecoration: 'none' }}
    >
      <span className="flex-1 truncate" style={{ color: '#e6edf3' }}>{p.title}</span>
      <span className="truncate max-w-[200px]" style={{ color: '#8b949e' }}>
        {t.workflowClient.name} · {t.title}
      </span>
    </Link>
  );
}
