import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { X } from 'lucide-react';
import { initiativesApi, entitiesApi } from '../api';
import type { Initiative, InitiativeStatus, InitiativePriority } from '../types';
import toast from 'react-hot-toast';

const STATUSES: InitiativeStatus[] = ['Pipeline', 'Active', 'OnHold', 'Closed'];
const PRIORITIES: InitiativePriority[] = ['High', 'Medium', 'Low'];

interface Props {
  initiative?: Initiative;
  onClose: () => void;
  onSave: () => void;
}

export function InitiativeModal({ initiative, onClose, onSave }: Props) {
  const [form, setForm] = useState({
    title: initiative?.title || '',
    description: initiative?.description || '',
    status: initiative?.status || 'Pipeline' as InitiativeStatus,
    priority: initiative?.priority || 'Medium' as InitiativePriority,
    startDate: initiative?.startDate ? initiative.startDate.split('T')[0] : '',
    targetDate: initiative?.targetDate ? initiative.targetDate.split('T')[0] : '',
    primaryEntityId: initiative?.primaryEntityId || '',
  });
  const [loading, setLoading] = useState(false);

  const { data: entities = [] } = useQuery({
    queryKey: ['entities'],
    queryFn: () => entitiesApi.list().then(r => r.data),
  });

  const set = (key: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm(f => ({ ...f, [key]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title) { toast.error('Title required'); return; }
    setLoading(true);
    try {
      const data = {
        title: form.title,
        description: form.description || null,
        status: form.status,
        priority: form.priority,
        startDate: form.startDate || null,
        targetDate: form.targetDate || null,
        primaryEntityId: form.primaryEntityId || null,
      };
      if (initiative?.id) {
        await initiativesApi.update(initiative.id, data as any);
      } else {
        await initiativesApi.create(data as any);
      }
      onSave();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to save');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)' }}>
      <div className="w-full max-w-lg rounded-xl overflow-hidden" style={{ background: '#1c2333', border: '1px solid #30363d', maxHeight: '90vh', overflowY: 'auto' }}>
        <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid #30363d' }}>
          <h2 className="text-base font-semibold" style={{ color: '#e6edf3' }}>
            {initiative ? 'Edit Initiative' : 'New Initiative'}
          </h2>
          <button onClick={onClose} style={{ color: '#8b949e' }}><X size={18} /></button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <div>
            <label className="label">Title *</label>
            <input className="input" value={form.title} onChange={set('title')} required placeholder="Initiative title…" />
          </div>

          <div>
            <label className="label">Description</label>
            <textarea className="input" value={form.description} onChange={set('description')} rows={3} style={{ resize: 'vertical' }} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Status</label>
              <select className="input" value={form.status} onChange={set('status')}>
                {STATUSES.map(s => <option key={s} value={s}>{s === 'OnHold' ? 'On Hold' : s}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Priority</label>
              <select className="input" value={form.priority} onChange={set('priority')}>
                {PRIORITIES.map(p => <option key={p}>{p}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="label">Primary Organization</label>
            <select className="input" value={form.primaryEntityId} onChange={set('primaryEntityId')}>
              <option value="">— None —</option>
              {entities.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Start Date</label>
              <input type="date" className="input" value={form.startDate} onChange={set('startDate')} />
            </div>
            <div>
              <label className="label">Target Date</label>
              <input type="date" className="input" value={form.targetDate} onChange={set('targetDate')} />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={loading} className="btn-primary">
              {loading ? 'Saving…' : initiative ? 'Save Changes' : 'Create Initiative'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
