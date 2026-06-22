import Anthropic from '@anthropic-ai/sdk';
import { usageService } from './usage.service.js';

let _client: Anthropic | null = null;
function getClient(): Anthropic {
  if (!_client) _client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return _client;
}

export interface RemarkContext {
  student_name:  string;
  class_name?:   string;
  journal_date:  string;
  mood?:         string;
  mood_note?:    string;
  activities?:   Array<{ type: string; description: string; duration_mins?: number }>;
  existing_note?: string;
  tenantSchema?:  string;
}

const MODEL = 'claude-opus-4-8';

const SYSTEM_PROMPT = `You are a compassionate, professional early-childhood educator helping teachers write warm,
observational notes for parents. Your task is to compose a Teacher's Observation note for a child's daily journal.

Guidelines:
- Write in a warm, professional yet approachable tone suitable for parents
- Focus on specific observations, not generic statements
- Highlight growth, curiosity, and positive moments
- If there were challenges, frame them constructively
- Keep it between 3–5 sentences
- Do not mention the child's surname
- Do not start with "Today" — vary the opening
- Do not use emojis
- Write the note only — no preamble or explanation`;

class LanguageService {
  async generateRemark(ctx: RemarkContext): Promise<string> {
    const parts: string[] = [
      `Child: ${ctx.student_name}`,
      ctx.class_name  ? `Class: ${ctx.class_name}`    : '',
      `Date: ${ctx.journal_date}`,
      ctx.mood        ? `Mood: ${ctx.mood}${ctx.mood_note ? ` — ${ctx.mood_note}` : ''}`  : '',
    ].filter(Boolean);

    if (ctx.activities?.length) {
      const actList = ctx.activities.map(a => {
        const t = a.type.replace(/_/g, ' ');
        const dur = a.duration_mins ? ` (${a.duration_mins} min)` : '';
        return `  - ${t}${dur}: ${a.description}`;
      }).join('\n');
      parts.push(`Activities:\n${actList}`);
    }

    if (ctx.existing_note?.trim()) {
      parts.push(`Draft note to improve:\n${ctx.existing_note.trim()}`);
    }

    const userMessage = ctx.existing_note?.trim()
      ? `Improve this teacher's observation note using the context below:\n\n${parts.join('\n')}`
      : `Write a teacher's observation note using the context below:\n\n${parts.join('\n')}`;

    const message = await getClient().messages.create({
      model:   MODEL,
      max_tokens: 512,
      thinking: { type: 'adaptive' },
      system:  SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userMessage }],
    });

    const textBlock = message.content.find(b => b.type === 'text');
    if (!textBlock || textBlock.type !== 'text') {
      throw new Error('No text response from AI');
    }

    // Fire-and-forget usage log
    if (ctx.tenantSchema) {
      usageService.log({
        tenantSchema: ctx.tenantSchema,
        feature:      'remark_assist',
        model:        MODEL,
        inputTokens:  message.usage.input_tokens,
        outputTokens: message.usage.output_tokens,
      });
    }

    return textBlock.text.trim();
  }
}

export const languageService = new LanguageService();
