import { Router } from 'express';
import { requireAuth, requireEditor, requireAdmin } from '../middleware/auth';
import {
  getContacts,
  getContact,
  createContact,
  updateContact,
  deleteContact,
  importContacts,
  getContactInteractions,
  getContactInitiatives,
  getContactTasks,
} from '../controllers/contactsController';

const router = Router();

router.use(requireAuth);

router.get('/', getContacts);
router.post('/', requireEditor, createContact);
router.post('/import', requireEditor, importContacts);
router.get('/:id', getContact);
router.put('/:id', requireEditor, updateContact);
router.delete('/:id', requireAdmin, deleteContact);
router.get('/:id/interactions', getContactInteractions);
router.get('/:id/initiatives', getContactInitiatives);
router.get('/:id/tasks', getContactTasks);

export default router;
