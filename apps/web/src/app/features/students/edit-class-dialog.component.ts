import { Component, inject, signal, OnInit } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ApiService } from '../../core/services/api.service';
import type { SchoolClass } from '../../core/models';

@Component({
  selector: 'app-edit-class-dialog',
  standalone: true,
  imports: [
    ReactiveFormsModule, MatDialogModule,
    MatButtonModule, MatIconModule, MatProgressSpinnerModule,
  ],
  template: `
    <div class="dialog-shell">

      <div class="dialog-header">
        <div class="dh-icon"><mat-icon>edit</mat-icon></div>
        <div>
          <div class="dh-title">Edit Class</div>
          <div class="dh-sub">Update class details</div>
        </div>
        <button class="dh-close" mat-dialog-close>
          <mat-icon>close</mat-icon>
        </button>
      </div>

      <div class="dialog-body">
        <form [formGroup]="form" class="edit-form">

          <div class="field-group">
            <label class="field-label">Class Name <span class="req">*</span></label>
            <input class="field-input" formControlName="name" placeholder="e.g. Casa 1"
                   [class.err]="form.get('name')?.invalid && form.get('name')?.touched">
            @if (form.get('name')?.invalid && form.get('name')?.touched) {
              <div class="field-error">Class name is required</div>
            }
          </div>

          <div class="form-row">
            <div class="field-group flex-1">
              <label class="field-label">Capacity <span class="req">*</span></label>
              <input class="field-input" type="number" formControlName="capacity" min="1"
                     [class.err]="form.get('capacity')?.invalid && form.get('capacity')?.touched">
              @if (form.get('capacity')?.invalid && form.get('capacity')?.touched) {
                <div class="field-error">Capacity must be at least 1</div>
              }
              @if (cls.enrolled_count > 0) {
                <div class="field-hint">{{ cls.enrolled_count }} students currently enrolled</div>
              }
            </div>
          </div>

          <div class="section-divider">Age Group <span class="optional">(optional)</span></div>

          <div class="form-row">
            <div class="field-group flex-1">
              <label class="field-label">From (months)</label>
              <input class="field-input" type="number" formControlName="age_group_min"
                     placeholder="e.g. 24" min="0" max="216">
            </div>
            <div class="field-group flex-1">
              <label class="field-label">To (months)</label>
              <input class="field-input" type="number" formControlName="age_group_max"
                     placeholder="e.g. 48" min="0" max="216">
            </div>
          </div>

          <div class="age-hint">
            @if (form.value.age_group_min && form.value.age_group_max) {
              {{ form.value.age_group_min }} – {{ form.value.age_group_max }} months
              ({{ toYears(form.value.age_group_min) }} – {{ toYears(form.value.age_group_max) }})
            }
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
    .dialog-shell { width: 440px; display: flex; flex-direction: column; }

    .dialog-header {
      display: flex; align-items: center; gap: 12px;
      padding: 20px 24px 16px; border-bottom: 1px solid var(--border);
    }
    .dh-icon {
      width: 36px; height: 36px; border-radius: 9px;
      background: var(--amber-light); color: var(--amber);
      display: flex; align-items: center; justify-content: center;
      flex-shrink: 0;
      mat-icon { font-size: 18px; width: 18px; height: 18px; }
    }
    .dh-title { font-size: 15px; font-weight: 600; color: var(--text); }
    .dh-sub   { font-size: 11px; color: var(--text-3); margin-top: 2px; }
    .dh-close {
      margin-left: auto; background: none; border: none;
      width: 28px; height: 28px; border-radius: 6px;
      cursor: pointer; color: var(--text-3);
      display: flex; align-items: center; justify-content: center;
      &:hover { background: var(--bg); }
      mat-icon { font-size: 18px; width: 18px; height: 18px; }
    }

    .dialog-body  { padding: 20px 24px; }
    .edit-form    { display: flex; flex-direction: column; gap: 14px; }
    .form-row     { display: flex; gap: 12px; }
    .flex-1       { flex: 1; min-width: 0; }
    .field-group  { display: flex; flex-direction: column; gap: 5px; }

    .field-label {
      font-size: 12px; font-weight: 500; color: var(--text-2);
      .req      { color: var(--red); }
      .optional { font-size: 11px; color: var(--text-4); font-weight: 400; }
    }

    .field-input {
      width: 100%; height: 36px; padding: 0 10px;
      background: #fff; border: 1px solid var(--border);
      border-radius: 7px; font-size: 13px; color: var(--text);
      outline: none; font-family: inherit;
      &::placeholder { color: var(--text-4); }
      &:focus { border-color: var(--blue); box-shadow: 0 0 0 3px rgba(37,99,235,.1); }
      &.err   { border-color: var(--red); }
    }

    .field-error { font-size: 11px; color: var(--red); }
    .field-hint  { font-size: 11px; color: var(--text-3); }

    .section-divider {
      font-size: 11px; font-weight: 600; text-transform: uppercase;
      letter-spacing: .4px; color: var(--text-4);
      padding-bottom: 4px; border-bottom: 1px solid var(--border-light);
    }

    .age-hint {
      font-size: 12px; color: var(--blue);
      min-height: 16px;
      font-weight: 500;
    }

    .error-banner {
      display: flex; align-items: center; gap: 8px;
      background: var(--red-light); border: 1px solid #FECACA;
      color: #991B1B; padding: 10px 12px; border-radius: 8px; font-size: 12.5px;
    }

    .dialog-footer {
      display: flex; align-items: center; justify-content: flex-end; gap: 8px;
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
export class EditClassDialogComponent {
  private fb        = inject(FormBuilder);
  private api       = inject(ApiService);
  private dialogRef = inject(MatDialogRef<EditClassDialogComponent>);

  cls: SchoolClass = inject(MAT_DIALOG_DATA);

  submitting = signal(false);
  error      = signal('');

  form = this.fb.group({
    name:          [this.cls.name, Validators.required],
    capacity:      [this.cls.capacity, [Validators.required, Validators.min(1)]],
    age_group_min: [this.cls.age_group_min ?? null],
    age_group_max: [this.cls.age_group_max ?? null],
  });

  toYears(months: number): string {
    if (!months) return '';
    const y = Math.floor(months / 12);
    const m = months % 12;
    if (y === 0) return `${m}m`;
    if (m === 0) return `${y}y`;
    return `${y}y ${m}m`;
  }

  submit() {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    this.submitting.set(true);
    this.error.set('');

    const val = this.form.value;
    const payload: Record<string, unknown> = {
      name:     val.name,
      capacity: val.capacity,
    };
    if (val.age_group_min !== null && val.age_group_min !== undefined) payload['age_group_min'] = val.age_group_min;
    if (val.age_group_max !== null && val.age_group_max !== undefined) payload['age_group_max'] = val.age_group_max;

    this.api.put('/students/classes/' + this.cls.id, payload).subscribe({
      next: (res: any) => { this.submitting.set(false); this.dialogRef.close(res.data); },
      error: (err: any) => {
        this.submitting.set(false);
        this.error.set(err.error?.error?.message ?? 'Update failed');
      },
    });
  }
}
