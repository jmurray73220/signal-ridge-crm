import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronDown, ChevronRight, Plus, ArrowLeft, Trash2, Pencil, FileText, ArrowRight, RotateCcw, Eye, EyeOff, CheckCircle2, Archive, RefreshCw, Bell } from 'lucide-react';
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
  deleteActionItem,
  retryExtractTrack,
  extractTrackFromText,
  listAssignees,
  getTrackCrmFollowups,
  type Assignee,
  type CrmFollowupTask,
  type CrmFollowupReminder,
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
import { creatorName } from '../types';
import { StatusBadge } from './Dashboard';
import { useAuth } from '../AuthContext';
import { Modal, PromptModal, ConfirmModal } from '../components/Modal';
import { PhaseAssetsPanel } from '../components/PhaseAssetsPanel';

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
  // Editors get the same content-editing affordances as Admins within their
  // assigned client; backend enforces client scope.
  const isAdmin = user?.workflowRole === 'WorkflowAdmin' || user?.workflowRole === 'WorkflowEditor';
  const canEditSteps = isAdmin;
  // CRM references (follow-ups panel, etc.) are internal Signal Ridge context —
  // WorkflowAdmin only. Client logins can be Editor/Viewer, so isAdmin is not
  // enough here.
  const isWorkflowAdmin = user?.workflowRole === 'WorkflowAdmin';
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
  const [editForm, setEditForm] = useState({ title: '', description: '', fundingVehicle: '', priority: 'Medium' as 'High' | 'Medium' | 'Low' });
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
  const [actionDelete, setActionDelete] = useState<WorkflowActionItem | null>(null);
  const [actionDeleting, setActionDeleting] = useState(false);
  // Hide-done preference is per-user-per-browser, not server state — survives
  // page reloads but doesn't sync across devices. Default: hide done actions
  // so day-to-day work isn't drowned out by completed history.
  const [hideDone, setHideDone] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    const stored = window.localStorage.getItem('workflow.hideDone');
    return stored === null ? true : stored === '1';
  });
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('workflow.hideDone', hideDone ? '1' : '0');
    }
  }, [hideDone]);
  const [statusBusy, setStatusBusy] = useState(false);

  useEffect(() => {
    if (track) {
      setEditForm({
        title: track.title,
        description: track.description || '',
        fundingVehicle: track.fundingVehicle || '',
        priority: (track.priority as 'High' | 'Medium' | 'Low') || 'Medium',
      });
    }
  }, [track?.id]);

  if (isLoading) return <div className="text-text-muted">Loading…</div>;
  if (!track) return <div className="text-text-muted">Not found</div>;

  async function submitPrompt(fields: { title: string; assignedTo: string | null; dueDate: string | null }) {
    if (!prompt) return;
    setSaving(true);
    try {
      const { title, assignedTo, dueDate } = fields;
      if (prompt.kind === 'phase') {
        await createPhase({
          trackId: track!.id,
          title,
          sortOrder: track!.phases.length,
          ...(assignedTo && { assignedTo }),
        });
        toast.success('Phase added');
      } else if (prompt.kind === 'step') {
        await createMilestone({
          phaseId: prompt.phaseId,
          title,
          sortOrder: prompt.sortOrder,
          ...(assignedTo && { assignedTo }),
          ...(dueDate && { dueDate }),
        });
        toast.success('Step added');
      } else if (prompt.kind === 'action') {
        await createActionItem({
          milestoneId: prompt.milestoneId,
          title,
          sortOrder: prompt.sortOrder,
          ...(assignedTo && { assignedTo }),
          ...(dueDate && { dueDate }),
        });
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

  async function setPhaseStatus(phaseId: string, status: string) {
    try {
      await updatePhase(phaseId, { status });
      qc.invalidateQueries({ queryKey: ['track', id] });
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Failed');
    }
  }

  async function clearPhaseStatusOverride(phaseId: string) {
    try {
      await updatePhase(phaseId, { statusManuallySet: false });
      qc.invalidateQueries({ queryKey: ['track', id] });
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Failed');
    }
  }

  async function setStepStatus(milestoneId: string, status: string) {
    try {
      await updateMilestone(milestoneId, { status });
      qc.invalidateQueries({ queryKey: ['track', id] });
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Failed');
    }
  }

  async function clearStepStatusOverride(milestoneId: string) {
    try {
      await updateMilestone(milestoneId, { statusManuallySet: false });
      qc.invalidateQueries({ queryKey: ['track', id] });
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Failed');
    }
  }

  async function saveStep(form: { title: string; description: string; dueDate: string; status: MilestoneStatus; assignedTo: string | null }) {
    if (!stepEdit) return;
    setStepSaving(true);
    try {
      await updateMilestone(stepEdit.id, {
        title: form.title.trim(),
        description: form.description.trim() || null,
        dueDate: form.dueDate ? new Date(form.dueDate).toISOString() : null,
        status: form.status,
        assignedTo: form.assignedTo,
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

  async function handleDeleteAction() {
    if (!actionDelete) return;
    setActionDeleting(true);
    try {
      await deleteActionItem(actionDelete.id);
      toast.success('Action moved to recycle bin');
      qc.invalidateQueries({ queryKey: ['track', id] });
      setActionDelete(null);
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Failed');
    } finally {
      setActionDeleting(false);
    }
  }

  async function savePhase(form: { title: string; description: string; budget: string; timeframe: string; status: PhaseStatus; assignedTo: string | null }) {
    if (!phaseEdit) return;
    setPhaseSaving(true);
    try {
      await updatePhase(phaseEdit.id, {
        title: form.title.trim(),
        description: form.description.trim() || null,
        budget: form.budget.trim() || null,
        timeframe: form.timeframe.trim() || null,
        status: form.status,
        assignedTo: form.assignedTo,
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

  async function setTrackStatus(status: 'Active' | 'OnHold' | 'Completed' | 'Archived') {
    if (!track) return;
    setStatusBusy(true);
    try {
      await updateTrack(track.id, { status });
      const label =
        status === 'Completed' ? 'Marked complete'
        : status === 'Archived' ? 'Archived'
        : status === 'OnHold' ? 'On hold'
        : 'Reactivated';
      toast.success(label);
      qc.invalidateQueries({ queryKey: ['track', id] });
      qc.invalidateQueries({ queryKey: ['tracks'] });
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Failed');
    } finally {
      setStatusBusy(false);
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
        priority: editForm.priority,
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
          {track.isContractOpportunity ? (
            <div
              className="text-xs uppercase tracking-wider font-semibold inline-block"
              style={{
                color: '#c9a84c',
                borderBottom: '2px solid #c9a84c',
                paddingBottom: 2,
                letterSpacing: '0.08em',
              }}
            >
              Funding Opportunity
            </div>
          ) : (
            <div className="text-xs text-accent uppercase tracking-wider">
              {track.fundingVehicle || 'Track'}
            </div>
          )}
          <h1 className="text-2xl font-semibold mt-1">{track.title}</h1>
          <div className="text-xs text-text-muted mt-1">Created by {creatorName(track.createdBy)}</div>
          {track.description && (
            <p className="text-text-muted text-sm mt-2 max-w-3xl">{track.description}</p>
          )}
        </div>
        <div className="flex flex-col items-end gap-2">
          <div className="flex items-center gap-2">
            <StatusBadge status={track.status} />
            <button
              onClick={() => setHideDone(v => !v)}
              className="btn-ghost inline-flex items-center gap-1 text-xs"
              title={hideDone ? 'Show completed action items' : 'Hide completed action items'}
            >
              {hideDone ? <EyeOff size={12} /> : <Eye size={12} />}
              {hideDone ? 'Done hidden' : 'Done shown'}
            </button>
          </div>
          {isAdmin && (
            <div className="flex items-center gap-2 flex-wrap justify-end">
              {track.status === 'Active' && (
                <button
                  className="btn-secondary flex items-center gap-1 text-xs"
                  disabled={statusBusy}
                  onClick={() => setTrackStatus('Completed')}
                  title="Mark this track as completed"
                >
                  <CheckCircle2 size={12} /> Mark complete
                </button>
              )}
              {track.status === 'Completed' && (
                <>
                  <button
                    className="btn-secondary flex items-center gap-1 text-xs"
                    disabled={statusBusy}
                    onClick={() => setTrackStatus('Archived')}
                    title="Archive this completed track"
                  >
                    <Archive size={12} /> Archive
                  </button>
                  <button
                    className="btn-ghost flex items-center gap-1 text-xs"
                    disabled={statusBusy}
                    onClick={() => setTrackStatus('Active')}
                    title="Reopen this track"
                  >
                    <RefreshCw size={12} /> Reopen
                  </button>
                </>
              )}
              {track.status === 'Archived' && (
                <button
                  className="btn-secondary flex items-center gap-1 text-xs"
                  disabled={statusBusy}
                  onClick={() => setTrackStatus('Active')}
                  title="Restore from archive"
                >
                  <RefreshCw size={12} /> Restore
                </button>
              )}
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

      {isWorkflowAdmin && <CrmFollowupsPanel trackId={track.id} />}

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
            onDeleteAction={setActionDelete}
            onAddAction={(m) =>
              setPrompt({
                kind: 'action',
                milestoneId: m.id,
                milestoneTitle: m.title,
                sortOrder: m.actionItems.length,
              })
            }
            onPhaseStatusChange={setPhaseStatus}
            onPhaseStatusClear={clearPhaseStatusOverride}
            onStepStatusChange={setStepStatus}
            onStepStatusClear={clearStepStatusOverride}
            trackId={track.id}
            canUploadFiles={canEditSteps}
            hideDone={hideDone}
          />
        ))}
        {track.phases.length === 0 && (
          <div className="card text-text-muted text-center">No phases yet.</div>
        )}
      </div>

      {prompt && (
        <ItemCreateModal
          title={promptTitle}
          showDueDate={prompt.kind !== 'phase'}
          workflowClientId={track.workflowClientId}
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
          workflowClientId={track.workflowClientId}
          onClose={() => setPhaseEdit(null)}
          onSubmit={savePhase}
        />
      )}

      {stepEdit && (
        <StepEditModal
          step={stepEdit}
          saving={stepSaving}
          workflowClientId={track.workflowClientId}
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

      {actionDelete && (
        <ConfirmModal
          title="Delete action"
          danger
          confirmLabel="Delete action"
          loading={actionDeleting}
          message={
            <>
              Delete <span className="text-accent font-medium">{actionDelete.title}</span>?
              <br />
              <br />
              It will be moved to the recycle bin and can be restored by an admin.
            </>
          }
          onConfirm={handleDeleteAction}
          onCancel={() => setActionDelete(null)}
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
              <label className="label">Priority</label>
              <select
                className="input"
                value={editForm.priority}
                onChange={(e) => setEditForm((f) => ({ ...f, priority: e.target.value as 'High' | 'Medium' | 'Low' }))}
              >
                <option value="High">High</option>
                <option value="Medium">Medium</option>
                <option value="Low">Low</option>
              </select>
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
const PHASE_STATUSES = ['NotStarted', 'InProgress', 'Completed', 'Blocked'] as const;
const STEP_STATUSES = ['NotStarted', 'InProgress', 'Completed', 'Blocked'] as const;
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

// Phase / step status control: looks like a normal status dropdown, plus a
// small revert icon that only shows when the user has overridden the
// auto-derived value. Clicking it clears the override and the next read goes
// back to derive-from-children.
function EditableStatusControl({
  status,
  manuallySet,
  options,
  onChange,
  onClearOverride,
  autoTooltip,
}: {
  status: string;
  manuallySet: boolean;
  options: readonly string[];
  onChange: (s: string) => void;
  onClearOverride: () => void;
  autoTooltip: string;
}) {
  return (
    <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
      <select
        value={status}
        onChange={(e) => onChange(e.target.value)}
        className="badge cursor-pointer bg-surface border border-border text-xs"
        title={manuallySet ? 'Manually set — click ↺ to revert' : autoTooltip}
      >
        {options.map((s) => (
          <option key={s} value={s}>
            {STATUS_LABEL[s] || s}
          </option>
        ))}
      </select>
      {manuallySet && (
        <button
          type="button"
          onClick={onClearOverride}
          title="Revert to auto-derived status"
          className="text-text-muted hover:text-accent"
        >
          <RotateCcw size={11} />
        </button>
      )}
    </div>
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
  onDeleteAction,
  onAddAction,
  onPhaseStatusChange,
  onPhaseStatusClear,
  onStepStatusChange,
  onStepStatusClear,
  trackId,
  canUploadFiles,
  hideDone,
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
  onDeleteAction: (ai: WorkflowActionItem) => void;
  onAddAction: (m: WorkflowMilestone) => void;
  onPhaseStatusChange: (phaseId: string, status: string) => void;
  onPhaseStatusClear: (phaseId: string) => void;
  onStepStatusChange: (milestoneId: string, status: string) => void;
  onStepStatusClear: (milestoneId: string) => void;
  trackId: string;
  canUploadFiles: boolean;
  hideDone: boolean;
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
            <div className="flex items-center gap-3 mt-2 text-xs text-text-muted flex-wrap">
              {phase.budget && <span>Budget: <span className="text-accent">{phase.budget}</span></span>}
              {phase.timeframe && <span>Timeframe: <span className="text-text-primary">{phase.timeframe}</span></span>}
              {phase.assignedTo && <span>Assigned: <span className="text-text-primary">@{phase.assignedTo}</span></span>}
              <span>By {creatorName(phase.createdBy)}</span>
            </div>
          </div>
        </button>
        <div className="flex items-center gap-2">
          {/* Phase status: editor can override the auto-derived value, with
              a small revert button to go back to auto. */}
          {isAdmin ? (
            <EditableStatusControl
              status={phase.status}
              manuallySet={!!phase.statusManuallySet}
              options={PHASE_STATUSES}
              onChange={(s) => onPhaseStatusChange(phase.id, s)}
              onClearOverride={() => onPhaseStatusClear(phase.id)}
              autoTooltip="Auto-derived from steps. Pick a value to override."
            />
          ) : (
            <StatusBadge status={phase.status} />
          )}
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
        <>
          <PhaseAssetsPanel
            phaseId={phase.id}
            trackId={trackId}
            attachments={phase.attachments || []}
            links={phase.links || []}
            canEdit={canUploadFiles}
          />
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
                onDeleteAction={onDeleteAction}
                onStatusChange={(s) => onStepStatusChange(m.id, s)}
                onStatusClear={() => onStepStatusClear(m.id)}
                hideDone={hideDone}
              />
            ))}
            {phase.milestones.length === 0 && (
              <div className="text-text-muted text-sm italic">No steps</div>
            )}
          </div>
        </>
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
  onDeleteAction,
  onStatusChange,
  onStatusClear,
  hideDone,
}: {
  milestone: WorkflowMilestone;
  canEdit: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onAddAction: () => void;
  onActionStatusChange: (actionId: string, s: ActionItemStatus) => void;
  onDeleteAction: (ai: WorkflowActionItem) => void;
  onStatusChange: (status: string) => void;
  onStatusClear: () => void;
  hideDone: boolean;
}) {
  const [open, setOpen] = useState(true);
  const [showDoneOverride, setShowDoneOverride] = useState(false);
  const doneItems = milestone.actionItems.filter(a => a.status === 'Done');
  const openItems = milestone.actionItems.filter(a => a.status !== 'Done');
  const visibleDone = !hideDone || showDoneOverride;
  return (
    <div className="bg-bg-deep border border-border-soft rounded p-3">
      <div className="flex items-start justify-between gap-3">
        <button onClick={() => setOpen(!open)} className="flex items-start gap-2 flex-1 text-left">
          {open ? <ChevronDown size={16} className="mt-0.5 text-text-muted" /> : <ChevronRight size={16} className="mt-0.5 text-text-muted" />}
          <div>
            <div className="font-medium">{milestone.title}</div>
            {milestone.description && <p className="text-xs text-text-muted mt-1">{milestone.description}</p>}
            <div className="flex items-center gap-3 mt-1 text-xs text-text-muted flex-wrap">
              {milestone.dueDate && <span>Due {new Date(milestone.dueDate).toLocaleDateString()}</span>}
              {milestone.assignedTo && <span>Assigned: <span className="text-text-primary">@{milestone.assignedTo}</span></span>}
              <span>By {creatorName(milestone.createdBy)}</span>
            </div>
          </div>
        </button>
        <div className="flex items-center gap-2">
          {/* Step status: editor can override the auto-derived value. */}
          {canEdit ? (
            <EditableStatusControl
              status={milestone.status}
              manuallySet={!!milestone.statusManuallySet}
              options={STEP_STATUSES}
              onChange={onStatusChange}
              onClearOverride={onStatusClear}
              autoTooltip="Auto-derived from action items. Pick a value to override."
            />
          ) : (
            <StatusBadge status={milestone.status} />
          )}
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
          {openItems.map((ai) => (
            <ActionRow
              key={ai.id}
              item={ai}
              canEdit={canEdit}
              onStatusChange={(s) => onActionStatusChange(ai.id, s)}
              onDelete={() => onDeleteAction(ai)}
            />
          ))}
          {visibleDone && doneItems.map((ai) => (
            <ActionRow
              key={ai.id}
              item={ai}
              canEdit={canEdit}
              onStatusChange={(s) => onActionStatusChange(ai.id, s)}
              onDelete={() => onDeleteAction(ai)}
            />
          ))}
          {doneItems.length > 0 && hideDone && (
            <button
              type="button"
              onClick={() => setShowDoneOverride(v => !v)}
              className="text-xs text-text-muted hover:text-accent inline-flex items-center gap-1 mt-1"
            >
              {showDoneOverride
                ? <><EyeOff size={11} /> Hide {doneItems.length} done</>
                : <><Eye size={11} /> Show {doneItems.length} done</>}
            </button>
          )}
          {milestone.actionItems.length === 0 && (
            <div className="text-text-muted text-xs italic">No action items</div>
          )}
        </div>
      )}
    </div>
  );
}

// Shared assignee dropdown — reads contacts (from the client's CRM entity)
// and active users via /api/workflow/clients/:id/assignees, the same source
// the action-item assignee uses.
function AssigneePicker({
  workflowClientId,
  value,
  onChange,
  disabled,
}: {
  workflowClientId: string;
  value: string | null;
  onChange: (v: string | null) => void;
  disabled?: boolean;
}) {
  const { data: assignees = [] } = useQuery<Assignee[]>({
    queryKey: ['assignees', workflowClientId],
    queryFn: () => listAssignees(workflowClientId),
    enabled: !!workflowClientId,
  });
  const contacts = assignees.filter((a) => a.kind === 'contact');
  const users = assignees.filter((a) => a.kind === 'user');
  return (
    <select
      className="input"
      value={value || ''}
      onChange={(e) => onChange(e.target.value || null)}
      disabled={disabled}
    >
      <option value="">— Unassigned —</option>
      {contacts.length > 0 && (
        <optgroup label="Client contacts">
          {contacts.map((a) => (
            <option key={`c-${a.id}`} value={a.name}>
              {a.name}{a.subtitle ? ` — ${a.subtitle}` : ''}
            </option>
          ))}
        </optgroup>
      )}
      {users.length > 0 && (
        <optgroup label="Signal Ridge team">
          {users.map((a) => (
            <option key={`u-${a.id}`} value={a.name}>{a.name}</option>
          ))}
        </optgroup>
      )}
    </select>
  );
}

function ItemCreateModal({
  title,
  showDueDate,
  workflowClientId,
  loading,
  onClose,
  onSubmit,
}: {
  title: string;
  showDueDate: boolean;
  workflowClientId: string;
  loading: boolean;
  onClose: () => void;
  onSubmit: (fields: { title: string; assignedTo: string | null; dueDate: string | null }) => void;
}) {
  const [form, setForm] = useState<{ title: string; assignedTo: string | null; dueDate: string }>({
    title: '',
    assignedTo: null,
    dueDate: '',
  });

  return (
    <Modal title={title} onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const trimmed = form.title.trim();
          if (!trimmed) return;
          onSubmit({
            title: trimmed,
            assignedTo: form.assignedTo,
            dueDate: form.dueDate ? form.dueDate : null,
          });
        }}
        className="space-y-3"
      >
        <div>
          <label className="label">Title</label>
          <input
            className="input"
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            placeholder="Short descriptive title"
            autoFocus
            required
            disabled={loading}
          />
        </div>
        <div className={showDueDate ? 'grid grid-cols-2 gap-3' : ''}>
          <div>
            <label className="label">Assigned to</label>
            <AssigneePicker
              workflowClientId={workflowClientId}
              value={form.assignedTo}
              onChange={(v) => setForm((f) => ({ ...f, assignedTo: v }))}
              disabled={loading}
            />
          </div>
          {showDueDate && (
            <div>
              <label className="label">Due date</label>
              <input
                type="date"
                className="input"
                value={form.dueDate}
                onChange={(e) => setForm((f) => ({ ...f, dueDate: e.target.value }))}
                disabled={loading}
              />
            </div>
          )}
        </div>
        <div className="flex justify-end gap-3 pt-2">
          <button type="button" className="btn-secondary" onClick={onClose} disabled={loading}>
            Cancel
          </button>
          <button type="submit" className="btn-primary" disabled={loading || !form.title.trim()}>
            {loading ? 'Creating…' : 'Create'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function PhaseEditModal({
  phase,
  saving,
  workflowClientId,
  onClose,
  onSubmit,
}: {
  phase: WorkflowPhase;
  saving: boolean;
  workflowClientId: string;
  onClose: () => void;
  onSubmit: (form: { title: string; description: string; budget: string; timeframe: string; status: PhaseStatus; assignedTo: string | null }) => void;
}) {
  const [form, setForm] = useState({
    title: phase.title,
    description: phase.description || '',
    budget: phase.budget || '',
    timeframe: phase.timeframe || '',
    assignedTo: phase.assignedTo || null as string | null,
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
          <label className="label">Assigned to</label>
          <AssigneePicker
            workflowClientId={workflowClientId}
            value={form.assignedTo}
            onChange={(v) => setForm((f) => ({ ...f, assignedTo: v }))}
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
  workflowClientId,
  onClose,
  onSubmit,
}: {
  step: WorkflowMilestone;
  saving: boolean;
  workflowClientId: string;
  onClose: () => void;
  onSubmit: (form: { title: string; description: string; dueDate: string; status: MilestoneStatus; assignedTo: string | null }) => void;
}) {
  const [form, setForm] = useState({
    title: step.title,
    description: step.description || '',
    dueDate: step.dueDate ? step.dueDate.slice(0, 10) : '',
    assignedTo: step.assignedTo || null as string | null,
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
        <div className="grid grid-cols-2 gap-3">
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
            <label className="label">Assigned to</label>
            <AssigneePicker
              workflowClientId={workflowClientId}
              value={form.assignedTo}
              onChange={(v) => setForm((f) => ({ ...f, assignedTo: v }))}
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
  onDelete,
}: {
  item: WorkflowActionItem;
  canEdit: boolean;
  onStatusChange: (s: ActionItemStatus) => void;
  onDelete: () => void;
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
        <div className="flex items-center gap-2 shrink-0">
          <StatusSelect value={item.status} options={ACTION_STATUSES} onChange={onStatusChange} />
          <button
            onClick={onDelete}
            className="btn-ghost p-1 rounded hover:text-status-red"
            title="Delete action"
            aria-label="Delete action"
          >
            <Trash2 size={12} />
          </button>
        </div>
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
  const [showPaste, setShowPaste] = useState(false);
  const [pastedText, setPastedText] = useState('');
  const [pasting, setPasting] = useState(false);

  // Poll while extraction is running so fields fill in without a manual reload.
  useEffect(() => {
    if (!isPending) return;
    const t = setInterval(() => {
      qc.invalidateQueries({ queryKey: ['track', track.id] });
    }, 3000);
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

  async function submitPasted() {
    if (pastedText.trim().length < 100) {
      toast.error('Paste at least 100 characters of the page');
      return;
    }
    setPasting(true);
    try {
      await extractTrackFromText(track.id, pastedText);
      toast.success('Claude is reading the pasted text');
      setShowPaste(false);
      setPastedText('');
      qc.invalidateQueries({ queryKey: ['track', track.id] });
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Failed');
    } finally {
      setPasting(false);
    }
  }

  async function toggleFocusArea(name: string) {
    const current = track.targetedFocusAreas || [];
    const next = current.includes(name) ? current.filter(n => n !== name) : [...current, name];
    try {
      await updateTrack(track.id, { targetedFocusAreas: next });
      qc.invalidateQueries({ queryKey: ['track', track.id] });
    } catch {
      toast.error('Failed to save selection');
    }
  }

  async function confirmTargets() {
    try {
      await updateTrack(track.id, { focusAreasConfirmedAt: 'now' });
      qc.invalidateQueries({ queryKey: ['track', track.id] });
    } catch {
      toast.error('Failed to confirm');
    }
  }

  async function editTargets() {
    try {
      await updateTrack(track.id, { focusAreasConfirmedAt: null });
      qc.invalidateQueries({ queryKey: ['track', track.id] });
    } catch {
      toast.error('Failed to re-open selection');
    }
  }

  const showFallback = isAdmin && (status === 'blocked' || status === 'failed' || status === 'partial');
  const focusAreas = track.focusAreas || [];
  const targeted = track.targetedFocusAreas || [];
  const isConfirmed = !!track.focusAreasConfirmedAt;
  const visibleFocusAreas = isConfirmed
    ? focusAreas.filter(fa => targeted.includes(fa.name))
    : focusAreas;
  const pocs = track.pointsOfContact || [];
  const sections = track.additionalSections || [];

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
          Claude is reading — fields will fill in shortly.
        </div>
      )}
      {status === 'blocked' && (
        <div className="text-xs text-status-amber mb-3">
          Couldn't read this URL automatically. Paste the page text below, or use the bookmarklet from Admin → Advanced.
        </div>
      )}
      {status === 'failed' && (
        <div className="text-xs text-status-red mb-3">Extraction failed. Try Re-extract, or paste the page text below.</div>
      )}
      {status === 'partial' && (
        <div className="text-xs text-status-amber mb-3">
          Claude could only fill part of the announcement. Paste the full page text below for another pass.
        </div>
      )}

      {/* Always-visible header fields. Show "—" if missing so user knows what was checked. */}
      <div className="grid grid-cols-2 gap-3 text-sm">
        <Field label="Solicitation #">{track.solicitationNumber || dash()}</Field>
        <Field label="Vehicle">{track.vehicleType || dash()}</Field>
        <Field label="Issuing Agency">{track.issuingAgency || dash()}</Field>
        <Field label="Funding Authority">{track.fundingAuthority || dash()}</Field>
        <Field label="Questions Due">{track.questionsDueDate ? new Date(track.questionsDueDate).toLocaleDateString() : dash()}</Field>
        <Field label="Proposal Due">{track.proposalDueDate ? new Date(track.proposalDueDate).toLocaleDateString() : dash()}</Field>
        <Field label="Period of Performance">{track.periodOfPerformance || dash()}</Field>
        <Field label="Funding">
          {[track.fundingFloor, track.fundingCeiling].filter(Boolean).join(' – ') || dash()}
        </Field>
      </div>

      <div className="mt-3">
        <div className="text-xs text-text-muted uppercase tracking-wider mb-1">Objective</div>
        <p className="text-sm text-text-primary whitespace-pre-wrap">{track.objective || notStated()}</p>
      </div>

      {focusAreas.length > 0 && (
        <div className="mt-4">
          <div className="flex items-center justify-between mb-2">
            <div className="text-xs text-text-muted uppercase tracking-wider">
              {isConfirmed
                ? `Targeted Focus Areas (${visibleFocusAreas.length})`
                : `Focus Areas — check the ones you're targeting`}
            </div>
            {isAdmin && (
              isConfirmed ? (
                <button
                  type="button"
                  onClick={editTargets}
                  className="text-xs text-accent hover:opacity-80"
                >
                  Edit targets
                </button>
              ) : (
                <button
                  type="button"
                  onClick={confirmTargets}
                  className="btn-primary text-xs"
                  disabled={targeted.length === 0}
                  title={targeted.length === 0 ? 'Pick at least one focus area first' : 'Hide non-targeted areas'}
                >
                  Confirm targets
                </button>
              )
            )}
          </div>
          <div className="space-y-2">
            {visibleFocusAreas.map((fa, i) => {
              const isPicked = targeted.includes(fa.name);
              return (
                <label
                  key={`${fa.name}-${i}`}
                  className={`flex items-start gap-2 p-2.5 rounded transition-colors ${isConfirmed ? '' : 'cursor-pointer'}`}
                  style={{
                    background: isPicked ? 'rgba(201,168,76,0.1)' : '#0d1117',
                    border: `1px solid ${isPicked ? '#c9a84c' : '#24375a'}`,
                  }}
                >
                  {!isConfirmed && (
                    <input
                      type="checkbox"
                      checked={isPicked}
                      onChange={() => toggleFocusArea(fa.name)}
                      className="mt-1"
                      style={{ accentColor: '#c9a84c' }}
                      disabled={!isAdmin}
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-text-primary">{fa.name}</div>
                    {fa.summary && (
                      <p className="text-xs text-text-muted mt-1 whitespace-pre-wrap">{fa.summary}</p>
                    )}
                  </div>
                </label>
              );
            })}
          </div>
          {isConfirmed && focusAreas.length > visibleFocusAreas.length && (
            <p className="text-xs text-text-muted italic mt-2">
              {focusAreas.length - visibleFocusAreas.length} non-targeted area
              {focusAreas.length - visibleFocusAreas.length === 1 ? '' : 's'} hidden — click "Edit targets" to bring them back.
            </p>
          )}
        </div>
      )}

      {(track.eligibility || isAdmin) && (
        <div className="mt-4">
          <div className="text-xs text-text-muted uppercase tracking-wider mb-1">Eligibility</div>
          <p className="text-sm text-text-primary whitespace-pre-wrap">{track.eligibility || notStated()}</p>
        </div>
      )}

      {(track.submissionFormat || isAdmin) && (
        <div className="mt-4">
          <div className="text-xs text-text-muted uppercase tracking-wider mb-1">Submission Format</div>
          <p className="text-sm text-text-primary whitespace-pre-wrap">{track.submissionFormat || notStated()}</p>
        </div>
      )}

      {pocs.length > 0 && (
        <div className="mt-4">
          <div className="text-xs text-text-muted uppercase tracking-wider mb-1">Points of Contact</div>
          <div className="space-y-1.5">
            {pocs.map((poc, i) => (
              <div key={i} className="text-sm">
                <span className="text-text-primary font-medium">{poc.name || '—'}</span>
                {poc.role && <span className="text-text-muted"> · {poc.role}</span>}
                {poc.email && (
                  <a className="ml-2 text-accent" href={`mailto:${poc.email}`}>{poc.email}</a>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {sections.length > 0 && (
        <div className="mt-4">
          <div className="text-xs text-text-muted uppercase tracking-wider mb-1">Other Notes</div>
          <div className="space-y-2">
            {sections.map((s, i) => (
              <div key={i}>
                <div className="text-xs font-semibold text-text-primary">{s.heading}</div>
                <p className="text-xs text-text-muted whitespace-pre-wrap">{s.content}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {showFallback && (
        <div className="mt-4 pt-3" style={{ borderTop: '1px solid #24375a' }}>
          {!showPaste ? (
            <button
              type="button"
              className="btn-secondary text-xs"
              onClick={() => setShowPaste(true)}
            >
              Paste page text for re-extraction
            </button>
          ) : (
            <div className="space-y-2">
              <label className="label">Page text</label>
              <textarea
                className="input"
                rows={6}
                value={pastedText}
                onChange={e => setPastedText(e.target.value)}
                placeholder="Open the opportunity in a tab where you're signed in, Ctrl+A → Ctrl+C → paste here"
                style={{ resize: 'vertical', fontFamily: 'monospace', fontSize: '12px' }}
                disabled={pasting}
              />
              <div className="flex gap-2 justify-end">
                <button
                  type="button"
                  className="btn-secondary text-xs"
                  onClick={() => { setShowPaste(false); setPastedText(''); }}
                  disabled={pasting}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn-primary text-xs"
                  onClick={submitPasted}
                  disabled={pasting || pastedText.trim().length < 100}
                >
                  {pasting ? 'Submitting…' : 'Extract from pasted text'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function dash() {
  return <span className="text-text-muted italic">—</span>;
}
function notStated() {
  return <span className="text-text-muted italic">Not stated in the announcement.</span>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs text-text-muted uppercase tracking-wider">{label}</div>
      <div className="text-sm text-text-primary mt-0.5">{children}</div>
    </div>
  );
}

// CRM tasks + reminders attached to this track's mirrored Initiative.
// Read-only — editing happens in the CRM. Hidden when the track has no
// initiativeId (e.g. orphan-promoted track that hasn't synced yet).
function CrmFollowupsPanel({ trackId }: { trackId: string }) {
  const [open, setOpen] = useState(true);
  const [showCompleted, setShowCompleted] = useState(false);
  const { data, isLoading } = useQuery({
    queryKey: ['track-crm-followups', trackId],
    queryFn: () => getTrackCrmFollowups(trackId),
  });

  if (isLoading || !data || !data.initiativeId) return null;

  const openTasks = data.tasks.filter(t => !t.completed);
  const doneTasks = data.tasks.filter(t => t.completed);
  const openReminders = data.reminders.filter(r => !r.completed);
  const doneReminders = data.reminders.filter(r => r.completed);
  const totalOpen = openTasks.length + openReminders.length;
  const totalDone = doneTasks.length + doneReminders.length;

  // The CRM client is mounted at /crm/ on the same origin (see vite configs),
  // so absolute paths jump to it directly. Initiative detail is the canonical
  // place to view + edit tasks/reminders for an initiative.
  const initiativeUrl = `/crm/initiatives/${data.initiativeId}`;

  return (
    <div className="card mb-6" style={{ background: '#0f1a2e', border: '1px solid #1f3556' }}>
      <button onClick={() => setOpen(o => !o)} className="flex items-center justify-between w-full text-left">
        <div className="flex items-center gap-2">
          <Bell size={14} className="text-accent" />
          <span className="text-sm font-semibold">CRM follow-ups</span>
          <span className="text-xs text-text-muted">
            {totalOpen} open{totalDone > 0 && ` · ${totalDone} done`}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <a
            href={initiativeUrl}
            onClick={e => e.stopPropagation()}
            className="text-xs text-accent hover:underline inline-flex items-center gap-1"
            title="Open the linked Initiative in the CRM"
          >
            Open Initiative in CRM <ArrowRight size={11} />
          </a>
          {open ? <ChevronDown size={14} className="text-text-muted" /> : <ChevronRight size={14} className="text-text-muted" />}
        </div>
      </button>

      {open && (
        <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <div className="text-xs uppercase tracking-wider text-text-muted mb-1.5">
              Tasks ({openTasks.length})
            </div>
            {openTasks.length === 0 && doneTasks.length === 0 && (
              <div className="text-xs text-text-muted italic">No tasks. Add in CRM.</div>
            )}
            <div className="space-y-1">
              {openTasks.map(t => <TaskRow key={t.id} t={t} />)}
              {showCompleted && doneTasks.map(t => <TaskRow key={t.id} t={t} />)}
            </div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-wider text-text-muted mb-1.5">
              Reminders ({openReminders.length})
            </div>
            {openReminders.length === 0 && doneReminders.length === 0 && (
              <div className="text-xs text-text-muted italic">No reminders. Add in CRM.</div>
            )}
            <div className="space-y-1">
              {openReminders.map(r => <ReminderRow key={r.id} r={r} />)}
              {showCompleted && doneReminders.map(r => <ReminderRow key={r.id} r={r} />)}
            </div>
          </div>
          {totalDone > 0 && (
            <button
              onClick={() => setShowCompleted(v => !v)}
              className="md:col-span-2 text-xs text-text-muted hover:text-accent inline-flex items-center gap-1"
            >
              {showCompleted
                ? <><EyeOff size={11} /> Hide {totalDone} completed</>
                : <><Eye size={11} /> Show {totalDone} completed</>}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function crmDueColor(d?: string | null): string | undefined {
  if (!d) return undefined;
  const days = (new Date(d).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
  if (days < 0) return '#da3633';
  if (days <= 3) return '#d29922';
  return undefined;
}

function TaskRow({ t }: { t: CrmFollowupTask }) {
  const contactName = t.contact ? `${t.contact.firstName} ${t.contact.lastName}`.trim() : null;
  return (
    <div
      className="flex items-center gap-2 px-2 py-1.5 rounded text-xs"
      style={{ background: '#0d1117', border: '1px solid #1f3556', opacity: t.completed ? 0.55 : 1 }}
    >
      <span className="flex-1 truncate" style={{ textDecoration: t.completed ? 'line-through' : undefined }}>
        {t.title}
      </span>
      {contactName && <span className="text-text-muted truncate max-w-[140px]">{contactName}</span>}
      {t.dueDate && (
        <span style={{ color: t.completed ? '#8b949e' : (crmDueColor(t.dueDate) || '#8b949e') }}>
          {new Date(t.dueDate).toLocaleDateString()}
        </span>
      )}
    </div>
  );
}

function ReminderRow({ r }: { r: CrmFollowupReminder }) {
  const contactName = r.contact ? `${r.contact.firstName} ${r.contact.lastName}`.trim() : null;
  return (
    <div
      className="flex items-center gap-2 px-2 py-1.5 rounded text-xs"
      style={{ background: '#0d1117', border: '1px solid #1f3556', opacity: r.completed ? 0.55 : 1 }}
    >
      <span className="flex-1 truncate" style={{ textDecoration: r.completed ? 'line-through' : undefined }}>
        {r.title}
      </span>
      {contactName && <span className="text-text-muted truncate max-w-[140px]">{contactName}</span>}
      <span style={{ color: r.completed ? '#8b949e' : (crmDueColor(r.remindAt) || '#8b949e') }}>
        {new Date(r.remindAt).toLocaleDateString()}
      </span>
    </div>
  );
}
