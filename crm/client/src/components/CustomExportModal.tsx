import { useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { X, Download } from 'lucide-react';
import { entitiesApi, contactsApi } from '../api';
import toast from 'react-hot-toast';
import type { Entity } from '../types';

interface Props {
  onClose: () => void;
}

const CONTACT_FIELDS = [
  { key: 'lastName', label: 'Last Name', default: true },
  { key: 'firstName', label: 'First Name', default: true },
  { key: 'rank', label: 'Rank' },
  { key: 'title', label: 'Title', default: true },
  { key: 'organization', label: 'Organization', default: true },
  { key: 'orgType', label: 'Org Type' },
  { key: 'email', label: 'Email', default: true },
  { key: 'officePhone', label: 'Office Phone' },
  { key: 'cell', label: 'Cell' },
  { key: 'linkedIn', label: 'LinkedIn' },
  { key: 'tags', label: 'Tags' },
  { key: 'bio', label: 'Bio' },
  { key: 'lastInteraction', label: 'Last Interaction' },
];

function ClientAutocomplete({
  value,
  onChange,
  clients,
}: {
  value: string;
  onChange: (id: string) => void;
  clients: Entity[];
}) {
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const selected = clients.find(c => c.id === value);

  useEffect(() => {
    if (selected) setSearch(selected.name);
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
    ? clients.filter(c => c.name.toLowerCase().includes(search.toLowerCase()))
    : clients;

  return (
    <div ref={ref} className="relative">
      <label className="label">Filter by Client (optional)</label>
      <input
        className="input"
        value={search}
        onChange={e => {
          setSearch(e.target.value);
          setOpen(true);
          if (!e.target.value) onChange('');
        }}
        onFocus={() => setOpen(true)}
        placeholder="All contacts, or type to filter by client…"
      />
      {open && filtered.length > 0 && (
        <div
          className="absolute z-50 w-full mt-1 max-h-48 overflow-y-auto rounded-lg shadow-lg"
          style={{ background: '#1c2333', border: '1px solid #30363d' }}
        >
          {filtered.slice(0, 20).map(c => (
            <button
              key={c.id}
              type="button"
              onClick={() => { onChange(c.id); setSearch(c.name); setOpen(false); }}
              className="w-full text-left px-3 py-2 text-sm transition-colors hover:bg-white/5"
              style={{
                color: c.id === value ? '#c9a84c' : '#e6edf3',
                background: c.id === value ? 'rgba(201,168,76,0.1)' : 'transparent',
                borderBottom: '1px solid #30363d',
              }}
            >
              {c.name}
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

export function CustomExportModal({ onClose }: Props) {
  const [clientId, setClientId] = useState('');
  const [selectedFields, setSelectedFields] = useState<Set<string>>(
    new Set(CONTACT_FIELDS.filter(f => f.default).map(f => f.key))
  );
  const [includeTagged, setIncludeTagged] = useState(true);

  const { data: entities = [] } = useQuery({
    queryKey: ['entities', 'Client'],
    queryFn: () => entitiesApi.list({ type: 'Client' }).then(r => r.data),
  });
  const { data: allContacts = [] } = useQuery({
    queryKey: ['contacts'],
    queryFn: () => contactsApi.list().then(r => r.data),
  });

  const toggleField = (key: string) => {
    setSelectedFields(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const selectAll = () => setSelectedFields(new Set(CONTACT_FIELDS.map(f => f.key)));
  const selectNone = () => setSelectedFields(new Set());

  const handleExport = () => {
    const client = entities.find(e => e.id === clientId);

    // Filter contacts
    let contacts = allContacts;
    if (clientId && client) {
      const directContacts = allContacts.filter(c => c.entityId === clientId);
      const taggedContacts = includeTagged
        ? allContacts.filter(c =>
            c.entityId !== clientId &&
            (c.tags || []).some(t => t.toLowerCase() === client.name.toLowerCase())
          )
        : [];
      contacts = [...directContacts, ...taggedContacts];
    }

    if (contacts.length === 0) {
      toast.error('No contacts match your filters');
      return;
    }

    // Build CSV
    const fields = CONTACT_FIELDS.filter(f => selectedFields.has(f.key));
    const headers = fields.map(f => f.label);

    const rows = contacts.map(c => {
      return fields.map(f => {
        switch (f.key) {
          case 'firstName': return c.firstName;
          case 'lastName': return c.lastName;
          case 'rank': return c.rank || '';
          case 'title': return c.title || '';
          case 'organization': return c.entity?.name || '';
          case 'orgType': return c.entity?.entityType || '';
          case 'email': return c.email || '';
          case 'officePhone': return c.officePhone || '';
          case 'cell': return c.cell || '';
          case 'linkedIn': return c.linkedIn || '';
          case 'tags': return (c.tags || []).join('; ');
          case 'bio': return c.bio || '';
          case 'lastInteraction': return c.lastInteraction
            ? new Date(c.lastInteraction).toLocaleDateString()
            : '';
          default: return '';
        }
      });
    });

    const escape = (val: string) => `"${val.replace(/"/g, '""')}"`;
    const csv = [
      headers.map(escape).join(','),
      ...rows.map(row => row.map(cell => escape(String(cell ?? ''))).join(',')),
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = client ? `${client.name.replace(/\s+/g, '_')}_contacts.csv` : 'custom_export.csv';
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${contacts.length} contacts`);
    onClose();
  };

  // Preview count
  const client = entities.find(e => e.id === clientId);
  let previewCount = allContacts.length;
  if (clientId && client) {
    const direct = allContacts.filter(c => c.entityId === clientId).length;
    const tagged = includeTagged
      ? allContacts.filter(c => c.entityId !== clientId && (c.tags || []).some(t => t.toLowerCase() === client.name.toLowerCase())).length
      : 0;
    previewCount = direct + tagged;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)' }}>
      <div className="w-full max-w-md rounded-xl overflow-hidden" style={{ background: '#1c2333', border: '1px solid #30363d' }}>
        <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid #30363d' }}>
          <h2 className="text-base font-semibold" style={{ color: '#e6edf3' }}>Custom Export</h2>
          <button onClick={onClose} style={{ color: '#8b949e' }}><X size={18} /></button>
        </div>

        <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
          <ClientAutocomplete
            value={clientId}
            onChange={setClientId}
            clients={entities}
          />

          {clientId && (
            <label className="flex items-center gap-2 text-sm" style={{ color: '#8b949e' }}>
              <input
                type="checkbox"
                checked={includeTagged}
                onChange={e => setIncludeTagged(e.target.checked)}
                className="rounded"
              />
              Include contacts tagged with client name
            </label>
          )}

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="label mb-0">Columns to Export</label>
              <div className="flex gap-2">
                <button onClick={selectAll} className="text-xs hover:opacity-80" style={{ color: '#c9a84c' }}>All</button>
                <button onClick={selectNone} className="text-xs hover:opacity-80" style={{ color: '#8b949e' }}>None</button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-1">
              {CONTACT_FIELDS.map(f => (
                <label
                  key={f.key}
                  className="flex items-center gap-2 text-sm py-1 px-2 rounded cursor-pointer hover:bg-white/5"
                  style={{ color: selectedFields.has(f.key) ? '#e6edf3' : '#8b949e' }}
                >
                  <input
                    type="checkbox"
                    checked={selectedFields.has(f.key)}
                    onChange={() => toggleField(f.key)}
                    className="rounded"
                  />
                  {f.label}
                </label>
              ))}
            </div>
          </div>

          <div className="text-xs" style={{ color: '#8b949e' }}>
            {previewCount} contact{previewCount !== 1 ? 's' : ''} will be exported
            with {selectedFields.size} column{selectedFields.size !== 1 ? 's' : ''}
          </div>
        </div>

        <div className="flex justify-end gap-3 px-6 py-4" style={{ borderTop: '1px solid #30363d' }}>
          <button onClick={onClose} className="btn-secondary">Cancel</button>
          <button
            onClick={handleExport}
            disabled={selectedFields.size === 0}
            className="btn-primary flex items-center gap-1.5 text-sm"
          >
            <Download size={14} /> Export CSV
          </button>
        </div>
      </div>
    </div>
  );
}
