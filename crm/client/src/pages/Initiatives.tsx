import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, List, LayoutGrid, Target, ChevronRight } from 'lucide-react';
import { initiativesApi } from '../api';
import { EntityTypeBadge } from '../components/EntityTypeBadge';
import { StatusBadge, PriorityBadge } from '../components/StatusBadge';
import { InitiativeModal } from '../components/InitiativeModal';
import toast from 'react-hot-toast';
import { useAuth } from '../contexts/AuthContext';
import type { Initiative, InitiativeStatus } from '../types';
import { formatCalendarDate } from '../utils/dates';

const STATUSES: InitiativeStatus[] = ['Pipeline', 'Active', 'OnHold', 'Closed'];

const STATUS_LABELS: Record<InitiativeStatus, string> = {
  Pipeline: 'Pipeline',
  Active: 'Active',
  OnHold: 'On Hold',
  Closed: 'Closed',
};

const STATUS_COLORS: Record<InitiativeStatus, { bg: string; border: string; header: string }> = {
  Pipeline: { bg: '#0d1117', border: '#2d1e00', header: '#9e6a03' },
  Active: { bg: '#0d1117', border: '#0f2d0f', header: '#238636' },
  OnHold: { bg: '#0d1117', border: '#2d1e00', header: '#6e5e03' },
  Closed: { bg: '#0d1117', border: '#2d0f0f', header: '#da3633' },
};

function formatDate(d?: string | null) {
  return formatCalendarDate(d) || null;
}

function InitiativeCard({ initiative }: { initiative: Initiative }) {
  return (
    <Link
      to={`/initiatives/${initiative.id}`}
      className="block p-3 rounded-lg mb-2 hover:border-accent transition-colors"
      style={{ background: '#1c2333', border: '1px solid #30363d', textDecoration: 'none' }}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="text-sm font-medium leading-snug" style={{ color: '#e6edf3' }}>{initiative.title}</div>
        <PriorityBadge priority={initiative.priority} />
      </div>
      {initiative.primaryEntity && (
        <div className="flex items-center gap-1.5 mb-2">
          <EntityTypeBadge
            entityType={initiative.primaryEntity.entityType}
            chamber={initiative.primaryEntity.chamber}
            governmentType={initiative.primaryEntity.governmentType}
          />
          <span className="text-xs truncate" style={{ color: '#8b949e' }}>{initiative.primaryEntity.name}</span>
        </div>
      )}
      <div className="flex items-center justify-between mt-1">
        {initiative._count && (
          <span className="text-xs" style={{ color: '#8b949e' }}>{initiative._count.contacts} contact{initiative._count.contacts !== 1 ? 's' : ''}</span>
        )}
        {initiative.targetDate && (
          <span className="text-xs" style={{ color: '#8b949e' }}>→ {formatDate(initiative.targetDate)}</span>
        )}
      </div>
    </Link>
  );
}

export function Initiatives() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [viewMode, setViewMode] = useState<'kanban' | 'list'>('kanban');
  const [showModal, setShowModal] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('');

  const { data: initiatives = [], isLoading } = useQuery({
    queryKey: ['initiatives'],
    queryFn: () => initiativesApi.list().then(r => r.data),
  });

  const filtered = statusFilter
    ? initiatives.filter(i => i.status === statusFilter)
    : initiatives;

  const byStatus = STATUSES.reduce((acc, s) => {
    acc[s] = filtered.filter(i => i.status === s);
    return acc;
  }, {} as Record<InitiativeStatus, Initiative[]>);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold" style={{ color: '#e6edf3' }}>Initiatives</h1>
          <p className="text-sm mt-0.5" style={{ color: '#8b949e' }}>{initiatives.length} total · {byStatus.Active?.length || 0} active</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Status filter */}
          <select className="input w-auto" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
            <option value="">All Statuses</option>
            {STATUSES.map(s => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
          </select>

          {/* View toggle */}
          <div className="flex rounded overflow-hidden" style={{ border: '1px solid #30363d' }}>
            <button
              onClick={() => setViewMode('kanban')}
              className="px-3 py-1.5 flex items-center gap-1.5 text-sm transition-colors"
              style={{ background: viewMode === 'kanban' ? '#c9a84c' : 'transparent', color: viewMode === 'kanban' ? '#0d1117' : '#8b949e' }}
            >
              <LayoutGrid size={14} /> Kanban
            </button>
            <button
              onClick={() => setViewMode('list')}
              className="px-3 py-1.5 flex items-center gap-1.5 text-sm transition-colors"
              style={{ background: viewMode === 'list' ? '#c9a84c' : 'transparent', color: viewMode === 'list' ? '#0d1117' : '#8b949e' }}
            >
              <List size={14} /> List
            </button>
          </div>

          {user?.role !== 'Viewer' && (
            <button onClick={() => setShowModal(true)} className="btn-primary flex items-center gap-1.5 text-sm">
              <Plus size={14} /> New Initiative
            </button>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="text-center p-12 text-sm" style={{ color: '#8b949e' }}>Loading…</div>
      ) : filtered.length === 0 ? (
        <div className="card text-center py-16">
          <Target size={48} className="mx-auto mb-4" style={{ color: '#30363d' }} />
          <p className="text-sm mb-4" style={{ color: '#8b949e' }}>No initiatives yet.</p>
          {user?.role !== 'Viewer' && (
            <button onClick={() => setShowModal(true)} className="btn-primary text-sm">Create First Initiative</button>
          )}
        </div>
      ) : viewMode === 'kanban' ? (
        /* Kanban View */
        <div className="grid grid-cols-4 gap-4">
          {STATUSES.map(status => {
            const cols = byStatus[status] || [];
            const colors = STATUS_COLORS[status];
            return (
              <div key={status} className="rounded-lg" style={{ background: colors.bg, border: `1px solid ${colors.border}` }}>
                <div className="px-3 py-2.5 rounded-t-lg flex items-center justify-between" style={{ borderBottom: `1px solid ${colors.border}` }}>
                  <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: colors.header }}>
                    {STATUS_LABELS[status]}
                  </span>
                  <span className="text-xs font-medium rounded-full px-1.5 py-0.5" style={{ background: `${colors.header}22`, color: colors.header }}>
                    {cols.length}
                  </span>
                </div>
                <div className="p-2">
                  {cols.length === 0 ? (
                    <div className="py-8 text-center text-xs" style={{ color: '#30363d' }}>No initiatives</div>
                  ) : cols.map(i => <InitiativeCard key={i.id} initiative={i} />)}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* List View */
        <div className="card p-0 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr style={{ borderBottom: '1px solid #30363d' }}>
                {['Title', 'Entity', 'Status', 'Priority', 'Contacts', 'Target Date'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider" style={{ color: '#8b949e' }}>{h}</th>
                ))}
                <th className="w-8" />
              </tr>
            </thead>
            <tbody>
              {filtered.map(i => (
                <tr key={i.id} className="table-row" onClick={() => navigate(`/initiatives/${i.id}`)}>
                  <td className="px-4 py-3">
                    <Link to={`/initiatives/${i.id}`} className="text-sm font-medium hover:text-accent" style={{ color: '#e6edf3', textDecoration: 'none' }}>
                      {i.title}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    {i.primaryEntity ? (
                      <div className="flex items-center gap-1.5">
                        <EntityTypeBadge entityType={i.primaryEntity.entityType} chamber={i.primaryEntity.chamber} governmentType={i.primaryEntity.governmentType} />
                        <Link to={`/entities/${i.primaryEntity.id}`} className="text-xs" style={{ color: '#8b949e', textDecoration: 'none' }}>
                          {i.primaryEntity.name}
                        </Link>
                      </div>
                    ) : <span className="text-sm" style={{ color: '#8b949e' }}>—</span>}
                  </td>
                  <td className="px-4 py-3"><StatusBadge status={i.status} /></td>
                  <td className="px-4 py-3"><PriorityBadge priority={i.priority} /></td>
                  <td className="px-4 py-3 text-sm" style={{ color: '#8b949e' }}>{i._count?.contacts ?? '—'}</td>
                  <td className="px-4 py-3 text-sm" style={{ color: '#8b949e' }}>{formatDate(i.targetDate) || '—'}</td>
                  <td className="px-4 py-3"><Link to={`/initiatives/${i.id}`}><ChevronRight size={16} style={{ color: '#30363d' }} /></Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <InitiativeModal
          onClose={() => setShowModal(false)}
          onSave={() => {
            setShowModal(false);
            qc.invalidateQueries({ queryKey: ['initiatives'] });
            toast.success('Initiative created');
          }}
        />
      )}
    </div>
  );
}
