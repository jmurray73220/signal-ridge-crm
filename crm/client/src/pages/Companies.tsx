import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Search, Download, ChevronRight, Factory } from 'lucide-react';
import { entitiesApi, exportApi } from '../api';
import { EntityModal } from '../components/EntityModal';
import toast from 'react-hot-toast';
import { useAuth } from '../contexts/AuthContext';

function formatDate(d?: string | null) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function Companies() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);

  const { data: entities = [], isLoading } = useQuery({
    queryKey: ['entities', 'Company'],
    queryFn: () => entitiesApi.list({ type: 'Company' }).then(r => r.data),
  });

  const filtered = entities.filter(e => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      e.name.toLowerCase().includes(q) ||
      e.industry?.toLowerCase().includes(q) ||
      (e.contractVehicles || []).some(v => v.toLowerCase().includes(q)) ||
      (e.tags || []).some(t => t.toLowerCase().includes(q))
    );
  });

  const handleExport = async () => {
    try {
      const res = await exportApi.entities('Company');
      const url = URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a');
      a.href = url; a.download = 'companies.csv'; a.click();
      URL.revokeObjectURL(url);
    } catch { toast.error('Export failed'); }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold" style={{ color: '#e6edf3' }}>Companies</h1>
          <p className="text-sm mt-0.5" style={{ color: '#8b949e' }}>{entities.length} companies tracked</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleExport} className="btn-secondary flex items-center gap-1.5 text-sm">
            <Download size={14} /> Export CSV
          </button>
          {user?.role !== 'Viewer' && (
            <button onClick={() => setShowModal(true)} className="btn-primary flex items-center gap-1.5 text-sm">
              <Plus size={14} /> Add Company
            </button>
          )}
        </div>
      </div>

      <div className="relative mb-4 max-w-md">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#8b949e' }} />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name, industry, contract vehicle…" className="input pl-9" />
      </div>

      <div className="card p-0 overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-sm" style={{ color: '#8b949e' }}>Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center">
            <Factory size={40} className="mx-auto mb-3" style={{ color: '#30363d' }} />
            <p className="text-sm mb-3" style={{ color: '#8b949e' }}>
              {search ? 'No companies match your search.' : 'No companies added yet.'}
            </p>
            {!search && user?.role !== 'Viewer' && (
              <button onClick={() => setShowModal(true)} className="btn-primary text-sm">Add Company</button>
            )}
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr style={{ borderBottom: '1px solid #30363d' }}>
                {['Name', 'Industry', 'Contract Vehicles', 'Contacts', 'Active Initiatives', 'Last Interaction'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider" style={{ color: '#8b949e' }}>{h}</th>
                ))}
                <th className="w-8" />
              </tr>
            </thead>
            <tbody>
              {filtered.map(e => (
                <tr key={e.id} className="table-row" onClick={() => navigate(`/entities/${e.id}`)}>
                  <td className="px-4 py-3">
                    <Link to={`/entities/${e.id}`} className="text-sm font-medium hover:text-accent" style={{ color: '#e6edf3', textDecoration: 'none' }}>
                      {e.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-sm" style={{ color: '#8b949e' }}>{e.industry || '—'}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {(e.contractVehicles || []).slice(0, 3).map(v => (
                        <span key={v} className="badge text-xs" style={{ background: '#161b22', color: '#8b949e', border: '1px solid #30363d' }}>{v}</span>
                      ))}
                      {(e.contractVehicles || []).length > 3 && (
                        <span className="badge text-xs" style={{ background: '#161b22', color: '#8b949e' }}>+{(e.contractVehicles || []).length - 3}</span>
                      )}
                    </div>
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
          defaultType="Company"
          onClose={() => setShowModal(false)}
          onSave={() => {
            setShowModal(false);
            qc.invalidateQueries({ queryKey: ['entities', 'Company'] });
            toast.success('Company added');
          }}
        />
      )}
    </div>
  );
}
