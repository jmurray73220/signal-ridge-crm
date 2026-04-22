import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import {
  requireWorkflow,
  requireWorkflowEditor,
  requireWorkflowAdmin,
} from '../middleware/workflowAuth';
import * as ctl from '../controllers/workflowController';

const router = Router();

router.use(requireAuth);
router.use(requireWorkflow);

// Clients
router.get('/clients', ctl.listClients);
// List CRM "Client" entities so Admin can link a new WorkflowClient to one.
// Must be declared before /clients/:id so Express doesn't treat "crm-entities" as an id.
router.get('/clients/crm-entities', requireWorkflowAdmin, ctl.listCrmClientEntities);
router.get('/clients/:id', ctl.getClient);
router.get('/clients/:id/assignees', ctl.listAssignees);
router.post('/clients', requireWorkflowAdmin, ctl.createClient);
router.put('/clients/:id', requireWorkflowAdmin, ctl.updateClient);
router.delete('/clients/:id', requireWorkflowAdmin, ctl.deleteClient);

// Tracks
router.get('/tracks', ctl.listTracks);
router.get('/tracks/:id', ctl.getTrack);
router.post('/tracks', requireWorkflowAdmin, ctl.createTrack);
router.put('/tracks/:id', requireWorkflowAdmin, ctl.updateTrack);
router.delete('/tracks/:id', requireWorkflowAdmin, ctl.deleteTrack);
// Singular alias per spec
router.delete('/track/:id', requireWorkflowAdmin, ctl.deleteTrack);

// Phases
router.post('/phases', requireWorkflowAdmin, ctl.createPhase);
router.put('/phases/:id', requireWorkflowAdmin, ctl.updatePhase);
router.delete('/phases/:id', requireWorkflowAdmin, ctl.deletePhase);

// Milestones
router.post('/milestones', requireWorkflowAdmin, ctl.createMilestone);
router.put('/milestones/:id', requireWorkflowAdmin, ctl.updateMilestone);
router.delete('/milestones/:id', requireWorkflowAdmin, ctl.deleteMilestone);

// Action items — Editors can update status/notes/assignedTo; Admin can do everything
router.get('/action-items/:id', ctl.getActionItem);
router.post('/action-items', requireWorkflowAdmin, ctl.createActionItem);
router.put('/action-items/:id', requireWorkflowEditor, ctl.updateActionItem);
router.delete('/action-items/:id', requireWorkflowAdmin, ctl.deleteActionItem);

// SOWs
router.get('/sows', ctl.listSOWs);
// Scope-overlap check across existing SOWs for the client (warn-only).
// Must be declared before /sows/:id so Express doesn't treat "check-overlap" as an id.
router.post('/sows/check-overlap', requireWorkflowAdmin, ctl.checkSOWOverlap);
router.get('/sows/:id', ctl.getSOW);
router.post('/sows', requireWorkflowAdmin, ctl.createSOW);
router.put('/sows/:id', requireWorkflowAdmin, ctl.updateSOW);
router.delete('/sows/:id', requireWorkflowAdmin, ctl.deleteSOW);

// AI reconciliation when SOW is integrated into a track
router.post('/sow/:id/integrate/:trackId', requireWorkflowAdmin, ctl.integrateSOWWithTrack);

// Comments — Editors & Admins can post; Viewers read-only
router.post('/comments', requireWorkflowEditor, ctl.createComment);
router.delete('/comments/:id', ctl.deleteComment);

// Workflow user admin
router.get('/users', requireWorkflowAdmin, ctl.listWorkflowUsers);
router.patch('/users/:id/workflow-role', requireWorkflowAdmin, ctl.setWorkflowRole);

export default router;
