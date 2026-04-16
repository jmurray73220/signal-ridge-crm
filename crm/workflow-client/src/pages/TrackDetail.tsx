import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronDown, ChevronRight, Plus, ArrowLeft } from 'lucide-react';
import toast from 'react-hot-toast';
import { api, createPhase, createMilestone, createActionItem } from '../api';
import type { WorkflowTrack, WorkflowPhase, WorkflowMilestone, WorkflowActionItem } from '../types';
import { StatusBadge } from './Dashboard';
import { useAuth } from '../AuthContext';

async function fetchTrack(id: string): Promise<WorkflowTrack> {
  const { data } = await api.get(`/api/workflow/tracks/${id}`);
  return data;
}

export function TrackDetail() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const isAdmin = user?.workflowRole === 'WorkflowAdmin';
  const qc = useQueryClient();
  const { data: track, isLoading } = useQuery({
    queryKey: ['track', id],
    queryFn: () => fetchTrack(id!),
    enabled: !!id,
  });

  if (isLoading) return <div className="text-text-muted">Loading…</div>;
  if (!track) return <div className="text-text-muted">Not found</div>;

  async function addPhase() {
    const title = window.prompt('Phase title?');
    if (!title) return;
    try {
      await createPhase({ trackId: track!.id, title, sortOrder: track!.phases.length });
      toast.success('Phase added');
      qc.invalidateQueries({ queryKey: ['track', id] });
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Failed');
    }
  }

  return (
    <div>
      <Link to="/" className="btn-ghost inline-flex items-center gap-1 mb-4">
        <ArrowLeft size={14} /> Back to tracks
      </Link>

      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="text-xs text-accent uppercase tracking-wider">
            {track.fundingVehicle || 'Track'}
          </div>
          <h1 className="text-2xl font-semibold mt-1">{track.title}</h1>
          {track.description && (
            <p className="text-text-muted text-sm mt-2 max-w-3xl">{track.description}</p>
          )}
        </div>
        {isAdmin && (
          <button className="btn-primary flex items-center gap-1" onClick={addPhase}>
            <Plus size={14} /> Phase
          </button>
        )}
      </div>

      <div className="space-y-4">
        {track.phases.map((phase) => (
          <PhaseBlock key={phase.id} phase={phase} trackId={track.id} isAdmin={isAdmin} onChange={() => qc.invalidateQueries({ queryKey: ['track', id] })} />
        ))}
        {track.phases.length === 0 && (
          <div className="card text-text-muted text-center">No phases yet.</div>
        )}
      </div>
    </div>
  );
}

function PhaseBlock({
  phase,
  trackId,
  isAdmin,
  onChange,
}: {
  phase: WorkflowPhase;
  trackId: string;
  isAdmin: boolean;
  onChange: () => void;
}) {
  const [open, setOpen] = useState(true);

  async function addMilestone() {
    const title = window.prompt('Milestone title?');
    if (!title) return;
    try {
      await createMilestone({ phaseId: phase.id, title, sortOrder: phase.milestones.length });
      toast.success('Milestone added');
      onChange();
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Failed');
    }
  }

  return (
    <div className="card">
      <div className="flex items-start justify-between gap-3">
        <button onClick={() => setOpen(!open)} className="flex items-start gap-2 flex-1 text-left">
          {open ? <ChevronDown size={18} className="mt-0.5 text-text-muted" /> : <ChevronRight size={18} className="mt-0.5 text-text-muted" />}
          <div>
            <div className="font-semibold">{phase.title}</div>
            {phase.description && <p className="text-sm text-text-muted mt-1">{phase.description}</p>}
            <div className="flex items-center gap-3 mt-2 text-xs text-text-muted">
              {phase.budget && <span>Budget: <span className="text-accent">{phase.budget}</span></span>}
              {phase.timeframe && <span>Timeframe: <span className="text-text-primary">{phase.timeframe}</span></span>}
            </div>
          </div>
        </button>
        <div className="flex items-center gap-2">
          <StatusBadge status={phase.status} />
          {isAdmin && (
            <button
              onClick={addMilestone}
              className="btn-ghost flex items-center gap-1 text-xs"
              title="Add milestone"
            >
              <Plus size={12} /> Milestone
            </button>
          )}
        </div>
      </div>

      {open && (
        <div className="mt-4 hierarchy-line space-y-3">
          {phase.milestones.map((m) => (
            <MilestoneBlock
              key={m.id}
              milestone={m}
              isAdmin={isAdmin}
              onChange={onChange}
            />
          ))}
          {phase.milestones.length === 0 && (
            <div className="text-text-muted text-sm italic">No milestones</div>
          )}
          <div className="text-xs text-text-muted/60">Track: {trackId.slice(0, 8)}</div>
        </div>
      )}
    </div>
  );
}

function MilestoneBlock({
  milestone,
  isAdmin,
  onChange,
}: {
  milestone: WorkflowMilestone;
  isAdmin: boolean;
  onChange: () => void;
}) {
  const [open, setOpen] = useState(true);

  async function addAction() {
    const title = window.prompt('Action item title?');
    if (!title) return;
    try {
      await createActionItem({ milestoneId: milestone.id, title, sortOrder: milestone.actionItems.length });
      toast.success('Action added');
      onChange();
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Failed');
    }
  }

  return (
    <div className="bg-bg-deep border border-border-soft rounded p-3">
      <div className="flex items-start justify-between gap-3">
        <button onClick={() => setOpen(!open)} className="flex items-start gap-2 flex-1 text-left">
          {open ? <ChevronDown size={16} className="mt-0.5 text-text-muted" /> : <ChevronRight size={16} className="mt-0.5 text-text-muted" />}
          <div>
            <div className="font-medium">{milestone.title}</div>
            {milestone.description && <p className="text-xs text-text-muted mt-1">{milestone.description}</p>}
            {milestone.dueDate && (
              <div className="text-xs text-text-muted mt-1">
                Due {new Date(milestone.dueDate).toLocaleDateString()}
              </div>
            )}
          </div>
        </button>
        <div className="flex items-center gap-2">
          <StatusBadge status={milestone.status} />
          {isAdmin && (
            <button onClick={addAction} className="btn-ghost flex items-center gap-1 text-xs" title="Add action">
              <Plus size={12} />
            </button>
          )}
        </div>
      </div>
      {open && (
        <div className="mt-3 space-y-1.5 pl-6">
          {milestone.actionItems.map((ai) => (
            <ActionRow key={ai.id} item={ai} />
          ))}
          {milestone.actionItems.length === 0 && (
            <div className="text-text-muted text-xs italic">No action items</div>
          )}
        </div>
      )}
    </div>
  );
}

function ActionRow({ item }: { item: WorkflowActionItem }) {
  return (
    <Link
      to={`/action-items/${item.id}`}
      className="flex items-center justify-between gap-3 p-2 rounded hover:bg-surface-alt border border-transparent hover:border-border"
    >
      <div className="flex-1">
        <div className="text-sm">{item.title}</div>
        <div className="flex items-center gap-2 mt-0.5 text-xs text-text-muted">
          {item.assignedTo && <span>@{item.assignedTo}</span>}
          {item.dueDate && <span>Due {new Date(item.dueDate).toLocaleDateString()}</span>}
        </div>
      </div>
      <StatusBadge status={item.status} />
    </Link>
  );
}
