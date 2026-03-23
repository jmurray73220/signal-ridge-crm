import { Router } from 'express';
import { requireAuth, requireAdmin } from '../middleware/auth';
import {
  getUsers,
  createUser,
  updateUserRole,
  toggleUserActive,
} from '../controllers/usersController';

const router = Router();

router.use(requireAuth);

router.get('/', requireAdmin, getUsers);
router.post('/', requireAdmin, createUser);
router.patch('/:id/role', requireAdmin, updateUserRole);
router.patch('/:id/active', requireAdmin, toggleUserActive);

export default router;
