import { useState, useRef, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Upload,
  FileText,
  Trash2,
  Send,
  FileDown,
  Link2,
  Loader2,
  X,
  AlertTriangle,
  Check,
  Plus,
  Building2,
  Search,
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import toast from 'react-hot-toast';
import { useAuth } from '../contexts/AuthContext';
import { budgetApi, reportTemplateApi, entitiesApi } from '../api';
import type { BudgetDocument, ChatMessage, Entity } from '../types';

// ─── Client Selector ────────────────────────────────────────────────────────

function ClientSelector({
  selectedClient,
  onSelect,
}: {
  selectedClient: Entity | null;
  onSelect: (client: Entity | null) => void;
}) {
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const { data: companies = [] } = useQuery({
    queryKey: ['entities', 'companies'],
    queryFn: () => entitiesApi.list({ type: 'Company' }).then(r => r.data),
  });
  const { data: clients = [] } = useQuery({
    queryKey: ['entities', 'clients'],
    queryFn: () => entitiesApi.list({ type: 'Client' }).then(r => r.data),
  });

  const allClients = [...companies, ...clients];
  const filtered = search
    ? allClients.filter(c => c.name.toLowerCase().includes(search.toLowerCase()))
    : allClients;

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div className="card" style={{ background: '#161b22', border: '1px solid #30363d' }}>
      <div className="px-5 py-4" style={{ borderBottom: '1px solid #30363d' }}>
        <h2 className="text-sm font-semibold flex items-center gap-2" style={{ color: '#e6edf3' }}>
          <Building2 size={16} style={{ color: '#c9a84c' }} />
          Step 1: Select a Client
        </h2>
        <p className="text-xs mt-1" style={{ color: '#8b949e' }}>
          Choose the client you want to find opportunities for
        </p>
      </div>
      <div className="p-4" ref={ref}>
        {selectedClient ? (
          <div className="flex items-center justify-between p-3 rounded-lg" style={{ background: 'rgba(201,168,76,0.1)', border: '1px solid #c9a84c' }}>
            <div>
              <span className="text-sm font-medium" style={{ color: '#c9a84c' }}>{selectedClient.name}</span>
              {selectedClient.capabilityDescription && (
                <p className="text-xs mt-1 line-clamp-2" style={{ color: '#8b949e' }}>{selectedClient.capabilityDescription}</p>
              )}
              {selectedClient.description && !selectedClient.capabilityDescription && (
                <p className="text-xs mt-1 line-clamp-2" style={{ color: '#8b949e' }}>{selectedClient.description}</p>
              )}
            </div>
            <button
              onClick={() => onSelect(null)}
              className="p-1 rounded hover:bg-white/10 transition-colors ml-3"
              style={{ color: '#8b949e' }}
            >
              <X size={16} />
            </button>
          </div>
        ) : (
          <div className="relative">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#8b949e' }} />
              <input
                className="input pl-9"
                value={search}
                onChange={e => { setSearch(e.target.value); setOpen(true); }}
                onFocus={() => setOpen(true)}
                placeholder="Search clients / companies…"
              />
            </div>
            {open && filtered.length > 0 && (
              <div
                className="absolute z-50 w-full mt-1 max-h-56 overflow-y-auto rounded-lg shadow-lg"
                style={{ background: '#1c2333', border: '1px solid #30363d' }}
              >
                {filtered.map(c => (
                  <button
                    key={c.id}
                    onClick={() => { onSelect(c); setSearch(''); setOpen(false); }}
                    className="w-full text-left px-3 py-2.5 text-sm transition-colors hover:bg-white/5"
                    style={{ color: '#e6edf3', borderBottom: '1px solid #30363d' }}
                  >
                    <span className="font-medium">{c.name}</span>
                    {(c.capabilityDescription || c.description) && (
                      <p className="text-xs mt-0.5 line-clamp-1" style={{ color: '#8b949e' }}>
                        {c.capabilityDescription || c.description}
                      </p>
                    )}
                  </button>
                ))}
              </div>
            )}
            {!selectedClient && !open && (
              <div className="flex items-start gap-2 mt-3 p-3 rounded-lg" style={{ background: 'rgba(234,179,8,0.1)', border: '1px solid rgba(234,179,8,0.3)' }}>
                <AlertTriangle size={16} style={{ color: '#eab308', flexShrink: 0, marginTop: 2 }} />
                <p className="text-xs" style={{ color: '#eab308' }}>
                  Tip: Add a detailed capability description to your client records for better analysis results.
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Document Library ────────────────────────────────────────────────────────

function DocumentLibrary({
  documents,
  isLoading,
  selectedDocs,
  onToggle,
  onUploadClick,
  onDelete,
  canEdit,
  disabled,
}: {
  documents: BudgetDocument[];
  isLoading: boolean;
  selectedDocs: Set<string>;
  onToggle: (doc: BudgetDocument) => void;
  onUploadClick: () => void;
  onDelete: (id: string) => void;
  canEdit: boolean;
  disabled: boolean;
}) {
  return (
    <div className="card" style={{ background: '#161b22', border: '1px solid #30363d', opacity: disabled ? 0.5 : 1, pointerEvents: disabled ? 'none' : 'auto' }}>
      <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid #30363d' }}>
        <div>
          <h2 className="text-sm font-semibold flex items-center gap-2" style={{ color: '#e6edf3' }}>
            <FileText size={16} style={{ color: '#c9a84c' }} />
            Step 2: Select Document(s) to Analyze
          </h2>
          <p className="text-xs mt-1" style={{ color: '#8b949e' }}>
            {selectedDocs.size > 0
              ? `${selectedDocs.size} document${selectedDocs.size > 1 ? 's' : ''} selected`
              : 'Pick one or more documents to search for opportunities'}
          </p>
        </div>
        {canEdit && (
          <button onClick={onUploadClick} className="btn-primary text-xs flex items-center gap-1.5">
            <Upload size={14} /> Upload Document
          </button>
        )}
      </div>
      <div className="p-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-8" style={{ color: '#8b949e' }}>
            <Loader2 size={20} className="animate-spin mr-2" /> Loading documents…
          </div>
        ) : documents.length === 0 ? (
          <div className="text-center py-8" style={{ color: '#8b949e' }}>
            <FileText size={32} className="mx-auto mb-2 opacity-50" />
            <p className="text-sm">No documents uploaded yet</p>
            <p className="text-xs mt-1">Upload a PDF budget document to get started</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {documents.map(doc => {
              const isSelected = selectedDocs.has(doc.id);
              return (
                <div
                  key={doc.id}
                  className="rounded-lg p-4 transition-all cursor-pointer"
                  style={{
                    background: isSelected ? 'rgba(201,168,76,0.1)' : '#1c2333',
                    border: `1px solid ${isSelected ? '#c9a84c' : '#30363d'}`,
                  }}
                  onClick={() => onToggle(doc)}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-4 h-4 rounded border flex items-center justify-center"
                        style={{
                          borderColor: isSelected ? '#c9a84c' : '#30363d',
                          background: isSelected ? '#c9a84c' : 'transparent',
                        }}
                      >
                        {isSelected && <Check size={12} style={{ color: '#0d1117' }} />}
                      </div>
                      <FileText size={16} style={{ color: '#c9a84c', flexShrink: 0 }} />
                    </div>
                    {canEdit && (
                      <button
                        onClick={e => { e.stopPropagation(); onDelete(doc.id); }}
                        className="p-1 rounded hover:bg-red-500/20 transition-colors"
                        style={{ color: '#8b949e' }}
                        title="Delete document"
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                  <h3 className="text-sm font-medium mb-1 line-clamp-2" style={{ color: '#e6edf3' }}>{doc.name}</h3>
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: '#c9a84c20', color: '#c9a84c' }}>{doc.documentType}</span>
                    <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: '#30363d', color: '#8b949e' }}>{doc.fiscalYear}</span>
                    <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: '#30363d', color: '#8b949e' }}>{doc.serviceBranch}</span>
                  </div>
                  <p className="text-xs mt-2" style={{ color: '#8b949e' }}>
                    {new Date(doc.createdAt).toLocaleDateString()}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Upload Modal ────────────────────────────────────────────────────────────

function UploadModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState('');
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleUpload = async () => {
    if (!file) { toast.error('Select a PDF file'); return; }
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      if (name.trim()) formData.append('name', name.trim());
      await budgetApi.upload(formData);
      toast.success('Document uploaded and analyzed');
      onSuccess();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)' }}>
      <div className="w-full max-w-md rounded-xl" style={{ background: '#1c2333', border: '1px solid #30363d' }}>
        <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid #30363d' }}>
          <h2 className="text-base font-semibold" style={{ color: '#e6edf3' }}>Upload Budget Document</h2>
          <button onClick={onClose} style={{ color: '#8b949e' }}><X size={18} /></button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="label">PDF File *</label>
            <input
              ref={fileRef}
              type="file"
              accept=".pdf"
              onChange={e => setFile(e.target.files?.[0] || null)}
              className="input text-sm"
              style={{ padding: '8px' }}
            />
          </div>
          <div>
            <label className="label">Name (optional)</label>
            <input
              className="input"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Leave blank to use filename"
            />
          </div>
          {uploading && (
            <div className="flex items-center gap-2 py-2" style={{ color: '#c9a84c' }}>
              <Loader2 size={16} className="animate-spin" />
              <span className="text-sm">Uploading and analyzing document…</span>
            </div>
          )}
          <div className="flex justify-end gap-3 pt-2">
            <button onClick={onClose} className="btn-secondary" disabled={uploading}>Cancel</button>
            <button onClick={handleUpload} className="btn-primary" disabled={uploading || !file}>
              {uploading ? 'Processing…' : 'Upload'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Generate Report Modal ───────────────────────────────────────────────────

function GenerateReportModal({
  documents,
  selectedDocIds,
  client,
  onClose,
}: {
  documents: BudgetDocument[];
  selectedDocIds: string[];
  client: Entity;
  onClose: () => void;
}) {
  const [templateId, setTemplateId] = useState('');
  const [generating, setGenerating] = useState(false);
  const [showUploadTemplate, setShowUploadTemplate] = useState(false);
  const [templateFile, setTemplateFile] = useState<File | null>(null);
  const [templateName, setTemplateName] = useState('');
  const qc = useQueryClient();

  const { data: templates = [] } = useQuery({
    queryKey: ['report-templates'],
    queryFn: () => reportTemplateApi.list().then(r => r.data),
  });

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const response = await budgetApi.generateReport({
        documentIds: selectedDocIds,
        companyId: client.id,
        reportTemplateId: templateId || undefined,
      });

      const contentType = response.headers['content-type'];
      if (contentType?.includes('application/vnd.openxmlformats')) {
        const blob = new Blob([response.data], { type: contentType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Budget_Report_${client.name}.docx`;
        a.click();
        URL.revokeObjectURL(url);
        toast.success('Report downloaded');
      } else {
        const text = await new Response(response.data).text();
        const data = JSON.parse(text);
        const blob = new Blob([data.report], { type: 'text/markdown' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Budget_Report_${client.name}.md`;
        a.click();
        URL.revokeObjectURL(url);
        toast.success('Report downloaded (markdown)');
      }
      onClose();
    } catch (err: any) {
      toast.error('Failed to generate report');
    } finally {
      setGenerating(false);
    }
  };

  const handleUploadTemplate = async () => {
    if (!templateFile || !templateName.trim()) { toast.error('Name and file required'); return; }
    try {
      const formData = new FormData();
      formData.append('file', templateFile);
      formData.append('name', templateName.trim());
      await reportTemplateApi.upload(formData);
      toast.success('Template uploaded');
      qc.invalidateQueries({ queryKey: ['report-templates'] });
      setShowUploadTemplate(false);
      setTemplateFile(null);
      setTemplateName('');
    } catch {
      toast.error('Failed to upload template');
    }
  };

  const selectedDocs = documents.filter(d => selectedDocIds.includes(d.id));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)' }}>
      <div className="w-full max-w-lg rounded-xl" style={{ background: '#1c2333', border: '1px solid #30363d' }}>
        <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid #30363d' }}>
          <h2 className="text-base font-semibold" style={{ color: '#e6edf3' }}>Generate Report</h2>
          <button onClick={onClose} style={{ color: '#8b949e' }}><X size={18} /></button>
        </div>

        <div className="p-6 space-y-5">
          {/* Summary */}
          <div className="p-3 rounded-lg" style={{ background: '#161b22', border: '1px solid #30363d' }}>
            <p className="text-xs" style={{ color: '#8b949e' }}>Client</p>
            <p className="text-sm font-medium" style={{ color: '#c9a84c' }}>{client.name}</p>
            <p className="text-xs mt-2" style={{ color: '#8b949e' }}>Documents ({selectedDocs.length})</p>
            {selectedDocs.map(d => (
              <p key={d.id} className="text-sm" style={{ color: '#e6edf3' }}>{d.name}</p>
            ))}
          </div>

          {/* Template selection */}
          <div>
            <label className="label">Report Template (optional)</label>
            <select className="input" value={templateId} onChange={e => setTemplateId(e.target.value)}>
              <option value="">No template (download as markdown)</option>
              {templates.map(t => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
            <button
              onClick={() => setShowUploadTemplate(!showUploadTemplate)}
              className="text-xs mt-2 flex items-center gap-1"
              style={{ color: '#c9a84c' }}
            >
              <Plus size={12} /> Upload New Template
            </button>

            {showUploadTemplate && (
              <div className="mt-3 p-3 rounded-lg space-y-3" style={{ background: '#161b22', border: '1px solid #30363d' }}>
                <input
                  className="input text-sm"
                  placeholder="Template name"
                  value={templateName}
                  onChange={e => setTemplateName(e.target.value)}
                />
                <input
                  type="file"
                  accept=".docx"
                  onChange={e => setTemplateFile(e.target.files?.[0] || null)}
                  className="input text-sm"
                  style={{ padding: '8px' }}
                />
                <button onClick={handleUploadTemplate} className="btn-secondary text-xs">Upload</button>
              </div>
            )}
          </div>

          {generating && (
            <div className="flex items-center gap-2 py-2" style={{ color: '#c9a84c' }}>
              <Loader2 size={16} className="animate-spin" />
              <span className="text-sm">Generating report — this may take 30-60 seconds…</span>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <button onClick={onClose} className="btn-secondary" disabled={generating}>Cancel</button>
            <button onClick={handleGenerate} className="btn-primary" disabled={generating}>
              {generating ? 'Generating…' : 'Generate Report'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Link to Record Modal ────────────────────────────────────────────────────

function LinkToRecordModal({
  conversationId,
  onClose,
}: {
  conversationId: string;
  onClose: () => void;
}) {
  const [entityType, setEntityType] = useState('Company');
  const [entityId, setEntityId] = useState('');
  const [note, setNote] = useState('');
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState(false);

  const { data: entities = [] } = useQuery({
    queryKey: ['entities', entityType],
    queryFn: () => {
      const typeMap: Record<string, string> = {
        Company: 'Company',
        CongressionalOffice: 'CongressionalOffice',
        GovernmentOrganization: 'GovernmentOrganization',
      };
      return entitiesApi.list({ type: typeMap[entityType] }).then(r => r.data);
    },
  });

  const filtered = search
    ? entities.filter(e => e.name.toLowerCase().includes(search.toLowerCase()))
    : entities;

  const handleSave = async () => {
    if (!entityId) { toast.error('Select a record'); return; }
    setSaving(true);
    try {
      await budgetApi.createLink({ conversationId, entityType, entityId, note: note || undefined });
      toast.success('Linked to record');
      onClose();
    } catch {
      toast.error('Failed to create link');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)' }}>
      <div className="w-full max-w-md rounded-xl" style={{ background: '#1c2333', border: '1px solid #30363d' }}>
        <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid #30363d' }}>
          <h2 className="text-base font-semibold" style={{ color: '#e6edf3' }}>Link to CRM Record</h2>
          <button onClick={onClose} style={{ color: '#8b949e' }}><X size={18} /></button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="label">Record Type</label>
            <select className="input" value={entityType} onChange={e => { setEntityType(e.target.value); setEntityId(''); }}>
              <option value="Company">Company</option>
              <option value="CongressionalOffice">Congressional Office</option>
              <option value="GovernmentOrganization">Government Organization</option>
            </select>
          </div>
          <div>
            <label className="label">Search</label>
            <input className="input" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search records…" />
          </div>
          <div className="max-h-40 overflow-y-auto rounded-lg" style={{ border: '1px solid #30363d' }}>
            {filtered.map(e => (
              <button
                key={e.id}
                onClick={() => setEntityId(e.id)}
                className="w-full text-left px-3 py-2 text-sm transition-colors flex items-center justify-between"
                style={{
                  background: entityId === e.id ? 'rgba(201,168,76,0.1)' : 'transparent',
                  color: entityId === e.id ? '#c9a84c' : '#e6edf3',
                  borderBottom: '1px solid #30363d',
                }}
              >
                <span>{e.name}</span>
                {entityId === e.id && <Check size={14} />}
              </button>
            ))}
          </div>
          <div>
            <label className="label">Note (optional)</label>
            <input className="input" value={note} onChange={e => setNote(e.target.value)} placeholder="Why is this relevant?" />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button onClick={onClose} className="btn-secondary">Cancel</button>
            <button onClick={handleSave} className="btn-primary" disabled={saving || !entityId}>
              {saving ? 'Saving…' : 'Link Record'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Chat Interface ──────────────────────────────────────────────────────────

function ChatInterface({
  doc,
  documents,
  selectedDocIds,
  client,
  canEdit,
}: {
  doc: BudgetDocument;
  documents: BudgetDocument[];
  selectedDocIds: string[];
  client: Entity;
  canEdit: boolean;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [showReportModal, setShowReportModal] = useState(false);
  const [showLinkModal, setShowLinkModal] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Reset when document changes
  useEffect(() => {
    setMessages([]);
    setInput('');
    setConversationId(null);
  }, [doc.id, client.id]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || loading) return;
    const userMsg = input.trim();
    setInput('');

    const newMessages: ChatMessage[] = [...messages, { role: 'user', content: userMsg }];
    setMessages(newMessages);
    setLoading(true);

    try {
      const { data } = await budgetApi.chat(doc.id, userMsg, messages, client.id);
      const withResponse: ChatMessage[] = [...newMessages, { role: 'assistant', content: data.response }];
      setMessages(withResponse);

      // Save conversation
      if (conversationId) {
        await budgetApi.updateConversation(conversationId, withResponse);
      } else {
        const { data: convo } = await budgetApi.createConversation({
          budgetDocumentId: doc.id,
          messages: withResponse,
        });
        setConversationId(convo.id);
      }
    } catch (err: any) {
      toast.error('Failed to get response');
      setMessages(messages); // revert
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card" style={{ background: '#161b22', border: '1px solid #30363d' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3" style={{ borderBottom: '1px solid #30363d' }}>
        <div>
          <h2 className="text-sm font-semibold" style={{ color: '#e6edf3' }}>{doc.name}</h2>
          <div className="flex gap-2 mt-1">
            <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: '#c9a84c20', color: '#c9a84c' }}>{doc.documentType}</span>
            <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: '#30363d', color: '#8b949e' }}>{doc.fiscalYear}</span>
            <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: '#30363d', color: '#8b949e' }}>{doc.serviceBranch}</span>
            <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: 'rgba(201,168,76,0.15)', color: '#c9a84c' }}>
              Analyzing for: {client.name}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {canEdit && conversationId && (
            <button
              onClick={() => setShowLinkModal(true)}
              className="btn-secondary text-xs flex items-center gap-1.5"
            >
              <Link2 size={13} /> Link to Record
            </button>
          )}
          {canEdit && (
            <button
              onClick={() => setShowReportModal(true)}
              className="btn-primary text-xs flex items-center gap-1.5"
            >
              <FileDown size={13} /> Generate Report
            </button>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="overflow-y-auto" style={{ height: 400, padding: '16px 20px' }}>
        {messages.length === 0 && (
          <div className="text-center py-12" style={{ color: '#8b949e' }}>
            <FileText size={32} className="mx-auto mb-3 opacity-50" />
            <p className="text-sm font-medium">Ask about opportunities for {client.name}</p>
            <p className="text-xs mt-1">The AI knows the document contents and your client's capabilities</p>
            <div className="flex flex-wrap gap-2 justify-center mt-4">
              {[
                `What opportunities exist in this document for ${client.name}?`,
                'What are the top funded programs relevant to our capabilities?',
                'Are there any new starts or increased funding lines we should target?',
              ].map((q, i) => (
                <button
                  key={i}
                  onClick={() => setInput(q)}
                  className="text-xs px-3 py-1.5 rounded-full transition-colors hover:bg-white/10"
                  style={{ background: '#1c2333', border: '1px solid #30363d', color: '#e6edf3' }}
                >
                  {q.length > 60 ? q.substring(0, 57) + '…' : q}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((msg, i) => (
          <div key={i} className={`mb-4 flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className="rounded-lg px-4 py-3 max-w-[80%] text-sm"
              style={{
                background: msg.role === 'user' ? '#c9a84c' : '#1c2333',
                color: msg.role === 'user' ? '#0d1117' : '#e6edf3',
                border: msg.role === 'assistant' ? '1px solid #30363d' : 'none',
              }}
            >
              {msg.role === 'assistant' ? (
                <div className="prose prose-invert prose-sm max-w-none">
                  <ReactMarkdown>{msg.content}</ReactMarkdown>
                </div>
              ) : (
                msg.content
              )}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start mb-4">
            <div className="rounded-lg px-4 py-3 flex items-center gap-2" style={{ background: '#1c2333', border: '1px solid #30363d' }}>
              <Loader2 size={14} className="animate-spin" style={{ color: '#c9a84c' }} />
              <span className="text-sm" style={{ color: '#8b949e' }}>Analyzing for {client.name}…</span>
            </div>
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      {/* Input */}
      <div className="px-5 py-3" style={{ borderTop: '1px solid #30363d' }}>
        <div className="flex gap-2">
          <input
            className="input flex-1"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
            placeholder={`Ask about opportunities for ${client.name}…`}
            disabled={loading}
          />
          <button
            onClick={handleSend}
            className="btn-primary px-3"
            disabled={loading || !input.trim()}
          >
            <Send size={16} />
          </button>
        </div>
      </div>

      {showReportModal && (
        <GenerateReportModal
          documents={documents}
          selectedDocIds={selectedDocIds}
          client={client}
          onClose={() => setShowReportModal(false)}
        />
      )}
      {showLinkModal && conversationId && (
        <LinkToRecordModal
          conversationId={conversationId}
          onClose={() => setShowLinkModal(false)}
        />
      )}
    </div>
  );
}

// ─── Report Templates Section ────────────────────────────────────────────────

function ReportTemplatesSection({ canEdit }: { canEdit: boolean }) {
  const qc = useQueryClient();
  const [showUpload, setShowUpload] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [uploading, setUploading] = useState(false);

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ['report-templates'],
    queryFn: () => reportTemplateApi.list().then(r => r.data),
  });

  const handleUpload = async () => {
    if (!file || !name.trim()) { toast.error('Name and file required'); return; }
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('name', name.trim());
      if (description.trim()) formData.append('description', description.trim());
      await reportTemplateApi.upload(formData);
      toast.success('Template uploaded');
      qc.invalidateQueries({ queryKey: ['report-templates'] });
      setShowUpload(false);
      setFile(null);
      setName('');
      setDescription('');
    } catch {
      toast.error('Failed to upload template');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this template?')) return;
    try {
      await reportTemplateApi.delete(id);
      toast.success('Template deleted');
      qc.invalidateQueries({ queryKey: ['report-templates'] });
    } catch {
      toast.error('Failed to delete template');
    }
  };

  return (
    <div className="card" style={{ background: '#161b22', border: '1px solid #30363d' }}>
      <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid #30363d' }}>
        <h2 className="text-sm font-semibold" style={{ color: '#e6edf3' }}>Report Templates</h2>
        {canEdit && (
          <button onClick={() => setShowUpload(!showUpload)} className="btn-secondary text-xs flex items-center gap-1.5">
            <Upload size={14} /> Upload Template
          </button>
        )}
      </div>

      {showUpload && (
        <div className="px-5 py-4 space-y-3" style={{ borderBottom: '1px solid #30363d', background: '#1c2333' }}>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Name *</label>
              <input className="input" value={name} onChange={e => setName(e.target.value)} placeholder="Template name" />
            </div>
            <div>
              <label className="label">Description</label>
              <input className="input" value={description} onChange={e => setDescription(e.target.value)} placeholder="Optional description" />
            </div>
          </div>
          <div>
            <label className="label">.docx File *</label>
            <input
              type="file"
              accept=".docx"
              onChange={e => setFile(e.target.files?.[0] || null)}
              className="input text-sm"
              style={{ padding: '8px' }}
            />
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => setShowUpload(false)} className="btn-secondary text-xs">Cancel</button>
            <button onClick={handleUpload} className="btn-primary text-xs" disabled={uploading || !file || !name.trim()}>
              {uploading ? 'Uploading…' : 'Upload'}
            </button>
          </div>
        </div>
      )}

      <div className="p-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-4" style={{ color: '#8b949e' }}>
            <Loader2 size={16} className="animate-spin mr-2" /> Loading…
          </div>
        ) : templates.length === 0 ? (
          <p className="text-xs text-center py-4" style={{ color: '#8b949e' }}>No templates uploaded yet</p>
        ) : (
          <div className="space-y-2">
            {templates.map(t => (
              <div key={t.id} className="flex items-center justify-between px-3 py-2 rounded-lg" style={{ background: '#1c2333', border: '1px solid #30363d' }}>
                <div>
                  <span className="text-sm font-medium" style={{ color: '#e6edf3' }}>{t.name}</span>
                  {t.description && <p className="text-xs mt-0.5" style={{ color: '#8b949e' }}>{t.description}</p>}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs" style={{ color: '#8b949e' }}>
                    {new Date(t.createdAt).toLocaleDateString()}
                  </span>
                  {canEdit && (
                    <button
                      onClick={() => handleDelete(t.id)}
                      className="p-1 rounded hover:bg-red-500/20 transition-colors"
                      style={{ color: '#8b949e' }}
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export function BudgetAnalyzer() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const canEdit = user?.role !== 'Viewer';
  const [selectedClient, setSelectedClient] = useState<Entity | null>(null);
  const [selectedDocIds, setSelectedDocIds] = useState<Set<string>>(new Set());
  const [activeDocId, setActiveDocId] = useState<string | null>(null);
  const [showUpload, setShowUpload] = useState(false);

  const { data: documents = [], isLoading } = useQuery({
    queryKey: ['budget-documents'],
    queryFn: () => budgetApi.list().then(r => r.data),
  });

  const handleToggleDoc = (doc: BudgetDocument) => {
    setSelectedDocIds(prev => {
      const next = new Set(prev);
      if (next.has(doc.id)) {
        next.delete(doc.id);
        if (activeDocId === doc.id) setActiveDocId(next.size > 0 ? Array.from(next)[0] : null);
      } else {
        next.add(doc.id);
        setActiveDocId(doc.id);
      }
      return next;
    });
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this document and all its conversations?')) return;
    try {
      await budgetApi.delete(id);
      toast.success('Document deleted');
      setSelectedDocIds(prev => { const next = new Set(prev); next.delete(id); return next; });
      if (activeDocId === id) setActiveDocId(null);
      qc.invalidateQueries({ queryKey: ['budget-documents'] });
    } catch {
      toast.error('Failed to delete document');
    }
  };

  const activeDoc = documents.find(d => d.id === activeDocId) || null;
  const canChat = selectedClient && selectedDocIds.size > 0 && activeDoc;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-lg font-semibold" style={{ color: '#e6edf3' }}>Budget Analyzer</h1>
        <p className="text-sm mt-1" style={{ color: '#8b949e' }}>
          Select a client, choose documents, and discover opportunities
        </p>
      </div>

      {/* Step 1: Client Selection */}
      <ClientSelector selectedClient={selectedClient} onSelect={setSelectedClient} />

      {/* Step 2: Document Library */}
      <DocumentLibrary
        documents={documents}
        isLoading={isLoading}
        selectedDocs={selectedDocIds}
        onToggle={handleToggleDoc}
        onUploadClick={() => setShowUpload(true)}
        onDelete={handleDelete}
        canEdit={canEdit}
        disabled={!selectedClient}
      />

      {/* Document tabs when multiple selected */}
      {selectedDocIds.size > 1 && selectedClient && (
        <div className="flex gap-2 flex-wrap">
          {Array.from(selectedDocIds).map(id => {
            const doc = documents.find(d => d.id === id);
            if (!doc) return null;
            return (
              <button
                key={id}
                onClick={() => setActiveDocId(id)}
                className="text-xs px-3 py-1.5 rounded-full transition-colors"
                style={{
                  background: activeDocId === id ? '#c9a84c' : '#1c2333',
                  color: activeDocId === id ? '#0d1117' : '#e6edf3',
                  border: `1px solid ${activeDocId === id ? '#c9a84c' : '#30363d'}`,
                }}
              >
                {doc.name}
              </button>
            );
          })}
        </div>
      )}

      {/* Chat Interface */}
      {canChat && (
        <ChatInterface
          doc={activeDoc}
          documents={documents}
          selectedDocIds={Array.from(selectedDocIds)}
          client={selectedClient}
          canEdit={canEdit}
        />
      )}

      {/* Report Templates */}
      <ReportTemplatesSection canEdit={canEdit} />

      {/* Upload Modal */}
      {showUpload && (
        <UploadModal
          onClose={() => setShowUpload(false)}
          onSuccess={() => {
            setShowUpload(false);
            qc.invalidateQueries({ queryKey: ['budget-documents'] });
          }}
        />
      )}
    </div>
  );
}
