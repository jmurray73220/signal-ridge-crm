import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  DndContext,
  type DragEndEvent,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { FileText, Plus, Sparkles, Target, GripVertical } from 'lucide-react';
import toast from 'react-hot-toast';
import {
  listClients,
  listSOWs,
  listTracks,
  createSOW,
  updateSOW,
  suggestTrackForSOW,
} from '../api';
import type { WorkflowClient, WorkflowSOW, WorkflowTrack } from '../types';
import { useAuth } from '../AuthContext';
import { StatusBadge } from './Dashboard';

const UNASSIGNED = '__unassigned__';

export function SOWList() {
  const { user } = useAuth();
  const nav = useNavigate();
  const isAdmin = user?.workflowRole === 'WorkflowAdmin';
  const qc = useQueryClient();
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [suggestion, setSuggestion] = useState<{
    sow: WorkflowSOW;
    suggestedTrackId: string;
    trackTitle: string;
    rationale: string;
  } | null>(null);

  const clientsQuery = useQuery<WorkflowClient[]>({
    queryKey: ['clients'],
    queryFn: listClients,
  });

  useEffect(() => {
    if (!selectedClientId && clientsQuery.data && clientsQuery.data.length > 0) {
      const defaultId =
        user?.workflowClientId && clientsQuery.data.find((c) => c.id === user.workflowClientId)
          ? user.workflowClientId
          : clientsQuery.data[0].id;
      setSelectedClientId(defaultId);
    }
  }, [clientsQuery.data, selectedClientId, user]);

  const sowsQuery = useQuery<WorkflowSOW[]>({
    queryKey: ['sows', selectedClientId],
    queryFn: () => listSOWs(selectedClientId!),
    enabled: !!selectedClientId,
  });

  const tracksQuery = useQuery<WorkflowTrack[]>({
    queryKey: ['tracks', selectedClientId],
    queryFn: () => listTracks(selectedClientId!),
    enabled: !!selectedClientId && isAdmin,
  });

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  async function addSow() {
    if (!selectedClientId) return;
    const title = window.prompt('SOW title?');
    if (!title) return;
    try {
      const sow = await createSOW({ workflowClientId: selectedClientId, title });
      toast.success('SOW created');
      qc.invalidateQueries({ queryKey: ['sows'] });
      nav(`/sows/${sow.id}`);
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Failed');
    }
  }

  async function assignSowToTrack(sowId: string, trackId: string | null) {
    try {
      await updateSOW(sowId, { trackId });
      toast.success(trackId ? 'SOW assigned' : 'SOW unassigned');
      qc.invalidateQueries({ queryKey: ['sows', selectedClientId] });
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Failed');
    }
  }

  async function handleDragEnd(e: DragEndEvent) {
    const sowId = String(e.active.id);
    const overId = e.over ? String(e.over.id) : null;
    if (!overId) return;
    const targetTrackId = overId === UNASSIGNED ? null : overId;
    const sow = sowsQuery.data?.find((s) => s.id === sowId);
    if (!sow) return;
    if (sow.trackId === targetTrackId) return;
    await assignSowToTrack(sowId, targetTrackId);
  }

  async function handleSuggest(sow: WorkflowSOW) {
    const tid = toast.loading('Asking Claude for a track suggestion…');
    try {
      const result = await suggestTrackForSOW(sow.id);
      toast.dismiss(tid);
      setSuggestion({ sow, ...result });
    } catch (err: any) {
      toast.dismiss(tid);
      toast.error(err?.response?.data?.error || 'Failed to get suggestion');
    }
  }

  async function acceptSuggestion() {
    if (!suggestion) return;
    await assignSowToTrack(suggestion.sow.id, suggestion.suggestedTrackId);
    setSuggestion(null);
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-accent">Statements of Work</h1>
          <p className="text-text-muted text-sm mt-1">
            {isAdmin
              ? 'Drag SOWs onto tracks to assign them, or ask Claude to suggest a track.'
              : 'Scope documents by funding track, versioned automatically on edit.'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isAdmin && clientsQuery.data && clientsQuery.data.length > 1 && (
            <select
              className="input max-w-xs"
              value={selectedClientId || ''}
              onChange={(e) => setSelectedClientId(e.target.value)}
            >
              {clientsQuery.data.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          )}
          {isAdmin && (
            <button className="btn-primary flex items-center gap-1" onClick={addSow}>
              <Plus size={14} /> New SOW
            </button>
          )}
        </div>
      </div>

      {sowsQuery.isLoading && <div className="text-text-muted">Loading…</div>}

      {!isAdmin && (
        <ReadOnlyList sows={sowsQuery.data || []} />
      )}

      {isAdmin && (
        <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-4">
            <div>
              <h2 className="text-xs uppercase tracking-wider text-text-muted mb-2">SOWs</h2>
              <div className="space-y-2">
                {sowsQuery.data?.map((sow) => (
                  <DraggableSowCard
                    key={sow.id}
                    sow={sow}
                    tracks={tracksQuery.data || []}
                    onSuggest={() => handleSuggest(sow)}
                  />
                ))}
                {sowsQuery.data && sowsQuery.data.length === 0 && (
                  <div className="card text-text-muted text-center">No SOWs yet.</div>
                )}
              </div>
            </div>

            <div>
              <h2 className="text-xs uppercase tracking-wider text-text-muted mb-2">Tracks</h2>
              <div className="space-y-2">
                <TrackDropZone
                  id={UNASSIGNED}
                  label="— Unassigned —"
                  sows={(sowsQuery.data || []).filter((s) => !s.trackId)}
                  subtle
                />
                {tracksQuery.data?.map((t) => (
                  <TrackDropZone
                    key={t.id}
                    id={t.id}
                    label={t.title}
                    fundingVehicle={t.fundingVehicle || undefined}
                    sows={(sowsQuery.data || []).filter((s) => s.trackId === t.id)}
                  />
                ))}
              </div>
            </div>
          </div>
        </DndContext>
      )}

      {suggestion && (
        <SuggestionModal
          sowTitle={suggestion.sow.title}
          trackTitle={suggestion.trackTitle}
          rationale={suggestion.rationale}
          onAccept={acceptSuggestion}
          onDismiss={() => setSuggestion(null)}
        />
      )}
    </div>
  );
}

function ReadOnlyList({ sows }: { sows: WorkflowSOW[] }) {
  return (
    <div className="space-y-2">
      {sows.map((sow) => (
        <Link key={sow.id} to={`/sows/${sow.id}`} className="block card-hover">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <FileText size={18} className="mt-0.5 text-accent" />
              <div>
                <div className="font-medium">{sow.title}</div>
                <div className="text-xs text-text-muted mt-1 flex items-center gap-2">
                  <span>v{sow.version}</span>
                  {sow.track && <span>· Track: {sow.track.title}</span>}
                  <span>· Updated {new Date(sow.updatedAt).toLocaleDateString()}</span>
                </div>
              </div>
            </div>
            <StatusBadge status={sow.status} />
          </div>
        </Link>
      ))}
      {sows.length === 0 && <div className="card text-text-muted text-center">No SOWs yet.</div>}
    </div>
  );
}

function DraggableSowCard({
  sow,
  tracks,
  onSuggest,
}: {
  sow: WorkflowSOW;
  tracks: WorkflowTrack[];
  onSuggest: () => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: sow.id });
  const trackTitle = useMemo(() => {
    if (!sow.trackId) return null;
    return sow.track?.title || tracks.find((t) => t.id === sow.trackId)?.title || 'Assigned';
  }, [sow, tracks]);

  return (
    <div
      ref={setNodeRef}
      className={`card ${isDragging ? 'opacity-40' : ''} transition-opacity`}
      style={{ touchAction: 'none' }}
    >
      <div className="flex items-start gap-3">
        <button
          {...listeners}
          {...attributes}
          className="text-text-muted hover:text-accent mt-0.5 cursor-grab active:cursor-grabbing"
          title="Drag to assign"
          aria-label="Drag SOW"
        >
          <GripVertical size={18} />
        </button>
        <FileText size={18} className="mt-0.5 text-accent" />
        <div className="flex-1 min-w-0">
          <Link to={`/sows/${sow.id}`} className="font-medium hover:text-accent">
            {sow.title}
          </Link>
          <div className="flex items-center gap-2 text-xs text-text-muted mt-1 flex-wrap">
            <span>v{sow.version}</span>
            <span>·</span>
            <span className={trackTitle ? 'badge badge-gold' : 'badge badge-muted'}>
              {trackTitle || 'Unassigned'}
            </span>
            <span>· Updated {new Date(sow.updatedAt).toLocaleDateString()}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge status={sow.status} />
          <button
            onClick={onSuggest}
            className="btn-ghost flex items-center gap-1 text-xs px-2 py-1 border border-border rounded hover:border-accent"
            title="Ask Claude to suggest a track"
          >
            <Sparkles size={12} /> Suggest
          </button>
        </div>
      </div>
    </div>
  );
}

function TrackDropZone({
  id,
  label,
  fundingVehicle,
  sows,
  subtle,
}: {
  id: string;
  label: string;
  fundingVehicle?: string;
  sows: WorkflowSOW[];
  subtle?: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div
      ref={setNodeRef}
      className={`rounded-lg border-2 border-dashed p-3 transition-colors ${
        isOver
          ? 'border-accent bg-accent/10'
          : subtle
          ? 'border-border-soft bg-surface/50'
          : 'border-border bg-surface'
      }`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Target size={14} className={subtle ? 'text-text-muted' : 'text-accent'} />
          <span className={`text-sm font-medium ${subtle ? 'text-text-muted' : ''}`}>{label}</span>
        </div>
        {fundingVehicle && <span className="badge badge-gold text-[10px]">{fundingVehicle}</span>}
      </div>
      {sows.length > 0 && (
        <div className="mt-2 space-y-1">
          {sows.map((s) => (
            <div key={s.id} className="text-xs text-text-muted flex items-center gap-1">
              <FileText size={10} /> {s.title} <span>· v{s.version}</span>
            </div>
          ))}
        </div>
      )}
      {sows.length === 0 && (
        <div className="text-xs text-text-muted/60 mt-2 italic">Drop a SOW here</div>
      )}
    </div>
  );
}

function SuggestionModal({
  sowTitle,
  trackTitle,
  rationale,
  onAccept,
  onDismiss,
}: {
  sowTitle: string;
  trackTitle: string;
  rationale: string;
  onAccept: () => void;
  onDismiss: () => void;
}) {
  return (
    <div
      className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50"
      onClick={onDismiss}
    >
      <div
        className="bg-surface border border-border rounded-lg p-6 max-w-lg w-full"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 text-accent mb-1">
          <Sparkles size={16} />
          <span className="text-xs uppercase tracking-wider">Suggestion</span>
        </div>
        <h3 className="text-lg font-semibold mb-1">{sowTitle}</h3>
        <div className="text-text-muted text-sm mb-4">should be assigned to</div>
        <div className="bg-bg-deep border border-border-soft rounded p-3 mb-4">
          <div className="font-medium text-accent mb-2">{trackTitle}</div>
          <p className="text-sm text-text-primary whitespace-pre-wrap">{rationale}</p>
        </div>
        <div className="flex justify-end gap-2">
          <button className="btn-secondary" onClick={onDismiss}>Dismiss</button>
          <button className="btn-primary" onClick={onAccept}>Accept & assign</button>
        </div>
      </div>
    </div>
  );
}
