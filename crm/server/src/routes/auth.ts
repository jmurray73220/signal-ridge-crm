import { Router } from 'express';
import { login, logout, me, changePassword, forceChangePassword, register, forgotPassword, resetPassword } from '../controllers/authController';
import { requireAuth } from '../middleware/auth';

const router = Router();

router.post('/login', login);
router.post('/logout', logout);
router.get('/me', requireAuth, me);
router.post('/change-password', requireAuth, changePassword);
router.post('/force-change-password', requireAuth, forceChangePassword);
router.post('/register', register);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);

export default router;
