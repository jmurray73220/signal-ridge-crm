import { useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  Paperclip, Link as LinkIcon, Trash2, Upload, Plus, Loader2,
  ChevronDown, ChevronRight, ExternalLink,
} from 'lucide-react';
import toast from 'react-hot-toast';
import {
  api,
  uploadPhaseAttachment,
  deletePhaseAttachment,
  phaseAttachmentDownloadUrl,
  createPhaseLink,
  deletePhaseLink,
} from '../api';
import type { PhaseAttachment, PhaseLink } from '../types';

interface Props {
  phaseId: string;
  trackId: string;
  attachments: PhaseAttachment[];
  links: PhaseLink[];
  canEdit: boolean;
}

function formatSize(bytes?: number) {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function hostname(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return url; }
}

export function PhaseAssetsPanel({ phaseId, trackId, attachments, links, canEdit }: Props) {
  if (attachments.length === 0 && links.length === 0 && !canEdit) return null;

  return (
    <div className="mt-2 flex flex-wrap gap-2">
      <FilesRow phaseId={phaseId} trackId={trackId} attachments={attachments} canEdit={canEdit} />
      <LinksRow phaseId={phaseId} trackId={trackId} links={links} canEdit={canEdit} />
    </div>
  );
}

// ─── Files row ───────────────────────────────────────────────────────────────

function FilesRow({
  phaseId, trackId, attachments, canEdit,
}: { phaseId: string; trackId: string; attachments: PhaseAttachment[]; canEdit: boolean }) {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [uploading, setUploading] = useState(false);

  const refresh = () => qc.invalidateQueries({ queryKey: ['track', trackId] });

  async function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      await uploadPhaseAttachment(phaseId, file);
      refresh();
      setOpen(true);
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Upload failed');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  async function download(att: PhaseAttachment) {
    try {
      const res = await api.get(phaseAttachmentDownloadUrl(att.id), { responseType: 'blob' });
      const url = URL.createObjectURL(res.data as Blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = att.filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      toast.error('Download failed');
    }
  }

  async function remove(id: string) {
    try {
      await deletePhaseAttachment(id);
      refresh();
    } catch {
      toast.error('Failed to delete');
    }
  }

  const empty = attachments.length === 0;
  if (empty && !canEdit) return null;

  return (
    <div className="rounded text-xs" style={{ background: '#0d1117', border: '1px solid #24375a' }}>
      <div className="flex items-center gap-1 px-2 py-1">
        <button
          type="button"
          onClick={() => !empty && setOpen(o => !o)}
          className={`flex items-center gap-1 ${empty ? 'cursor-default' : 'hover:text-accent'}`}
          style={{ color: empty ? '#6b7280' : '#8b949e' }}
        >
          {!empty && (open ? <ChevronDown size={11} /> : <ChevronRight size={11} />)}
          <Paperclip size={11} />
          <span>{attachments.length} file{attachments.length === 1 ? '' : 's'}</span>
        </button>
        {canEdit && (
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="ml-1 hover:text-accent flex items-center"
            style={{ color: '#c9a84c' }}
            title="Upload file"
          >
            {uploading ? <Loader2 size={11} className="animate-spin" /> : <Upload size={11} />}
          </button>
        )}
        <input ref={fileRef} type="file" className="hidden" onChange={onPickFile} />
      </div>

      {open && !empty && (
        <div className="px-2 pb-1.5 space-y-1" style={{ borderTop: '1px solid #24375a' }}>
          {attachments.map(att => (
            <div key={att.id} className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => download(att)}
                className="flex-1 text-left truncate text-text-primary hover:text-accent"
                title={att.filename}
              >
                {att.filename}
              </button>
              {att.sizeBytes !== undefined && (
                <span className="text-text-muted">{formatSize(att.sizeBytes)}</span>
              )}
              {canEdit && (
                <button
                  type="button"
                  onClick={() => remove(att.id)}
                  className="text-text-muted hover:text-status-red"
                  title="Delete"
                >
                  <Trash2 size={11} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Links row ───────────────────────────────────────────────────────────────

function LinksRow({
  phaseId, trackId, links, canEdit,
}: { phaseId: string; trackId: string; links: PhaseLink[]; canEdit: boolean }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const [linkLabel, setLinkLabel] = useState('');
  const [saving, setSaving] = useState(false);

  const refresh = () => qc.invalidateQueries({ queryKey: ['track', trackId] });

  async function save() {
    if (!linkUrl.trim()) return;
    setSaving(true);
    try {
      await createPhaseLink(phaseId, { url: linkUrl.trim(), label: linkLabel.trim() || undefined });
      setLinkUrl('');
      setLinkLabel('');
      setAdding(false);
      setOpen(true);
      refresh();
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Failed');
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    try {
      await deletePhaseLink(id);
      refresh();
    } catch {
      toast.error('Failed to delete');
    }
  }

  const empty = links.length === 0;
  if (empty && !canEdit) return null;

  return (
    <div className="rounded text-xs" style={{ background: '#0d1117', border: '1px solid #24375a' }}>
      <div className="flex items-center gap-1 px-2 py-1">
        <button
          type="button"
          onClick={() => !empty && setOpen(o => !o)}
          className={`flex items-center gap-1 ${empty ? 'cursor-default' : 'hover:text-accent'}`}
          style={{ color: empty ? '#6b7280' : '#8b949e' }}
        >
          {!empty && (open ? <ChevronDown size={11} /> : <ChevronRight size={11} />)}
          <LinkIcon size={11} />
          <span>{links.length} link{links.length === 1 ? '' : 's'}</span>
        </button>
        {canEdit && (
          <button
            type="button"
            onClick={() => { setAdding(a => !a); setOpen(true); }}
            className="ml-1 hover:text-accent flex items-center"
            style={{ color: '#c9a84c' }}
            title="Add link"
          >
            <Plus size={11} />
          </button>
        )}
      </div>

      {(open || adding) && (
        <div className="px-2 pb-1.5 space-y-1" style={{ borderTop: '1px solid #24375a' }}>
          {adding && (
            <div className="space-y-1 pt-1.5">
              <input
                className="input text-xs"
                value={linkUrl}
                onChange={e => setLinkUrl(e.target.value)}
                placeholder="https://…"
                disabled={saving}
                autoFocus
                style={{ padding: '4px 6px' }}
              />
              <input
                className="input text-xs"
                value={linkLabel}
                onChange={e => setLinkLabel(e.target.value)}
                placeholder="Label (optional)"
                disabled={saving}
                style={{ padding: '4px 6px' }}
              />
              <div className="flex gap-1.5 justify-end">
                <button
                  type="button"
                  onClick={() => { setAdding(false); setLinkUrl(''); setLinkLabel(''); }}
                  className="btn-secondary text-xs"
                  disabled={saving}
                  style={{ padding: '2px 8px' }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={save}
                  className="btn-primary text-xs"
                  disabled={saving || !linkUrl.trim()}
                  style={{ padding: '2px 8px' }}
                >
                  {saving ? '…' : 'Save'}
                </button>
              </div>
            </div>
          )}
          {!empty && open && links.map(link => (
            <div key={link.id} className="flex items-center gap-2 pt-1">
              <ExternalLink size={11} className="text-text-muted shrink-0" />
              <a
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 truncate text-accent hover:opacity-80"
                title={link.url}
              >
                {link.label || hostname(link.url)}
              </a>
              {canEdit && (
                <button
                  type="button"
                  onClick={() => remove(link.id)}
                  className="text-text-muted hover:text-status-red"
                  title="Delete"
                >
                  <Trash2 size={11} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
