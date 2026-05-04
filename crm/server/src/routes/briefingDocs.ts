import { Router } from 'express';
import multer from 'multer';
import { requireAuth, requireEditor } from '../middleware/auth';
import {
  uploadBriefingDoc,
  listBriefingDocs,
  deleteBriefingDoc,
  getBriefingDocTags,
} from '../controllers/briefingDocsController';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } }); // 25 MB

router.use(requireAuth);

router.get('/', listBriefingDocs);
router.get('/tags', getBriefingDocTags);
router.post('/upload', requireEditor, upload.single('file'), uploadBriefingDoc);
router.delete('/:id', requireEditor, deleteBriefingDoc);

export default router;
