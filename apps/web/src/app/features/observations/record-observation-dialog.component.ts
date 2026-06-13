import { Component, inject, signal, OnInit } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ApiService } from '../../core/services/api.service';
import type { Domain, Milestone } from './observations.component';

const GRADES = [
  { value: 'not_started', label: 'Not Started', emoji: '⭕', color: '#9CA3AF', desc: 'Not yet introduced' },
  { value: 'in_progress', label: 'In Progress', emoji: '🟡', color: '#F59E0B', desc: 'Working on it with guidance' },
  { value: 'led',         label: 'Led',         emoji: '🔵', color: '#3B82F6', desc: 'Can do with some support' },
  { value: 'mastered',    label: 'Mastered',    emoji: '🟢', color: '#10B981', desc: 'Independent and consistent' },
];

@Component({
  selector: 'app-record-observation-dialog',
  standalone: true,
  imports: [
    ReactiveFormsModule, MatDialogModule,
    MatButtonModule, MatIconModule, MatProgressSpinnerModule,
  ],
  template: `
    <div class="dialog-shell">

      <div class="dialog-header">
        <div class="dh-icon"><mat-icon>psychology</mat-icon></div>
        <div>
          <div class="dh-title">Record Observation</div>
          <div class="dh-sub">Track a developmental milestone</div>
        </div>
        <button class="dh-close" mat-dialog-close><mat-icon>close</mat-icon></button>
      </div>

      <div class="dialog-body">
        <form [formGroup]="form" class="obs-form">

          <!-- Student -->
          <div class="field-group">
            <label class="field-label">Student <span class="req">*</span></label>
            <select class="field-input" formControlName="student_id">
              <option value="">— Select student —</option>
              @for (s of data.students; track s.id) {
                <option [value]="s.id">{{ s.first_name }} {{ s.last_name }} · {{ s.admission_no }}</option>
              }
            </select>
          </div>

          <!-- Domain filter -->
          <div class="form-row">
            <div class="field-group w-180">
              <label class="field-label">Domain</label>
              <select class="field-input" [value]="selectedDomainId()"
                      (change)="selectedDomainId.set($any($event.target).value)">
                <option value="">All Domains</option>
                @for (d of data.domains; track d.id) {
                  <option [value]="d.id">{{ getDomainEmoji(d.code) }} {{ d.name }}</option>
                }
              </select>
            </div>
            <div class="field-group fill">
              <label class="field-label">Milestone <span class="req">*</span></label>
              <select class="field-input" formControlName="milestone_id">
                <option value="">— Select milestone —</option>
                @for (m of filteredMilestones(); track m.id) {
                  <option [value]="m.id">{{ m.code }} — {{ m.name }}</option>
                }
              </select>
            </div>
          </div>

          <!-- Grade -->
          <div class="field-group">
            <label class="field-label">Grade <span class="req">*</span></label>
            <div class="grade-grid">
              @for (g of grades; track g.value) {
                <div class="grade-card" [class.selected]="form.value.grade === g.value"
                     [style.--gc]="g.color"
                     (click)="form.patchValue({ grade: g.value })">
                  <div class="gc-emoji">{{ g.emoji }}</div>
                  <div class="gc-label">{{ g.label }}</div>
                  <div class="gc-desc">{{ g.desc }}</div>
                </div>
              }
            </div>
          </div>

          <!-- Date & Notes -->
          <div class="form-row">
            <div class="field-group w-160">
              <label class="field-label">Observed On</label>
              <input class="field-input" type="date" formControlName="observed_on">
            </div>
            <div class="field-group fill">
              <label class="field-label">Notes <span class="hint">(optional)</span></label>
              <input class="field-input" formControlName="notes"
                     placeholder="e.g. Used pincer grip correctly, needed one reminder">
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
              <mat-icon style="font-size:15px;width:15px;height:15px">check</mat-icon>
              Save Observation
            </ng-container>
          }
        </button>
      </div>
    </div>
  `,
  styles: [`
    .dialog-shell { width: 540px; display: flex; flex-direction: column; max-height: 90vh; }

    .dialog-header {
      display: flex; align-items: center; gap: 12px;
      padding: 18px 24px 14px; border-bottom: 1px solid var(--border); flex-shrink: 0;
    }
    .dh-icon {
      width: 36px; height: 36px; border-radius: 9px;
      background: var(--purple-light); color: var(--purple);
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

    .dialog-body { padding: 18px 24px; overflow-y: auto; flex: 1; }
    .obs-form { display: flex; flex-direction: column; gap: 14px; }
    .form-row  { display: flex; gap: 10px; }
    .fill      { flex: 1; min-width: 0; }
    .w-180     { width: 180px; flex-shrink: 0; }
    .w-160     { width: 160px; flex-shrink: 0; }
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
      &:focus { border-color: var(--blue); box-shadow: 0 0 0 2px rgba(37,99,235,.1); }
    }
    select.field-input { cursor: pointer; }

    /* Grade grid */
    .grade-grid {
      display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px;
    }
    .grade-card {
      display: flex; flex-direction: column; align-items: center; gap: 4px; text-align: center;
      padding: 12px 8px; border: 2px solid var(--border);
      border-radius: 10px; cursor: pointer; transition: all .12s; background: #fff;
      &:hover    { border-color: var(--gc); }
      &.selected { border-color: var(--gc); background: color-mix(in srgb, var(--gc) 10%, white); }
    }
    .gc-emoji { font-size: 20px; line-height: 1; }
    .gc-label { font-size: 12px; font-weight: 600; color: var(--text-2);
      .grade-card.selected & { color: var(--gc); } }
    .gc-desc  { font-size: 10px; color: var(--text-3); line-height: 1.3; }

    .error-banner {
      display: flex; align-items: center; gap: 8px;
      background: var(--red-light); border: 1px solid #FECACA;
      color: #991B1B; padding: 10px 12px; border-radius: 8px; font-size: 12.5px;
    }

    .dialog-footer {
      display: flex; justify-content: flex-end; gap: 8px;
      padding: 14px 24px; border-top: 1px solid var(--border); background: var(--bg); flex-shrink: 0;
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
export class RecordObservationDialogComponent implements OnInit {
  private fb        = inject(FormBuilder);
  private api       = inject(ApiService);
  private dialogRef = inject(MatDialogRef<RecordObservationDialogComponent>);

  data: {
    domains:    Domain[];
    milestones: Milestone[];
    students:   any[];
    studentId:  string | null;
    milestoneId: string | null;
  } = inject(MAT_DIALOG_DATA);

  selectedDomainId = signal('');
  submitting       = signal(false);
  error            = signal('');
  grades           = GRADES;

  filteredMilestones = () => {
    const id = this.selectedDomainId();
    return id
      ? this.data.milestones.filter(m => m.domain_id === id)
      : this.data.milestones;
  };

  form = this.fb.group({
    student_id:   [this.data.studentId ?? '', Validators.required],
    milestone_id: [this.data.milestoneId ?? '', Validators.required],
    grade:        ['in_progress', Validators.required],
    observed_on:  [new Date().toISOString().slice(0, 10)],
    notes:        [''],
  });

  ngOnInit() {
    // Pre-select domain if milestone pre-selected
    if (this.data.milestoneId) {
      const m = this.data.milestones.find(m => m.id === this.data.milestoneId);
      if (m) this.selectedDomainId.set(m.domain_id);
    }
  }

  getDomainEmoji(code: string): string {
    const map: Record<string, string> = {
      practical_life: '🏠', language: '📖',
      mathematics: '🔢', cultural: '🌍', social_emotional: '💛',
    };
    return map[code] ?? '📌';
  }

  submit() {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    this.submitting.set(true);
    this.error.set('');

    const val = this.form.value;
    const payload: Record<string, unknown> = {
      student_id:   val.student_id,
      milestone_id: val.milestone_id,
      grade:        val.grade,
    };
    if (val.observed_on) payload['observed_on'] = val.observed_on;
    if (val.notes)       payload['notes']       = val.notes;

    this.api.post<any>('/observations', payload).subscribe({
      next: (res: any) => { this.submitting.set(false); this.dialogRef.close(res.data); },
      error: (err: any) => {
        this.submitting.set(false);
        this.error.set(err.error?.error?.message ?? 'Failed to save observation.');
      },
    });
  }
}
