import { useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { X, Loader2, Copy, ChevronRight, ChevronLeft, Download } from 'lucide-react';
import { entitiesApi, contactsApi, briefingApi } from '../api';
import ReactMarkdown from 'react-markdown';
import toast from 'react-hot-toast';
import type { Entity, Contact } from '../types';

interface Props {
  onClose: () => void;
}

interface WizardData {
  clientId: string;
  officeId: string;
  meetingDate: string;
  meetingTime: string;
  meetingLocation: string;
  stafferContactId: string;
  primaryAsk: string;
  rationale: string;
  talkingPointsPrompt: string;
  additionalContext: string;
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

const STEPS = [
  'Client & Office',
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
    stafferContactId: '',
    primaryAsk: '',
    rationale: '',
    talkingPointsPrompt: '',
    additionalContext: '',
  });
  const [generating, setGenerating] = useState(false);
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

  const update = (key: keyof WizardData, val: string) =>
    setData(d => ({ ...d, [key]: val }));

  const canProceed = () => {
    if (step === 0) return !!data.clientId && !!data.officeId;
    if (step === 1) return !!data.meetingDate;
    return true;
  };

  const handleGenerate = async () => {
    setGenerating(true);
    setError('');
    try {
      const res = await briefingApi.clientMeeting(data);
      setBriefing(res.data.briefing);
      setStep(4); // show result
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
      const res = await briefingApi.exportDocx(briefing, `Client_Briefing_${officeName}`);
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
  if (step === 4) {
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
      <div className="w-full max-w-lg rounded-xl overflow-hidden" style={{ background: '#1c2333', border: '1px solid #30363d' }}>
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
        <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
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
                  update('stafferContactId', '');
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
                <label className="label">Meeting With (Staffer)</label>
                {officeContacts.length > 0 ? (
                  <AutocompleteField
                    label=""
                    placeholder="Start typing staffer name…"
                    items={officeContacts.map(c => ({
                      id: c.id,
                      display: `${c.firstName} ${c.lastName}${c.title ? ` — ${c.title}` : ''}`,
                    }))}
                    value={data.stafferContactId}
                    onChange={id => update('stafferContactId', id)}
                  />
                ) : (
                  <p className="text-xs" style={{ color: '#8b949e' }}>
                    No contacts found for this office. The briefing will still be generated.
                  </p>
                )}
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <div>
                <label className="label">Primary Ask / Objectives *</label>
                <textarea
                  className="input"
                  value={data.primaryAsk}
                  onChange={e => update('primaryAsk', e.target.value)}
                  rows={3}
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
                  rows={3}
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
                  rows={3}
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
                  rows={2}
                  placeholder="Any other relevant info for the briefing…"
                  style={{ resize: 'vertical' }}
                />
              </div>
            </>
          )}

          {step === 3 && (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold" style={{ color: '#e6edf3' }}>Review Your Inputs</h3>
              {[
                ['Client', clients.find(c => c.id === data.clientId)?.name],
                ['Office', selectedOffice?.name],
                ['Date & Time', `${data.meetingDate}${data.meetingTime ? ' at ' + data.meetingTime : ''}`],
                ['Location', data.meetingLocation],
                ['Staffer', (() => {
                  const c = allContacts.find(c => c.id === data.stafferContactId);
                  return c ? `${c.firstName} ${c.lastName}` : '—';
                })()],
                ['Primary Ask', data.primaryAsk || '—'],
              ].map(([label, val]) => (
                <div key={label as string} className="flex gap-3">
                  <span className="text-xs font-medium w-24 flex-shrink-0" style={{ color: '#8b949e' }}>{label}</span>
                  <span className="text-sm" style={{ color: '#e6edf3' }}>{val || '—'}</span>
                </div>
              ))}

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

          {step < 3 ? (
            <button
              onClick={() => setStep(s => s + 1)}
              disabled={!canProceed()}
              className="btn-primary flex items-center gap-1 text-sm"
            >
              Next <ChevronRight size={14} />
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
