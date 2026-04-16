import { useState, useMemo } from 'react';
import { X } from 'lucide-react';
import { entitiesApi } from '../api';
import type { Entity, EntityType } from '../types';
import toast from 'react-hot-toast';

const ENTITY_TYPES: EntityType[] = ['CongressionalOffice', 'GovernmentOrganization', 'Company', 'Client', 'Other'];

const US_STATES = [
  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA','KS',
  'KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY',
  'NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY',
  'DC','PR','GU','VI','AS','MP',
];

function getPartyInitial(party: string): string {
  if (party === 'Republican') return 'R';
  if (party === 'Democrat') return 'D';
  if (party === 'Independent') return 'I';
  return '';
}

type CongressionalMode = 'personal' | 'committee';

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
    // Congressional — Personal Office
    congFirstName: '',
    congLastName: '',
    nameManuallyEdited: !!entity,
    memberName: entity?.memberName?.includes(' | Ranking: ') ? entity.memberName.split(' | Ranking: ')[0] : (entity?.memberName || ''),
    rankingMember: entity?.memberName?.includes(' | Ranking: ') ? entity.memberName.split(' | Ranking: ')[1] : '',
    chamber: entity?.chamber || 'Senate',
    state: entity?.state || '',
    district: entity?.district || '',
    committee: (entity?.committee || []).join(', '),
    party: entity?.party || 'Republican',
    subcommittee: (entity?.subcommittee || []).join(', '),
    // Congressional — Committee mode extra fields
    committeeEmail: '',
    committeePhone: '',
    // Government
    parentAgency: entity?.parentAgency || '',
    subComponent: entity?.subComponent || '',
    governmentType: entity?.governmentType || 'DoD',
    budgetLineItem: entity?.budgetLineItem || '',
    // Company
    industry: entity?.industry || '',
    contractVehicles: (entity?.contractVehicles || []).join(', '),
    capabilityDescription: entity?.capabilityDescription || '',
  });
  const [loading, setLoading] = useState(false);
  const [customTag, setCustomTag] = useState('');

  // Auto-detect committee mode when editing: if entity name contains "Committee" or memberName has ranking info
  const isExistingCommittee = entity?.entityType === 'CongressionalOffice' && (
    entity.name.toLowerCase().includes('committee') ||
    (entity.memberName || '').includes(' | Ranking: ')
  );
  const [congressionalMode, setCongressionalMode] = useState<CongressionalMode>(
    isExistingCommittee ? 'committee' : 'personal'
  );

  const set = (key: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm(f => ({ ...f, [key]: e.target.value }));

  const toggleTag = (tag: string) =>
    setForm(f => ({
      ...f,
      tags: f.tags.includes(tag) ? f.tags.filter(t => t !== tag) : [...f.tags, tag],
    }));

  // Auto-generate display name for personal office congressional entries
  const setCongField = (key: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const value = e.target.value;
    setForm(f => {
      const updated = { ...f, [key]: value };
      if (!f.nameManuallyEdited && congressionalMode === 'personal') {
        const first = (key === 'congFirstName' ? value : f.congFirstName).trim();
        const last = (key === 'congLastName' ? value : f.congLastName).trim();
        const chamber = key === 'chamber' ? value : f.chamber;
        const party = key === 'party' ? value : f.party;
        const state = (key === 'state' ? value : f.state).toUpperCase();
        const district = key === 'district' ? value : f.district;

        if (first || last) {
          const prefix = chamber === 'Senate' ? 'Sen.' : 'Rep.';
          const partyInit = getPartyInitial(party);
          let suffix = '';
          if (partyInit && state) {
            if (chamber === 'House' && district) {
              suffix = ` (${partyInit}-${state}-${district})`;
            } else {
              suffix = ` (${partyInit}-${state})`;
            }
          }
          updated.name = `${prefix} ${first} ${last}${suffix}`.trim();
        }
      }
      return updated;
    });
  };

  const autoDisplayName = useMemo(() => {
    if (form.entityType !== 'CongressionalOffice' || congressionalMode !== 'personal') return '';
    const first = form.congFirstName.trim();
    const last = form.congLastName.trim();
    if (!first && !last) return '';
    const prefix = form.chamber === 'Senate' ? 'Sen.' : 'Rep.';
    const partyInit = getPartyInitial(form.party);
    const state = form.state.toUpperCase();
    let suffix = '';
    if (partyInit && state) {
      if (form.chamber === 'House' && form.district) {
        suffix = ` (${partyInit}-${state}-${form.district})`;
      } else {
        suffix = ` (${partyInit}-${state})`;
      }
    }
    return `${prefix} ${first} ${last}${suffix}`.trim();
  }, [form.congFirstName, form.congLastName, form.chamber, form.party, form.state, form.district, form.entityType, congressionalMode]);

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
        data.chamber = form.chamber || null;
        data.party = form.party || null;
        data.state = form.state.toUpperCase() || null;
        data.district = form.district || null;
        data.committee = form.committee ? form.committee.split(',').map((s: string) => s.trim()).filter(Boolean) : [];
        data.subcommittee = form.subcommittee ? form.subcommittee.split(',').map((s: string) => s.trim()).filter(Boolean) : [];
        // For committees, combine chair + ranking into memberName
        if (congressionalMode === 'committee') {
          const chair = form.memberName?.trim() || '';
          const ranking = form.rankingMember?.trim() || '';
          data.memberName = ranking ? `${chair} | Ranking: ${ranking}` : (chair || null);
        } else {
          data.memberName = form.memberName || null;
        }
      } else if (form.entityType === 'GovernmentOrganization') {
        data.parentAgency = form.parentAgency || null;
        data.subComponent = form.subComponent || null;
        data.governmentType = form.governmentType || null;
        data.budgetLineItem = form.budgetLineItem || null;
      } else if (form.entityType === 'Company' || form.entityType === 'Client') {
        data.industry = form.industry || null;
        data.contractVehicles = form.contractVehicles ? form.contractVehicles.split(',').map((s: string) => s.trim()).filter(Boolean) : [];
        data.capabilityDescription = form.capabilityDescription || null;
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
          {/* Type row — half width type, plus congressional sub-type when applicable */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Type *</label>
              <select className="input" value={form.entityType} onChange={set('entityType')}>
                {ENTITY_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            {form.entityType === 'CongressionalOffice' && (
              <div>
                <label className="label">Office Type *</label>
                <select
                  className="input"
                  value={congressionalMode}
                  onChange={e => {
                    setCongressionalMode(e.target.value as CongressionalMode);
                    setForm(f => ({ ...f, name: '', nameManuallyEdited: false }));
                  }}
                >
                  <option value="personal">Personal Office</option>
                  <option value="committee">Committee</option>
                </select>
              </div>
            )}
          </div>

          {/* ── Congressional: Personal Office ── */}
          {form.entityType === 'CongressionalOffice' && congressionalMode === 'personal' && (
            <>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="label">Chamber *</label>
                  <select className="input" value={form.chamber} onChange={setCongField('chamber')}>
                    <option value="Senate">Senate</option>
                    <option value="House">House</option>
                  </select>
                </div>
                <div>
                  <label className="label">First Name *</label>
                  <input className="input" value={form.congFirstName} onChange={setCongField('congFirstName')} placeholder="Tim" required={!entity} />
                </div>
                <div>
                  <label className="label">Last Name *</label>
                  <input className="input" value={form.congLastName} onChange={setCongField('congLastName')} placeholder="Kaine" required={!entity} />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="label">Party</label>
                  <select className="input" value={form.party} onChange={setCongField('party')}>
                    <option value="Republican">Republican</option>
                    <option value="Democrat">Democrat</option>
                    <option value="Independent">Independent</option>
                  </select>
                </div>
                <div>
                  <label className="label">State</label>
                  <select className="input" value={form.state} onChange={setCongField('state')}>
                    <option value="">Select…</option>
                    {US_STATES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                {form.chamber === 'House' && (
                  <div>
                    <label className="label">District</label>
                    <input className="input" value={form.district} onChange={setCongField('district')} placeholder="13" />
                  </div>
                )}
              </div>

              <div>
                <label className="label">Display Name *</label>
                <input
                  className="input"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value, nameManuallyEdited: true }))}
                  placeholder="Sen. Tim Kaine (D-VA)"
                  required
                />
                {autoDisplayName && form.nameManuallyEdited && form.name !== autoDisplayName && (
                  <button
                    type="button"
                    onClick={() => setForm(f => ({ ...f, name: autoDisplayName, nameManuallyEdited: false }))}
                    className="text-xs mt-1"
                    style={{ color: '#c9a84c' }}
                  >
                    Reset to: {autoDisplayName}
                  </button>
                )}
              </div>

              <div>
                <label className="label">Member Full Name (optional)</label>
                <input className="input" value={form.memberName} onChange={set('memberName')} placeholder="e.g. Senator Timothy Kaine" />
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

          {/* ── Congressional: Committee ── */}
          {form.entityType === 'CongressionalOffice' && congressionalMode === 'committee' && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Chamber *</label>
                  <select className="input" value={form.chamber} onChange={set('chamber')}>
                    <option value="Senate">Senate</option>
                    <option value="House">House</option>
                  </select>
                </div>
                <div>
                  <label className="label">Committee Name *</label>
                  <input
                    className="input"
                    value={form.name}
                    onChange={set('name')}
                    placeholder="Armed Services Committee"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Chair</label>
                  <input className="input" value={form.memberName} onChange={set('memberName')} placeholder="Sen. Jack Reed (D-RI)" />
                </div>
                <div>
                  <label className="label">Ranking Member</label>
                  <input className="input" value={form.rankingMember} onChange={set('rankingMember')} placeholder="Sen. Roger Wicker (R-MS)" />
                </div>
              </div>

              <div>
                <label className="label">Telephone</label>
                <input className="input" type="tel" value={form.committeePhone} onChange={set('committeePhone')} placeholder="(202) 224-3871" />
              </div>
            </>
          )}

          {/* ── Non-congressional: single name ── */}
          {form.entityType !== 'CongressionalOffice' && (
            <div>
              <label className="label">Name *</label>
              <input className="input" value={form.name} onChange={set('name')} required />
            </div>
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

          {/* Company / Client fields */}
          {(form.entityType === 'Company' || form.entityType === 'Client') && (
            <>
              <div>
                <label className="label">Industry</label>
                <input className="input" value={form.industry} onChange={set('industry')} placeholder="Defense & Intelligence Contractor" />
              </div>
              <div>
                <label className="label">Contract Vehicles (comma-separated)</label>
                <input className="input" value={form.contractVehicles} onChange={set('contractVehicles')} placeholder="OASIS+, SEWP VI, GSA MAS" />
              </div>
              <div>
                <label className="label">Capability Description</label>
                <textarea
                  className="input"
                  value={form.capabilityDescription}
                  onChange={set('capabilityDescription')}
                  rows={4}
                  style={{ resize: 'vertical' }}
                  placeholder="Describe what this company does, what products or services they offer, and what problems they solve. This is used by the Budget Analyzer to identify relevant funding opportunities."
                />
                <p className="text-xs mt-1" style={{ color: '#8b949e' }}>
                  Used by the Budget Analyzer to identify relevant funding opportunities.
                </p>
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
            {form.tags.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-1 mb-2">
                {form.tags.map(tag => (
                  <button
                    key={tag} type="button" onClick={() => toggleTag(tag)}
                    className="badge cursor-pointer transition-all"
                    style={{ background: 'rgba(201,168,76,0.15)', color: '#c9a84c', border: '1px solid #c9a84c' }}
                  >{tag} ×</button>
                ))}
              </div>
            )}
            <div className="flex gap-2">
              <input
                className="input flex-1"
                value={customTag}
                onChange={e => setCustomTag(e.target.value)}
                placeholder="Type a tag and press Enter…"
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    const tag = customTag.trim();
                    if (tag && !form.tags.includes(tag)) {
                      setForm(f => ({ ...f, tags: [...f.tags, tag] }));
                    }
                    setCustomTag('');
                  }
                }}
              />
              <button
                type="button"
                onClick={() => {
                  const tag = customTag.trim();
                  if (tag && !form.tags.includes(tag)) {
                    setForm(f => ({ ...f, tags: [...f.tags, tag] }));
                  }
                  setCustomTag('');
                }}
                className="btn-secondary text-sm"
              >Add</button>
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
