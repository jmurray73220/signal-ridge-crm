import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, CheckSquare, Trash2, Pencil } from 'lucide-react';
import { tasksApi } from '../api';
import { EntityTypeBadge } from '../components/EntityTypeBadge';
import { TaskModal } from '../components/TaskModal';
import toast from 'react-hot-toast';
import { useAuth } from '../contexts/AuthContext';
import type { Task } from '../types';

function formatDate(d?: string | null) {
  if (!d) return null;
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function isOverdue(t: Task) {
  return !t.completed && t.dueDate != null && new Date(t.dueDate).getTime() < Date.now();
}

function isDueToday(t: Task) {
  if (!t.dueDate || t.completed) return false;
  const d = new Date(t.dueDate);
  const now = new Date();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
}

function isUpcoming(t: Task) {
  if (!t.dueDate || t.completed) return false;
  const d = new Date(t.dueDate).getTime();
  const now = Date.now();
  return d > now && d < now + 14 * 24 * 60 * 60 * 1000 && !isDueToday(t);
}

type Group = { label: string; color: string; items: Task[] };

function groupTasks(tasks: Task[]): Group[] {
  const groups: Group[] = [
    { label: 'Overdue', color: '#da3633', items: tasks.filter(isOverdue) },
    { label: 'Due Today', color: '#c9a84c', items: tasks.filter(isDueToday) },
    { label: 'Upcoming', color: '#34d399', items: tasks.filter(isUpcoming) },
    { label: 'No Date', color: '#8b949e', items: tasks.filter(t => !t.completed && !t.dueDate) },
    { label: 'Completed', color: '#238636', items: tasks.filter(t => t.completed) },
  ];
  return groups.filter(g => g.items.length > 0);
}

function TaskRow({ task, onComplete, onEdit, onDelete, canEdit, canDelete }: {
  task: Task;
  onComplete: (id: string) => void;
  onEdit: (t: Task) => void;
  onDelete: (id: string) => void;
  canEdit: boolean;
  canDelete: boolean;
}) {
  const overdue = isOverdue(task);
  return (
    <div className="flex items-start gap-3 py-3" style={{ borderBottom: '1px solid #30363d' }}>
      <button
        onClick={() => !task.completed && canEdit && onComplete(task.id)}
        disabled={task.completed || !canEdit}
        className="mt-0.5 w-4 h-4 rounded border flex-shrink-0 flex items-center justify-center transition-colors"
        style={{
          border: `1px solid ${task.completed ? '#238636' : overdue ? '#da3633' : '#30363d'}`,
          background: task.completed ? '#238636' : 'transparent',
          cursor: task.completed || !canEdit ? 'default' : 'pointer',
        }}
      >
        {task.completed && <span style={{ color: 'white', fontSize: 10 }}>✓</span>}
      </button>

      <div className="flex-1 min-w-0">
        <div className="text-sm" style={{
          color: task.completed ? '#8b949e' : '#e6edf3',
          textDecoration: task.completed ? 'line-through' : 'none',
        }}>
          {task.title}
        </div>
        <div className="flex items-center gap-3 mt-1 flex-wrap">
          {task.dueDate && (
            <span className="text-xs" style={{ color: overdue && !task.completed ? '#da3633' : '#8b949e' }}>
              {overdue && !task.completed ? 'Overdue — ' : ''}{formatDate(task.dueDate)}
            </span>
          )}
          {task.contact && (
            <Link to={`/contacts/${task.contact.id}`} className="text-xs hover:opacity-80" style={{ color: '#c9a84c', textDecoration: 'none' }}>
              {task.contact.firstName} {task.contact.lastName}
            </Link>
          )}
          {task.entity && (
            <div className="flex items-center gap-1">
              <EntityTypeBadge entityType={task.entity.entityType} chamber={task.entity.chamber} governmentType={task.entity.governmentType} />
              <Link to={`/entities/${task.entity.id}`} className="text-xs hover:opacity-80" style={{ color: '#8b949e', textDecoration: 'none' }}>
                {task.entity.name}
              </Link>
            </div>
          )}
          {task.initiative && (
            <Link to={`/initiatives/${task.initiative.id}`} className="text-xs hover:opacity-80" style={{ color: '#8b949e', textDecoration: 'none' }}>
              → {task.initiative.title}
            </Link>
          )}
        </div>
      </div>

      <div className="flex items-center gap-1 flex-shrink-0">
        {canEdit && !task.completed && (
          <button onClick={() => onEdit(task)} className="p-1 hover:opacity-80" style={{ color: '#8b949e' }} title="Edit">
            <Pencil size={13} />
          </button>
        )}
        {canDelete && (
          <button onClick={() => onDelete(task.id)} className="p-1 hover:opacity-80" style={{ color: '#30363d' }} title="Delete">
            <Trash2 size={14} />
          </button>
        )}
      </div>
    </div>
  );
}

export function Tasks() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [editTask, setEditTask] = useState<Task | null>(null);
  const [showCompleted, setShowCompleted] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ['tasks', 'all'],
    queryFn: () => tasksApi.list().then(r => r.data),
  });

  const completeTask = useMutation({
    mutationFn: (id: string) => tasksApi.update(id, { completed: true }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['tasks'] }); toast.success('Task completed'); },
  });

  const deleteTask = useMutation({
    mutationFn: (id: string) => tasksApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tasks'] });
      setConfirmDeleteId(null);
      toast.success('Task deleted');
    },
    onError: () => toast.error('Failed to delete task'),
  });

  const displayTasks = showCompleted ? tasks : tasks.filter(t => !t.completed);
  const groups = groupTasks(displayTasks);

  const overdueCount = tasks.filter(isOverdue).length;
  const todayCount = tasks.filter(isDueToday).length;
  const openCount = tasks.filter(t => !t.completed).length;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold" style={{ color: '#e6edf3' }}>Tasks</h1>
          <div className="flex items-center gap-3 mt-0.5">
            <span className="text-sm" style={{ color: '#8b949e' }}>{openCount} open</span>
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
              <Plus size={14} /> Add Task
            </button>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="text-center p-12 text-sm" style={{ color: '#8b949e' }}>Loading…</div>
      ) : groups.length === 0 ? (
        <div className="card text-center py-16">
          <CheckSquare size={48} className="mx-auto mb-4" style={{ color: '#30363d' }} />
          <p className="text-sm mb-4" style={{ color: '#8b949e' }}>No open tasks.</p>
          {user?.role !== 'Viewer' && (
            <button onClick={() => setShowModal(true)} className="btn-primary text-sm">Add Task</button>
          )}
        </div>
      ) : (
        <div className="space-y-8">
          {groups.map(group => (
            <div key={group.label}>
              <div className="flex items-center gap-3 mb-1">
                <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: group.color }}>{group.label}</span>
                <span className="text-xs rounded-full px-2 py-0.5" style={{ background: `${group.color}22`, color: group.color }}>
                  {group.items.length}
                </span>
              </div>
              <div className="card p-0 px-4">
                {group.items.map(task => (
                  <TaskRow
                    key={task.id}
                    task={task}
                    onComplete={id => completeTask.mutate(id)}
                    onEdit={t => setEditTask(t)}
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

      {(showModal || editTask) && (
        <TaskModal
          task={editTask || undefined}
          onClose={() => { setShowModal(false); setEditTask(null); }}
          onSave={() => {
            const wasEdit = !!editTask;
            setShowModal(false);
            setEditTask(null);
            qc.invalidateQueries({ queryKey: ['tasks'] });
            toast.success(wasEdit ? 'Task updated' : 'Task created');
          }}
        />
      )}

      {confirmDeleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)' }}>
          <div className="rounded-xl p-6 max-w-sm w-full" style={{ background: '#1c2333', border: '1px solid #30363d' }}>
            <h3 className="text-base font-semibold mb-2" style={{ color: '#e6edf3' }}>Delete Task?</h3>
            <p className="text-sm mb-6" style={{ color: '#8b949e' }}>This will permanently delete this task.</p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setConfirmDeleteId(null)} className="btn-secondary">Cancel</button>
              <button onClick={() => deleteTask.mutate(confirmDeleteId!)} className="btn-danger">Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
