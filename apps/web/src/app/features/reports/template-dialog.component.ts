import { Component, inject, signal, OnInit } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ApiService } from '../../core/services/api.service';
import type { ReportTemplate } from './reports.component';

const ALL_SECTIONS = [
  { key: 'cover',            emoji: '📄', label: 'Cover Page',       desc: 'School name, student details, term' },
  { key: 'attendance',       emoji: '✅', label: 'Attendance',       desc: 'Present / absent / late counts' },
  { key: 'mood',             emoji: '😊', label: 'Mood & Wellbeing', desc: 'Mood trend from daily journals' },
  { key: 'domain_progress',  emoji: '🎯', label: 'Domain Progress',  desc: 'Milestone mastery per domain' },
  { key: 'teacher_note',     emoji: '📝', label: "Teacher's Note",   desc: 'Observations from teacher' },
  { key: 'homework_summary', emoji: '📚', label: 'Homework',         desc: 'Homework completion summary' },
  { key: 'photo_collage',    emoji: '📷', label: 'Photo Collage',    desc: 'Journal photos (if available)' },
];

@Component({
  selector: 'app-template-dialog',
  standalone: true,
  imports: [
    ReactiveFormsModule, MatDialogModule,
    MatIconModule, MatProgressSpinnerModule,
  ],
  template: `
    <div class="dialog-shell">

      <div class="dialog-header">
        <div class="dh-icon"><mat-icon>palette</mat-icon></div>
        <div>
          <div class="dh-title">{{ isEdit ? 'Edit Template' : 'New Template' }}</div>
          <div class="dh-sub">Customise the layout and design of progress cards</div>
        </div>
        <button class="dh-close" mat-dialog-close><mat-icon>close</mat-icon></button>
      </div>

      <div class="dialog-body">
        <form [formGroup]="form" class="tpl-form">

          <!-- Basic info -->
          <div class="form-section">
            <div class="fs-label">Template Details</div>
            <div class="field-group">
              <label class="field-label">Template Name <span class="req">*</span></label>
              <input class="field-input" formControlName="name" placeholder="e.g. Standard Progress Card">
            </div>
            <div class="field-group">
              <label class="field-label">Description <span class="hint">(optional)</span></label>
              <input class="field-input" formControlName="description" placeholder="Brief description of this template">
            </div>
          </div>

          <!-- Colours -->
          <div class="form-section">
            <div class="fs-label">Colours</div>
            <div class="colour-row">
              <div class="field-group">
                <label class="field-label">Primary</label>
                <div class="colour-pick">
                  <input type="color" class="colour-input" formControlName="primary_colour">
                  <input class="field-input colour-hex" formControlName="primary_colour" placeholder="#1F3864">
                </div>
              </div>
              <div class="field-group">
                <label class="field-label">Secondary</label>
                <div class="colour-pick">
                  <input type="color" class="colour-input" formControlName="secondary_colour">
                  <input class="field-input colour-hex" formControlName="secondary_colour" placeholder="#2E5AA8">
                </div>
              </div>
              <div class="field-group">
                <label class="field-label">Accent</label>
                <div class="colour-pick">
                  <input type="color" class="colour-input" formControlName="accent_colour">
                  <input class="field-input colour-hex" formControlName="accent_colour" placeholder="#D6E4F0">
                </div>
              </div>
            </div>

            <!-- Live preview strip -->
            <div class="preview-strip"
                 [style.background]="form.value.primary_colour || '#1F3864'">
              <div class="ps-title" [style.color]="form.value.accent_colour || '#D6E4F0'">
                {{ form.value.name || 'Progress Report' }}
              </div>
              <div class="ps-sub" [style.color]="(form.value.accent_colour || '#D6E4F0') + 'AA'">
                Montessori360 · {{ form.value.font || 'helvetica' }}
              </div>
              <div class="ps-bar" [style.background]="form.value.secondary_colour || '#2E5AA8'"></div>
            </div>
          </div>

          <!-- Font -->
          <div class="form-section">
            <div class="fs-label">Font</div>
            <div class="font-row">
              @for (f of fonts; track f.value) {
                <div class="font-card" [class.selected]="form.value.font === f.value"
                     (click)="form.patchValue({ font: f.value })">
                  <div class="fc-sample" [style.font-family]="f.css">Aa</div>
                  <div class="fc-name">{{ f.label }}</div>
                </div>
              }
            </div>
          </div>

          <!-- Sections -->
          <div class="form-section">
            <div class="fs-label">Sections</div>
            <div class="sections-list">
              @for (s of allSections; track s.key) {
                <div class="section-row" [class.enabled]="isSectionEnabled(s.key)"
                     (click)="toggleSection(s.key)">
                  <div class="sr-toggle">
                    <div class="toggle-track" [class.on]="isSectionEnabled(s.key)">
                      <div class="toggle-thumb"></div>
                    </div>
                  </div>
                  <div class="sr-emoji">{{ s.emoji }}</div>
                  <div class="sr-info">
                    <div class="sr-label">{{ s.label }}</div>
                    <div class="sr-desc">{{ s.desc }}</div>
                  </div>
                </div>
              }
            </div>
          </div>

          <!-- Default -->
          <div class="form-section">
            <div class="default-row" (click)="form.patchValue({ is_default: !form.value.is_default })">
              <div class="toggle-track" [class.on]="form.value.is_default">
                <div class="toggle-thumb"></div>
              </div>
              <div>
                <div class="dr-label">Set as school default</div>
                <div class="dr-desc">All classes will use this template unless overridden</div>
              </div>
            </div>
          </div>

          @if (error()) {
            <div class="error-banner">
              <mat-icon style="font-size:15px;width:15px;height:15px;flex-shrink:0">error_outline</mat-icon>
              {{ error() }}
            </div>
          }

        </form>
      </div>

      <div class="dialog-footer">
        <button class="btn-ghost" mat-dialog-close>Cancel</button>
        <button class="btn-primary" (click)="submit()" [disabled]="form.invalid || submitting()">
          @if (submitting()) {
            <mat-progress-spinner diameter="16" mode="indeterminate"
              style="--mdc-circular-progress-active-indicator-color:#fff" />
          } @else {
            <ng-container>
              <mat-icon style="font-size:15px;width:15px;height:15px">save</mat-icon>
              {{ isEdit ? 'Save Changes' : 'Create Template' }}
            </ng-container>
          }
        </button>
      </div>
    </div>
  `,
  styles: [`
    .dialog-shell { width: 600px; display: flex; flex-direction: column; max-height: 90vh; }

    .dialog-header {
      display: flex; align-items: center; gap: 12px;
      padding: 18px 24px 14px; border-bottom: 1px solid var(--border); flex-shrink: 0;
    }
    .dh-icon {
      width: 36px; height: 36px; border-radius: 9px;
      background: var(--purple-light); color: var(--purple); flex-shrink: 0;
      display: flex; align-items: center; justify-content: center;
      mat-icon { font-size: 18px; width: 18px; height: 18px; }
    }
    .dh-title { font-size: 15px; font-weight: 600; color: var(--text); }
    .dh-sub   { font-size: 11px; color: var(--text-3); margin-top: 2px; }
    .dh-close {
      margin-left: auto; background: none; border: none;
      width: 28px; height: 28px; border-radius: 6px; cursor: pointer; color: var(--text-3);
      display: flex; align-items: center; justify-content: center;
      &:hover { background: var(--bg); }
      mat-icon { font-size: 18px; width: 18px; height: 18px; }
    }

    .dialog-body { flex: 1; overflow-y: auto; padding: 18px 24px; background: var(--bg); }
    .tpl-form { display: flex; flex-direction: column; gap: 16px; }

    .form-section {
      background: var(--surface); border: 1px solid var(--border);
      border-radius: 9px; padding: 14px; display: flex; flex-direction: column; gap: 10px;
    }
    .fs-label {
      font-size: 11px; font-weight: 600; text-transform: uppercase;
      letter-spacing: .4px; color: var(--text-4);
    }
    .field-group { display: flex; flex-direction: column; gap: 5px; }
    .field-label {
      font-size: 12px; font-weight: 500; color: var(--text-2);
      .req  { color: var(--red); }
      .hint { font-size: 11px; color: var(--text-4); font-weight: 400; }
    }
    .field-input {
      height: 36px; padding: 0 10px; width: 100%;
      background: #fff; border: 1px solid var(--border);
      border-radius: 7px; font-size: 13px; color: var(--text);
      outline: none; font-family: inherit;
      &:focus { border-color: var(--blue); }
    }

    /* Colours */
    .colour-row { display: flex; gap: 12px; }
    .colour-pick { display: flex; align-items: center; gap: 6px; }
    .colour-input {
      width: 36px; height: 36px; border-radius: 7px; border: 1px solid var(--border);
      padding: 2px; cursor: pointer; background: none;
    }
    .colour-hex { width: 100px; font-family: monospace; font-size: 12px; }

    /* Preview strip */
    .preview-strip {
      border-radius: 8px; padding: 14px 16px; position: relative; overflow: hidden;
      transition: background .3s;
    }
    .ps-title { font-size: 16px; font-weight: 700; transition: color .3s; }
    .ps-sub   { font-size: 11px; margin-top: 3px; transition: color .3s; }
    .ps-bar   { position: absolute; bottom: 0; left: 0; right: 0; height: 4px; transition: background .3s; }

    /* Fonts */
    .font-row { display: flex; gap: 10px; }
    .font-card {
      display: flex; flex-direction: column; align-items: center; gap: 4px;
      padding: 12px 18px; border: 2px solid var(--border); border-radius: 9px;
      cursor: pointer; background: #fff; transition: all .12s;
      &:hover    { border-color: var(--blue); }
      &.selected { border-color: var(--blue); background: var(--blue-light); }
    }
    .fc-sample { font-size: 24px; font-weight: 700; color: var(--text); line-height: 1; }
    .fc-name   { font-size: 11px; color: var(--text-3); }
    .font-card.selected .fc-name { color: var(--blue); font-weight: 600; }

    /* Sections */
    .sections-list { display: flex; flex-direction: column; gap: 0; }
    .section-row {
      display: flex; align-items: center; gap: 10px;
      padding: 10px 0; border-bottom: 1px solid var(--border-light); cursor: pointer;
      &:last-child { border-bottom: none; }
      &:hover { background: var(--bg); border-radius: 6px; padding-left: 6px; margin: 0 -6px; }
    }
    .sr-emoji { font-size: 18px; width: 24px; text-align: center; }
    .sr-label { font-size: 13px; font-weight: 500; color: var(--text); }
    .sr-desc  { font-size: 11px; color: var(--text-3); }

    /* Toggle */
    .toggle-track {
      width: 34px; height: 19px; border-radius: 10px; background: var(--border);
      position: relative; transition: background .2s; flex-shrink: 0;
      &.on { background: var(--green); }
    }
    .toggle-thumb {
      width: 15px; height: 15px; border-radius: 50%; background: #fff;
      position: absolute; top: 2px; left: 2px; transition: left .2s;
      box-shadow: 0 1px 3px rgba(0,0,0,.2);
      .toggle-track.on & { left: 17px; }
    }

    /* Default row */
    .default-row {
      display: flex; align-items: center; gap: 12px; cursor: pointer;
    }
    .dr-label { font-size: 13px; font-weight: 500; color: var(--text); }
    .dr-desc  { font-size: 11px; color: var(--text-3); }

    .error-banner {
      display: flex; align-items: center; gap: 8px;
      background: var(--red-light); border: 1px solid #FECACA;
      color: #991B1B; padding: 10px 12px; border-radius: 8px; font-size: 12.5px;
    }

    .dialog-footer {
      display: flex; justify-content: flex-end; gap: 8px;
      padding: 14px 24px; border-top: 1px solid var(--border);
      background: var(--surface); flex-shrink: 0;
    }
    .btn-ghost {
      background: none; border: none; cursor: pointer;
      font-size: 13px; color: var(--text-3); padding: 0 10px; height: 36px; border-radius: 7px;
      &:hover { background: var(--border-light); }
    }
    .btn-primary {
      display: flex; align-items: center; gap: 6px;
      background: var(--blue); color: #fff;
      border: none; border-radius: 8px; height: 36px; padding: 0 18px;
      font-size: 13px; font-weight: 500; cursor: pointer;
      &:hover:not(:disabled) { background: #1D4ED8; }
      &:disabled { opacity: .6; cursor: not-allowed; }
    }
  `],
})
export class TemplateDialogComponent implements OnInit {
  private fb        = inject(FormBuilder);
  private api       = inject(ApiService);
  private dialogRef = inject(MatDialogRef<TemplateDialogComponent>);

  template: ReportTemplate | null = inject(MAT_DIALOG_DATA);
  isEdit      = !!this.template;
  submitting  = signal(false);
  error       = signal('');
  allSections = ALL_SECTIONS;

  fonts = [
    { value: 'helvetica', label: 'Helvetica', css: 'Helvetica, Arial, sans-serif' },
    { value: 'times',     label: 'Times',     css: 'Times New Roman, serif' },
    { value: 'courier',   label: 'Courier',   css: 'Courier New, monospace' },
  ];

  // Track section enabled state
  sectionState = signal<Record<string, boolean>>({});

  form = this.fb.group({
    name:             [this.template?.name ?? '',             Validators.required],
    description:      [this.template?.description ?? ''],
    primary_colour:   [this.template?.primary_colour   ?? '#1F3864'],
    secondary_colour: [this.template?.secondary_colour ?? '#2E5AA8'],
    accent_colour:    [this.template?.accent_colour    ?? '#D6E4F0'],
    font:             [this.template?.font             ?? 'helvetica'],
    is_default:       [this.template?.is_default       ?? false],
  });

  ngOnInit() {
    // Init section states from template or defaults
    const state: Record<string, boolean> = {};
    ALL_SECTIONS.forEach(s => {
      const existing = this.template?.sections?.find(ts => ts.key === s.key);
      state[s.key] = existing ? existing.enabled : ['cover','attendance','domain_progress','teacher_note'].includes(s.key);
    });
    this.sectionState.set(state);
  }

  isSectionEnabled(key: string): boolean { return this.sectionState()[key] ?? false; }

  toggleSection(key: string) {
    this.sectionState.update(s => ({ ...s, [key]: !s[key] }));
  }

  buildSections() {
    return ALL_SECTIONS.map((s, i) => ({
      key:     s.key,
      enabled: this.sectionState()[s.key] ?? false,
      order:   i + 1,
    }));
  }

  submit() {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    this.submitting.set(true);
    this.error.set('');

    const payload = { ...this.form.value, sections: this.buildSections() };

    const req = this.isEdit
      ? this.api.put<any>('/reports/templates/' + this.template!.id, payload)
      : this.api.post<any>('/reports/templates', payload);

    req.subscribe({
      next: (res: any) => { this.submitting.set(false); this.dialogRef.close(res.data); },
      error: (err: any) => {
        this.submitting.set(false);
        this.error.set(err.error?.error?.message ?? 'Failed to save template.');
      },
    });
  }
}
