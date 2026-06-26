import PDFDocument from 'pdfkit';
import ExcelJS from 'exceljs';
import type { Response } from 'express';

// ── Types ─────────────────────────────────────────────────────────────────────

interface ParentExport {
  relation: string;
  first_name: string;
  last_name: string;
  mobile: string;
  email?: string;
  mobile_alt?: string;
  is_primary: boolean;
  is_emergency_contact: boolean;
  profession?: string;
  employer?: string;
  annual_income?: number;
  education?: string;
  can_pickup: boolean;
  address_line1?: string;
  city?: string;
  state?: string;
  pincode?: string;
  notes?: string;
}

interface StudentExport {
  admission_no: string;
  first_name: string;
  last_name: string;
  dob: string;
  gender?: string;
  blood_group?: string;
  nationality?: string;
  mother_tongue?: string;
  aadhar_no?: string;
  allergies: string;
  dietary_notes?: string;
  medical_notes: string;
  previous_school?: string;
  admission_date?: string;
  class_name?: string;
  parents: ParentExport[];
}

// ── Excel Export ──────────────────────────────────────────────────────────────

export async function generateStudentsXlsx(
  students: StudentExport[],
  res: Response,
  label: string,
): Promise<void> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Montessori360';
  wb.created = new Date();

  const headerFill: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A5F' } };
  const headerFont: Partial<ExcelJS.Font> = { color: { argb: 'FFFFFFFF' }, bold: true, size: 10 };
  const borderStyle: Partial<ExcelJS.Borders> = {
    top:    { style: 'thin', color: { argb: 'FFCBD5E1' } },
    bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } },
    left:   { style: 'thin', color: { argb: 'FFCBD5E1' } },
    right:  { style: 'thin', color: { argb: 'FFCBD5E1' } },
  };

  function applyHeader(row: ExcelJS.Row) {
    row.height = 24;
    row.eachCell(cell => {
      cell.fill   = headerFill;
      cell.font   = headerFont;
      cell.border = borderStyle;
      cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: false };
    });
  }

  function styleDataRow(row: ExcelJS.Row, even: boolean) {
    row.height = 18;
    row.eachCell(cell => {
      if (even) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
      cell.border = borderStyle;
      cell.alignment = { vertical: 'middle', wrapText: false };
    });
  }

  // ── Sheet 1: Students ──────────────────────────────────────────────────────
  const sSheet = wb.addWorksheet('Students', { views: [{ state: 'frozen', ySplit: 2 }] });

  // Title row
  sSheet.addRow([`Student Export — ${label} — ${new Date().toLocaleDateString('en-IN')}`]);
  sSheet.mergeCells(1, 1, 1, 15);
  const titleRow = sSheet.getRow(1);
  titleRow.height = 28;
  titleRow.getCell(1).font  = { bold: true, size: 13, color: { argb: 'FF1E3A5F' } };
  titleRow.getCell(1).alignment = { vertical: 'middle' };

  // Header row
  const sHeaders = [
    'Admission No', 'First Name', 'Last Name', 'Class', 'Date of Birth',
    'Gender', 'Blood Group', 'Nationality', 'Mother Tongue',
    'Aadhar No', 'Allergies', 'Dietary Notes', 'Previous School', 'Admission Date',
  ];
  applyHeader(sSheet.addRow(sHeaders));

  const sColWidths = [14, 16, 16, 16, 14, 10, 12, 14, 14, 16, 22, 22, 20, 14];
  sColWidths.forEach((w, i) => { sSheet.getColumn(i + 1).width = w; });

  students.forEach((s, idx) => {
    const r = sSheet.addRow([
      s.admission_no,
      s.first_name,
      s.last_name,
      s.class_name ?? '',
      s.dob,
      s.gender ? s.gender.charAt(0).toUpperCase() + s.gender.slice(1) : '',
      s.blood_group ?? '',
      s.nationality ?? '',
      s.mother_tongue ?? '',
      s.aadhar_no ?? '',
      s.allergies,
      s.dietary_notes ?? '',
      s.previous_school ?? '',
      s.admission_date ?? '',
    ]);
    styleDataRow(r, idx % 2 === 0);
  });

  // ── Sheet 2: Parents ───────────────────────────────────────────────────────
  const pSheet = wb.addWorksheet('Parents', { views: [{ state: 'frozen', ySplit: 2 }] });

  pSheet.addRow([`Parent Details — ${label} — ${new Date().toLocaleDateString('en-IN')}`]);
  pSheet.mergeCells(1, 1, 1, 16);
  const pTitleRow = pSheet.getRow(1);
  pTitleRow.height = 28;
  pTitleRow.getCell(1).font = { bold: true, size: 13, color: { argb: 'FF1E3A5F' } };
  pTitleRow.getCell(1).alignment = { vertical: 'middle' };

  const pHeaders = [
    'Admission No', 'Student Name', 'Class', 'Relation',
    'First Name', 'Last Name', 'Mobile', 'Email', 'Alt Mobile',
    'Primary', 'Emergency', 'Can Pickup',
    'Profession', 'Employer', 'Education', 'Annual Income',
  ];
  applyHeader(pSheet.addRow(pHeaders));

  const pColWidths = [14, 20, 16, 12, 16, 16, 14, 24, 14, 9, 10, 10, 18, 20, 16, 14];
  pColWidths.forEach((w, i) => { pSheet.getColumn(i + 1).width = w; });

  let pRowIdx = 0;
  for (const s of students) {
    if (!s.parents.length) {
      const r = pSheet.addRow([
        s.admission_no,
        `${s.first_name} ${s.last_name}`.trim(),
        s.class_name ?? '',
        '', '', '', '', '', '', '', '', '', '', '', '', '',
      ]);
      styleDataRow(r, pRowIdx++ % 2 === 0);
      continue;
    }
    for (const p of s.parents) {
      const r = pSheet.addRow([
        s.admission_no,
        `${s.first_name} ${s.last_name}`.trim(),
        s.class_name ?? '',
        p.relation,
        p.first_name,
        p.last_name,
        p.mobile,
        p.email ?? '',
        p.mobile_alt ?? '',
        p.is_primary ? 'Yes' : 'No',
        p.is_emergency_contact ? 'Yes' : 'No',
        p.can_pickup ? 'Yes' : 'No',
        p.profession ?? '',
        p.employer ?? '',
        p.education ?? '',
        p.annual_income ?? '',
      ]);
      styleDataRow(r, pRowIdx++ % 2 === 0);
    }
  }

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="students-${Date.now()}.xlsx"`);
  await wb.xlsx.write(res);
}

// ── PDF Export ────────────────────────────────────────────────────────────────

const MARGIN  = 36;
const BLUE    = '#1E3A5F';
const ROW_H   = 18;
const HDR_H   = 22;
const FONT_SM = 7.5;
const FONT_HD = 8;

function pdfHeader(doc: PDFKit.PDFDocument, title: string, label: string) {
  const W = doc.page.width;
  // Blue banner
  doc.rect(0, 0, W, 52).fill(BLUE);
  doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(14)
    .text('Montessori360', MARGIN, 12, { lineBreak: false });
  doc.fillColor('#94A3B8').font('Helvetica').fontSize(9)
    .text(`  ·  ${title}`, MARGIN + 115, 14, { lineBreak: false });
  doc.fillColor('#CBD5E1').fontSize(8)
    .text(`${label}    Generated: ${new Date().toLocaleString('en-IN')}`, MARGIN, 32, { lineBreak: false });
  doc.fillColor('#1E293B');
}

function drawTableHeader(
  doc: PDFKit.PDFDocument,
  headers: string[],
  widths: number[],
  y: number,
): number {
  const x0 = MARGIN;
  doc.rect(x0, y, widths.reduce((a, b) => a + b, 0), HDR_H).fill(BLUE);
  let x = x0;
  doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(FONT_HD);
  headers.forEach((h, i) => {
    doc.text(h, x + 3, y + 6, { width: widths[i] - 6, lineBreak: false });
    x += widths[i];
  });
  doc.fillColor('#1E293B');
  return y + HDR_H;
}

function drawRow(
  doc: PDFKit.PDFDocument,
  cells: string[],
  widths: number[],
  y: number,
  even: boolean,
): number {
  const totalW = widths.reduce((a, b) => a + b, 0);
  if (even) doc.rect(MARGIN, y, totalW, ROW_H).fill('#F8FAFC');
  doc.strokeColor('#E2E8F0').lineWidth(0.4)
    .moveTo(MARGIN, y + ROW_H).lineTo(MARGIN + totalW, y + ROW_H).stroke();
  doc.fillColor('#1E293B').font('Helvetica').fontSize(FONT_SM);
  let x = MARGIN;
  cells.forEach((cell, i) => {
    doc.text(cell ?? '', x + 3, y + 5, { width: widths[i] - 6, lineBreak: false, ellipsis: true });
    x += widths[i];
  });
  return y + ROW_H;
}

function needsNewPage(doc: PDFKit.PDFDocument, y: number, margin = 50): boolean {
  return y + ROW_H > doc.page.height - margin;
}

export function generateStudentsPdf(
  students: StudentExport[],
  res: Response,
  label: string,
): void {
  const doc = new PDFDocument({ margin: MARGIN, size: 'A4', layout: 'landscape', autoFirstPage: true, bufferPages: true });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="students-${Date.now()}.pdf"`);
  doc.pipe(res);

  // ── Page 1: Students ──────────────────────────────────────────────────────
  const PAGE_W = doc.page.width - MARGIN * 2;
  pdfHeader(doc, 'Student Directory', label);

  // Section label
  doc.fillColor(BLUE).font('Helvetica-Bold').fontSize(10)
    .text('STUDENTS', MARGIN, 62).moveDown(0.3);
  doc.strokeColor(BLUE).lineWidth(1).moveTo(MARGIN, 76).lineTo(MARGIN + PAGE_W, 76).stroke();

  const sCols = ['Adm No', 'First Name', 'Last Name', 'Class', 'DOB', 'Gender', 'Blood', 'Nationality', 'Mother Tongue', 'Admission Date'];
  const sW    = [65, 82, 82, 88, 66, 52, 48, 72, 78, 70];

  let y = drawTableHeader(doc, sCols, sW, 82);
  let rowIdx = 0;

  for (const s of students) {
    if (needsNewPage(doc, y)) {
      doc.addPage({ size: 'A4', layout: 'landscape', margin: MARGIN });
      pdfHeader(doc, 'Student Directory (cont.)', label);
      y = drawTableHeader(doc, sCols, sW, 62);
    }
    y = drawRow(doc, [
      s.admission_no,
      s.first_name,
      s.last_name,
      s.class_name ?? '—',
      s.dob,
      s.gender ?? '',
      s.blood_group ?? '',
      s.nationality ?? '',
      s.mother_tongue ?? '',
      s.admission_date ?? '',
    ], sW, y, rowIdx++ % 2 === 0);
  }

  // ── Next section: Additional student details ───────────────────────────────
  doc.addPage({ size: 'A4', layout: 'landscape', margin: MARGIN });
  pdfHeader(doc, 'Student — Additional Details', label);
  doc.fillColor(BLUE).font('Helvetica-Bold').fontSize(10)
    .text('ADDITIONAL DETAILS', MARGIN, 62).moveDown(0.3);
  doc.strokeColor(BLUE).lineWidth(1).moveTo(MARGIN, 76).lineTo(MARGIN + PAGE_W, 76).stroke();

  const aCols = ['Adm No', 'Student Name', 'Class', 'Aadhar No', 'Allergies', 'Dietary Notes', 'Previous School'];
  const aW    = [65, 115, 85, 95, 120, 135, 150];

  y = drawTableHeader(doc, aCols, aW, 82);
  rowIdx = 0;

  for (const s of students) {
    if (needsNewPage(doc, y)) {
      doc.addPage({ size: 'A4', layout: 'landscape', margin: MARGIN });
      pdfHeader(doc, 'Additional Details (cont.)', label);
      y = drawTableHeader(doc, aCols, aW, 62);
    }
    y = drawRow(doc, [
      s.admission_no,
      `${s.first_name} ${s.last_name}`.trim(),
      s.class_name ?? '—',
      s.aadhar_no ?? '',
      s.allergies,
      s.dietary_notes ?? '',
      s.previous_school ?? '',
    ], aW, y, rowIdx++ % 2 === 0);
  }

  // ── Next section: Parents ─────────────────────────────────────────────────
  doc.addPage({ size: 'A4', layout: 'landscape', margin: MARGIN });
  pdfHeader(doc, 'Parent Details', label);
  doc.fillColor(BLUE).font('Helvetica-Bold').fontSize(10)
    .text('PARENTS', MARGIN, 62).moveDown(0.3);
  doc.strokeColor(BLUE).lineWidth(1).moveTo(MARGIN, 76).lineTo(MARGIN + PAGE_W, 76).stroke();

  const pCols = ['Adm No', 'Student', 'Class', 'Relation', 'Parent Name', 'Mobile', 'Email', 'Primary', 'Emergency', 'Can Pickup', 'Profession', 'Employer'];
  const pW    = [60, 84, 68, 56, 98, 72, 108, 44, 52, 50, 80, 90];

  y = drawTableHeader(doc, pCols, pW, 82);
  rowIdx = 0;

  for (const s of students) {
    if (!s.parents.length) {
      if (needsNewPage(doc, y)) {
        doc.addPage({ size: 'A4', layout: 'landscape', margin: MARGIN });
        pdfHeader(doc, 'Parent Details (cont.)', label);
        y = drawTableHeader(doc, pCols, pW, 62);
      }
      y = drawRow(doc, [s.admission_no, `${s.first_name} ${s.last_name}`.trim(), s.class_name ?? '', '—', '', '', '', '', '', '', '', ''], pW, y, rowIdx++ % 2 === 0);
      continue;
    }
    for (const p of s.parents) {
      if (needsNewPage(doc, y)) {
        doc.addPage({ size: 'A4', layout: 'landscape', margin: MARGIN });
        pdfHeader(doc, 'Parent Details (cont.)', label);
        y = drawTableHeader(doc, pCols, pW, 62);
      }
      y = drawRow(doc, [
        s.admission_no,
        `${s.first_name} ${s.last_name}`.trim(),
        s.class_name ?? '',
        p.relation,
        `${p.first_name} ${p.last_name}`.trim(),
        p.mobile,
        p.email ?? '',
        p.is_primary ? 'Yes' : 'No',
        p.is_emergency_contact ? 'Yes' : 'No',
        p.can_pickup ? 'Yes' : 'No',
        p.profession ?? '',
        p.employer ?? '',
      ], pW, y, rowIdx++ % 2 === 0);
    }
  }

  // Page numbers
  const range = doc.bufferedPageRange();
  for (let i = 0; i < range.count; i++) {
    doc.switchToPage(range.start + i);
    doc.fillColor('#94A3B8').font('Helvetica').fontSize(7.5)
      .text(`Page ${i + 1} of ${range.count}`, 0, doc.page.height - 20, { align: 'center', lineBreak: false });
  }

  doc.end();
}
