import { Router } from 'express';
import multer from 'multer';
import { requireAuth, requireEditor, requireAdmin, denyClientUsers } from '../middleware/auth';
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
  addLinkAttachment,
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
// Attachments are staff files reachable by raw id (no entity scope), so they're
// internal-only — clients are denied even though they can read interaction notes.
router.get('/:id/attachments', denyClientUsers, listAttachments);
router.post('/:id/attachments', requireEditor, upload.single('file'), uploadAttachmentMultipart);
router.post('/:id/attachments/json', requireEditor, uploadAttachmentJson);
router.post('/:id/attachments/link', requireEditor, addLinkAttachment);
router.get('/attachments/:attachmentId/download', denyClientUsers, downloadAttachment);
router.get('/attachments/:attachmentId/text', denyClientUsers, getAttachmentText);
router.delete('/attachments/:attachmentId', requireEditor, deleteAttachment);

export default router;
