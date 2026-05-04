import { useState, useEffect, useRef, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Upload, Trash2, FileText, X, Tag as TagIcon, Loader2, Plus } from 'lucide-react';
import { briefingDocsApi, entitiesApi, initiativesApi } from '../api';
import { AutocompleteField } from './Autocomplete';
import toast from 'react-hot-toast';

function fmtDate(d?: string | null) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

interface Props {
  officeId?: string;
  clientId?: string;
}

export function BriefingDocsTab({ officeId, clientId }: Props) {
  const qc = useQueryClient();
  const [showUpload, setShowUpload] = useState(false);

  const fixed: 'office' | 'client' = officeId ? 'office' : 'client';
  const otherCol = fixed === 'office' ? 'Client' : 'Office';
  const filterId = officeId || clientId || '';

  const { data: docs = [], isLoading } = useQuery({
    queryKey: ['briefingDocs', fixed, filterId],
    queryFn: () => briefingDocsApi.list({ officeId, clientId }).then(r => r.data),
    enabled: !!filterId,
  });

  const del = useMutation({
    mutationFn: (id: string) => briefingDocsApi.delete(id),
    onSuccess: () => {
      // Invalidate any briefingDocs query — both sides re-fetch automatically
      qc.invalidateQueries({ queryKey: ['briefingDocs'] });
      qc.invalidateQueries({ queryKey: ['briefingDocTags'] });
      toast.success('Briefing removed');
    },
    onError: () => toast.error('Failed to delete'),
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-base font-semibold" style={{ color: '#e6edf3' }}>Past Briefings</h3>
          <p className="text-xs mt-0.5" style={{ color: '#8b949e' }}>
            {fixed === 'office'
              ? 'Upload prior briefings used at this office. They feed into AI generation for any future briefing prepared for the same client.'
              : 'Upload prior briefings prepared for this client. They feed into AI generation for any future briefing for this client at any office.'}
          </p>
        </div>
        <button onClick={() => setShowUpload(true)} className="btn-primary flex items-center gap-1.5 text-sm">
          <Upload size={14} /> Upload Briefing
        </button>
      </div>

      {isLoading ? (
        <div className="text-center py-8 text-sm" style={{ color: '#8b949e' }}>Loading…</div>
      ) : docs.length === 0 ? (
        <div className="rounded-lg p-6 text-center text-sm" style={{
          background: 'rgba(255,255,255,0.02)',
          border: '1px dashed #30363d',
          color: '#8b949e',
        }}>
          {fixed === 'office'
            ? 'No past briefings on file at this office yet.'
            : 'No past briefings on file for this client yet.'}
        </div>
      ) : (
        <div className="rounded-lg overflow-hidden" style={{ border: '1px solid #30363d' }}>
          <table className="w-full text-sm">
            <thead style={{ background: 'rgba(255,255,255,0.02)' }}>
              <tr>
                <Th>File</Th>
                <Th>{otherCol}</Th>
                <Th>Meeting Date</Th>
                <Th>Tags</Th>
                <Th>Uploaded</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {docs.map(d => (
                <tr key={d.id} style={{ borderTop: '1px solid #30363d' }}>
                  <Td>
                    <div className="flex items-center gap-2"><FileText size={13} style={{ color: '#8b949e' }} />{d.filename}</div>
                    {d.initiative && (
                      <div className="text-xs ml-5 mt-0.5" style={{ color: '#8b949e' }}>
                        ↳ {d.initiative.title}
                      </div>
                    )}
                  </Td>
                  <Td>{(fixed === 'office' ? d.client?.name : d.office?.name) || '—'}</Td>
                  <Td>{fmtDate(d.meetingDate)}</Td>
                  <Td>
                    {d.tags.length === 0 ? '—' : (
                      <div className="flex flex-wrap gap-1">
                        {d.tags.map(t => <Pill key={t}>{t}</Pill>)}
                      </div>
                    )}
                  </Td>
                  <Td>{fmtDate(d.uploadedAt)}</Td>
                  <Td>
                    <button
                      onClick={() => { if (confirm(`Delete "${d.filename}"?`)) del.mutate(d.id); }}
                      className="opacity-60 hover:opacity-100"
                      style={{ color: '#da3633' }}
                      title="Delete"
                    >
                      <Trash2 size={14} />
                    </button>
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showUpload && (
        <UploadModal
          officeId={officeId}
          clientId={clientId}
          fixed={fixed}
          onClose={() => setShowUpload(false)}
          onUploaded={() => {
            qc.invalidateQueries({ queryKey: ['briefingDocs'] });
            qc.invalidateQueries({ queryKey: ['briefingDocTags'] });
            setShowUpload(false);
          }}
        />
      )}
    </div>
  );
}

// Back-compat alias for any older imports
export const OfficeBriefingDocs = BriefingDocsTab;

function Th({ children }: { children?: React.ReactNode }) {
  return (
    <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wide" style={{ color: '#8b949e' }}>
      {children}
    </th>
  );
}
function Td({ children }: { children?: React.ReactNode }) {
  return <td className="px-3 py-2" style={{ color: '#e6edf3' }}>{children}</td>;
}
function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs" style={{
      background: 'rgba(201,168,76,0.12)',
      color: '#c9a84c',
      border: '1px solid rgba(201,168,76,0.4)',
    }}>{children}</span>
  );
}

// ─── Upload Modal ────────────────────────────────────────────────────────────

function UploadModal({
  officeId,
  clientId,
  fixed,
  onClose,
  onUploaded,
}: {
  officeId?: string;
  clientId?: string;
  fixed: 'office' | 'client';
  onClose: () => void;
  onUploaded: () => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [pickedClientId, setPickedClientId] = useState(clientId || '');
  const [pickedOfficeId, setPickedOfficeId] = useState(officeId || '');
  const [pickedInitiativeId, setPickedInitiativeId] = useState('');
  const [meetingDate, setMeetingDate] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);

  const { data: allEntities = [] } = useQuery({
    queryKey: ['entities'],
    queryFn: () => entitiesApi.list().then(r => r.data),
  });
  const { data: tagBank = [] } = useQuery({
    queryKey: ['briefingDocTags'],
    queryFn: () => briefingDocsApi.tags().then(r => r.data),
  });
  const { data: allInitiatives = [] } = useQuery({
    queryKey: ['initiatives'],
    queryFn: () => initiativesApi.list().then(r => r.data),
  });

  const clients = useMemo(() => allEntities.filter(e => e.entityType === 'Client'), [allEntities]);
  const offices = useMemo(
    () => allEntities.filter(e => e.entityType === 'CongressionalOffice' || e.entityType === 'GovernmentOrganization'),
    [allEntities]
  );
  // Prioritize initiatives owned by the picked client, then everything else
  const initiativesSorted = useMemo(() => {
    const list = [...allInitiatives];
    list.sort((a: any, b: any) => {
      const aMine = a.primaryEntityId === pickedClientId ? 0 : 1;
      const bMine = b.primaryEntityId === pickedClientId ? 0 : 1;
      if (aMine !== bMine) return aMine - bMine;
      return a.title.localeCompare(b.title);
    });
    return list;
  }, [allInitiatives, pickedClientId]);

  const submit = async () => {
    if (!file) { toast.error('Pick a file first'); return; }
    if (!pickedClientId) { toast.error('Tag a client'); return; }
    if (!pickedOfficeId) { toast.error('Tag an office'); return; }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('officeId', pickedOfficeId);
      fd.append('clientId', pickedClientId);
      if (pickedInitiativeId) fd.append('initiativeId', pickedInitiativeId);
      if (meetingDate) fd.append('meetingDate', meetingDate);
      fd.append('tags', JSON.stringify(tags));
      await briefingDocsApi.upload(fd);
      toast.success('Briefing uploaded');
      onUploaded();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  // The "fixed" side is locked (you came from that page); only the OTHER
  // side gets a picker.
  const showClientPicker = fixed === 'office'; // came from office, pick client
  const showOfficePicker = fixed === 'client'; // came from client, pick office

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.85)' }}>
      <div className="w-full max-w-2xl rounded-xl overflow-hidden" style={{ background: '#1c2333', border: '1px solid #30363d' }}>
        <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid #30363d' }}>
          <h2 className="text-base font-semibold" style={{ color: '#e6edf3' }}>Upload Past Briefing</h2>
          <button onClick={onClose} style={{ color: '#8b949e' }}><X size={18} /></button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="label">File (.pdf, .docx, .txt) *</label>
            <input
              type="file"
              accept=".pdf,.docx,.txt,.md"
              onChange={e => setFile(e.target.files?.[0] || null)}
              className="block w-full text-sm"
              style={{ color: '#e6edf3' }}
            />
            {file && (
              <div className="text-xs mt-1" style={{ color: '#8b949e' }}>
                {file.name} · {(file.size / 1024).toFixed(0)} KB
              </div>
            )}
          </div>

          {showClientPicker && (
            <AutocompleteField
              label="Client this briefing was for"
              placeholder="Start typing client name…"
              required
              items={clients.map(c => ({ id: c.id, display: c.name }))}
              value={pickedClientId}
              onChange={setPickedClientId}
            />
          )}

          {showOfficePicker && (
            <AutocompleteField
              label="Office the meeting was with"
              placeholder="Start typing office name…"
              required
              items={offices.map(o => ({ id: o.id, display: o.name }))}
              value={pickedOfficeId}
              onChange={setPickedOfficeId}
            />
          )}

          <AutocompleteField
            label="Initiative (optional)"
            placeholder={pickedClientId ? "Start typing initiative title…" : "Pick a client first to see their initiatives"}
            items={initiativesSorted.map((i: any) => ({
              id: i.id,
              display: i.primaryEntity?.name && i.primaryEntityId !== pickedClientId
                ? `${i.title} — ${i.primaryEntity.name}`
                : i.title,
            }))}
            value={pickedInitiativeId}
            onChange={setPickedInitiativeId}
          />

          <div>
            <label className="label">Meeting Date (optional)</label>
            <input
              type="date"
              className="input"
              value={meetingDate}
              onChange={e => setMeetingDate(e.target.value)}
            />
          </div>

          <TagInput tags={tags} onChange={setTags} bank={tagBank} />
        </div>
        <div className="flex items-center justify-end gap-2 px-6 py-4" style={{ borderTop: '1px solid #30363d' }}>
          <button onClick={onClose} className="btn-secondary text-sm">Cancel</button>
          <button
            onClick={submit}
            disabled={uploading || !file || !pickedClientId || !pickedOfficeId}
            className="btn-primary flex items-center gap-1.5 text-sm"
          >
            {uploading ? <><Loader2 size={14} className="animate-spin" /> Uploading…</> : <><Upload size={14} /> Upload</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Tag input with bank autocomplete ────────────────────────────────────────

function TagInput({
  tags,
  onChange,
  bank,
}: {
  tags: string[];
  onChange: (t: string[]) => void;
  bank: string[];
}) {
  const [input, setInput] = useState('');
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const suggestions = bank
    .filter(b => !tags.includes(b))
    .filter(b => !input || b.toLowerCase().includes(input.toLowerCase()))
    .slice(0, 12);

  const add = (t: string) => {
    const trimmed = t.trim();
    if (!trimmed || tags.includes(trimmed)) return;
    onChange([...tags, trimmed]);
    setInput('');
  };
  const remove = (t: string) => onChange(tags.filter(x => x !== t));

  return (
    <div ref={ref} className="relative">
      <label className="label flex items-center gap-1"><TagIcon size={12} /> Tags (optional)</label>
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-1.5">
          {tags.map(t => (
            <span key={t} className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs" style={{
              background: 'rgba(201,168,76,0.15)', color: '#c9a84c', border: '1px solid #c9a84c',
            }}>
              {t}
              <button type="button" onClick={() => remove(t)} className="opacity-70 hover:opacity-100">
                <X size={11} />
              </button>
            </span>
          ))}
        </div>
      )}
      <input
        className="input"
        value={input}
        onChange={e => { setInput(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onKeyDown={e => {
          if (e.key === 'Enter' || e.key === ',') {
            e.preventDefault();
            if (input.trim()) add(input);
          } else if (e.key === 'Backspace' && !input && tags.length) {
            remove(tags[tags.length - 1]);
          }
        }}
        placeholder='Type a tag and press Enter, or pick from below'
      />
      {open && (suggestions.length > 0 || (input.trim() && !bank.includes(input.trim()))) && (
        <div
          className="absolute z-50 w-full mt-1 max-h-48 overflow-y-auto rounded-lg shadow-lg"
          style={{ background: '#1c2333', border: '1px solid #30363d' }}
        >
          {input.trim() && !bank.some(b => b.toLowerCase() === input.trim().toLowerCase()) && !tags.includes(input.trim()) && (
            <button
              type="button"
              onClick={() => { add(input); setOpen(false); }}
              className="w-full text-left px-3 py-2 text-sm transition-colors hover:bg-white/5 flex items-center gap-2"
              style={{ color: '#c9a84c', borderBottom: '1px solid #30363d', fontWeight: 500 }}
            >
              <Plus size={12} /> Add "{input.trim()}" as new tag
            </button>
          )}
          {suggestions.length > 0 && (
            <>
              <div className="px-3 py-1.5 text-xs uppercase tracking-wide" style={{ color: '#8b949e', borderBottom: '1px solid #30363d' }}>
                Tag bank
              </div>
              {suggestions.map(s => (
                <button
                  key={s}
                  type="button"
                  onClick={() => { add(s); setOpen(false); }}
                  className="w-full text-left px-3 py-2 text-sm transition-colors hover:bg-white/5"
                  style={{ color: '#e6edf3', borderBottom: '1px solid #30363d' }}
                >
                  {s}
                </button>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}
