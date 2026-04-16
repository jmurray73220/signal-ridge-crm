import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import MDEditor from '@uiw/react-md-editor';
import { ArrowLeft, Save, Send, History } from 'lucide-react';
import toast from 'react-hot-toast';
import { getSOW, updateSOW, createComment, listTracks } from '../api';
import type { WorkflowTrack } from '../types';
import { useAuth } from '../AuthContext';
import { StatusBadge } from './Dashboard';

export function SOWDetail() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const isAdmin = user?.workflowRole === 'WorkflowAdmin';
  const canComment = isAdmin || user?.workflowRole === 'WorkflowEditor';
  const qc = useQueryClient();

  const { data: sow, isLoading } = useQuery({
    queryKey: ['sow', id],
    queryFn: () => getSOW(id!),
    enabled: !!id,
  });

  const { data: tracks } = useQuery<WorkflowTrack[]>({
    queryKey: ['tracks', sow?.workflowClientId],
    queryFn: () => listTracks(sow!.workflowClientId),
    enabled: !!sow?.workflowClientId,
  });

  const [content, setContent] = useState<string>('');
  const [title, setTitle] = useState<string>('');
  const [status, setStatus] = useState<string>('Draft');
  const [trackId, setTrackId] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [comment, setComment] = useState('');
  const [showVersions, setShowVersions] = useState(false);
  const [viewingVersion, setViewingVersion] = useState<string | null>(null);

  useEffect(() => {
    if (sow) {
      setContent(sow.content || '');
      setTitle(sow.title || '');
      setStatus(sow.status || 'Draft');
      setTrackId(sow.trackId || '');
    }
  }, [sow?.id]);

  if (isLoading) return <div className="text-text-muted">Loading…</div>;
  if (!sow) return <div className="text-text-muted">Not found</div>;

  async function save() {
    setSaving(true);
    try {
      await updateSOW(id!, {
        content,
        title,
        status,
        trackId: trackId || null,
      });
      toast.success('SOW saved');
      qc.invalidateQueries({ queryKey: ['sow', id] });
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Failed');
    } finally {
      setSaving(false);
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

  const viewedVersion = viewingVersion ? sow.versions?.find((v: any) => v.id === viewingVersion) : null;
  const displayContent = viewedVersion ? viewedVersion.content : content;

  return (
    <div>
      <Link to="/sows" className="btn-ghost inline-flex items-center gap-1 mb-4">
        <ArrowLeft size={14} /> Back to SOWs
      </Link>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-4">
        <div>
          <div className="card mb-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1">
                {isAdmin ? (
                  <input
                    className="input text-lg font-semibold"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                  />
                ) : (
                  <h1 className="text-xl font-semibold">{sow.title}</h1>
                )}
                <div className="flex items-center gap-3 text-xs text-text-muted mt-2">
                  <span>v{sow.version}</span>
                  <span>· Updated {new Date(sow.updatedAt).toLocaleString()}</span>
                  {sow.createdBy && <span>· By {sow.createdBy.firstName} {sow.createdBy.lastName}</span>}
                </div>
              </div>
              <StatusBadge status={sow.status} />
            </div>

            {isAdmin && (
              <div className="grid grid-cols-2 gap-3 mt-3">
                <div>
                  <label className="label">Status</label>
                  <select className="input" value={status} onChange={(e) => setStatus(e.target.value)}>
                    <option value="Draft">Draft</option>
                    <option value="Active">Active</option>
                    <option value="Archived">Archived</option>
                  </select>
                </div>
                <div>
                  <label className="label">Assigned Track</label>
                  <select className="input" value={trackId} onChange={(e) => setTrackId(e.target.value)}>
                    <option value="">— Unassigned —</option>
                    {tracks?.map((t) => (
                      <option key={t.id} value={t.id}>{t.title}</option>
                    ))}
                  </select>
                </div>
              </div>
            )}
          </div>

          <div data-color-mode="dark">
            <MDEditor
              value={displayContent}
              onChange={(v) => isAdmin && !viewedVersion && setContent(v || '')}
              height={500}
              preview={isAdmin && !viewedVersion ? 'live' : 'preview'}
            />
          </div>

          {isAdmin && !viewedVersion && (
            <div className="mt-3 flex items-center gap-2">
              <button className="btn-primary flex items-center gap-1" onClick={save} disabled={saving}>
                <Save size={14} /> {saving ? 'Saving…' : 'Save'}
              </button>
              <span className="text-xs text-text-muted">
                Saving with content changes creates a new version automatically.
              </span>
            </div>
          )}
          {viewedVersion && (
            <div className="mt-3 flex items-center gap-2">
              <span className="text-xs text-text-muted">
                Viewing version {viewedVersion.version} (read-only)
              </span>
              <button className="btn-secondary" onClick={() => setViewingVersion(null)}>
                Back to current
              </button>
            </div>
          )}

          {/* Comments */}
          <div className="card mt-4">
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

        {/* Sidebar: Versions */}
        <aside>
          <div className="card">
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
