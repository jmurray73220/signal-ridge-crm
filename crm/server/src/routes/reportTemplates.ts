import { Router } from 'express';
import multer from 'multer';
import { requireAuth, requireEditor } from '../middleware/auth';
import { listTemplates, uploadTemplate, deleteTemplate } from '../controllers/reportTemplateController';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } }); // 50MB limit

router.use(requireAuth);

router.get('/', listTemplates);
router.post('/upload', requireEditor, upload.single('file'), uploadTemplate);
router.delete('/:id', requireEditor, deleteTemplate);

export default router;
