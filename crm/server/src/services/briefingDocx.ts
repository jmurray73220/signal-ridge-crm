import {
  Document, Packer, Paragraph, TextRun, HeadingLevel,
  AlignmentType, BorderStyle, ImageRun, Table, TableRow, TableCell,
  WidthType, ShadingType,
} from 'docx';
import prisma from './prisma';

interface BriefingData {
  officeName: string;
  position: string;
  meetingDate: string;
  meetingTime: string;
  meetingLocation: string;
  stafferName: string;
  stafferTitle: string;
  briefingMarkdown: string;
}

// Inline image-size reader so we don't pull in a dependency just for the logo.
// Returns null if format unrecognized so we fall back to default box.
function readImageDimensions(buf: Buffer, mimeType: string): { width: number; height: number } | null {
  if (mimeType.includes('png')) {
    if (buf.length < 24 || buf.readUInt32BE(0) !== 0x89504e47) return null;
    return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
  }
  if (mimeType.includes('jp')) {
    // JPG: walk segment markers until we hit a Start-Of-Frame (SOF0–SOF3)
    if (buf.length < 4 || buf.readUInt16BE(0) !== 0xffd8) return null;
    let off = 2;
    while (off + 9 < buf.length) {
      if (buf[off] !== 0xff) return null;
      const marker = buf[off + 1];
      if (marker >= 0xc0 && marker <= 0xc3) {
        return { height: buf.readUInt16BE(off + 5), width: buf.readUInt16BE(off + 7) };
      }
      const segLen = buf.readUInt16BE(off + 2);
      off += 2 + segLen;
    }
    return null;
  }
  return null;
}

function fitInside(
  dims: { width: number; height: number } | null,
  box: { maxW: number; maxH: number }
): { width: number; height: number } {
  if (!dims || dims.width <= 0 || dims.height <= 0) {
    return { width: box.maxW, height: box.maxH };
  }
  const aspect = dims.width / dims.height;
  if (aspect >= box.maxW / box.maxH) {
    return { width: box.maxW, height: Math.max(1, Math.round(box.maxW / aspect)) };
  }
  return { width: Math.max(1, Math.round(box.maxH * aspect)), height: box.maxH };
}

function parseMarkdownToDocx(
  markdown: string,
  opts?: { portraitParagraph?: Paragraph | null }
): Paragraph[] {
  const paragraphs: Paragraph[] = [];
  const lines = markdown.split('\n');
  let bioPortraitInserted = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      // Skip blank lines entirely — paragraph spacing already provides breathing room
      continue;
    }

    // H1
    if (trimmed.startsWith('# ') && !trimmed.startsWith('## ')) {
      paragraphs.push(new Paragraph({
        heading: HeadingLevel.HEADING_1,
        alignment: AlignmentType.CENTER,
        spacing: { before: 100, after: 60 },
        children: [new TextRun({
          text: trimmed.replace(/^# /, ''),
          bold: true,
          size: 32,
          font: 'Calibri',
        })],
      }));
      continue;
    }

    // H2
    if (trimmed.startsWith('## ')) {
      const headingText = trimmed.replace(/^## /, '');
      paragraphs.push(new Paragraph({
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 320, after: 80 },
        border: { bottom: { style: BorderStyle.SINGLE, size: 1, color: '999999' } },
        children: [new TextRun({
          text: headingText,
          bold: true,
          size: 26,
          color: '333333',
          font: 'Calibri',
        })],
      }));
      // When the Bio section opens, drop the member portrait in just below.
      if (!bioPortraitInserted && /^bio\b/i.test(headingText) && opts?.portraitParagraph) {
        paragraphs.push(opts.portraitParagraph);
        bioPortraitInserted = true;
      }
      continue;
    }

    // H3
    if (trimmed.startsWith('### ')) {
      paragraphs.push(new Paragraph({
        heading: HeadingLevel.HEADING_3,
        spacing: { before: 120, after: 40 },
        children: [new TextRun({
          text: trimmed.replace(/^### /, ''),
          bold: true,
          size: 22,
          font: 'Calibri',
        })],
      }));
      continue;
    }

    // Bullet
    if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      const text = trimmed.replace(/^[-*] /, '');
      paragraphs.push(new Paragraph({
        bullet: { level: 0 },
        spacing: { after: 60 },
        children: parseInlineFormatting(text),
      }));
      continue;
    }

    // Bold-only line (like **Position:** value)
    if (trimmed.startsWith('**') && trimmed.includes(':**')) {
      const match = trimmed.match(/^\*\*(.+?):\*\*\s*(.*)$/);
      if (match) {
        paragraphs.push(new Paragraph({
          spacing: { after: 60 },
          children: [
            new TextRun({ text: `${match[1]}: `, bold: true, size: 22, font: 'Calibri' }),
            new TextRun({ text: match[2], size: 22, font: 'Calibri' }),
          ],
        }));
        continue;
      }
    }

    // Regular paragraph
    paragraphs.push(new Paragraph({
      spacing: { after: 120 },
      children: parseInlineFormatting(trimmed),
    }));
  }

  return paragraphs;
}

function parseInlineFormatting(text: string): TextRun[] {
  const runs: TextRun[] = [];
  // Simple bold parsing: **text**
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  for (const part of parts) {
    if (part.startsWith('**') && part.endsWith('**')) {
      runs.push(new TextRun({
        text: part.slice(2, -2),
        bold: true,
        size: 22,
        font: 'Calibri',
      }));
    } else if (part) {
      runs.push(new TextRun({
        text: part,
        size: 22,
        font: 'Calibri',
      }));
    }
  }
  return runs;
}

export async function generateBriefingDocx(
  briefingMarkdown: string,
  opts?: { memberPortrait?: { buffer: Buffer; mimeType: string } | null }
): Promise<Buffer> {
  // Try to get logo
  let logoImageRun: ImageRun | null = null;
  try {
    const settings = await prisma.crmSettings.findUnique({ where: { id: 'singleton' } });
    if (settings?.logoData && settings.logoMimeType) {
      const buffer = Buffer.from(settings.logoData, 'base64');
      const dims = readImageDimensions(buffer, settings.logoMimeType);
      const { width, height } = fitInside(dims, { maxW: 360, maxH: 140 });
      logoImageRun = new ImageRun({
        data: buffer,
        transformation: { width, height },
        type: settings.logoMimeType.includes('png') ? 'png' : 'jpg',
      });
    }
  } catch (err) {
    // Logo is optional
  }

  const headerParagraphs: Paragraph[] = [];

  // Logo centered at top of the page
  if (logoImageRun) {
    headerParagraphs.push(new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 },
      children: [logoImageRun],
    }));
  }

  // Build the member-portrait paragraph if we have one. Sized to fit a Bio
  // section at ~180px tall with aspect ratio preserved and centered.
  let portraitParagraph: Paragraph | null = null;
  if (opts?.memberPortrait?.buffer && opts.memberPortrait.buffer.length) {
    const dims = readImageDimensions(opts.memberPortrait.buffer, opts.memberPortrait.mimeType);
    const { width, height } = fitInside(dims, { maxW: 180, maxH: 220 });
    const portraitRun = new ImageRun({
      data: opts.memberPortrait.buffer,
      transformation: { width, height },
      type: opts.memberPortrait.mimeType.includes('png') ? 'png' : 'jpg',
    });
    portraitParagraph = new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 80, after: 200 },
      children: [portraitRun],
    });
  }

  // Parse the markdown briefing into docx paragraphs (portrait drops in
  // immediately under the ## Bio heading)
  const contentParagraphs = parseMarkdownToDocx(briefingMarkdown, { portraitParagraph });

  const doc = new Document({
    styles: {
      default: {
        document: {
          run: { font: 'Calibri', size: 22 },
        },
      },
    },
    sections: [{
      properties: {
        page: {
          margin: { top: 1440, bottom: 1440, left: 1440, right: 1440 },
        },
      },
      children: [...headerParagraphs, ...contentParagraphs],
    }],
  });

  return Buffer.from(await Packer.toBuffer(doc));
}
