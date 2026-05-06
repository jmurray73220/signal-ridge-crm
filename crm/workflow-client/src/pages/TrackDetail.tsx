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
  updatePhase,
  deletePhase,
  updateMilestone,
  deleteMilestone,
  updateActionItem,
  retryExtractTrack,
} from '../api';
import type {
  WorkflowTrack,
  WorkflowPhase,
  WorkflowMilestone,
  WorkflowActionItem,
  PhaseStatus,
  MilestoneStatus,
  ActionItemStatus,
} from '../types';
import { StatusBadge } from './Dashboard';
import { useAuth } from '../AuthContext';
import { Modal, PromptModal, ConfirmModal } from '../components/Modal';

async function fetchTrack(id: string): Promise<WorkflowTrack> {
  const { data } = await api.get(`/api/workflow/tracks/${id}`);
  return data;
}

type PromptTarget =
  | { kind: 'phase' }
  | { kind: 'step'; phaseId: string; phaseTitle: string; sortOrder: number }
  | { kind: 'action'; milestoneId: string; milestoneTitle: string; sortOrder: number };

export function TrackDetail() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const nav = useNavigate();
  const isAdmin = user?.workflowRole === 'WorkflowAdmin';
  const canEditSteps = isAdmin || user?.workflowRole === 'WorkflowEditor';
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
  const [phaseEdit, setPhaseEdit] = useState<WorkflowPhase | null>(null);
  const [phaseDelete, setPhaseDelete] = useState<WorkflowPhase | null>(null);
  const [phaseSaving, setPhaseSaving] = useState(false);
  const [phaseDeleting, setPhaseDeleting] = useState(false);
  const [stepEdit, setStepEdit] = useState<WorkflowMilestone | null>(null);
  const [stepDelete, setStepDelete] = useState<WorkflowMilestone | null>(null);
  const [stepSaving, setStepSaving] = useState(false);
  const [stepDeleting, setStepDeleting] = useState(false);

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
      } else if (prompt.kind === 'step') {
        await createMilestone({ phaseId: prompt.phaseId, title, sortOrder: prompt.sortOrder });
        toast.success('Step added');
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

  async function quickUpdateActionStatus(actionId: string, status: ActionItemStatus) {
    try {
      await updateActionItem(actionId, { status });
      qc.invalidateQueries({ queryKey: ['track', id] });
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Failed');
    }
  }

  async function saveStep(form: { title: string; description: string; dueDate: string; status: MilestoneStatus }) {
    if (!stepEdit) return;
    setStepSaving(true);
    try {
      await updateMilestone(stepEdit.id, {
        title: form.title.trim(),
        description: form.description.trim() || null,
        dueDate: form.dueDate ? new Date(form.dueDate).toISOString() : null,
        status: form.status,
      });
      toast.success('Step updated');
      qc.invalidateQueries({ queryKey: ['track', id] });
      setStepEdit(null);
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Failed');
    } finally {
      setStepSaving(false);
    }
  }

  async function handleDeleteStep() {
    if (!stepDelete) return;
    setStepDeleting(true);
    try {
      await deleteMilestone(stepDelete.id);
      toast.success('Step deleted');
      qc.invalidateQueries({ queryKey: ['track', id] });
      setStepDelete(null);
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Failed');
    } finally {
      setStepDeleting(false);
    }
  }

  async function savePhase(form: { title: string; description: string; budget: string; timeframe: string; status: PhaseStatus }) {
    if (!phaseEdit) return;
    setPhaseSaving(true);
    try {
      await updatePhase(phaseEdit.id, {
        title: form.title.trim(),
        description: form.description.trim() || null,
        budget: form.budget.trim() || null,
        timeframe: form.timeframe.trim() || null,
        status: form.status,
      });
      toast.success('Phase updated');
      qc.invalidateQueries({ queryKey: ['track', id] });
      setPhaseEdit(null);
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Failed');
    } finally {
      setPhaseSaving(false);
    }
  }

  async function handleDeletePhase() {
    if (!phaseDelete) return;
    setPhaseDeleting(true);
    try {
      await deletePhase(phaseDelete.id);
      toast.success('Phase deleted');
      qc.invalidateQueries({ queryKey: ['track', id] });
      setPhaseDelete(null);
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Failed');
    } finally {
      setPhaseDeleting(false);
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
      : prompt?.kind === 'step'
      ? `New step in "${prompt.phaseTitle}"`
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

      {track.isContractOpportunity && (
        <OpportunityCard track={track} isAdmin={isAdmin} />
      )}

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
        ) : isAdmin && track.isContractOpportunity ? (
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
            canEditSteps={canEditSteps}
            onEdit={() => setPhaseEdit(phase)}
            onDelete={() => setPhaseDelete(phase)}
            onAddStep={() =>
              setPrompt({
                kind: 'step',
                phaseId: phase.id,
                phaseTitle: phase.title,
                sortOrder: phase.milestones.length,
              })
            }
            onEditStep={setStepEdit}
            onDeleteStep={setStepDelete}
            onActionStatusChange={quickUpdateActionStatus}
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
              every step, every action item, and any comments beneath them.
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

      {phaseEdit && (
        <PhaseEditModal
          phase={phaseEdit}
          saving={phaseSaving}
          onClose={() => setPhaseEdit(null)}
          onSubmit={savePhase}
        />
      )}

      {stepEdit && (
        <StepEditModal
          step={stepEdit}
          saving={stepSaving}
          onClose={() => setStepEdit(null)}
          onSubmit={saveStep}
        />
      )}

      {stepDelete && (
        <ConfirmModal
          title="Delete step"
          danger
          confirmLabel="Delete step"
          loading={stepDeleting}
          message={
            <>
              Delete <span className="text-accent font-medium">{stepDelete.title}</span>?
              <br />
              <br />
              This also deletes <span className="text-status-amber">all {stepDelete.actionItems.length} action item(s)</span>{' '}
              beneath it. This cannot be undone.
            </>
          }
          onConfirm={handleDeleteStep}
          onCancel={() => setStepDelete(null)}
        />
      )}

      {phaseDelete && (
        <ConfirmModal
          title="Delete phase"
          danger
          confirmLabel="Delete phase"
          loading={phaseDeleting}
          message={
            <>
              Delete <span className="text-accent font-medium">{phaseDelete.title}</span>?
              <br />
              <br />
              This also deletes <span className="text-status-amber">all {phaseDelete.milestones.length} step(s)</span>{' '}
              and every action item beneath them. This cannot be undone.
            </>
          }
          onConfirm={handleDeletePhase}
          onCancel={() => setPhaseDelete(null)}
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

const ACTION_STATUSES: ActionItemStatus[] = ['Todo', 'InProgress', 'Done', 'Blocked'];
const STATUS_LABEL: Record<string, string> = {
  NotStarted: 'Not Started',
  InProgress: 'In Progress',
  Completed: 'Completed',
  Todo: 'Todo',
  Done: 'Done',
  Blocked: 'Blocked',
};

function StatusSelect<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: readonly T[];
  onChange: (v: T) => void;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as T)}
      onClick={(e) => e.stopPropagation()}
      className="badge cursor-pointer bg-surface border border-border text-xs"
      title="Change status"
    >
      {options.map((s) => (
        <option key={s} value={s}>
          {STATUS_LABEL[s] || s}
        </option>
      ))}
    </select>
  );
}

function PhaseBlock({
  phase,
  isAdmin,
  canEditSteps,
  onEdit,
  onDelete,
  onAddStep,
  onEditStep,
  onDeleteStep,
  onActionStatusChange,
  onAddAction,
}: {
  phase: WorkflowPhase;
  isAdmin: boolean;
  canEditSteps: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onAddStep: () => void;
  onEditStep: (m: WorkflowMilestone) => void;
  onDeleteStep: (m: WorkflowMilestone) => void;
  onActionStatusChange: (actionId: string, s: ActionItemStatus) => void;
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
          {/* Phase status is auto-derived from steps — read-only badge. */}
          <StatusBadge status={phase.status} />
          {canEditSteps && (
            <button
              onClick={onAddStep}
              className="btn-ghost flex items-center gap-1 text-xs"
              title="Add step"
            >
              <Plus size={12} /> Step
            </button>
          )}
          {isAdmin && (
            <>
              <button
                onClick={onDelete}
                className="btn-ghost p-1 rounded hover:text-status-red"
                title="Delete phase"
                aria-label="Delete phase"
              >
                <Trash2 size={12} />
              </button>
              <button
                onClick={onEdit}
                className="btn-ghost p-1 rounded"
                title="Edit phase"
                aria-label="Edit phase"
              >
                <Pencil size={12} />
              </button>
            </>
          )}
        </div>
      </div>

      {open && (
        <div className="mt-4 hierarchy-line space-y-3">
          {phase.milestones.map((m) => (
            <MilestoneBlock
              key={m.id}
              milestone={m}
              canEdit={canEditSteps}
              onEdit={() => onEditStep(m)}
              onDelete={() => onDeleteStep(m)}
              onAddAction={() => onAddAction(m)}
              onActionStatusChange={onActionStatusChange}
            />
          ))}
          {phase.milestones.length === 0 && (
            <div className="text-text-muted text-sm italic">No steps</div>
          )}
        </div>
      )}
    </div>
  );
}

function MilestoneBlock({
  milestone,
  canEdit,
  onEdit,
  onDelete,
  onAddAction,
  onActionStatusChange,
}: {
  milestone: WorkflowMilestone;
  canEdit: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onAddAction: () => void;
  onActionStatusChange: (actionId: string, s: ActionItemStatus) => void;
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
          {/* Step status is auto-derived from its action items — read-only. */}
          <StatusBadge status={milestone.status} />
          {canEdit && (
            <>
              <button onClick={onAddAction} className="btn-ghost flex items-center gap-1 text-xs" title="Add action">
                <Plus size={12} />
              </button>
              <button
                onClick={onDelete}
                className="btn-ghost p-1 rounded hover:text-status-red"
                title="Delete step"
                aria-label="Delete step"
              >
                <Trash2 size={12} />
              </button>
              <button
                onClick={onEdit}
                className="btn-ghost p-1 rounded"
                title="Edit step"
                aria-label="Edit step"
              >
                <Pencil size={12} />
              </button>
            </>
          )}
        </div>
      </div>
      {open && (
        <div className="mt-3 space-y-1.5 pl-6">
          {milestone.actionItems.map((ai) => (
            <ActionRow
              key={ai.id}
              item={ai}
              canEdit={canEdit}
              onStatusChange={(s) => onActionStatusChange(ai.id, s)}
            />
          ))}
          {milestone.actionItems.length === 0 && (
            <div className="text-text-muted text-xs italic">No action items</div>
          )}
        </div>
      )}
    </div>
  );
}

function PhaseEditModal({
  phase,
  saving,
  onClose,
  onSubmit,
}: {
  phase: WorkflowPhase;
  saving: boolean;
  onClose: () => void;
  onSubmit: (form: { title: string; description: string; budget: string; timeframe: string; status: PhaseStatus }) => void;
}) {
  const [form, setForm] = useState({
    title: phase.title,
    description: phase.description || '',
    budget: phase.budget || '',
    timeframe: phase.timeframe || '',
  });

  return (
    <Modal title="Edit phase" onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!form.title.trim()) {
            toast.error('Title required');
            return;
          }
          // Status is derived from steps — pass current value through unchanged.
          onSubmit({ ...form, status: phase.status });
        }}
        className="space-y-3"
      >
        <div>
          <label className="label">Title</label>
          <input
            className="input"
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            placeholder="e.g. Phase 1 — Discovery"
            autoFocus
            required
          />
        </div>
        <p className="text-xs text-text-muted">
          Status is auto-derived from this phase's steps and can't be set manually.
        </p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Budget</label>
            <input
              className="input"
              value={form.budget}
              onChange={(e) => setForm((f) => ({ ...f, budget: e.target.value }))}
              placeholder="e.g. $250k"
            />
          </div>
          <div>
            <label className="label">Timeframe</label>
            <input
              className="input"
              value={form.timeframe}
              onChange={(e) => setForm((f) => ({ ...f, timeframe: e.target.value }))}
              placeholder="e.g. Q3 2026"
            />
          </div>
        </div>
        <div>
          <label className="label">Description</label>
          <textarea
            className="textarea"
            rows={3}
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
          />
        </div>
        <div className="flex justify-end gap-3 pt-2">
          <button type="button" className="btn-secondary" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button type="submit" className="btn-primary" disabled={saving || !form.title.trim()}>
            {saving ? 'Saving…' : 'Save phase'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function StepEditModal({
  step,
  saving,
  onClose,
  onSubmit,
}: {
  step: WorkflowMilestone;
  saving: boolean;
  onClose: () => void;
  onSubmit: (form: { title: string; description: string; dueDate: string; status: MilestoneStatus }) => void;
}) {
  const [form, setForm] = useState({
    title: step.title,
    description: step.description || '',
    dueDate: step.dueDate ? step.dueDate.slice(0, 10) : '',
  });

  return (
    <Modal title="Edit step" onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!form.title.trim()) {
            toast.error('Title required');
            return;
          }
          // Status is derived from action items — pass current value through unchanged.
          onSubmit({ ...form, status: step.status });
        }}
        className="space-y-3"
      >
        <div>
          <label className="label">Title</label>
          <input
            className="input"
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            autoFocus
            required
          />
        </div>
        <p className="text-xs text-text-muted">
          Status is auto-derived from this step's action items and can't be set manually.
        </p>
        <div>
          <label className="label">Due date</label>
          <input
            type="date"
            className="input"
            value={form.dueDate}
            onChange={(e) => setForm((f) => ({ ...f, dueDate: e.target.value }))}
          />
        </div>
        <div>
          <label className="label">Description</label>
          <textarea
            className="textarea"
            rows={3}
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
          />
        </div>
        <div className="flex justify-end gap-3 pt-2">
          <button type="button" className="btn-secondary" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button type="submit" className="btn-primary" disabled={saving || !form.title.trim()}>
            {saving ? 'Saving…' : 'Save step'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function ActionRow({
  item,
  canEdit,
  onStatusChange,
}: {
  item: WorkflowActionItem;
  canEdit: boolean;
  onStatusChange: (s: ActionItemStatus) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-3 p-2 rounded hover:bg-surface-alt border border-transparent hover:border-border">
      <Link to={`/action-items/${item.id}`} className="flex-1 min-w-0">
        <div className="text-sm">{item.title}</div>
        {item.description && (
          <div className="text-xs text-text-muted mt-0.5 line-clamp-2">{item.description}</div>
        )}
        <div className="flex items-center gap-2 mt-0.5 text-xs text-text-muted">
          {item.assignedTo && <span>@{item.assignedTo}</span>}
          {item.dueDate && <span>Due {new Date(item.dueDate).toLocaleDateString()}</span>}
        </div>
      </Link>
      {canEdit ? (
        <StatusSelect value={item.status} options={ACTION_STATUSES} onChange={onStatusChange} />
      ) : (
        <StatusBadge status={item.status} />
      )}
    </div>
  );
}

function OpportunityCard({ track, isAdmin }: { track: WorkflowTrack; isAdmin: boolean }) {
  const qc = useQueryClient();
  const status = track.aiExtractionStatus;
  const isPending = status === 'pending';
  const [retrying, setRetrying] = useState(false);

  // Poll while extraction is running so fields fill in without a manual reload.
  useEffect(() => {
    if (!isPending) return;
    const t = setInterval(() => {
      qc.invalidateQueries({ queryKey: ['track', track.id] });
    }, 4000);
    return () => clearInterval(t);
  }, [isPending, qc, track.id]);

  async function retry() {
    setRetrying(true);
    try {
      await retryExtractTrack(track.id);
      toast.success('Claude is reading the URL again');
      qc.invalidateQueries({ queryKey: ['track', track.id] });
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Retry failed');
    } finally {
      setRetrying(false);
    }
  }

  return (
    <div className="card mb-4" style={{ borderColor: '#24375a' }}>
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex-1 min-w-0">
          <div className="text-xs text-accent uppercase tracking-wider">Contract Opportunity</div>
          {track.opportunityUrl && (
            <a
              href={track.opportunityUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-text-muted hover:text-accent break-all"
            >
              {track.opportunityUrl}
            </a>
          )}
        </div>
        {isAdmin && track.opportunityUrl && (
          <button
            type="button"
            className="btn-ghost text-xs"
            onClick={retry}
            disabled={retrying || isPending}
            title="Re-run Claude extraction"
          >
            {retrying || isPending ? 'Reading…' : 'Re-extract'}
          </button>
        )}
      </div>

      {isPending && (
        <div className="text-xs text-text-muted italic mb-3">
          Claude is reading the URL — fields will fill in shortly.
        </div>
      )}
      {status === 'blocked' && (
        <div className="text-xs text-status-amber mb-3">
          Couldn't read this URL automatically (likely behind a login). Ask Claude in the chat panel, or paste the fields manually below.
        </div>
      )}
      {status === 'failed' && (
        <div className="text-xs text-status-red mb-3">Extraction failed. Try Re-extract or fill in manually.</div>
      )}
      {status === 'partial' && (
        <div className="text-xs text-status-amber mb-3">
          Claude could only fill some fields from this URL. Edit any that are missing.
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 text-sm">
        {track.solicitationNumber && (
          <Field label="Solicitation #">{track.solicitationNumber}</Field>
        )}
        {track.vehicleType && <Field label="Vehicle">{track.vehicleType}</Field>}
        {track.proposalDueDate && (
          <Field label="Proposal Due">{new Date(track.proposalDueDate).toLocaleDateString()}</Field>
        )}
        {track.fundingCeiling && <Field label="Funding">{track.fundingCeiling}</Field>}
      </div>
      {track.objective && (
        <div className="mt-3">
          <div className="text-xs text-text-muted uppercase tracking-wider mb-1">Objective</div>
          <p className="text-sm text-text-primary whitespace-pre-wrap">{track.objective}</p>
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs text-text-muted uppercase tracking-wider">{label}</div>
      <div className="text-sm text-text-primary mt-0.5">{children}</div>
    </div>
  );
}
