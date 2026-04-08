import { Router, Response } from 'express';
import multer from 'multer';
import { requireAuth } from '../middleware/auth';
import { getSettings, updateSettings, uploadLogo, getLogo, deleteLogo } from '../controllers/settingsController';
import { AuthRequest } from '../types';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 2 * 1024 * 1024 } });

router.use(requireAuth);

router.get('/', getSettings as any);
router.put('/', updateSettings as any);

router.get('/logo', getLogo as any);
router.post('/logo', upload.single('logo'), uploadLogo as any);
router.delete('/logo', deleteLogo as any);

export default router;
