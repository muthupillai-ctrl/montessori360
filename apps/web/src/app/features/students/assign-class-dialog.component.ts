import { Component, inject, signal, OnInit } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ApiService } from '../../core/services/api.service';
import type { Student, SchoolClass, ApiResponse } from '../../core/models';

@Component({
  selector: 'app-assign-class-dialog',
  standalone: true,
  imports: [
    ReactiveFormsModule, MatDialogModule,
    MatButtonModule, MatIconModule, MatProgressSpinnerModule,
  ],
  template: `
    <div class="dialog-shell">

      <div class="dialog-header">
        <div class="dh-icon purple"><mat-icon>class</mat-icon></div>
        <div>
          <div class="dh-title">Assign Class</div>
          <div class="dh-sub">{{ student.first_name }} {{ student.last_name }}</div>
        </div>
        <button class="dh-close" mat-dialog-close><mat-icon>close</mat-icon></button>
      </div>

      <div class="dialog-body">

        @if (student.class_name) {
          <div class="current-class">
            <mat-icon style="font-size:16px;width:16px;height:16px;color:var(--blue)">info</mat-icon>
            Currently in <strong>{{ student.class_name }}</strong>
          </div>
        }

        <div class="class-grid">
          @for (cls of classes(); track cls.id) {
            <div class="class-option"
                 [class.selected]="selectedId() === cls.id"
                 [class.full]="cls.enrolled_count >= cls.capacity"
                 (click)="cls.enrolled_count < cls.capacity && select(cls.id)">
              <div class="co-top">
                <div class="co-icon" [style.background]="getColor(cls.name) + '20'"
                     [style.color]="getColor(cls.name)">
                  <mat-icon style="font-size:18px;width:18px;height:18px">class</mat-icon>
                </div>
                @if (selectedId() === cls.id) {
                  <mat-icon class="co-check">check_circle</mat-icon>
                }
                @if (cls.enrolled_count >= cls.capacity) {
                  <span class="full-tag">Full</span>
                }
              </div>
              <div class="co-name">{{ cls.name }}</div>
              @if (cls.age_group_min && cls.age_group_max) {
                <div class="co-age">{{ cls.age_group_min }}–{{ cls.age_group_max }} months</div>
              }
              <div class="co-bar-track">
                <div class="co-bar" [style.width.%]="getEnrolPct(cls)"
                     [style.background]="cls.enrolled_count >= cls.capacity ? 'var(--red)' : 'var(--blue)'"></div>
              </div>
              <div class="co-count">{{ cls.enrolled_count }}/{{ cls.capacity }}</div>
            </div>
          }
        </div>

        @if (error()) {
          <div class="error-banner">
            <mat-icon style="font-size:15px;width:15px;height:15px;flex-shrink:0">error_outline</mat-icon>
            {{ error() }}
          </div>
        }

      </div>

      <div class="dialog-footer">
        <button class="btn-ghost" mat-dialog-close>Cancel</button>
        <button class="btn-primary" (click)="submit()"
                [disabled]="!selectedId() || submitting()">
          @if (submitting()) {
            <mat-progress-spinner diameter="16" mode="indeterminate"
              style="--mdc-circular-progress-active-indicator-color:#fff" />
          } @else {
            <ng-container>
              <mat-icon style="font-size:15px;width:15px;height:15px">check</mat-icon>
              Assign Class
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
      padding: 20px 24px 16px; border-bottom: 1px solid var(--border);
    }
    .dh-icon {
      width: 36px; height: 36px; border-radius: 9px;
      display: flex; align-items: center; justify-content: center; flex-shrink: 0;
      mat-icon { font-size: 18px; width: 18px; height: 18px; }
      &.purple { background: var(--purple-light); color: var(--purple); }
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

    .dialog-body { padding: 16px 24px 8px; max-height: 440px; overflow-y: auto; }

    .current-class {
      display: flex; align-items: center; gap: 8px;
      background: var(--blue-light); border-radius: 8px;
      padding: 10px 12px; font-size: 12.5px; color: #1E40AF;
      margin-bottom: 14px;
    }

    .class-grid {
      display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px;
    }

    .class-option {
      border: 1.5px solid var(--border); border-radius: 10px;
      padding: 12px; cursor: pointer; transition: all .15s; position: relative;
      background: #fff;
      &:hover:not(.full) { border-color: var(--blue); background: var(--blue-light); }
      &.selected { border-color: var(--blue); background: var(--blue-light); }
      &.full { opacity: .5; cursor: not-allowed; }
    }

    .co-top { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px; }
    .co-icon { width: 32px; height: 32px; border-radius: 8px; display: flex; align-items: center; justify-content: center; }
    .co-check { color: var(--blue); font-size: 18px; width: 18px; height: 18px; }
    .full-tag { font-size: 9px; font-weight: 600; background: var(--red-light); color: #991B1B; padding: 1px 5px; border-radius: 4px; }

    .co-name  { font-size: 13px; font-weight: 600; color: var(--text); margin-bottom: 2px; }
    .co-age   { font-size: 10px; color: var(--text-3); margin-bottom: 8px; }
    .co-bar-track { height: 4px; background: var(--border); border-radius: 2px; overflow: hidden; margin-bottom: 4px; }
    .co-bar   { height: 100%; border-radius: 2px; transition: width .3s; }
    .co-count { font-size: 10px; color: var(--text-3); }

    .error-banner {
      display: flex; align-items: center; gap: 8px;
      background: var(--red-light); border: 1px solid #FECACA;
      color: #991B1B; padding: 10px 12px; border-radius: 8px;
      font-size: 12.5px; margin-top: 12px;
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
      background: var(--blue); color: #fff;
      border: none; border-radius: 8px; height: 36px; padding: 0 18px;
      font-size: 13px; font-weight: 500; cursor: pointer;
      &:hover:not(:disabled) { background: #1D4ED8; }
      &:disabled { opacity: .6; cursor: not-allowed; }
    }
  `],
})
export class AssignClassDialogComponent implements OnInit {
  private api       = inject(ApiService);
  private dialogRef = inject(MatDialogRef<AssignClassDialogComponent>);

  student: Student = inject(MAT_DIALOG_DATA);

  classes    = signal<SchoolClass[]>([]);
  selectedId = signal<string>('');
  submitting = signal(false);
  error      = signal('');

  ngOnInit() {
    this.api.get<ApiResponse<SchoolClass[]>>('/students/classes').subscribe({
      next: (res: any) => {
        this.classes.set(res.data);
        // Pre-select current class if student has one
        if (this.student.class_id) {
          this.selectedId.set(this.student.class_id);
        }
      },
      error: (err: any) => console.error('Failed to load classes', err),
    });
  }

  select(id: string) { this.selectedId.set(id); }

  getColor(name: string): string {
    const colors = ['#2563EB','#7C3AED','#DB2777','#D97706','#059669','#0891B2','#DC2626'];
    return colors[name.charCodeAt(0) % colors.length];
  }

  getEnrolPct(cls: SchoolClass): number {
    return cls.capacity > 0 ? Math.round((cls.enrolled_count / cls.capacity) * 100) : 0;
  }

  submit() {
    if (!this.selectedId()) return;
    this.submitting.set(true);
    this.error.set('');

    console.log('Assigning class:', this.selectedId(), 'to student:', this.student.id);

    this.api.patch<any>('/students/' + this.student.id + '/class', { class_id: this.selectedId() }).subscribe({
      next: (res: any) => {
        console.log('Class assigned successfully', res);
        this.submitting.set(false);
        this.dialogRef.close(res.data ?? true);
      },
      error: (err: any) => {
        console.error('Assign class error:', err);
        this.submitting.set(false);
        this.error.set(err.error?.error?.message ?? 'Failed to assign class. Check console for details.');
      },
    });
  }
}
