// Fetches a single SAM.gov opportunity's full text via the official API and
// returns it as one big string for Claude extraction.
//
// SAM.gov opportunity pages (https://sam.gov/opp/<noticeId>/view) are a
// JavaScript SPA — a plain fetch of the page returns an empty shell. The real
// content lives behind api.sam.gov: the opportunity record (metadata), a
// separate "notice description" endpoint, and a list of downloadable
// attachments (the actual RFP/solicitation PDFs). This pulls all three and
// concatenates them. Requires SAM_GOV_API_KEY (free from sam.gov account
// → Account Details → API Key).
import mammoth from 'mammoth';

const SAM_SEARCH = 'https://api.sam.gov/opportunities/v2/search';

export function isSamGovUrl(url: string): boolean {
  return /(^|\/\/|\.)sam\.gov\//i.test(url) && /\/opp\//i.test(url);
}

/** Pull the notice id out of a sam.gov opportunity URL (the long hex segment
 *  after /opp/). Returns null if it doesn't look like an opportunity link. */
export function extractSamNoticeId(url: string): string | null {
  const m = url.match(/\/opp\/([a-z0-9]{8,})/i);
  return m ? m[1] : null;
}

function withApiKey(url: string, apiKey: string): string {
  if (url.includes('api_key=')) return url;
  return `${url}${url.includes('?') ? '&' : '?'}api_key=${apiKey}`;
}

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

async function pdfToText(buf: Buffer): Promise<string> {
  const mod = await import('pdf-parse');
  const pdfParse = (mod as any).default || mod;
  const out = await pdfParse(buf);
  return (out.text || '').trim();
}

async function docxToText(buf: Buffer): Promise<string> {
  const out = await mammoth.extractRawText({ buffer: buf });
  return (out.value || '').trim();
}

export interface SamOpportunityResult {
  text: string;
  title?: string;
  attachmentCount: number;
  attachmentsRead: number;
}

/**
 * Fetch a SAM.gov opportunity by notice id and return its combined text
 * (metadata + full description + every readable attachment). Returns null if
 * the notice can't be found. Throws if the API key is missing or the API
 * errors hard — the caller decides how to surface that.
 */
export async function fetchSamOpportunity(noticeId: string): Promise<SamOpportunityResult | null> {
  const apiKey = process.env.SAM_GOV_API_KEY;
  if (!apiKey) throw new Error('SAM_GOV_API_KEY not configured');

  const fmt = (d: Date) => {
    const [y, m, day] = d.toISOString().slice(0, 10).split('-');
    return `${m}/${day}/${y}`;
  };

  // The v2 search requires a posted-date window and rejects ranges of a year
  // or more ("Date range must be ... year(s) apart"), and only returns the
  // notice if its posted date falls inside the window. So walk backward in
  // sub-year windows until we find it — covers several years of history while
  // staying under the limit.
  const DAY = 24 * 60 * 60 * 1000;
  const WINDOW_DAYS = 360;
  const MAX_WINDOWS = 8; // ~7.9 years back
  let opp: any = null;
  for (let i = 0; i < MAX_WINDOWS && !opp; i++) {
    const to = new Date(Date.now() - i * WINDOW_DAYS * DAY);
    const from = new Date(to.getTime() - WINDOW_DAYS * DAY);
    const params = new URLSearchParams({
      api_key: apiKey,
      noticeid: noticeId,
      postedFrom: fmt(from),
      postedTo: fmt(to),
      limit: '1',
    });
    const res = await fetch(`${SAM_SEARCH}?${params}`);
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`SAM.gov ${res.status}${body ? ' — ' + body.slice(0, 200) : ''}`);
    }
    const data = (await res.json()) as { opportunitiesData?: any[] };
    opp = data.opportunitiesData?.[0] || null;
  }
  if (!opp) return null;

  const parts: string[] = [];

  // Metadata block.
  const meta: string[] = [];
  if (opp.title) meta.push(`Title: ${opp.title}`);
  if (opp.solicitationNumber) meta.push(`Solicitation Number: ${opp.solicitationNumber}`);
  if (opp.fullParentPathName) meta.push(`Agency: ${opp.fullParentPathName}`);
  if (opp.type) meta.push(`Notice Type: ${opp.type}`);
  if (opp.postedDate) meta.push(`Posted: ${opp.postedDate}`);
  if (opp.responseDeadLine) meta.push(`Response Deadline: ${opp.responseDeadLine}`);
  if (opp.naicsCode) meta.push(`NAICS: ${opp.naicsCode}`);
  if (Array.isArray(opp.pointOfContact)) {
    for (const poc of opp.pointOfContact) {
      const line = [poc.fullName, poc.title, poc.email, poc.phone].filter(Boolean).join(' — ');
      if (line) meta.push(`Point of Contact: ${line}`);
    }
  }
  if (meta.length) parts.push(meta.join('\n'));

  // Full description — `opp.description` is a URL to the notice-description API.
  if (opp.description) {
    try {
      const dres = await fetch(withApiKey(String(opp.description), apiKey));
      if (dres.ok) {
        const ct = dres.headers.get('content-type') || '';
        let raw = '';
        if (ct.includes('application/json')) {
          const dj = (await dres.json()) as any;
          raw = dj?.description || dj?.body || '';
        } else {
          raw = await dres.text();
        }
        const desc = stripHtml(raw);
        if (desc) parts.push(`Description:\n${desc}`);
      }
    } catch {
      /* tolerate — metadata + attachments may still be enough */
    }
  }

  // Attachments — resourceLinks are direct download URLs.
  const links: string[] = Array.isArray(opp.resourceLinks) ? opp.resourceLinks : [];
  let read = 0;
  for (const link of links) {
    try {
      const fres = await fetch(withApiKey(String(link), apiKey), { redirect: 'follow' });
      if (!fres.ok) continue;
      const ct = fres.headers.get('content-type') || '';
      const cd = fres.headers.get('content-disposition') || '';
      const buf = Buffer.from(await fres.arrayBuffer());
      let txt = '';
      if (ct.includes('pdf') || /\.pdf/i.test(cd)) txt = await pdfToText(buf);
      else if (ct.includes('wordprocessingml') || /\.docx/i.test(cd)) txt = await docxToText(buf);
      else if (ct.startsWith('text/') || /\.(txt|md|csv)/i.test(cd)) txt = buf.toString('utf8').trim();
      if (txt) {
        parts.push(`Attachment:\n${txt}`);
        read++;
      }
    } catch {
      /* tolerate per-attachment failures */
    }
  }

  return {
    text: parts.join('\n\n'),
    title: opp.title ? String(opp.title) : undefined,
    attachmentCount: links.length,
    attachmentsRead: read,
  };
}
