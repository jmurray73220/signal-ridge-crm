export type UserRole = 'Admin' | 'Editor' | 'Viewer';
export type WorkflowRole = 'WorkflowAdmin' | 'WorkflowEditor' | 'WorkflowViewer';
export type EntityType = 'CongressionalOffice' | 'GovernmentOrganization' | 'Company' | 'Client' | 'Other';
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
  role: UserRole | null;
  workflowRole?: WorkflowRole | null;
  workflowClientId?: string | null;
  workflowClient?: { id: string; name: string } | null;
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
  capabilityDescription?: string;
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
  attachments?: { id: string; filename: string; mimeType: string; source: string | null; uploadedAt: string; uploadedByUserId: string | null }[];
  _count?: { attachments?: number };
  createdAt: string;
  updatedAt: string;
  createdBy?: { firstName: string; lastName: string };
  updatedBy?: { firstName: string; lastName: string };
}

export interface Reminder {
  id: string;
  title: string;
  notes?: string;
  remindAt: string;
  completed: boolean;
  completedAt?: string;
  contactId?: string;
  contact?: { id: string; firstName: string; lastName: string };
  entityId?: string;
  entity?: Entity;
  initiativeId?: string;
  initiative?: { id: string; title: string };
  interactionId?: string;
  interaction?: { id: string; subject: string; type: string; date: string };
  createdAt: string;
  updatedAt: string;
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

// Budget Intelligence
export interface BudgetDocument {
  id: string;
  name: string;
  documentType: string;
  fiscalYear: string;
  serviceBranch: string;
  createdAt: string;
}

export interface BudgetConversation {
  id: string;
  budgetDocumentId: string;
  messages: ChatMessage[];
  createdAt: string;
  links?: BudgetLink[];
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface BudgetLink {
  id: string;
  budgetConversationId: string;
  entityType: string;
  entityId: string;
  note?: string;
  createdAt: string;
}

export interface ReportTemplate {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
}
