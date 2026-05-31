import { Router } from 'express';
import multer from 'multer';
import { requireAuth } from '../middleware/auth';
import {
  requireWorkflow,
  requireWorkflowEditor,
  requireWorkflowAdmin,
} from '../middleware/workflowAuth';
import * as ctl from '../controllers/workflowController';
import {
  getBookmarkCapture,
  listPendingBookmarkCaptures,
  consumeBookmarkCapture,
} from '../controllers/bookmarkletController';
import {
  uploadPhaseAttachment,
  downloadPhaseAttachment,
  deletePhaseAttachment,
  createPhaseLink,
  deletePhaseLink,
} from '../controllers/phaseAssetsController';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } });

router.use(requireAuth);
router.use(requireWorkflow);

// Clients
router.get('/clients', ctl.listClients);
// List CRM "Client" entities so Admin can link a new WorkflowClient to one.
// Must be declared before /clients/:id so Express doesn't treat "crm-entities" as an id.
router.get('/clients/crm-entities', requireWorkflowAdmin, ctl.listCrmClientEntities);
router.post('/clients/backfill-from-crm', requireWorkflowAdmin, ctl.backfillClientsFromCrm);
router.get('/clients/:id', ctl.getClient);
router.get('/clients/:id/assignees', ctl.listAssignees);
router.get('/my-tasks', ctl.listMyTasks);
router.post('/clients', requireWorkflowAdmin, ctl.createClient);
router.put('/clients/:id', requireWorkflowAdmin, ctl.updateClient);
router.delete('/clients/:id', requireWorkflowAdmin, ctl.deleteClient);

// Tracks — Editors can create/update/delete within their assigned client
// (controllers enforce client scope via assertClientAccess).
router.get('/tracks', ctl.listTracks);
router.get('/tracks/:id', ctl.getTrack);
router.get('/tracks/:id/crm-followups', ctl.getTrackCrmFollowups);
router.post('/tracks', requireWorkflowEditor, ctl.createTrack);
router.post('/tracks/probe-url', requireWorkflowEditor, ctl.probeOpportunityUrl);
router.post('/tracks/extract-preview', requireWorkflowEditor, ctl.extractPreview);
router.post('/tracks/:id/extract-from-url', requireWorkflowEditor, ctl.retryExtractTrackFromUrl);
router.post('/tracks/:id/extract-from-text', requireWorkflowEditor, ctl.extractTrackFromText);
router.put('/tracks/:id', requireWorkflowEditor, ctl.updateTrack);
router.delete('/tracks/:id', requireWorkflowEditor, ctl.deleteTrack);
// Singular alias per spec
router.delete('/track/:id', requireWorkflowEditor, ctl.deleteTrack);

// Orphan CRM initiatives — visible in workflow Dashboard so initiatives
// created directly in the CRM aren't invisible here.
router.get('/orphan-initiatives', ctl.listOrphanInitiatives);
router.post('/orphan-initiatives/:initiativeId/promote', requireWorkflowEditor, ctl.promoteInitiativeToTrack);

// Phases
router.post('/phases', requireWorkflowEditor, ctl.createPhase);
router.put('/phases/:id', requireWorkflowEditor, ctl.updatePhase);
router.delete('/phases/:id', requireWorkflowEditor, ctl.deletePhase);

// Phase attachments + links — files and important URLs scoped to a phase.
router.post('/phases/:phaseId/attachments', requireWorkflowEditor, upload.single('file'), uploadPhaseAttachment);
router.get('/phase-attachments/:attachmentId/download', downloadPhaseAttachment);
router.delete('/phase-attachments/:attachmentId', requireWorkflowEditor, deletePhaseAttachment);
router.post('/phases/:phaseId/links', requireWorkflowEditor, createPhaseLink);
router.delete('/phase-links/:linkId', requireWorkflowEditor, deletePhaseLink);

// Milestones (UI label: "Steps") — Editors can create/update/delete since
// step changes are routine operational work for anyone assigned to the
// client. Client access is also enforced inside each controller.
router.post('/milestones', requireWorkflowEditor, ctl.createMilestone);
router.put('/milestones/:id', requireWorkflowEditor, ctl.updateMilestone);
router.delete('/milestones/:id', requireWorkflowEditor, ctl.deleteMilestone);

// Action items — Editors can create/update/delete within their client.
router.get('/action-items/:id', ctl.getActionItem);
router.post('/action-items', requireWorkflowEditor, ctl.createActionItem);
router.put('/action-items/:id', requireWorkflowEditor, ctl.updateActionItem);
router.delete('/action-items/:id', requireWorkflowEditor, ctl.deleteActionItem);

// SOWs
router.get('/sows', ctl.listSOWs);
// Scope-overlap check across existing SOWs for the client (warn-only).
// Must be declared before /sows/:id so Express doesn't treat "check-overlap" as an id.
router.post('/sows/check-overlap', requireWorkflowEditor, ctl.checkSOWOverlap);
router.get('/sows/:id', ctl.getSOW);
router.post('/sows', requireWorkflowEditor, ctl.createSOW);
router.put('/sows/:id', requireWorkflowEditor, ctl.updateSOW);
router.delete('/sows/:id', requireWorkflowEditor, ctl.deleteSOW);

// AI reconciliation when SOW is integrated into a track
router.post('/sow/:id/integrate/:trackId', requireWorkflowEditor, ctl.integrateSOWWithTrack);

// Comments — Editors & Admins can post; Viewers read-only
router.post('/comments', requireWorkflowEditor, ctl.createComment);
router.delete('/comments/:id', ctl.deleteComment);

// Workflow user admin
router.get('/users', requireWorkflowAdmin, ctl.listWorkflowUsers);
router.patch('/users/:id/workflow-role', requireWorkflowAdmin, ctl.setWorkflowRole);

// Bookmarklet captures — the bookmarklet POSTs to /workflow/from-bookmark
// (top-level, registered in index.ts). These endpoints are for the SPA to
// look up and consume a capture once it's been received.
router.get('/bookmark-captures', listPendingBookmarkCaptures);
router.get('/bookmark-captures/:id', getBookmarkCapture);
router.post('/bookmark-captures/:id/consume', consumeBookmarkCapture);

export default router;
