import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { LayoutGrid, List, Plus, ArrowUpRight } from 'lucide-react';
import toast from 'react-hot-toast';
import {
  listTracks,
  createTrack,
  listOrphanInitiatives,
  promoteInitiativeToTrack,
  type OrphanInitiative,
} from '../api';
import { useAuth } from '../AuthContext';
import { useClientContext } from '../ClientContext';
import type { WorkflowTrack, WorkflowActionItem } from '../types';
import { NewTrackModal } from '../components/NewTrackModal';

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

  const orphansQuery = useQuery<OrphanInitiative[]>({
    queryKey: ['orphan-initiatives', selectedClientId],
    queryFn: () => listOrphanInitiatives(selectedClientId!),
    enabled: !!selectedClientId,
  });

  async function promoteOrphan(initiativeId: string) {
    if (!selectedClientId) return;
    try {
      await promoteInitiativeToTrack(initiativeId, selectedClientId);
      toast.success('Promoted to track');
      qc.invalidateQueries({ queryKey: ['tracks', selectedClientId] });
      qc.invalidateQueries({ queryKey: ['orphan-initiatives', selectedClientId] });
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Failed to promote initiative');
    }
  }

  // Dynamic client branding — browser tab + page header both pull from DB
  useEffect(() => {
    if (activeClient) {
      document.title = `${activeClient.name} — Signal Ridge Strategies`;
    } else {
      document.title = 'Signal Ridge Workflow';
    }
  }, [activeClient]);

  async function submitTrack(data: {
    title: string;
    isContractOpportunity: boolean;
    opportunityUrl?: string;
    extractedFields?: Record<string, any>;
  }) {
    if (!selectedClientId) return;
    setCreating(true);
    try {
      await createTrack({
        workflowClientId: selectedClientId,
        title: data.title,
        isContractOpportunity: data.isContractOpportunity,
        opportunityUrl: data.opportunityUrl,
        extractedFields: data.extractedFields,
      });
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
      {tracksQuery.data && tracksQuery.data.length === 0 && (orphansQuery.data?.length ?? 0) === 0 && (
        <div className="card text-center text-text-muted">
          No tracks yet.{isAdmin && ' Click "Track" to add one.'}
        </div>
      )}
      {(tracksQuery.data?.length || orphansQuery.data?.length) ? (
        view === 'kanban'
          ? <Kanban tracks={tracksQuery.data || []} orphans={orphansQuery.data || []} canPromote={isAdmin} onPromote={promoteOrphan} />
          : <ListView tracks={tracksQuery.data || []} orphans={orphansQuery.data || []} canPromote={isAdmin} onPromote={promoteOrphan} />
      ) : null}

      {newTrackOpen && (
        <NewTrackModal
          loading={creating}
          onClose={() => setNewTrackOpen(false)}
          onSubmit={submitTrack}
        />
      )}
    </div>
  );
}

function Kanban({
  tracks,
  orphans,
  canPromote,
  onPromote,
}: {
  tracks: WorkflowTrack[];
  orphans: OrphanInitiative[];
  canPromote: boolean;
  onPromote: (id: string) => void;
}) {
  // Multi-row responsive grid — columns wrap onto new rows so the page
  // scrolls vertically instead of one wide horizontal scroll bar.
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 pb-4">
      {tracks.map((t) => (
        <TrackColumn key={t.id} track={t} />
      ))}
      {orphans.map((o) => (
        <OrphanColumn key={o.id} initiative={o} canPromote={canPromote} onPromote={onPromote} />
      ))}
    </div>
  );
}

// Same color palette as the CRM's Initiative PriorityBadge so they read as
// the same concept across both apps.
function PriorityBadge({ priority }: { priority: 'High' | 'Medium' | 'Low' }) {
  const styles = {
    High: { bg: '#2d0f0f', color: '#da3633' },
    Medium: { bg: '#2d1e00', color: '#d29922' },
    Low: { bg: '#0f2020', color: '#34d399' },
  } as const;
  const s = styles[priority];
  return (
    <span className="badge" style={{ background: s.bg, color: s.color }}>
      {priority.toUpperCase()}
    </span>
  );
}

function OrphanColumn({
  initiative,
  canPromote,
  onPromote,
}: {
  initiative: OrphanInitiative;
  canPromote: boolean;
  onPromote: (id: string) => void;
}) {
  return (
    <div className="bg-surface border border-dashed border-border rounded-lg flex flex-col">
      <div className="p-4 border-b border-border">
        <div className="flex items-start justify-between gap-2">
          <span className="font-semibold text-text-muted">{initiative.title}</span>
          <span className="badge badge-muted">From CRM</span>
        </div>
        {initiative.description && (
          <p className="text-xs text-text-muted mt-1 line-clamp-3">{initiative.description}</p>
        )}
        <div className="flex gap-2 mt-3 text-xs text-text-muted">
          <StatusBadge status={initiative.status} />
          {initiative.targetDate && (
            <span>Target {new Date(initiative.targetDate).toLocaleDateString()}</span>
          )}
        </div>
      </div>
      <div className="p-3 flex-1 flex flex-col items-stretch justify-between gap-3">
        <p className="text-xs text-text-muted">
          Created in CRM. Promote to start phasing it out as a workflow track.
        </p>
        {canPromote ? (
          <button
            className="btn-primary flex items-center justify-center gap-1 text-sm"
            onClick={() => onPromote(initiative.id)}
          >
            <ArrowUpRight size={14} /> Promote to Track
          </button>
        ) : (
          <span className="text-xs text-text-muted italic">Admin can promote this to a track.</span>
        )}
      </div>
    </div>
  );
}

function TrackColumn({ track }: { track: WorkflowTrack }) {
  const stats = useMemo(() => summarize(track), [track]);
  return (
    <div className="bg-surface border border-border rounded-lg flex flex-col">
      <div className="p-4 border-b border-border">
        {track.isContractOpportunity && (
          <div className="mb-1.5">
            <FundingOppTag />
          </div>
        )}
        <div className="flex items-start justify-between gap-2">
          <Link to={`/tracks/${track.id}`} className="font-semibold text-accent hover:underline">
            {track.title}
          </Link>
          <div className="flex flex-col items-end gap-1 shrink-0">
            <span className="badge badge-gold">{track.fundingVehicle || 'Track'}</span>
            {track.priority && <PriorityBadge priority={track.priority} />}
          </div>
        </div>
        {track.description && (
          <p className="text-xs text-text-muted mt-1 line-clamp-3">{track.description}</p>
        )}
        <div className="flex gap-2 mt-3 text-xs text-text-muted">
          <span>{stats.phases} phases</span>
          <span>·</span>
          <span>{stats.milestones} steps</span>
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

function ListView({
  tracks,
  orphans,
  canPromote,
  onPromote,
}: {
  tracks: WorkflowTrack[];
  orphans: OrphanInitiative[];
  canPromote: boolean;
  onPromote: (id: string) => void;
}) {
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
                {t.isContractOpportunity && (
                  <div className="mb-0.5">
                    <FundingOppTag />
                  </div>
                )}
                <div className="font-semibold text-accent">{t.title}</div>
                {t.description && <p className="text-sm text-text-muted mt-1">{t.description}</p>}
                <div className="text-xs text-text-muted mt-2">
                  {s.phases} phases · {s.milestones} steps · {s.done}/{s.items} done
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex flex-col items-end gap-1">
                  <span className="badge badge-gold">{t.fundingVehicle || 'Track'}</span>
                  {t.priority && <PriorityBadge priority={t.priority} />}
                </div>
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
      {orphans.map((o) => (
        <div key={o.id} className="card border-dashed">
          <div className="flex items-center justify-between gap-4">
            <div className="flex-1">
              <div className="font-semibold text-text-muted">{o.title}</div>
              {o.description && <p className="text-sm text-text-muted mt-1">{o.description}</p>}
              <div className="text-xs text-text-muted mt-2 flex items-center gap-2">
                <StatusBadge status={o.status} />
                {o.targetDate && <span>Target {new Date(o.targetDate).toLocaleDateString()}</span>}
                <span>· Created in CRM</span>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="badge badge-muted">From CRM</span>
              {canPromote && (
                <button
                  className="btn-primary flex items-center gap-1 text-sm"
                  onClick={() => onPromote(o.id)}
                >
                  <ArrowUpRight size={14} /> Promote
                </button>
              )}
            </div>
          </div>
        </div>
      ))}
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

// Eyebrow-style label that flags a track as a contract/funding opportunity.
// Sits above the title on each kanban / list card.
export function FundingOppTag() {
  return (
    <span
      className="text-[9px] uppercase font-semibold"
      style={{
        color: '#c9a84c',
        borderBottom: '1px solid #c9a84c',
        paddingBottom: 1,
        letterSpacing: '0.1em',
      }}
    >
      Funding Opportunity
    </span>
  );
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
