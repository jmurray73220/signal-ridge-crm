import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Paperclip, Trash2, Upload, FileText, Loader2 } from 'lucide-react';
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

  const { data: attachments = [], isLoading } = useQuery({
    queryKey: ['interaction-attachments', interactionId],
    queryFn: () => interactionsApi.listAttachments(interactionId).then(r => r.data),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => interactionsApi.deleteAttachment(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['interaction-attachments', interactionId] });
      qc.invalidateQueries({ queryKey: ['entity'] });
      qc.invalidateQueries({ queryKey: ['contact'] });
      qc.invalidateQueries({ queryKey: ['interactions'] });
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
      qc.invalidateQueries({ queryKey: ['interaction-attachments', interactionId] });
      qc.invalidateQueries({ queryKey: ['entity'] });
      qc.invalidateQueries({ queryKey: ['contact'] });
      qc.invalidateQueries({ queryKey: ['interactions'] });
      toast.success('Attachment uploaded');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Upload failed');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
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
        )}
        <input
          ref={fileRef}
          type="file"
          className="hidden"
          accept=".pdf,.docx,.txt,.md,.vtt,.srt,.json"
          onChange={handleFile}
        />
      </div>

      {isLoading ? (
        <p className="text-xs" style={{ color: '#8b949e' }}>Loading…</p>
      ) : attachments.length === 0 ? (
        <p className="text-xs italic" style={{ color: '#6b7280' }}>No files attached.</p>
      ) : (
        <div className="space-y-1.5">
          {attachments.map(att => (
            <div
              key={att.id}
              className="flex items-center gap-2 px-2.5 py-2 rounded text-xs"
              style={{ background: '#0d1117', border: '1px solid #30363d' }}
            >
              <FileText size={14} style={{ color: '#8b949e', flexShrink: 0 }} />
              <button
                type="button"
                onClick={() => handleDownload(att)}
                className="flex-1 text-left truncate hover:opacity-80"
                style={{ color: '#e6edf3' }}
                title={att.filename}
              >
                {att.filename}
              </button>
              {att.source && (
                <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: '#1c2333', color: '#8b949e' }}>
                  {att.source}
                </span>
              )}
              {att.sizeBytes !== undefined && (
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
          ))}
        </div>
      )}
    </div>
  );
}
