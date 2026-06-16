import { PDFParse } from 'pdf-parse';

/**
 * Extract text from a PDF buffer.
 *
 * pdf-parse v2 is class-based — the old `require('pdf-parse')(buffer)` form no
 * longer works (the module now exports `{ PDFParse, ... }`, not a function).
 * This wraps the v2 API so callers don't have to care.
 */
export async function pdfBufferToText(buf: Buffer): Promise<string> {
  const parser = new PDFParse({ data: new Uint8Array(buf) });
  try {
    const result = await parser.getText();
    // pdf-parse v2 inserts "-- N of M --" page separators. Strip them so a
    // scanned/image-only PDF (no real text) comes back empty rather than as a
    // pile of page markers that would look like content downstream.
    return (result.text || '')
      .replace(/^\s*--\s*\d+\s*of\s*\d+\s*--\s*$/gm, '')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  } finally {
    try {
      await (parser as any).destroy?.();
    } catch {
      /* best effort */
    }
  }
}
