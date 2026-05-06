import { Router } from 'express';
import { requireAuth, requireAdmin } from '../middleware/auth';
import {
  getUsers,
  createUser,
  updateUserRole,
  toggleUserActive,
  listWorkflowClients,
  listClientContactsForUser,
  updateUserWorkflowRole,
} from '../controllers/usersController';

const router = Router();

router.use(requireAuth);

router.get('/', requireAdmin, getUsers);
router.get('/workflow-clients', requireAdmin, listWorkflowClients);
router.get('/client-contacts', requireAdmin, listClientContactsForUser);
router.post('/', requireAdmin, createUser);
router.patch('/:id/role', requireAdmin, updateUserRole);
router.patch('/:id/workflow-role', requireAdmin, updateUserWorkflowRole);
router.patch('/:id/active', requireAdmin, toggleUserActive);

export default router;
