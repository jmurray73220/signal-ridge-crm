import { useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Users, Plus, X, GripVertical } from 'lucide-react';
import { settingsApi, initiativesApi } from '../api';
import toast from 'react-hot-toast';

const CONTACT_ROLES = ['Champion', 'Gatekeeper', 'End User', 'Sponsor', 'Staffer Lead', 'Technical POC'];

interface ContactEntry {
  contactId: string;
  role?: string;
  sortOrder?: number;
  contact: {
    id: string;
    firstName: string;
    lastName: string;
    title?: string;
    rank?: string;
    tags?: string;
    entity?: {
      id: string;
      name: string;
      entityType: string;
      chamber?: string;
      committee?: string;
      party?: string;
      subcommittee?: string;
      governmentType?: string;
    };
  };
}

interface Props {
  contacts: ContactEntry[];
  initiativeId: string;
  canEdit: boolean;
  canDelete: boolean;
  onShowAddContact: () => void;
  showAddContact: boolean;
  contactSearch: string;
  onContactSearchChange: (s: string) => void;
  filteredContactSearch: any[];
  addContactId: string;
  onAddContactIdChange: (id: string) => void;
  addContactRole: string;
  onAddContactRoleChange: (r: string) => void;
  onAddContact: () => void;
  addContactPending: boolean;
  onCancelAdd: () => void;
  onRemoveContact: (contactId: string) => void;
}

interface GroupedContact extends ContactEntry {
  contactParty: string;
  isCommitteeStaffer: boolean;
  isPSM: boolean;
}

function getContactParty(ic: ContactEntry): string {
  const ent = ic.contact.entity;
  if (!ent) return '';
  const isCommittee = ent.entityType === 'CongressionalOffice' && /committee/i.test(ent.name || '');
  if (isCommittee) {
    let tags: string[] = [];
    try { tags = JSON.parse(ic.contact.tags || '[]'); } catch { tags = []; }
    if (tags.some(t => /democrat/i.test(t))) return 'Democrat';
    if (tags.some(t => /republican/i.test(t))) return 'Republican';
    return '';
  }
  return ent.party || '';
}

function isCommittee(ic: ContactEntry): boolean {
  const ent = ic.contact.entity;
  return !!ent && ent.entityType === 'CongressionalOffice' && /committee/i.test(ent.name || '');
}

function getChamber(ic: ContactEntry): string {
  return ic.contact.entity?.chamber || '';
}

function ContactCard({
  ic,
  canEdit,
  onRemove,
  onDragStart,
  onDragOver,
  onDrop,
  dragging,
}: {
  ic: GroupedContact;
  canEdit: boolean;
  onRemove: () => void;
  onDragStart: () => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: () => void;
  dragging: boolean;
}) {
  const ent = ic.contact.entity;

  let officeName = '';
  if (ic.isCommitteeStaffer) {
    const parts = [ent?.name, ic.contact.rank].filter(Boolean);
    officeName = parts.join(', ');
  } else if (ent) {
    officeName = ent.name;
  }

  return (
    <div
      className="flex items-center gap-2 py-2 px-3 rounded-lg transition-all"
      style={{
        background: dragging ? 'rgba(201,168,76,0.1)' : 'transparent',
        borderBottom: '1px solid #30363d',
        opacity: dragging ? 0.5 : 1,
      }}
      draggable={canEdit}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      {canEdit && (
        <span className="cursor-grab flex-shrink-0" style={{ color: '#30363d' }}>
          <GripVertical size={14} />
        </span>
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <Link
            to={`/contacts/${ic.contactId}`}
            className="text-sm font-medium hover:opacity-80"
            style={{ color: '#e6edf3', textDecoration: 'none' }}
          >
            {ic.contact.firstName} {ic.contact.lastName}
          </Link>
          {ic.isPSM && (
            <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: 'rgba(52,211,153,0.15)', color: '#34d399', fontSize: 10 }}>
              PSM
            </span>
          )}
          {ic.role && (
            <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: 'rgba(201,168,76,0.1)', color: '#c9a84c' }}>
              {ic.role}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
          {ic.contact.title && (
            <span className="text-xs" style={{ color: '#8b949e' }}>{ic.contact.title}</span>
          )}
          {ent && (
            <>
              {ic.contact.title && <span className="text-xs" style={{ color: '#30363d' }}>·</span>}
              <Link to={`/entities/${ent.id}`} className="text-xs hover:opacity-80" style={{ color: '#8b949e', textDecoration: 'none' }}>
                {officeName}
              </Link>
            </>
          )}
        </div>
      </div>
      {canEdit && (
        <button onClick={onRemove} className="flex-shrink-0 hover:opacity-80" style={{ color: '#da3633' }}>
          <X size={14} />
        </button>
      )}
    </div>
  );
}

export function InitiativeContactsTab(props: Props) {
  const {
    contacts, initiativeId, canEdit,
    onShowAddContact, showAddContact, contactSearch, onContactSearchChange,
    filteredContactSearch, addContactId, onAddContactIdChange,
    addContactRole, onAddContactRoleChange, onAddContact, addContactPending, onCancelAdd,
    onRemoveContact,
  } = props;

  const qc = useQueryClient();
  const [dragIdx, setDragIdx] = useState<number | null>(null);

  const { data: settings } = useQuery({
    queryKey: ['crm-settings'],
    queryFn: () => settingsApi.get().then(r => r.data),
  });

  const majorityParty = settings?.majorityParty || 'Republican';

  // Enrich contacts with party/committee info
  const enriched: GroupedContact[] = contacts.map(ic => ({
    ...ic,
    contactParty: getContactParty(ic),
    isCommitteeStaffer: isCommittee(ic),
    isPSM: isCommittee(ic), // Committee staffers are PSMs
  }));

  // Group contacts
  const isCongContact = (ic: GroupedContact) =>
    ic.contact.entity?.entityType === 'CongressionalOffice';

  const senateContacts = enriched.filter(ic => isCongContact(ic) && getChamber(ic) === 'Senate');
  const houseContacts = enriched.filter(ic => isCongContact(ic) && getChamber(ic) === 'House');
  const otherContacts = enriched.filter(ic => !isCongContact(ic));

  const splitByMajority = (list: GroupedContact[]) => {
    const majority = list.filter(ic => ic.contactParty === majorityParty);
    const minority = list.filter(ic => ic.contactParty && ic.contactParty !== majorityParty);
    const unknown = list.filter(ic => !ic.contactParty);
    return { majority, minority, unknown };
  };

  const sortGroup = (list: GroupedContact[]) => {
    // PSMs first, then personal office, sorted by sortOrder
    return [...list].sort((a, b) => {
      if (a.isPSM !== b.isPSM) return a.isPSM ? -1 : 1;
      return (a.sortOrder || 0) - (b.sortOrder || 0);
    });
  };

  const senate = splitByMajority(senateContacts);
  const house = splitByMajority(houseContacts);

  // Handle drag-and-drop reorder within a group
  const handleDrop = useCallback(async (groupContacts: GroupedContact[], fromIdx: number, toIdx: number) => {
    if (fromIdx === toIdx) return;
    const reordered = [...groupContacts];
    const [moved] = reordered.splice(fromIdx, 1);
    reordered.splice(toIdx, 0, moved);

    const order = reordered.map((ic, idx) => ({
      contactId: ic.contactId,
      sortOrder: idx,
    }));

    try {
      await initiativesApi.reorderContacts(initiativeId, order);
      qc.invalidateQueries({ queryKey: ['initiative', initiativeId] });
    } catch {
      toast.error('Failed to reorder');
    }
  }, [initiativeId, qc]);

  const renderGroup = (
    groupContacts: GroupedContact[],
    label: string,
    groupKey: string,
  ) => {
    if (groupContacts.length === 0) return null;
    const sorted = sortGroup(groupContacts);
    const psmContacts = sorted.filter(c => c.isPSM);
    const personalContacts = sorted.filter(c => !c.isPSM);

    const renderSubgroup = (subContacts: GroupedContact[], subLabel: string) => {
      if (subContacts.length === 0) return null;
      return (
        <div key={subLabel} className="mb-2">
          <div className="text-xs font-medium px-3 py-1" style={{ color: '#8b949e' }}>
            {subLabel} ({subContacts.length})
          </div>
          {subContacts.map((ic, idx) => (
            <ContactCard
              key={ic.contactId}
              ic={ic}
              canEdit={canEdit}
              onRemove={() => onRemoveContact(ic.contactId)}
              onDragStart={() => setDragIdx(idx)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => {
                if (dragIdx !== null && dragIdx !== idx) {
                  handleDrop(subContacts, dragIdx, idx);
                }
                setDragIdx(null);
              }}
              dragging={dragIdx === idx}
            />
          ))}
        </div>
      );
    };

    return (
      <div key={groupKey} className="mb-1">
        <div
          className="text-xs font-semibold uppercase tracking-widest px-3 py-1.5"
          style={{ color: label.includes('Majority') ? '#34d399' : label.includes('Minority') ? '#c9a84c' : '#8b949e' }}
        >
          {label}
        </div>
        <div className="card p-0 px-1">
          {psmContacts.length > 0 && personalContacts.length > 0 ? (
            <>
              {renderSubgroup(psmContacts, 'Committee Staff (PSMs)')}
              {renderSubgroup(personalContacts, 'Personal Office')}
            </>
          ) : (
            // If all are same type, don't sub-group
            sorted.map((ic, idx) => (
              <ContactCard
                key={ic.contactId}
                ic={ic}
                canEdit={canEdit}
                onRemove={() => onRemoveContact(ic.contactId)}
                onDragStart={() => setDragIdx(idx)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => {
                  if (dragIdx !== null && dragIdx !== idx) {
                    handleDrop(sorted, dragIdx, idx);
                  }
                  setDragIdx(null);
                }}
                dragging={dragIdx === idx}
              />
            ))
          )}
        </div>
      </div>
    );
  };

  const majorityLabel = majorityParty === 'Republican' ? 'Majority (R)' : 'Majority (D)';
  const minorityLabel = majorityParty === 'Republican' ? 'Minority (D)' : 'Minority (R)';

  return (
    <div>
      {canEdit && (
        <div className="flex justify-end mb-3">
          <button onClick={onShowAddContact} className="btn-secondary flex items-center gap-1.5 text-sm">
            <Plus size={14} /> Add Contact
          </button>
        </div>
      )}

      {showAddContact && (
        <div className="card mb-4">
          <h3 className="text-sm font-medium mb-3" style={{ color: '#e6edf3' }}>Add Contact to Initiative</h3>
          <input
            className="input mb-2"
            placeholder="Search contacts…"
            value={contactSearch}
            onChange={e => onContactSearchChange(e.target.value)}
          />
          <div className="max-h-40 overflow-y-auto rounded border mb-3" style={{ borderColor: '#30363d' }}>
            {filteredContactSearch.map((c: any) => (
              <button
                key={c.id}
                onClick={() => onAddContactIdChange(c.id)}
                className="w-full text-left px-3 py-2 hover:bg-bg transition-colors flex items-center gap-2"
                style={{ background: addContactId === c.id ? 'rgba(201,168,76,0.1)' : 'transparent' }}
              >
                <span className="text-sm" style={{ color: '#e6edf3' }}>
                  {c.rank && `${c.rank} `}{c.firstName} {c.lastName}
                </span>
                {c.title && <span className="text-xs" style={{ color: '#8b949e' }}>{c.title}</span>}
              </button>
            ))}
          </div>
          <div className="flex gap-3">
            <select className="input flex-1" value={addContactRole} onChange={e => onAddContactRoleChange(e.target.value)}>
              <option value="">— No role —</option>
              {CONTACT_ROLES.map(r => <option key={r}>{r}</option>)}
            </select>
            <button
              onClick={onAddContact}
              disabled={!addContactId || addContactPending}
              className="btn-primary"
            >
              Add
            </button>
            <button onClick={onCancelAdd} className="btn-secondary">Cancel</button>
          </div>
        </div>
      )}

      {contacts.length === 0 ? (
        <div className="card text-center py-10">
          <Users size={32} className="mx-auto mb-3" style={{ color: '#30363d' }} />
          <p className="text-sm" style={{ color: '#8b949e' }}>No contacts associated with this initiative.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Senate */}
          {(senateContacts.length > 0) && (
            <div>
              <h3 className="text-sm font-semibold mb-2 flex items-center gap-2" style={{ color: '#e6edf3' }}>
                <span className="w-2 h-2 rounded-full" style={{ background: '#60a5fa' }} />
                Senate
                <span className="text-xs font-normal" style={{ color: '#8b949e' }}>({senateContacts.length})</span>
              </h3>
              {renderGroup(senate.majority, majorityLabel, 'senate-majority')}
              {renderGroup(senate.minority, minorityLabel, 'senate-minority')}
              {renderGroup(senate.unknown, 'Party Unknown', 'senate-unknown')}
            </div>
          )}

          {/* House */}
          {(houseContacts.length > 0) && (
            <div>
              <h3 className="text-sm font-semibold mb-2 flex items-center gap-2" style={{ color: '#e6edf3' }}>
                <span className="w-2 h-2 rounded-full" style={{ background: '#f87171' }} />
                House
                <span className="text-xs font-normal" style={{ color: '#8b949e' }}>({houseContacts.length})</span>
              </h3>
              {renderGroup(house.majority, majorityLabel, 'house-majority')}
              {renderGroup(house.minority, minorityLabel, 'house-minority')}
              {renderGroup(house.unknown, 'Party Unknown', 'house-unknown')}
            </div>
          )}

          {/* Other contacts (non-congressional) */}
          {otherContacts.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold mb-2" style={{ color: '#e6edf3' }}>
                Other Contacts
                <span className="text-xs font-normal ml-2" style={{ color: '#8b949e' }}>({otherContacts.length})</span>
              </h3>
              <div className="card p-0 px-1">
                {otherContacts.map((ic, idx) => (
                  <ContactCard
                    key={ic.contactId}
                    ic={ic}
                    canEdit={canEdit}
                    onRemove={() => onRemoveContact(ic.contactId)}
                    onDragStart={() => setDragIdx(idx)}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={() => {
                      if (dragIdx !== null && dragIdx !== idx) {
                        handleDrop(otherContacts, dragIdx, idx);
                      }
                      setDragIdx(null);
                    }}
                    dragging={dragIdx === idx}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
