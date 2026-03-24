import { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { X, Plus } from 'lucide-react';
import { contactsApi, entitiesApi } from '../api';
import { EntityModal } from './EntityModal';
import type { Contact, EntityType } from '../types';
import toast from 'react-hot-toast';

const CONTACT_TAGS = [
  'Hill Staffer', 'Member', 'Program Office', 'Contracting Officer', 'SES',
  'Flag Officer', 'Decision Maker', 'Technical POC', 'BD Target', 'Champion',
  'Gatekeeper', 'SITE 525'
];

const ENTITY_TYPE_LABELS: Record<string, string> = {
  CongressionalOffice: 'Congressional Office',
  GovernmentOrganization: 'Government Organization',
  Company: 'Company',
  Client: 'Client',
  NGO: 'NGO',
  Other: 'Other',
};

const ALL_ENTITY_TYPES: EntityType[] = ['CongressionalOffice', 'GovernmentOrganization', 'Company', 'Client', 'NGO', 'Other'];

interface Props {
  contact?: Contact;
  defaultEntityId?: string;
  onClose: () => void;
  onSave: () => void;
}

export function ContactModal({ contact, defaultEntityId, onClose, onSave }: Props) {
  const qc = useQueryClient();
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
    entityId: contact?.entityId || defaultEntityId || '',
    tags: contact?.tags || [] as string[],
  });
  const [loading, setLoading] = useState(false);
  const [entityTypeFilter, setEntityTypeFilter] = useState<string>('');
  const [showNewEntity, setShowNewEntity] = useState(false);

  const { data: entities = [] } = useQuery({
    queryKey: ['entities'],
    queryFn: () => entitiesApi.list().then(r => r.data),
  });

  // Auto-detect entity type from the selected entity or defaultEntityId
  useState(() => {
    if (form.entityId && entities.length > 0) {
      const match = entities.find(e => e.id === form.entityId);
      if (match) setEntityTypeFilter(match.entityType);
    }
  });

  // Filter entities by selected type
  const filteredEntities = useMemo(() => {
    if (!entityTypeFilter) return entities;
    return entities.filter(e => e.entityType === entityTypeFilter);
  }, [entities, entityTypeFilter]);

  // Auto-set type filter when entities load and we have a default
  useMemo(() => {
    if (form.entityId && entities.length > 0 && !entityTypeFilter) {
      const match = entities.find(e => e.id === form.entityId);
      if (match) setEntityTypeFilter(match.entityType);
    }
  }, [entities, form.entityId]);

  // Detect if selected entity is a committee (name contains "Committee")
  const selectedEntity = useMemo(() => {
    if (!form.entityId) return null;
    return entities.find(e => e.id === form.entityId) ?? null;
  }, [form.entityId, entities]);

  const isCommitteeEntity = useMemo(() => {
    if (!selectedEntity) return false;
    return selectedEntity.name.toLowerCase().includes('committee');
  }, [selectedEntity]);

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

          {isCommitteeEntity ? (
            <div className="grid grid-cols-4 gap-4">
              <div>
                <label className="label">Chamber</label>
                <div className="input flex items-center text-sm" style={{ color: '#8b949e' }}>
                  {selectedEntity?.chamber || '—'}
                </div>
              </div>
              <div>
                <label className="label">Party</label>
                <select
                  className="input"
                  value={form.tags.find(t => t === 'Republican' || t === 'Democrat' || t === 'Independent') || ''}
                  onChange={e => {
                    const party = e.target.value;
                    setForm(f => ({
                      ...f,
                      tags: [...f.tags.filter(t => t !== 'Republican' && t !== 'Democrat' && t !== 'Independent'), ...(party ? [party] : [])],
                    }));
                  }}
                >
                  <option value="">—</option>
                  <option value="Republican">Republican</option>
                  <option value="Democrat">Democrat</option>
                  <option value="Independent">Independent</option>
                </select>
              </div>
              <div>
                <label className="label">Subcommittee</label>
                <input className="input" value={form.rank} onChange={set('rank')} placeholder="e.g. ISO" />
              </div>
              <div>
                <label className="label">Title / Position</label>
                <input className="input" value={form.title} onChange={set('title')} placeholder="Staff Director, Counsel…" />
              </div>
            </div>
          ) : (
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
          )}

          <div>
            <label className="label">Organization</label>
            <div className="grid grid-cols-2 gap-4">
              <select
                className="input"
                value={entityTypeFilter}
                onChange={e => {
                  setEntityTypeFilter(e.target.value);
                  setForm(f => ({ ...f, entityId: '' }));
                }}
              >
                <option value="">All Types</option>
                {ALL_ENTITY_TYPES.map(t => (
                  <option key={t} value={t}>{ENTITY_TYPE_LABELS[t] || t}</option>
                ))}
              </select>
              <div className="flex gap-2">
                <select className="input flex-1" value={form.entityId} onChange={set('entityId')}>
                  <option value="">— None —</option>
                  {filteredEntities.map(e => (
                    <option key={e.id} value={e.id}>{e.name}</option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => setShowNewEntity(true)}
                  className="flex items-center gap-1 px-2.5 rounded text-xs whitespace-nowrap"
                  style={{ color: '#c9a84c', border: '1px solid #30363d', background: '#161b22' }}
                  title="Create new organization"
                >
                  <Plus size={13} /> New
                </button>
              </div>
            </div>
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

      {/* Inline entity creation modal */}
      {showNewEntity && (
        <EntityModal
          defaultType={(entityTypeFilter as EntityType) || undefined}
          onClose={() => setShowNewEntity(false)}
          onSave={async () => {
            setShowNewEntity(false);
            // Refetch entities so the new one appears in the dropdown
            const res = await entitiesApi.list();
            qc.setQueryData(['entities'], res.data);
            // Auto-select the newly created entity (last one by createdAt)
            const sorted = [...res.data].sort((a, b) =>
              new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
            );
            if (sorted.length > 0) {
              const newest = sorted[0];
              setEntityTypeFilter(newest.entityType);
              setForm(f => ({ ...f, entityId: newest.id }));
            }
            toast.success('Organization created');
          }}
        />
      )}
    </div>
  );
}
