import { Request, Response } from 'express';
import prisma from '../services/prisma';
import { AuthRequest } from '../types';

const MAX_TEXT_LEN = 200_000;

// ─── Receive a bookmarklet form-POST ─────────────────────────────────────────
//
// The bookmarklet runs on a foreign tab (e.g. eBuy), creates a hidden HTML
// form pointing at this endpoint, and submits it. Because it's a top-level
// navigation to our origin, the browser sends our auth cookie (SameSite=Lax),
// so the request is authenticated. CORS does not apply to form submits.
//
// We persist the captured page text to a BookmarkCapture row keyed by the
// user, then redirect them into the SPA with `?capture=<id>`. The SPA reads
// the row, lets the user pick a client, and creates a contract-opportunity
// track with the captured text fed straight into the Claude extractor.

export async function receiveBookmarkPost(req: AuthRequest, res: Response) {
  if (!req.user?.userId) {
    // SameSite=Lax should send the cookie on top-level POST navigations, but
    // if the browser blocked it, send the user to login first.
    return res.redirect('/workflow/login?next=' + encodeURIComponent('/workflow/'));
  }

  const pageUrl = String(req.body?.pageUrl || '').trim();
  const rawText = String(req.body?.pageText || '');
  if (!pageUrl || rawText.length < 100) {
    return res
      .status(400)
      .send('<h2>Capture failed</h2><p>The bookmarklet did not send enough page text. Try again from the source tab.</p>');
  }

  const pageText = rawText.slice(0, MAX_TEXT_LEN);

  const capture = await prisma.bookmarkCapture.create({
    data: {
      userId: req.user.userId,
      pageUrl,
      pageText,
    },
  });

  // Send the user to the workflow SPA with the capture id in a query param.
  // The SPA picks it up, shows a "Captured page from [URL]" modal, lets them
  // pick a client, and creates the track.
  return res.redirect(`/workflow/?capture=${capture.id}`);
}

export async function getBookmarkCapture(req: AuthRequest, res: Response) {
  const { id } = req.params;
  try {
    const capture = await prisma.bookmarkCapture.findUnique({ where: { id } });
    if (!capture || capture.userId !== req.user?.userId) {
      return res.status(404).json({ error: 'Not found' });
    }
    return res.json(capture);
  } catch (err) {
    console.error('[getBookmarkCapture]', err);
    return res.status(500).json({ error: 'Server error' });
  }
}

export async function listPendingBookmarkCaptures(req: AuthRequest, res: Response) {
  try {
    const captures = await prisma.bookmarkCapture.findMany({
      where: { userId: req.user!.userId, consumedAt: null },
      orderBy: { capturedAt: 'desc' },
      take: 5,
    });
    return res.json(captures);
  } catch (err) {
    console.error('[listPendingBookmarkCaptures]', err);
    return res.status(500).json({ error: 'Server error' });
  }
}

export async function consumeBookmarkCapture(req: AuthRequest, res: Response) {
  const { id } = req.params;
  try {
    const capture = await prisma.bookmarkCapture.findUnique({ where: { id } });
    if (!capture || capture.userId !== req.user?.userId) {
      return res.status(404).json({ error: 'Not found' });
    }
    if (!capture.consumedAt) {
      await prisma.bookmarkCapture.update({
        where: { id },
        data: { consumedAt: new Date() },
      });
    }
    return res.json({ ok: true });
  } catch (err) {
    console.error('[consumeBookmarkCapture]', err);
    return res.status(500).json({ error: 'Server error' });
  }
}

// Static handler that serves the bookmarklet source as a draggable link
// target. Hosting it ourselves means we can iterate on it without users
// reinstalling — the bookmark just points at a `javascript:fetch(...)`
// URL we generate at runtime in the install UI.
//
// Kept here for symmetry; the actual `javascript:` URL is built client-side
// and embedded into the install page.
export function bookmarkletSource(_req: Request, res: Response) {
  const origin = process.env.PUBLIC_ORIGIN || '';
  const js = `(function(){try{var t=document.body.innerText||'';var u=location.href;var f=document.createElement('form');f.method='POST';f.action='${origin}/workflow/from-bookmark';f.target='_blank';f.style.display='none';var a=document.createElement('input');a.name='pageUrl';a.value=u;f.appendChild(a);var b=document.createElement('textarea');b.name='pageText';b.value=t.slice(0,200000);f.appendChild(b);document.body.appendChild(f);f.submit();}catch(e){alert('Capture failed: '+e.message);}})();`;
  res.setHeader('Content-Type', 'application/javascript');
  res.send(js);
}
