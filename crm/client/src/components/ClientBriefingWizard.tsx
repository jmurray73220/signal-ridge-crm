import { useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { X, Loader2, Copy, ChevronRight, ChevronLeft, Download } from 'lucide-react';
import { entitiesApi, contactsApi, briefingApi, briefingDocsApi } from '../api';
import ReactMarkdown from 'react-markdown';
import toast from 'react-hot-toast';

interface Props {
  onClose: () => void;
}

interface WizardData {
  clientId: string;
  officeId: string;
  meetingDate: string;
  meetingTime: string;
  meetingLocation: string;
  stafferContactIds: string[];
  primaryAsk: string;
  rationale: string;
  talkingPointsPrompt: string;
  additionalContext: string;
  referenceBriefingIds: string[];
}

function AutocompleteField({
  label,
  placeholder,
  items,
  value,
  onChange,
  renderItem,
  filterFn,
  required,
}: {
  label: string;
  placeholder: string;
  items: { id: string; display: string }[];
  value: string;
  onChange: (id: string) => void;
  renderItem?: (item: { id: string; display: string }) => React.ReactNode;
  filterFn?: (item: { id: string; display: string }, query: string) => boolean;
  required?: boolean;
}) {
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const selected = items.find(i => i.id === value);

  useEffect(() => {
    if (selected) setSearch(selected.display);
    else setSearch('');
  }, [value, selected]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const filtered = search
    ? items.filter(i =>
        filterFn ? filterFn(i, search) : i.display.toLowerCase().includes(search.toLowerCase())
      )
    : items;

  return (
    <div ref={ref} className="relative">
      <label className="label">
        {label}{required && ' *'}
      </label>
      <input
        className="input"
        value={search}
        onChange={e => {
          setSearch(e.target.value);
          setOpen(true);
          if (!e.target.value) onChange('');
        }}
        onFocus={() => setOpen(true)}
        placeholder={placeholder}
      />
      {open && filtered.length > 0 && (
        <div
          className="absolute z-50 w-full mt-1 max-h-48 overflow-y-auto rounded-lg shadow-lg"
          style={{ background: '#1c2333', border: '1px solid #30363d' }}
        >
          {filtered.slice(0, 20).map(item => (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                onChange(item.id);
                setSearch(item.display);
                setOpen(false);
              }}
              className="w-full text-left px-3 py-2 text-sm transition-colors hover:bg-white/5"
              style={{
                color: item.id === value ? '#c9a84c' : '#e6edf3',
                background: item.id === value ? 'rgba(201,168,76,0.1)' : 'transparent',
                borderBottom: '1px solid #30363d',
              }}
            >
              {renderItem ? renderItem(item) : item.display}
            </button>
          ))}
        </div>
      )}
      {value && (
        <button
          type="button"
          onClick={() => { onChange(''); setSearch(''); }}
          className="absolute right-2 top-[calc(50%+4px)] text-xs"
          style={{ color: '#8b949e' }}
        >
          <X size={14} />
        </button>
      )}
    </div>
  );
}

function MultiSelectAutocomplete({
  label,
  placeholder,
  items,
  values,
  onChange,
}: {
  label: string;
  placeholder: string;
  items: { id: string; display: string }[];
  values: string[];
  onChange: (ids: string[]) => void;
}) {
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const selectedItems = values
    .map(id => items.find(i => i.id === id))
    .filter(Boolean) as { id: string; display: string }[];

  const filtered = (search
    ? items.filter(i => i.display.toLowerCase().includes(search.toLowerCase()))
    : items
  ).filter(i => !values.includes(i.id));

  const add = (id: string) => {
    if (!values.includes(id)) onChange([...values, id]);
    setSearch('');
  };
  const remove = (id: string) => onChange(values.filter(v => v !== id));

  return (
    <div ref={ref} className="relative">
      {label && <label className="label">{label}</label>}
      {selectedItems.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-1.5">
          {selectedItems.map(it => (
            <span
              key={it.id}
              className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs"
              style={{ background: 'rgba(201,168,76,0.15)', color: '#c9a84c', border: '1px solid #c9a84c' }}
            >
              {it.display}
              <button type="button" onClick={() => remove(it.id)} className="opacity-70 hover:opacity-100">
                <X size={11} />
              </button>
            </span>
          ))}
        </div>
      )}
      <input
        className="input"
        value={search}
        onChange={e => { setSearch(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        placeholder={selectedItems.length ? 'Add another…' : placeholder}
      />
      {open && filtered.length > 0 && (
        <div
          className="absolute z-50 w-full mt-1 max-h-48 overflow-y-auto rounded-lg shadow-lg"
          style={{ background: '#1c2333', border: '1px solid #30363d' }}
        >
          {filtered.slice(0, 20).map(item => (
            <button
              key={item.id}
              type="button"
              onClick={() => { add(item.id); setOpen(false); }}
              className="w-full text-left px-3 py-2 text-sm transition-colors hover:bg-white/5"
              style={{ color: '#e6edf3', borderBottom: '1px solid #30363d' }}
            >
              {item.display}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

const STEPS = [
  'Client & Office',
  'Reference Briefings',
  'Meeting Details',
  'Objectives & Talking Points',
  'Review & Generate',
];

export function ClientBriefingWizard({ onClose }: Props) {
  const [step, setStep] = useState(0);
  const [data, setData] = useState<WizardData>({
    clientId: '',
    officeId: '',
    meetingDate: '',
    meetingTime: '',
    meetingLocation: '',
    stafferContactIds: [],
    primaryAsk: '',
    rationale: '',
    talkingPointsPrompt: '',
    additionalContext: '',
    referenceBriefingIds: [],
  });
  const [generating, setGenerating] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [briefing, setBriefing] = useState('');
  const [error, setError] = useState('');

  // Fetch data
  const { data: allEntities = [] } = useQuery({
    queryKey: ['entities'],
    queryFn: () => entitiesApi.list().then(r => r.data),
  });
  const { data: allContacts = [] } = useQuery({
    queryKey: ['contacts'],
    queryFn: () => contactsApi.list().then(r => r.data),
  });
  // Past briefings tagged with the chosen client — these will be fed to Claude
  // as reference context during generation. Surfaced in Step 3 so the user can
  // see exactly what's being drawn on before generating.
  const { data: refBriefings = [] } = useQuery({
    queryKey: ['briefingDocs', 'client', data.clientId],
    queryFn: () => briefingDocsApi.list({ clientId: data.clientId }).then(r => r.data),
    enabled: !!data.clientId,
  });

  const clients = allEntities.filter(e => e.entityType === 'Client');
  const offices = allEntities.filter(e =>
    e.entityType === 'CongressionalOffice' || e.entityType === 'GovernmentOrganization'
  );

  const selectedOffice = offices.find(o => o.id === data.officeId);
  const officeContacts = allContacts.filter(c => c.entityId === data.officeId);

  // Auto-fill location from office address
  useEffect(() => {
    if (selectedOffice?.address && !data.meetingLocation) {
      setData(d => ({ ...d, meetingLocation: selectedOffice.address! }));
    }
  }, [data.officeId, selectedOffice]);

  // Default-select every past briefing for this client whenever the client
  // changes. The user can uncheck individual ones in step 2.
  useEffect(() => {
    setData(d => ({ ...d, referenceBriefingIds: refBriefings.map(b => b.id) }));
  }, [data.clientId, refBriefings.length]);

  const update = <K extends keyof WizardData>(key: K, val: WizardData[K]) =>
    setData(d => ({ ...d, [key]: val }));

  const canProceed = () => {
    if (step === 0) return !!data.clientId && !!data.officeId;
    if (step === 1) return true; // references step — selection optional
    if (step === 2) return !!data.meetingDate;
    return true;
  };

  // Advance handler: when moving off the references step, if any references
  // are selected, ask the server to extract a Primary Ask / Rationale /
  // Talking Points draft from them so the next step is pre-populated.
  const handleNext = async () => {
    if (step === 1 && data.referenceBriefingIds.length > 0) {
      // Don't overwrite anything the user already typed
      const fieldsAlreadyFilled = !!(data.primaryAsk || data.rationale || data.talkingPointsPrompt);
      if (!fieldsAlreadyFilled) {
        setExtracting(true);
        setError('');
        try {
          const res = await briefingApi.extractDraft(data.referenceBriefingIds);
          setData(d => ({
            ...d,
            primaryAsk: d.primaryAsk || res.data.primaryAsk,
            rationale: d.rationale || res.data.rationale,
            talkingPointsPrompt: d.talkingPointsPrompt || res.data.talkingPointsPrompt,
          }));
        } catch (err: any) {
          // Soft fail: advance anyway with empty fields rather than block
          console.warn('Draft extraction failed', err);
        } finally {
          setExtracting(false);
        }
      }
    }
    setStep(s => s + 1);
  };

  const toggleRefBriefing = (id: string) => {
    setData(d => ({
      ...d,
      referenceBriefingIds: d.referenceBriefingIds.includes(id)
        ? d.referenceBriefingIds.filter(x => x !== id)
        : [...d.referenceBriefingIds, id],
    }));
  };

  const handleGenerate = async () => {
    setGenerating(true);
    setError('');
    try {
      const res = await briefingApi.clientMeeting(data);
      setBriefing(res.data.briefing);
      setStep(5); // show result
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to generate briefing');
    } finally {
      setGenerating(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(briefing);
    toast.success('Briefing copied to clipboard');
  };

  const handleDownloadDocx = async () => {
    try {
      const officeName = selectedOffice?.name?.replace(/[^a-zA-Z0-9]/g, '_') || 'briefing';
      const res = await briefingApi.exportDocx(briefing, `Client_Briefing_${officeName}`, data.officeId);
      const url = URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a');
      a.href = url;
      a.download = `Client_Briefing_${officeName}.docx`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Document downloaded');
    } catch {
      toast.error('Failed to download document');
    }
  };

  // Result view
  if (step === 5) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.85)' }}>
        <div className="w-full max-w-3xl h-full max-h-[90vh] flex flex-col rounded-xl overflow-hidden" style={{ background: '#1c2333', border: '1px solid #30363d' }}>
          <div className="flex items-center justify-between px-6 py-4 flex-shrink-0" style={{ borderBottom: '1px solid #30363d' }}>
            <div>
              <h2 className="text-base font-semibold" style={{ color: '#e6edf3' }}>Client Briefing Memo</h2>
              <p className="text-xs" style={{ color: '#8b949e' }}>
                {selectedOffice?.name || 'Meeting'} — {data.meetingDate}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={handleDownloadDocx} className="btn-primary flex items-center gap-1.5 text-sm">
                <Download size={14} /> Download .docx
              </button>
              <button onClick={handleCopy} className="btn-secondary flex items-center gap-1.5 text-sm">
                <Copy size={14} /> Copy
              </button>
              <button onClick={onClose} style={{ color: '#8b949e' }}><X size={18} /></button>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-6">
            <div className="prose prose-invert max-w-none text-sm" style={{ color: '#e6edf3', lineHeight: 1.7 }}>
              <ReactMarkdown
                components={{
                  h1: ({ children }) => <h1 className="text-lg font-bold mt-4 mb-2" style={{ color: '#e6edf3' }}>{children}</h1>,
                  h2: ({ children }) => <h2 className="text-base font-semibold mt-6 mb-2" style={{ color: '#c9a84c' }}>{children}</h2>,
                  h3: ({ children }) => <h3 className="text-sm font-semibold mt-4 mb-1" style={{ color: '#e6edf3' }}>{children}</h3>,
                  p: ({ children }) => <p className="mb-3" style={{ color: '#8b949e' }}>{children}</p>,
                  ul: ({ children }) => <ul className="mb-3 ml-4 space-y-1" style={{ color: '#8b949e', listStyleType: 'disc' }}>{children}</ul>,
                  li: ({ children }) => <li>{children}</li>,
                  strong: ({ children }) => <strong style={{ color: '#e6edf3' }}>{children}</strong>,
                }}
              >
                {briefing}
              </ReactMarkdown>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.85)' }}>
      <div className="w-full max-w-xl rounded-xl overflow-hidden flex flex-col" style={{ background: '#1c2333', border: '1px solid #30363d', height: '88vh' }}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid #30363d' }}>
          <div>
            <h2 className="text-base font-semibold" style={{ color: '#e6edf3' }}>Create Client Briefing</h2>
            <p className="text-xs" style={{ color: '#8b949e' }}>
              Step {step + 1} of {STEPS.length} — {STEPS[step]}
            </p>
          </div>
          <button onClick={onClose} style={{ color: '#8b949e' }}><X size={18} /></button>
        </div>

        {/* Progress bar */}
        <div className="h-1 w-full" style={{ background: '#30363d' }}>
          <div
            className="h-full transition-all duration-300"
            style={{ width: `${((step + 1) / STEPS.length) * 100}%`, background: '#c9a84c' }}
          />
        </div>

        {/* Content */}
        <div className="flex-1 p-6 space-y-4 overflow-y-auto">
          {step === 0 && (
            <>
              <AutocompleteField
                label="Which client is this for?"
                placeholder="Start typing client name…"
                items={clients.map(c => ({ id: c.id, display: c.name }))}
                value={data.clientId}
                onChange={id => update('clientId', id)}
                required
              />
              <AutocompleteField
                label="Office the meeting is with"
                placeholder="Start typing office name…"
                items={offices.map(o => ({ id: o.id, display: o.name }))}
                value={data.officeId}
                onChange={id => {
                  update('officeId', id);
                  update('stafferContactIds', []);
                  // Reset location so it can auto-fill from new office
                  const office = offices.find(o => o.id === id);
                  if (office?.address) update('meetingLocation', office.address);
                  else update('meetingLocation', '');
                }}
                required
              />
            </>
          )}

          {step === 1 && (
            <ReferenceBriefingsStep
              clientName={clients.find(c => c.id === data.clientId)?.name || ''}
              refBriefings={refBriefings}
              selectedIds={data.referenceBriefingIds}
              onToggle={toggleRefBriefing}
              onSelectAll={() => update('referenceBriefingIds', refBriefings.map(b => b.id))}
              onSelectNone={() => update('referenceBriefingIds', [])}
            />
          )}

          {step === 2 && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Meeting Date *</label>
                  <input
                    type="date"
                    className="input"
                    value={data.meetingDate}
                    onChange={e => update('meetingDate', e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label className="label">Meeting Time</label>
                  <input
                    type="time"
                    className="input"
                    value={data.meetingTime}
                    onChange={e => update('meetingTime', e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label className="label">Meeting Location</label>
                <input
                  className="input"
                  value={data.meetingLocation}
                  onChange={e => update('meetingLocation', e.target.value)}
                  placeholder="e.g., 322 Hart Senate Office Building"
                />
                {selectedOffice?.address && (
                  <span className="text-xs mt-0.5 block" style={{ color: '#8b949e' }}>
                    Auto-filled from CRM
                  </span>
                )}
              </div>

              <div>
                <label className="label">Meeting With (one or more staffers)</label>
                {officeContacts.length > 0 ? (
                  <MultiSelectAutocomplete
                    label=""
                    placeholder="Start typing staffer name… add as many as needed"
                    items={officeContacts.map(c => ({
                      id: c.id,
                      display: `${c.firstName} ${c.lastName}${c.title ? ` — ${c.title}` : ''}`,
                    }))}
                    values={data.stafferContactIds}
                    onChange={ids => update('stafferContactIds', ids)}
                  />
                ) : (
                  <p className="text-xs" style={{ color: '#8b949e' }}>
                    No contacts found for this office. The briefing will still be generated.
                  </p>
                )}
              </div>
            </>
          )}

          {step === 3 && (
            <>
              <div>
                <label className="label">Primary Ask / Objectives *</label>
                <textarea
                  className="input"
                  value={data.primaryAsk}
                  onChange={e => update('primaryAsk', e.target.value)}
                  rows={5}
                  placeholder="What's the main ask for this meeting? Claude will help craft the rationale and structure."
                  style={{ resize: 'vertical' }}
                />
              </div>
              <div>
                <label className="label">Rationale Prompt</label>
                <textarea
                  className="input"
                  value={data.rationale}
                  onChange={e => update('rationale', e.target.value)}
                  rows={5}
                  placeholder="Key points for why this meeting matters. Claude will expand this into a full rationale section."
                  style={{ resize: 'vertical' }}
                />
              </div>
              <div>
                <label className="label">Talking Points Guidance</label>
                <textarea
                  className="input"
                  value={data.talkingPointsPrompt}
                  onChange={e => update('talkingPointsPrompt', e.target.value)}
                  rows={5}
                  placeholder="Key themes or angles for talking points. Claude will generate structured talking points."
                  style={{ resize: 'vertical' }}
                />
              </div>
              <div>
                <label className="label">Additional Context</label>
                <textarea
                  className="input"
                  value={data.additionalContext}
                  onChange={e => update('additionalContext', e.target.value)}
                  rows={3}
                  placeholder="Any other relevant info for the briefing…"
                  style={{ resize: 'vertical' }}
                />
              </div>
            </>
          )}

          {step === 4 && (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold" style={{ color: '#e6edf3' }}>Review Your Inputs</h3>
              {[
                ['Client', clients.find(c => c.id === data.clientId)?.name],
                ['Office', selectedOffice?.name],
                ['Date & Time', `${data.meetingDate}${data.meetingTime ? ' at ' + data.meetingTime : ''}`],
                ['Location', data.meetingLocation],
                ['Staffers', (() => {
                  if (!data.stafferContactIds.length) return '—';
                  return data.stafferContactIds
                    .map(id => allContacts.find(c => c.id === id))
                    .filter(Boolean)
                    .map((c: any) => `${c.firstName} ${c.lastName}`)
                    .join(', ');
                })()],
                ['Primary Ask', data.primaryAsk || '—'],
              ].map(([label, val]) => (
                <div key={label as string} className="flex gap-3">
                  <span className="text-xs font-medium w-24 flex-shrink-0" style={{ color: '#8b949e' }}>{label}</span>
                  <span className="text-sm" style={{ color: '#e6edf3' }}>{val || '—'}</span>
                </div>
              ))}

              {data.referenceBriefingIds.length > 0 && (
                <div className="text-xs mt-2" style={{ color: '#8b949e' }}>
                  Drawing on <span style={{ color: '#c9a84c' }}>{data.referenceBriefingIds.length}</span> past briefing{data.referenceBriefingIds.length === 1 ? '' : 's'}.
                </div>
              )}

              {error && (
                <div className="p-3 rounded-lg" style={{ background: 'rgba(218,54,51,0.1)', border: '1px solid #da3633' }}>
                  <p className="text-sm" style={{ color: '#da3633' }}>{error}</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4" style={{ borderTop: '1px solid #30363d' }}>
          <button
            onClick={() => step > 0 && setStep(s => s - 1)}
            disabled={step === 0}
            className="btn-secondary flex items-center gap-1 text-sm"
            style={{ opacity: step === 0 ? 0.3 : 1 }}
          >
            <ChevronLeft size={14} /> Back
          </button>

          {step < 4 ? (
            <button
              onClick={handleNext}
              disabled={!canProceed() || extracting}
              className="btn-primary flex items-center gap-1 text-sm"
            >
              {extracting ? (
                <><Loader2 size={14} className="animate-spin" /> Pre-filling from references…</>
              ) : (
                <>Next <ChevronRight size={14} /></>
              )}
            </button>
          ) : (
            <button
              onClick={handleGenerate}
              disabled={generating}
              className="btn-primary flex items-center gap-1.5 text-sm"
            >
              {generating ? (
                <>
                  <Loader2 size={14} className="animate-spin" /> Generating…
                </>
              ) : (
                'Generate Briefing'
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Reference Briefings step body ───────────────────────────────────────────

function ReferenceBriefingsStep({
  clientName,
  refBriefings,
  selectedIds,
  onToggle,
  onSelectAll,
  onSelectNone,
}: {
  clientName: string;
  refBriefings: Array<{ id: string; filename: string; office?: { name: string }; meetingDate?: string | null; tags: string[]; uploadedAt: string }>;
  selectedIds: string[];
  onToggle: (id: string) => void;
  onSelectAll: () => void;
  onSelectNone: () => void;
}) {
  if (!refBriefings.length) {
    return (
      <div className="rounded-lg p-4 text-sm" style={{
        background: 'rgba(255,255,255,0.02)',
        border: '1px dashed #30363d',
        color: '#8b949e',
      }}>
        <div className="font-semibold mb-1" style={{ color: '#e6edf3' }}>
          No past briefings on file{clientName ? ` for ${clientName}` : ''} yet.
        </div>
        Continue and we'll generate from scratch. Once you've uploaded prior briefings on a
        Congressional Office's <strong style={{ color: '#e6edf3' }}>Past Briefings</strong> tab,
        future generations can carry forward tone, talking points, and language.
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs" style={{ color: '#8b949e' }}>
          {selectedIds.length === 0
            ? 'No references selected — generation will start from scratch.'
            : <>Selected <span style={{ color: '#c9a84c' }}>{selectedIds.length}</span> of {refBriefings.length}. The next step will be pre-populated from these.</>}
        </p>
        <div className="flex gap-2 text-xs">
          <button type="button" onClick={onSelectAll} style={{ color: '#c9a84c' }}>Select all</button>
          <span style={{ color: '#30363d' }}>|</span>
          <button type="button" onClick={onSelectNone} style={{ color: '#8b949e' }}>None</button>
        </div>
      </div>
      <div className="space-y-1.5">
        {refBriefings.map(b => {
          const checked = selectedIds.includes(b.id);
          return (
            <label
              key={b.id}
              className="flex items-start gap-3 p-2.5 rounded-lg cursor-pointer transition-colors hover:bg-white/5"
              style={{
                background: checked ? 'rgba(201,168,76,0.08)' : 'transparent',
                border: `1px solid ${checked ? 'rgba(201,168,76,0.35)' : '#30363d'}`,
              }}
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={() => onToggle(b.id)}
                className="mt-0.5"
                style={{ accentColor: '#c9a84c' }}
              />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate" style={{ color: '#e6edf3' }}>
                  {b.filename}
                </div>
                <div className="text-xs mt-0.5" style={{ color: '#8b949e' }}>
                  {b.office?.name && <span>{b.office.name}</span>}
                  {b.meetingDate && <span> · {new Date(b.meetingDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>}
                  {b.tags.length > 0 && <span> · {b.tags.join(', ')}</span>}
                </div>
              </div>
            </label>
          );
        })}
      </div>
    </div>
  );
}
