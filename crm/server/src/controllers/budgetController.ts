import { Response } from 'express';
import prisma from '../services/prisma';
import Anthropic from '@anthropic-ai/sdk';
import * as pdfParseModule from 'pdf-parse';
const pdfParse = (pdfParseModule as any).default || pdfParseModule;
import { AuthRequest } from '../types';

// ─── Document Library ────────────────────────────────────────────────────────

export async function uploadDocument(req: AuthRequest, res: Response) {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'PDF file required' });
    }

    const name = req.body.name || req.file.originalname.replace(/\.pdf$/i, '');
    const pdfData = await pdfParse(req.file.buffer);
    const extractedText = pdfData.text;

    if (!extractedText || extractedText.trim().length < 50) {
      return res.status(400).json({ error: 'Could not extract meaningful text from PDF' });
    }

    // Use Claude to auto-detect metadata
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const metadataResponse = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 512,
      system: 'You are a document classifier. Analyze the text and return ONLY valid JSON with these fields: documentType (one of: "J-Book", "NDAA", "Appropriations Bill", "Joint Explanatory Statement", "Report Language", "Committee Markup", "Reconciliation Bill", "Other"), fiscalYear (e.g. "FY2026" or "FY2025"), serviceBranch (one of: "Army", "Navy", "Air Force", "Space Force", "Defense-Wide", "Joint Staff", "Congress", "Marine Corps", "Multiple", "Other"). Return only the JSON object, no markdown or explanation.',
      messages: [{
        role: 'user',
        content: `Classify this document based on the first 3000 characters:\n\n${extractedText.substring(0, 3000)}`,
      }],
    });

    let metadata = { documentType: 'Other', fiscalYear: 'Unknown', serviceBranch: 'Other' };
    try {
      const text = (metadataResponse.content[0] as any).text;
      metadata = JSON.parse(text);
    } catch {
      // Use defaults if Claude response can't be parsed
    }

    const doc = await prisma.budgetDocument.create({
      data: {
        name,
        documentType: metadata.documentType || 'Other',
        fiscalYear: metadata.fiscalYear || 'Unknown',
        serviceBranch: metadata.serviceBranch || 'Other',
        extractedText,
      },
    });

    return res.status(201).json({
      id: doc.id,
      name: doc.name,
      documentType: doc.documentType,
      fiscalYear: doc.fiscalYear,
      serviceBranch: doc.serviceBranch,
      createdAt: doc.createdAt,
    });
  } catch (err) {
    console.error('Upload document error:', err);
    return res.status(500).json({ error: 'Failed to process document' });
  }
}

export async function listDocuments(req: AuthRequest, res: Response) {
  try {
    const docs = await prisma.budgetDocument.findMany({
      select: {
        id: true,
        name: true,
        documentType: true,
        fiscalYear: true,
        serviceBranch: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
    return res.json(docs);
  } catch (err) {
    return res.status(500).json({ error: 'Server error' });
  }
}

export async function deleteDocument(req: AuthRequest, res: Response) {
  const { id } = req.params;
  try {
    await prisma.budgetDocument.delete({ where: { id } });
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to delete document' });
  }
}

// ─── Chat ────────────────────────────────────────────────────────────────────

export async function chatWithDocument(req: AuthRequest, res: Response) {
  const { id } = req.params;
  const { message, conversationHistory, companyId } = req.body;

  if (!message) {
    return res.status(400).json({ error: 'Message required' });
  }

  try {
    const doc = await prisma.budgetDocument.findUnique({ where: { id } });
    if (!doc) return res.status(404).json({ error: 'Document not found' });

    // Fetch client/company context if provided
    let companyContext = '';
    if (companyId) {
      const company = await prisma.entity.findUnique({ where: { id: companyId } });
      if (company) {
        companyContext = `\n\nYou are analyzing this document on behalf of the following client:\nClient: ${company.name}\nCapabilities: ${company.capabilityDescription || company.description || 'No description provided'}\n\nFocus your analysis on identifying opportunities, program elements, funding lines, and provisions that are relevant to this client's capabilities. Proactively highlight matches between the document content and the client's strengths.`;
      }
    }

    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const messages = [
      ...(conversationHistory || []),
      { role: 'user' as const, content: message },
    ];

    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      system: `You are a defense acquisition intelligence analyst at Signal Ridge Strategies. You have been given a government budget document to analyze. Answer questions about this document thoroughly, citing specific program elements, dollar amounts, section numbers, and other details from the text.

Document: "${doc.name}" (${doc.documentType}, ${doc.fiscalYear}, ${doc.serviceBranch})${companyContext}

Full document text:
${doc.extractedText}`,
      messages,
    });

    const assistantMessage = (response.content[0] as any).text;
    return res.json({ response: assistantMessage });
  } catch (err) {
    console.error('Chat error:', err);
    return res.status(500).json({ error: 'Failed to get response' });
  }
}

// ─── Report Generation ───────────────────────────────────────────────────────

const REPORT_SYSTEM_PROMPT = `You are a defense acquisition intelligence analyst. You have been given a government document (which may be a budget justification book, NDAA, appropriations bill, reconciliation bill, joint explanatory statement, report language, or similar) and a company profile. Your job is to read the entire document thoroughly and produce a comprehensive intelligence report tailored to this specific company.

Identify EVERY program element, funding line, policy provision, statutory section, or budget item that is a definite or potential fit for this company's capabilities. Err strongly on the side of inclusion — if there is any reasonable connection, include it. Do not filter aggressively.

Structure your report exactly as follows:

1. Title — descriptive, specific to the document and company
2. Executive Overview — a strategic narrative explaining the landscape this document creates for the company, and a summary of the top opportunities identified
3. One section per relevant program element or provision, each containing: a header with the PE number or section number, name, color of money (if applicable), and branch or committee; a narrative overview paragraph; numbered Key Findings in bold subheadings explaining specifically why this line is relevant to the company; and numbered Strategic Recommendations in bold subheadings with a specific Action and a specific Pitch for each
4. Appendix — full text of any statutory provisions or report language cited in the body of the report

Write in a professional defense acquisition intelligence tone — confident, specific, and action-oriented. Reference actual dollar figures, section numbers, and program names from the document. Do not generalize.`;

export async function generateReport(req: AuthRequest, res: Response) {
  const { documentId, documentIds, companyId, reportTemplateId } = req.body;

  if (!companyId) {
    return res.status(400).json({ error: 'Company ID required' });
  }

  const docIds = documentIds || (documentId ? [documentId] : []);
  if (docIds.length === 0) {
    return res.status(400).json({ error: 'At least one document ID required' });
  }

  try {
    // Fetch company
    const company = await prisma.entity.findUnique({ where: { id: companyId } });
    if (!company) return res.status(404).json({ error: 'Company not found' });

    // Fetch documents
    const docs = await prisma.budgetDocument.findMany({
      where: { id: { in: docIds } },
    });
    if (docs.length === 0) return res.status(404).json({ error: 'Documents not found' });

    // Fetch template if provided
    let template: any = null;
    if (reportTemplateId) {
      template = await prisma.reportTemplate.findUnique({ where: { id: reportTemplateId } });
    }

    const documentContext = docs.map(d =>
      `Document: "${d.name}" (${d.documentType}, ${d.fiscalYear}, ${d.serviceBranch})\n\nFull text:\n${d.extractedText}`
    ).join('\n\n---\n\n');

    const companyProfile = `${company.name} — ${company.capabilityDescription || company.description || 'No capability description provided.'}`;

    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 8192,
      system: REPORT_SYSTEM_PROMPT,
      messages: [{
        role: 'user',
        content: `The company profile is: ${companyProfile}\n\nAnalyze the following document(s) and produce the intelligence report:\n\n${documentContext}`,
      }],
    });

    const reportContent = (response.content[0] as any).text;

    // If a template is provided, inject into .docx via python-docx
    if (template) {
      try {
        const result = await injectIntoDocxTemplate(template.fileData, reportContent, company.name);
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
        res.setHeader('Content-Disposition', `attachment; filename="Budget_Report_${company.name.replace(/[^a-zA-Z0-9]/g, '_')}.docx"`);
        return res.send(result);
      } catch (templateErr) {
        console.error('Template injection failed, returning markdown:', templateErr);
        // Fall through to return markdown
      }
    }

    // Return as markdown if no template or template injection failed
    return res.json({ report: reportContent });
  } catch (err) {
    console.error('Report generation error:', err);
    return res.status(500).json({ error: 'Failed to generate report' });
  }
}

async function injectIntoDocxTemplate(base64FileData: string, reportContent: string, companyName: string): Promise<Buffer> {
  const { execSync } = require('child_process');
  const fs = require('fs');
  const path = require('path');
  const os = require('os');

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'srs-report-'));
  const templatePath = path.join(tmpDir, 'template.docx');
  const contentPath = path.join(tmpDir, 'content.txt');
  const outputPath = path.join(tmpDir, 'output.docx');
  const scriptPath = path.join(__dirname, '..', 'scripts', 'inject_report.py');

  try {
    fs.writeFileSync(templatePath, Buffer.from(base64FileData, 'base64'));
    fs.writeFileSync(contentPath, reportContent, 'utf-8');

    execSync(`python "${scriptPath}" "${templatePath}" "${contentPath}" "${outputPath}"`, {
      timeout: 30000,
      stdio: 'pipe',
    });

    const output = fs.readFileSync(outputPath);
    return output;
  } finally {
    // Cleanup
    try { fs.rmSync(tmpDir, { recursive: true }); } catch {}
  }
}

// ─── Budget Links ────────────────────────────────────────────────────────────

export async function createBudgetLink(req: AuthRequest, res: Response) {
  const { conversationId, entityType, entityId, note } = req.body;

  if (!conversationId || !entityType || !entityId) {
    return res.status(400).json({ error: 'conversationId, entityType, and entityId required' });
  }

  try {
    const link = await prisma.budgetLink.create({
      data: {
        budgetConversationId: conversationId,
        entityType,
        entityId,
        note: note || null,
      },
    });
    return res.status(201).json(link);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to create link' });
  }
}

// ─── Conversations ───────────────────────────────────────────────────────────

export async function createConversation(req: AuthRequest, res: Response) {
  const { budgetDocumentId, messages } = req.body;

  if (!budgetDocumentId) {
    return res.status(400).json({ error: 'budgetDocumentId required' });
  }

  try {
    const convo = await prisma.budgetConversation.create({
      data: {
        budgetDocumentId,
        messages: JSON.stringify(messages || []),
      },
    });
    return res.status(201).json({ ...convo, messages: JSON.parse(convo.messages) });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to create conversation' });
  }
}

export async function updateConversation(req: AuthRequest, res: Response) {
  const { id } = req.params;
  const { messages } = req.body;

  try {
    const convo = await prisma.budgetConversation.update({
      where: { id },
      data: { messages: JSON.stringify(messages || []) },
    });
    return res.json({ ...convo, messages: JSON.parse(convo.messages) });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to update conversation' });
  }
}

export async function getConversations(req: AuthRequest, res: Response) {
  const { documentId } = req.query;

  try {
    const convos = await prisma.budgetConversation.findMany({
      where: documentId ? { budgetDocumentId: documentId as string } : {},
      include: { links: true },
      orderBy: { createdAt: 'desc' },
    });
    return res.json(convos.map(c => ({ ...c, messages: JSON.parse(c.messages) })));
  } catch (err) {
    return res.status(500).json({ error: 'Server error' });
  }
}
