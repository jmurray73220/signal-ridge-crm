import { useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { FileText, Upload, Trash2, Loader2, Plus, X, Download, Pencil } from 'lucide-react';
import toast from 'react-hot-toast';
import {
  api,
  listDocuments,
  uploadDocument,
  documentDownloadUrl,
  updateDocument,
  deleteDocument,
} from '../api';
import { useAuth } from '../AuthContext';
import { useClientContext } from '../ClientContext';
import type { WorkflowDocument } from '../types';

function formatSize(bytes?: number) {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  } catch {
    return '';
  }
}

export function Documents() {
  const { user } = useAuth();
  const qc = useQueryClient();
  // Any workflow user may upload/download; only the firm (Admin/Editor) may
  // rename or delete — matches the route middleware on the server.
  const isFirm = user?.workflowRole === 'WorkflowAdmin' || user?.workflowRole === 'WorkflowEditor';
  const { selectedClient, selectedClientId } = useClientContext();

  const docsQuery = useQuery<WorkflowDocument[]>({
    queryKey: ['documents', selectedClientId],
    queryFn: () => listDocuments(selectedClientId!),
    enabled: !!selectedClientId,
  });

  const refresh = () => qc.invalidateQueries({ queryKey: ['documents', selectedClientId] });

  if (!selectedClientId) {
    return (
      <div className="text-sm text-text-muted">Select a client to view its documents.</div>
    );
  }

  const docs = docsQuery.data ?? [];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-text-primary">Documents</h1>
          <p className="text-sm text-text-muted">
            Shared reference files for {selectedClient?.name ?? 'this client'}.
          </p>
        </div>
      </div>

      <UploadPanel workflowClientId={selectedClientId} onUploaded={refresh} />

      {docsQuery.isLoading ? (
        <div className="text-sm text-text-muted flex items-center gap-2">
          <Loader2 size={14} className="animate-spin" /> Loading…
        </div>
      ) : docs.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border py-12 text-center">
          <FileText size={28} className="mx-auto text-text-muted mb-2" />
          <p className="text-sm text-text-muted">No documents yet.</p>
        </div>
      ) : (
        <div className="rounded-lg border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-bg-deep text-left text-xs uppercase tracking-wider text-text-muted">
                <th className="px-4 py-2.5 font-medium">Name</th>
                <th className="px-4 py-2.5 font-medium">Description</th>
                <th className="px-4 py-2.5 font-medium whitespace-nowrap">Size</th>
                <th className="px-4 py-2.5 font-medium whitespace-nowrap">Added</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {docs.map(doc => (
                <DocumentRow key={doc.id} doc={doc} isFirm={isFirm} onChanged={refresh} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function UploadPanel({ workflowClientId, onUploaded }: { workflowClientId: string; onUploaded: () => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [uploading, setUploading] = useState(false);

  function reset() {
    setFile(null);
    setName('');
    setDescription('');
    setOpen(false);
    if (fileRef.current) fileRef.current.value = '';
  }

  function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    if (!name.trim()) setName(f.name);
  }

  async function submit() {
    if (!file) return;
    setUploading(true);
    try {
      await uploadDocument(workflowClientId, file, {
        description: description.trim() || undefined,
        filename: name.trim() || undefined,
      });
      toast.success('Document uploaded');
      reset();
      onUploaded();
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Upload failed');
    } finally {
      setUploading(false);
    }
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="btn-primary flex items-center gap-1.5">
        <Plus size={15} /> Upload document
      </button>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-surface p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium text-text-primary">Upload a document</h2>
        <button type="button" onClick={reset} className="text-text-muted hover:text-text-primary" disabled={uploading}>
          <X size={16} />
        </button>
      </div>

      <div>
        <input ref={fileRef} type="file" className="hidden" onChange={onPickFile} />
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="btn-secondary flex items-center gap-1.5"
          disabled={uploading}
        >
          <Upload size={14} /> {file ? 'Change file' : 'Choose file'}
        </button>
        {file && (
          <span className="ml-3 text-xs text-text-muted">
            {file.name} · {formatSize(file.size)}
          </span>
        )}
      </div>

      <div>
        <label className="block text-xs text-text-muted mb-1">Display name</label>
        <input
          className="input"
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="File name shown in the list"
          disabled={uploading}
        />
      </div>

      <div>
        <label className="block text-xs text-text-muted mb-1">Description</label>
        <textarea
          className="input"
          rows={2}
          value={description}
          onChange={e => setDescription(e.target.value)}
          placeholder="What is this document? (optional)"
          disabled={uploading}
        />
      </div>

      <div className="flex justify-end gap-2">
        <button type="button" onClick={reset} className="btn-secondary" disabled={uploading}>
          Cancel
        </button>
        <button type="button" onClick={submit} className="btn-primary flex items-center gap-1.5" disabled={uploading || !file}>
          {uploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />} Upload
        </button>
      </div>
    </div>
  );
}

function DocumentRow({ doc, isFirm, onChanged }: { doc: WorkflowDocument; isFirm: boolean; onChanged: () => void }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(doc.filename);
  const [description, setDescription] = useState(doc.description ?? '');
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState(false);

  async function download() {
    setBusy(true);
    try {
      const res = await api.get(documentDownloadUrl(doc.id), { responseType: 'blob' });
      const url = URL.createObjectURL(res.data as Blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = doc.filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      toast.error('Download failed');
    } finally {
      setBusy(false);
    }
  }

  async function saveEdit() {
    setSaving(true);
    try {
      await updateDocument(doc.id, { filename: name.trim() || doc.filename, description });
      setEditing(false);
      onChanged();
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!window.confirm(`Delete "${doc.filename}"? This cannot be undone.`)) return;
    try {
      await deleteDocument(doc.id);
      onChanged();
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Failed to delete');
    }
  }

  if (editing) {
    return (
      <tr className="border-t border-border">
        <td className="px-4 py-2">
          <input className="input" value={name} onChange={e => setName(e.target.value)} disabled={saving} />
        </td>
        <td className="px-4 py-2" colSpan={2}>
          <input
            className="input"
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="Description"
            disabled={saving}
          />
        </td>
        <td className="px-4 py-2 whitespace-nowrap" colSpan={2}>
          <div className="flex gap-1.5 justify-end">
            <button type="button" onClick={() => setEditing(false)} className="btn-secondary text-xs" disabled={saving}>
              Cancel
            </button>
            <button type="button" onClick={saveEdit} className="btn-primary text-xs" disabled={saving}>
              {saving ? '…' : 'Save'}
            </button>
          </div>
        </td>
      </tr>
    );
  }

  return (
    <tr className="border-t border-border hover:bg-bg-deep/40">
      <td className="px-4 py-2.5">
        <button
          type="button"
          onClick={download}
          disabled={busy}
          className="flex items-center gap-2 text-left text-text-primary hover:text-accent"
          title="Download"
        >
          {busy ? <Loader2 size={14} className="animate-spin shrink-0" /> : <FileText size={14} className="text-text-muted shrink-0" />}
          <span className="truncate max-w-xs">{doc.filename}</span>
        </button>
      </td>
      <td className="px-4 py-2.5 text-text-muted">{doc.description || <span className="opacity-50">—</span>}</td>
      <td className="px-4 py-2.5 text-text-muted whitespace-nowrap">{formatSize(doc.sizeBytes)}</td>
      <td className="px-4 py-2.5 text-text-muted whitespace-nowrap">
        {formatDate(doc.uploadedAt)}
        {doc.uploadedByName && <span className="block text-xs opacity-70">by {doc.uploadedByName}</span>}
      </td>
      <td className="px-4 py-2.5 whitespace-nowrap">
        <div className="flex items-center gap-2 justify-end">
          <button type="button" onClick={download} disabled={busy} className="text-text-muted hover:text-accent" title="Download">
            <Download size={14} />
          </button>
          {isFirm && (
            <>
              <button type="button" onClick={() => setEditing(true)} className="text-text-muted hover:text-accent" title="Rename / edit">
                <Pencil size={14} />
              </button>
              <button type="button" onClick={remove} className="text-text-muted hover:text-status-red" title="Delete">
                <Trash2 size={14} />
              </button>
            </>
          )}
        </div>
      </td>
    </tr>
  );
}
