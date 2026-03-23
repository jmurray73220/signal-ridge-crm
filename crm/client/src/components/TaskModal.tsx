import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { X } from 'lucide-react';
import { tasksApi, contactsApi, entitiesApi, initiativesApi } from '../api';
import type { Task } from '../types';
import toast from 'react-hot-toast';

interface Props {
  task?: Task;
  defaultContactId?: string;
  defaultEntityId?: string;
  defaultInitiativeId?: string;
  onClose: () => void;
  onSave: () => void;
}

export function TaskModal({ task, defaultContactId, defaultEntityId, defaultInitiativeId, onClose, onSave }: Props) {
  const [form, setForm] = useState({
    title: task?.title || '',
    dueDate: task?.dueDate ? task.dueDate.split('T')[0] : '',
    contactId: task?.contactId || defaultContactId || '',
    entityId: task?.entityId || defaultEntityId || '',
    initiativeId: task?.initiativeId || defaultInitiativeId || '',
  });
  const [loading, setLoading] = useState(false);

  const { data: contacts = [] } = useQuery({ queryKey: ['contacts'], queryFn: () => contactsApi.list().then(r => r.data) });
  const { data: entities = [] } = useQuery({ queryKey: ['entities'], queryFn: () => entitiesApi.list().then(r => r.data) });
  const { data: initiatives = [] } = useQuery({ queryKey: ['initiatives'], queryFn: () => initiativesApi.list().then(r => r.data) });

  const set = (key: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(f => ({ ...f, [key]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title) { toast.error('Title required'); return; }
    setLoading(true);
    try {
      const data: Record<string, unknown> = {
        title: form.title,
        dueDate: form.dueDate || null,
        contactId: form.contactId || null,
        entityId: form.entityId || null,
        initiativeId: form.initiativeId || null,
      };
      if (task?.id) {
        await tasksApi.update(task.id, data as Partial<Task>);
      } else {
        await tasksApi.create(data as Partial<Task>);
      }
      onSave();
    } catch (err: unknown) {
      const message = err && typeof err === 'object' && 'response' in err
        ? (err as { response?: { data?: { error?: string } } }).response?.data?.error
        : undefined;
      toast.error(message || 'Failed to save task');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)' }}>
      <div className="w-full max-w-md rounded-xl overflow-hidden" style={{ background: '#1c2333', border: '1px solid #30363d' }}>
        <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid #30363d' }}>
          <h2 className="text-base font-semibold" style={{ color: '#e6edf3' }}>{task ? 'Edit Task' : 'Add Task'}</h2>
          <button onClick={onClose} style={{ color: '#8b949e' }}><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="label">Task *</label>
            <input className="input" value={form.title} onChange={set('title')} placeholder="What needs to be done?" required />
          </div>
          <div>
            <label className="label">Due Date</label>
            <input type="date" className="input" value={form.dueDate} onChange={set('dueDate')} />
          </div>
          <div>
            <label className="label">Contact (optional)</label>
            <select className="input" value={form.contactId} onChange={set('contactId')}>
              <option value="">— None —</option>
              {contacts.map(c => <option key={c.id} value={c.id}>{c.firstName} {c.lastName}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Organization (optional)</label>
            <select className="input" value={form.entityId} onChange={set('entityId')}>
              <option value="">— None —</option>
              {entities.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Initiative (optional)</label>
            <select className="input" value={form.initiativeId} onChange={set('initiativeId')}>
              <option value="">— None —</option>
              {initiatives.map(i => <option key={i.id} value={i.id}>{i.title}</option>)}
            </select>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={loading} className="btn-primary">
              {loading ? 'Saving…' : task ? 'Save Changes' : 'Create Task'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
