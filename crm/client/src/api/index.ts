import api from './client';
import type { Contact, Entity, Initiative, Interaction, Reminder, Task, User } from '../types';

// Auth
export const authApi = {
  login: (email: string, password: string) =>
    api.post<{ user: User }>('/auth/login', { email, password }),
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
  toggleActive: (id: string, isActive: boolean) =>
    api.patch(`/api/users/${id}/active`, { isActive }),
};

// Reminders
export const remindersApi = {
  list: (params?: Record<string, string>) => api.get<Reminder[]>('/api/reminders', { params }),
  create: (data: Partial<Reminder> & { remindAt: string }) => api.post<Reminder>('/api/reminders', data),
  update: (id: string, data: Partial<Reminder>) => api.put<Reminder>(`/api/reminders/${id}`, data),
  delete: (id: string) => api.delete(`/api/reminders/${id}`),
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
};

// Gmail
export const gmailApi = {
  getAuthUrl: () => `/auth/gmail`,
  search: (q: string) => api.get('/api/gmail/search', { params: { q } }),
  getThread: (id: string) => api.get(`/api/gmail/thread/${id}`),
};
