import api from './client';
import type { Contact, Entity, Initiative, Interaction, Reminder, Task, User, BudgetDocument, BudgetConversation, ReportTemplate, BudgetLink } from '../types';

// Auth
export const authApi = {
  login: (email: string, password: string, rememberMe = false) =>
    api.post<{ user: User }>('/auth/login', { email, password, rememberMe }),
  logout: () => api.post('/auth/logout'),
  me: () => api.get<User>('/auth/me'),
  changePassword: (currentPassword: string, newPassword: string) =>
    api.post('/auth/change-password', { currentPassword, newPassword }),
  forceChangePassword: (newPassword: string) =>
    api.post('/auth/force-change-password', { newPassword }),
  register: (data: { email: string; firstName: string; lastName: string; password: string }) =>
    api.post('/auth/register', data),
  forgotPassword: (email: string) =>
    api.post<{ message: string; resetUrl?: string }>('/auth/forgot-password', { email }),
  resetPassword: (token: string, newPassword: string) =>
    api.post('/auth/reset-password', { token, newPassword }),
};

// Contacts
export const contactsApi = {
  list: (params?: Record<string, string>) =>
    api.get<Contact[]>('/api/contacts', { params }),
  get: (id: string) => api.get<Contact>(`/api/contacts/${id}`),
  create: (data: Partial<Contact>) => api.post<Contact>('/api/contacts', data),
  update: (id: string, data: Partial<Contact>) => api.put<Contact>(`/api/contacts/${id}`, data),
  delete: (id: string) => api.delete(`/api/contacts/${id}`),
  import: (contacts: any[]) => api.post<{ created: number; skipped: number; errors: string[] }>('/api/contacts/import', { contacts }),
  getInteractions: (id: string) => api.get<Interaction[]>(`/api/contacts/${id}/interactions`),
  getInitiatives: (id: string) => api.get<any[]>(`/api/contacts/${id}/initiatives`),
  getTasks: (id: string) => api.get<Task[]>(`/api/contacts/${id}/tasks`),
};

// Entities
export const entitiesApi = {
  list: (params?: Record<string, string>) =>
    api.get<Entity[]>('/api/entities', { params }),
  get: (id: string) => api.get<Entity>(`/api/entities/${id}`),
  create: (data: Partial<Entity>) => api.post<Entity>('/api/entities', data),
  update: (id: string, data: Partial<Entity>) => api.put<Entity>(`/api/entities/${id}`, data),
  delete: (id: string) => api.delete(`/api/entities/${id}`),
  getContacts: (id: string) => api.get<Contact[]>(`/api/entities/${id}/contacts`),
  getInitiatives: (id: string) => api.get<Initiative[]>(`/api/entities/${id}/initiatives`),
  getInteractions: (id: string) => api.get<Interaction[]>(`/api/entities/${id}/interactions`),
};

// Initiatives
export const initiativesApi = {
  list: (params?: Record<string, string>) =>
    api.get<Initiative[]>('/api/initiatives', { params }),
  get: (id: string) => api.get<any>(`/api/initiatives/${id}`),
  create: (data: Partial<Initiative>) => api.post<Initiative>('/api/initiatives', data),
  update: (id: string, data: Partial<Initiative>) =>
    api.put<Initiative>(`/api/initiatives/${id}`, data),
  delete: (id: string) => api.delete(`/api/initiatives/${id}`),
  addContact: (id: string, contactId: string, role?: string) =>
    api.post(`/api/initiatives/${id}/contacts`, { contactId, role }),
  removeContact: (id: string, contactId: string) =>
    api.delete(`/api/initiatives/${id}/contacts/${contactId}`),
  reorderContacts: (id: string, order: { contactId: string; sortOrder: number }[]) =>
    api.put(`/api/initiatives/${id}/contacts/reorder`, { order }),
  addEntity: (id: string, entityId: string, relationshipNote?: string) =>
    api.post(`/api/initiatives/${id}/entities`, { entityId, relationshipNote }),
  removeEntity: (id: string, entityId: string) =>
    api.delete(`/api/initiatives/${id}/entities/${entityId}`),
};

// Interactions
export const interactionsApi = {
  list: (params?: Record<string, string>) =>
    api.get<Interaction[]>('/api/interactions', { params }),
  get: (id: string) => api.get<Interaction>(`/api/interactions/${id}`),
  create: (data: any) => api.post<Interaction>('/api/interactions', data),
  update: (id: string, data: any) => api.put<Interaction>(`/api/interactions/${id}`, data),
  delete: (id: string) => api.delete(`/api/interactions/${id}`),
};

// Tasks
export const tasksApi = {
  list: (params?: Record<string, string>) => api.get<Task[]>('/api/tasks', { params }),
  create: (data: Partial<Task> & { contactIds?: string[] }) =>
    api.post<Task>('/api/tasks', data),
  update: (id: string, data: Partial<Task>) => api.put<Task>(`/api/tasks/${id}`, data),
  delete: (id: string) => api.delete(`/api/tasks/${id}`),
};

// Search
export const searchApi = {
  global: (q: string) =>
    api.get<{ contacts: Contact[]; entities: Entity[]; initiatives: Initiative[] }>(
      '/api/search',
      { params: { q } }
    ),
};

// Users (admin only)
export const usersApi = {
  list: () => api.get<User[]>('/api/users'),
  create: (data: any) => api.post<User>('/api/users', data),
  updateRole: (id: string, role: string) => api.patch(`/api/users/${id}/role`, { role }),
  updateWorkflowRole: (id: string, body: { workflowRole: string | null; workflowClientId: string | null }) =>
    api.patch(`/api/users/${id}/workflow-role`, body),
  toggleActive: (id: string, isActive: boolean) =>
    api.patch(`/api/users/${id}/active`, { isActive }),
  workflowClients: () =>
    api.get<Array<{ id: string; name: string }>>('/api/users/workflow-clients'),
};

// Reminders
export const remindersApi = {
  list: (params?: Record<string, string>) => api.get<Reminder[]>('/api/reminders', { params }),
  create: (data: Partial<Reminder> & { remindAt: string }) => api.post<Reminder>('/api/reminders', data),
  update: (id: string, data: Partial<Reminder>) => api.put<Reminder>(`/api/reminders/${id}`, data),
  delete: (id: string) => api.delete(`/api/reminders/${id}`),
};

// Recycle bin + change log (admin only)
export interface RecycleBinItem {
  id: string;
  title: string;
  deletedAt: string;
  deletedByUserId: string | null;
  purgeAt: string;
}
export interface RecycleBinResponse {
  retentionDays: number;
  items: Record<string, RecycleBinItem[]>;
}
export interface ChangeLogEntry {
  id: string;
  entityType: string;
  entityId: string;
  userId: string | null;
  user: { id: string; firstName: string; lastName: string; email: string } | null;
  action: 'create' | 'update' | 'delete' | 'restore' | 'purge';
  diff: { fields?: Record<string, { before: unknown; after: unknown }>; snapshot?: unknown; after?: unknown };
  createdAt: string;
}
export const recycleBinApi = {
  list: () => api.get<RecycleBinResponse>('/api/recycle-bin'),
  restore: (entityType: string, id: string) =>
    api.post(`/api/recycle-bin/${entityType}/${id}/restore`),
  purge: (entityType: string, id: string) =>
    api.delete(`/api/recycle-bin/${entityType}/${id}`),
  purgeOld: () => api.post<{ purged: number; olderThanDays: number }>('/api/recycle-bin/purge-old'),
};
export const changelogApi = {
  list: (entityType: string, entityId: string) =>
    api.get<ChangeLogEntry[]>('/api/changelog', { params: { entityType, entityId } }),
};

// Export
export const exportApi = {
  contacts: () =>
    api.get('/api/export/contacts', { responseType: 'blob' }),
  entities: (type?: string) =>
    api.get('/api/export/entities', { params: type ? { type } : {}, responseType: 'blob' }),
  interactions: () =>
    api.get('/api/export/interactions', { responseType: 'blob' }),
};

// Briefing
export const briefingApi = {
  entity: (id: string) => api.get<{ briefing: string }>(`/api/briefing/entity/${id}`),
  contact: (id: string) => api.get<{ briefing: string }>(`/api/briefing/contact/${id}`),
  exportDocx: (briefingMarkdown: string, filename?: string) =>
    api.post('/api/briefing/export-docx', { briefingMarkdown, filename }, { responseType: 'blob', timeout: 30000 }),
  clientMeeting: (data: {
    clientId: string;
    officeId: string;
    meetingDate: string;
    meetingTime?: string;
    meetingLocation?: string;
    stafferContactId?: string;
    primaryAsk?: string;
    rationale?: string;
    talkingPointsPrompt?: string;
    additionalContext?: string;
  }) => api.post<{ briefing: string }>('/api/briefing/client-meeting', data, { timeout: 120000 }),
};

// CRM Settings
export const settingsApi = {
  get: () => api.get<{ majorityParty: string; hasLogo: boolean }>('/api/settings'),
  update: (data: { majorityParty?: string }) => api.put('/api/settings', data),
  uploadLogo: (formData: FormData) => api.post('/api/settings/logo', formData),
  deleteLogo: () => api.delete('/api/settings/logo'),
  logoUrl: '/api/settings/logo',
};

// Budget Intelligence
export const budgetApi = {
  list: () => api.get<BudgetDocument[]>('/api/budgets'),
  upload: (formData: FormData) =>
    api.post<BudgetDocument>('/api/budgets/upload', formData),
  delete: (id: string) => api.delete(`/api/budgets/${id}`),
  chat: (id: string, message: string, conversationHistory: any[], companyId?: string) =>
    api.post<{ response: string }>(`/api/budgets/${id}/chat`, { message, conversationHistory, companyId }),
  generateReport: (data: { documentId?: string; documentIds?: string[]; companyId: string; reportTemplateId?: string }) =>
    api.post('/api/budgets/report', data, { responseType: 'blob', timeout: 120000 }),
  // Conversations
  getConversations: (documentId?: string) =>
    api.get<BudgetConversation[]>('/api/budgets/conversations', { params: documentId ? { documentId } : {} }),
  createConversation: (data: { budgetDocumentId: string; messages?: any[] }) =>
    api.post<BudgetConversation>('/api/budgets/conversations', data),
  updateConversation: (id: string, messages: any[]) =>
    api.put<BudgetConversation>(`/api/budgets/conversations/${id}`, { messages }),
  // Links
  createLink: (data: { conversationId: string; entityType: string; entityId: string; note?: string }) =>
    api.post<BudgetLink>('/api/budgets/links', data),
};

// Report Templates
export const reportTemplateApi = {
  list: () => api.get<ReportTemplate[]>('/api/report-templates'),
  upload: (formData: FormData) =>
    api.post<ReportTemplate>('/api/report-templates/upload', formData),
  delete: (id: string) => api.delete(`/api/report-templates/${id}`),
};

// Gmail
export const gmailApi = {
  getAuthUrl: () => `/auth/gmail`,
  search: (q: string) => api.get('/api/gmail/search', { params: { q } }),
  getThread: (id: string) => api.get(`/api/gmail/thread/${id}`),
  // Sync
  status: () => api.get<{ connected: boolean; enabled: boolean; syncIntervalMinutes: number; lastSyncAt: string | null; pendingCount: number }>('/api/gmail/status'),
  getSettings: () => api.get<{ enabled: boolean; syncIntervalMinutes: number; lastSyncAt: string | null }>('/api/gmail/settings'),
  updateSettings: (data: { enabled: boolean; syncIntervalMinutes: number }) => api.put('/api/gmail/settings', data),
  triggerSync: () => api.post<{ message: string; added: number }>('/api/gmail/sync'),
  pending: (status = 'pending') => api.get<any[]>('/api/gmail/pending', { params: { status } }),
  approve: (id: string) => api.post(`/api/gmail/pending/${id}/approve`),
  dismiss: (id: string) => api.post(`/api/gmail/pending/${id}/dismiss`),
  updatePendingContacts: (id: string, contactIds: string[]) => api.patch(`/api/gmail/pending/${id}/contacts`, { contactIds }),
  rematchContacts: () => api.post<{ message: string; updated: number }>('/api/gmail/rematch-contacts'),
  resummarize: () => api.post<{ message: string; updated: number; failed: number }>('/api/gmail/resummarize'),
  resummarizePending: () => api.post<{ message: string; updated: number; failed: number }>('/api/gmail/resummarize-pending'),
  disconnect: () => api.delete('/api/gmail/disconnect'),
};
