import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { X } from 'lucide-react';
import { remindersApi, contactsApi, entitiesApi, initiativesApi, interactionsApi } from '../api';
import type { Reminder } from '../types';
import toast from 'react-hot-toast';

interface Props {
  reminder?: Reminder;
  defaultContactId?: string;
  defaultEntityId?: string;
  defaultInteractionId?: string;
  onClose: () => void;
  onSave: () => void;
}

export function ReminderModal({ reminder, defaultContactId, defaultEntityId, defaultInteractionId, onClose, onSave }: Props) {
  // Extract time from existing reminder if present, otherwise empty (will default to 11:00)
  const existingTime = reminder?.remindAt
    ? (() => {
        const d = new Date(reminder.remindAt);
        const h = d.getUTCHours().toString().padStart(2, '0');
        const m = d.getUTCMinutes().toString().padStart(2, '0');
        return h !== '00' || m !== '00' ? `${h}:${m}` : '';
      })()
    : '';

  const [form, setForm] = useState({
    title: reminder?.title || '',
    notes: reminder?.notes || '',
    remindDate: reminder?.remindAt ? reminder.remindAt.split('T')[0] : '',
    remindTime: existingTime,
    contactId: reminder?.contactId || defaultContactId || '',
    entityId: reminder?.entityId || defaultEntityId || '',
    initiativeId: reminder?.initiativeId || '',
    interactionId: reminder?.interactionId || defaultInteractionId || '',
  });
  const [loading, setLoading] = useState(false);

  const { data: contacts = [] } = useQuery({ queryKey: ['contacts'], queryFn: () => contactsApi.list().then(r => r.data) });
  const { data: entities = [] } = useQuery({ queryKey: ['entities'], queryFn: () => entitiesApi.list().then(r => r.data) });
  const { data: initiatives = [] } = useQuery({ queryKey: ['initiatives'], queryFn: () => initiativesApi.list().then(r => r.data) });
  const { data: interactions = [] } = useQuery({ queryKey: ['interactions'], queryFn: () => interactionsApi.list().then(r => r.data) });

  const set = (key: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [key]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title) { toast.error('Title required'); return; }
    if (!form.remindDate) { toast.error('Remind date required'); return; }
    setLoading(true);
    try {
      // Combine date + time; default to 11:00 if no time specified
      const time = form.remindTime || '11:00';
      const remindAt = `${form.remindDate}T${time}:00`;
      const data = {
        title: form.title,
        notes: form.notes || undefined,
        remindAt,
        contactId: form.contactId || null,
        entityId: form.entityId || null,
        initiativeId: form.initiativeId || null,
        interactionId: form.interactionId || null,
      };
      if (reminder?.id) {
        await remindersApi.update(reminder.id, data as any);
      } else {
        await remindersApi.create(data as any);
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
      <div className="w-full max-w-md rounded-xl overflow-hidden" style={{ background: '#1c2333', border: '1px solid #30363d' }}>
        <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid #30363d' }}>
          <h2 className="text-base font-semibold" style={{ color: '#e6edf3' }}>
            {reminder ? 'Edit Reminder' : 'Set Reminder'}
          </h2>
          <button onClick={onClose} style={{ color: '#8b949e' }}><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="label">Reminder *</label>
            <input
              className="input"
              value={form.title}
              onChange={set('title')}
              placeholder="Follow up if no response…"
              required
              autoFocus
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Remind Date *</label>
              <input type="date" className="input" value={form.remindDate} onChange={set('remindDate')} required />
            </div>
            <div>
              <label className="label">Time (optional)</label>
              <input type="time" className="input" value={form.remindTime} onChange={set('remindTime')} placeholder="11:00 AM default" />
              {!form.remindTime && (
                <span className="text-xs mt-0.5 block" style={{ color: '#8b949e' }}>Defaults to 11:00 AM</span>
              )}
            </div>
          </div>
          <div>
            <label className="label">Notes (optional)</label>
            <textarea
              className="input"
              value={form.notes}
              onChange={set('notes')}
              rows={2}
              placeholder="Context or what to say…"
              style={{ resize: 'vertical' }}
            />
          </div>
          <div>
            <label className="label">Contact (optional)</label>
            <select className="input" value={form.contactId} onChange={set('contactId')}>
              <option value="">— None —</option>
              {contacts.map(c => <option key={c.id} value={c.id}>{c.firstName} {c.lastName}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Linked Interaction (optional)</label>
            <select className="input" value={form.interactionId} onChange={set('interactionId')}>
              <option value="">— None —</option>
              {interactions.map(i => (
                <option key={i.id} value={i.id}>
                  {i.type} — {i.subject} ({new Date(i.date).toLocaleDateString()})
                </option>
              ))}
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
              {loading ? 'Saving…' : reminder ? 'Save Changes' : 'Set Reminder'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
