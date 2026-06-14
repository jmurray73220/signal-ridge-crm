import Anthropic from '@anthropic-ai/sdk';

/**
 * Bio formatting.
 *
 * Contacts' `bio` field is most often a raw copy/paste of a LinkedIn profile —
 * an unstructured dump of roles, dates, and boilerplate. This service turns
 * that into a clean, readable bio: a short narrative summary followed by a
 * one-line-per-role Experience list (and Education when present).
 *
 * Output is PLAIN TEXT with real line breaks (no markdown symbols) so it renders
 * directly in the contact card. Each role is emitted as a line starting with a
 * "• " bullet — a marker that a raw LinkedIn paste never contains (LinkedIn uses
 * the "·" middot inline, not a leading bullet). We use that bullet to detect an
 * already-formatted bio (see `looksFormatted`) so we never reprocess one. We
 * deliberately do NOT key off the "Experience" heading: LinkedIn pastes carry
 * their own "Experience" section label, so that would skip real pastes.
 */

const SYSTEM_PROMPT = `You format raw LinkedIn profile text into a clean professional bio for a government-relations CRM.

Output PLAIN TEXT only — no markdown symbols (no #, *, _, backticks). Use this exact structure:

1. A narrative summary paragraph (2-4 sentences, third person, professional tone) describing who the person is, their current role, and their focus areas.
2. A blank line.
3. The word Experience on its own line (no punctuation).
4. One bullet per role, each on its own line, formatted EXACTLY: "• {Title} — {Organization} ({start}–{end})". Use a spaced em dash " — " between the title and the organization, and put the date range in parentheses at the end. Most recent role first. Preserve dates exactly as written in the input. One role per line — never prose.
5. If education is present: a blank line, then the word Education on its own line, then one bullet per entry: "• {Degree} — {School} ({year})".

Rules:
- Use ONLY information present in the input. Never invent roles, dates, employers, or facts.
- Omit a section entirely if its data isn't present (e.g. no Education line if there's no schooling).
- Keep the "•" bullet character and the " — " separator exactly.
- Do not include a role's responsibility/description sentences in the bullet — title, organization, and dates only.
- If the input is already a clean prose bio rather than a raw LinkedIn dump, lightly clean it and return the narrative; add an Experience list only if distinct roles are clearly present.
- Return ONLY the bio text — no preamble, no commentary, no closing remarks.`;

/**
 * True when `text` already looks like one of our formatted bios, i.e. it has at
 * least one line starting with our "• " role bullet. We use this to skip
 * reprocessing. (We don't key off the "Experience" heading — raw LinkedIn
 * pastes have their own, so that would misclassify real pastes as formatted.)
 */
export function looksFormatted(text: string | null | undefined): boolean {
  if (!text) return false;
  return /^[ \t]*•[ \t]/m.test(text);
}

/**
 * Whether a bio value is worth running through the formatter. We skip empties,
 * already-formatted bios, and trivially short notes (a one-line "met at NDIA"
 * isn't a profile to structure).
 */
export function shouldFormat(text: string | null | undefined): boolean {
  if (!text) return false;
  const trimmed = text.trim();
  if (trimmed.length < 40) return false;
  if (looksFormatted(trimmed)) return false;
  return true;
}

/**
 * Format raw bio/LinkedIn text into a narrative + structured Experience list.
 * Returns the formatted plain-text bio. Throws on API failure — callers should
 * decide whether to fall back to the raw text.
 */
export async function formatBio(rawText: string): Promise<string> {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const message = await client.messages.create({
    model: 'claude-opus-4-8',
    max_tokens: 1500,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: `Format this bio:\n\n${rawText}` }],
  });

  const out = (message.content[0] as any)?.text;
  if (typeof out !== 'string' || !out.trim()) {
    throw new Error('Empty formatting result');
  }
  return out.trim();
}

/**
 * Convenience wrapper for the save path: format when worthwhile, otherwise
 * return the original text. Never throws — on API failure it logs and returns
 * the raw text so a contact save is never blocked by the formatter.
 */
export async function formatBioSafe(rawText: string | null | undefined): Promise<string | null | undefined> {
  if (!shouldFormat(rawText)) return rawText;
  try {
    return await formatBio(rawText as string);
  } catch (err) {
    console.warn('[bioFormat] formatting failed, keeping raw bio:', (err as Error).message);
    return rawText;
  }
}
