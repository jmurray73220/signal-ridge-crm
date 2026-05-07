import { Router } from 'express';
import { requireAuth, requireEditor, requireAdmin } from '../middleware/auth';
import {
  getContacts,
  getContact,
  createContact,
  updateContact,
  deleteContact,
  importContacts,
  getContactInteractions,
  getContactInitiatives,
  getContactTasks,
  listIssuePortfolios,
  createIssuePortfolio,
  renameIssuePortfolio,
  deleteIssuePortfolio,
} from '../controllers/contactsController';

const router = Router();

router.use(requireAuth);

router.get('/', getContacts);
// Must be declared before /:id so Express doesn't treat "issue-portfolios" as an id.
router.get('/issue-portfolios', listIssuePortfolios);
router.post('/issue-portfolios', requireEditor, createIssuePortfolio);
router.put('/issue-portfolios/:name', requireEditor, renameIssuePortfolio);
router.delete('/issue-portfolios/:name', requireEditor, deleteIssuePortfolio);
router.post('/', requireEditor, createContact);
router.post('/import', requireEditor, importContacts);
router.get('/:id', getContact);
router.put('/:id', requireEditor, updateContact);
router.delete('/:id', requireAdmin, deleteContact);
router.get('/:id/interactions', getContactInteractions);
router.get('/:id/initiatives', getContactInitiatives);
router.get('/:id/tasks', getContactTasks);

export default router;
