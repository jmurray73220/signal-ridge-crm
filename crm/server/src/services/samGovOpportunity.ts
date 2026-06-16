// Fetches a single SAM.gov opportunity's full text and returns it as one big
// string for Claude extraction.
//
// SAM.gov opportunity pages (https://sam.gov/opp/<id>/view) are a JavaScript
// SPA — a plain fetch of the page returns an empty shell. The real content is
// behind two surfaces:
//   1. sam.gov's own site API (https://sam.gov/api/prod/opps/...), keyed by the
//      same id that's in the page URL, no key required. This is the PRIMARY
//      path — it has the description inline plus the attachment list.
//   2. the documented api.sam.gov search (needs SAM_GOV_API_KEY) — kept as a
//      fallback. NB: it's keyed by a DIFFERENT "Notice ID" than the page URL,
//      so it often can't find an opportunity by the URL id.
import mammoth from 'mammoth';

const SAM_SITE = 'https://sam.gov/api/prod/opps';
const SAM_SEARCH = 'https://api.sam.gov/opportunities/v2/search';
const BROWSER_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (compatible; SignalRidgeCRM/1.0)',
  'Accept': 'application/json, text/plain, */*',
};

export function isSamGovUrl(url: string): boolean {
  return /(^|\/\/|\.)sam\.gov\//i.test(url) && /\/opp\//i.test(url);
}

/** Pull the opportunity id out of a sam.gov URL (the long hex segment after
 *  /opp/). Returns null if it doesn't look like an opportunity link. */
export function extractSamNoticeId(url: string): string | null {
  const m = url.match(/\/opp\/([a-z0-9]{8,})/i);
  return m ? m[1] : null;
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

async function fileToText(buf: Buffer, ct: string, name: string): Promise<string> {
  if (ct.includes('pdf') || /\.pdf$/i.test(name)) return pdfToText(buf);
  if (ct.includes('wordprocessingml') || /\.docx$/i.test(name)) return docxToText(buf);
  if (ct.startsWith('text/') || /\.(txt|md|csv)$/i.test(name)) return buf.toString('utf8').trim();
  return '';
}

export interface SamOpportunityResult {
  text: string;
  title?: string;
  attachmentCount: number;
  attachmentsRead: number;
}

// ── Primary: sam.gov site API (keyed by the page-URL id, no key) ────────────

async function fetchAttachmentsViaSite(id: string): Promise<{ texts: string[]; count: number }> {
  const texts: string[] = [];
  let count = 0;
  try {
    const url = `${SAM_SITE}/v3/opportunities/resources?opportunityId=${encodeURIComponent(id)}&excludeDeleted=true&withScanResult=false`;
    const res = await fetch(url, { headers: BROWSER_HEADERS });
    console.log(`[samGov] site resources status=${res.status}`);
    if (!res.ok) return { texts, count };
    const json = (await res.json().catch(() => null)) as any;

    // Walk the JSON for attachment descriptors (resourceId/id + name). Shape
    // varies; collect from the known nesting and log what we found.
    const found: Array<{ rid: string; name: string }> = [];
    const lists = json?._embedded?.opportunityAttachmentList || [];
    for (const l of lists) {
      for (const a of l?.attachments || []) {
        const rid = a?.resourceId || a?.id;
        if (rid) found.push({ rid: String(rid), name: String(a?.name || '') });
      }
    }
    console.log(`[samGov] site resources found ${found.length} attachment(s)`);
    count = found.length;

    for (const { rid, name } of found) {
      try {
        const dl = `${SAM_SITE}/v3/opportunities/resources/files/${rid}/download`;
        const fres = await fetch(dl, { headers: BROWSER_HEADERS, redirect: 'follow' });
        if (!fres.ok) {
          console.log(`[samGov] attachment ${name || rid} download status=${fres.status}`);
          continue;
        }
        const buf = Buffer.from(await fres.arrayBuffer());
        const txt = await fileToText(buf, fres.headers.get('content-type') || '', name);
        if (txt) texts.push(`Attachment (${name || rid}):\n${txt}`);
      } catch {
        /* tolerate per-attachment failures */
      }
    }
  } catch (e) {
    console.log(`[samGov] site resources failed: ${(e as Error).message}`);
  }
  return { texts, count };
}

async function fetchViaSite(id: string): Promise<SamOpportunityResult | null> {
  const res = await fetch(`${SAM_SITE}/v2/opportunities/${encodeURIComponent(id)}`, { headers: BROWSER_HEADERS });
  console.log(`[samGov] site opportunity status=${res.status}`);
  if (!res.ok) return null;
  const json = (await res.json().catch(() => null)) as any;
  const d = json?.data2;
  if (!d) {
    console.log(`[samGov] site opportunity: no data2 (keys=${json ? Object.keys(json).join(',') : 'none'})`);
    return null;
  }

  const parts: string[] = [];
  const meta: string[] = [];
  const sol = d.solicitation || {};
  if (d.title) meta.push(`Title: ${d.title}`);
  if (sol.solicitationNumber || d.solicitationNumber) meta.push(`Solicitation Number: ${sol.solicitationNumber || d.solicitationNumber}`);
  if (d.type) meta.push(`Notice Type: ${d.type}`);
  if (sol.deadlines?.response) meta.push(`Response Deadline: ${sol.deadlines.response}`);
  if (d.postedDate) meta.push(`Posted: ${d.postedDate}`);
  if (Array.isArray(d.naics)) {
    const codes = d.naics.flatMap((n: any) => n?.code || []);
    if (codes.length) meta.push(`NAICS: ${codes.join(', ')}`);
  }
  if (d.classificationCode) meta.push(`Classification Code: ${d.classificationCode}`);
  if (d.placeOfPerformance) {
    const p = d.placeOfPerformance;
    const loc = [p.city?.name, p.state?.code, p.zip, p.country?.code].filter(Boolean).join(', ');
    if (loc) meta.push(`Place of Performance: ${loc}`);
  }
  if (Array.isArray(d.pointOfContact)) {
    for (const poc of d.pointOfContact) {
      const line = [poc.fullName, poc.title, poc.email, poc.phone].filter(Boolean).join(' — ');
      if (line) meta.push(`Point of Contact: ${line}`);
    }
  }
  if (meta.length) parts.push(meta.join('\n'));

  // Description body is inline HTML on the site API.
  if (Array.isArray(d.description)) {
    const body = d.description.map((x: any) => stripHtml(x?.body || '')).filter(Boolean).join('\n\n');
    if (body) parts.push(`Description:\n${body}`);
  } else if (typeof d.description === 'string') {
    const body = stripHtml(d.description);
    if (body) parts.push(`Description:\n${body}`);
  }

  const { texts, count } = await fetchAttachmentsViaSite(id);
  parts.push(...texts);

  const text = parts.join('\n\n');
  if (text.trim().length < 200) {
    console.log(`[samGov] site opportunity produced only ${text.length} chars`);
    return null;
  }
  return { text, title: d.title ? String(d.title) : undefined, attachmentCount: count, attachmentsRead: texts.length };
}

// ── Fallback: documented api.sam.gov search (needs the API key) ─────────────

async function fetchViaSearch(noticeId: string): Promise<SamOpportunityResult | null> {
  const apiKey = process.env.SAM_GOV_API_KEY;
  if (!apiKey) return null;

  const fmt = (dt: Date) => {
    const [y, m, day] = dt.toISOString().slice(0, 10).split('-');
    return `${m}/${day}/${y}`;
  };
  const DAY = 24 * 60 * 60 * 1000;
  const WINDOW_DAYS = 360;
  const MAX_WINDOWS = 8;
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
    const data = (await res.json()) as { totalRecords?: number; opportunitiesData?: any[] };
    opp = data.opportunitiesData?.[0] || null;
  }
  if (!opp) return null;

  const parts: string[] = [];
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

  if (opp.description) {
    try {
      const descUrl = String(opp.description).includes('api_key=')
        ? String(opp.description)
        : `${opp.description}${String(opp.description).includes('?') ? '&' : '?'}api_key=${apiKey}`;
      const dres = await fetch(descUrl);
      if (dres.ok) {
        const ct = dres.headers.get('content-type') || '';
        const raw = ct.includes('application/json') ? ((await dres.json()) as any)?.description || '' : await dres.text();
        const desc = stripHtml(raw);
        if (desc) parts.push(`Description:\n${desc}`);
      }
    } catch {
      /* tolerate */
    }
  }

  const links: string[] = Array.isArray(opp.resourceLinks) ? opp.resourceLinks : [];
  let read = 0;
  for (const link of links) {
    try {
      const dlUrl = String(link).includes('api_key=') ? String(link) : `${link}${String(link).includes('?') ? '&' : '?'}api_key=${apiKey}`;
      const fres = await fetch(dlUrl, { redirect: 'follow' });
      if (!fres.ok) continue;
      const buf = Buffer.from(await fres.arrayBuffer());
      const txt = await fileToText(buf, fres.headers.get('content-type') || '', fres.headers.get('content-disposition') || '');
      if (txt) {
        parts.push(`Attachment:\n${txt}`);
        read++;
      }
    } catch {
      /* tolerate */
    }
  }

  return { text: parts.join('\n\n'), title: opp.title ? String(opp.title) : undefined, attachmentCount: links.length, attachmentsRead: read };
}

/**
 * Fetch a SAM.gov opportunity by its page-URL id. Tries sam.gov's own site API
 * first (keyed by that id, no key needed), then the documented api.sam.gov
 * search as a fallback. Returns null if neither yields usable text.
 */
export async function fetchSamOpportunity(id: string): Promise<SamOpportunityResult | null> {
  try {
    const viaSite = await fetchViaSite(id);
    if (viaSite) {
      console.log(`[samGov] site path: ${viaSite.text.length} chars, attachments=${viaSite.attachmentsRead}/${viaSite.attachmentCount}`);
      return viaSite;
    }
  } catch (e) {
    console.log(`[samGov] site path failed: ${(e as Error).message}`);
  }

  console.log('[samGov] site path empty; trying api.sam.gov search fallback');
  const viaSearch = await fetchViaSearch(id);
  if (viaSearch) console.log(`[samGov] search path: ${viaSearch.text.length} chars, attachments=${viaSearch.attachmentsRead}/${viaSearch.attachmentCount}`);
  return viaSearch;
}
