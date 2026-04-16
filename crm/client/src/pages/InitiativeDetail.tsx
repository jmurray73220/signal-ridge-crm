import { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft, Edit2, Trash2, MessageSquare,
  Building2, CheckSquare, Plus, X, ExternalLink
} from 'lucide-react';
import { initiativesApi, contactsApi, entitiesApi, tasksApi } from '../api';
import { EntityTypeBadge } from '../components/EntityTypeBadge';
import { StatusBadge, PriorityBadge } from '../components/StatusBadge';
import { InitiativeModal } from '../components/InitiativeModal';
import { LogInteractionModal } from '../components/LogInteractionModal';
import { InitiativeContactsTab } from '../components/InitiativeContactsTab';
import toast from 'react-hot-toast';
import { useAuth } from '../contexts/AuthContext';

function formatDate(d?: string | null) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function InteractionTypeBadge({ type }: { type: string }) {
  const colors: Record<string, string> = {
    Meeting: '#c9a84c', Call: '#60a5fa', Email: '#8b949e',
    Hearing: '#f472b6', Briefing: '#34d399', Event: '#a78bfa', Other: '#8b949e',
  };
  return <span className="badge" style={{ background: 'rgba(255,255,255,0.07)', color: colors[type] || '#8b949e' }}>{type}</span>;
}

type Tab = 'contacts' | 'organizations' | 'interactions' | 'tasks';

export function InitiativeDetail() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>('contacts');
  const [showEdit, setShowEdit] = useState(false);
  const [showLogInteraction, setShowLogInteraction] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [showAddContact, setShowAddContact] = useState(false);
  const [showAddEntity, setShowAddEntity] = useState(false);

  // Add contact form state
  const [addContactId, setAddContactId] = useState('');
  const [addContactRole, setAddContactRole] = useState('');
  const [contactSearch, setContactSearch] = useState('');

  // Add entity form state
  const [addEntityId, setAddEntityId] = useState('');
  const [addEntityNote, setAddEntityNote] = useState('');

  const { data: initiative, isLoading, error } = useQuery({
    queryKey: ['initiative', id],
    queryFn: () => initiativesApi.get(id!).then(r => r.data),
    enabled: !!id,
  });

  const { data: allContacts = [] } = useQuery({
    queryKey: ['contacts'],
    queryFn: () => contactsApi.list().then(r => r.data),
  });

  const { data: allEntities = [] } = useQuery({
    queryKey: ['entities'],
    queryFn: () => entitiesApi.list().then(r => r.data),
    enabled: showAddEntity,
  });

  const deleteInitiative = useMutation({
    mutationFn: () => initiativesApi.delete(id!),
    onSuccess: () => { toast.success('Initiative deleted'); navigate('/initiatives'); },
    onError: () => toast.error('Failed to delete'),
  });

  const addContact = useMutation({
    mutationFn: () => initiativesApi.addContact(id!, addContactId, addContactRole || undefined),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['initiative', id] });
      setShowAddContact(false);
      setAddContactId('');
      setAddContactRole('');
      toast.success('Contact added to initiative');
    },
    onError: () => toast.error('Failed to add contact'),
  });

  const removeContact = useMutation({
    mutationFn: (contactId: string) => initiativesApi.removeContact(id!, contactId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['initiative', id] });
      toast.success('Contact removed');
    },
  });

  const addEntity = useMutation({
    mutationFn: () => initiativesApi.addEntity(id!, addEntityId, addEntityNote || undefined),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['initiative', id] });
      setShowAddEntity(false);
      setAddEntityId('');
      setAddEntityNote('');
      toast.success('Organization added');
    },
    onError: () => toast.error('Failed to add organization'),
  });

  const removeEntity = useMutation({
    mutationFn: (entityId: string) => initiativesApi.removeEntity(id!, entityId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['initiative', id] });
      toast.success('Organization removed');
    },
  });

  const completeTask = useMutation({
    mutationFn: (taskId: string) => tasksApi.update(taskId, { completed: true }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['initiative', id] });
      toast.success('Task completed');
    },
  });

  if (isLoading) return <div className="p-8 text-center text-sm" style={{ color: '#8b949e' }}>Loading…</div>;
  if (error || !initiative) return <div className="p-8 text-center text-sm" style={{ color: '#da3633' }}>Initiative not found.</div>;

  const i = initiative as any;
  const directContacts = i.contacts || [];
  const entities = i.entities || [];
  const interactions = i.interactions || [];
  const tasks = i.tasks || [];

  // Find contacts tagged with this initiative's title but not already linked
  const initiativeTitle = (i.title || '').toLowerCase();
  const taggedContactEntries = allContacts
    .filter(c => {
      // Not already a direct contact
      if (directContacts.some((ic: any) => ic.contactId === c.id)) return false;
      // Has a tag matching the initiative title
      return (c.tags || []).some((t: string) => t.toLowerCase() === initiativeTitle);
    })
    .map(c => ({
      contactId: c.id,
      role: 'Tagged',
      sortOrder: 999,
      contact: {
        id: c.id,
        firstName: c.firstName,
        lastName: c.lastName,
        title: c.title,
        rank: c.rank,
        tags: JSON.stringify(c.tags || []),
        entity: c.entity ? {
          id: c.entity.id,
          name: c.entity.name,
          entityType: c.entity.entityType,
          chamber: c.entity.chamber,
          party: (c.entity as any).party,
          committee: (c.entity as any).committee,
          subcommittee: (c.entity as any).subcommittee,
          governmentType: c.entity.governmentType,
        } : undefined,
      },
    }));

  const contacts = [...directContacts, ...taggedContactEntries];

  const filteredContactSearch = allContacts.filter(c => {
    const already = contacts.find((ic: any) => ic.contactId === c.id);
    if (already) return false;
    if (!contactSearch) return true;
    const q = contactSearch.toLowerCase();
    return `${c.firstName} ${c.lastName}`.toLowerCase().includes(q);
  });

  return (
    <div>
      <Link to="/initiatives" className="flex items-center gap-1.5 text-sm mb-4" style={{ color: '#8b949e', textDecoration: 'none' }}>
        <ArrowLeft size={14} /> Back to Initiatives
      </Link>

      {/* Header */}
      <div className="card mb-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2 flex-wrap">
              <StatusBadge status={i.status} />
              <PriorityBadge priority={i.priority} />
            </div>
            <h1 className="text-2xl font-semibold mb-2" style={{ color: '#e6edf3' }}>{i.title}</h1>

            {i.primaryEntity && (
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xs" style={{ color: '#8b949e' }}>Primary Organization:</span>
                <EntityTypeBadge entityType={i.primaryEntity.entityType} chamber={i.primaryEntity.chamber} governmentType={i.primaryEntity.governmentType} />
                <Link to={`/entities/${i.primaryEntity.id}`} className="text-sm font-medium hover:opacity-80" style={{ color: '#c9a84c', textDecoration: 'none' }}>
                  {i.primaryEntity.name}
                </Link>
              </div>
            )}

            {(i.startDate || i.targetDate) && (
              <div className="flex gap-4 mb-3">
                {i.startDate && <div className="text-sm" style={{ color: '#8b949e' }}>Start: <span style={{ color: '#e6edf3' }}>{formatDate(i.startDate)}</span></div>}
                {i.targetDate && <div className="text-sm" style={{ color: '#8b949e' }}>Target: <span style={{ color: '#e6edf3' }}>{formatDate(i.targetDate)}</span></div>}
              </div>
            )}

            {i.description && <p className="text-sm leading-relaxed" style={{ color: '#8b949e' }}>{i.description}</p>}
          </div>

          {/* Actions */}
          <div className="flex flex-col gap-2 flex-shrink-0">
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

        {(i.createdBy || i.updatedBy) && (
          <div className="mt-4 pt-4 flex gap-4" style={{ borderTop: '1px solid #30363d' }}>
            {i.createdBy && <span className="text-xs" style={{ color: '#8b949e' }}>Added by {i.createdBy.firstName} {i.createdBy.lastName} · {formatDate(i.createdAt)}</span>}
            {i.updatedBy && i.updatedAt !== i.createdAt && <span className="text-xs" style={{ color: '#8b949e' }}>Last edited by {i.updatedBy.firstName} {i.updatedBy.lastName} · {formatDate(i.updatedAt)}</span>}
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-4" style={{ borderBottom: '1px solid #30363d' }}>
        {([
          ['contacts', 'Contacts', contacts.length],
          ['organizations', 'Organizations', entities.length],
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

      {/* Contacts Tab */}
      {tab === 'contacts' && (
        <InitiativeContactsTab
          contacts={contacts}
          initiativeId={id!}
          canEdit={user?.role !== 'Viewer'}
          canDelete={user?.role !== 'Viewer'}
          onShowAddContact={() => setShowAddContact(true)}
          showAddContact={showAddContact}
          contactSearch={contactSearch}
          onContactSearchChange={setContactSearch}
          filteredContactSearch={filteredContactSearch}
          addContactId={addContactId}
          onAddContactIdChange={setAddContactId}
          addContactRole={addContactRole}
          onAddContactRoleChange={setAddContactRole}
          onAddContact={() => addContact.mutate()}
          addContactPending={addContact.isPending}
          onCancelAdd={() => { setShowAddContact(false); setAddContactId(''); }}
          onRemoveContact={(cId: string) => removeContact.mutate(cId)}
        />
      )}

      {/* Organizations Tab */}
      {tab === 'organizations' && (
        <div>
          {user?.role !== 'Viewer' && (
            <div className="flex justify-end mb-3">
              <button onClick={() => setShowAddEntity(true)} className="btn-secondary flex items-center gap-1.5 text-sm">
                <Plus size={14} /> Add Organization
              </button>
            </div>
          )}

          {showAddEntity && (
            <div className="card mb-4">
              <h3 className="text-sm font-medium mb-3" style={{ color: '#e6edf3' }}>Link Organization to Initiative</h3>
              <div className="space-y-3">
                <div>
                  <label className="label">Organization</label>
                  <select className="input" value={addEntityId} onChange={e => setAddEntityId(e.target.value)}>
                    <option value="">— Select —</option>
                    {allEntities.filter(e => !entities.find((ie: any) => ie.entityId === e.id)).map(e => (
                      <option key={e.id} value={e.id}>{e.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label">Relationship Note (optional)</label>
                  <input className="input" value={addEntityNote} onChange={e => setAddEntityNote(e.target.value)} placeholder="oversight committee, contracting office…" />
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => addEntity.mutate()}
                    disabled={!addEntityId || addEntity.isPending}
                    className="btn-primary"
                  >
                    Add
                  </button>
                  <button onClick={() => { setShowAddEntity(false); setAddEntityId(''); }} className="btn-secondary">Cancel</button>
                </div>
              </div>
            </div>
          )}

          {entities.length === 0 ? (
            <div className="card text-center py-10">
              <Building2 size={32} className="mx-auto mb-3" style={{ color: '#30363d' }} />
              <p className="text-sm" style={{ color: '#8b949e' }}>No additional organizations linked.</p>
              {i.primaryEntity && (
                <p className="text-xs mt-1" style={{ color: '#8b949e' }}>
                  Primary entity: <Link to={`/entities/${i.primaryEntity.id}`} style={{ color: '#c9a84c', textDecoration: 'none' }}>{i.primaryEntity.name}</Link>
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              {/* Show primary entity first */}
              {i.primaryEntity && (
                <div className="card flex items-center gap-3" style={{ borderColor: 'rgba(201,168,76,0.3)' }}>
                  <EntityTypeBadge entityType={i.primaryEntity.entityType} chamber={i.primaryEntity.chamber} governmentType={i.primaryEntity.governmentType} />
                  <div className="flex-1">
                    <Link to={`/entities/${i.primaryEntity.id}`} className="text-sm font-medium hover:text-accent" style={{ color: '#e6edf3', textDecoration: 'none' }}>
                      {i.primaryEntity.name}
                    </Link>
                    <div className="text-xs mt-0.5" style={{ color: '#8b949e' }}>Primary Organization</div>
                  </div>
                  <span className="badge" style={{ background: 'rgba(201,168,76,0.1)', color: '#c9a84c', border: '1px solid rgba(201,168,76,0.2)', fontSize: 10 }}>PRIMARY</span>
                </div>
              )}
              {entities.map((ie: any) => (
                <div key={ie.entityId} className="card flex items-center gap-3">
                  <EntityTypeBadge entityType={ie.entity.entityType} chamber={ie.entity.chamber} governmentType={ie.entity.governmentType} />
                  <div className="flex-1">
                    <Link to={`/entities/${ie.entityId}`} className="text-sm font-medium hover:text-accent" style={{ color: '#e6edf3', textDecoration: 'none' }}>
                      {ie.entity.name}
                    </Link>
                    {ie.relationshipNote && <div className="text-xs mt-0.5" style={{ color: '#8b949e' }}>{ie.relationshipNote}</div>}
                  </div>
                  {user?.role !== 'Viewer' && (
                    <button onClick={() => removeEntity.mutate(ie.entityId)} style={{ color: '#da3633' }}>
                      <X size={14} />
                    </button>
                  )}
                </div>
              ))}
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
              <p className="text-sm" style={{ color: '#8b949e' }}>No interactions logged for this initiative.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {interactions.map((interaction: any) => (
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
                  {interaction.notes && (
                    <p className="text-sm" style={{ color: '#8b949e', whiteSpace: 'pre-wrap' }}>
                      {interaction.notes.length > 300 ? interaction.notes.slice(0, 300) + '…' : interaction.notes}
                    </p>
                  )}
                  {interaction.entity && (
                    <div className="flex items-center gap-1.5 mt-2">
                      <EntityTypeBadge entityType={interaction.entity.entityType} chamber={interaction.entity.chamber} governmentType={interaction.entity.governmentType} />
                      <Link to={`/entities/${interaction.entity.id}`} className="text-xs" style={{ color: '#8b949e', textDecoration: 'none' }}>{interaction.entity.name}</Link>
                    </div>
                  )}
                  {interaction.contacts?.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {interaction.contacts.map((ic: any) => (
                        <Link key={ic.contactId} to={`/contacts/${ic.contactId}`} className="text-xs" style={{ color: '#c9a84c', textDecoration: 'none' }}>
                          {ic.contact.firstName} {ic.contact.lastName}
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              ))}
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
              <p className="text-sm" style={{ color: '#8b949e' }}>No tasks linked to this initiative.</p>
            </div>
          ) : tasks.map((t: any) => {
            const overdue = t.dueDate && !t.completed && new Date(t.dueDate).getTime() < Date.now();
            return (
              <div key={t.id} className="card flex items-start gap-3">
                <button
                  onClick={() => completeTask.mutate(t.id)}
                  disabled={t.completed}
                  className="mt-0.5 w-4 h-4 rounded border flex-shrink-0"
                  style={{ border: `1px solid ${t.completed ? '#238636' : overdue ? '#da3633' : '#30363d'}`, background: t.completed ? '#238636' : 'transparent' }}
                />
                <div>
                  <div className="text-sm" style={{ color: t.completed ? '#8b949e' : '#e6edf3', textDecoration: t.completed ? 'line-through' : 'none' }}>
                    {t.title}
                  </div>
                  {t.dueDate && (
                    <div className="text-xs mt-0.5" style={{ color: overdue && !t.completed ? '#da3633' : '#8b949e' }}>
                      {overdue && !t.completed ? 'Overdue — ' : ''}{formatDate(t.dueDate)}
                    </div>
                  )}
                  {t.contact && <Link to={`/contacts/${t.contact.id}`} className="text-xs" style={{ color: '#c9a84c', textDecoration: 'none' }}>{t.contact.firstName} {t.contact.lastName}</Link>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modals */}
      {showEdit && (
        <InitiativeModal
          initiative={initiative as any}
          onClose={() => setShowEdit(false)}
          onSave={() => {
            setShowEdit(false);
            qc.invalidateQueries({ queryKey: ['initiative', id] });
            qc.invalidateQueries({ queryKey: ['initiatives'] });
            toast.success('Initiative updated');
          }}
        />
      )}

      {showLogInteraction && (
        <LogInteractionModal
          defaultInitiativeId={id}
          onClose={() => setShowLogInteraction(false)}
          onSave={() => {
            setShowLogInteraction(false);
            qc.invalidateQueries({ queryKey: ['initiative', id] });
            qc.invalidateQueries({ queryKey: ['interactions'] });
            toast.success('Interaction logged');
          }}
        />
      )}

      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)' }}>
          <div className="rounded-xl p-6 max-w-sm w-full" style={{ background: '#1c2333', border: '1px solid #30363d' }}>
            <h3 className="text-base font-semibold mb-2" style={{ color: '#e6edf3' }}>Delete Initiative?</h3>
            <p className="text-sm mb-6" style={{ color: '#8b949e' }}>This will permanently delete "{i.title}" and all associated data.</p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setConfirmDelete(false)} className="btn-secondary">Cancel</button>
              <button onClick={() => deleteInitiative.mutate()} className="btn-danger">Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
