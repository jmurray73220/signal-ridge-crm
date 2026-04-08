import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Search, Download, ChevronRight, Landmark, Users } from 'lucide-react';
import { entitiesApi, contactsApi, exportApi } from '../api';
import { EntityTypeBadge } from '../components/EntityTypeBadge';
import { EntityModal } from '../components/EntityModal';
import { ContactModal } from '../components/ContactModal';
import toast from 'react-hot-toast';
import { useAuth } from '../contexts/AuthContext';

function formatDate(d?: string | null) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

type Tab = 'offices' | 'people';

export function Congressional() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [filterChamber, setFilterChamber] = useState('');
  const [filterParty, setFilterParty] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [showContactModal, setShowContactModal] = useState(false);
  const [tab, setTab] = useState<Tab>('offices');

  const { data: entities = [], isLoading } = useQuery({
    queryKey: ['entities', 'CongressionalOffice'],
    queryFn: () => entitiesApi.list({ type: 'CongressionalOffice' }).then(r => r.data),
  });

  const { data: allContacts = [] } = useQuery({
    queryKey: ['contacts'],
    queryFn: () => contactsApi.list().then(r => r.data),
  });

  // Congressional entity IDs for filtering contacts
  const congressionalEntityIds = new Set(entities.map(e => e.id));

  // Contacts linked to congressional entities
  const hillContacts = allContacts.filter(c => c.entityId && congressionalEntityIds.has(c.entityId));

  const filteredEntities = entities.filter(e => {
    if (filterChamber && e.chamber !== filterChamber) return false;
    if (filterParty && e.party !== filterParty) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        e.name.toLowerCase().includes(q) ||
        e.memberName?.toLowerCase().includes(q) ||
        e.state?.toLowerCase().includes(q) ||
        (e.committee || []).some(c => c.toLowerCase().includes(q))
      );
    }
    return true;
  });

  const filteredContacts = hillContacts.filter(c => {
    if (search) {
      const q = search.toLowerCase();
      return (
        `${c.firstName} ${c.lastName}`.toLowerCase().includes(q) ||
        c.title?.toLowerCase().includes(q) ||
        c.entity?.name?.toLowerCase().includes(q) ||
        c.rank?.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const handleExport = async () => {
    try {
      const res = await exportApi.entities('CongressionalOffice');
      const url = URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a');
      a.href = url; a.download = 'congressional-offices.csv'; a.click();
      URL.revokeObjectURL(url);
    } catch { toast.error('Export failed'); }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold" style={{ color: '#e6edf3' }}>Congressional</h1>
          <p className="text-sm mt-0.5" style={{ color: '#8b949e' }}>
            {entities.length} offices · {hillContacts.length} contacts
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleExport} className="btn-secondary flex items-center gap-1.5 text-sm">
            <Download size={14} /> Export CSV
          </button>
          {user?.role !== 'Viewer' && (
            <>
              {tab === 'offices' ? (
                <button onClick={() => setShowModal(true)} className="btn-primary flex items-center gap-1.5 text-sm">
                  <Plus size={14} /> Add Office
                </button>
              ) : (
                <button onClick={() => setShowContactModal(true)} className="btn-primary flex items-center gap-1.5 text-sm">
                  <Plus size={14} /> Add Contact
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-4" style={{ borderBottom: '1px solid #30363d' }}>
        {([
          ['offices', 'Offices', filteredEntities.length],
          ['people', 'People', filteredContacts.length],
        ] as [Tab, string, number][]).map(([t, label, count]) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className="px-4 py-2.5 text-sm font-medium transition-colors"
            style={{
              color: tab === t ? '#e6edf3' : '#8b949e',
              borderBottom: tab === t ? '2px solid #c9a84c' : '2px solid transparent',
              marginBottom: -1,
              background: 'transparent',
            }}
          >
            {label} <span className="ml-1 text-xs" style={{ color: '#8b949e' }}>({count})</span>
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-4 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#8b949e' }} />
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder={tab === 'offices' ? 'Search member, state, committee…' : 'Search name, title, office…'}
            className="input pl-9"
          />
        </div>
        {tab === 'offices' && (
          <>
            <select className="input w-auto" value={filterChamber} onChange={e => setFilterChamber(e.target.value)}>
              <option value="">All Chambers</option>
              <option value="Senate">Senate</option>
              <option value="House">House</option>
            </select>
            <select className="input w-auto" value={filterParty} onChange={e => setFilterParty(e.target.value)}>
              <option value="">All Parties</option>
              <option value="Republican">Republican</option>
              <option value="Democrat">Democrat</option>
              <option value="Independent">Independent</option>
            </select>
          </>
        )}
      </div>

      {/* Offices Tab */}
      {tab === 'offices' && (
        <div className="card p-0 overflow-hidden">
          {isLoading ? (
            <div className="p-8 text-center text-sm" style={{ color: '#8b949e' }}>Loading…</div>
          ) : filteredEntities.length === 0 ? (
            <div className="p-12 text-center">
              <Landmark size={40} className="mx-auto mb-3" style={{ color: '#30363d' }} />
              <p className="text-sm mb-3" style={{ color: '#8b949e' }}>
                {search || filterChamber || filterParty ? 'No offices match your filters.' : 'No congressional offices added yet.'}
              </p>
              {!search && !filterChamber && !filterParty && user?.role !== 'Viewer' && (
                <button onClick={() => setShowModal(true)} className="btn-primary text-sm">Add Office</button>
              )}
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr style={{ borderBottom: '1px solid #30363d' }}>
                  {['Member', 'Chamber', 'State/District', 'Party', 'Key Committees', 'Contacts', 'Last Interaction'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider" style={{ color: '#8b949e' }}>{h}</th>
                  ))}
                  <th className="w-8" />
                </tr>
              </thead>
              <tbody>
                {filteredEntities.map(e => (
                  <tr key={e.id} className="table-row" onClick={() => navigate(`/entities/${e.id}`)}>
                    <td className="px-4 py-3">
                      <Link to={`/entities/${e.id}`} className="text-sm font-medium hover:text-accent" style={{ color: '#e6edf3', textDecoration: 'none' }}>
                        {e.name.toLowerCase().includes('committee') ? e.name : (e.memberName || e.name)}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <EntityTypeBadge entityType={e.entityType} chamber={e.chamber} />
                    </td>
                    <td className="px-4 py-3 text-sm" style={{ color: '#8b949e' }}>
                      {e.state}{e.district ? ` — ${e.district}` : ''}
                    </td>
                    <td className="px-4 py-3">
                      {e.party && (
                        <span className="badge" style={{
                          background: e.party === 'Republican' ? '#2d1010' : e.party === 'Democrat' ? '#101a2d' : '#1a1a1a',
                          color: e.party === 'Republican' ? '#f87171' : e.party === 'Democrat' ? '#60a5fa' : '#8b949e',
                        }}>
                          {e.party === 'Republican' ? 'R' : e.party === 'Democrat' ? 'D' : 'I'}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {(e.committee || []).slice(0, 2).map(c => (
                          <span key={c} className="badge text-xs" style={{ background: '#161b22', color: '#8b949e', border: '1px solid #30363d' }}>
                            {c.replace('Senate ', '').replace('House ', '').replace(' Committee', '').slice(0, 30)}
                          </span>
                        ))}
                        {(e.committee || []).length > 2 && (
                          <span className="badge text-xs" style={{ background: '#161b22', color: '#8b949e' }}>
                            +{(e.committee || []).length - 2}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm" style={{ color: '#8b949e' }}>
                      {e._count?.contacts ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-sm" style={{ color: '#8b949e' }}>
                      {formatDate(e.lastInteraction)}
                    </td>
                    <td className="px-4 py-3">
                      <Link to={`/entities/${e.id}`}><ChevronRight size={16} style={{ color: '#30363d' }} /></Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* People Tab */}
      {tab === 'people' && (
        <div className="card p-0 overflow-hidden">
          {filteredContacts.length === 0 ? (
            <div className="p-12 text-center">
              <Users size={40} className="mx-auto mb-3" style={{ color: '#30363d' }} />
              <p className="text-sm mb-3" style={{ color: '#8b949e' }}>
                {search ? 'No contacts match your search.' : 'No Hill contacts yet.'}
              </p>
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr style={{ borderBottom: '1px solid #30363d' }}>
                  {['Name', 'Title', 'Office / Committee', 'Tags'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider" style={{ color: '#8b949e' }}>{h}</th>
                  ))}
                  <th className="w-8" />
                </tr>
              </thead>
              <tbody>
                {filteredContacts.map(c => {
                  const isCommittee = c.entity?.name?.toLowerCase().includes('committee');
                  return (
                    <tr key={c.id} className="table-row" onClick={() => navigate(`/contacts/${c.id}`)}>
                      <td className="px-4 py-3">
                        <Link to={`/contacts/${c.id}`} className="text-sm font-medium hover:text-accent" style={{ color: '#e6edf3', textDecoration: 'none' }}>
                          {c.firstName} {c.lastName}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-sm" style={{ color: '#8b949e' }}>
                        {!isCommittee && c.rank && <span className="font-medium">{c.rank} </span>}
                        {c.title}
                      </td>
                      <td className="px-4 py-3">
                        {c.entity && (
                          <div className="flex items-center gap-2">
                            <EntityTypeBadge
                              entityType={c.entity.entityType}
                              chamber={c.entity.chamber}
                            />
                            <Link
                              to={`/entities/${c.entity.id}`}
                              className="text-sm hover:text-accent"
                              style={{ color: '#8b949e', textDecoration: 'none' }}
                            >
                              {c.entity.name}{isCommittee && c.rank ? `/${c.rank}` : ''}
                            </Link>
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {(c.tags || []).slice(0, 3).map(tag => (
                            <span key={tag} className="badge" style={{ background: '#161b22', color: '#8b949e', border: '1px solid #30363d' }}>
                              {tag}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <Link to={`/contacts/${c.id}`}><ChevronRight size={16} style={{ color: '#30363d' }} /></Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {showModal && (
        <EntityModal
          defaultType="CongressionalOffice"
          onClose={() => setShowModal(false)}
          onSave={() => {
            setShowModal(false);
            qc.invalidateQueries({ queryKey: ['entities', 'CongressionalOffice'] });
            toast.success('Office added');
          }}
        />
      )}

      {showContactModal && (
        <ContactModal
          onClose={() => setShowContactModal(false)}
          onSave={() => {
            setShowContactModal(false);
            qc.invalidateQueries({ queryKey: ['contacts'] });
            toast.success('Contact created');
          }}
        />
      )}
    </div>
  );
}
