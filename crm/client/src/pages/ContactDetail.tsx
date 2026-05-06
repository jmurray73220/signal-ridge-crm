import { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Phone, Smartphone, Mail, Linkedin, ExternalLink, ArrowLeft, Edit2, Trash2,
  MessageSquare, Target, CheckSquare, Sparkles, Plus, Copy, Paperclip
} from 'lucide-react';
import { contactsApi, tasksApi, interactionsApi } from '../api';
import { InteractionAttachments } from '../components/InteractionAttachments';
import { EntityTypeBadge } from '../components/EntityTypeBadge';
import { StatusBadge, PriorityBadge } from '../components/StatusBadge';
import { ContactModal } from '../components/ContactModal';
import { LogInteractionModal } from '../components/LogInteractionModal';
import { BriefingModal } from '../components/BriefingModal';
import { ChangeLogPanel } from '../components/ChangeLogPanel';
import toast from 'react-hot-toast';
import { formatCalendarDate, isOverdueDay } from '../utils/dates';
import { useAuth } from '../contexts/AuthContext';

function CopyEmailButton({ email }: { email: string }) {
  return (
    <button
      onClick={(e) => {
        e.preventDefault();
        navigator.clipboard.writeText(email);
        toast.success('Email copied');
      }}
      className="p-0.5 hover:opacity-80 transition-opacity"
      style={{ color: '#8b949e' }}
      title="Copy email"
    >
      <Copy size={13} />
    </button>
  );
}

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
    <span className="badge" style={{ background: 'rgba(255,255,255,0.07)', color: colors[type] || '#8b949e' }}>
      {type}
    </span>
  );
}

type Tab = 'interactions' | 'initiatives' | 'tasks';

export function ContactDetail() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>('interactions');
  const [showEdit, setShowEdit] = useState(false);
  const [showLogInteraction, setShowLogInteraction] = useState(false);
  const [showBriefing, setShowBriefing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmDeleteInteractionId, setConfirmDeleteInteractionId] = useState<string | null>(null);
  const [expandedAttachments, setExpandedAttachments] = useState<Set<string>>(new Set());

  const { data: contact, isLoading, error } = useQuery<any>({
    queryKey: ['contact', id],
    queryFn: () => contactsApi.get(id!).then(r => r.data),
    enabled: !!id,
  });

  const deleteContact = useMutation({
    mutationFn: () => contactsApi.delete(id!),
    onSuccess: () => {
      toast.success('Contact deleted');
      navigate('/contacts');
    },
    onError: () => toast.error('Failed to delete contact'),
  });

  const deleteInteraction = useMutation({
    mutationFn: (iid: string) => interactionsApi.delete(iid),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['contact', id] });
      qc.invalidateQueries({ queryKey: ['interactions'] });
      setConfirmDeleteInteractionId(null);
      toast.success('Interaction deleted');
    },
    onError: () => toast.error('Failed to delete interaction'),
  });

  const completeTask = useMutation({
    mutationFn: (taskId: string) => tasksApi.update(taskId, { completed: true }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['contact', id] });
      toast.success('Task completed');
    },
  });

  if (isLoading) {
    return <div className="p-8 text-center text-sm" style={{ color: '#8b949e' }}>Loading…</div>;
  }

  if (error || !contact) {
    return <div className="p-8 text-center text-sm" style={{ color: '#da3633' }}>Contact not found.</div>;
  }

  const interactions = contact.interactions?.map((ic: any) => ic.interaction) || [];
  const initiatives = contact.initiatives || [];
  const tasks = contact.tasks || [];

  return (
    <div>
      {/* Back */}
      <Link to="/contacts" className="flex items-center gap-1.5 text-sm mb-4" style={{ color: '#8b949e', textDecoration: 'none' }}>
        <ArrowLeft size={14} /> Back to Contacts
      </Link>

      {/* Header */}
      <div className="card mb-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-2xl font-semibold" style={{ color: '#e6edf3' }}>
                {contact.rank && !contact.entity?.name?.toLowerCase().includes('committee') && <span>{contact.rank} </span>}
                {contact.firstName} {contact.lastName}
              </h1>
              {contact.entity && (
                <EntityTypeBadge
                  entityType={contact.entity.entityType}
                  chamber={contact.entity.chamber}
                  governmentType={contact.entity.governmentType}
                  showAsHill={contact.entity.entityType === 'CongressionalOffice'}
                />
              )}
            </div>
            {contact.title && (
              <div className="text-sm mb-2" style={{ color: '#8b949e' }}>{contact.title}</div>
            )}
            {contact.entity && (
              <div>
                <Link
                  to={`/entities/${contact.entity.id}`}
                  className="text-sm font-medium hover:opacity-80 transition-opacity"
                  style={{ color: '#c9a84c', textDecoration: 'none' }}
                >
                  {contact.entity.name}
                </Link>
                {contact.entity.address && (
                  <div className="text-xs mt-1" style={{ color: '#8b949e' }}>{contact.entity.address}</div>
                )}
              </div>
            )}

            {/* Contact info */}
            <div className="flex flex-wrap gap-4 mt-4">
              {contact.email && (
                <div className="flex items-center gap-1.5">
                  <a href={`mailto:${contact.email}`} className="flex items-center gap-1.5 text-sm" style={{ color: '#8b949e', textDecoration: 'none' }}>
                    <Mail size={14} /> {contact.email}
                  </a>
                  <CopyEmailButton email={contact.email} />
                </div>
              )}
              {contact.officePhone && (
                <a href={`tel:${contact.officePhone}`} className="flex items-center gap-1.5 text-sm" style={{ color: '#8b949e', textDecoration: 'none' }}>
                  <Phone size={14} /> {contact.officePhone}
                </a>
              )}
              {contact.cell && (
                <a href={`tel:${contact.cell}`} className="flex items-center gap-1.5 text-sm" style={{ color: '#8b949e', textDecoration: 'none' }}>
                  <Smartphone size={14} /> {contact.cell}
                </a>
              )}
              {contact.linkedIn && (
                <a href={contact.linkedIn} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-sm" style={{ color: '#8b949e', textDecoration: 'none' }}>
                  <Linkedin size={14} /> LinkedIn
                </a>
              )}
              {contact.website && (
                <a href={contact.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-sm" style={{ color: '#c9a84c', textDecoration: 'none' }}>
                  <ExternalLink size={14} /> {contact.website.replace(/^https?:\/\//, '').replace(/\/$/, '')}
                </a>
              )}
            </div>

            {/* Tags */}
            {contact.tags?.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-4">
                {contact.tags.map((tag: string) => (
                  <span
                    key={tag}
                    className="badge"
                    style={{ background: '#161b22', color: '#8b949e', border: '1px solid #30363d' }}
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}

            {contact.bio && (
              <p className="mt-4 text-sm leading-relaxed" style={{ color: '#8b949e' }}>{contact.bio}</p>
            )}
          </div>

          {/* Actions */}
          <div className="flex flex-col gap-2 flex-shrink-0">
            <button
              onClick={() => setShowBriefing(true)}
              className="btn-secondary flex items-center gap-1.5 text-sm"
            >
              <Sparkles size={14} /> Generate Briefing
            </button>
            {user?.role !== 'Viewer' && (
              <>
                <button
                  onClick={() => setShowLogInteraction(true)}
                  className="btn-secondary flex items-center gap-1.5 text-sm"
                >
                  <MessageSquare size={14} /> Log Interaction
                </button>
                <button
                  onClick={() => setShowEdit(true)}
                  className="btn-secondary flex items-center gap-1.5 text-sm"
                >
                  <Edit2 size={14} /> Edit
                </button>
                {user?.role === 'Admin' && (
                  <button
                    onClick={() => setConfirmDelete(true)}
                    className="btn-danger flex items-center gap-1.5 text-sm"
                  >
                    <Trash2 size={14} /> Delete
                  </button>
                )}
              </>
            )}
          </div>
        </div>

        {/* Audit trail */}
        {(contact.createdBy || contact.updatedBy) && (
          <div className="mt-4 pt-4 flex gap-4" style={{ borderTop: '1px solid #30363d' }}>
            {contact.createdBy && (
              <span className="text-xs" style={{ color: '#8b949e' }}>
                Added by {contact.createdBy.firstName} {contact.createdBy.lastName} · {formatDate(contact.createdAt)}
              </span>
            )}
            {contact.updatedBy && contact.updatedAt !== contact.createdAt && (
              <span className="text-xs" style={{ color: '#8b949e' }}>
                Last edited by {contact.updatedBy.firstName} {contact.updatedBy.lastName} · {formatDate(contact.updatedAt)}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-4" style={{ borderBottom: '1px solid #30363d' }}>
        {([
          ['interactions', 'Interactions', interactions.length],
          ['initiatives', 'Initiatives', initiatives.length],
          ['tasks', 'Tasks', tasks.length],
        ] as [Tab, string, number][]).map(([t, label, count]) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className="px-4 py-2.5 text-sm font-medium transition-colors relative"
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

      {/* Tab Content */}
      {tab === 'interactions' && (
        <div className="space-y-3">
          {user?.role !== 'Viewer' && (
            <div className="flex justify-end">
              <button
                onClick={() => setShowLogInteraction(true)}
                className="btn-secondary flex items-center gap-1.5 text-sm"
              >
                <Plus size={14} /> Log Interaction
              </button>
            </div>
          )}
          {interactions.length === 0 ? (
            <div className="card text-center py-10">
              <MessageSquare size={32} className="mx-auto mb-3" style={{ color: '#30363d' }} />
              <p className="text-sm" style={{ color: '#8b949e' }}>No interactions logged yet.</p>
            </div>
          ) : interactions.map((i: any) => {
            const attachCount = i._count?.attachments || 0;
            const expanded = expandedAttachments.has(i.id);
            const canEdit = user?.role !== 'Viewer';
            return (
              <div key={i.id} className="card">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <InteractionTypeBadge type={i.type} />
                      <span className="text-xs" style={{ color: '#8b949e' }}>{formatDate(i.date)}</span>
                      <button
                        type="button"
                        onClick={() => setExpandedAttachments(prev => {
                          const next = new Set(prev);
                          if (next.has(i.id)) next.delete(i.id); else next.add(i.id);
                          return next;
                        })}
                        className="text-xs flex items-center gap-1 hover:opacity-80"
                        style={{ color: attachCount > 0 ? '#c9a84c' : '#8b949e' }}
                        title="Attachments"
                      >
                        <Paperclip size={11} />
                        {attachCount > 0 ? attachCount : (canEdit ? 'Add file' : '')}
                      </button>
                    </div>
                    <div className="text-sm font-medium mb-2" style={{ color: '#e6edf3' }}>{i.subject}</div>
                    {i.notes && (
                      <p className="text-sm leading-relaxed" style={{ color: '#8b949e', whiteSpace: 'pre-wrap' }}>
                        {i.notes.length > 300 ? i.notes.slice(0, 300) + '…' : i.notes}
                      </p>
                    )}
                    <div className="flex items-center gap-3 mt-2">
                      {i.entity && (
                        <Link to={`/entities/${i.entity.id}`} className="flex items-center gap-1.5" style={{ textDecoration: 'none' }}>
                          <EntityTypeBadge
                            entityType={i.entity.entityType}
                            chamber={i.entity.chamber}
                            governmentType={i.entity.governmentType}
                          />
                          <span className="text-xs" style={{ color: '#8b949e' }}>{i.entity.name}</span>
                        </Link>
                      )}
                      {i.initiative && (
                        <Link to={`/initiatives/${i.initiative.id}`} className="text-xs" style={{ color: '#c9a84c', textDecoration: 'none' }}>
                          {i.initiative.title}
                        </Link>
                      )}
                    </div>
                  </div>
                  {canEdit && (
                    <button
                      onClick={() => setConfirmDeleteInteractionId(i.id)}
                      className="flex-shrink-0 hover:opacity-80"
                      style={{ color: '#30363d' }}
                      title="Delete interaction"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
                {expanded && (
                  <div className="mt-3 pt-3" style={{ borderTop: '1px solid #30363d' }}>
                    <InteractionAttachments interactionId={i.id} canEdit={canEdit} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {tab === 'initiatives' && (
        <div className="space-y-3">
          {initiatives.length === 0 ? (
            <div className="card text-center py-10">
              <Target size={32} className="mx-auto mb-3" style={{ color: '#30363d' }} />
              <p className="text-sm" style={{ color: '#8b949e' }}>Not associated with any initiatives.</p>
            </div>
          ) : initiatives.map((ic: any) => (
            <div key={ic.initiativeId} className="card flex items-center justify-between gap-3">
              <div>
                <Link
                  to={`/initiatives/${ic.initiativeId}`}
                  className="text-sm font-medium hover:text-accent"
                  style={{ color: '#e6edf3', textDecoration: 'none' }}
                >
                  {ic.initiative.title}
                </Link>
                {ic.role && (
                  <span className="ml-2 badge" style={{ background: 'rgba(201,168,76,0.1)', color: '#c9a84c', border: '1px solid rgba(201,168,76,0.2)' }}>
                    {ic.role}
                  </span>
                )}
                {ic.initiative.primaryEntity && (
                  <div className="flex items-center gap-1.5 mt-1">
                    <EntityTypeBadge
                      entityType={ic.initiative.primaryEntity.entityType}
                      chamber={ic.initiative.primaryEntity.chamber}
                      governmentType={ic.initiative.primaryEntity.governmentType}
                    />
                    <Link to={`/entities/${ic.initiative.primaryEntity.id}`} className="text-xs" style={{ color: '#8b949e', textDecoration: 'none' }}>
                      {ic.initiative.primaryEntity.name}
                    </Link>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2">
                <StatusBadge status={ic.initiative.status} />
                <PriorityBadge priority={ic.initiative.priority} />
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'tasks' && (
        <div className="space-y-2">
          {tasks.length === 0 ? (
            <div className="card text-center py-10">
              <CheckSquare size={32} className="mx-auto mb-3" style={{ color: '#30363d' }} />
              <p className="text-sm" style={{ color: '#8b949e' }}>No tasks linked to this contact.</p>
            </div>
          ) : tasks.map((t: any) => {
            const overdue = !t.completed && isOverdueDay(t.dueDate);
            return (
              <div key={t.id} className="card flex items-start gap-3">
                <button
                  onClick={() => completeTask.mutate(t.id)}
                  disabled={t.completed}
                  className="mt-0.5 w-4 h-4 rounded border flex-shrink-0"
                  style={{
                    border: `1px solid ${t.completed ? '#238636' : overdue ? '#da3633' : '#30363d'}`,
                    background: t.completed ? '#238636' : 'transparent',
                  }}
                />
                <div>
                  <div className="text-sm" style={{ color: t.completed ? '#8b949e' : '#e6edf3', textDecoration: t.completed ? 'line-through' : 'none' }}>
                    {t.title}
                  </div>
                  {t.dueDate && (
                    <div className="text-xs mt-0.5" style={{ color: overdue ? '#da3633' : '#8b949e' }}>
                      {overdue && !t.completed ? 'Overdue — ' : ''}{formatCalendarDate(t.dueDate)}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modals */}
      {showEdit && (
        <ContactModal
          contact={contact}
          onClose={() => setShowEdit(false)}
          onSave={() => {
            setShowEdit(false);
            qc.invalidateQueries({ queryKey: ['contact', id] });
            qc.invalidateQueries({ queryKey: ['contacts'] });
            toast.success('Contact updated');
          }}
        />
      )}

      {showLogInteraction && (
        <LogInteractionModal
          defaultContactId={id}
          onClose={() => setShowLogInteraction(false)}
          onSave={() => {
            setShowLogInteraction(false);
            qc.invalidateQueries({ queryKey: ['contact', id] });
            qc.invalidateQueries({ queryKey: ['interactions'] });
            toast.success('Interaction logged');
          }}
        />
      )}

      {showBriefing && (
        <BriefingModal
          type="contact"
          id={id!}
          name={`${contact.firstName} ${contact.lastName}`}
          onClose={() => setShowBriefing(false)}
        />
      )}

      <ChangeLogPanel entityType="Contact" entityId={contact.id} />

      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)' }}>
          <div className="rounded-xl p-6 max-w-sm w-full" style={{ background: '#1c2333', border: '1px solid #30363d' }}>
            <h3 className="text-base font-semibold mb-2" style={{ color: '#e6edf3' }}>Delete Contact?</h3>
            <p className="text-sm mb-6" style={{ color: '#8b949e' }}>
              {contact.firstName} {contact.lastName} will be moved to the recycle bin. Admins can restore within 90 days from Settings → Recycle Bin.
            </p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setConfirmDelete(false)} className="btn-secondary">Cancel</button>
              <button onClick={() => deleteContact.mutate()} className="btn-danger">Delete</button>
            </div>
          </div>
        </div>
      )}

      {confirmDeleteInteractionId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)' }}>
          <div className="rounded-xl p-6 max-w-sm w-full" style={{ background: '#1c2333', border: '1px solid #30363d' }}>
            <h3 className="text-base font-semibold mb-2" style={{ color: '#e6edf3' }}>Delete Interaction?</h3>
            <p className="text-sm mb-6" style={{ color: '#8b949e' }}>This will move the interaction (and any attachments) to the recycle bin.</p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setConfirmDeleteInteractionId(null)} className="btn-secondary">Cancel</button>
              <button onClick={() => deleteInteraction.mutate(confirmDeleteInteractionId)} className="btn-danger">Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
