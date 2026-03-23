import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { X } from 'lucide-react';
import { contactsApi, entitiesApi } from '../api';
import type { Contact } from '../types';
import toast from 'react-hot-toast';

const CONTACT_TAGS = [
  'Hill Staffer', 'Member', 'Program Office', 'Contracting Officer', 'SES',
  'Flag Officer', 'Decision Maker', 'Technical POC', 'BD Target', 'Champion',
  'Gatekeeper', 'SITE 525'
];

interface Props {
  contact?: Contact;
  onClose: () => void;
  onSave: () => void;
}

export function ContactModal({ contact, onClose, onSave }: Props) {
  const [form, setForm] = useState({
    firstName: contact?.firstName || '',
    lastName: contact?.lastName || '',
    rank: contact?.rank || '',
    title: contact?.title || '',
    email: contact?.email || '',
    officePhone: contact?.officePhone || '',
    cell: contact?.cell || '',
    linkedIn: contact?.linkedIn || '',
    bio: contact?.bio || '',
    entityId: contact?.entityId || '',
    tags: contact?.tags || [] as string[],
  });
  const [loading, setLoading] = useState(false);

  const { data: entities = [] } = useQuery({
    queryKey: ['entities'],
    queryFn: () => entitiesApi.list().then(r => r.data),
  });

  const set = (key: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm(f => ({ ...f, [key]: e.target.value }));

  const toggleTag = (tag: string) =>
    setForm(f => ({
      ...f,
      tags: f.tags.includes(tag) ? f.tags.filter(t => t !== tag) : [...f.tags, tag],
    }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.firstName || !form.lastName) {
      toast.error('First and last name required');
      return;
    }
    setLoading(true);
    try {
      const data: any = {
        ...form,
        entityId: form.entityId || null,
        rank: form.rank || null,
        title: form.title || null,
        email: form.email || null,
        officePhone: form.officePhone || null,
        cell: form.cell || null,
        linkedIn: form.linkedIn || null,
        bio: form.bio || null,
      };
      if (contact?.id) {
        await contactsApi.update(contact.id, data);
      } else {
        await contactsApi.create(data);
      }
      onSave();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to save contact');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)' }}>
      <div className="w-full max-w-2xl rounded-xl overflow-hidden" style={{ background: '#1c2333', border: '1px solid #30363d', maxHeight: '90vh', overflowY: 'auto' }}>
        <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid #30363d' }}>
          <h2 className="text-base font-semibold" style={{ color: '#e6edf3' }}>
            {contact ? 'Edit Contact' : 'Add Contact'}
          </h2>
          <button onClick={onClose} style={{ color: '#8b949e' }}>
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">First Name *</label>
              <input className="input" value={form.firstName} onChange={set('firstName')} required />
            </div>
            <div>
              <label className="label">Last Name *</label>
              <input className="input" value={form.lastName} onChange={set('lastName')} required />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Rank (optional)</label>
              <input className="input" value={form.rank} onChange={set('rank')} placeholder="COL, RDML, SES…" />
            </div>
            <div>
              <label className="label">Title / Position</label>
              <input className="input" value={form.title} onChange={set('title')} placeholder="Legislative Director…" />
            </div>
          </div>

          <div>
            <label className="label">Organization</label>
            <select className="input" value={form.entityId} onChange={set('entityId')}>
              <option value="">— None —</option>
              {entities.map(e => (
                <option key={e.id} value={e.id}>{e.name}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Email</label>
              <input className="input" type="email" value={form.email} onChange={set('email')} />
            </div>
            <div>
              <label className="label">Office Phone</label>
              <input className="input" type="tel" value={form.officePhone} onChange={set('officePhone')} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Cell</label>
              <input className="input" type="tel" value={form.cell} onChange={set('cell')} />
            </div>
            <div>
              <label className="label">LinkedIn URL</label>
              <input className="input" type="url" value={form.linkedIn} onChange={set('linkedIn')} />
            </div>
          </div>

          <div>
            <label className="label">Bio / Notes</label>
            <textarea
              className="input"
              value={form.bio}
              onChange={set('bio')}
              rows={3}
              style={{ resize: 'vertical' }}
            />
          </div>

          <div>
            <label className="label">Tags</label>
            <div className="flex flex-wrap gap-2 mt-1">
              {CONTACT_TAGS.map(tag => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => toggleTag(tag)}
                  className="badge cursor-pointer transition-all"
                  style={{
                    background: form.tags.includes(tag) ? 'rgba(201,168,76,0.15)' : '#161b22',
                    color: form.tags.includes(tag) ? '#c9a84c' : '#8b949e',
                    border: `1px solid ${form.tags.includes(tag) ? '#c9a84c' : '#30363d'}`,
                  }}
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={loading} className="btn-primary">
              {loading ? 'Saving…' : contact ? 'Save Changes' : 'Create Contact'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
