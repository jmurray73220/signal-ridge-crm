import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronDown, ChevronRight, Plus, ArrowLeft, Trash2, Pencil, FileText, ArrowRight } from 'lucide-react';
import toast from 'react-hot-toast';
import {
  api,
  createPhase,
  createMilestone,
  createActionItem,
  createSOW,
  deleteSOW,
  deleteTrack,
  updateTrack,
} from '../api';
import type { WorkflowTrack, WorkflowPhase, WorkflowMilestone, WorkflowActionItem } from '../types';
import { StatusBadge } from './Dashboard';
import { useAuth } from '../AuthContext';
import { Modal, PromptModal, ConfirmModal } from '../components/Modal';

async function fetchTrack(id: string): Promise<WorkflowTrack> {
  const { data } = await api.get(`/api/workflow/tracks/${id}`);
  return data;
}

type PromptTarget =
  | { kind: 'phase' }
  | { kind: 'milestone'; phaseId: string; phaseTitle: string; sortOrder: number }
  | { kind: 'action'; milestoneId: string; milestoneTitle: string; sortOrder: number };

export function TrackDetail() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const nav = useNavigate();
  const isAdmin = user?.workflowRole === 'WorkflowAdmin';
  const qc = useQueryClient();
  const { data: track, isLoading } = useQuery({
    queryKey: ['track', id],
    queryFn: () => fetchTrack(id!),
    enabled: !!id,
  });

  const [prompt, setPrompt] = useState<PromptTarget | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editSaving, setEditSaving] = useState(false);
  const [editForm, setEditForm] = useState({ title: '', description: '', fundingVehicle: '' });
  const [addSowOpen, setAddSowOpen] = useState(false);
  const [creatingSow, setCreatingSow] = useState(false);
  const [deleteSowOpen, setDeleteSowOpen] = useState(false);
  const [deletingSow, setDeletingSow] = useState(false);

  useEffect(() => {
    if (track) {
      setEditForm({
        title: track.title,
        description: track.description || '',
        fundingVehicle: track.fundingVehicle || '',
      });
    }
  }, [track?.id]);

  if (isLoading) return <div className="text-text-muted">Loading…</div>;
  if (!track) return <div className="text-text-muted">Not found</div>;

  async function submitPrompt(title: string) {
    if (!prompt) return;
    setSaving(true);
    try {
      if (prompt.kind === 'phase') {
        await createPhase({ trackId: track!.id, title, sortOrder: track!.phases.length });
        toast.success('Phase added');
      } else if (prompt.kind === 'milestone') {
        await createMilestone({ phaseId: prompt.phaseId, title, sortOrder: prompt.sortOrder });
        toast.success('Milestone added');
      } else if (prompt.kind === 'action') {
        await createActionItem({ milestoneId: prompt.milestoneId, title, sortOrder: prompt.sortOrder });
        toast.success('Action added');
      }
      qc.invalidateQueries({ queryKey: ['track', id] });
      setPrompt(null);
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Failed');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!track) return;
    setDeleting(true);
    try {
      await deleteTrack(track.id);
      toast.success('Track deleted');
      qc.invalidateQueries({ queryKey: ['tracks'] });
      nav('/');
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Failed');
      setDeleting(false);
    }
  }

  async function handleDeleteSow() {
    if (!track?.sow) return;
    setDeletingSow(true);
    try {
      await deleteSOW(track.sow.id);
      toast.success('SOW deleted');
      qc.invalidateQueries({ queryKey: ['track', id] });
      setDeleteSowOpen(false);
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Failed');
    } finally {
      setDeletingSow(false);
    }
  }

  async function handleCreateSow(title: string) {
    if (!track) return;
    setCreatingSow(true);
    try {
      const sow = await createSOW({
        workflowClientId: track.workflowClientId,
        trackId: track.id,
        title,
      });
      toast.success('SOW created');
      qc.invalidateQueries({ queryKey: ['track', id] });
      setAddSowOpen(false);
      nav(`/sows/${sow.id}`);
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Failed to create SOW');
    } finally {
      setCreatingSow(false);
    }
  }

  async function saveEdit() {
    if (!track) return;
    if (!editForm.title.trim()) {
      toast.error('Title required');
      return;
    }
    setEditSaving(true);
    try {
      await updateTrack(track.id, {
        title: editForm.title.trim(),
        description: editForm.description.trim() || null,
        fundingVehicle: editForm.fundingVehicle.trim() || null,
      });
      toast.success('Track updated');
      qc.invalidateQueries({ queryKey: ['track', id] });
      qc.invalidateQueries({ queryKey: ['tracks'] });
      setEditOpen(false);
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Failed');
    } finally {
      setEditSaving(false);
    }
  }

  const promptTitle =
    prompt?.kind === 'phase'
      ? 'New phase'
      : prompt?.kind === 'milestone'
      ? `New milestone in "${prompt.phaseTitle}"`
      : prompt?.kind === 'action'
      ? `New action item in "${prompt.milestoneTitle}"`
      : '';

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
          <div className="flex items-center gap-2">
            <button className="btn-secondary flex items-center gap-1" onClick={() => setEditOpen(true)}>
              <Pencil size={14} /> Edit
            </button>
            <button className="btn-primary flex items-center gap-1" onClick={() => setPrompt({ kind: 'phase' })}>
              <Plus size={14} /> Phase
            </button>
            <button
              className="btn-secondary flex items-center gap-1 hover:border-status-red hover:text-status-red"
              onClick={() => setDeleteOpen(true)}
              title="Delete track"
            >
              <Trash2 size={14} /> Delete
            </button>
          </div>
        )}
      </div>

      <div className="mb-6">
        {track.sow ? (
          <div className="card flex items-center justify-between gap-3 hover:border-accent transition-colors">
            <Link to={`/sows/${track.sow.id}`} className="flex items-start gap-3 flex-1 min-w-0 hover:text-accent">
              <FileText size={18} className="mt-0.5 text-accent shrink-0" />
              <div className="min-w-0">
                <div className="text-xs text-text-muted uppercase tracking-wider">Statement of Work</div>
                <div className="font-medium mt-0.5 truncate">{track.sow.title}</div>
                <div className="text-xs text-text-muted mt-0.5">
                  {track.sow.status} · updated {new Date(track.sow.updatedAt).toLocaleDateString()}
                </div>
              </div>
            </Link>
            <div className="flex items-center gap-2 shrink-0">
              {isAdmin && (
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setDeleteSowOpen(true);
                  }}
                  className="btn-ghost p-1 rounded hover:text-status-red"
                  title="Delete SOW"
                  aria-label="Delete SOW"
                >
                  <Trash2 size={14} />
                </button>
              )}
              <ArrowRight size={16} className="text-text-muted" />
            </div>
          </div>
        ) : isAdmin ? (
          <button
            onClick={() => setAddSowOpen(true)}
            className="card w-full flex items-center justify-center gap-2 text-text-muted hover:text-accent hover:border-accent transition-colors"
          >
            <Plus size={14} /> Add SOW to this track
          </button>
        ) : null}
      </div>

      <div className="space-y-4">
        {track.phases.map((phase) => (
          <PhaseBlock
            key={phase.id}
            phase={phase}
            isAdmin={isAdmin}
            onAddMilestone={() =>
              setPrompt({
                kind: 'milestone',
                phaseId: phase.id,
                phaseTitle: phase.title,
                sortOrder: phase.milestones.length,
              })
            }
            onAddAction={(m) =>
              setPrompt({
                kind: 'action',
                milestoneId: m.id,
                milestoneTitle: m.title,
                sortOrder: m.actionItems.length,
              })
            }
          />
        ))}
        {track.phases.length === 0 && (
          <div className="card text-text-muted text-center">No phases yet.</div>
        )}
      </div>

      {prompt && (
        <PromptModal
          title={promptTitle}
          label="Title"
          placeholder="Short descriptive title"
          submitLabel="Create"
          loading={saving}
          onClose={() => setPrompt(null)}
          onSubmit={submitPrompt}
        />
      )}

      {addSowOpen && (
        <PromptModal
          title={`New SOW for "${track.title}"`}
          label="SOW title"
          placeholder="e.g. Genesis Resubmission — Layer 1"
          submitLabel="Create SOW"
          loading={creatingSow}
          onClose={() => setAddSowOpen(false)}
          onSubmit={handleCreateSow}
        />
      )}

      {deleteSowOpen && track.sow && (
        <ConfirmModal
          title="Delete SOW"
          danger
          confirmLabel="Delete SOW"
          loading={deletingSow}
          message={
            <>
              Delete <span className="text-accent font-medium">{track.sow.title}</span>?
              <br />
              The SOW, its version history, and any comments will be removed. The track stays. This cannot be undone.
            </>
          }
          onConfirm={handleDeleteSow}
          onCancel={() => setDeleteSowOpen(false)}
        />
      )}

      {deleteOpen && (
        <ConfirmModal
          title="Delete track"
          danger
          confirmLabel="Delete track"
          loading={deleting}
          message={
            <>
              Delete <span className="text-accent font-medium">{track.title}</span>?
              <br />
              <br />
              This also deletes <span className="text-status-amber">all {track.phases.length} phase(s)</span>,
              every milestone, every action item, and any comments beneath them.
              {track.sow && (
                <> The attached SOW <span className="text-accent">{track.sow.title}</span> will also be deleted.</>
              )}
              {' '}This cannot be undone.
            </>
          }
          onConfirm={handleDelete}
          onCancel={() => setDeleteOpen(false)}
        />
      )}

      {editOpen && (
        <Modal title="Edit track" onClose={() => setEditOpen(false)}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              saveEdit();
            }}
            className="space-y-3"
          >
            <div>
              <label className="label">Title</label>
              <input
                className="input"
                value={editForm.title}
                onChange={(e) => setEditForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="e.g. Genesis"
                autoFocus
                required
              />
            </div>
            <div>
              <label className="label">Funding vehicle / category</label>
              <input
                className="input"
                value={editForm.fundingVehicle}
                onChange={(e) => setEditForm((f) => ({ ...f, fundingVehicle: e.target.value }))}
                placeholder="e.g. SBIR (Layer 1: AI/ML Research Core) — can be empty"
              />
            </div>
            <div>
              <label className="label">Description</label>
              <textarea
                className="textarea"
                rows={3}
                value={editForm.description}
                onChange={(e) => setEditForm((f) => ({ ...f, description: e.target.value }))}
              />
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button type="button" className="btn-secondary" onClick={() => setEditOpen(false)} disabled={editSaving}>
                Cancel
              </button>
              <button type="submit" className="btn-primary" disabled={editSaving || !editForm.title.trim()}>
                {editSaving ? 'Saving…' : 'Save track'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

function PhaseBlock({
  phase,
  isAdmin,
  onAddMilestone,
  onAddAction,
}: {
  phase: WorkflowPhase;
  isAdmin: boolean;
  onAddMilestone: () => void;
  onAddAction: (m: WorkflowMilestone) => void;
}) {
  const [open, setOpen] = useState(true);
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
              onClick={onAddMilestone}
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
              onAddAction={() => onAddAction(m)}
            />
          ))}
          {phase.milestones.length === 0 && (
            <div className="text-text-muted text-sm italic">No milestones</div>
          )}
        </div>
      )}
    </div>
  );
}

function MilestoneBlock({
  milestone,
  isAdmin,
  onAddAction,
}: {
  milestone: WorkflowMilestone;
  isAdmin: boolean;
  onAddAction: () => void;
}) {
  const [open, setOpen] = useState(true);
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
            <button onClick={onAddAction} className="btn-ghost flex items-center gap-1 text-xs" title="Add action">
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
      className="flex items-start justify-between gap-3 p-2 rounded hover:bg-surface-alt border border-transparent hover:border-border"
    >
      <div className="flex-1 min-w-0">
        <div className="text-sm">{item.title}</div>
        {item.description && (
          <div className="text-xs text-text-muted mt-0.5 line-clamp-2">{item.description}</div>
        )}
        <div className="flex items-center gap-2 mt-0.5 text-xs text-text-muted">
          {item.assignedTo && <span>@{item.assignedTo}</span>}
          {item.dueDate && <span>Due {new Date(item.dueDate).toLocaleDateString()}</span>}
        </div>
      </div>
      <StatusBadge status={item.status} />
    </Link>
  );
}
