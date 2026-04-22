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

function parseMarkdownToDocx(markdown: string): Paragraph[] {
  const paragraphs: Paragraph[] = [];
  const lines = markdown.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      paragraphs.push(new Paragraph({ spacing: { after: 100 } }));
      continue;
    }

    // H1
    if (trimmed.startsWith('# ') && !trimmed.startsWith('## ')) {
      paragraphs.push(new Paragraph({
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 200, after: 100 },
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
      paragraphs.push(new Paragraph({
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 300, after: 100 },
        border: { bottom: { style: BorderStyle.SINGLE, size: 1, color: '999999' } },
        children: [new TextRun({
          text: trimmed.replace(/^## /, ''),
          bold: true,
          size: 26,
          color: '333333',
          font: 'Calibri',
        })],
      }));
      continue;
    }

    // H3
    if (trimmed.startsWith('### ')) {
      paragraphs.push(new Paragraph({
        heading: HeadingLevel.HEADING_3,
        spacing: { before: 200, after: 80 },
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

export async function generateBriefingDocx(briefingMarkdown: string): Promise<Buffer> {
  // Try to get logo
  let logoImageRun: ImageRun | null = null;
  try {
    const settings = await prisma.crmSettings.findUnique({ where: { id: 'singleton' } });
    if (settings?.logoData && settings.logoMimeType) {
      const buffer = Buffer.from(settings.logoData, 'base64');
      logoImageRun = new ImageRun({
        data: buffer,
        transformation: { width: 200, height: 60 },
        type: settings.logoMimeType.includes('png') ? 'png' : 'jpg',
      });
    }
  } catch (err) {
    // Logo is optional
  }

  const headerParagraphs: Paragraph[] = [];

  // Logo at top
  if (logoImageRun) {
    headerParagraphs.push(new Paragraph({
      alignment: AlignmentType.LEFT,
      spacing: { after: 200 },
      children: [logoImageRun],
    }));
  }

  // Parse the markdown briefing into docx paragraphs
  const contentParagraphs = parseMarkdownToDocx(briefingMarkdown);

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
