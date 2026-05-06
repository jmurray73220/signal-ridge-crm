import { Response } from 'express';
import Anthropic from '@anthropic-ai/sdk';
import prisma from '../services/prisma';
import { AuthRequest } from '../types';
import { extractTrackFromUrl } from './workflowController';

// Bubba: a Claude-powered chat surface for workflow operations. The user types
// natural language (e.g. "create a track for Acme from https://sam.gov/…")
// and Bubba runs the corresponding workflow tool. Each turn is stateless —
// the caller passes the prior message history back in.

type ChatMessage = {
  role: 'user' | 'assistant';
  content: string;
};

const SYSTEM_PROMPT = `You are an assistant for the Signal Ridge CRM workflow tool. You help the user manage workflow tracks for their clients.

When the user asks to create a track for a contract opportunity, call the create_workflow_track tool. The user typically pastes a URL (sam.gov, DSIP, grants.gov, an agency portal, etc.) — pass it through unchanged. Always identify the client by the name the user gives.

If the user just chats or asks questions, respond conversationally. Be concise — this is a sidebar chat in a busy app.`;

const TOOLS: Anthropic.Tool[] = [
  {
    name: 'create_workflow_track',
    description: 'Create a new workflow track for a client. Use when the user asks to create, start, or open a track. If a URL is provided, the track will be flagged as a contract opportunity and Claude will extract fields from the URL in the background.',
    input_schema: {
      type: 'object',
      properties: {
        clientName: {
          type: 'string',
          description: 'The client name as the user said it. Partial matches are OK — the server will look it up.',
        },
        title: {
          type: 'string',
          description: 'Title for the track. If the user did not say one, use a placeholder like "New opportunity" — the AI extraction will overwrite it from the URL.',
        },
        opportunityUrl: {
          type: 'string',
          description: 'URL to the opportunity announcement. Optional. If present, the track is created as a contract opportunity.',
        },
      },
      required: ['clientName', 'title'],
    },
  },
];

async function runCreateTrack(args: {
  clientName: string;
  title: string;
  opportunityUrl?: string;
}, userId: string | null): Promise<string> {
  // Look up the workflow client by name (case-insensitive contains).
  const candidates = await prisma.workflowClient.findMany({
    where: { name: { contains: args.clientName, mode: 'insensitive' } },
    take: 5,
  });
  if (candidates.length === 0) {
    return `No workflow client matches "${args.clientName}". Please check the client name (case insensitive contains).`;
  }
  if (candidates.length > 1) {
    const names = candidates.map(c => c.name).join(', ');
    return `Multiple clients match "${args.clientName}": ${names}. Please be more specific.`;
  }
  const client = candidates[0];
  const isOpp = Boolean(args.opportunityUrl);

  const track = await prisma.workflowTrack.create({
    data: {
      workflowClientId: client.id,
      title: args.title,
      isContractOpportunity: isOpp,
      opportunityUrl: isOpp ? args.opportunityUrl!.trim() : null,
      aiExtractionStatus: isOpp ? 'pending' : null,
    },
  });

  if (isOpp) {
    const OPP_PHASES = [
      'Capture & Triage',
      'Pre-proposal',
      'Proposal Development',
      'Compliance & Submission',
      'Post-submission',
      'Award Decision',
    ];
    await prisma.workflowPhase.createMany({
      data: OPP_PHASES.map((title, i) => ({ trackId: track.id, title, sortOrder: i })),
    });
    extractTrackFromUrl(track.id, args.opportunityUrl!.trim()).catch(err => {
      console.error('[bubba.createTrack] background extraction failed:', err);
    });
  }

  // The mention pattern client side knows to render this as a link.
  void userId;
  return isOpp
    ? `Created opportunity track for ${client.name}. Reading the URL now — fields will fill in shortly.\n[track:${track.id}]`
    : `Created track "${args.title}" for ${client.name}.\n[track:${track.id}]`;
}

export async function bubbaChat(req: AuthRequest, res: Response) {
  const { messages } = req.body as { messages: ChatMessage[] };
  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'messages[] required' });
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(500).json({ error: 'Anthropic API key not configured' });
  }

  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    // Run a tool-use loop: keep calling Claude until it stops asking for
    // tools. Cap the loop at 4 turns so a malformed run can't burn budget.
    const apiMessages: Anthropic.MessageParam[] = messages.map(m => ({
      role: m.role,
      content: m.content,
    }));

    let finalText = '';
    for (let turn = 0; turn < 4; turn++) {
      const response = await client.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1500,
        system: SYSTEM_PROMPT,
        tools: TOOLS,
        messages: apiMessages,
      });

      if (response.stop_reason !== 'tool_use') {
        finalText = response.content
          .filter(b => b.type === 'text')
          .map(b => (b as any).text)
          .join('\n')
          .trim();
        break;
      }

      // Append the assistant message (with the tool_use blocks) and the
      // tool_result blocks so Claude can continue the conversation.
      apiMessages.push({ role: 'assistant', content: response.content });
      const toolResults: any[] = [];
      for (const block of response.content) {
        if (block.type !== 'tool_use') continue;
        try {
          let result = '';
          if (block.name === 'create_workflow_track') {
            result = await runCreateTrack(block.input as any, req.user?.userId || null);
          } else {
            result = `Unknown tool: ${block.name}`;
          }
          toolResults.push({ type: 'tool_result', tool_use_id: block.id, content: result });
        } catch (err: any) {
          toolResults.push({
            type: 'tool_result',
            tool_use_id: block.id,
            content: `Error: ${err.message || 'tool failed'}`,
            is_error: true,
          });
        }
      }
      apiMessages.push({ role: 'user', content: toolResults });
    }

    return res.json({ reply: finalText || 'Done.' });
  } catch (err: any) {
    console.error('[bubbaChat]', err);
    return res.status(500).json({ error: err.message || 'Bubba is unavailable' });
  }
}
