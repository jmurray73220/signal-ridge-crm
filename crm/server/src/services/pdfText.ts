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
    return (result.text || '').trim();
  } finally {
    try {
      await (parser as any).destroy?.();
    } catch {
      /* best effort */
    }
  }
}
