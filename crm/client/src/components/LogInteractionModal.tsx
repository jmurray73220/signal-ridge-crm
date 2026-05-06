import React, { useState, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { X, Mail, ExternalLink, Loader2, Paperclip, Trash2 } from 'lucide-react';
import { interactionsApi, contactsApi, entitiesApi, initiativesApi, gmailApi } from '../api';
import toast from 'react-hot-toast';

const INTERACTION_TYPES = ['Meeting', 'Call', 'Email', 'Hearing', 'Briefing', 'Event', 'Other'];

interface Props {
  defaultContactId?: string;
  defaultEntityId?: string;
  defaultInitiativeId?: string;
  onClose: () => void;
  onSave: () => void;
}

export function LogInteractionModal({ defaultContactId, defaultEntityId, defaultInitiativeId, onClose, onSave }: Props) {
  const [form, setForm] = useState({
    type: 'Meeting',
    date: new Date().toISOString().split('T')[0],
    subject: '',
    notes: '',
    entityId: defaultEntityId || '',
    initiativeId: defaultInitiativeId || '',
    contactIds: defaultContactId ? [defaultContactId] : [] as string[],
    gmailThreadUrl: '',
  });
  const [loading, setLoading] = useState(false);
  const [contactSearch, setContactSearch] = useState('');
  const [showGmail, setShowGmail] = useState(false);
  const [gmailQuery, setGmailQuery] = useState('');
  const [gmailThreads, setGmailThreads] = useState<any[]>([]);
  const [gmailLoading, setGmailLoading] = useState(false);
  const [gmailError, setGmailError] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: contacts = [] } = useQuery({
    queryKey: ['contacts'],
    queryFn: () => contactsApi.list().then(r => r.data),
  });

  const { data: entities = [] } = useQuery({
    queryKey: ['entities'],
    queryFn: () => entitiesApi.list().then(r => r.data),
  });

  const { data: initiatives = [] } = useQuery({
    queryKey: ['initiatives'],
    queryFn: () => initiativesApi.list().then(r => r.data),
  });

  const set = (key: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm(f => ({ ...f, [key]: e.target.value }));

  const toggleContact = (id: string) =>
    setForm(f => ({
      ...f,
      contactIds: f.contactIds.includes(id)
        ? f.contactIds.filter(c => c !== id)
        : [...f.contactIds, id],
    }));

  const filteredContacts = contacts.filter(c => {
    if (!contactSearch) return true;
    const q = contactSearch.toLowerCase();
    return `${c.firstName} ${c.lastName}`.toLowerCase().includes(q) || c.title?.toLowerCase().includes(q);
  });

  const searchGmail = async () => {
    if (!gmailQuery) return;
    setGmailLoading(true);
    setGmailError('');
    try {
      const res = await gmailApi.search(gmailQuery);
      setGmailThreads(res.data as any[]);
    } catch (err: any) {
      if (err.response?.data?.needsAuth) {
        // Need to connect Gmail
        setGmailError('Gmail not connected. Click "Connect Gmail" to authorize.');
      } else {
        setGmailError('Failed to search Gmail.');
      }
    } finally {
      setGmailLoading(false);
    }
  };

  const importThread = async (threadId: string, _threadSnippet: string) => {
    setGmailLoading(true);
    try {
      const res = await gmailApi.getThread(threadId);
      const thread = res.data as any;
      const messages = thread.messages || [];
      const firstMsg = messages[0];
      if (firstMsg) {
        const headers = firstMsg.payload?.headers || [];
        const subject = headers.find((h: any) => h.name === 'Subject')?.value || 'Email Thread';
        const date = headers.find((h: any) => h.name === 'Date')?.value;
        const parsedDate = date ? new Date(date).toISOString().split('T')[0] : form.date;

        // Extract body text
        let body = '';
        const parts = firstMsg.payload?.parts || [];
        for (const part of parts) {
          if (part.mimeType === 'text/plain' && part.body?.data) {
            body = atob(part.body.data.replace(/-/g, '+').replace(/_/g, '/'));
            break;
          }
        }
        if (!body && firstMsg.payload?.body?.data) {
          body = atob(firstMsg.payload.body.data.replace(/-/g, '+').replace(/_/g, '/'));
        }

        setForm(f => ({
          ...f,
          type: 'Email',
          date: parsedDate,
          subject,
          notes: body.slice(0, 3000),
          gmailThreadUrl: `https://mail.google.com/mail/u/0/#inbox/${threadId}`,
        }));
        setShowGmail(false);
        setGmailThreads([]);
        setGmailQuery('');
      }
    } catch {
      setGmailError('Failed to import thread.');
    } finally {
      setGmailLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.subject || !form.date) {
      toast.error('Date and subject required');
      return;
    }
    setLoading(true);
    try {
      const res = await interactionsApi.create({
        ...form,
        entityId: form.entityId || null,
        initiativeId: form.initiativeId || null,
        gmailThreadUrl: form.gmailThreadUrl || null,
      });
      const interactionId = (res.data as any)?.id;
      if (interactionId && files.length > 0) {
        const failed: string[] = [];
        for (const file of files) {
          try {
            await interactionsApi.uploadAttachment(interactionId, file);
          } catch {
            failed.push(file.name);
          }
        }
        if (failed.length > 0) {
          toast.error(`Failed to upload: ${failed.join(', ')}`);
        }
      }
      onSave();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to log interaction');
    } finally {
      setLoading(false);
    }
  };

  const addFiles = (list: FileList | null) => {
    if (!list) return;
    const next: File[] = [];
    for (let i = 0; i < list.length; i++) next.push(list[i]);
    setFiles(prev => [...prev, ...next]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)' }}>
      <div className="w-full max-w-2xl rounded-xl overflow-hidden" style={{ background: '#1c2333', border: '1px solid #30363d', maxHeight: '90vh', overflowY: 'auto' }}>
        <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid #30363d' }}>
          <h2 className="text-base font-semibold" style={{ color: '#e6edf3' }}>Log Interaction</h2>
          <button onClick={onClose} style={{ color: '#8b949e' }}><X size={18} /></button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Type *</label>
              <select className="input" value={form.type} onChange={set('type')}>
                {INTERACTION_TYPES.map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Date *</label>
              <input type="date" className="input" value={form.date} onChange={set('date')} required />
            </div>
          </div>

          <div>
            <label className="label">Subject *</label>
            <input className="input" value={form.subject} onChange={set('subject')} placeholder="Meeting summary or email subject…" required />
          </div>

          <div>
            <label className="label">Notes (markdown supported)</label>
            <textarea
              className="input"
              value={form.notes}
              onChange={set('notes')}
              rows={6}
              placeholder="Key takeaways, action items, attendees…"
              style={{ resize: 'vertical', fontFamily: 'monospace' }}
            />
          </div>

          <div>
            <label className="label">Organization (optional)</label>
            <select className="input" value={form.entityId} onChange={set('entityId')}>
              <option value="">— None —</option>
              {entities.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
            </select>
          </div>

          <div>
            <label className="label">Initiative (optional)</label>
            <select className="input" value={form.initiativeId} onChange={set('initiativeId')}>
              <option value="">— None —</option>
              {initiatives.map(i => <option key={i.id} value={i.id}>{i.title}</option>)}
            </select>
          </div>

          <div>
            <label className="label">Contacts</label>
            <input
              className="input mb-2"
              placeholder="Search contacts…"
              value={contactSearch}
              onChange={e => setContactSearch(e.target.value)}
            />
            <div className="max-h-40 overflow-y-auto rounded border" style={{ borderColor: '#30363d' }}>
              {filteredContacts.map(c => (
                <label
                  key={c.id}
                  className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-bg transition-colors"
                >
                  <input
                    type="checkbox"
                    checked={form.contactIds.includes(c.id)}
                    onChange={() => toggleContact(c.id)}
                    className="rounded"
                    style={{ accentColor: '#c9a84c' }}
                  />
                  <span className="text-sm" style={{ color: '#e6edf3' }}>
                    {c.rank && `${c.rank} `}{c.firstName} {c.lastName}
                  </span>
                  {c.title && <span className="text-xs" style={{ color: '#8b949e' }}>{c.title}</span>}
                </label>
              ))}
            </div>
            {form.contactIds.length > 0 && (
              <div className="mt-1.5 text-xs" style={{ color: '#8b949e' }}>
                {form.contactIds.length} contact{form.contactIds.length !== 1 ? 's' : ''} selected
              </div>
            )}
          </div>

          <div>
            <label className="label">Gmail Thread URL (optional)</label>
            <input type="url" className="input" value={form.gmailThreadUrl} onChange={set('gmailThreadUrl')} placeholder="https://mail.google.com/…" />
          </div>

          {/* Attachments — meeting transcripts, notes, etc. */}
          <div>
            <label className="label flex items-center gap-1.5">
              <Paperclip size={12} /> Attachments (meeting notes, transcripts…)
            </label>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".pdf,.docx,.txt,.md,.vtt,.srt,.json"
              className="hidden"
              onChange={e => addFiles(e.target.files)}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="btn-secondary text-sm flex items-center gap-1.5"
            >
              <Paperclip size={14} /> Add file
            </button>
            {files.length > 0 && (
              <div className="mt-2 space-y-1.5">
                {files.map((f, idx) => (
                  <div
                    key={`${f.name}-${idx}`}
                    className="flex items-center gap-2 px-2.5 py-1.5 rounded text-xs"
                    style={{ background: '#0d1117', border: '1px solid #30363d' }}
                  >
                    <span className="flex-1 truncate" style={{ color: '#e6edf3' }}>{f.name}</span>
                    <span style={{ color: '#6b7280' }}>{(f.size / 1024).toFixed(1)} KB</span>
                    <button
                      type="button"
                      onClick={() => setFiles(prev => prev.filter((_, i) => i !== idx))}
                      style={{ color: '#6b7280' }}
                      title="Remove"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Gmail Import */}
          <div className="pt-2" style={{ borderTop: '1px solid #30363d' }}>
            <button
              type="button"
              onClick={() => setShowGmail(s => !s)}
              className="flex items-center gap-1.5 text-sm"
              style={{ color: '#8b949e' }}
            >
              <Mail size={14} /> Import from Gmail
            </button>

            {showGmail && (
              <div className="mt-3 p-4 rounded-lg" style={{ background: '#0d1117', border: '1px solid #30363d' }}>
                <div className="flex gap-2 mb-3">
                  <input
                    className="input flex-1"
                    value={gmailQuery}
                    onChange={e => setGmailQuery(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && searchGmail()}
                    placeholder="Search Gmail (contact name, subject…)"
                  />
                  <button type="button" onClick={searchGmail} className="btn-secondary text-sm">Search</button>
                </div>

                {gmailError && (
                  <div className="mb-3">
                    <p className="text-xs" style={{ color: '#da3633' }}>{gmailError}</p>
                    {gmailError.includes('Connect Gmail') && (
                      <a
                        href="/auth/gmail"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-xs mt-1"
                        style={{ color: '#c9a84c', textDecoration: 'none' }}
                      >
                        <ExternalLink size={11} /> Connect Gmail Account
                      </a>
                    )}
                  </div>
                )}

                {gmailLoading && (
                  <div className="flex items-center gap-2 text-xs" style={{ color: '#8b949e' }}>
                    <Loader2 size={14} className="animate-spin" /> Searching…
                  </div>
                )}

                {!gmailLoading && gmailThreads.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs" style={{ color: '#8b949e' }}>{gmailThreads.length} threads found. Click to import.</p>
                    {gmailThreads.map((thread: any) => (
                      <button
                        key={thread.id}
                        type="button"
                        onClick={() => importThread(thread.id, thread.snippet || '')}
                        className="w-full text-left p-2.5 rounded hover:bg-surface transition-colors"
                        style={{ border: '1px solid #30363d' }}
                      >
                        <div className="text-xs" style={{ color: '#e6edf3' }}>Thread ID: {thread.id}</div>
                        {thread.snippet && <div className="text-xs mt-0.5 truncate" style={{ color: '#8b949e' }}>{thread.snippet}</div>}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={loading} className="btn-primary">
              {loading ? 'Saving…' : 'Log Interaction'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
