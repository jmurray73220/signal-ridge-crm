import axios from 'axios';

export const api = axios.create({
  baseURL: '/',
  withCredentials: true,
});

export async function login(email: string, password: string) {
  const { data } = await api.post('/auth/login', { email, password });
  return data.user;
}

export async function logout() {
  await api.post('/auth/logout');
}

export async function fetchMe() {
  const { data } = await api.get('/auth/me');
  return data;
}

// Clients
export async function listClients() {
  const { data } = await api.get('/api/workflow/clients');
  return data;
}
export async function createClient(name: string, clientId?: string) {
  const { data } = await api.post('/api/workflow/clients', { name, clientId });
  return data;
}

// Tracks
export async function listTracks(workflowClientId: string) {
  const { data } = await api.get('/api/workflow/tracks', { params: { workflowClientId } });
  return data;
}
export async function createTrack(body: {
  workflowClientId: string;
  title: string;
  description?: string;
  fundingVehicle?: string;
  sortOrder?: number;
}) {
  const { data } = await api.post('/api/workflow/tracks', body);
  return data;
}
export async function updateTrack(id: string, body: Record<string, unknown>) {
  const { data } = await api.put(`/api/workflow/tracks/${id}`, body);
  return data;
}
export async function deleteTrack(id: string) {
  await api.delete(`/api/workflow/tracks/${id}`);
}

// Phases
export async function createPhase(body: Record<string, unknown>) {
  const { data } = await api.post('/api/workflow/phases', body);
  return data;
}
export async function updatePhase(id: string, body: Record<string, unknown>) {
  const { data } = await api.put(`/api/workflow/phases/${id}`, body);
  return data;
}

// Milestones
export async function createMilestone(body: Record<string, unknown>) {
  const { data } = await api.post('/api/workflow/milestones', body);
  return data;
}
export async function updateMilestone(id: string, body: Record<string, unknown>) {
  const { data } = await api.put(`/api/workflow/milestones/${id}`, body);
  return data;
}

// Action items
export async function getActionItem(id: string) {
  const { data } = await api.get(`/api/workflow/action-items/${id}`);
  return data;
}
export async function createActionItem(body: Record<string, unknown>) {
  const { data } = await api.post('/api/workflow/action-items', body);
  return data;
}
export async function updateActionItem(id: string, body: Record<string, unknown>) {
  const { data } = await api.put(`/api/workflow/action-items/${id}`, body);
  return data;
}

// SOWs
export async function listSOWs(workflowClientId: string) {
  const { data } = await api.get('/api/workflow/sows', { params: { workflowClientId } });
  return data;
}
export async function getSOW(id: string) {
  const { data } = await api.get(`/api/workflow/sows/${id}`);
  return data;
}
export async function createSOW(body: Record<string, unknown>) {
  const { data } = await api.post('/api/workflow/sows', body);
  return data;
}
export async function updateSOW(id: string, body: Record<string, unknown>) {
  const { data } = await api.put(`/api/workflow/sows/${id}`, body);
  return data;
}
export async function suggestTrackForSOW(id: string): Promise<{
  suggestedTrackId: string;
  trackTitle: string;
  rationale: string;
}> {
  const { data } = await api.post(`/api/workflow/sow/${id}/suggest-track`);
  return data;
}

// Comments
export async function createComment(body: { actionItemId?: string; sowId?: string; content: string }) {
  const { data } = await api.post('/api/workflow/comments', body);
  return data;
}

// Users
export async function listWorkflowUsers() {
  const { data } = await api.get('/api/workflow/users');
  return data;
}
export async function setUserWorkflowRole(
  id: string,
  body: { workflowRole?: string | null; workflowClientId?: string | null }
) {
  const { data } = await api.patch(`/api/workflow/users/${id}/workflow-role`, body);
  return data;
}
