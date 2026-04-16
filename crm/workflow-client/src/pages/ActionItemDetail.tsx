import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Send } from 'lucide-react';
import toast from 'react-hot-toast';
import { getActionItem, updateActionItem, createComment } from '../api';
import { useAuth } from '../AuthContext';
import { StatusBadge } from './Dashboard';

const STATUSES = ['Todo', 'InProgress', 'Done', 'Blocked'] as const;

export function ActionItemDetail() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const canEdit = user?.workflowRole === 'WorkflowAdmin' || user?.workflowRole === 'WorkflowEditor';
  const qc = useQueryClient();
  const { data: item, isLoading } = useQuery({
    queryKey: ['action-item', id],
    queryFn: () => getActionItem(id!),
    enabled: !!id,
  });

  const [saving, setSaving] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [notes, setNotes] = useState<string>('');

  useEffect(() => {
    if (item) setNotes(item.notes || '');
  }, [item?.id]);

  if (isLoading) return <div className="text-text-muted">Loading…</div>;
  if (!item) return <div className="text-text-muted">Not found</div>;

  async function setStatus(status: string) {
    setSaving(true);
    try {
      await updateActionItem(id!, { status });
      toast.success('Status updated');
      qc.invalidateQueries({ queryKey: ['action-item', id] });
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Failed');
    } finally {
      setSaving(false);
    }
  }

  async function saveNotes() {
    setSaving(true);
    try {
      await updateActionItem(id!, { notes });
      toast.success('Notes saved');
      qc.invalidateQueries({ queryKey: ['action-item', id] });
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Failed');
    } finally {
      setSaving(false);
    }
  }

  async function postComment() {
    if (!newComment.trim()) return;
    try {
      await createComment({ actionItemId: id, content: newComment.trim() });
      setNewComment('');
      qc.invalidateQueries({ queryKey: ['action-item', id] });
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Failed to comment');
    }
  }

  return (
    <div className="max-w-3xl">
      <Link
        to={`/tracks/${item.milestone?.phase?.track?.id || ''}`}
        className="btn-ghost inline-flex items-center gap-1 mb-4"
      >
        <ArrowLeft size={14} /> Back to track
      </Link>

      <div className="card">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-xs text-text-muted">
              {item.milestone?.phase?.track?.title} · {item.milestone?.phase?.title} · {item.milestone?.title}
            </div>
            <h1 className="text-xl font-semibold mt-1">{item.title}</h1>
            <div className="flex items-center gap-3 text-xs text-text-muted mt-2">
              {item.assignedTo && <span>Assigned: <span className="text-text-primary">{item.assignedTo}</span></span>}
              {item.dueDate && <span>Due {new Date(item.dueDate).toLocaleDateString()}</span>}
            </div>
          </div>
          <StatusBadge status={item.status} />
        </div>

        {canEdit && (
          <div className="mt-4">
            <label className="label">Status</label>
            <div className="flex gap-2 flex-wrap">
              {STATUSES.map((s) => (
                <button
                  key={s}
                  onClick={() => setStatus(s)}
                  disabled={saving}
                  className={`px-3 py-1 rounded text-xs border transition-colors ${
                    item.status === s
                      ? 'bg-accent text-bg border-accent'
                      : 'border-border text-text-muted hover:border-accent hover:text-accent'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="mt-4">
          <label className="label">Notes</label>
          {canEdit ? (
            <>
              <textarea
                className="textarea"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add notes, context, blockers…"
              />
              <button className="btn-secondary mt-2" onClick={saveNotes} disabled={saving}>
                Save notes
              </button>
            </>
          ) : (
            <div className="bg-bg-deep border border-border-soft rounded p-3 text-sm whitespace-pre-wrap">
              {item.notes || <span className="text-text-muted italic">No notes</span>}
            </div>
          )}
        </div>
      </div>

      <div className="card mt-4">
        <h3 className="font-medium mb-3">Comments</h3>
        <div className="space-y-3">
          {item.comments?.length ? item.comments.map((c: any) => (
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

        {canEdit && (
          <div className="mt-3 flex gap-2">
            <input
              className="input flex-1"
              placeholder="Write a comment…"
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && postComment()}
            />
            <button className="btn-primary flex items-center gap-1" onClick={postComment}>
              <Send size={14} /> Post
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
