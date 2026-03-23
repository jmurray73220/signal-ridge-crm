import { useState } from 'react';
import { X } from 'lucide-react';
import { entitiesApi } from '../api';
import type { Entity, EntityType } from '../types';
import toast from 'react-hot-toast';

const ENTITY_TAGS = ['Priority Account', 'Active Contract', 'Oversight', 'Appropriations', 'Authorization', 'FYDP', 'Current Client', 'Prospect'];
const ENTITY_TYPES: EntityType[] = ['CongressionalOffice', 'GovernmentOrganization', 'Company', 'Client', 'NGO', 'Other'];

interface Props {
  entity?: Entity;
  defaultType?: EntityType;
  onClose: () => void;
  onSave: () => void;
}

export function EntityModal({ entity, defaultType, onClose, onSave }: Props) {
  const [form, setForm] = useState({
    name: entity?.name || '',
    entityType: entity?.entityType || defaultType || 'GovernmentOrganization' as EntityType,
    website: entity?.website || '',
    description: entity?.description || '',
    address: entity?.address || '',
    tags: entity?.tags || [] as string[],
    // Congressional
    memberName: entity?.memberName || '',
    chamber: entity?.chamber || 'Senate',
    state: entity?.state || '',
    district: entity?.district || '',
    committee: (entity?.committee || []).join(', '),
    party: entity?.party || 'Republican',
    subcommittee: (entity?.subcommittee || []).join(', '),
    // Government
    parentAgency: entity?.parentAgency || '',
    subComponent: entity?.subComponent || '',
    governmentType: entity?.governmentType || 'DoD',
    budgetLineItem: entity?.budgetLineItem || '',
    // Company
    industry: entity?.industry || '',
    contractVehicles: (entity?.contractVehicles || []).join(', '),
  });
  const [loading, setLoading] = useState(false);

  const set = (key: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm(f => ({ ...f, [key]: e.target.value }));

  const toggleTag = (tag: string) =>
    setForm(f => ({
      ...f,
      tags: f.tags.includes(tag) ? f.tags.filter(t => t !== tag) : [...f.tags, tag],
    }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name) { toast.error('Name required'); return; }
    setLoading(true);
    try {
      const data: Record<string, unknown> = {
        name: form.name,
        entityType: form.entityType,
        website: form.website || null,
        description: form.description || null,
        address: form.address || null,
        tags: form.tags,
      };
      if (form.entityType === 'CongressionalOffice') {
        data.memberName = form.memberName || null;
        data.chamber = form.chamber || null;
        data.state = form.state || null;
        data.district = form.district || null;
        data.committee = form.committee ? form.committee.split(',').map((s: string) => s.trim()).filter(Boolean) : [];
        data.party = form.party || null;
        data.subcommittee = form.subcommittee ? form.subcommittee.split(',').map((s: string) => s.trim()).filter(Boolean) : [];
      } else if (form.entityType === 'GovernmentOrganization') {
        data.parentAgency = form.parentAgency || null;
        data.subComponent = form.subComponent || null;
        data.governmentType = form.governmentType || null;
        data.budgetLineItem = form.budgetLineItem || null;
      } else if (form.entityType === 'Company' || form.entityType === 'Client') {
        data.industry = form.industry || null;
        data.contractVehicles = form.contractVehicles ? form.contractVehicles.split(',').map((s: string) => s.trim()).filter(Boolean) : [];
      }
      if (entity?.id) {
        await entitiesApi.update(entity.id, data);
      } else {
        await entitiesApi.create(data);
      }
      onSave();
    } catch (err: unknown) {
      const apiErr = err as { response?: { data?: { error?: string } } };
      toast.error(apiErr.response?.data?.error || 'Failed to save');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)' }}>
      <div className="w-full max-w-2xl rounded-xl overflow-hidden" style={{ background: '#1c2333', border: '1px solid #30363d', maxHeight: '90vh', overflowY: 'auto' }}>
        <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid #30363d' }}>
          <h2 className="text-base font-semibold" style={{ color: '#e6edf3' }}>
            {entity ? 'Edit Organization' : 'Add Organization'}
          </h2>
          <button onClick={onClose} style={{ color: '#8b949e' }}><X size={18} /></button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Name *</label>
              <input className="input" value={form.name} onChange={set('name')} required />
            </div>
            <div>
              <label className="label">Type *</label>
              <select className="input" value={form.entityType} onChange={set('entityType')}>
                {ENTITY_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>

          {/* Congressional fields */}
          {form.entityType === 'CongressionalOffice' && (
            <>
              <div>
                <label className="label">Member Name</label>
                <input className="input" value={form.memberName} onChange={set('memberName')} placeholder="Sen. John Cornyn" />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="label">Chamber</label>
                  <select className="input" value={form.chamber} onChange={set('chamber')}>
                    <option value="Senate">Senate</option>
                    <option value="House">House</option>
                  </select>
                </div>
                <div>
                  <label className="label">State</label>
                  <input className="input" value={form.state} onChange={set('state')} placeholder="TX" maxLength={2} />
                </div>
                <div>
                  <label className="label">District (House only)</label>
                  <input className="input" value={form.district} onChange={set('district')} placeholder="1st" />
                </div>
              </div>
              <div>
                <label className="label">Party</label>
                <select className="input" value={form.party} onChange={set('party')}>
                  <option value="Republican">Republican</option>
                  <option value="Democrat">Democrat</option>
                  <option value="Independent">Independent</option>
                </select>
              </div>
              <div>
                <label className="label">Committees (comma-separated)</label>
                <input className="input" value={form.committee} onChange={set('committee')} placeholder="Senate Armed Services Committee, Senate Judiciary Committee" />
              </div>
              <div>
                <label className="label">Subcommittees (comma-separated)</label>
                <input className="input" value={form.subcommittee} onChange={set('subcommittee')} placeholder="SASC Subcommittee on Emerging Threats…" />
              </div>
            </>
          )}

          {/* Government fields */}
          {form.entityType === 'GovernmentOrganization' && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Parent Agency</label>
                  <input className="input" value={form.parentAgency} onChange={set('parentAgency')} placeholder="Department of Defense" />
                </div>
                <div>
                  <label className="label">Sub-Component</label>
                  <input className="input" value={form.subComponent} onChange={set('subComponent')} placeholder="USSOCOM, DARPA…" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Government Type</label>
                  <select className="input" value={form.governmentType} onChange={set('governmentType')}>
                    {['DoD', 'Intel', 'DHS', 'State', 'Other'].map(t => <option key={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Budget Line Item</label>
                  <input className="input" value={form.budgetLineItem} onChange={set('budgetLineItem')} placeholder="PE 0305206D8Z" />
                </div>
              </div>
            </>
          )}

          {/* Company fields */}
          {form.entityType === 'Company' && (
            <>
              <div>
                <label className="label">Industry</label>
                <input className="input" value={form.industry} onChange={set('industry')} placeholder="Defense & Intelligence Contractor" />
              </div>
              <div>
                <label className="label">Contract Vehicles (comma-separated)</label>
                <input className="input" value={form.contractVehicles} onChange={set('contractVehicles')} placeholder="OASIS+, SEWP VI, GSA MAS" />
              </div>
            </>
          )}

          {/* Client fields */}
          {form.entityType === 'Client' && (
            <>
              <div>
                <label className="label">Industry</label>
                <input className="input" value={form.industry} onChange={set('industry')} placeholder="Aerospace & Defense" />
              </div>
              <div>
                <label className="label">Contract Vehicles (comma-separated)</label>
                <input className="input" value={form.contractVehicles} onChange={set('contractVehicles')} placeholder="OASIS+, SEWP VI, GSA MAS" />
              </div>
            </>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Website</label>
              <input className="input" type="url" value={form.website} onChange={set('website')} placeholder="https://…" />
            </div>
            <div>
              <label className="label">Address</label>
              <input className="input" value={form.address} onChange={set('address')} />
            </div>
          </div>

          <div>
            <label className="label">Description</label>
            <textarea className="input" value={form.description} onChange={set('description')} rows={3} style={{ resize: 'vertical' }} />
          </div>

          <div>
            <label className="label">Tags</label>
            <div className="flex flex-wrap gap-2 mt-1">
              {ENTITY_TAGS.map(tag => (
                <button
                  key={tag} type="button" onClick={() => toggleTag(tag)}
                  className="badge cursor-pointer transition-all"
                  style={{
                    background: form.tags.includes(tag) ? 'rgba(201,168,76,0.15)' : '#161b22',
                    color: form.tags.includes(tag) ? '#c9a84c' : '#8b949e',
                    border: `1px solid ${form.tags.includes(tag) ? '#c9a84c' : '#30363d'}`,
                  }}
                >{tag}</button>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={loading} className="btn-primary">
              {loading ? 'Saving…' : entity ? 'Save Changes' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
