import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/auth';
import { getAuthUrl, handleCallback, searchEmails, getThread } from '../services/gmail';
import { AuthRequest } from '../types';

const router = Router();

// Auth routes (not protected — needed for OAuth flow)
router.get('/auth/gmail', (req: Request, res: Response) => {
  res.redirect(getAuthUrl());
});

router.get('/auth/gmail/callback', async (req: Request, res: Response) => {
  const { code } = req.query;
  if (!code) return res.status(400).json({ error: 'No code provided' });

  try {
    const tokens = await handleCallback(code as string);
    // Store token in cookie for session use
    res.cookie('gmail_token', tokens.access_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 1000, // 1 hour
    });
    res.redirect('http://localhost:5173/interactions?gmail=connected');
  } catch (err) {
    res.status(500).json({ error: 'Gmail auth failed' });
  }
});

// Protected API routes
router.get('/api/gmail/search', requireAuth, async (req: AuthRequest, res: Response) => {
  const { q } = req.query;
  const accessToken = req.cookies?.gmail_token;
  if (!accessToken) return res.status(401).json({ error: 'Gmail not connected', needsAuth: true });
  if (!q) return res.status(400).json({ error: 'Query required' });

  try {
    const threads = await searchEmails(accessToken, q as string);
    res.json(threads);
  } catch (err) {
    res.status(500).json({ error: 'Gmail search failed' });
  }
});

router.get('/api/gmail/thread/:id', requireAuth, async (req: AuthRequest, res: Response) => {
  const accessToken = req.cookies?.gmail_token;
  if (!accessToken) return res.status(401).json({ error: 'Gmail not connected', needsAuth: true });

  try {
    const thread = await getThread(accessToken, req.params.id);
    res.json(thread);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch thread' });
  }
});

export default router;
