import { useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Paperclip, Link as LinkIcon, Trash2, Upload, Plus, Loader2, FileText, ExternalLink } from 'lucide-react';
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
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const [linkLabel, setLinkLabel] = useState('');
  const [savingLink, setSavingLink] = useState(false);

  function refresh() {
    qc.invalidateQueries({ queryKey: ['track', trackId] });
  }

  async function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      await uploadPhaseAttachment(phaseId, file);
      refresh();
      toast.success('File attached');
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

  async function removeAttachment(id: string) {
    try {
      await deletePhaseAttachment(id);
      refresh();
    } catch {
      toast.error('Failed to delete');
    }
  }

  async function saveLink() {
    if (!linkUrl.trim()) return;
    setSavingLink(true);
    try {
      await createPhaseLink(phaseId, { url: linkUrl.trim(), label: linkLabel.trim() || undefined });
      setLinkUrl('');
      setLinkLabel('');
      setLinkOpen(false);
      refresh();
      toast.success('Link added');
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Failed');
    } finally {
      setSavingLink(false);
    }
  }

  async function removeLink(id: string) {
    try {
      await deletePhaseLink(id);
      refresh();
    } catch {
      toast.error('Failed to delete');
    }
  }

  if (attachments.length === 0 && links.length === 0 && !canEdit) return null;

  return (
    <div className="mt-3 rounded p-3" style={{ background: '#0d1117', border: '1px solid #24375a' }}>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-text-muted">
              <Paperclip size={12} /> Files {attachments.length > 0 && `(${attachments.length})`}
            </div>
            {canEdit && (
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className="text-xs flex items-center gap-1 text-accent hover:opacity-80"
              >
                {uploading ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}
                {uploading ? 'Uploading' : 'Add'}
              </button>
            )}
            <input ref={fileRef} type="file" className="hidden" onChange={onPickFile} />
          </div>
          {attachments.length === 0 ? (
            <p className="text-xs italic text-text-muted">None</p>
          ) : (
            <div className="space-y-1">
              {attachments.map(att => (
                <div key={att.id} className="flex items-center gap-2 text-xs">
                  <FileText size={12} className="text-text-muted shrink-0" />
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
                      onClick={() => removeAttachment(att.id)}
                      className="text-text-muted hover:text-status-red"
                      title="Delete"
                    >
                      <Trash2 size={12} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-text-muted">
              <LinkIcon size={12} /> Links {links.length > 0 && `(${links.length})`}
            </div>
            {canEdit && !linkOpen && (
              <button
                type="button"
                onClick={() => setLinkOpen(true)}
                className="text-xs flex items-center gap-1 text-accent hover:opacity-80"
              >
                <Plus size={12} /> Add
              </button>
            )}
          </div>

          {linkOpen && (
            <div className="space-y-1.5 mb-2">
              <input
                className="input text-xs"
                value={linkUrl}
                onChange={e => setLinkUrl(e.target.value)}
                placeholder="https://…"
                disabled={savingLink}
              />
              <input
                className="input text-xs"
                value={linkLabel}
                onChange={e => setLinkLabel(e.target.value)}
                placeholder="Label (optional)"
                disabled={savingLink}
              />
              <div className="flex gap-1.5 justify-end">
                <button
                  type="button"
                  className="btn-secondary text-xs"
                  onClick={() => { setLinkOpen(false); setLinkUrl(''); setLinkLabel(''); }}
                  disabled={savingLink}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn-primary text-xs"
                  onClick={saveLink}
                  disabled={savingLink || !linkUrl.trim()}
                >
                  {savingLink ? '…' : 'Save'}
                </button>
              </div>
            </div>
          )}

          {links.length === 0 ? (
            <p className="text-xs italic text-text-muted">None</p>
          ) : (
            <div className="space-y-1">
              {links.map(link => (
                <div key={link.id} className="flex items-center gap-2 text-xs">
                  <ExternalLink size={12} className="text-text-muted shrink-0" />
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
                      onClick={() => removeLink(link.id)}
                      className="text-text-muted hover:text-status-red"
                      title="Delete"
                    >
                      <Trash2 size={12} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
