/**
 * Renders a contact bio. Bios produced by the server's bio formatter follow a
 * known plain-text shape:
 *
 *   <narrative summary paragraph>
 *
 *   Experience
 *   • {Title} — {Organization} ({dates})
 *   • ...
 *
 *   Education
 *   • {Degree} — {School} ({year})
 *
 * We parse that into styled sections (summary + Experience/Education lists). Any
 * bio that doesn't match (e.g. an older raw LinkedIn paste not yet backfilled)
 * falls back to plain pre-wrapped text so nothing is ever lost.
 */

interface Entry {
  title: string;
  org: string;
  dates: string;
}

interface ParsedBio {
  summary: string;
  sections: { label: string; entries: Entry[] }[];
}

const SECTION_RE = /^(experience|education)$/i;

function parseEntry(line: string): Entry {
  // Strip the leading bullet.
  let text = line.replace(/^[ \t]*•[ \t]*/, '').trim();

  // Pull a trailing "(dates)" group off the end if present.
  let dates = '';
  const dateMatch = text.match(/\s*\(([^)]*)\)\s*$/);
  if (dateMatch) {
    dates = dateMatch[1].trim();
    text = text.slice(0, dateMatch.index).trim();
  }

  // Split title / org. Prefer the explicit " — " separator the formatter emits;
  // fall back to the last comma for older/looser output.
  let title = text;
  let org = '';
  const dash = text.split(/\s+—\s+/);
  if (dash.length >= 2) {
    title = dash[0].trim();
    org = dash.slice(1).join(' — ').trim();
  } else {
    const lastComma = text.lastIndexOf(', ');
    if (lastComma !== -1) {
      title = text.slice(0, lastComma).trim();
      org = text.slice(lastComma + 2).trim();
    }
  }

  return { title, org, dates };
}

function parseBio(bio: string): ParsedBio | null {
  const lines = bio.replace(/\r\n/g, '\n').split('\n');

  const summaryLines: string[] = [];
  const sections: { label: string; entries: Entry[] }[] = [];
  let current: { label: string; entries: Entry[] } | null = null;
  let seenSection = false;

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;

    if (SECTION_RE.test(line)) {
      seenSection = true;
      current = { label: line, entries: [] };
      sections.push(current);
      continue;
    }

    if (line.startsWith('•')) {
      if (current) current.entries.push(parseEntry(line));
      continue;
    }

    // Non-bullet, non-heading text before any section is the summary.
    if (!seenSection) summaryLines.push(line);
  }

  const hasEntries = sections.some(s => s.entries.length > 0);
  if (!hasEntries) return null; // Not our structured format — caller falls back.

  return { summary: summaryLines.join(' ').trim(), sections };
}

export function BioCard({ bio }: { bio: string }) {
  const parsed = parseBio(bio);

  // Fallback: not a structured bio (e.g. a raw LinkedIn paste). Show as-is.
  if (!parsed) {
    return (
      <p className="mt-4 text-sm leading-relaxed" style={{ color: '#8b949e', whiteSpace: 'pre-wrap' }}>
        {bio}
      </p>
    );
  }

  return (
    <div className="mt-4">
      {parsed.summary && (
        <p className="text-sm leading-relaxed" style={{ color: '#c9d1d9' }}>
          {parsed.summary}
        </p>
      )}

      {parsed.sections.map(section => (
        section.entries.length > 0 && (
          <div key={section.label} className="mt-5">
            <div className="text-xs uppercase tracking-wider mb-2.5" style={{ color: '#8b949e' }}>
              {section.label}
            </div>
            <div className="flex flex-col gap-3">
              {section.entries.map((e, i) => (
                <div key={i} className="pl-3" style={{ borderLeft: '2px solid #30363d' }}>
                  <div className="text-sm font-medium" style={{ color: '#e6edf3' }}>
                    {e.title}
                  </div>
                  {(e.org || e.dates) && (
                    <div className="text-xs mt-0.5" style={{ color: '#8b949e' }}>
                      {[e.org, e.dates].filter(Boolean).join(' · ')}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )
      ))}
    </div>
  );
}
