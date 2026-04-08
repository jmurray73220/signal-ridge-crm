import { useState, useRef } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Search, Download, Upload, ChevronRight, User } from 'lucide-react';
import { contactsApi, exportApi } from '../api';
import { EntityTypeBadge } from '../components/EntityTypeBadge';
import { ContactModal } from '../components/ContactModal';
import toast from 'react-hot-toast';
import { useAuth } from '../contexts/AuthContext';

const CSV_TEMPLATE = `firstName,lastName,rank,title,email,officePhone,cell,linkedIn,bio,tags,organizationName,chamber,subcommittee
John,Smith,COL,Legislative Director,john@example.com,202-555-0100,202-555-0101,,,Decision Maker,Sen. Tim Kaine (D-VA),,
Jane,Doe,,Staff Director,jane@example.com,202-555-0200,,,,Hill Staffer,Senate Armed Services Committee,Senate,ISO
`;

function parseCSV(text: string): Record<string, string>[] {
  const lines = text.trim().split('\n');
  if (lines.length < 2) return [];
  const headers = lines[0].split(',').map(h => h.trim());
  return lines.slice(1).map(line => {
    const values = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''));
    const row: Record<string, string> = {};
    headers.forEach((h, i) => { row[h] = values[i] || ''; });
    return row;
  });
}

function formatDate(d?: string | null) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function Contacts() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [searchParams] = useSearchParams();
  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [showModal, setShowModal] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const { data: contacts = [], isLoading } = useQuery({
    queryKey: ['contacts'],
    queryFn: () => contactsApi.list().then(r => r.data),
  });

  const filtered = contacts
    .filter(c => {
      if (!search) return true;
      const q = search.toLowerCase();
      return (
        `${c.firstName} ${c.lastName}`.toLowerCase().includes(q) ||
        c.title?.toLowerCase().includes(q) ||
        c.rank?.toLowerCase().includes(q) ||
        c.entity?.name?.toLowerCase().includes(q) ||
        c.tags?.some(t => t.toLowerCase().includes(q))
      );
    })
    .sort((a, b) => {
      const nameA = `${a.lastName} ${a.firstName}`.toLowerCase();
      const nameB = `${b.lastName} ${b.firstName}`.toLowerCase();
      return sortDir === 'asc' ? nameA.localeCompare(nameB) : nameB.localeCompare(nameA);
    });

  const handleExport = async () => {
    try {
      const res = await exportApi.contacts();
      const url = URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a');
      a.href = url;
      a.download = 'contacts.csv';
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error('Export failed');
    }
  };

  const handleDownloadTemplate = () => {
    const blob = new Blob([CSV_TEMPLATE], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'contacts_import_template.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    try {
      const text = await file.text();
      const rows = parseCSV(text);
      if (rows.length === 0) {
        toast.error('No data rows found in CSV');
        return;
      }
      const res = await contactsApi.import(rows);
      const data = res.data;
      toast.success(`Imported ${data.created} contact(s)${data.skipped ? `, ${data.skipped} skipped` : ''}`);
      if (data.errors.length > 0) {
        data.errors.slice(0, 3).forEach(err => toast.error(err));
      }
      qc.invalidateQueries({ queryKey: ['contacts'] });
    } catch {
      toast.error('Import failed');
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold" style={{ color: '#e6edf3' }}>Contacts</h1>
          <p className="text-sm mt-0.5" style={{ color: '#8b949e' }}>{contacts.length} total</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleExport} className="btn-secondary flex items-center gap-1.5 text-sm">
            <Download size={14} /> Export CSV
          </button>
          {user?.role !== 'Viewer' && (
            <>
              <div className="relative">
                <button
                  onClick={() => fileRef.current?.click()}
                  disabled={importing}
                  className="btn-secondary flex items-center gap-1.5 text-sm"
                >
                  <Upload size={14} /> {importing ? 'Importing…' : 'Import CSV'}
                </button>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".csv"
                  className="hidden"
                  onChange={handleImportFile}
                />
              </div>
              <button onClick={handleDownloadTemplate} className="btn-secondary flex items-center gap-1.5 text-sm" title="Download import template">
                <Download size={14} /> Template
              </button>
              <button onClick={() => setShowModal(true)} className="btn-primary flex items-center gap-1.5 text-sm">
                <Plus size={14} /> Add Contact
              </button>
            </>
          )}
        </div>
      </div>

      {/* Search */}
      <div className="relative mb-4 max-w-md">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#8b949e' }} />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by name, title, org, or tag…"
          className="input pl-9"
        />
      </div>

      {/* Table */}
      <div className="card p-0 overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-sm" style={{ color: '#8b949e' }}>Loading contacts…</div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center">
            <User size={40} className="mx-auto mb-3" style={{ color: '#30363d' }} />
            <p className="text-sm mb-3" style={{ color: '#8b949e' }}>
              {search ? 'No contacts match your search.' : 'No contacts yet.'}
            </p>
            {!search && user?.role !== 'Viewer' && (
              <button onClick={() => setShowModal(true)} className="btn-primary text-sm">
                Add First Contact
              </button>
            )}
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr style={{ borderBottom: '1px solid #30363d' }}>
                <th
                  className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider cursor-pointer select-none"
                  style={{ color: '#8b949e' }}
                  onClick={() => setSortDir(d => d === 'asc' ? 'desc' : 'asc')}
                >
                  Name {sortDir === 'asc' ? '↑' : '↓'}
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider" style={{ color: '#8b949e' }}>Rank / Title</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider" style={{ color: '#8b949e' }}>Organization</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider" style={{ color: '#8b949e' }}>Tags</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider" style={{ color: '#8b949e' }}>Last Interaction</th>
                <th className="px-4 py-3 w-8" />
              </tr>
            </thead>
            <tbody>
              {filtered.map(contact => (
                <tr key={contact.id} className="table-row" onClick={() => navigate(`/contacts/${contact.id}`)}>
                  <td className="px-4 py-3">
                    <Link
                      to={`/contacts/${contact.id}`}
                      className="text-sm font-medium hover:text-accent transition-colors"
                      style={{ color: '#e6edf3', textDecoration: 'none' }}
                    >
                      {contact.firstName} {contact.lastName}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    {(() => {
                      const isCommittee = contact.entity?.name?.toLowerCase().includes('committee');
                      return (
                        <div className="text-sm" style={{ color: '#e6edf3' }}>
                          {contact.rank && !isCommittee && <span className="font-medium">{contact.rank} </span>}
                          {contact.title}
                        </div>
                      );
                    })()}
                  </td>
                  <td className="px-4 py-3">
                    {contact.entity ? (
                      <div className="flex items-center gap-2">
                        <EntityTypeBadge
                          entityType={contact.entity.entityType}
                          chamber={contact.entity.chamber}
                          governmentType={contact.entity.governmentType}
                          showAsHill={contact.entity.entityType === 'CongressionalOffice'}
                        />
                        <Link
                          to={`/entities/${contact.entity.id}`}
                          className="text-sm hover:text-accent transition-colors"
                          style={{ color: '#8b949e', textDecoration: 'none' }}
                        >
                          {contact.entity.name}{contact.rank && contact.entity.name?.toLowerCase().includes('committee') ? `/${contact.rank}` : ''}
                        </Link>
                      </div>
                    ) : (
                      <span className="text-sm" style={{ color: '#8b949e' }}>—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {(contact.tags || []).slice(0, 3).map(tag => (
                        <span
                          key={tag}
                          className="badge"
                          style={{ background: '#161b22', color: '#8b949e', border: '1px solid #30363d' }}
                        >
                          {tag}
                        </span>
                      ))}
                      {(contact.tags || []).length > 3 && (
                        <span className="badge" style={{ background: '#161b22', color: '#8b949e' }}>
                          +{contact.tags.length - 3}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm" style={{ color: '#8b949e' }}>
                    {formatDate(contact.lastInteraction)}
                  </td>
                  <td className="px-4 py-3">
                    <Link to={`/contacts/${contact.id}`}>
                      <ChevronRight size={16} style={{ color: '#30363d' }} />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showModal && (
        <ContactModal
          onClose={() => setShowModal(false)}
          onSave={() => {
            setShowModal(false);
            qc.invalidateQueries({ queryKey: ['contacts'] });
            toast.success('Contact created');
          }}
        />
      )}
    </div>
  );
}
