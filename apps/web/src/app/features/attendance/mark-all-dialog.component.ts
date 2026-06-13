import { Component, inject, signal, OnInit } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ApiService } from '../../core/services/api.service';
import type { SchoolClass } from '../../core/models';

@Component({
  selector: 'app-mark-all-dialog',
  standalone: true,
  imports: [
    ReactiveFormsModule, MatDialogModule,
    MatButtonModule, MatIconModule, MatProgressSpinnerModule,
  ],
  template: `
    <div class="dialog-shell">

      <div class="dialog-header">
        <div class="dh-icon"><mat-icon>done_all</mat-icon></div>
        <div>
          <div class="dh-title">Mark All Present</div>
          <div class="dh-sub">Bulk mark students as present for a date</div>
        </div>
        <button class="dh-close" mat-dialog-close><mat-icon>close</mat-icon></button>
      </div>

      <div class="dialog-body">

        <div class="info-banner">
          <mat-icon style="font-size:16px;width:16px;height:16px;flex-shrink:0;color:var(--blue)">info</mat-icon>
          Only students who have <strong>not yet been marked</strong> for the selected date will be updated.
          Already marked students will be skipped.
        </div>

        <form [formGroup]="form" class="ma-form">

          <div class="form-row">
            <div class="field-group flex-1">
              <label class="field-label">Date <span class="req">*</span></label>
              <input class="field-input" type="date" formControlName="date">
            </div>
            <div class="field-group flex-1">
              <label class="field-label">Class <span class="hint">— optional</span></label>
              <select class="field-input" formControlName="class_id">
                <option value="">All Classes</option>
                @for (cls of classes(); track cls.id) {
                  <option [value]="cls.id">{{ cls.name }} ({{ cls.enrolled_count }})</option>
                }
              </select>
            </div>
          </div>

          <div class="field-group">
            <label class="field-label">Mark As <span class="req">*</span></label>
            <div class="status-row">
              @for (s of statuses; track s.value) {
                <div class="status-chip"
                     [class.selected]="form.value.status === s.value"
                     [style.--c]="s.color"
                     (click)="form.patchValue({ status: s.value })">
                  <mat-icon style="font-size:15px;width:15px;height:15px">{{ s.icon }}</mat-icon>
                  {{ s.label }}
                </div>
              }
            </div>
          </div>

          <div class="field-group">
            <label class="field-label">Check-in Time <span class="hint">— optional</span></label>
            <input class="field-input" type="time" formControlName="check_in_time">
          </div>

          <!-- Estimate -->
          @if (estimatedCount() > 0) {
            <div class="estimate-box">
              <mat-icon style="font-size:16px;width:16px;height:16px;color:var(--blue)">people</mat-icon>
              <span>Will mark approximately <strong>{{ estimatedCount() }}</strong> students as present</span>
            </div>
          }

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
              <mat-icon style="font-size:15px;width:15px;height:15px">done_all</mat-icon>
              Mark All Present
            </ng-container>
          }
        </button>
      </div>
    </div>
  `,
  styles: [`
    .dialog-shell { width: 460px; display: flex; flex-direction: column; }

    .dialog-header {
      display: flex; align-items: center; gap: 12px;
      padding: 20px 24px 16px; border-bottom: 1px solid var(--border); flex-shrink: 0;
    }
    .dh-icon {
      width: 36px; height: 36px; border-radius: 9px;
      background: var(--green-light); color: var(--green);
      display: flex; align-items: center; justify-content: center; flex-shrink: 0;
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

    .dialog-body { padding: 18px 24px; display: flex; flex-direction: column; gap: 14px; }

    .info-banner {
      display: flex; align-items: flex-start; gap: 8px;
      background: var(--blue-light); border-radius: 8px;
      padding: 10px 12px; font-size: 12px; color: #1E40AF; line-height: 1.5;
    }

    .ma-form    { display: flex; flex-direction: column; gap: 14px; }
    .form-row   { display: flex; gap: 10px; }
    .flex-1     { flex: 1; min-width: 0; }
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

    .status-row {
      display: flex; gap: 8px;
    }
    .status-chip {
      display: flex; align-items: center; gap: 5px;
      padding: 7px 12px; border: 1.5px solid var(--border);
      border-radius: 8px; cursor: pointer; transition: all .12s;
      font-size: 12.5px; font-weight: 500; color: var(--text-2);
      mat-icon { color: var(--text-3); }
      &:hover    { border-color: var(--c); }
      &.selected {
        border-color: var(--c); background: color-mix(in srgb, var(--c) 10%, white);
        color: var(--c); mat-icon { color: var(--c); }
      }
    }

    .estimate-box {
      display: flex; align-items: center; gap: 8px;
      background: var(--blue-light); border-radius: 8px;
      padding: 10px 12px; font-size: 12.5px; color: #1E40AF;
    }

    .error-banner {
      display: flex; align-items: center; gap: 8px;
      background: var(--red-light); border: 1px solid #FECACA;
      color: #991B1B; padding: 10px 12px; border-radius: 8px; font-size: 12.5px;
    }

    .dialog-footer {
      display: flex; justify-content: flex-end; gap: 8px;
      padding: 14px 24px; border-top: 1px solid var(--border); background: var(--bg);
    }
    .btn-ghost {
      background: none; border: none; cursor: pointer;
      font-size: 13px; color: var(--text-3); padding: 0 10px; height: 36px; border-radius: 7px;
      &:hover { background: var(--border-light); }
    }
    .btn-primary {
      display: flex; align-items: center; gap: 6px;
      background: var(--green); color: #fff;
      border: none; border-radius: 8px; height: 36px; padding: 0 18px;
      font-size: 13px; font-weight: 500; cursor: pointer;
      &:hover:not(:disabled) { background: #059669; }
      &:disabled { opacity: .6; cursor: not-allowed; }
    }
  `],
})
export class MarkAllDialogComponent implements OnInit {
  private fb        = inject(FormBuilder);
  private api       = inject(ApiService);
  private dialogRef = inject(MatDialogRef<MarkAllDialogComponent>);

  data = inject(MAT_DIALOG_DATA) as { date: string; classes: SchoolClass[] };

  classes    = signal<SchoolClass[]>([]);
  submitting = signal(false);
  error      = signal('');

  statuses = [
    { value: 'present',  label: 'Present',  icon: 'check_circle', color: '#10B981' },
    { value: 'late',     label: 'Late',     icon: 'schedule',     color: '#F59E0B' },
    { value: 'absent',   label: 'Absent',   icon: 'cancel',       color: '#EF4444' },
  ];

  form = this.fb.group({
    date:           [this.data.date, Validators.required],
    class_id:       [''],
    status:         ['present', Validators.required],
    check_in_time:  [this.nowTime()],
  });

  ngOnInit() { this.classes.set(this.data.classes); }

  estimatedCount(): number {
    const id = this.form.value.class_id;
    if (id) return this.classes().find(c => c.id === id)?.enrolled_count ?? 0;
    return this.classes().reduce((s, c) => s + (c.enrolled_count ?? 0), 0);
  }

  nowTime(): string {
    const now = new Date();
    return now.getHours().toString().padStart(2, '0') + ':' + now.getMinutes().toString().padStart(2, '0');
  }

  submit() {
    if (this.form.invalid) return;
    this.submitting.set(true);
    this.error.set('');

    const val = this.form.value;
    // First fetch students to build records array
    const params: Record<string, string> = { limit: '500', page: '1', is_active: 'true' };
    if (val.class_id) params['class_id'] = val.class_id!;

    this.api.get<any>('/students', params).subscribe({
      next: (res: any) => {
        const students = res.data ?? [];
        if (!students.length) {
          this.submitting.set(false);
          this.error.set('No active students found.');
          return;
        }
        const records = students.map((s: any) => ({
          student_id: s.id,
          status: val.status,
        }));
        const payload: Record<string, unknown> = { date: val.date, records };

        this.api.post<any>('/attendance/bulk-mark', payload).subscribe({
          next: () => {
            this.submitting.set(false);
            this.dialogRef.close({ count: records.length });
          },
          error: (err: any) => {
            this.submitting.set(false);
            this.error.set(err.error?.error?.message ?? 'Failed to mark attendance.');
          },
        });
      },
      error: () => { this.submitting.set(false); this.error.set('Failed to load students.'); },
    });
  }
}
