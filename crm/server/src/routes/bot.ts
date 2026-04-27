import { Router } from 'express';
import { botAuth } from '../middleware/botAuth';
import {
  getContacts,
  getContact,
  createContact,
  updateContact,
  deleteContact,
  getContactInteractions,
  getContactInitiatives,
  getContactTasks,
} from '../controllers/contactsController';
import {
  getEntities,
  getEntity,
  createEntity,
  updateEntity,
  deleteEntity,
  getEntityContacts,
  getEntityInitiatives,
  getEntityInteractions,
} from '../controllers/entitiesController';
import {
  getInteractions,
  getInteraction,
  createInteraction,
  updateInteraction,
  deleteInteraction,
} from '../controllers/interactionsController';
import {
  getTasks,
  createTask,
  updateTask,
  deleteTask,
} from '../controllers/tasksController';
import {
  getBotInitiatives,
  getBotInitiative,
  patchBotInitiative,
} from '../controllers/initiativesController';

const router = Router();

router.use(botAuth);

// Health / identity
router.get('/health', (_req, res) => res.json({ ok: true, bot: true }));
router.get('/whoami', (req: any, res) => res.json({
  userId: req.user?.userId,
  email: req.user?.email,
  role: req.user?.role,
}));

// Contacts
router.get('/contacts', getContacts);
router.post('/contacts', createContact);
router.get('/contacts/:id', getContact);
router.put('/contacts/:id', updateContact);
router.delete('/contacts/:id', deleteContact);
router.get('/contacts/:id/interactions', getContactInteractions);
router.get('/contacts/:id/initiatives', getContactInitiatives);
router.get('/contacts/:id/tasks', getContactTasks);

// Entities — Congressional Offices, Government Orgs, Companies, NGOs.
// Filter companies with ?type=Company
router.get('/entities', getEntities);
router.post('/entities', createEntity);
router.get('/entities/:id', getEntity);
router.put('/entities/:id', updateEntity);
router.delete('/entities/:id', deleteEntity);
router.get('/entities/:id/contacts', getEntityContacts);
router.get('/entities/:id/initiatives', getEntityInitiatives);
router.get('/entities/:id/interactions', getEntityInteractions);

// Interactions
router.get('/interactions', getInteractions);
router.post('/interactions', createInteraction);
router.get('/interactions/:id', getInteraction);
router.put('/interactions/:id', updateInteraction);
router.delete('/interactions/:id', deleteInteraction);

// Tasks
router.get('/tasks', getTasks);
router.post('/tasks', createTask);
router.put('/tasks/:id', updateTask);
router.delete('/tasks/:id', deleteTask);

// Initiatives — read-only list/detail + whitelisted PATCH (status, description)
router.get('/initiatives', getBotInitiatives);
router.get('/initiatives/:id', getBotInitiative);
router.patch('/initiatives/:id', patchBotInitiative);

export default router;
