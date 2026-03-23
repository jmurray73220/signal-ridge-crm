import { Router } from 'express';
import { requireAuth, requireEditor, requireAdmin } from '../middleware/auth';
import { getTasks, createTask, updateTask, deleteTask } from '../controllers/tasksController';

const router = Router();

router.use(requireAuth);

router.get('/', getTasks);
router.post('/', requireEditor, createTask);
router.put('/:id', requireEditor, updateTask);
router.delete('/:id', requireAdmin, deleteTask);

export default router;
