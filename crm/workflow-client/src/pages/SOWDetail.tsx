import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import MDEditor from '@uiw/react-md-editor';
import {
  ArrowLeft,
  Save,
  Send,
  History,
  Plus,
  X,
  CheckCircle2,
  Circle,
  AlertTriangle,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { getSOW, updateSOW, createComment, checkSOWOverlap, type SOWOverlap } from '../api';
import type { ChecklistItem, DifferentiationLayer, WorkflowSOW } from '../types';
import { useAuth } from '../AuthContext';
import { StatusBadge } from './Dashboard';
import { ConfirmModal } from '../components/Modal';

const LAYERS: Array<{ value: DifferentiationLayer | ''; label: string }> = [
  { value: '', label: '— Select —' },
  { value: 'Layer1', label: 'Layer 1 — AI/ML Research Core' },
  { value: 'Layer2', label: 'Layer 2 — Integrated Prototype' },
  { value: 'Layer3', label: 'Layer 3 — Operator-Facing Tools' },
  { value: 'Layer4', label: 'Layer 4 — Commercial Platform' },
  { value: 'CrossLayer', label: 'Cross-Layer' },
];

function parseJsonArray<T>(s: string | null | undefined, fallback: T[]): T[] {
  if (!s) return fallback;
  try {
    const v = JSON.parse(s);
    return Array.isArray(v) ? (v as T[]) : fallback;
  } catch {
    return fallback;
  }
}

function newChecklistId() {
  return 'cl-' + Math.random().toString(36).slice(2, 10);
}

interface FormState {
  title: string;
  status: string;
  targetFundingVehicle: string;
  targetAgency: string;
  periodOfPerformance: string;
  budget: string;
  differentiationLayer: DifferentiationLayer | '';
  trlStatement: string;
  scope: string;
  keyPersonnel: string;
  deliverables: string[];
  draftingChecklist: ChecklistItem[];
}

function fromSow(sow: WorkflowSOW): FormState {
  return {
    title: sow.title || '',
    status: sow.status || 'Draft',
    targetFundingVehicle: sow.targetFundingVehicle || '',
    targetAgency: sow.targetAgency || '',
    periodOfPerformance: sow.periodOfPerformance || '',
    budget: sow.budget || '',
    differentiationLayer: (sow.differentiationLayer as DifferentiationLayer) || '',
    trlStatement: sow.trlStatement || '',
    scope: sow.scope || sow.content || '',
    keyPersonnel: sow.keyPersonnel || '',
    deliverables: parseJsonArray<string>(sow.deliverables, []),
    draftingChecklist: parseJsonArray<ChecklistItem>(sow.draftingChecklist, []),
  };
}

export function SOWDetail() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const isAdmin = user?.workflowRole === 'WorkflowAdmin';
  const canComment = isAdmin || user?.workflowRole === 'WorkflowEditor';
  const canEditChecklist = canComment; // editors can tick drafting items
  const qc = useQueryClient();

  const { data: sow, isLoading } = useQuery<WorkflowSOW>({
    queryKey: ['sow', id],
    queryFn: () => getSOW(id!),
    enabled: !!id,
  });

  const [form, setForm] = useState<FormState | null>(null);
  const [saving, setSaving] = useState(false);
  const [comment, setComment] = useState('');
  const [showVersions, setShowVersions] = useState(false);
  const [viewingVersion, setViewingVersion] = useState<string | null>(null);
  const [overlaps, setOverlaps] = useState<SOWOverlap[] | null>(null);
  const [checkingOverlap, setCheckingOverlap] = useState(false);

  useEffect(() => {
    if (sow) setForm(fromSow(sow));
  }, [sow?.id]);

  const viewedVersion = useMemo(() => {
    if (!viewingVersion || !sow?.versions) return null;
    return sow.versions.find((v) => v.id === viewingVersion) || null;
  }, [viewingVersion, sow]);

  if (isLoading) return <div className="text-text-muted">Loading…</div>;
  if (!sow || !form) return <div className="text-text-muted">Not found</div>;

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => (f ? { ...f, [key]: value } : f));
  }

  async function save() {
    if (!form) return;
    setSaving(true);
    try {
      await updateSOW(id!, {
        title: form.title,
        status: form.status,
        targetFundingVehicle: form.targetFundingVehicle || null,
        targetAgency: form.targetAgency || null,
        periodOfPerformance: form.periodOfPerformance || null,
        budget: form.budget || null,
        differentiationLayer: form.differentiationLayer || null,
        trlStatement: form.trlStatement || null,
        scope: form.scope,
        keyPersonnel: form.keyPersonnel,
        deliverables: JSON.stringify(form.deliverables),
        draftingChecklist: JSON.stringify(form.draftingChecklist),
      });
      toast.success('SOW saved');
      qc.invalidateQueries({ queryKey: ['sow', id] });
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Failed');
    } finally {
      setSaving(false);
    }
  }

  async function runOverlapCheck() {
    if (!form || !sow) return;
    setCheckingOverlap(true);
    const toastId = toast.loading('Checking for scope overlap across SOWs…');
    try {
      const { overlaps: hits } = await checkSOWOverlap({
        workflowClientId: sow.workflowClientId,
        excludeSowId: sow.id,
        title: form.title,
        scope: form.scope,
        deliverables: form.deliverables,
        targetAgency: form.targetAgency || undefined,
        targetFundingVehicle: form.targetFundingVehicle || undefined,
      });
      toast.dismiss(toastId);
      setOverlaps(hits);
    } catch (err: any) {
      toast.dismiss(toastId);
      toast.error(err?.response?.data?.error || 'Overlap check failed');
    } finally {
      setCheckingOverlap(false);
    }
  }

  async function postComment() {
    if (!comment.trim()) return;
    try {
      await createComment({ sowId: id, content: comment.trim() });
      setComment('');
      qc.invalidateQueries({ queryKey: ['sow', id] });
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Failed');
    }
  }

  async function toggleChecklist(idx: number) {
    if (!form) return;
    const next = form.draftingChecklist.map((c, i) => (i === idx ? { ...c, done: !c.done } : c));
    set('draftingChecklist', next);
    // Auto-save checklist toggles so editors/admins can tick without clicking Save.
    try {
      await updateSOW(id!, { draftingChecklist: JSON.stringify(next) });
      qc.invalidateQueries({ queryKey: ['sow', id] });
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Failed');
    }
  }

  function addChecklistItem(title: string) {
    if (!form || !title.trim()) return;
    set('draftingChecklist', [
      ...form.draftingChecklist,
      { id: newChecklistId(), title: title.trim(), done: false },
    ]);
  }

  function removeChecklistItem(idx: number) {
    if (!form) return;
    set(
      'draftingChecklist',
      form.draftingChecklist.filter((_, i) => i !== idx)
    );
  }

  function addDeliverable(title: string) {
    if (!form || !title.trim()) return;
    set('deliverables', [...form.deliverables, title.trim()]);
  }

  function removeDeliverable(idx: number) {
    if (!form) return;
    set(
      'deliverables',
      form.deliverables.filter((_, i) => i !== idx)
    );
  }

  const checklistDone = form.draftingChecklist.filter((c) => c.done).length;

  return (
    <div>
      <Link
        to={sow.track ? `/tracks/${sow.track.id}` : '/'}
        className="btn-ghost inline-flex items-center gap-1 mb-4"
      >
        <ArrowLeft size={14} /> {sow.track ? `Back to ${sow.track.title}` : 'Back to tracks'}
      </Link>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-4">
        <div className="space-y-4">
          {/* Header card */}
          <div className="card">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1">
                {isAdmin ? (
                  <input
                    className="input text-lg font-semibold"
                    value={form.title}
                    onChange={(e) => set('title', e.target.value)}
                  />
                ) : (
                  <h1 className="text-xl font-semibold">{sow.title}</h1>
                )}
                <div className="flex items-center gap-3 text-xs text-text-muted mt-2">
                  <span>v{sow.version}</span>
                  <span>· Updated {new Date(sow.updatedAt).toLocaleString()}</span>
                  {sow.createdBy && (
                    <span>· By {sow.createdBy.firstName} {sow.createdBy.lastName}</span>
                  )}
                </div>
              </div>
              <StatusBadge status={sow.status} />
            </div>

            <div className="mt-3">
              <div className="label">Track</div>
              {sow.track ? (
                <Link to={`/tracks/${sow.track.id}`} className="badge badge-gold hover:opacity-80">
                  {sow.track.title}
                </Link>
              ) : (
                <span className="badge badge-muted">Unassigned</span>
              )}
              <div className="text-xs text-text-muted mt-1">
                A SOW belongs to at most one track. Create or reassign from a track's detail page.
              </div>
            </div>
          </div>

          {/* Structured fields */}
          <div className="card">
            <h3 className="font-semibold mb-4">SOW Fields</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Target funding vehicle" value={form.targetFundingVehicle} onChange={(v) => set('targetFundingVehicle', v)} readOnly={!isAdmin} placeholder="e.g. Genesis" />
              <Field label="Target agency / sponsor" value={form.targetAgency} onChange={(v) => set('targetAgency', v)} readOnly={!isAdmin} placeholder="e.g. AFRL/RIGA" />
              <Field label="Period of performance" value={form.periodOfPerformance} onChange={(v) => set('periodOfPerformance', v)} readOnly={!isAdmin} placeholder="e.g. 6 months" />
              <Field label="Budget / ceiling" value={form.budget} onChange={(v) => set('budget', v)} readOnly={!isAdmin} placeholder="e.g. $200-300K" />
              <div>
                <label className="label">Differentiation layer</label>
                <select
                  className="input"
                  value={form.differentiationLayer}
                  onChange={(e) => set('differentiationLayer', e.target.value as DifferentiationLayer | '')}
                  disabled={!isAdmin}
                >
                  {LAYERS.map((l) => (
                    <option key={l.value} value={l.value}>{l.label}</option>
                  ))}
                </select>
              </div>
              <Field label="TRL entry → exit" value={form.trlStatement} onChange={(v) => set('trlStatement', v)} readOnly={!isAdmin} placeholder="e.g. TRL 3 → 6" />
              <div className="md:col-span-2">
                <div className="flex items-center justify-between">
                  <label className="label">Status</label>
                </div>
                <select
                  className="input max-w-xs"
                  value={form.status}
                  onChange={(e) => set('status', e.target.value)}
                  disabled={!isAdmin}
                >
                  <option value="Draft">Draft</option>
                  <option value="Active">Active</option>
                  <option value="Archived">Archived</option>
                </select>
              </div>
            </div>
          </div>

          {/* Scope narrative */}
          <div className="card">
            <h3 className="font-semibold mb-2">Scope / Objective</h3>
            <div data-color-mode="dark">
              <MDEditor
                value={viewedVersion ? parseVersionScope(viewedVersion.snapshotJson, viewedVersion.content) : form.scope}
                onChange={(v) => isAdmin && !viewedVersion && set('scope', v || '')}
                height={280}
                preview={isAdmin && !viewedVersion ? 'live' : 'preview'}
              />
            </div>
          </div>

          {/* Deliverables */}
          <div className="card">
            <h3 className="font-semibold mb-3">Deliverables</h3>
            <ul className="space-y-1.5">
              {form.deliverables.map((d, idx) => (
                <li key={idx} className="flex items-start gap-2 text-sm">
                  <span className="text-accent mt-0.5">•</span>
                  <span className="flex-1">{d}</span>
                  {isAdmin && (
                    <button onClick={() => removeDeliverable(idx)} className="text-text-muted hover:text-status-red" aria-label="Remove">
                      <X size={14} />
                    </button>
                  )}
                </li>
              ))}
            </ul>
            {isAdmin && (
              <AddRow placeholder="New deliverable…" onAdd={addDeliverable} />
            )}
            {form.deliverables.length === 0 && !isAdmin && (
              <div className="text-text-muted text-sm italic">No deliverables listed</div>
            )}
          </div>

          {/* Key personnel */}
          <div className="card">
            <h3 className="font-semibold mb-2">Key Personnel</h3>
            {isAdmin ? (
              <textarea
                className="textarea"
                rows={4}
                value={form.keyPersonnel}
                onChange={(e) => set('keyPersonnel', e.target.value)}
                placeholder="PI, co-PI, technical leads with percent-time allocation"
              />
            ) : (
              <div className="text-sm whitespace-pre-wrap bg-bg-deep border border-border-soft rounded p-3">
                {form.keyPersonnel || <span className="text-text-muted italic">Not specified</span>}
              </div>
            )}
          </div>

          {/* Drafting checklist */}
          <div className="card">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold">Drafting Checklist</h3>
              <span className="text-xs text-text-muted">
                {checklistDone}/{form.draftingChecklist.length} done
              </span>
            </div>
            <ul className="space-y-1">
              {form.draftingChecklist.map((c, idx) => (
                <li key={c.id} className="flex items-start gap-2 text-sm">
                  <button
                    onClick={() => toggleChecklist(idx)}
                    disabled={!canEditChecklist}
                    className={c.done ? 'text-status-green mt-0.5' : 'text-text-muted hover:text-accent mt-0.5'}
                    aria-label={c.done ? 'Mark as not done' : 'Mark as done'}
                  >
                    {c.done ? <CheckCircle2 size={16} /> : <Circle size={16} />}
                  </button>
                  <span className={`flex-1 ${c.done ? 'line-through text-text-muted' : ''}`}>{c.title}</span>
                  {isAdmin && (
                    <button onClick={() => removeChecklistItem(idx)} className="text-text-muted hover:text-status-red" aria-label="Remove">
                      <X size={14} />
                    </button>
                  )}
                </li>
              ))}
            </ul>
            {isAdmin && <AddRow placeholder="New drafting task…" onAdd={addChecklistItem} />}
            {form.draftingChecklist.length === 0 && !isAdmin && (
              <div className="text-text-muted text-sm italic">No drafting tasks</div>
            )}
          </div>

          {/* Save bar */}
          {isAdmin && !viewedVersion && (
            <div className="flex items-center gap-2 flex-wrap">
              <button className="btn-primary flex items-center gap-1" onClick={save} disabled={saving}>
                <Save size={14} /> {saving ? 'Saving…' : 'Save SOW'}
              </button>
              <button
                type="button"
                className="btn-secondary flex items-center gap-1"
                onClick={runOverlapCheck}
                disabled={checkingOverlap}
                title="Ask Claude if this SOW overlaps with others in this client"
              >
                <AlertTriangle size={14} /> {checkingOverlap ? 'Checking…' : 'Check for overlap'}
              </button>
              <span className="text-xs text-text-muted">
                Content changes are versioned automatically.
              </span>
            </div>
          )}
          {viewedVersion && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-text-muted">
                Viewing version {viewedVersion.version} (read-only)
              </span>
              <button className="btn-secondary" onClick={() => setViewingVersion(null)}>
                Back to current
              </button>
            </div>
          )}

          {/* Comments */}
          <div className="card">
            <h3 className="font-medium mb-3">Comments</h3>
            <div className="space-y-3">
              {sow.comments?.length ? sow.comments.map((c: any) => (
                <div key={c.id} className="bg-bg-deep border border-border-soft rounded p-3">
                  <div className="flex items-center justify-between text-xs text-text-muted mb-1">
                    <span className="font-medium text-accent">
                      {c.createdBy ? `${c.createdBy.firstName} ${c.createdBy.lastName}` : 'Unknown'}
                    </span>
                    <span>{new Date(c.createdAt).toLocaleString()}</span>
                  </div>
                  <div className="text-sm whitespace-pre-wrap">{c.content}</div>
                </div>
              )) : (
                <div className="text-text-muted text-sm italic">No comments yet</div>
              )}
            </div>
            {canComment && (
              <div className="mt-3 flex gap-2">
                <input
                  className="input flex-1"
                  placeholder="Write a comment…"
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && postComment()}
                />
                <button className="btn-primary flex items-center gap-1" onClick={postComment}>
                  <Send size={14} /> Post
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Overlap check result modal */}
        {overlaps && (
          <ConfirmModal
            title={overlaps.length > 0 ? 'Possible scope overlap' : 'No overlaps detected'}
            confirmLabel="Got it"
            cancelLabel=""
            onConfirm={() => setOverlaps(null)}
            onCancel={() => setOverlaps(null)}
            message={
              overlaps.length === 0 ? (
                <div className="text-sm">
                  Claude did not find any materially overlapping SOWs in this client.
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-start gap-2 text-sm">
                    <AlertTriangle size={16} className="text-status-amber mt-0.5 shrink-0" />
                    <p>
                      Claude flagged {overlaps.length} existing SOW{overlaps.length === 1 ? '' : 's'} with similar work on a different funding path.
                      Review so the same scope isn't committed to two sponsors.
                    </p>
                  </div>
                  <ul className="space-y-2">
                    {overlaps.map((o) => (
                      <li key={o.sowId} className="bg-bg-deep border border-border-soft rounded p-3 text-sm">
                        <div className="font-medium text-accent">{o.sowTitle}</div>
                        {o.trackTitle && (
                          <div className="text-xs text-text-muted mt-0.5">Track: {o.trackTitle}</div>
                        )}
                        <div className="text-sm text-text-primary mt-2">{o.reason}</div>
                      </li>
                    ))}
                  </ul>
                </div>
              )
            }
          />
        )}

        {/* Sidebar: Versions */}
        <aside>
          <div className="card sticky top-4">
            <button
              onClick={() => setShowVersions(!showVersions)}
              className="flex items-center gap-2 font-medium w-full justify-between"
            >
              <span className="flex items-center gap-2">
                <History size={16} /> Version history
              </span>
              <span className="text-xs text-text-muted">{sow.versions?.length || 0}</span>
            </button>
            {showVersions && (
              <div className="mt-3 space-y-2">
                <button
                  onClick={() => setViewingVersion(null)}
                  className={`w-full text-left p-2 rounded text-sm ${
                    !viewingVersion ? 'bg-accent text-bg' : 'hover:bg-surface-alt'
                  }`}
                >
                  Current (v{sow.version})
                </button>
                {sow.versions?.map((v: any) => (
                  <button
                    key={v.id}
                    onClick={() => setViewingVersion(v.id)}
                    className={`w-full text-left p-2 rounded text-sm ${
                      viewingVersion === v.id ? 'bg-accent text-bg' : 'hover:bg-surface-alt'
                    }`}
                  >
                    <div className="font-medium">v{v.version}</div>
                    <div className="text-xs text-text-muted">
                      {new Date(v.createdAt).toLocaleString()}
                    </div>
                    {v.createdBy && (
                      <div className="text-xs text-text-muted">
                        {v.createdBy.firstName} {v.createdBy.lastName}
                      </div>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}

function parseVersionScope(snapshotJson: string, legacyContent: string): string {
  try {
    const snap = JSON.parse(snapshotJson || '{}');
    return snap.scope || legacyContent || '';
  } catch {
    return legacyContent || '';
  }
}

function Field({
  label,
  value,
  onChange,
  readOnly,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  readOnly?: boolean;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="label">{label}</label>
      {readOnly ? (
        <div className="text-sm bg-bg-deep border border-border-soft rounded px-3 py-2 min-h-[38px]">
          {value || <span className="text-text-muted italic">—</span>}
        </div>
      ) : (
        <input
          className="input"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
        />
      )}
    </div>
  );
}

function AddRow({ onAdd, placeholder }: { onAdd: (v: string) => void; placeholder: string }) {
  const [v, setV] = useState('');
  return (
    <form
      className="flex gap-2 mt-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (!v.trim()) return;
        onAdd(v);
        setV('');
      }}
    >
      <input className="input flex-1" value={v} onChange={(e) => setV(e.target.value)} placeholder={placeholder} />
      <button type="submit" className="btn-secondary flex items-center gap-1">
        <Plus size={14} /> Add
      </button>
    </form>
  );
}
