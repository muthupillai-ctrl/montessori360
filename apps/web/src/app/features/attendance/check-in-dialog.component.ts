import { Component, inject, signal, OnInit } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ApiService } from '../../core/services/api.service';
import type { Student, SchoolClass, ApiResponse, PaginatedResponse } from '../../core/models';

@Component({
  selector: 'app-check-in-dialog',
  standalone: true,
  imports: [
    ReactiveFormsModule, MatDialogModule,
    MatButtonModule, MatIconModule, MatProgressSpinnerModule,
  ],
  template: `
    <div class="dialog-shell">

      <div class="dialog-header">
        <div class="dh-icon"><mat-icon>how_to_reg</mat-icon></div>
        <div>
          <div class="dh-title">Check In Student</div>
          <div class="dh-sub">Record attendance for a student</div>
        </div>
        <button class="dh-close" mat-dialog-close><mat-icon>close</mat-icon></button>
      </div>

      <div class="dialog-body">
        <form [formGroup]="form" class="ci-form">

          <div class="form-row">
            <div class="field-group" style="width:150px;flex-shrink:0">
              <label class="field-label">Filter by Class</label>
              <select class="field-input" [value]="selectedClass()"
                      (change)="onClassChange($any($event.target).value)">
                <option value="">All Classes</option>
                @for (cls of classes(); track cls.id) {
                  <option [value]="cls.id">{{ cls.name }}</option>
                }
              </select>
            </div>
            <div class="field-group flex-1">
              <label class="field-label">Student <span class="req">*</span></label>
              @if (studentsLoading()) {
                <div class="field-input loading-hint">
                  <mat-progress-spinner diameter="14" mode="indeterminate" /> Loading…
                </div>
              } @else {
                <select class="field-input" formControlName="student_id"
                        [class.err]="form.get('student_id')?.invalid && form.get('student_id')?.touched">
                  <option value="">— Select student —</option>
                  @for (s of students(); track s.id) {
                    <option [value]="s.id">{{ s.first_name }} {{ s.last_name }} · {{ s.admission_no }}</option>
                  }
                </select>
              }
            </div>
          </div>

          <div class="form-row">
            <div class="field-group flex-1">
              <label class="field-label">Date <span class="req">*</span></label>
              <input class="field-input" type="date" formControlName="date">
            </div>
            <div class="field-group flex-1">
              <label class="field-label">Check-in Time</label>
              <input class="field-input" type="time" formControlName="check_in_time">
            </div>
          </div>

          <div class="field-group">
            <label class="field-label">Status <span class="req">*</span></label>
            <div class="status-grid">
              @for (s of statuses; track s.value) {
                <div class="status-card"
                     [class.selected]="form.value.status === s.value"
                     [style.--s-color]="s.color"
                     (click)="form.patchValue({ status: s.value })">
                  <mat-icon style="font-size:18px;width:18px;height:18px">{{ s.icon }}</mat-icon>
                  <span>{{ s.label }}</span>
                </div>
              }
            </div>
          </div>

          <div class="field-group">
            <label class="field-label">Mode</label>
            <select class="field-input" formControlName="mode">
              <option value="manual">Manual</option>
              <option value="qr">QR Code</option>
              <option value="biometric">Biometric</option>
            </select>
          </div>

          <div class="field-group">
            <label class="field-label">Notes <span class="hint">— optional</span></label>
            <input class="field-input" formControlName="notes" placeholder="e.g. Left early due to appointment">
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
              Save Attendance
            </ng-container>
          }
        </button>
      </div>
    </div>
  `,
  styles: [`
    .dialog-shell { width: 480px; display: flex; flex-direction: column; }

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

    .dialog-body { padding: 20px 24px; }
    .ci-form     { display: flex; flex-direction: column; gap: 14px; }
    .form-row    { display: flex; gap: 10px; }
    .flex-1      { flex: 1; min-width: 0; }
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
      &::placeholder { color: var(--text-4); }
      &:focus { border-color: var(--blue); box-shadow: 0 0 0 2px rgba(37,99,235,.1); }
      &.err { border-color: var(--red); }
    }
    select.field-input { cursor: pointer; }
    .loading-hint {
      display: flex; align-items: center; gap: 8px;
      color: var(--text-3); font-size: 12px; background: var(--bg);
    }

    /* Status grid */
    .status-grid {
      display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px;
    }
    .status-card {
      display: flex; flex-direction: column; align-items: center; gap: 5px;
      padding: 10px 8px; border: 1.5px solid var(--border);
      border-radius: 9px; cursor: pointer; transition: all .12s;
      font-size: 12px; font-weight: 500; color: var(--text-2);
      mat-icon { color: var(--text-3); }
      &:hover    { border-color: var(--s-color, var(--blue)); background: rgba(0,0,0,.02); }
      &.selected {
        border-color: var(--s-color, var(--blue));
        background: color-mix(in srgb, var(--s-color, var(--blue)) 10%, white);
        color: var(--s-color, var(--blue));
        mat-icon { color: var(--s-color, var(--blue)); }
      }
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
export class CheckInDialogComponent implements OnInit {
  private fb        = inject(FormBuilder);
  private api       = inject(ApiService);
  private dialogRef = inject(MatDialogRef<CheckInDialogComponent>);

  classes        = signal<SchoolClass[]>([]);
  students       = signal<Student[]>([]);
  studentsLoading = signal(false);
  selectedClass  = signal('');
  submitting     = signal(false);
  error          = signal('');

  statuses = [
    { value: 'present',  label: 'Present',  icon: 'check_circle', color: '#10B981' },
    { value: 'absent',   label: 'Absent',   icon: 'cancel',       color: '#EF4444' },
    { value: 'late',     label: 'Late',     icon: 'schedule',     color: '#F59E0B' },
    { value: 'half_day', label: 'Half Day', icon: 'brightness_5', color: '#6366F1' },
  ];

  form = this.fb.group({
    student_id:    ['', Validators.required],
    date:          [new Date().toISOString().slice(0, 10), Validators.required],
    check_in_time: [this.nowTime()],
    status:        ['present', Validators.required],
    mode:          ['manual'],
    notes:         [''],
  });

  ngOnInit() {
    this.api.get<any>('/students/classes').subscribe({
      next: (res: any) => this.classes.set(res.data ?? []),
    });
    this.loadStudents('');
  }

  loadStudents(classId: string) {
    this.studentsLoading.set(true);
    const params: Record<string, string> = { limit: '500', page: '1', is_active: 'true' };
    if (classId) params['class_id'] = classId;
    this.api.get<any>('/students', params).subscribe({
      next: (res: any) => { this.students.set(res.data ?? []); this.studentsLoading.set(false); },
      error: () => this.studentsLoading.set(false),
    });
  }

  onClassChange(id: string) {
    this.selectedClass.set(id);
    this.form.patchValue({ student_id: '' });
    this.loadStudents(id);
  }

  nowTime(): string {
    const now = new Date();
    return now.getHours().toString().padStart(2, '0') + ':' + now.getMinutes().toString().padStart(2, '0');
  }

  submit() {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    this.submitting.set(true);
    this.error.set('');

    const val = this.form.value;
    const payload: Record<string, unknown> = {
      student_id: val.student_id,
      date:       val.date,
      status:     val.status,
      mode:       val.mode,
    };
    if (val.check_in_time) payload['check_in_time'] = val.date + 'T' + val.check_in_time + ':00';
    if (val.notes)         payload['notes']         = val.notes;

    this.api.post<any>('/attendance/check-in', payload).subscribe({
      next: (res: any) => { this.submitting.set(false); this.dialogRef.close(res.data ?? true); },
      error: (err: any) => {
        this.submitting.set(false);
        this.error.set(err.error?.error?.message ?? 'Failed to record attendance.');
      },
    });
  }
}
