// Look up a current Member of Congress's Bioguide ID and official portrait.
//
// Data source: github.com/unitedstates/congress-legislators (public-domain).
// The old theunitedstates.io mirror is dead (HTTP 410 / 403), so we fetch the
// YAML directly from GitHub raw and use the chamber-specific official sources
// for the portrait images themselves.

import yaml from 'js-yaml';

interface LegislatorRecord {
  id: { bioguide: string };
  name: { first: string; last: string; official_full?: string };
  terms: Array<{ type: 'sen' | 'rep'; state: string; start: string; end: string }>;
}

const LEGISLATORS_URL =
  'https://raw.githubusercontent.com/unitedstates/congress-legislators/main/legislators-current.yaml';

// Senate.gov hosts the official portrait at this exact path.
const SENATE_PORTRAIT_URL = (bioguide: string) =>
  `https://www.senate.gov/senators/PortraitImages/${bioguide.toUpperCase()}.jpg`;
// House clerk hosts member photos here. Lowercase bioguide. Image is JPEG.
const HOUSE_PORTRAIT_URL = (bioguide: string) =>
  `https://clerk.house.gov/images/members/${bioguide.toLowerCase()}.jpg`;

let cache: { data: LegislatorRecord[]; fetchedAt: number } | null = null;
const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours

async function loadLegislators(): Promise<LegislatorRecord[]> {
  if (cache && Date.now() - cache.fetchedAt < CACHE_TTL_MS) return cache.data;
  const r = await fetch(LEGISLATORS_URL);
  if (!r.ok) throw new Error('legislators-current fetch failed: ' + r.status);
  const text = await r.text();
  const parsed = yaml.load(text);
  if (!Array.isArray(parsed)) throw new Error('legislators-current: unexpected YAML shape');
  const data = parsed as LegislatorRecord[];
  cache = { data, fetchedAt: Date.now() };
  return data;
}

function normalizeChamber(input?: string | null): 'sen' | 'rep' | null {
  if (!input) return null;
  const s = input.toLowerCase();
  if (s.startsWith('sen')) return 'sen';
  if (s.startsWith('hou') || s.startsWith('rep')) return 'rep';
  return null;
}

// Extract a likely last-name token from a CRM display name. Common shapes:
//   "Schumer"
//   "Charles E. Schumer"
//   "Sen. Charles Schumer"
//   "Senator Charles Schumer (NY)"
//   "Office of Senator Charles Schumer"
//   "Schumer, Charles"
//   "The Honorable Chuck Schumer"
function extractLastName(input: string): string {
  let s = input
    .replace(/^\s*office\s+of\s+/i, '')                          // "Office of …"
    .replace(/\s*\([^)]*\)\s*/g, ' ')                            // strip "(NY)", "(NY-23)", etc.
    .replace(/\s+/g, ' ')
    .trim()
    .replace(
      /^(the\s+honorable|hon\.?|sen\.?|senator|rep\.?|representative|congresswoman|congressman|delegate)\s+/i,
      ''
    )
    .trim();
  if (s.includes(',')) return s.split(',')[0].trim();
  const tokens = s.split(/\s+/).filter(Boolean);
  // Skip an obvious suffix on the very end (Jr., Sr., II, III, IV)
  while (tokens.length > 1 && /^(jr\.?|sr\.?|ii|iii|iv)$/i.test(tokens[tokens.length - 1])) {
    tokens.pop();
  }
  return tokens[tokens.length - 1] || '';
}

export interface MemberMatch {
  bioguideId: string;
  chamber: 'sen' | 'rep';
}

export async function findMember(opts: {
  // The entity's display name — e.g. "Sen. Charles Schumer" or
  // "Office of Senator Schumer (NY)". Parser handles both.
  displayName?: string | null;
  chamber?: string | null;
  state?: string | null;
}): Promise<MemberMatch | null> {
  const { displayName, chamber, state } = opts;
  if (!displayName) return null;
  const lastName = extractLastName(displayName).toLowerCase();
  if (!lastName) return null;
  const ch = normalizeChamber(chamber);
  const st = state ? state.trim().toUpperCase() : null;

  let legislators: LegislatorRecord[];
  try { legislators = await loadLegislators(); }
  catch (e) {
    console.warn('[portrait] loadLegislators failed:', (e as Error).message);
    return null;
  }

  // Match by last name + (current term chamber + state when we have them)
  const matches = legislators.filter(L => {
    if (L.name.last.toLowerCase() !== lastName) return false;
    const lastTerm = L.terms[L.terms.length - 1];
    if (!lastTerm) return false;
    if (ch && lastTerm.type !== ch) return false;
    if (st && lastTerm.state !== st) return false;
    return true;
  });

  if (matches.length === 0) return null;
  // If multiple, prefer the one whose first name appears in the display name
  let pick = matches[0];
  if (matches.length > 1) {
    const lower = displayName.toLowerCase();
    const byFirst = matches.find(m => lower.includes(m.name.first.toLowerCase()));
    if (byFirst) pick = byFirst;
  }
  const lastTerm = pick.terms[pick.terms.length - 1];
  return { bioguideId: pick.id.bioguide, chamber: lastTerm.type };
}

// Back-compat thin wrapper
export async function findBioguideId(opts: {
  displayName?: string | null;
  chamber?: string | null;
  state?: string | null;
}): Promise<string | null> {
  const m = await findMember(opts);
  return m ? m.bioguideId : null;
}

export async function fetchMemberPortrait(
  bioguideId: string,
  chamber: 'sen' | 'rep',
): Promise<{ buffer: Buffer; mimeType: 'image/jpeg' } | null> {
  const url = chamber === 'sen' ? SENATE_PORTRAIT_URL(bioguideId) : HOUSE_PORTRAIT_URL(bioguideId);
  try {
    const r = await fetch(url, {
      // Some .gov hosts 403 on non-browser UAs.
      headers: { 'user-agent': 'Mozilla/5.0 SignalRidgeCRM/1.0' },
    });
    if (!r.ok) {
      console.warn('[portrait] fetch HTTP', r.status, 'from', url);
      return null;
    }
    const ab = await r.arrayBuffer();
    if (!ab.byteLength) return null;
    return { buffer: Buffer.from(ab), mimeType: 'image/jpeg' };
  } catch (e) {
    console.warn('[portrait] fetch threw:', (e as Error).message);
    return null;
  }
}
