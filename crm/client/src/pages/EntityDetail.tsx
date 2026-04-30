import { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft, Edit2, Trash2, MessageSquare, Target,
  CheckSquare, Users, Sparkles, Plus, ExternalLink
} from 'lucide-react';
import { entitiesApi, tasksApi, contactsApi } from '../api';
import { EntityTypeBadge } from '../components/EntityTypeBadge';
import { StatusBadge, PriorityBadge } from '../components/StatusBadge';
import { EntityModal } from '../components/EntityModal';
import { ContactModal } from '../components/ContactModal';
import { LogInteractionModal } from '../components/LogInteractionModal';
import { BriefingModal } from '../components/BriefingModal';
import { ChangeLogPanel } from '../components/ChangeLogPanel';
import toast from 'react-hot-toast';
import { useAuth } from '../contexts/AuthContext';
import type { Entity, InitiativeStatus, InitiativePriority } from '../types';
import { formatCalendarDate, isOverdueDay } from '../utils/dates';

function formatDate(d?: string | null) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function InteractionTypeBadge({ type }: { type: string }) {
  const colors: Record<string, string> = {
    Meeting: '#c9a84c', Call: '#60a5fa', Email: '#8b949e',
    Hearing: '#f472b6', Briefing: '#34d399', Event: '#a78bfa', Other: '#8b949e',
  };
  return (
    <span className="badge" style={{ background: 'rgba(255,255,255,0.07)', color: colors[type] || '#8b949e' }}>{type}</span>
  );
}

type Tab = 'people' | 'contacts' | 'initiatives' | 'interactions' | 'tasks';

export function EntityDetail() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>('people');
  const [showEdit, setShowEdit] = useState(false);
  const [showAddContact, setShowAddContact] = useState(false);
  const [showLogInteraction, setShowLogInteraction] = useState(false);
  const [showBriefing, setShowBriefing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const { data: entity, isLoading, error } = useQuery({
    queryKey: ['entity', id],
    queryFn: () => entitiesApi.get(id!).then(r => r.data),
    enabled: !!id,
  });

  // Fetch all contacts for tagged contacts feature (only for Client entities)
  const { data: allContacts = [] } = useQuery({
    queryKey: ['contacts'],
    queryFn: () => contactsApi.list().then(r => r.data),
    enabled: entity?.entityType === 'Client',
  });

  const deleteEntity = useMutation({
    mutationFn: () => entitiesApi.delete(id!),
    onSuccess: () => {
      toast.success('Organization deleted');
      navigate(-1);
    },
    onError: () => toast.error('Failed to delete'),
  });

  const completeTask = useMutation({
    mutationFn: (taskId: string) => tasksApi.update(taskId, { completed: true }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['entity', id] });
      toast.success('Task completed');
    },
  });

  if (isLoading) return <div className="p-8 text-center text-sm" style={{ color: '#8b949e' }}>Loading…</div>;
  if (error || !entity) return <div className="p-8 text-center text-sm" style={{ color: '#da3633' }}>Organization not found.</div>;

  const e = entity as unknown as Record<string, unknown>;
  const contacts = (e.contacts as unknown[]) || [];
  const interactions = (e.interactions as unknown[]) || [];
  const tasks = (e.tasks as unknown[]) || [];

  // Deduplicate initiatives: primary + linked
  const primaryInitiatives = (e.initiatives as unknown[]) || [];
  const linkedInitiatives = ((e.initiativeLinks as Array<{ initiative: unknown; relationshipNote?: string }>) || []).map(l => ({ ...(l.initiative as Record<string, unknown>), _relationshipNote: l.relationshipNote }));
  const allInitiatives = [
    ...primaryInitiatives.map(i => ({ ...(i as Record<string, unknown>), _isPrimary: true })),
    ...linkedInitiatives.filter(l => !primaryInitiatives.find((p: unknown) => (p as Record<string, unknown>).id === (l as Record<string, unknown>).id)),
  ];

  const backPath =
    entity.entityType === 'CongressionalOffice' ? '/congressional' :
    entity.entityType === 'GovernmentOrganization' ? '/government' :
    entity.entityType === 'Company' ? '/companies' : '/';

  return (
    <div>
      <Link to={backPath} className="flex items-center gap-1.5 text-sm mb-4" style={{ color: '#8b949e', textDecoration: 'none' }}>
        <ArrowLeft size={14} /> Back
      </Link>

      {/* Header */}
      <div className="card mb-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-1">
              <EntityTypeBadge entityType={entity.entityType} chamber={entity.chamber} governmentType={entity.governmentType} />
              <h1 className="text-2xl font-semibold" style={{ color: '#e6edf3' }}>{entity.name}</h1>
            </div>

            {/* Type-specific metadata */}
            {entity.entityType === 'CongressionalOffice' && (
              <div className="mt-3 grid grid-cols-2 gap-x-8 gap-y-2">
                {entity.memberName && (() => {
                  const mn = entity.memberName as string;
                  const isCommittee = mn.includes(' | Ranking: ');
                  if (isCommittee) {
                    const [chair, ranking] = mn.split(' | Ranking: ');
                    return (
                      <>
                        {chair && <div><span className="text-xs" style={{ color: '#8b949e' }}>Chair: </span><span className="text-sm" style={{ color: '#e6edf3' }}>{chair}</span></div>}
                        {ranking && <div><span className="text-xs" style={{ color: '#8b949e' }}>Ranking Member: </span><span className="text-sm" style={{ color: '#e6edf3' }}>{ranking}</span></div>}
                      </>
                    );
                  }
                  const label = entity.name.toLowerCase().includes('committee') ? 'Chair' : 'Member';
                  return <div><span className="text-xs" style={{ color: '#8b949e' }}>{label}: </span><span className="text-sm" style={{ color: '#e6edf3' }}>{mn}</span></div>;
                })()}
                {entity.state && <div><span className="text-xs" style={{ color: '#8b949e' }}>State: </span><span className="text-sm" style={{ color: '#e6edf3' }}>{entity.state}{entity.district ? ` — ${entity.district}` : ''}</span></div>}
                {entity.party && (
                  <div><span className="text-xs" style={{ color: '#8b949e' }}>Party: </span>
                    <span className="text-sm" style={{ color: entity.party === 'Republican' ? '#f87171' : entity.party === 'Democrat' ? '#60a5fa' : '#e6edf3' }}>
                      {entity.party}
                    </span>
                  </div>
                )}
                {(entity.committee || []).length > 0 && (
                  <div className="col-span-2">
                    <div className="text-xs mb-1" style={{ color: '#8b949e' }}>Committees</div>
                    <div className="flex flex-wrap gap-1">
                      {(entity.committee || []).map((c: string) => (
                        <span key={c} className="badge" style={{ background: '#161b22', color: '#e6edf3', border: '1px solid #30363d' }}>{c}</span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {entity.entityType === 'GovernmentOrganization' && (
              <div className="mt-3 grid grid-cols-2 gap-x-8 gap-y-2">
                {entity.parentAgency && <div><span className="text-xs" style={{ color: '#8b949e' }}>Parent Agency: </span><span className="text-sm" style={{ color: '#e6edf3' }}>{entity.parentAgency}</span></div>}
                {entity.subComponent && <div><span className="text-xs" style={{ color: '#8b949e' }}>Sub-Component: </span><span className="text-sm" style={{ color: '#e6edf3' }}>{entity.subComponent}</span></div>}
                {entity.governmentType && <div><span className="text-xs" style={{ color: '#8b949e' }}>Type: </span><EntityTypeBadge entityType={entity.entityType} governmentType={entity.governmentType} /></div>}
                {entity.budgetLineItem && <div><span className="text-xs" style={{ color: '#8b949e' }}>Budget: </span><span className="text-sm font-mono" style={{ color: '#c9a84c' }}>{entity.budgetLineItem}</span></div>}
              </div>
            )}

            {entity.entityType === 'Company' && (
              <div className="mt-3 space-y-2">
                {entity.industry && <div><span className="text-xs" style={{ color: '#8b949e' }}>Industry: </span><span className="text-sm" style={{ color: '#e6edf3' }}>{entity.industry}</span></div>}
                {(entity.contractVehicles || []).length > 0 && (
                  <div>
                    <div className="text-xs mb-1" style={{ color: '#8b949e' }}>Contract Vehicles</div>
                    <div className="flex flex-wrap gap-1">
                      {(entity.contractVehicles || []).map((v: string) => (
                        <span key={v} className="badge" style={{ background: '#161b22', color: '#8b949e', border: '1px solid #30363d' }}>{v}</span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {entity.address && (
              <div className="mt-3 text-sm" style={{ color: '#8b949e' }}>{entity.address}</div>
            )}

            {entity.website && (
              <a href={entity.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-sm mt-3" style={{ color: '#c9a84c', textDecoration: 'none' }}>
                <ExternalLink size={13} /> {entity.website}
              </a>
            )}

            {entity.description && (
              <p className="mt-3 text-sm" style={{ color: '#8b949e' }}>{entity.description}</p>
            )}

            {(entity.tags || []).length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-3">
                {(entity.tags || []).map((tag: string) => (
                  <span key={tag} className="badge" style={{ background: '#161b22', color: '#8b949e', border: '1px solid #30363d' }}>{tag}</span>
                ))}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex flex-col gap-2 flex-shrink-0">
            <button onClick={() => setShowBriefing(true)} className="btn-secondary flex items-center gap-1.5 text-sm">
              <Sparkles size={14} /> Generate Briefing
            </button>
            {user?.role !== 'Viewer' && (
              <>
                <button onClick={() => setShowLogInteraction(true)} className="btn-secondary flex items-center gap-1.5 text-sm">
                  <MessageSquare size={14} /> Log Interaction
                </button>
                <button onClick={() => setShowEdit(true)} className="btn-secondary flex items-center gap-1.5 text-sm">
                  <Edit2 size={14} /> Edit
                </button>
                {user?.role === 'Admin' && (
                  <button onClick={() => setConfirmDelete(true)} className="btn-danger flex items-center gap-1.5 text-sm">
                    <Trash2 size={14} /> Delete
                  </button>
                )}
              </>
            )}
          </div>
        </div>

        {Boolean(e.createdBy || e.updatedBy) && (
          <div className="mt-4 pt-4 flex gap-4" style={{ borderTop: '1px solid #30363d' }}>
            {Boolean(e.createdBy) && (
              <span className="text-xs" style={{ color: '#8b949e' }}>
                Added by {(e.createdBy as { firstName: string; lastName: string }).firstName} {(e.createdBy as { firstName: string; lastName: string }).lastName} · {formatDate(entity.createdAt)}
              </span>
            )}
            {Boolean(e.updatedBy) && entity.updatedAt !== entity.createdAt && (
              <span className="text-xs" style={{ color: '#8b949e' }}>
                Last edited by {(e.updatedBy as { firstName: string; lastName: string }).firstName} {(e.updatedBy as { firstName: string; lastName: string }).lastName} · {formatDate(entity.updatedAt)}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Compute tagged contacts for Client entities */}
      {(() => {
        const isClient = entity.entityType === 'Client';
        const taggedContacts = isClient
          ? allContacts.filter(c =>
              c.entityId !== id &&
              (c.tags || []).some(t => t.toLowerCase() === entity.name.toLowerCase())
            )
          : [];

        // Group tagged contacts by entity type
        const govContacts = taggedContacts.filter(c => c.entity?.entityType === 'GovernmentOrganization');
        const congContacts = taggedContacts.filter(c => c.entity?.entityType === 'CongressionalOffice');
        const otherTagged = taggedContacts.filter(c =>
          c.entity?.entityType !== 'GovernmentOrganization' &&
          c.entity?.entityType !== 'CongressionalOffice'
        );

        return (
          <>
            {/* Tabs */}
            <div className="flex gap-1 mb-4" style={{ borderBottom: '1px solid #30363d' }}>
              {([
                ['people', isClient ? 'People' : 'People', contacts.length],
                ...(isClient ? [['contacts', 'Tagged Contacts', taggedContacts.length] as [Tab, string, number]] : []),
                ['initiatives', 'Initiatives', allInitiatives.length],
                ['interactions', 'Interactions', interactions.length],
                ['tasks', 'Tasks', tasks.length],
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

            {/* People Tab (direct employees/members) */}
            {tab === 'people' && (
              <div>
                {user?.role !== 'Viewer' && (
                  <div className="flex justify-end mb-3">
                    <button onClick={() => setShowAddContact(true)} className="btn-secondary flex items-center gap-1.5 text-sm">
                      <Plus size={14} /> Add Contact
                    </button>
                  </div>
                )}
                {contacts.length === 0 ? (
                  <div className="card text-center py-10">
                    <Users size={32} className="mx-auto mb-3" style={{ color: '#30363d' }} />
                    <p className="text-sm" style={{ color: '#8b949e' }}>No contacts associated with this organization.</p>
                  </div>
                ) : (
                  <div className="card p-0 overflow-hidden">
                    <table className="w-full">
                      <thead>
                        <tr style={{ borderBottom: '1px solid #30363d' }}>
                          {['Name', 'Rank / Title', 'Tags', 'Last Interaction'].map(h => (
                            <th key={h} className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider" style={{ color: '#8b949e' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {contacts.map((c: unknown) => {
                          const contact = c as { id: string; firstName: string; lastName: string; rank?: string; title?: string; tags?: string; interactions?: Array<{ interaction: { date: string } }> };
                          return (
                            <tr key={contact.id} className="table-row" onClick={() => navigate(`/contacts/${contact.id}`)}>
                              <td className="px-4 py-3">
                                <Link to={`/contacts/${contact.id}`} className="text-sm font-medium hover:text-accent" style={{ color: '#e6edf3', textDecoration: 'none' }}>
                                  {contact.firstName} {contact.lastName}
                                </Link>
                              </td>
                              <td className="px-4 py-3 text-sm" style={{ color: '#8b949e' }}>
                                {contact.rank && !entity.name.toLowerCase().includes('committee') && <span className="font-medium">{contact.rank} </span>}
                                {contact.title}
                                {contact.rank && entity.name.toLowerCase().includes('committee') && <span className="text-xs ml-1" style={{ color: '#8b949e' }}>({contact.rank})</span>}
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex flex-wrap gap-1">
                                  {(JSON.parse(contact.tags || '[]') as string[]).slice(0, 3).map((tag: string) => (
                                    <span key={tag} className="badge" style={{ background: '#161b22', color: '#8b949e', border: '1px solid #30363d' }}>{tag}</span>
                                  ))}
                                </div>
                              </td>
                              <td className="px-4 py-3 text-sm" style={{ color: '#8b949e' }}>
                                {formatDate(contact.interactions?.[0]?.interaction?.date)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* Tagged Contacts Tab (Client entities only) */}
            {tab === 'contacts' && isClient && (
              <div>
                {taggedContacts.length === 0 ? (
                  <div className="card text-center py-10">
                    <Users size={32} className="mx-auto mb-3" style={{ color: '#30363d' }} />
                    <p className="text-sm" style={{ color: '#8b949e' }}>No contacts tagged with "{entity.name}".</p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {/* Congressional contacts */}
                    {congContacts.length > 0 && (
                      <div>
                        <h3 className="text-xs font-semibold uppercase tracking-widest mb-2 flex items-center gap-2" style={{ color: '#60a5fa' }}>
                          Congressional ({congContacts.length})
                        </h3>
                        <div className="card p-0 overflow-hidden">
                          <table className="w-full">
                            <thead>
                              <tr style={{ borderBottom: '1px solid #30363d' }}>
                                {['Name', 'Title', 'Office', 'Party'].map(h => (
                                  <th key={h} className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wider" style={{ color: '#8b949e' }}>{h}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {congContacts.map(c => (
                                <tr key={c.id} className="table-row" onClick={() => navigate(`/contacts/${c.id}`)}>
                                  <td className="px-4 py-2">
                                    <Link to={`/contacts/${c.id}`} className="text-sm font-medium" style={{ color: '#e6edf3', textDecoration: 'none' }}>
                                      {c.firstName} {c.lastName}
                                    </Link>
                                  </td>
                                  <td className="px-4 py-2 text-sm" style={{ color: '#8b949e' }}>{c.title || '—'}</td>
                                  <td className="px-4 py-2">
                                    <Link to={`/entities/${c.entity?.id}`} className="text-xs" style={{ color: '#8b949e', textDecoration: 'none' }}>
                                      {c.entity?.name}
                                    </Link>
                                  </td>
                                  <td className="px-4 py-2 text-xs" style={{ color: c.entity?.party === 'Democrat' ? '#60a5fa' : c.entity?.party === 'Republican' ? '#f87171' : '#8b949e' }}>
                                    {c.entity?.party || '—'}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {/* Government org contacts */}
                    {govContacts.length > 0 && (
                      <div>
                        <h3 className="text-xs font-semibold uppercase tracking-widest mb-2 flex items-center gap-2" style={{ color: '#34d399' }}>
                          Government Organizations ({govContacts.length})
                        </h3>
                        <div className="card p-0 overflow-hidden">
                          <table className="w-full">
                            <thead>
                              <tr style={{ borderBottom: '1px solid #30363d' }}>
                                {['Name', 'Title', 'Organization'].map(h => (
                                  <th key={h} className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wider" style={{ color: '#8b949e' }}>{h}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {govContacts.map(c => (
                                <tr key={c.id} className="table-row" onClick={() => navigate(`/contacts/${c.id}`)}>
                                  <td className="px-4 py-2">
                                    <Link to={`/contacts/${c.id}`} className="text-sm font-medium" style={{ color: '#e6edf3', textDecoration: 'none' }}>
                                      {c.firstName} {c.lastName}
                                    </Link>
                                  </td>
                                  <td className="px-4 py-2 text-sm" style={{ color: '#8b949e' }}>{c.title || '—'}</td>
                                  <td className="px-4 py-2">
                                    <Link to={`/entities/${c.entity?.id}`} className="text-xs" style={{ color: '#8b949e', textDecoration: 'none' }}>
                                      {c.entity?.name}
                                    </Link>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {/* Other tagged contacts */}
                    {otherTagged.length > 0 && (
                      <div>
                        <h3 className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: '#8b949e' }}>
                          Other ({otherTagged.length})
                        </h3>
                        <div className="card p-0 overflow-hidden">
                          <table className="w-full">
                            <thead>
                              <tr style={{ borderBottom: '1px solid #30363d' }}>
                                {['Name', 'Title', 'Organization'].map(h => (
                                  <th key={h} className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wider" style={{ color: '#8b949e' }}>{h}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {otherTagged.map(c => (
                                <tr key={c.id} className="table-row" onClick={() => navigate(`/contacts/${c.id}`)}>
                                  <td className="px-4 py-2">
                                    <Link to={`/contacts/${c.id}`} className="text-sm font-medium" style={{ color: '#e6edf3', textDecoration: 'none' }}>
                                      {c.firstName} {c.lastName}
                                    </Link>
                                  </td>
                                  <td className="px-4 py-2 text-sm" style={{ color: '#8b949e' }}>{c.title || '—'}</td>
                                  <td className="px-4 py-2 text-xs" style={{ color: '#8b949e' }}>{c.entity?.name || '—'}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </>
        );
      })()}

      {/* Initiatives Tab */}
      {tab === 'initiatives' && (
        <div>
          {user?.role !== 'Viewer' && (
            <div className="flex justify-end mb-3">
              <Link to="/initiatives" className="btn-secondary flex items-center gap-1.5 text-sm">
                <Plus size={14} /> Create Initiative
              </Link>
            </div>
          )}
          {allInitiatives.length === 0 ? (
            <div className="card text-center py-10">
              <Target size={32} className="mx-auto mb-3" style={{ color: '#30363d' }} />
              <p className="text-sm" style={{ color: '#8b949e' }}>No initiatives linked to this organization.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {allInitiatives.map((i: unknown) => {
                const initiative = i as { id: string; title: string; status: InitiativeStatus; priority: InitiativePriority; targetDate?: string; _isPrimary?: boolean; _relationshipNote?: string };
                return (
                  <div key={initiative.id} className="card flex items-center justify-between gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <Link to={`/initiatives/${initiative.id}`} className="text-sm font-medium hover:text-accent" style={{ color: '#e6edf3', textDecoration: 'none' }}>
                          {initiative.title}
                        </Link>
                        {initiative._isPrimary && <span className="badge" style={{ background: 'rgba(201,168,76,0.1)', color: '#c9a84c', border: '1px solid rgba(201,168,76,0.2)', fontSize: 10 }}>Primary</span>}
                      </div>
                      {initiative._relationshipNote && <div className="text-xs" style={{ color: '#8b949e' }}>{initiative._relationshipNote}</div>}
                      {initiative.targetDate && <div className="text-xs" style={{ color: '#8b949e' }}>Target: {formatCalendarDate(initiative.targetDate)}</div>}
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <StatusBadge status={initiative.status} />
                      <PriorityBadge priority={initiative.priority} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Interactions Tab */}
      {tab === 'interactions' && (
        <div>
          {user?.role !== 'Viewer' && (
            <div className="flex justify-end mb-3">
              <button onClick={() => setShowLogInteraction(true)} className="btn-secondary flex items-center gap-1.5 text-sm">
                <Plus size={14} /> Log Interaction
              </button>
            </div>
          )}
          {interactions.length === 0 ? (
            <div className="card text-center py-10">
              <MessageSquare size={32} className="mx-auto mb-3" style={{ color: '#30363d' }} />
              <p className="text-sm" style={{ color: '#8b949e' }}>No interactions logged for this organization.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {interactions.map((i: unknown) => {
                const interaction = i as { id: string; type: string; date: string; subject: string; notes?: string; gmailThreadUrl?: string; contacts?: Array<{ contactId: string; contact: { firstName: string; lastName: string } }>; initiative?: { id: string; title: string } };
                return (
                  <div key={interaction.id} className="card">
                    <div className="flex items-center gap-2 mb-1">
                      <InteractionTypeBadge type={interaction.type} />
                      <span className="text-xs" style={{ color: '#8b949e' }}>{formatDate(interaction.date)}</span>
                      {interaction.gmailThreadUrl && (
                        <a href={interaction.gmailThreadUrl} target="_blank" rel="noopener noreferrer" className="text-xs flex items-center gap-1" style={{ color: '#c9a84c', textDecoration: 'none' }}>
                          <ExternalLink size={11} /> Gmail
                        </a>
                      )}
                    </div>
                    <div className="text-sm font-medium mb-2" style={{ color: '#e6edf3' }}>{interaction.subject}</div>
                    {interaction.notes && <p className="text-sm" style={{ color: '#8b949e', whiteSpace: 'pre-wrap' }}>{interaction.notes.length > 300 ? interaction.notes.slice(0, 300) + '…' : interaction.notes}</p>}
                    {interaction.contacts && interaction.contacts.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-2">
                        {interaction.contacts.map((ic) => (
                          <Link key={ic.contactId} to={`/contacts/${ic.contactId}`} className="text-xs" style={{ color: '#c9a84c', textDecoration: 'none' }}>
                            {ic.contact.firstName} {ic.contact.lastName}
                          </Link>
                        ))}
                      </div>
                    )}
                    {interaction.initiative && (
                      <Link to={`/initiatives/${interaction.initiative.id}`} className="text-xs mt-1 inline-block" style={{ color: '#8b949e', textDecoration: 'none' }}>
                        → {interaction.initiative.title}
                      </Link>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Tasks Tab */}
      {tab === 'tasks' && (
        <div className="space-y-2">
          {tasks.length === 0 ? (
            <div className="card text-center py-10">
              <CheckSquare size={32} className="mx-auto mb-3" style={{ color: '#30363d' }} />
              <p className="text-sm" style={{ color: '#8b949e' }}>No tasks linked to this organization.</p>
            </div>
          ) : tasks.map((t: unknown) => {
            const task = t as { id: string; title: string; completed: boolean; dueDate?: string; contact?: { id: string; firstName: string; lastName: string } };
            const overdue = !task.completed && isOverdueDay(task.dueDate);
            return (
              <div key={task.id} className="card flex items-start gap-3">
                <button
                  onClick={() => completeTask.mutate(task.id)}
                  disabled={task.completed}
                  className="mt-0.5 w-4 h-4 rounded border flex-shrink-0"
                  style={{ border: `1px solid ${task.completed ? '#238636' : overdue ? '#da3633' : '#30363d'}`, background: task.completed ? '#238636' : 'transparent' }}
                />
                <div>
                  <div className="text-sm" style={{ color: task.completed ? '#8b949e' : '#e6edf3', textDecoration: task.completed ? 'line-through' : 'none' }}>
                    {task.title}
                  </div>
                  {task.dueDate && <div className="text-xs mt-0.5" style={{ color: overdue ? '#da3633' : '#8b949e' }}>{overdue && !task.completed ? 'Overdue — ' : ''}{formatCalendarDate(task.dueDate)}</div>}
                  {task.contact && <Link to={`/contacts/${task.contact.id}`} className="text-xs" style={{ color: '#c9a84c', textDecoration: 'none' }}>{task.contact.firstName} {task.contact.lastName}</Link>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modals */}
      {showAddContact && (
        <ContactModal
          defaultEntityId={id}
          onClose={() => setShowAddContact(false)}
          onSave={() => {
            setShowAddContact(false);
            qc.invalidateQueries({ queryKey: ['entity', id] });
            qc.invalidateQueries({ queryKey: ['contacts'] });
            toast.success('Contact created');
          }}
        />
      )}

      {showEdit && (
        <EntityModal
          entity={entity as Entity}
          onClose={() => setShowEdit(false)}
          onSave={() => {
            setShowEdit(false);
            qc.invalidateQueries({ queryKey: ['entity', id] });
            qc.invalidateQueries({ queryKey: ['entities'] });
            toast.success('Organization updated');
          }}
        />
      )}

      {showLogInteraction && (
        <LogInteractionModal
          defaultEntityId={id}
          onClose={() => setShowLogInteraction(false)}
          onSave={() => {
            setShowLogInteraction(false);
            qc.invalidateQueries({ queryKey: ['entity', id] });
            qc.invalidateQueries({ queryKey: ['interactions'] });
            toast.success('Interaction logged');
          }}
        />
      )}

      {showBriefing && (
        <BriefingModal
          type="entity"
          id={id!}
          name={entity.name}
          onClose={() => setShowBriefing(false)}
        />
      )}

      <ChangeLogPanel entityType="Entity" entityId={entity.id} />

      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)' }}>
          <div className="rounded-xl p-6 max-w-sm w-full" style={{ background: '#1c2333', border: '1px solid #30363d' }}>
            <h3 className="text-base font-semibold mb-2" style={{ color: '#e6edf3' }}>Delete Organization?</h3>
            <p className="text-sm mb-6" style={{ color: '#8b949e' }}>
              {entity.name} will be moved to the recycle bin. Admins can restore within 90 days from Settings → Recycle Bin.
            </p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setConfirmDelete(false)} className="btn-secondary">Cancel</button>
              <button onClick={() => deleteEntity.mutate()} className="btn-danger">Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
