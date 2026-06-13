import PDFDocument from 'pdfkit';
import { tenantQuery } from '../../config/database.js';
import { observationsService } from '../observations/observations.service.js';
import { templateService } from './template.service.js';
import type { ReportTemplateRow, SectionKey } from './template.types.js';
import type { Readable } from 'stream';

// ── Font mapping ──────────────────────────────────────────────────────────────
function fonts(font: string) {
  const map: Record<string, { regular: string; bold: string; italic: string }> = {
    helvetica: { regular: 'Helvetica',        bold: 'Helvetica-Bold',        italic: 'Helvetica-Oblique' },
    times:     { regular: 'Times-Roman',      bold: 'Times-Bold',            italic: 'Times-Italic' },
    courier:   { regular: 'Courier',          bold: 'Courier-Bold',          italic: 'Courier-Oblique' },
  };
  return map[font] ?? map['helvetica'];
}

// ── Grade helpers ─────────────────────────────────────────────────────────────
function gradeLabel(grade: string | null): string {
  switch (grade) {
    case 'mastered':    return 'Mastered';
    case 'led':         return 'Led';
    case 'in_progress': return 'In Progress';
    case 'not_started': return 'Not Started';
    default:            return 'Not Observed';
  }
}

function gradeColour(grade: string | null, accent: string): string {
  switch (grade) {
    case 'mastered':    return '#27AE60';
    case 'led':         return '#2E5AA8';
    case 'in_progress': return '#F39C12';
    case 'not_started': return '#E74C3C';
    default:            return '#999999';
  }
}

// ── Section renderer map ──────────────────────────────────────────────────────

type SectionRenderer = (ctx: RenderContext) => void;

interface RenderContext {
  doc:       PDFKit.PDFDocument;
  template:  ReportTemplateRow;
  font:      ReturnType<typeof fonts>;
  student:   any;
  attendance: any;
  progress:  any[];
  moods:     any[];
  journal:   any;
  homework:  any[];
  term:      string;
  from:      string;
  to:        string;
  y:         number;
  L:         number;
  R:         number;
  W:         number;
  pageH:     number;
  setY:      (v: number) => void;
  checkPage: (needed: number) => void;
}

// ── Main generator ────────────────────────────────────────────────────────────

export async function generateProgressCard(
  schema:    string,
  studentId: string,
  term:      string,
  from:      string,
  to:        string,
): Promise<Readable> {

  // ── Fetch student + class
  const [student] = await tenantQuery<any>(
    schema,
    `SELECT s.*,
            CONCAT(s.first_name, ' ', s.last_name)   AS full_name,
            c.name                                    AS class_name,
            c.id                                      AS class_id,
            CONCAT(st.first_name, ' ', st.last_name)  AS teacher_name
     FROM   ${schema}.students s
     LEFT JOIN ${schema}.classes c  ON c.id  = s.class_id
     LEFT JOIN ${schema}.staff st   ON st.id = c.teacher_id
     WHERE  s.id = $1`,
    [studentId]
  );
  if (!student) throw new Error('Student not found');

  // ── Resolve template (class-specific or school default)
  const template = student.class_id
    ? await templateService.getForClass(schema, student.class_id)
    : { id: 'builtin', name: 'Default', logo_url: null,
        primary_colour: '#1F3864', secondary_colour: '#2E5AA8',
        accent_colour: '#D6E4F0', font: 'helvetica',
        sections: [], is_default: true, is_active: true,
        description: null, created_by: null,
        created_at: new Date(), updated_at: new Date() } as ReportTemplateRow;

  const P  = template.primary_colour;
  const S  = template.secondary_colour;
  const AC = template.accent_colour;
  const F  = fonts(template.font);
  const WHITE = '#FFFFFF';
  const BODY  = '#333333';
  const LGREY = '#F5F7FA';

  // ── Fetch data
  const [attendance] = await tenantQuery<any>(
    schema,
    `SELECT COUNT(*)                                           AS total_days,
            COUNT(*) FILTER (WHERE status='present')          AS present,
            COUNT(*) FILTER (WHERE status='absent')           AS absent,
            COUNT(*) FILTER (WHERE status='late')             AS late,
            ROUND(COUNT(*) FILTER (WHERE status IN ('present','late'))
              * 100.0 / NULLIF(COUNT(*),0), 1)                AS percentage
     FROM ${schema}.attendance
     WHERE student_id=$1 AND date BETWEEN $2 AND $3`,
    [studentId, from, to]
  );

  const progress = await observationsService.getStudentProgress(schema, studentId);

  const moods = await tenantQuery<any>(
    schema,
    `SELECT mood, COUNT(*)::int AS count
     FROM ${schema}.daily_journals
     WHERE student_id=$1 AND journal_date BETWEEN $2 AND $3 AND mood IS NOT NULL
     GROUP BY mood`,
    [studentId, from, to]
  );

  const [latestJournal] = await tenantQuery<any>(
    schema,
    `SELECT teacher_note FROM ${schema}.daily_journals
     WHERE student_id=$1 AND teacher_note IS NOT NULL
     ORDER BY journal_date DESC LIMIT 1`,
    [studentId]
  );

  const homework = await tenantQuery<any>(
    schema,
    `SELECT homework FROM ${schema}.daily_journals
     WHERE student_id=$1 AND journal_date BETWEEN $2 AND $3
       AND jsonb_array_length(homework) > 0`,
    [studentId, from, to]
  );

  // ── Build PDF
  const doc = new PDFDocument({
    size: 'A4',
    margins: { top: 40, bottom: 40, left: 50, right: 50 },
    info: { Title: `Progress Card — ${student.full_name}`, Author: 'Montessori360' },
  });

  const pageW = doc.page.width;
  const pageH = doc.page.height;
  const L = 50;
  const R = pageW - 50;
  const W = R - L;

  let currentY = 0;

  const ctx: RenderContext = {
    doc, template, font: F,
    student, attendance, progress, moods,
    journal: latestJournal,
    homework,
    term, from, to,
    y: currentY, L, R, W, pageH,
    setY: (v) => { currentY = v; ctx.y = v; },
    checkPage: (needed) => {
      if (currentY + needed > pageH - 60) {
        doc.addPage();
        currentY = 40;
        ctx.y = 40;
      }
    },
  };

  // ── Render enabled sections in order
  const orderedSections = [...template.sections]
    .filter(s => s.enabled)
    .sort((a, b) => a.order - b.order);

  const renderers: Record<SectionKey, SectionRenderer> = {
    cover:            renderCover,
    attendance:       renderAttendance,
    mood:             renderMood,
    domain_progress:  renderDomainProgress,
    teacher_note:     renderTeacherNote,
    homework_summary: renderHomeworkSummary,
    photo_collage:    renderPhotoCollage,
  };

  for (const section of orderedSections) {
    const renderer = renderers[section.key];
    if (renderer) renderer(ctx);
  }

  // ── Footer on every page
  const range = doc.bufferedPageRange();
  for (let i = 0; i < range.count; i++) {
    doc.switchToPage(range.start + i);
    doc.rect(0, pageH - 35, pageW, 35).fill(P);
    doc.fillColor(WHITE).font(F.regular).fontSize(8)
       .text(
         `Generated by Montessori360  ·  Confidential  ·  Page ${i + 1} of ${range.count}`,
         L, pageH - 22, { width: W }
       );
  }

  doc.end();
  return doc as unknown as Readable;
}

// ─────────────────────────────────────────────────────────────────────────────
// Section renderers
// ─────────────────────────────────────────────────────────────────────────────

function renderCover(ctx: RenderContext) {
  const { doc, template, font: F, student, term, from, to, L, R, W } = ctx;
  const P  = template.primary_colour;
  const S  = template.secondary_colour;
  const AC = template.accent_colour;
  const WHITE = '#FFFFFF';
  const BODY  = '#333333';

  // Header banner
  doc.rect(0, 0, doc.page.width, 90).fill(P);
  if (template.logo_url) {
    // Logo placeholder — in production, fetch and embed from S3
    doc.rect(L, 15, 60, 60).fill(S);
    doc.fillColor(WHITE).font(F.regular).fontSize(7).text('LOGO', L + 18, 42);
    doc.fillColor(WHITE).font(F.bold).fontSize(20).text(student.class_name ?? 'Montessori360', L + 70, 20);
    doc.font(F.regular).fontSize(10).text('Child Progress Report', L + 70, 46);
    doc.font(F.regular).fontSize(10).text(term, L + 70, 62);
  } else {
    doc.fillColor(WHITE).font(F.bold).fontSize(22).text('Montessori360', L, 18);
    doc.font(F.regular).fontSize(11).text('Child Progress Report', L, 44);
    doc.font(F.regular).fontSize(11).text(term, L, 60);
  }
  doc.fillColor(WHITE).font(F.regular).fontSize(9)
     .text('Confidential', R - 80, 38, { width: 80, align: 'right' });

  // Student card
  let y = 105;
  doc.rect(L, y, W, 80).fill('#F5F7FA');
  doc.rect(L, y, W, 80).stroke(AC);
  doc.fillColor(P).font(F.bold).fontSize(16).text(student.full_name, L + 12, y + 10);
  doc.fillColor(BODY).font(F.regular).fontSize(10);
  const col2 = L + W / 2;
  doc.text(`Admission No: ${student.admission_no}`, L + 12, y + 32);
  doc.text(`Date of Birth: ${new Date(student.dob).toLocaleDateString('en-IN')}`, L + 12, y + 47);
  doc.text(`Class: ${student.class_name ?? '—'}`, col2, y + 32);
  doc.text(`Class Teacher: ${student.teacher_name ?? '—'}`, col2, y + 47);
  doc.text(`Report Period: ${from}  to  ${to}`, L + 12, y + 62);

  ctx.setY(y + 95);
}

function renderAttendance(ctx: RenderContext) {
  const { doc, template, font: F, attendance, L, W } = ctx;
  const P = template.primary_colour; const S = template.secondary_colour;
  const AC = template.accent_colour;

  ctx.checkPage(100);
  sectionHeader(doc, 'Attendance Summary', L, ctx.y, W, S, AC, F);
  let y = ctx.y + 32;

  const cols = [
    { label: 'School Days',  value: String(attendance?.total_days ?? 0) },
    { label: 'Present',      value: String(attendance?.present ?? 0) },
    { label: 'Absent',       value: String(attendance?.absent ?? 0) },
    { label: 'Late',         value: String(attendance?.late ?? 0) },
    { label: 'Attendance %', value: `${attendance?.percentage ?? 0}%` },
  ];
  const cW = W / cols.length;
  cols.forEach((col, idx) => {
    const x = L + idx * cW;
    doc.rect(x, y, cW, 50).fill(idx % 2 === 0 ? '#FFFFFF' : '#F5F7FA');
    doc.rect(x, y, cW, 50).stroke(AC);
    doc.fillColor(P).font(F.bold).fontSize(18).text(col.value, x, y + 8, { width: cW, align: 'center' });
    doc.fillColor('#333333').font(F.regular).fontSize(8).text(col.label, x, y + 34, { width: cW, align: 'center' });
  });
  ctx.setY(y + 60);
}

function renderMood(ctx: RenderContext) {
  const { doc, template, font: F, moods, L, W } = ctx;
  if (!moods.length) return;
  const S = template.secondary_colour; const AC = template.accent_colour;

  ctx.checkPage(80);
  sectionHeader(doc, 'Wellbeing & Mood', L, ctx.y, W, S, AC, F);
  let y = ctx.y + 32;

  const moodLabel: Record<string, string> = {
    happy: 'Happy', calm: 'Calm', unsettled: 'Unsettled', upset: 'Upset',
  };
  const total = moods.reduce((s: number, m: any) => s + m.count, 0);
  moods.forEach((m: any) => {
    const pct = Math.round((m.count / total) * 100);
    doc.fillColor('#333333').font(F.regular).fontSize(10)
       .text(moodLabel[m.mood] ?? m.mood, L, y, { width: 100 });
    doc.rect(L + 110, y + 2, W - 160, 12).fill('#EEEEEE');
    doc.rect(L + 110, y + 2, Math.round((W - 160) * pct / 100), 12).fill(S);
    doc.fillColor('#333333').font(F.regular).fontSize(9)
       .text(`${pct}%`, L + W - 45, y + 1);
    y += 20;
  });
  ctx.setY(y + 8);
}

function renderDomainProgress(ctx: RenderContext) {
  const { doc, template, font: F, progress, L, R, W, pageH } = ctx;
  const P = template.primary_colour; const S = template.secondary_colour;
  const AC = template.accent_colour;

  ctx.checkPage(60);
  sectionHeader(doc, 'Developmental Progress', L, ctx.y, W, S, AC, F);
  let y = ctx.y + 32;

  // Legend
  const legend = [
    { label: 'Mastered', color: '#27AE60' }, { label: 'Led', color: S },
    { label: 'In Progress', color: '#F39C12' }, { label: 'Not Started', color: '#E74C3C' },
    { label: 'Not Observed', color: '#999999' },
  ];
  let lx = L;
  legend.forEach(item => {
    doc.rect(lx, y, 10, 10).fill(item.color);
    doc.fillColor('#333333').font(F.regular).fontSize(8).text(item.label, lx + 13, y + 1);
    lx += 90;
  });
  y += 20;

  for (const domain of progress) {
    const neededH = 28 + domain.milestones.length * 17 + 14;
    if (y + neededH > pageH - 60) { doc.addPage(); y = 40; }

    // Domain row
    doc.rect(L, y, W, 22).fill(S);
    doc.fillColor('#FFFFFF').font(F.bold).fontSize(10).text(domain.domain_name, L + 8, y + 5);
    doc.fillColor('#FFFFFF').font(F.regular).fontSize(9)
       .text(`${domain.percentage}% Mastered`, R - 110, y + 6, { width: 100, align: 'right' });
    y += 22;

    domain.milestones.forEach((m: any, idx: number) => {
      doc.rect(L, y, W, 16).fill(idx % 2 === 0 ? '#FFFFFF' : '#F5F7FA');
      doc.fillColor('#333333').font(F.regular).fontSize(8)
         .text(`${m.milestone_code}  ${m.milestone_name}`, L + 6, y + 4, { width: W - 110 });
      const gc = gradeColour(m.grade, AC);
      doc.rect(R - 90, y + 2, 85, 11).fill(gc);
      doc.fillColor('#FFFFFF').font(F.bold).fontSize(7)
         .text(gradeLabel(m.grade), R - 90, y + 3, { width: 85, align: 'center' });
      y += 16;
    });

    // Progress bar
    doc.rect(L, y, W, 5).fill('#E8E8E8');
    doc.rect(L, y, Math.round(W * domain.percentage / 100), 5).fill('#27AE60');
    y += 13;
  }
  ctx.setY(y);
}

function renderTeacherNote(ctx: RenderContext) {
  const { doc, template, font: F, journal, L, W } = ctx;
  if (!journal?.teacher_note) return;
  const S = template.secondary_colour; const AC = template.accent_colour;

  ctx.checkPage(80);
  sectionHeader(doc, "Teacher's Note", L, ctx.y, W, S, AC, F);
  let y = ctx.y + 32;
  doc.rect(L, y, W, 60).fill('#F5F7FA');
  doc.fillColor('#333333').font(F.italic).fontSize(10)
     .text(`"${journal.teacher_note}"`, L + 10, y + 10, { width: W - 20, height: 50 });
  ctx.setY(y + 68);
}

function renderHomeworkSummary(ctx: RenderContext) {
  const { doc, template, font: F, homework, L, W } = ctx;
  if (!homework.length) return;
  const S = template.secondary_colour; const AC = template.accent_colour;

  ctx.checkPage(80);
  sectionHeader(doc, 'Homework Summary', L, ctx.y, W, S, AC, F);
  let y = ctx.y + 32;

  let totalAssigned = 0; let totalCompleted = 0;
  homework.forEach((row: any) => {
    const hw = Array.isArray(row.homework) ? row.homework : [];
    totalAssigned  += hw.length;
    totalCompleted += hw.filter((h: any) => h.completed).length;
  });

  doc.fillColor('#333333').font(F.regular).fontSize(10)
     .text(`Assigned: ${totalAssigned}   Completed: ${totalCompleted}   Completion Rate: ${totalAssigned > 0 ? Math.round(totalCompleted / totalAssigned * 100) : 0}%`,
       L + 10, y + 10);
  ctx.setY(y + 40);
}

function renderPhotoCollage(ctx: RenderContext) {
  const { doc, template, font: F, L, W } = ctx;
  const S = template.secondary_colour; const AC = template.accent_colour;

  ctx.checkPage(60);
  sectionHeader(doc, 'Photo Memories', L, ctx.y, W, S, AC, F);
  let y = ctx.y + 32;
  doc.rect(L, y, W, 40).fill('#F5F7FA');
  doc.fillColor('#999999').font(F.italic).fontSize(9)
     .text('Photo collage will appear here when photos are uploaded via the daily journal.',
       L + 10, y + 14, { width: W - 20 });
  ctx.setY(y + 48);
}

// ── Shared helper ─────────────────────────────────────────────────────────────

function sectionHeader(
  doc: PDFKit.PDFDocument, title: string,
  x: number, y: number, w: number,
  bg: string, border: string,
  F: ReturnType<typeof fonts>
) {
  doc.rect(x, y, w, 24).fill(border);
  doc.fillColor('#1F3864').font(F.bold).fontSize(11).text(title, x + 10, y + 6);
}
