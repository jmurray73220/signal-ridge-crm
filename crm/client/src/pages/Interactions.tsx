import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Search, Download, Filter, ExternalLink, MessageSquare, Trash2 } from 'lucide-react';
import { interactionsApi, exportApi } from '../api';
import { EntityTypeBadge } from '../components/EntityTypeBadge';
import { LogInteractionModal } from '../components/LogInteractionModal';
import toast from 'react-hot-toast';
import { useAuth } from '../contexts/AuthContext';
import type { Interaction } from '../types';

const INTERACTION_TYPES = ['Meeting', 'Call', 'Email', 'Hearing', 'Briefing', 'Event', 'Other'];

const TYPE_COLORS: Record<string, string> = {
  Meeting: '#c9a84c',
  Call: '#60a5fa',
  Email: '#8b949e',
  Hearing: '#f472b6',
  Briefing: '#34d399',
  Event: '#a78bfa',
  Other: '#8b949e',
};

function formatDateFull(d: string | Date) {
  return new Date(d).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
}

function InteractionTypeBadge({ type }: { type: string }) {
  return (
    <span className="badge" style={{ background: `${TYPE_COLORS[type] || '#8b949e'}22`, color: TYPE_COLORS[type] || '#8b949e' }}>
      {type}
    </span>
  );
}

// Group interactions by month
function groupByMonth(interactions: Interaction[]) {
  const groups: { label: string; items: Interaction[] }[] = [];
  const map = new Map<string, Interaction[]>();

  for (const i of interactions) {
    const d = new Date(i.date);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(i);
  }

  for (const [key, items] of map) {
    const [year, month] = key.split('-');
    const label = new Date(parseInt(year), parseInt(month) - 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    groups.push({ label, items });
  }

  return groups;
}

export function Interactions() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterFrom, setFilterFrom] = useState('');
  const [filterTo, setFilterTo] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const queryParams: Record<string, string> = {};
  if (filterType) queryParams.type = filterType;
  if (filterFrom) queryParams.from = filterFrom;
  if (filterTo) queryParams.to = filterTo;

  const { data: interactions = [], isLoading } = useQuery({
    queryKey: ['interactions', queryParams],
    queryFn: () => interactionsApi.list(queryParams).then(r => r.data),
  });

  const deleteInteraction = useMutation({
    mutationFn: (id: string) => interactionsApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['interactions'] });
      setConfirmDeleteId(null);
      toast.success('Interaction deleted');
    },
    onError: () => toast.error('Failed to delete interaction'),
  });

  const filtered = interactions.filter(i => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      i.subject.toLowerCase().includes(q) ||
      i.notes?.toLowerCase().includes(q) ||
      i.entity?.name.toLowerCase().includes(q) ||
      i.contacts.some(ic => `${ic.contact.firstName} ${ic.contact.lastName}`.toLowerCase().includes(q))
    );
  });

  const groups = groupByMonth(filtered);

  const handleExport = async () => {
    try {
      const res = await exportApi.interactions();
      const url = URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a');
      a.href = url; a.download = 'interactions.csv'; a.click();
      URL.revokeObjectURL(url);
    } catch { toast.error('Export failed'); }
  };

  const activeFilters = [filterType, filterFrom, filterTo].filter(Boolean).length;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold" style={{ color: '#e6edf3' }}>Interactions</h1>
          <p className="text-sm mt-0.5" style={{ color: '#8b949e' }}>{interactions.length} total interactions logged</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleExport} className="btn-secondary flex items-center gap-1.5 text-sm">
            <Download size={14} /> Export CSV
          </button>
          {user?.role !== 'Viewer' && (
            <button onClick={() => setShowModal(true)} className="btn-primary flex items-center gap-1.5 text-sm">
              <Plus size={14} /> Log Interaction
            </button>
          )}
        </div>
      </div>

      {/* Search + Filters */}
      <div className="flex gap-3 mb-4 flex-wrap">
        <div className="relative flex-1 min-w-64">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#8b949e' }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search subject, notes, contacts…" className="input pl-9" />
        </div>
        <select className="input w-auto" value={filterType} onChange={e => setFilterType(e.target.value)}>
          <option value="">All Types</option>
          {INTERACTION_TYPES.map(t => <option key={t}>{t}</option>)}
        </select>
        <button
          onClick={() => setShowFilters(f => !f)}
          className="btn-secondary flex items-center gap-1.5 text-sm relative"
        >
          <Filter size={14} /> Filters
          {activeFilters > 0 && (
            <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full text-xs flex items-center justify-center" style={{ background: '#c9a84c', color: '#0d1117' }}>
              {activeFilters}
            </span>
          )}
        </button>
      </div>

      {showFilters && (
        <div className="card mb-4 flex gap-4 flex-wrap">
          <div>
            <label className="label">From Date</label>
            <input type="date" className="input" value={filterFrom} onChange={e => setFilterFrom(e.target.value)} />
          </div>
          <div>
            <label className="label">To Date</label>
            <input type="date" className="input" value={filterTo} onChange={e => setFilterTo(e.target.value)} />
          </div>
          {(filterFrom || filterTo) && (
            <div className="flex items-end">
              <button onClick={() => { setFilterFrom(''); setFilterTo(''); }} className="btn-secondary text-sm">Clear Dates</button>
            </div>
          )}
        </div>
      )}

      {/* Feed */}
      {isLoading ? (
        <div className="text-center p-12 text-sm" style={{ color: '#8b949e' }}>Loading…</div>
      ) : filtered.length === 0 ? (
        <div className="card text-center py-16">
          <MessageSquare size={48} className="mx-auto mb-4" style={{ color: '#30363d' }} />
          <p className="text-sm mb-4" style={{ color: '#8b949e' }}>
            {search || filterType ? 'No interactions match your filters.' : 'No interactions logged yet.'}
          </p>
          {!search && !filterType && user?.role !== 'Viewer' && (
            <button onClick={() => setShowModal(true)} className="btn-primary text-sm">Log First Interaction</button>
          )}
        </div>
      ) : (
        <div className="space-y-8">
          {groups.map(group => (
            <div key={group.label}>
              <div className="flex items-center gap-3 mb-3">
                <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: '#8b949e' }}>{group.label}</span>
                <div className="flex-1 h-px" style={{ background: '#30363d' }} />
                <span className="text-xs" style={{ color: '#8b949e' }}>{group.items.length}</span>
              </div>
              <div className="space-y-3">
                {group.items.map(interaction => (
                  <div key={interaction.id} className="card hover:border-accent/50 transition-colors">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2 flex-wrap">
                          <InteractionTypeBadge type={interaction.type} />
                          <span className="text-xs font-medium" style={{ color: '#8b949e' }}>{formatDateFull(interaction.date)}</span>
                          {interaction.gmailThreadUrl && (
                            <a
                              href={interaction.gmailThreadUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1 text-xs hover:opacity-80"
                              style={{ color: '#c9a84c', textDecoration: 'none' }}
                            >
                              <ExternalLink size={11} /> Gmail Thread
                            </a>
                          )}
                        </div>

                        <div className="text-sm font-medium mb-2" style={{ color: '#e6edf3' }}>{interaction.subject}</div>

                        {interaction.notes && (
                          <p className="text-sm leading-relaxed mb-3" style={{ color: '#8b949e', whiteSpace: 'pre-wrap' }}>
                            {interaction.notes.length > 400 ? interaction.notes.slice(0, 400) + '…' : interaction.notes}
                          </p>
                        )}

                        <div className="flex items-center gap-4 flex-wrap">
                          {interaction.entity && (
                            <div className="flex items-center gap-1.5">
                              <EntityTypeBadge
                                entityType={interaction.entity.entityType}
                                chamber={interaction.entity.chamber}
                                governmentType={interaction.entity.governmentType}
                              />
                              <Link to={`/entities/${interaction.entity.id}`} className="text-xs hover:opacity-80" style={{ color: '#8b949e', textDecoration: 'none' }}>
                                {interaction.entity.name}
                              </Link>
                            </div>
                          )}
                          {interaction.contacts.length > 0 && (
                            <div className="flex items-center gap-1.5 flex-wrap">
                              {interaction.contacts.map(ic => (
                                <Link
                                  key={ic.contactId}
                                  to={`/contacts/${ic.contactId}`}
                                  className="text-xs hover:opacity-80"
                                  style={{ color: '#c9a84c', textDecoration: 'none' }}
                                >
                                  {ic.contact.firstName} {ic.contact.lastName}
                                </Link>
                              ))}
                            </div>
                          )}
                          {interaction.initiative && (
                            <Link to={`/initiatives/${interaction.initiative.id}`} className="text-xs" style={{ color: '#8b949e', textDecoration: 'none' }}>
                              → {interaction.initiative.title}
                            </Link>
                          )}
                        </div>
                      </div>

                      {user?.role === 'Admin' && (
                        <button
                          onClick={() => setConfirmDeleteId(interaction.id)}
                          className="flex-shrink-0 hover:opacity-80 transition-opacity"
                          style={{ color: '#30363d' }}
                          title="Delete interaction"
                        >
                          <Trash2 size={15} />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Log Interaction Modal */}
      {showModal && (
        <LogInteractionModal
          onClose={() => setShowModal(false)}
          onSave={() => {
            setShowModal(false);
            qc.invalidateQueries({ queryKey: ['interactions'] });
            toast.success('Interaction logged');
          }}
        />
      )}

      {/* Delete confirmation */}
      {confirmDeleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)' }}>
          <div className="rounded-xl p-6 max-w-sm w-full" style={{ background: '#1c2333', border: '1px solid #30363d' }}>
            <h3 className="text-base font-semibold mb-2" style={{ color: '#e6edf3' }}>Delete Interaction?</h3>
            <p className="text-sm mb-6" style={{ color: '#8b949e' }}>This will permanently delete this interaction record.</p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setConfirmDeleteId(null)} className="btn-secondary">Cancel</button>
              <button onClick={() => deleteInteraction.mutate(confirmDeleteId)} className="btn-danger">Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
