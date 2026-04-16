import { Router } from 'express';
import multer from 'multer';
import { requireAuth, requireEditor } from '../middleware/auth';
import {
  uploadDocument,
  listDocuments,
  deleteDocument,
  chatWithDocument,
  generateReport,
  createBudgetLink,
  createConversation,
  updateConversation,
  getConversations,
} from '../controllers/budgetController';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 100 * 1024 * 1024 } }); // 100MB limit

router.use(requireAuth);

// Documents
router.get('/', listDocuments);
router.post('/upload', requireEditor, upload.single('file'), uploadDocument);
router.delete('/:id', requireEditor, deleteDocument);

// Chat
router.post('/:id/chat', chatWithDocument);

// Report generation (longer timeout)
router.post('/report', (req: any, res: any, next: any) => {
  if (req.setTimeout) req.setTimeout(120000);
  if (res.setTimeout) res.setTimeout(120000);
  next();
}, requireEditor, generateReport);

// Conversations
router.get('/conversations', getConversations);
router.post('/conversations', requireEditor, createConversation);
router.put('/conversations/:id', requireEditor, updateConversation);

// Links
router.post('/links', requireEditor, createBudgetLink);

export default router;
