import { Router } from 'express';
import { requireAuth, requireEditor, requireAdmin } from '../middleware/auth';
import {
  getInteractions,
  getInteraction,
  createInteraction,
  updateInteraction,
  deleteInteraction,
} from '../controllers/interactionsController';

const router = Router();

router.use(requireAuth);

router.get('/', getInteractions);
router.post('/', requireEditor, createInteraction);
router.get('/:id', getInteraction);
router.put('/:id', requireEditor, updateInteraction);
router.delete('/:id', requireAdmin, deleteInteraction);

export default router;
