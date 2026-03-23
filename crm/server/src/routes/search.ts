import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import { globalSearch } from '../controllers/searchController';

const router = Router();

router.get('/', requireAuth, globalSearch);

export default router;
