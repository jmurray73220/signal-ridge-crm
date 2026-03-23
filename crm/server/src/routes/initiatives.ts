import { Router } from 'express';
import { requireAuth, requireEditor, requireAdmin } from '../middleware/auth';
import {
  getInitiatives,
  getInitiative,
  createInitiative,
  updateInitiative,
  deleteInitiative,
  addInitiativeContact,
  removeInitiativeContact,
  addInitiativeEntity,
  removeInitiativeEntity,
} from '../controllers/initiativesController';

const router = Router();

router.use(requireAuth);

router.get('/', getInitiatives);
router.post('/', requireEditor, createInitiative);
router.get('/:id', getInitiative);
router.put('/:id', requireEditor, updateInitiative);
router.delete('/:id', requireAdmin, deleteInitiative);
router.post('/:id/contacts', requireEditor, addInitiativeContact);
router.delete('/:id/contacts/:contactId', requireEditor, removeInitiativeContact);
router.post('/:id/entities', requireEditor, addInitiativeEntity);
router.delete('/:id/entities/:entityId', requireEditor, removeInitiativeEntity);

export default router;
