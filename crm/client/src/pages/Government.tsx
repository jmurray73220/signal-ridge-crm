import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Search, Download, ChevronRight, Building2 } from 'lucide-react';
import { entitiesApi, exportApi } from '../api';
import { EntityTypeBadge } from '../components/EntityTypeBadge';
import { EntityModal } from '../components/EntityModal';
import toast from 'react-hot-toast';
import { useAuth } from '../contexts/AuthContext';

function formatDate(d?: string | null) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function Government() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('');
  const [showModal, setShowModal] = useState(false);

  const { data: entities = [], isLoading } = useQuery({
    queryKey: ['entities', 'GovernmentOrganization'],
    queryFn: () => entitiesApi.list({ type: 'GovernmentOrganization' }).then(r => r.data),
  });

  const filtered = entities.filter(e => {
    if (filterType && e.governmentType !== filterType) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        e.name.toLowerCase().includes(q) ||
        e.parentAgency?.toLowerCase().includes(q) ||
        e.subComponent?.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const handleExport = async () => {
    try {
      const res = await exportApi.entities('GovernmentOrganization');
      const url = URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a');
      a.href = url; a.download = 'government-orgs.csv'; a.click();
      URL.revokeObjectURL(url);
    } catch { toast.error('Export failed'); }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold" style={{ color: '#e6edf3' }}>Government Organizations</h1>
          <p className="text-sm mt-0.5" style={{ color: '#8b949e' }}>{entities.length} organizations tracked</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleExport} className="btn-secondary flex items-center gap-1.5 text-sm">
            <Download size={14} /> Export CSV
          </button>
          {user?.role !== 'Viewer' && (
            <button onClick={() => setShowModal(true)} className="btn-primary flex items-center gap-1.5 text-sm">
              <Plus size={14} /> Add Organization
            </button>
          )}
        </div>
      </div>

      <div className="flex gap-3 mb-4 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#8b949e' }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search org, agency, sub-component…" className="input pl-9" />
        </div>
        <select className="input w-auto" value={filterType} onChange={e => setFilterType(e.target.value)}>
          <option value="">All Types</option>
          {['DoD', 'Intel', 'DHS', 'State', 'Other'].map(t => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>

      <div className="card p-0 overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-sm" style={{ color: '#8b949e' }}>Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center">
            <Building2 size={40} className="mx-auto mb-3" style={{ color: '#30363d' }} />
            <p className="text-sm mb-3" style={{ color: '#8b949e' }}>
              {search || filterType ? 'No organizations match your filters.' : 'No government organizations added yet.'}
            </p>
            {!search && !filterType && user?.role !== 'Viewer' && (
              <button onClick={() => setShowModal(true)} className="btn-primary text-sm">Add Organization</button>
            )}
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr style={{ borderBottom: '1px solid #30363d' }}>
                {['Organization', 'Parent Agency', 'Sub-Component', 'Type', 'Contacts', 'Active Initiatives', 'Last Interaction'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider" style={{ color: '#8b949e' }}>{h}</th>
                ))}
                <th className="w-8" />
              </tr>
            </thead>
            <tbody>
              {filtered.map(e => (
                <tr key={e.id} className="table-row">
                  <td className="px-4 py-3">
                    <Link to={`/entities/${e.id}`} className="text-sm font-medium hover:text-accent" style={{ color: '#e6edf3', textDecoration: 'none' }}>
                      {e.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-sm" style={{ color: '#8b949e' }}>{e.parentAgency || '—'}</td>
                  <td className="px-4 py-3 text-sm" style={{ color: '#8b949e' }}>{e.subComponent || '—'}</td>
                  <td className="px-4 py-3">
                    <EntityTypeBadge entityType={e.entityType} governmentType={e.governmentType} />
                  </td>
                  <td className="px-4 py-3 text-sm" style={{ color: '#8b949e' }}>{e._count?.contacts ?? '—'}</td>
                  <td className="px-4 py-3 text-sm" style={{ color: '#8b949e' }}>{e._count?.initiatives ?? '—'}</td>
                  <td className="px-4 py-3 text-sm" style={{ color: '#8b949e' }}>{formatDate(e.lastInteraction)}</td>
                  <td className="px-4 py-3"><Link to={`/entities/${e.id}`}><ChevronRight size={16} style={{ color: '#30363d' }} /></Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showModal && (
        <EntityModal
          defaultType="GovernmentOrganization"
          onClose={() => setShowModal(false)}
          onSave={() => {
            setShowModal(false);
            qc.invalidateQueries({ queryKey: ['entities', 'GovernmentOrganization'] });
            toast.success('Organization added');
          }}
        />
      )}
    </div>
  );
}
