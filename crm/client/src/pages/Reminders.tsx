import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Bell, Plus, Trash2, Pencil } from 'lucide-react';
import { remindersApi } from '../api';
import { ReminderModal } from '../components/ReminderModal';
import { EntityTypeBadge } from '../components/EntityTypeBadge';
import toast from 'react-hot-toast';
import { useAuth } from '../contexts/AuthContext';
import type { Reminder } from '../types';

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function isOverdue(r: Reminder) {
  return !r.completed && new Date(r.remindAt).getTime() < Date.now();
}

function isToday(r: Reminder) {
  if (r.completed) return false;
  const d = new Date(r.remindAt);
  const now = new Date();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
}

function isThisWeek(r: Reminder) {
  if (r.completed || isToday(r)) return false;
  const d = new Date(r.remindAt).getTime();
  const now = Date.now();
  return d > now && d < now + 7 * 24 * 60 * 60 * 1000;
}

type Group = { label: string; color: string; items: Reminder[] };

function groupReminders(reminders: Reminder[]): Group[] {
  const open = reminders.filter(r => !r.completed);
  const groups: Group[] = [
    { label: 'Overdue', color: '#da3633', items: open.filter(isOverdue) },
    { label: 'Today', color: '#c9a84c', items: open.filter(isToday) },
    { label: 'This Week', color: '#34d399', items: open.filter(isThisWeek) },
    {
      label: 'Upcoming',
      color: '#60a5fa',
      items: open.filter(r => !isOverdue(r) && !isToday(r) && !isThisWeek(r)),
    },
    { label: 'Completed', color: '#8b949e', items: reminders.filter(r => r.completed) },
  ];
  return groups.filter(g => g.items.length > 0);
}

function ReminderRow({ reminder, onDismiss, onEdit, onDelete, canEdit, canDelete }: {
  reminder: Reminder;
  onDismiss: (id: string) => void;
  onEdit: (r: Reminder) => void;
  onDelete: (id: string) => void;
  canEdit: boolean;
  canDelete: boolean;
}) {
  const overdue = isOverdue(reminder);

  return (
    <div className="flex items-start gap-3 py-3" style={{ borderBottom: '1px solid #30363d' }}>
      {/* Dismiss checkbox */}
      <button
        onClick={() => !reminder.completed && canEdit && onDismiss(reminder.id)}
        disabled={reminder.completed || !canEdit}
        className="mt-0.5 w-4 h-4 rounded-full border flex-shrink-0 flex items-center justify-center transition-colors"
        style={{
          border: `1px solid ${reminder.completed ? '#238636' : overdue ? '#da3633' : '#c9a84c'}`,
          background: reminder.completed ? '#238636' : 'transparent',
          cursor: reminder.completed || !canEdit ? 'default' : 'pointer',
        }}
        title={reminder.completed ? 'Done' : 'Mark done'}
      >
        {reminder.completed && <span style={{ color: 'white', fontSize: 10 }}>✓</span>}
      </button>

      <div className="flex-1 min-w-0">
        <div
          className="text-sm font-medium"
          style={{
            color: reminder.completed ? '#8b949e' : '#e6edf3',
            textDecoration: reminder.completed ? 'line-through' : 'none',
          }}
        >
          {reminder.title}
        </div>

        {reminder.notes && (
          <div className="text-xs mt-0.5" style={{ color: '#8b949e' }}>{reminder.notes}</div>
        )}

        <div className="flex items-center gap-3 mt-1 flex-wrap">
          <span className="text-xs" style={{ color: overdue && !reminder.completed ? '#da3633' : '#8b949e' }}>
            {overdue && !reminder.completed ? 'Overdue — ' : ''}{formatDate(reminder.remindAt)}
          </span>

          {reminder.contact && (
            <Link
              to={`/contacts/${reminder.contact.id}`}
              className="text-xs hover:opacity-80"
              style={{ color: '#c9a84c', textDecoration: 'none' }}
            >
              {reminder.contact.firstName} {reminder.contact.lastName}
            </Link>
          )}

          {reminder.entity && (
            <div className="flex items-center gap-1">
              <EntityTypeBadge
                entityType={reminder.entity.entityType}
                chamber={reminder.entity.chamber}
                governmentType={reminder.entity.governmentType}
              />
              <Link
                to={`/entities/${reminder.entity.id}`}
                className="text-xs hover:opacity-80"
                style={{ color: '#8b949e', textDecoration: 'none' }}
              >
                {reminder.entity.name}
              </Link>
            </div>
          )}

          {reminder.interaction && (
            <span className="text-xs" style={{ color: '#8b949e' }}>
              Re: {reminder.interaction.type} — {reminder.interaction.subject}
            </span>
          )}

          {reminder.initiative && (
            <Link
              to={`/initiatives/${reminder.initiative.id}`}
              className="text-xs hover:opacity-80"
              style={{ color: '#8b949e', textDecoration: 'none' }}
            >
              → {reminder.initiative.title}
            </Link>
          )}
        </div>
      </div>

      <div className="flex items-center gap-1 flex-shrink-0">
        {canEdit && !reminder.completed && (
          <button
            onClick={() => onEdit(reminder)}
            className="p-1 hover:opacity-80"
            style={{ color: '#8b949e' }}
            title="Edit"
          >
            <Pencil size={13} />
          </button>
        )}
        {canDelete && (
          <button
            onClick={() => onDelete(reminder.id)}
            className="p-1 hover:opacity-80"
            style={{ color: '#30363d' }}
            title="Delete"
          >
            <Trash2 size={13} />
          </button>
        )}
      </div>
    </div>
  );
}

export function Reminders() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [editReminder, setEditReminder] = useState<Reminder | null>(null);
  const [showCompleted, setShowCompleted] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const { data: reminders = [], isLoading } = useQuery({
    queryKey: ['reminders'],
    queryFn: () => remindersApi.list().then(r => r.data),
  });

  const dismiss = useMutation({
    mutationFn: (id: string) => remindersApi.update(id, { completed: true }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['reminders'] }); toast.success('Reminder dismissed'); },
  });

  const deleteReminder = useMutation({
    mutationFn: (id: string) => remindersApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['reminders'] });
      setConfirmDeleteId(null);
      toast.success('Reminder deleted');
    },
    onError: () => toast.error('Failed to delete'),
  });

  const displayed = showCompleted ? reminders : reminders.filter(r => !r.completed);
  const groups = groupReminders(displayed);

  const overdueCount = reminders.filter(r => !r.completed && isOverdue(r)).length;
  const todayCount = reminders.filter(r => !r.completed && isToday(r)).length;
  const openCount = reminders.filter(r => !r.completed).length;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold" style={{ color: '#e6edf3' }}>Reminders</h1>
          <div className="flex items-center gap-3 mt-0.5">
            <span className="text-sm" style={{ color: '#8b949e' }}>{openCount} pending</span>
            {overdueCount > 0 && <span className="text-sm font-medium" style={{ color: '#da3633' }}>{overdueCount} overdue</span>}
            {todayCount > 0 && <span className="text-sm" style={{ color: '#c9a84c' }}>{todayCount} due today</span>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowCompleted(s => !s)}
            className="btn-secondary text-sm"
          >
            {showCompleted ? 'Hide Completed' : 'Show Completed'}
          </button>
          {user?.role !== 'Viewer' && (
            <button onClick={() => setShowModal(true)} className="btn-primary flex items-center gap-1.5 text-sm">
              <Plus size={14} /> Add Reminder
            </button>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="text-center p-12 text-sm" style={{ color: '#8b949e' }}>Loading…</div>
      ) : groups.length === 0 ? (
        <div className="card text-center py-16">
          <Bell size={48} className="mx-auto mb-4" style={{ color: '#30363d' }} />
          <p className="text-sm mb-4" style={{ color: '#8b949e' }}>No pending reminders.</p>
          {user?.role !== 'Viewer' && (
            <button onClick={() => setShowModal(true)} className="btn-primary text-sm">Set Reminder</button>
          )}
        </div>
      ) : (
        <div className="space-y-8">
          {groups.map(group => (
            <div key={group.label}>
              <div className="flex items-center gap-3 mb-1">
                <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: group.color }}>
                  {group.label}
                </span>
                <span className="text-xs rounded-full px-2 py-0.5" style={{ background: `${group.color}22`, color: group.color }}>
                  {group.items.length}
                </span>
              </div>
              <div className="card p-0 px-4">
                {group.items.map(r => (
                  <ReminderRow
                    key={r.id}
                    reminder={r}
                    onDismiss={id => dismiss.mutate(id)}
                    onEdit={r => setEditReminder(r)}
                    onDelete={id => setConfirmDeleteId(id)}
                    canEdit={user?.role !== 'Viewer'}
                    canDelete={user?.role === 'Admin'}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {(showModal || editReminder) && (
        <ReminderModal
          reminder={editReminder || undefined}
          onClose={() => { setShowModal(false); setEditReminder(null); }}
          onSave={() => {
            setShowModal(false);
            setEditReminder(null);
            qc.invalidateQueries({ queryKey: ['reminders'] });
            toast.success(editReminder ? 'Reminder updated' : 'Reminder set');
          }}
        />
      )}

      {confirmDeleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)' }}>
          <div className="rounded-xl p-6 max-w-sm w-full" style={{ background: '#1c2333', border: '1px solid #30363d' }}>
            <h3 className="text-base font-semibold mb-2" style={{ color: '#e6edf3' }}>Delete Reminder?</h3>
            <p className="text-sm mb-6" style={{ color: '#8b949e' }}>This will permanently delete this reminder.</p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setConfirmDeleteId(null)} className="btn-secondary">Cancel</button>
              <button onClick={() => deleteReminder.mutate(confirmDeleteId!)} className="btn-danger">Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
