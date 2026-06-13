import { Component, inject, signal, OnInit } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ApiService } from '../../core/services/api.service';
import type { Student, SchoolClass, ApiResponse } from '../../core/models';

@Component({
  selector: 'app-edit-student-dialog',
  standalone: true,
  imports: [
    ReactiveFormsModule, MatDialogModule,
    MatButtonModule, MatIconModule, MatProgressSpinnerModule,
  ],
  template: `
    <div class="dialog-shell">

      <div class="dialog-header">
        <div class="dh-icon blue"><mat-icon>edit</mat-icon></div>
        <div>
          <div class="dh-title">Edit Student</div>
          <div class="dh-sub">{{ student.first_name }} {{ student.last_name }} · {{ student.admission_no }}</div>
        </div>
        <button class="dh-close" mat-dialog-close><mat-icon>close</mat-icon></button>
      </div>

      <div class="dialog-body">
        <form [formGroup]="form" class="edit-form">

          <div class="form-row">
            <div class="field-group flex-1">
              <label class="field-label">First Name <span class="req">*</span></label>
              <input class="field-input" formControlName="first_name"
                     [class.err]="form.get('first_name')?.invalid && form.get('first_name')?.touched">
            </div>
            <div class="field-group flex-1">
              <label class="field-label">Last Name <span class="req">*</span></label>
              <input class="field-input" formControlName="last_name"
                     [class.err]="form.get('last_name')?.invalid && form.get('last_name')?.touched">
            </div>
          </div>

          <div class="form-row">
            <div class="field-group flex-1">
              <label class="field-label">Date of Birth <span class="req">*</span></label>
              <input class="field-input" type="date" formControlName="dob">
            </div>
            <div class="field-group flex-1">
              <label class="field-label">Gender</label>
              <select class="field-input" formControlName="gender">
                <option value="">Select</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
              </select>
            </div>
          </div>

          <div class="form-row">
            <div class="field-group flex-1">
              <label class="field-label">Blood Group</label>
              <select class="field-input" formControlName="blood_group">
                <option value="">Unknown</option>
                @for (bg of bloodGroups; track bg) {
                  <option [value]="bg">{{ bg }}</option>
                }
              </select>
            </div>
            <div class="field-group flex-1">
              <label class="field-label">Nationality</label>
              <input class="field-input" formControlName="nationality">
            </div>
          </div>

          <div class="field-group">
            <label class="field-label">Allergies <span class="hint">(comma separated)</span></label>
            <input class="field-input" formControlName="allergies_text" placeholder="e.g. Peanuts, Dairy">
          </div>

          <div class="field-group">
            <label class="field-label">Dietary Notes</label>
            <input class="field-input" formControlName="dietary_notes" placeholder="e.g. Vegetarian">
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
              Save Changes
            </ng-container>
          }
        </button>
      </div>

    </div>
  `,
  styles: [`
    .dialog-shell { width: 500px; display: flex; flex-direction: column; }

    .dialog-header {
      display: flex; align-items: center; gap: 12px;
      padding: 20px 24px 16px; border-bottom: 1px solid var(--border);
    }
    .dh-icon {
      width: 36px; height: 36px; border-radius: 9px;
      display: flex; align-items: center; justify-content: center; flex-shrink: 0;
      mat-icon { font-size: 18px; width: 18px; height: 18px; }
      &.blue { background: var(--blue-light); color: var(--blue); }
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
    .edit-form   { display: flex; flex-direction: column; gap: 14px; }
    .form-row    { display: flex; gap: 12px; }
    .flex-1      { flex: 1; min-width: 0; }
    .field-group { display: flex; flex-direction: column; gap: 5px; }

    .field-label {
      font-size: 12px; font-weight: 500; color: var(--text-2);
      .req  { color: var(--red); }
      .hint { font-size: 11px; color: var(--text-4); font-weight: 400; }
    }
    .field-input {
      width: 100%; height: 36px; padding: 0 10px;
      background: #fff; border: 1px solid var(--border);
      border-radius: 7px; font-size: 13px; color: var(--text);
      outline: none; font-family: inherit;
      &::placeholder { color: var(--text-4); }
      &:focus { border-color: var(--blue); box-shadow: 0 0 0 3px rgba(37,99,235,.1); }
      &.err { border-color: var(--red); }
    }
    select.field-input { cursor: pointer; }

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
      &:hover { background: var(--border-light); color: var(--text-2); }
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
export class EditStudentDialogComponent {
  private fb        = inject(FormBuilder);
  private api       = inject(ApiService);
  private dialogRef = inject(MatDialogRef<EditStudentDialogComponent>);

  student: Student = inject(MAT_DIALOG_DATA);

  submitting = signal(false);
  error      = signal('');

  bloodGroups = ['A+','A-','B+','B-','AB+','AB-','O+','O-'];

  form = this.fb.group({
    first_name:     [this.student.first_name, Validators.required],
    last_name:      [this.student.last_name,  Validators.required],
    dob:            [this.student.dob ?? '',  Validators.required],
    gender:         [this.student.gender ?? ''],
    blood_group:    [this.student.blood_group ?? ''],
    nationality:    [this.student.nationality ?? 'Indian'],
    allergies_text: [(this.student.allergies ?? []).join(', ')],
    dietary_notes:  [this.student.dietary_notes ?? ''],
  });

  submit() {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    this.submitting.set(true);
    this.error.set('');

    const val = this.form.value;
    const allergies = val.allergies_text
      ? val.allergies_text.split(',').map((s: string) => s.trim()).filter(Boolean)
      : [];

    const payload: Record<string, unknown> = {
      first_name:   val.first_name,
      last_name:    val.last_name,
      dob:          val.dob,
      gender:       val.gender || undefined,
      blood_group:  val.blood_group || undefined,
      nationality:  val.nationality,
      allergies,
      dietary_notes: val.dietary_notes || undefined,
    };

    this.api.put('/students/' + this.student.id, payload).subscribe({
      next: (res: any) => { this.submitting.set(false); this.dialogRef.close(res.data); },
      error: (err: any) => {
        this.submitting.set(false);
        this.error.set(err.error?.error?.message ?? 'Update failed. Please try again.');
      },
    });
  }
}
