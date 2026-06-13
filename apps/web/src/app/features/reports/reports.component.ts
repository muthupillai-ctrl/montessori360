import { Component, inject, signal, OnInit, computed } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTabsModule } from '@angular/material/tabs';
import { MatMenuModule } from '@angular/material/menu';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/services/api.service';
import { TemplateDialogComponent } from './template-dialog.component';
import type { SchoolClass } from '../../core/models';

export interface ReportTemplate {
  id:               string;
  name:             string;
  description:      string | null;
  primary_colour:   string;
  secondary_colour: string;
  accent_colour:    string;
  font:             string;
  sections:         { key: string; enabled: boolean; order: number; label?: string }[];
  is_default:       boolean;
  is_active:        boolean;
}

@Component({
  selector: 'app-reports',
  standalone: true,
  imports: [
    MatIconModule, MatProgressSpinnerModule,
    MatTabsModule, MatMenuModule, MatDialogModule, FormsModule,
  ],
  template: `
    <mat-tab-group class="reports-page-tabs">

      <!-- ── Generate Reports ────────────────────────────────── -->
      <mat-tab label="📄  Generate">
        <div class="tab-body">

          <div class="page-header">
            <div>
              <h1>Progress Reports</h1>
              <div class="subtitle">Generate PDF progress cards for students</div>
            </div>
          </div>

          <!-- Filters -->
          <div class="gen-panel">
            <div class="gp-section">
              <div class="gp-label">Select Students</div>
              <div class="filter-row">
                <select class="field-input" [value]="genClass()"
                        (change)="onGenClassChange($any($event.target).value)">
                  <option value="">All Classes</option>
                  @for (cls of classes(); track cls.id) {
                    <option [value]="cls.id">{{ cls.name }}</option>
                  }
                </select>
                <select class="field-input w-300" [value]="genStudentId()"
                        (change)="genStudentId.set($any($event.target).value)">
                  <option value="">All students in class</option>
                  @for (s of genStudents(); track s.id) {
                    <option [value]="s.id">{{ s.first_name }} {{ s.last_name }} · {{ s.admission_no }}</option>
                  }
                </select>
              </div>
            </div>

            <div class="gp-section">
              <div class="gp-label">Report Period</div>
              <div class="filter-row">
                <div class="field-group">
                  <label class="field-label">Term / Label</label>
                  <input class="field-input w-200" [(ngModel)]="genTerm" placeholder="e.g. Term 1 2025-2026">
                </div>
                <div class="field-group">
                  <label class="field-label">From</label>
                  <input class="field-input" type="date" [(ngModel)]="genFrom">
                </div>
                <div class="field-group">
                  <label class="field-label">To</label>
                  <input class="field-input" type="date" [(ngModel)]="genTo">
                </div>
              </div>
            </div>

            <div class="gp-section">
              <div class="gp-label">Template</div>
              <div class="template-cards">
                @for (t of templates(); track t.id) {
                  <div class="template-card" [class.selected]="genTemplateId() === t.id"
                       (click)="genTemplateId.set(t.id)">
                    <div class="tc-swatch">
                      <div class="tc-primary" [style.background]="t.primary_colour"></div>
                      <div class="tc-accent"  [style.background]="t.accent_colour"></div>
                    </div>
                    <div class="tc-info">
                      <div class="tc-name">{{ t.name }}</div>
                      @if (t.is_default) {
                        <span class="default-tag">Default</span>
                      }
                    </div>
                    @if (genTemplateId() === t.id) {
                      <mat-icon class="tc-check">check_circle</mat-icon>
                    }
                  </div>
                }
                @if (!templates().length) {
                  <div class="no-templates">No templates. Create one in the Templates tab.</div>
                }
              </div>
            </div>

            <!-- Generate button -->
            <div class="gen-actions">
              @if (generating()) {
                <div class="gen-progress">
                  <mat-progress-spinner diameter="20" mode="indeterminate" />
                  <span>Generating PDF…</span>
                </div>
              } @else {
                <button class="btn-primary-custom" (click)="generate()"
                        [disabled]="!canGenerate()">
                  <mat-icon style="font-size:16px;width:16px;height:16px">picture_as_pdf</mat-icon>
                  Generate {{ genStudentId() ? '1 Report' : 'Reports for Class' }}
                </button>
              }
            </div>

          </div>

          <!-- How it works -->
          <div class="how-it-works">
            <div class="hiw-title">What's included in the Progress Card</div>
            <div class="hiw-sections">
              @for (s of sectionInfo; track s.key) {
                <div class="hiw-item">
                  <div class="hiw-icon">{{ s.emoji }}</div>
                  <div>
                    <div class="hiw-label">{{ s.label }}</div>
                    <div class="hiw-desc">{{ s.desc }}</div>
                  </div>
                </div>
              }
            </div>
          </div>

        </div>
      </mat-tab>

      <!-- ── Templates tab ────────────────────────────────────── -->
      <mat-tab label="🎨  Templates">
        <div class="tab-body">

          <div class="page-header">
            <div>
              <div style="font-size:15px;font-weight:600;color:var(--text)">Report Templates</div>
              <div class="subtitle">Customise the design and sections of progress cards</div>
            </div>
            <button class="btn-primary-custom" (click)="openTemplateDialog()">
              <mat-icon style="font-size:16px;width:16px;height:16px">add</mat-icon>
              New Template
            </button>
          </div>

          @if (templatesLoading()) {
            <div class="loading-row"><mat-progress-spinner diameter="28" mode="indeterminate" /></div>
          } @else if (!templates().length) {
            <div class="empty-state">
              <div class="empty-icon">🎨</div>
              <div class="empty-title">No templates yet</div>
              <div class="empty-sub">Create your first template to customise how progress cards look.</div>
              <button class="btn-primary-custom" (click)="openTemplateDialog()">
                <mat-icon style="font-size:16px;width:16px;height:16px">add</mat-icon>
                Create Template
              </button>
            </div>
          } @else {
            <div class="templates-grid">
              @for (t of templates(); track t.id) {
                <div class="template-detail-card">

                  <!-- Preview strip -->
                  <div class="tdc-preview" [style.background]="t.primary_colour">
                    <div class="tdcp-accent" [style.background]="t.accent_colour"></div>
                    <div class="tdcp-name" [style.color]="t.accent_colour">{{ t.name }}</div>
                    <div class="tdcp-sub" [style.color]="t.accent_colour + 'CC'">Progress Report</div>
                  </div>

                  <div class="tdc-body">
                    <div class="tdc-top">
                      <div>
                        <div class="tdc-name">{{ t.name }}</div>
                        @if (t.description) {
                          <div class="tdc-desc">{{ t.description }}</div>
                        }
                      </div>
                      <div class="tdc-badges">
                        @if (t.is_default) {
                          <span class="default-tag">Default</span>
                        }
                      </div>
                    </div>

                    <!-- Sections -->
                    <div class="tdc-sections">
                      @for (s of getEnabledSections(t); track s.key) {
                        <span class="section-chip">{{ getSectionEmoji(s.key) }} {{ s.label ?? getSectionLabel(s.key) }}</span>
                      }
                    </div>

                    <!-- Colours -->
                    <div class="tdc-colours">
                      <div class="colour-dot" [style.background]="t.primary_colour" [title]="'Primary: ' + t.primary_colour"></div>
                      <div class="colour-dot" [style.background]="t.secondary_colour" [title]="'Secondary: ' + t.secondary_colour"></div>
                      <div class="colour-dot" [style.background]="t.accent_colour" [title]="'Accent: ' + t.accent_colour"></div>
                      <span class="font-tag">{{ t.font }}</span>
                    </div>

                    <div class="tdc-actions">
                      <button class="btn-outline-sm" (click)="openTemplateDialog(t)">
                        <mat-icon style="font-size:14px;width:14px;height:14px">edit</mat-icon> Edit
                      </button>
                      @if (!t.is_default) {
                        <button class="btn-outline-sm" (click)="setDefault(t)">
                          <mat-icon style="font-size:14px;width:14px;height:14px">star</mat-icon> Set Default
                        </button>
                        <button class="btn-outline-sm danger" (click)="deleteTemplate(t)">
                          <mat-icon style="font-size:14px;width:14px;height:14px">delete</mat-icon> Delete
                        </button>
                      }
                    </div>
                  </div>
                </div>
              }
            </div>
          }
        </div>
      </mat-tab>

      <!-- ── Class Assignment tab ─────────────────────────────── -->
      <mat-tab label="🏫  Class Assignment">
        <div class="tab-body">
          <div class="page-header">
            <div>
              <div style="font-size:15px;font-weight:600;color:var(--text)">Template Assignment</div>
              <div class="subtitle">Assign specific templates to classes (overrides school default)</div>
            </div>
          </div>

          <div class="assignment-list">
            @for (cls of classes(); track cls.id) {
              <div class="assign-row">
                <div class="ar-class">
                  <div class="ar-av" [style.background]="getClassColor(cls.name)">{{ cls.name[0] }}</div>
                  <div>
                    <div class="ar-name">{{ cls.name }}</div>
                    <div class="ar-count">{{ cls.enrolled_count }} students</div>
                  </div>
                </div>
                <div class="ar-template">
                  <select class="field-input w-260"
                          [value]="getClassTemplate(cls.id)"
                          (change)="assignTemplate(cls.id, $any($event.target).value)">
                    <option value="">Use school default template</option>
                    @for (t of templates(); track t.id) {
                      <option [value]="t.id">{{ t.name }}</option>
                    }
                  </select>
                </div>
              </div>
            }
          </div>
        </div>
      </mat-tab>

    </mat-tab-group>
  `,
  styles: [`
    ::ng-deep .reports-page-tabs .mat-mdc-tab-body-wrapper { padding: 0; }
    .tab-body { padding-top: 16px; }

    .btn-primary-custom {
      display: inline-flex; align-items: center; gap: 6px;
      background: var(--blue); color: #fff;
      border: none; border-radius: 8px; padding: 0 16px; height: 36px;
      font-size: 13px; font-weight: 500; cursor: pointer;
      &:hover:not(:disabled) { background: #1D4ED8; }
      &:disabled { opacity: .6; cursor: not-allowed; }
    }
    .btn-outline-sm {
      display: inline-flex; align-items: center; gap: 4px;
      background: #fff; color: var(--text-2); border: 1px solid var(--border);
      border-radius: 7px; padding: 0 10px; height: 30px; font-size: 12px; cursor: pointer;
      &:hover { background: var(--bg); }
      &.danger { color: var(--red); &:hover { background: var(--red-light); border-color: var(--red); } }
    }

    /* Generate panel */
    .gen-panel {
      background: var(--surface); border: 1px solid var(--border);
      border-radius: 10px; overflow: hidden; margin-bottom: 16px;
    }
    .gp-section {
      padding: 16px 18px; border-bottom: 1px solid var(--border-light);
      &:last-child { border-bottom: none; }
    }
    .gp-label {
      font-size: 11px; font-weight: 600; text-transform: uppercase;
      letter-spacing: .4px; color: var(--text-4); margin-bottom: 10px;
    }
    .filter-row  { display: flex; gap: 10px; align-items: flex-end; flex-wrap: wrap; }
    .field-group { display: flex; flex-direction: column; gap: 4px; }
    .field-label { font-size: 11px; font-weight: 500; color: var(--text-3); }
    .field-input {
      height: 36px; padding: 0 10px;
      background: var(--bg); border: 1px solid var(--border);
      border-radius: 7px; font-size: 13px; color: var(--text);
      outline: none; font-family: inherit;
      &:focus { border-color: var(--blue); background: #fff; }
    }
    select.field-input { cursor: pointer; }
    .w-200 { width: 200px; }
    .w-260 { width: 260px; }
    .w-300 { width: 300px; }

    /* Template selector cards */
    .template-cards {
      display: flex; gap: 10px; flex-wrap: wrap;
    }
    .template-card {
      display: flex; align-items: center; gap: 10px;
      border: 2px solid var(--border); border-radius: 9px;
      padding: 10px 14px; cursor: pointer; transition: all .12s; background: #fff;
      &:hover    { border-color: var(--blue); }
      &.selected { border-color: var(--blue); background: var(--blue-light); }
    }
    .tc-swatch { display: flex; gap: 3px; }
    .tc-primary { width: 14px; height: 28px; border-radius: 4px; }
    .tc-accent  { width: 14px; height: 28px; border-radius: 4px; }
    .tc-name { font-size: 13px; font-weight: 500; color: var(--text); }
    .tc-check { color: var(--blue); font-size: 18px; width: 18px; height: 18px; margin-left: 4px; }
    .no-templates { font-size: 12px; color: var(--text-3); padding: 8px; }

    .gen-actions { padding: 14px 18px; }
    .gen-progress { display: flex; align-items: center; gap: 10px; color: var(--text-3); font-size: 13px; }

    /* How it works */
    .how-it-works {
      background: var(--surface); border: 1px solid var(--border);
      border-radius: 10px; padding: 16px 18px;
    }
    .hiw-title   { font-size: 12px; font-weight: 600; color: var(--text-2); margin-bottom: 12px; }
    .hiw-sections { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 10px; }
    .hiw-item    { display: flex; align-items: flex-start; gap: 10px; }
    .hiw-icon    { font-size: 20px; flex-shrink: 0; }
    .hiw-label   { font-size: 12.5px; font-weight: 500; color: var(--text); }
    .hiw-desc    { font-size: 11px; color: var(--text-3); margin-top: 2px; line-height: 1.4; }

    /* Templates grid */
    .templates-grid {
      display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 14px;
    }
    .template-detail-card {
      background: var(--surface); border: 1px solid var(--border);
      border-radius: 10px; overflow: hidden;
    }
    .tdc-preview {
      height: 80px; position: relative; overflow: hidden; padding: 14px 16px;
    }
    .tdcp-accent { position: absolute; top: 0; right: 0; width: 4px; height: 100%; }
    .tdcp-name   { font-size: 16px; font-weight: 700; }
    .tdcp-sub    { font-size: 11px; margin-top: 3px; opacity: .8; }

    .tdc-body    { padding: 14px; display: flex; flex-direction: column; gap: 10px; }
    .tdc-top     { display: flex; justify-content: space-between; align-items: flex-start; }
    .tdc-name    { font-size: 13px; font-weight: 600; color: var(--text); }
    .tdc-desc    { font-size: 11px; color: var(--text-3); margin-top: 2px; }
    .tdc-badges  { display: flex; gap: 4px; }

    .default-tag {
      background: var(--amber-light); color: #92400E;
      font-size: 10px; font-weight: 600; padding: 2px 7px; border-radius: 10px;
    }

    .tdc-sections { display: flex; gap: 5px; flex-wrap: wrap; }
    .section-chip {
      font-size: 10px; background: var(--bg); color: var(--text-2);
      padding: 2px 7px; border-radius: 4px;
    }

    .tdc-colours { display: flex; align-items: center; gap: 6px; }
    .colour-dot  { width: 16px; height: 16px; border-radius: 50%; border: 1px solid rgba(0,0,0,.1); }
    .font-tag    { font-size: 11px; color: var(--text-3); margin-left: 4px; }

    .tdc-actions { display: flex; gap: 6px; }

    /* Loading / empty */
    .loading-row { display: flex; justify-content: center; padding: 48px; }
    .empty-state {
      display: flex; flex-direction: column; align-items: center; gap: 10px;
      padding: 80px; color: var(--text-3);
      .empty-icon  { font-size: 48px; }
      .empty-title { font-size: 16px; font-weight: 600; color: var(--text-2); }
      .empty-sub   { font-size: 13px; text-align: center; max-width: 360px; }
    }

    /* Class assignment */
    .assignment-list { display: flex; flex-direction: column; gap: 0; }
    .assign-row {
      display: flex; align-items: center; justify-content: space-between; gap: 16px;
      padding: 12px 16px; background: var(--surface); border: 1px solid var(--border);
      border-radius: 0; margin-bottom: -1px;
      &:first-child { border-radius: 10px 10px 0 0; }
      &:last-child  { border-radius: 0 0 10px 10px; margin-bottom: 0; }
      &:only-child  { border-radius: 10px; }
      &:hover { background: #FAFAFA; z-index: 1; position: relative; }
    }
    .ar-class { display: flex; align-items: center; gap: 10px; }
    .ar-av {
      width: 34px; height: 34px; border-radius: 9px; color: #fff;
      font-size: 14px; font-weight: 700; display: flex; align-items: center; justify-content: center;
    }
    .ar-name  { font-size: 13px; font-weight: 500; color: var(--text); }
    .ar-count { font-size: 11px; color: var(--text-3); }
    .ar-template { display: flex; align-items: center; }
  `],
})
export class ReportsComponent implements OnInit {
  private api    = inject(ApiService);
  private dialog = inject(MatDialog);
  private snack  = inject(MatSnackBar);

  classes          = signal<SchoolClass[]>([]);
  templates        = signal<ReportTemplate[]>([]);
  templatesLoading = signal(false);
  genStudents      = signal<any[]>([]);
  classTemplates   = signal<Record<string, string>>({});

  // Generate state
  genClass      = signal('');
  genStudentId  = signal('');
  genTemplateId = signal('');
  genTerm       = 'Term 1 2025-2026';
  genFrom       = new Date(new Date().getFullYear(), 5, 1).toISOString().slice(0, 10);
  genTo         = new Date().toISOString().slice(0, 10);
  generating    = signal(false);

  sectionInfo = [
    { key: 'cover',           emoji: '📄', label: 'Cover Page',        desc: 'School name, student photo placeholder, term' },
    { key: 'attendance',      emoji: '✅', label: 'Attendance',        desc: 'Present, absent, late count for the period' },
    { key: 'mood',            emoji: '😊', label: 'Mood & Wellbeing',  desc: 'Mood trend from daily journals' },
    { key: 'domain_progress', emoji: '🎯', label: 'Domain Progress',   desc: 'Milestone mastery across all 5 domains' },
    { key: 'teacher_note',    emoji: '📝', label: "Teacher's Note",    desc: 'Consolidated teacher observations' },
    { key: 'homework_summary',emoji: '📚', label: 'Homework',          desc: 'Homework completion summary' },
  ];

  canGenerate = computed(() => !!this.genTemplateId() && (!!this.genClass() || !!this.genStudentId()));

  ngOnInit() {
    this.api.get<any>('/students/classes').subscribe({
      next: (res: any) => this.classes.set(res.data ?? []),
    });
    this.loadTemplates();
  }

  loadTemplates() {
    this.templatesLoading.set(true);
    this.api.get<any>('/reports/templates').subscribe({
      next: (res: any) => {
        this.templates.set(res.data ?? []);
        this.templatesLoading.set(false);
        // Auto-select default
        const def = res.data?.find((t: ReportTemplate) => t.is_default);
        if (def && !this.genTemplateId()) this.genTemplateId.set(def.id);
      },
      error: () => this.templatesLoading.set(false),
    });
  }

  onGenClassChange(classId: string) {
    this.genClass.set(classId);
    this.genStudentId.set('');
    if (classId) {
      this.api.get<any>('/students', { limit: '500', page: '1', is_active: 'true', class_id: classId }).subscribe({
        next: (res: any) => this.genStudents.set(res.data ?? []),
      });
    } else {
      this.genStudents.set([]);
    }
  }

  generate() {
    if (!this.canGenerate()) return;
    this.generating.set(true);

    const studentId = this.genStudentId();
    const classId   = this.genClass();

    const params = new URLSearchParams({
      term:        this.genTerm,
      from:        this.genFrom,
      to:          this.genTo,
      template_id: this.genTemplateId(),
    });

    // If single student — download directly
    if (studentId) {
      const url = '/api/v1/reports/progress-card/' + studentId + '?' + params.toString();
      this.downloadPdf(url, 'progress-card.pdf');
    } else if (classId) {
      // Bulk — generate for each student in the class
      this.api.get<any>('/students', { limit: '500', page: '1', is_active: 'true', class_id: classId }).subscribe({
        next: (res: any) => {
          const students = res.data ?? [];
          if (!students.length) {
            this.snack.open('No students in this class', 'OK', { duration: 3000 });
            this.generating.set(false);
            return;
          }
          this.generateBulk(students, params);
        },
      });
    }
  }

  async generateBulk(students: any[], params: URLSearchParams) {
    let count = 0;
    for (const s of students) {
      const url = '/api/v1/reports/progress-card/' + s.id + '?' + params.toString();
      await this.downloadPdfAsync(url, s.first_name + '-' + s.last_name + '-progress.pdf');
      count++;
    }
    this.generating.set(false);
    this.snack.open(count + ' report(s) downloaded', 'OK', { duration: 4000 });
  }

  downloadPdf(url: string, filename: string) {
    const token = localStorage.getItem('access_token');
    fetch(url, { headers: { Authorization: 'Bearer ' + token } })
      .then(r => r.blob())
      .then(blob => {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = filename;
        a.click();
        URL.revokeObjectURL(a.href);
        this.generating.set(false);
        this.snack.open('Report downloaded', 'OK', { duration: 3000 });
      })
      .catch(() => { this.generating.set(false); this.snack.open('Failed to generate report', 'OK', { duration: 3000 }); });
  }

  downloadPdfAsync(url: string, filename: string): Promise<void> {
    const token = localStorage.getItem('access_token');
    return fetch(url, { headers: { Authorization: 'Bearer ' + token } })
      .then(r => r.blob())
      .then(blob => {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = filename;
        a.click();
        URL.revokeObjectURL(a.href);
      });
  }

  openTemplateDialog(template?: ReportTemplate) {
    const ref = this.dialog.open(TemplateDialogComponent, {
      width: '640px', maxHeight: '90vh', disableClose: true,
      data: template ?? null,
    });
    ref.afterClosed().subscribe((result: any) => {
      if (result) {
        this.snack.open(template ? 'Template updated' : 'Template created', 'OK', { duration: 3000 });
        this.loadTemplates();
      }
    });
  }

  setDefault(t: ReportTemplate) {
    this.api.put<any>('/reports/templates/' + t.id, { is_default: true }).subscribe({
      next: () => { this.snack.open(t.name + ' set as default', 'OK', { duration: 3000 }); this.loadTemplates(); },
      error: (err: any) => this.snack.open(err.error?.error?.message ?? 'Error', 'OK', { duration: 3000 }),
    });
  }

  deleteTemplate(t: ReportTemplate) {
    if (!confirm('Delete "' + t.name + '"?')) return;
    this.api.delete<any>('/reports/templates/' + t.id).subscribe({
      next: () => { this.snack.open('Template deleted', 'OK', { duration: 3000 }); this.loadTemplates(); },
      error: (err: any) => this.snack.open(err.error?.error?.message ?? 'Error', 'OK', { duration: 3000 }),
    });
  }

  assignTemplate(classId: string, templateId: string) {
    if (!templateId) {
      this.api.delete<any>('/reports/templates/assign/class/' + classId).subscribe({
        next: () => {
          this.classTemplates.update(m => { const n = {...m}; delete n[classId]; return n; });
          this.snack.open('Using school default', 'OK', { duration: 2000 });
        },
      });
    } else {
      this.api.post<any>('/reports/templates/assign/class/' + classId, { template_id: templateId }).subscribe({
        next: () => {
          this.classTemplates.update(m => ({ ...m, [classId]: templateId }));
          this.snack.open('Template assigned', 'OK', { duration: 2000 });
        },
      });
    }
  }

  getClassTemplate(classId: string): string { return this.classTemplates()[classId] ?? ''; }

  getEnabledSections(t: ReportTemplate) {
    return (t.sections ?? []).filter(s => s.enabled).sort((a, b) => a.order - b.order);
  }

  getSectionLabel(key: string): string {
    const labels: Record<string, string> = {
      cover: 'Cover', attendance: 'Attendance', mood: 'Mood',
      domain_progress: 'Progress', teacher_note: "Teacher's Note",
      homework_summary: 'Homework', photo_collage: 'Photos',
    };
    return labels[key] ?? key;
  }

  getSectionEmoji(key: string): string {
    const emojis: Record<string, string> = {
      cover: '📄', attendance: '✅', mood: '😊',
      domain_progress: '🎯', teacher_note: '📝',
      homework_summary: '📚', photo_collage: '📷',
    };
    return emojis[key] ?? '•';
  }

  getClassColor(name: string): string {
    const colors = ['#2563EB','#7C3AED','#DB2777','#D97706','#059669','#0891B2'];
    return colors[name.charCodeAt(0) % colors.length];
  }
}
