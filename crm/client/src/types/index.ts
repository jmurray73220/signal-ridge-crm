export type UserRole = 'Admin' | 'Editor' | 'Viewer';
export type EntityType = 'CongressionalOffice' | 'GovernmentOrganization' | 'Company' | 'NGO' | 'Other';
export type Chamber = 'Senate' | 'House';
export type Party = 'Republican' | 'Democrat' | 'Independent';
export type GovernmentType = 'DoD' | 'Intel' | 'DHS' | 'State' | 'Other';
export type InitiativeStatus = 'Active' | 'Pipeline' | 'OnHold' | 'Closed';
export type InitiativePriority = 'High' | 'Medium' | 'Low';
export type InteractionType = 'Meeting' | 'Call' | 'Email' | 'Hearing' | 'Briefing' | 'Event' | 'Other';

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  mustChangePassword: boolean;
  lastLogin?: string;
  isActive?: boolean;
  createdAt?: string;
}

export interface Entity {
  id: string;
  name: string;
  entityType: EntityType;
  website?: string;
  description?: string;
  address?: string;
  tags: string[];
  // Congressional
  memberName?: string;
  chamber?: Chamber;
  state?: string;
  district?: string;
  committee?: string[];
  party?: Party;
  subcommittee?: string[];
  // Government Org
  parentAgency?: string;
  subComponent?: string;
  governmentType?: GovernmentType;
  budgetLineItem?: string;
  // Company
  industry?: string;
  contractVehicles?: string[];
  createdAt: string;
  updatedAt: string;
  createdBy?: { firstName: string; lastName: string };
  updatedBy?: { firstName: string; lastName: string };
  _count?: { contacts: number; initiatives: number; interactions: number };
  lastInteraction?: string | null;
}

export interface Contact {
  id: string;
  firstName: string;
  lastName: string;
  rank?: string;
  title?: string;
  email?: string;
  officePhone?: string;
  cell?: string;
  linkedIn?: string;
  bio?: string;
  tags: string[];
  entityId?: string;
  entity?: Entity;
  createdAt: string;
  updatedAt: string;
  createdBy?: { firstName: string; lastName: string };
  updatedBy?: { firstName: string; lastName: string };
  lastInteraction?: string | null;
}

export interface Initiative {
  id: string;
  title: string;
  description?: string;
  status: InitiativeStatus;
  priority: InitiativePriority;
  startDate?: string;
  targetDate?: string;
  primaryEntityId?: string;
  primaryEntity?: Entity;
  createdAt: string;
  updatedAt: string;
  createdBy?: { firstName: string; lastName: string };
  updatedBy?: { firstName: string; lastName: string };
  _count?: { contacts: number };
}

export interface InitiativeContact {
  initiativeId: string;
  contactId: string;
  role?: string;
  contact: Contact;
  initiative?: Initiative;
}

export interface InitiativeEntity {
  initiativeId: string;
  entityId: string;
  relationshipNote?: string;
  entity: Entity;
}

export interface Interaction {
  id: string;
  type: InteractionType;
  date: string;
  subject: string;
  notes?: string;
  gmailThreadUrl?: string;
  entityId?: string;
  entity?: Entity;
  initiativeId?: string;
  initiative?: { id: string; title: string };
  contacts: { contactId: string; contact: { id: string; firstName: string; lastName: string } }[];
  createdAt: string;
  updatedAt: string;
  createdBy?: { firstName: string; lastName: string };
  updatedBy?: { firstName: string; lastName: string };
}

export interface Task {
  id: string;
  title: string;
  dueDate?: string;
  completed: boolean;
  contactId?: string;
  contact?: { id: string; firstName: string; lastName: string };
  entityId?: string;
  entity?: Entity;
  initiativeId?: string;
  initiative?: { id: string; title: string };
  createdAt: string;
  updatedAt: string;
}
