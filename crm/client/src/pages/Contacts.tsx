import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Search, Download, ChevronRight, User } from 'lucide-react';
import { contactsApi, exportApi } from '../api';
import { EntityTypeBadge } from '../components/EntityTypeBadge';
import { ContactModal } from '../components/ContactModal';
import toast from 'react-hot-toast';
import { useAuth } from '../contexts/AuthContext';

function formatDate(d?: string | null) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function Contacts() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);

  const { data: contacts = [], isLoading } = useQuery({
    queryKey: ['contacts'],
    queryFn: () => contactsApi.list().then(r => r.data),
  });

  const filtered = contacts.filter(c => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      `${c.firstName} ${c.lastName}`.toLowerCase().includes(q) ||
      c.title?.toLowerCase().includes(q) ||
      c.rank?.toLowerCase().includes(q) ||
      c.entity?.name?.toLowerCase().includes(q) ||
      c.tags?.some(t => t.toLowerCase().includes(q))
    );
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
            <button onClick={() => setShowModal(true)} className="btn-primary flex items-center gap-1.5 text-sm">
              <Plus size={14} /> Add Contact
            </button>
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
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider" style={{ color: '#8b949e' }}>Name</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider" style={{ color: '#8b949e' }}>Rank / Title</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider" style={{ color: '#8b949e' }}>Organization</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider" style={{ color: '#8b949e' }}>Tags</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider" style={{ color: '#8b949e' }}>Last Interaction</th>
                <th className="px-4 py-3 w-8" />
              </tr>
            </thead>
            <tbody>
              {filtered.map(contact => (
                <tr key={contact.id} className="table-row">
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
                    <div className="text-sm" style={{ color: '#e6edf3' }}>
                      {contact.rank && <span className="font-medium">{contact.rank} </span>}
                      {contact.title}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {contact.entity ? (
                      <div className="flex items-center gap-2">
                        <EntityTypeBadge
                          entityType={contact.entity.entityType}
                          chamber={contact.entity.chamber}
                          governmentType={contact.entity.governmentType}
                        />
                        <Link
                          to={`/entities/${contact.entity.id}`}
                          className="text-sm hover:text-accent transition-colors"
                          style={{ color: '#8b949e', textDecoration: 'none' }}
                        >
                          {contact.entity.name}
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
