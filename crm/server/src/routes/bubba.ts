import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import { requireWorkflow } from '../middleware/workflowAuth';
import { bubbaChat } from '../controllers/bubbaController';

const router = Router();

router.use(requireAuth);
router.use(requireWorkflow);

router.post('/chat', bubbaChat);

export default router;
