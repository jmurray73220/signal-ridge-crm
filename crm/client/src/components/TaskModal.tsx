import { useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { X } from 'lucide-react';
import { tasksApi, contactsApi, entitiesApi, initiativesApi } from '../api';
import type { Task, Entity, Contact } from '../types';
import toast from 'react-hot-toast';

interface Props {
  task?: Task;
  defaultContactId?: string;
  defaultEntityId?: string;
  defaultInitiativeId?: string;
  onClose: () => void;
  onSave: () => void;
}

function EntityAutocomplete({
  value,
  onChange,
  entities,
  label,
}: {
  value: string;
  onChange: (id: string) => void;
  entities: Entity[];
  label: string;
}) {
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Set display name from value
  const selected = entities.find(e => e.id === value);

  useEffect(() => {
    if (selected) setSearch(selected.name);
    else setSearch('');
  }, [value, selected]);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const filtered = search
    ? entities.filter(e => e.name.toLowerCase().includes(search.toLowerCase()))
    : entities;

  return (
    <div ref={ref} className="relative">
      <label className="label">{label}</label>
      <input
        className="input"
        value={search}
        onChange={e => {
          setSearch(e.target.value);
          setOpen(true);
          if (!e.target.value) onChange('');
        }}
        onFocus={() => setOpen(true)}
        placeholder="Start typing to search…"
      />
      {open && filtered.length > 0 && (
        <div
          className="absolute z-50 w-full mt-1 max-h-48 overflow-y-auto rounded-lg shadow-lg"
          style={{ background: '#1c2333', border: '1px solid #30363d' }}
        >
          {filtered.slice(0, 20).map(e => (
            <button
              key={e.id}
              type="button"
              onClick={() => {
                onChange(e.id);
                setSearch(e.name);
                setOpen(false);
              }}
              className="w-full text-left px-3 py-2 text-sm transition-colors hover:bg-white/5"
              style={{
                color: e.id === value ? '#c9a84c' : '#e6edf3',
                background: e.id === value ? 'rgba(201,168,76,0.1)' : 'transparent',
                borderBottom: '1px solid #30363d',
              }}
            >
              {e.name}
            </button>
          ))}
        </div>
      )}
      {value && (
        <button
          type="button"
          onClick={() => { onChange(''); setSearch(''); }}
          className="absolute right-2 top-[calc(50%+4px)] text-xs"
          style={{ color: '#8b949e' }}
        >
          <X size={14} />
        </button>
      )}
    </div>
  );
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

  const { data: allContacts = [] } = useQuery({ queryKey: ['contacts'], queryFn: () => contactsApi.list().then(r => r.data) });
  const { data: entities = [] } = useQuery({ queryKey: ['entities'], queryFn: () => entitiesApi.list().then(r => r.data) });
  const { data: initiatives = [] } = useQuery({ queryKey: ['initiatives'], queryFn: () => initiativesApi.list().then(r => r.data) });

  // Filter contacts by selected entity
  const contacts = form.entityId
    ? allContacts.filter(c => c.entityId === form.entityId)
    : allContacts;

  // Clear contact if it doesn't belong to the new entity
  useEffect(() => {
    if (form.entityId && form.contactId) {
      const contactBelongs = allContacts.some(c => c.id === form.contactId && c.entityId === form.entityId);
      if (!contactBelongs) {
        setForm(f => ({ ...f, contactId: '' }));
      }
    }
  }, [form.entityId, form.contactId, allContacts]);

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
          <EntityAutocomplete
            value={form.entityId}
            onChange={id => setForm(f => ({ ...f, entityId: id }))}
            entities={entities}
            label="Organization (optional)"
          />
          <div>
            <label className="label">Contact (optional){form.entityId ? ' — filtered by org' : ''}</label>
            <select className="input" value={form.contactId} onChange={set('contactId')}>
              <option value="">— None —</option>
              {contacts.map(c => <option key={c.id} value={c.id}>{c.firstName} {c.lastName}</option>)}
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
