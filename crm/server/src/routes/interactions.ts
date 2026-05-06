import { Router } from 'express';
import multer from 'multer';
import { requireAuth, requireEditor, requireAdmin } from '../middleware/auth';
import {
  getInteractions,
  getInteraction,
  createInteraction,
  updateInteraction,
  deleteInteraction,
} from '../controllers/interactionsController';
import {
  uploadAttachmentMultipart,
  uploadAttachmentJson,
  listAttachments,
  downloadAttachment,
  getAttachmentText,
  deleteAttachment,
} from '../controllers/interactionAttachmentsController';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } });

router.use(requireAuth);

router.get('/', getInteractions);
router.post('/', requireEditor, createInteraction);
router.get('/:id', getInteraction);
router.put('/:id', requireEditor, updateInteraction);
router.delete('/:id', requireEditor, deleteInteraction);

// Attachments — list/upload scoped to an interaction; download/delete by attachment id.
router.get('/:id/attachments', listAttachments);
router.post('/:id/attachments', requireEditor, upload.single('file'), uploadAttachmentMultipart);
router.post('/:id/attachments/json', requireEditor, uploadAttachmentJson);
router.get('/attachments/:attachmentId/download', downloadAttachment);
router.get('/attachments/:attachmentId/text', getAttachmentText);
router.delete('/attachments/:attachmentId', requireEditor, deleteAttachment);

export default router;
