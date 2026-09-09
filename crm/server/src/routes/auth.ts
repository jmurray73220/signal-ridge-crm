import { Router } from 'express';
import { login, logout, me, changePassword, forceChangePassword, register, forgotPassword, resetPassword } from '../controllers/authController';
import { requireAuth } from '../middleware/auth';
import { forgotPasswordUrl, parseReturnApp } from '../services/appUrls';

const router = Router();

router.post('/login', login);
router.post('/logout', logout);
router.get('/me', requireAuth, me);
router.post('/change-password', requireAuth, changePassword);
router.post('/force-change-password', requireAuth, forceChangePassword);
router.post('/register', register);
// GET = "take me to the reset page" (the workflow login's "Forgot password?"
// link lands here); POST = "generate a reset link for this email". Mounted at
// /auth, which both vite dev proxies forward, so the redirect behaves the same
// locally and in production.
router.get('/forgot-password', (req, res) =>
  res.redirect(forgotPasswordUrl(req, parseReturnApp(req.query.from))));
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);

export default router;
