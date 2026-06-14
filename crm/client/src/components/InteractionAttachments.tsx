import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Paperclip, Trash2, Upload, FileText, Loader2, Link2, ExternalLink } from 'lucide-react';
import { interactionsApi, type InteractionAttachment } from '../api';
import api from '../api/client';
import toast from 'react-hot-toast';

interface Props {
  interactionId: string;
  canEdit: boolean;
}

function formatSize(bytes?: number) {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function InteractionAttachments({ interactionId, canEdit }: Props) {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [showLinkForm, setShowLinkForm] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const [linkTitle, setLinkTitle] = useState('');
  const [addingLink, setAddingLink] = useState(false);

  const { data: attachments = [], isLoading } = useQuery({
    queryKey: ['interaction-attachments', interactionId],
    queryFn: () => interactionsApi.listAttachments(interactionId).then(r => r.data),
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['interaction-attachments', interactionId] });
    qc.invalidateQueries({ queryKey: ['entity'] });
    qc.invalidateQueries({ queryKey: ['contact'] });
    qc.invalidateQueries({ queryKey: ['interactions'] });
  };

  const deleteMut = useMutation({
    mutationFn: (id: string) => interactionsApi.deleteAttachment(id),
    onSuccess: () => {
      invalidate();
      toast.success('Attachment deleted');
    },
    onError: () => toast.error('Failed to delete'),
  });

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      await interactionsApi.uploadAttachment(interactionId, file);
      invalidate();
      toast.success('Attachment uploaded');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Upload failed');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const handleAddLink = async () => {
    const url = linkUrl.trim();
    if (!/^https?:\/\//i.test(url)) {
      toast.error('Enter a valid link starting with http(s)://');
      return;
    }
    setAddingLink(true);
    try {
      await interactionsApi.addLink(interactionId, url, linkTitle.trim() || undefined);
      invalidate();
      setLinkUrl('');
      setLinkTitle('');
      setShowLinkForm(false);
      toast.success('Link added');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to add link');
    } finally {
      setAddingLink(false);
    }
  };

  const handleDownload = async (att: InteractionAttachment) => {
    try {
      const res = await api.get(interactionsApi.attachmentDownloadUrl(att.id), { responseType: 'blob' });
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
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider" style={{ color: '#8b949e' }}>
          <Paperclip size={12} /> Attachments {attachments.length > 0 && `(${attachments.length})`}
        </div>
        {canEdit && (
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="flex items-center gap-1 text-xs hover:opacity-80"
              style={{ color: '#c9a84c' }}
            >
              {uploading ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}
              {uploading ? 'Uploading…' : 'Add file'}
            </button>
            <button
              type="button"
              onClick={() => setShowLinkForm(v => !v)}
              className="flex items-center gap-1 text-xs hover:opacity-80"
              style={{ color: '#c9a84c' }}
            >
              <Link2 size={12} /> Add Drive link
            </button>
          </div>
        )}
        <input
          ref={fileRef}
          type="file"
          className="hidden"
          accept=".pdf,.docx,.doc,.txt,.md,.vtt,.srt,.json"
          onChange={handleFile}
        />
      </div>

      {showLinkForm && canEdit && (
        <div className="mb-2 p-2.5 rounded space-y-2" style={{ background: '#0d1117', border: '1px solid #30363d' }}>
          <input
            type="url"
            value={linkUrl}
            onChange={e => setLinkUrl(e.target.value)}
            placeholder="Paste a Google Drive (or other) share link…"
            className="w-full text-xs px-2 py-1.5 rounded"
            style={{ background: '#161b22', border: '1px solid #30363d', color: '#e6edf3' }}
            autoFocus
          />
          <input
            type="text"
            value={linkTitle}
            onChange={e => setLinkTitle(e.target.value)}
            placeholder="Optional label (e.g. Q2 Strategy Deck)"
            className="w-full text-xs px-2 py-1.5 rounded"
            style={{ background: '#161b22', border: '1px solid #30363d', color: '#e6edf3' }}
            onKeyDown={e => { if (e.key === 'Enter') handleAddLink(); }}
          />
          <div className="flex items-center gap-2 justify-end">
            <button
              type="button"
              onClick={() => { setShowLinkForm(false); setLinkUrl(''); setLinkTitle(''); }}
              className="text-xs px-2 py-1 hover:opacity-80"
              style={{ color: '#8b949e' }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleAddLink}
              disabled={addingLink}
              className="flex items-center gap-1 text-xs px-2.5 py-1 rounded hover:opacity-90"
              style={{ background: '#c9a84c', color: '#0d1117' }}
            >
              {addingLink ? <Loader2 size={12} className="animate-spin" /> : <Link2 size={12} />}
              Add link
            </button>
          </div>
        </div>
      )}

      {isLoading ? (
        <p className="text-xs" style={{ color: '#8b949e' }}>Loading…</p>
      ) : attachments.length === 0 ? (
        <p className="text-xs italic" style={{ color: '#6b7280' }}>No files attached.</p>
      ) : (
        <div className="space-y-1.5">
          {attachments.map(att => {
            const isLink = Boolean(att.url);
            return (
              <div
                key={att.id}
                className="flex items-center gap-2 px-2.5 py-2 rounded text-xs"
                style={{ background: '#0d1117', border: '1px solid #30363d' }}
              >
                {isLink ? (
                  <Link2 size={14} style={{ color: '#c9a84c', flexShrink: 0 }} />
                ) : (
                  <FileText size={14} style={{ color: '#8b949e', flexShrink: 0 }} />
                )}
                {isLink ? (
                  <a
                    href={att.url!}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 flex items-center gap-1 truncate hover:opacity-80"
                    style={{ color: '#e6edf3' }}
                    title={att.url!}
                  >
                    <span className="truncate">{att.filename}</span>
                    <ExternalLink size={11} style={{ color: '#8b949e', flexShrink: 0 }} />
                  </a>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleDownload(att)}
                    className="flex-1 text-left truncate hover:opacity-80"
                    style={{ color: '#e6edf3' }}
                    title={att.filename}
                  >
                    {att.filename}
                  </button>
                )}
                {att.source && (
                  <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: '#1c2333', color: '#8b949e' }}>
                    {att.source}
                  </span>
                )}
                {!isLink && att.sizeBytes !== undefined && (
                  <span style={{ color: '#6b7280' }}>{formatSize(att.sizeBytes)}</span>
                )}
                {canEdit && (
                  <button
                    type="button"
                    onClick={() => deleteMut.mutate(att.id)}
                    className="hover:opacity-80"
                    style={{ color: '#6b7280' }}
                    title="Delete attachment"
                  >
                    <Trash2 size={12} />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
