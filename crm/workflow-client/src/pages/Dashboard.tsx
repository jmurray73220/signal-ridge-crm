import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { LayoutGrid, List, Plus } from 'lucide-react';
import toast from 'react-hot-toast';
import { listTracks, createTrack } from '../api';
import { useAuth } from '../AuthContext';
import { useClientContext } from '../ClientContext';
import type { WorkflowTrack, WorkflowActionItem } from '../types';
import { PromptModal } from '../components/Modal';

type View = 'kanban' | 'list';

export function Dashboard() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const isAdmin = user?.workflowRole === 'WorkflowAdmin';
  const [view, setView] = useState<View>('kanban');
  const [newTrackOpen, setNewTrackOpen] = useState(false);
  const [creating, setCreating] = useState(false);

  const { selectedClient: activeClient, selectedClientId } = useClientContext();

  const tracksQuery = useQuery<WorkflowTrack[]>({
    queryKey: ['tracks', selectedClientId],
    queryFn: () => listTracks(selectedClientId!),
    enabled: !!selectedClientId,
  });

  // Dynamic client branding — browser tab + page header both pull from DB
  useEffect(() => {
    if (activeClient) {
      document.title = `${activeClient.name} — Signal Ridge Strategies`;
    } else {
      document.title = 'Signal Ridge Workflow';
    }
  }, [activeClient]);

  async function submitTrack(title: string) {
    if (!selectedClientId) return;
    setCreating(true);
    try {
      await createTrack({ workflowClientId: selectedClientId, title });
      toast.success('Track created');
      qc.invalidateQueries({ queryKey: ['tracks', selectedClientId] });
      setNewTrackOpen(false);
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Failed to create track');
    } finally {
      setCreating(false);
    }
  }

  return (
    <div>
      {activeClient && (
        <div className="mb-6 pb-5 border-b border-border">
          <h1 className="text-3xl font-semibold text-accent tracking-tight">
            {activeClient.name} Strategic Roadmap
          </h1>
          <p className="text-text-muted text-sm mt-1">Managed by Signal Ridge Strategies</p>
        </div>
      )}

      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold">Tracks</h2>
          <p className="text-text-muted text-sm mt-1">
            Funding vehicles, relationship building, and timeline coordination.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="inline-flex border border-border rounded overflow-hidden">
            <button
              className={`px-3 py-1.5 text-sm flex items-center gap-1 ${
                view === 'kanban' ? 'bg-surface text-accent' : 'text-text-muted'
              }`}
              onClick={() => setView('kanban')}
            >
              <LayoutGrid size={14} /> Kanban
            </button>
            <button
              className={`px-3 py-1.5 text-sm flex items-center gap-1 ${
                view === 'list' ? 'bg-surface text-accent' : 'text-text-muted'
              }`}
              onClick={() => setView('list')}
            >
              <List size={14} /> List
            </button>
          </div>
          {isAdmin && (
            <button className="btn-primary flex items-center gap-1" onClick={() => setNewTrackOpen(true)}>
              <Plus size={14} /> Track
            </button>
          )}
        </div>
      </div>

      {tracksQuery.isLoading && <div className="text-text-muted">Loading…</div>}
      {tracksQuery.data && tracksQuery.data.length === 0 && (
        <div className="card text-center text-text-muted">
          No tracks yet.{isAdmin && ' Click "Track" to add one.'}
        </div>
      )}
      {tracksQuery.data && tracksQuery.data.length > 0 && (
        view === 'kanban' ? <Kanban tracks={tracksQuery.data} /> : <ListView tracks={tracksQuery.data} />
      )}

      {newTrackOpen && (
        <PromptModal
          title="New track"
          label="Track title"
          placeholder="e.g. Genesis Resubmission"
          submitLabel="Create track"
          loading={creating}
          onClose={() => setNewTrackOpen(false)}
          onSubmit={submitTrack}
        />
      )}
    </div>
  );
}

function Kanban({ tracks }: { tracks: WorkflowTrack[] }) {
  return (
    <div className="grid grid-flow-col auto-cols-[minmax(300px,340px)] gap-4 overflow-x-auto pb-4">
      {tracks.map((t) => (
        <TrackColumn key={t.id} track={t} />
      ))}
    </div>
  );
}

function TrackColumn({ track }: { track: WorkflowTrack }) {
  const stats = useMemo(() => summarize(track), [track]);
  return (
    <div className="bg-surface border border-border rounded-lg flex flex-col">
      <div className="p-4 border-b border-border">
        <div className="flex items-start justify-between gap-2">
          <Link to={`/tracks/${track.id}`} className="font-semibold text-accent hover:underline">
            {track.title}
          </Link>
          <span className="badge badge-gold">{track.fundingVehicle || 'Track'}</span>
        </div>
        {track.description && (
          <p className="text-xs text-text-muted mt-1 line-clamp-3">{track.description}</p>
        )}
        <div className="flex gap-2 mt-3 text-xs text-text-muted">
          <span>{stats.phases} phases</span>
          <span>·</span>
          <span>{stats.milestones} milestones</span>
          <span>·</span>
          <span>{stats.items} actions</span>
        </div>
        <div className="mt-3 h-1.5 bg-bg-deep rounded overflow-hidden">
          <div
            className="h-full bg-accent"
            style={{ width: `${stats.pct}%` }}
          />
        </div>
        <div className="text-xs text-text-muted mt-1">{stats.done}/{stats.items} done</div>
      </div>
      <div className="p-3 space-y-2 overflow-y-auto max-h-[500px]">
        {track.phases.flatMap((ph) =>
          ph.milestones.flatMap((m) =>
            m.actionItems.slice(0, 8).map((ai) => (
              <ActionItemCard key={ai.id} item={ai} />
            ))
          )
        ).slice(0, 10)}
        {stats.items === 0 && <div className="text-text-muted text-xs">No action items</div>}
      </div>
    </div>
  );
}

function ActionItemCard({ item }: { item: WorkflowActionItem }) {
  return (
    <Link to={`/action-items/${item.id}`} className="block">
      <div className="bg-bg-deep border border-border-soft rounded p-2 hover:border-accent transition-colors">
        <div className="flex items-start justify-between gap-2">
          <span className="text-sm">{item.title}</span>
          <StatusBadge status={item.status} />
        </div>
        {item.dueDate && (
          <div className="text-xs text-text-muted mt-1">
            Due {new Date(item.dueDate).toLocaleDateString()}
          </div>
        )}
      </div>
    </Link>
  );
}

function ListView({ tracks }: { tracks: WorkflowTrack[] }) {
  return (
    <div className="space-y-3">
      {tracks.map((t) => {
        const s = summarize(t);
        return (
          <Link
            key={t.id}
            to={`/tracks/${t.id}`}
            className="block card-hover"
          >
            <div className="flex items-center justify-between gap-4">
              <div className="flex-1">
                <div className="font-semibold text-accent">{t.title}</div>
                {t.description && <p className="text-sm text-text-muted mt-1">{t.description}</p>}
                <div className="text-xs text-text-muted mt-2">
                  {s.phases} phases · {s.milestones} milestones · {s.done}/{s.items} done
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="badge badge-gold">{t.fundingVehicle || 'Track'}</span>
                <div className="w-32">
                  <div className="h-1.5 bg-bg-deep rounded overflow-hidden">
                    <div className="h-full bg-accent" style={{ width: `${s.pct}%` }} />
                  </div>
                </div>
              </div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    Done: 'badge-green',
    Completed: 'badge-green',
    InProgress: 'badge-blue',
    Todo: 'badge-muted',
    NotStarted: 'badge-muted',
    Blocked: 'badge-red',
    Active: 'badge-gold',
    OnHold: 'badge-amber',
    Archived: 'badge-muted',
    Draft: 'badge-amber',
  };
  return <span className={`badge ${map[status] || 'badge-muted'}`}>{status}</span>;
}

function summarize(t: WorkflowTrack) {
  const phases = t.phases.length;
  const milestones = t.phases.reduce((s, p) => s + p.milestones.length, 0);
  const items = t.phases.reduce(
    (s, p) => s + p.milestones.reduce((ss, m) => ss + m.actionItems.length, 0),
    0
  );
  const done = t.phases.reduce(
    (s, p) =>
      s + p.milestones.reduce((ss, m) => ss + m.actionItems.filter((a) => a.status === 'Done').length, 0),
    0
  );
  const pct = items === 0 ? 0 : Math.round((done / items) * 100);
  return { phases, milestones, items, done, pct };
}
