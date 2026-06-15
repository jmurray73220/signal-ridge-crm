import { Router } from 'express';
import { requireAuth, denyClientUsers } from '../middleware/auth';
import { getReminders, createReminder, updateReminder, deleteReminder } from '../controllers/remindersController';

const router = Router();

router.use(requireAuth);
router.use(denyClientUsers); // reminders are internal-only

router.get('/', getReminders);
router.post('/', createReminder);
router.put('/:id', updateReminder);
router.delete('/:id', deleteReminder);

export default router;
