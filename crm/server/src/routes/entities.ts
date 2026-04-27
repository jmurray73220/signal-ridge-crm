import { Router } from 'express';
import { requireAuth, requireEditor, requireAdmin } from '../middleware/auth';
import {
  getEntities,
  getEntity,
  createEntity,
  updateEntity,
  deleteEntity,
  getEntityContacts,
  getEntityInitiatives,
  getEntityInteractions,
  backfillClientSelfTags,
} from '../controllers/entitiesController';

const router = Router();

router.use(requireAuth);

router.get('/', getEntities);
router.post('/', requireEditor, createEntity);
// Backfill must come before /:id so Express doesn't treat it as an id.
router.post('/backfill-client-self-tags', requireAdmin, backfillClientSelfTags);
router.get('/:id', getEntity);
router.put('/:id', requireEditor, updateEntity);
router.delete('/:id', requireAdmin, deleteEntity);
router.get('/:id/contacts', getEntityContacts);
router.get('/:id/initiatives', getEntityInitiatives);
router.get('/:id/interactions', getEntityInteractions);

export default router;
