import { Router, Response } from 'express';
import multer from 'multer';
import { requireAuth, requireAdmin } from '../middleware/auth';
import { getSettings, updateSettings, uploadLogo, getLogo, deleteLogo } from '../controllers/settingsController';
import { AuthRequest } from '../types';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 2 * 1024 * 1024 } });

router.use(requireAuth);

// Reads (party + logo) stay open for branding; writes are admin-only — these
// previously had no guard at all, so any authenticated user could change them.
router.get('/', getSettings as any);
router.put('/', requireAdmin, updateSettings as any);

router.get('/logo', getLogo as any);
router.post('/logo', requireAdmin, upload.single('logo'), uploadLogo as any);
router.delete('/logo', requireAdmin, deleteLogo as any);

export default router;
