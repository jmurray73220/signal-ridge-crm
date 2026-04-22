import { Router } from 'express';
import { requireAuth, requireAdmin } from '../middleware/auth';
import {
  listRecycleBin,
  restore,
  purge,
  purgeOld,
  listChangeLog,
} from '../controllers/recycleBinController';

const router = Router();

router.use(requireAuth);
router.use(requireAdmin);

router.get('/recycle-bin', listRecycleBin);
router.post('/recycle-bin/purge-old', purgeOld);
router.post('/recycle-bin/:entityType/:id/restore', restore);
router.delete('/recycle-bin/:entityType/:id', purge);

router.get('/changelog', listChangeLog);

export default router;
