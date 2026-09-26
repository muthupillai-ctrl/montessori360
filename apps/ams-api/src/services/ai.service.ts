import Anthropic from '@anthropic-ai/sdk';
import { logger } from '../utils/logger.js';
import { logAmsUsage } from './sis-usage.js';

const client = new Anthropic({ apiKey: process.env['ANTHROPIC_API_KEY'] });

const MODEL = 'claude-opus-4-8';

export interface GenerateWorksheetInput {
  subject: string;
  grade_level: string;
  topic: string;
  activity_type?: string;
  difficulty?: 'easy' | 'medium' | 'hard';
  num_questions?: number;
  tenantSchema?: string;
}

export interface GenerateLessonPlanInput {
  subject: string;
  grade_level: string;
  topic: string;
  duration_minutes?: number;
  learning_objectives?: string;
  tenantSchema?: string;
}

export interface GenerateQuestionPaperInput {
  subject: string;
  grade_level: string;
  topic: string;
  total_marks?: number;
  difficulty_distribution?: string;
  question_types?: string[];
  tenantSchema?: string;
}

async function streamText(prompt: string, feature: string, tenantSchema?: string): Promise<string> {
  const stream = await client.messages.stream({
    model:      MODEL,
    max_tokens: 8000,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    thinking:   { type: 'adaptive' } as any,
    messages:   [{ role: 'user', content: prompt }],
  });
  const msg = await stream.finalMessage();

  if (tenantSchema) {
    logAmsUsage({
      tenantSchema,
      feature,
      model:        MODEL,
      inputTokens:  msg.usage.input_tokens,
      outputTokens: msg.usage.output_tokens,
    });
  }

  return msg.content
    .filter(b => b.type === 'text')
    .map(b => (b as Anthropic.TextBlock).text)
    .join('');
}

// Montessori wording only when the grade names a Montessori class; everything else
// (including regular LKG/UKG, which share the 'montessori' level value) gets a general teacher voice.
function isMontessori(gradeLevel: string): boolean {
  return /montessori|casa/i.test(gradeLevel);
}

export async function generateWorksheetHTML(input: GenerateWorksheetInput): Promise<string> {
  const montessori = isMontessori(input.grade_level);
  const prompt = `You are an experienced ${montessori ? 'Montessori educator' : 'teacher'}. Create a complete, print-ready worksheet in clean HTML.

Subject: ${input.subject}
Grade Level: ${input.grade_level}
Topic: ${input.topic}
${input.activity_type ? `Activity Type: ${input.activity_type}` : ''}
${input.difficulty ? `Difficulty: ${input.difficulty}` : ''}
${input.num_questions ? `Number of Questions/Activities: ${input.num_questions}` : 'Number of Questions/Activities: 10'}

Requirements:
- Output ONLY valid HTML (no markdown, no code blocks, no explanation outside the HTML)
- Include a title, instructions section, and the activity/question items
- Use semantic HTML: h1, h2, p, ol, ul, table where appropriate
- Include blank lines / answer spaces using <div class="answer-space" style="border-bottom:1px solid #ccc;height:32px;margin:8px 0"></div>
- Make it visually clear and child-friendly
- The HTML should be self-contained with minimal inline styles for print compatibility

Output the HTML document starting with <div class="worksheet"> and ending with </div>.`;

  logger.info(`AI: generating worksheet — ${input.subject} / ${input.topic}`);
  return streamText(prompt, 'ams_worksheet_generate', input.tenantSchema);
}

export async function generateLessonPlanHTML(input: GenerateLessonPlanInput): Promise<string> {
  const montessori = isMontessori(input.grade_level);
  const prompt = `You are an experienced ${montessori ? 'Montessori teacher' : 'teacher'}. Create a detailed, structured lesson plan in clean HTML.

Subject: ${input.subject}
Grade Level: ${input.grade_level}
Topic: ${input.topic}
${input.duration_minutes ? `Duration: ${input.duration_minutes} minutes` : 'Duration: 45 minutes'}
${input.learning_objectives ? `Learning Objectives: ${input.learning_objectives}` : ''}

Requirements:
- Output ONLY valid HTML (no markdown, no code blocks)
- Structure: Overview → Learning Objectives → Materials Needed → Introduction → Main Activity → ${montessori ? 'Practice / Work Cycle' : 'Guided & Independent Practice'} → Closure → Assessment → Extensions
- Use h2 for each section, ol/ul for lists, p for prose
${montessori
  ? '- Incorporate Montessori principles: hands-on learning, three-period lessons, freedom of choice, prepared environment\n'
  : '- Use active, age-appropriate teaching: hands-on activities, checks for understanding and differentiation for mixed abilities\n'}- Include time allocations for each phase

Output the HTML starting with <div class="lesson-plan"> and ending with </div>.`;

  logger.info(`AI: generating lesson plan — ${input.subject} / ${input.topic}`);
  return streamText(prompt, 'ams_lesson_plan_generate', input.tenantSchema);
}

export async function generateQuestionPaperHTML(input: GenerateQuestionPaperInput): Promise<string> {
  const questionTypes = input.question_types?.join(', ') || 'Multiple Choice, Short Answer, Long Answer';
  const prompt = `You are an experienced educator and examination expert. Create a complete question paper in clean HTML.

Subject: ${input.subject}
Grade Level: ${input.grade_level}
Topic: ${input.topic}
Total Marks: ${input.total_marks ?? 50}
Question Types: ${questionTypes}
${input.difficulty_distribution ? `Difficulty Distribution: ${input.difficulty_distribution}` : 'Difficulty: 40% easy, 40% medium, 20% hard'}

Requirements:
- Output ONLY valid HTML (no markdown, no code blocks)
- Include a header section with: School Name, Subject, Grade, Date, Total Marks, Time Allowed
- Organize into clearly labeled sections (Section A, B, C …) by question type
- Each question must show its marks in brackets, e.g. [2 marks]
- Include answer spaces: <div class="answer-space" style="border:1px solid #ccc;min-height:60px;margin:8px 0;padding:8px"></div>
- End with a scoring guide / marking scheme in a separate section
- Print-ready: professional, clear formatting

Output the HTML starting with <div class="question-paper"> and ending with </div>.`;

  logger.info(`AI: generating question paper — ${input.subject} / ${input.topic}`);
  return streamText(prompt, 'ams_question_paper_generate', input.tenantSchema);
}
