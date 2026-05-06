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
export async function listCrmClientEntities(): Promise<Array<{ id: string; name: string }>> {
  const { data } = await api.get('/api/workflow/clients/crm-entities');
  return data;
}
export async function createClient(name: string, clientId?: string) {
  const { data } = await api.post('/api/workflow/clients', { name, clientId });
  return data;
}
export interface BackfillResult {
  created: number;
  alreadyExisted: number;
  items: Array<{ id: string; name: string; clientId: string | null }>;
}
export async function backfillClientsFromCrm(): Promise<BackfillResult> {
  const { data } = await api.post('/api/workflow/clients/backfill-from-crm');
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
  isContractOpportunity?: boolean;
  opportunityUrl?: string;
  extractedFields?: Record<string, unknown>;
}) {
  const { data } = await api.post('/api/workflow/tracks', body);
  return data;
}

// Synchronous "fetch + extract" used by the create flow. Returns the
// structured fields without creating a track. Caller passes the fields back
// to createTrack to persist.
export async function extractPreview(body: { url?: string; text?: string }): Promise<{
  ok: boolean;
  reason?: string;
  status?: number;
  sourceUrl?: string;
  fields?: Record<string, any>;
}> {
  const { data } = await api.post('/api/workflow/tracks/extract-preview', body);
  return data;
}

export async function retryExtractTrack(trackId: string) {
  const { data } = await api.post(`/api/workflow/tracks/${trackId}/extract-from-url`);
  return data;
}

export async function bubbaChat(messages: { role: 'user' | 'assistant'; content: string }[]) {
  const { data } = await api.post<{ reply: string }>('/api/bubba/chat', { messages });
  return data;
}

export async function extractTrackFromText(trackId: string, text: string) {
  const { data } = await api.post(`/api/workflow/tracks/${trackId}/extract-from-text`, { text });
  return data;
}

export async function probeOpportunityUrl(url: string): Promise<{ ok: boolean; reason?: string; status?: number }> {
  const { data } = await api.post('/api/workflow/tracks/probe-url', { url });
  return data;
}

export async function uploadPhaseAttachment(phaseId: string, file: File) {
  const fd = new FormData();
  fd.append('file', file);
  const { data } = await api.post(`/api/workflow/phases/${phaseId}/attachments`, fd, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data;
}

export function phaseAttachmentDownloadUrl(attachmentId: string) {
  return `/api/workflow/phase-attachments/${attachmentId}/download`;
}

export async function deletePhaseAttachment(attachmentId: string) {
  const { data } = await api.delete(`/api/workflow/phase-attachments/${attachmentId}`);
  return data;
}

export async function createPhaseLink(phaseId: string, body: { url: string; label?: string }) {
  const { data } = await api.post(`/api/workflow/phases/${phaseId}/links`, body);
  return data;
}

export async function deletePhaseLink(linkId: string) {
  const { data } = await api.delete(`/api/workflow/phase-links/${linkId}`);
  return data;
}

export interface BookmarkCapture {
  id: string;
  userId: string;
  pageUrl: string;
  pageText: string;
  capturedAt: string;
  consumedAt: string | null;
}

export async function getBookmarkCapture(id: string): Promise<BookmarkCapture> {
  const { data } = await api.get(`/api/workflow/bookmark-captures/${id}`);
  return data;
}

export async function listPendingBookmarkCaptures(): Promise<BookmarkCapture[]> {
  const { data } = await api.get('/api/workflow/bookmark-captures');
  return data;
}

export async function consumeBookmarkCapture(id: string) {
  const { data } = await api.post(`/api/workflow/bookmark-captures/${id}/consume`);
  return data;
}
export async function updateTrack(id: string, body: Record<string, unknown>) {
  const { data } = await api.put(`/api/workflow/tracks/${id}`, body);
  return data;
}
export async function getTrack(id: string) {
  const { data } = await api.get(`/api/workflow/tracks/${id}`);
  return data;
}
export async function deleteTrack(id: string) {
  // Use the singular alias per spec — server accepts both paths
  await api.delete(`/api/workflow/track/${id}`);
}

// Orphan CRM initiatives — primary-entity matched, no companion track yet
export interface OrphanInitiative {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  startDate: string | null;
  targetDate: string | null;
  createdAt: string;
}
export async function listOrphanInitiatives(workflowClientId: string): Promise<OrphanInitiative[]> {
  const { data } = await api.get('/api/workflow/orphan-initiatives', { params: { workflowClientId } });
  return data;
}
export async function promoteInitiativeToTrack(initiativeId: string, workflowClientId: string) {
  const { data } = await api.post(`/api/workflow/orphan-initiatives/${initiativeId}/promote`, { workflowClientId });
  return data;
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
export async function deletePhase(id: string) {
  await api.delete(`/api/workflow/phases/${id}`);
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
export async function deleteMilestone(id: string) {
  await api.delete(`/api/workflow/milestones/${id}`);
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
export async function deleteSOW(id: string) {
  await api.delete(`/api/workflow/sows/${id}`);
}
export interface SOWOverlap {
  sowId: string;
  sowTitle: string;
  trackTitle: string | null;
  reason: string;
}
export async function checkSOWOverlap(body: {
  workflowClientId: string;
  excludeSowId?: string;
  title?: string;
  scope?: string;
  deliverables?: string[];
  targetAgency?: string;
  targetFundingVehicle?: string;
}): Promise<{ overlaps: SOWOverlap[] }> {
  const { data } = await api.post('/api/workflow/sows/check-overlap', body);
  return data;
}
export async function integrateSOWWithTrack(sowId: string, trackId: string) {
  const { data } = await api.post(`/api/workflow/sow/${sowId}/integrate/${trackId}`);
  return data;
}

export interface Assignee {
  kind: 'contact' | 'user';
  id: string;
  name: string;
  email: string | null;
  subtitle: string;
}
export async function listAssignees(workflowClientId: string): Promise<Assignee[]> {
  const { data } = await api.get(`/api/workflow/clients/${workflowClientId}/assignees`);
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
