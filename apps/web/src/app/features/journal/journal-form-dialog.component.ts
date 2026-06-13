import { Component, inject, signal, OnInit } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators, FormArray } from '@angular/forms';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { TitleCasePipe } from '@angular/common';
import { ApiService } from '../../core/services/api.service';
import type { Student, SchoolClass } from '../../core/models';
import type { Journal } from './journal.component';

const ACTIVITY_TYPES = [
  'montessori_work', 'practical_life', 'sensorial', 'language', 'math',
  'cultural', 'art_craft', 'music', 'story_time', 'outdoor',
  'circle_time', 'free_play', 'other',
];

@Component({
  selector: 'app-journal-form-dialog',
  standalone: true,
  imports: [
    ReactiveFormsModule, MatDialogModule,
    MatButtonModule, MatIconModule,
    MatProgressSpinnerModule, TitleCasePipe,
  ],
  template: `
    <div class="dialog-shell">

      <!-- Header -->
      <div class="dialog-header">
        <div class="dh-icon"><mat-icon>auto_stories</mat-icon></div>
        <div class="dh-text">
          <div class="dh-title">{{ isEdit ? 'Edit Journal' : 'New Journal' }}</div>
          <div class="dh-sub">{{ data.date }}</div>
        </div>
        <button class="dh-close" mat-dialog-close><mat-icon>close</mat-icon></button>
      </div>

      <!-- Tab bar -->
      <div class="tab-bar">
        @for (tab of tabs; track tab.key) {
          <button class="tab-btn" [class.active]="activeTab() === tab.key"
                  (click)="activeTab.set(tab.key)">
            <span class="tab-emoji">{{ tab.emoji }}</span>
            <span class="tab-label">{{ tab.label }}</span>
          </button>
        }
      </div>

      <!-- Body -->
      <div class="dialog-body">
        <form [formGroup]="form">

          <!-- ── Student & Mood ──────────────────────────────── -->
          @if (activeTab() === 'student') {
            <div class="tab-pane">

              @if (!isEdit) {
                <div class="field-group">
                  <label class="field-label">Journal Date <span class="req">*</span></label>
                  <input class="field-input" type="date" formControlName="journal_date">
                </div>

                <div class="field-row">
                  <div class="field-group w-180">
                    <label class="field-label">Class</label>
                    <select class="field-input" [value]="selectedClass()"
                            (change)="onClassChange($any($event.target).value)">
                      <option value="">All Classes</option>
                      @for (cls of data.classes; track cls.id) {
                        <option [value]="cls.id">{{ cls.name }}</option>
                      }
                    </select>
                  </div>
                  <div class="field-group fill">
                    <label class="field-label">Student <span class="req">*</span></label>
                    <select class="field-input" formControlName="student_id">
                      <option value="">— Select student —</option>
                      @for (s of students(); track s.id) {
                        <option [value]="s.id">
                          {{ s.first_name }} {{ s.last_name }} · {{ s.admission_no }}
                        </option>
                      }
                    </select>
                  </div>
                </div>
              } @else {
                <div class="student-banner">
                  <div class="sb-av" [style.background]="getColor(data.journal?.student_name ?? '')">
                    {{ (data.journal?.student_name ?? '?')[0] }}
                  </div>
                  <div>
                    <div class="sb-name">{{ data.journal?.student_name }}</div>
                    <div class="sb-meta">{{ data.journal?.class_name }} · {{ data.journal?.admission_no }}</div>
                  </div>
                </div>
              }

              <div class="field-group">
                <label class="field-label">How was the child today?</label>
                <div class="mood-grid">
                  @for (m of moods; track m.value) {
                    <div class="mood-card" [class.selected]="form.value.mood === m.value"
                         (click)="form.patchValue({ mood: m.value })">
                      <div class="mood-emoji">{{ m.emoji }}</div>
                      <div class="mood-label">{{ m.label }}</div>
                    </div>
                  }
                </div>
              </div>

              <div class="field-group">
                <label class="field-label">Mood note <span class="hint">(optional)</span></label>
                <input class="field-input" formControlName="mood_note"
                       placeholder="e.g. Settled in well after initial shyness">
              </div>

              <div class="field-group">
                <label class="field-label">Teacher's observation</label>
                <textarea class="field-input field-textarea" formControlName="teacher_note"
                          placeholder="Share what the child did today, any progress made, social interactions, or notable moments to share with parents…"></textarea>
              </div>

            </div>
          }

          <!-- ── Meals ───────────────────────────────────────── -->
          @if (activeTab() === 'meals') {
            <div class="tab-pane" formGroupName="meal">

              @for (meal of mealTypes; track meal.key) {
                <div class="field-group">
                  <label class="field-label">{{ meal.label }}</label>
                  <div class="qty-row">
                    @for (q of mealQty; track q.value) {
                      <div class="qty-card" [class.selected]="form.get('meal')?.get(meal.key)?.value === q.value"
                           [style.--qc]="q.color"
                           (click)="form.get('meal')?.get(meal.key)?.setValue(q.value)">
                        <span class="qc-emoji">{{ q.emoji }}</span>
                        <span class="qc-label">{{ q.label }}</span>
                      </div>
                    }
                    <div class="qty-card na" [class.selected]="!form.get('meal')?.get(meal.key)?.value"
                         (click)="form.get('meal')?.get(meal.key)?.setValue(null)">
                      <span class="qc-emoji">—</span>
                      <span class="qc-label">N/A</span>
                    </div>
                  </div>
                </div>
              }

              <div class="field-group">
                <label class="field-label">Meal notes <span class="hint">(optional)</span></label>
                <input class="field-input" formControlName="notes"
                       placeholder="e.g. Ate well, enjoyed the dal rice">
              </div>
            </div>
          }

          <!-- ── Nap ─────────────────────────────────────────── -->
          @if (activeTab() === 'nap') {
            <div class="tab-pane" formGroupName="nap">

              <div class="field-group">
                <label class="field-label">Nap quality</label>
                <div class="qty-row">
                  @for (q of napQty; track q.value) {
                    <div class="qty-card" [class.selected]="form.get('nap')?.get('quality')?.value === q.value"
                         [style.--qc]="q.color"
                         (click)="form.get('nap')?.get('quality')?.setValue(q.value)">
                      <span class="qc-emoji">{{ q.emoji }}</span>
                      <span class="qc-label">{{ q.label }}</span>
                    </div>
                  }
                  <div class="qty-card na" [class.selected]="!form.get('nap')?.get('quality')?.value"
                       (click)="form.get('nap')?.get('quality')?.setValue(null)">
                    <span class="qc-emoji">—</span>
                    <span class="qc-label">No nap</span>
                  </div>
                </div>
              </div>

              <div class="field-row">
                <div class="field-group fill">
                  <label class="field-label">Start time</label>
                  <input class="field-input" type="time" formControlName="start_time">
                </div>
                <div class="field-group fill">
                  <label class="field-label">End time</label>
                  <input class="field-input" type="time" formControlName="end_time">
                </div>
              </div>

              <div class="field-group">
                <label class="field-label">Notes <span class="hint">(optional)</span></label>
                <input class="field-input" formControlName="notes"
                       placeholder="e.g. Slept well for 90 minutes">
              </div>
            </div>
          }

          <!-- ── Activities ─────────────────────────────────── -->
          @if (activeTab() === 'activities') {
            <div class="tab-pane">
              <div class="acts-header">
                <span class="acts-hint">Add activities the child participated in today.</span>
                <button type="button" class="add-act-btn" (click)="addActivity()">
                  <mat-icon style="font-size:15px;width:15px;height:15px">add</mat-icon>
                  Add Activity
                </button>
              </div>

              @if (!activities.length) {
                <div class="acts-empty">
                  <span>No activities added yet.</span>
                </div>
              }

              <div formArrayName="activities" class="acts-list">
                @for (act of activities.controls; track $index) {
                  <div [formGroupName]="$index" class="act-card">
                    <div class="act-card-top">
                      <select class="field-input act-type-sel" formControlName="type">
                        @for (t of activityTypes; track t) {
                          <option [value]="t">{{ t.replace(/_/g,' ') | titlecase }}</option>
                        }
                      </select>
                      <input class="field-input act-dur-inp" type="number"
                             formControlName="duration_mins"
                             placeholder="mins" min="5" max="180">
                      <button type="button" class="act-del-btn" (click)="removeActivity($index)">
                        <mat-icon style="font-size:15px;width:15px;height:15px">delete</mat-icon>
                      </button>
                    </div>
                    <input class="field-input act-desc-inp" formControlName="description"
                           placeholder="Describe what the child did…">
                  </div>
                }
              </div>
            </div>
          }

          <!-- ── Toilet ─────────────────────────────────────── -->
          @if (activeTab() === 'toilet') {
            <div class="tab-pane" formGroupName="toilet">

              <div class="field-group">
                <label class="field-label">Number of toilet visits today</label>
                <div class="count-row">
                  @for (n of [0,1,2,3,4,5,6,7,8]; track n) {
                    <div class="count-chip" [class.selected]="form.get('toilet')?.get('count')?.value === n"
                         (click)="form.get('toilet')?.get('count')?.setValue(n)">
                      {{ n }}
                    </div>
                  }
                </div>
              </div>

              <div class="field-group">
                <label class="field-label">Notes <span class="hint">(optional)</span></label>
                <input class="field-input" formControlName="notes"
                       placeholder="e.g. Needed reminders, stayed dry all day">
              </div>
            </div>
          }

        </form>
      </div>

      <!-- Error banner -->
      @if (error()) {
        <div class="error-banner">
          <mat-icon style="font-size:15px;width:15px;height:15px;flex-shrink:0">error_outline</mat-icon>
          {{ error() }}
        </div>
      }

      <!-- Footer -->
      <div class="dialog-footer">
        <button class="btn-ghost" mat-dialog-close>Cancel</button>
        <div class="footer-actions">
          <button class="btn-outline" (click)="submit(false)" [disabled]="submitting()">
            <mat-icon style="font-size:15px;width:15px;height:15px">save</mat-icon>
            Save Draft
          </button>
          <button class="btn-primary" (click)="submit(true)" [disabled]="submitting()">
            @if (submitting()) {
              <mat-progress-spinner diameter="16" mode="indeterminate"
                style="--mdc-circular-progress-active-indicator-color:#fff" />
            } @else {
              <ng-container>
                <mat-icon style="font-size:15px;width:15px;height:15px">send</mat-icon>
                Save & Publish
              </ng-container>
            }
          </button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    :host { display: block; }

    .dialog-shell {
      width: 100%;
      display: flex;
      flex-direction: column;
      max-height: 88vh;
    }

    /* Header */
    .dialog-header {
      display: flex; align-items: center; gap: 12px;
      padding: 18px 24px 14px; border-bottom: 1px solid var(--border); flex-shrink: 0;
    }
    .dh-icon {
      width: 36px; height: 36px; border-radius: 9px;
      background: #FFF7ED; color: #F59E0B; flex-shrink: 0;
      display: flex; align-items: center; justify-content: center;
      mat-icon { font-size: 18px; width: 18px; height: 18px; }
    }
    .dh-text { flex: 1; }
    .dh-title { font-size: 15px; font-weight: 600; color: var(--text); }
    .dh-sub   { font-size: 11px; color: var(--text-3); margin-top: 1px; }
    .dh-close {
      background: none; border: none; width: 30px; height: 30px; border-radius: 7px;
      cursor: pointer; color: var(--text-3); display: flex; align-items: center; justify-content: center;
      &:hover { background: var(--bg); }
      mat-icon { font-size: 18px; width: 18px; height: 18px; }
    }

    /* Tabs */
    .tab-bar {
      display: flex; gap: 4px; padding: 10px 20px;
      background: var(--bg); border-bottom: 1px solid var(--border); flex-shrink: 0;
    }
    .tab-btn {
      display: flex; align-items: center; gap: 6px;
      background: none; border: none; cursor: pointer;
      padding: 6px 14px; border-radius: 8px;
      font-size: 13px; font-weight: 500; color: var(--text-3); white-space: nowrap;
      transition: all .12s;
      &:hover  { background: #fff; color: var(--text-2); }
      &.active { background: #fff; color: var(--blue); font-weight: 600;
                 box-shadow: 0 1px 4px rgba(0,0,0,.1); }
    }
    .tab-emoji { font-size: 15px; line-height: 1; }
    .tab-label { font-size: 12.5px; }

    /* Body */
    .dialog-body { flex: 1; overflow-y: auto; padding: 20px 24px; background: var(--bg); }
    .tab-pane { display: flex; flex-direction: column; gap: 16px; }

    /* Student banner */
    .student-banner {
      display: flex; align-items: center; gap: 12px;
      background: var(--surface); border: 1px solid var(--border);
      border-radius: 9px; padding: 14px;
    }
    .sb-av {
      width: 40px; height: 40px; border-radius: 10px; color: #fff;
      font-size: 16px; font-weight: 700; display: flex; align-items: center; justify-content: center; flex-shrink: 0;
    }
    .sb-name { font-size: 14px; font-weight: 600; color: var(--text); }
    .sb-meta { font-size: 12px; color: var(--text-3); margin-top: 2px; }

    /* Fields */
    .field-row  { display: flex; gap: 12px; }
    .field-group { display: flex; flex-direction: column; gap: 5px; }
    .fill  { flex: 1; min-width: 0; }
    .w-180 { width: 180px; flex-shrink: 0; }

    .field-label {
      font-size: 12px; font-weight: 500; color: var(--text-2);
      .req  { color: var(--red); }
      .hint { font-size: 11px; color: var(--text-4); font-weight: 400; }
    }

    .field-input {
      height: 38px; padding: 0 11px; width: 100%;
      background: var(--surface); border: 1px solid var(--border);
      border-radius: 8px; font-size: 13px; color: var(--text);
      outline: none; font-family: inherit;
      &::placeholder { color: var(--text-4); }
      &:focus { border-color: var(--blue); box-shadow: 0 0 0 3px rgba(37,99,235,.1); background: #fff; }
    }
    select.field-input { cursor: pointer; }

    .field-textarea {
      height: auto;
      min-height: 130px;
      padding: 10px 11px;
      resize: vertical;
      line-height: 1.6;
    }

    /* Mood */
    .mood-grid {
      display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px;
    }
    .mood-card {
      display: flex; flex-direction: column; align-items: center; gap: 6px;
      padding: 14px 8px; border: 2px solid var(--border);
      border-radius: 10px; cursor: pointer; transition: all .12s; background: var(--surface);
      &:hover    { border-color: var(--blue); background: var(--blue-light); }
      &.selected { border-color: var(--blue); background: var(--blue-light); }
    }
    .mood-emoji { font-size: 32px; line-height: 1; }
    .mood-label { font-size: 12px; font-weight: 500; color: var(--text-2);
      .mood-card.selected & { color: var(--blue); font-weight: 600; } }

    /* Meal/nap qty */
    .qty-row { display: flex; gap: 10px; flex-wrap: wrap; }
    .qty-card {
      display: flex; flex-direction: column; align-items: center; gap: 4px;
      min-width: 80px; padding: 10px 14px;
      border: 2px solid var(--border); border-radius: 9px; cursor: pointer;
      background: var(--surface); transition: all .12s;
      &:hover    { border-color: var(--qc, var(--blue)); }
      &.selected { border-color: var(--qc, var(--blue));
                   background: color-mix(in srgb, var(--qc, var(--blue)) 12%, white);
                   .qc-label { color: var(--qc, var(--blue)); font-weight: 600; } }
      &.na:hover    { border-color: var(--text-3); }
      &.na.selected { border-color: var(--text-3); background: var(--bg); }
    }
    .qc-emoji { font-size: 18px; line-height: 1; }
    .qc-label { font-size: 11px; font-weight: 500; color: var(--text-2); }

    /* Activities */
    .acts-header {
      display: flex; align-items: center; justify-content: space-between;
    }
    .acts-hint { font-size: 12px; color: var(--text-3); }
    .add-act-btn {
      display: inline-flex; align-items: center; gap: 5px;
      background: var(--blue); color: #fff; border: none;
      border-radius: 7px; padding: 0 12px; height: 32px;
      font-size: 12px; font-weight: 500; cursor: pointer;
      &:hover { background: #1D4ED8; }
    }
    .acts-empty {
      text-align: center; padding: 32px; color: var(--text-3);
      background: var(--surface); border: 1px dashed var(--border); border-radius: 9px;
      font-size: 13px;
    }
    .acts-list { display: flex; flex-direction: column; gap: 10px; }
    .act-card {
      background: var(--surface); border: 1px solid var(--border);
      border-radius: 9px; padding: 12px; display: flex; flex-direction: column; gap: 8px;
    }
    .act-card-top    { display: flex; gap: 8px; align-items: center; }
    .act-type-sel    { flex: 1; }
    .act-dur-inp     { width: 80px; flex-shrink: 0; text-align: right; }
    .act-del-btn     {
      background: none; border: 1px solid var(--border); border-radius: 6px;
      width: 36px; height: 38px; cursor: pointer; color: var(--red); flex-shrink: 0;
      display: flex; align-items: center; justify-content: center;
      &:hover { background: var(--red-light); }
    }
    .act-desc-inp { width: 100%; }

    /* Toilet */
    .count-row  { display: flex; gap: 8px; flex-wrap: wrap; }
    .count-chip {
      width: 46px; height: 46px; border-radius: 10px;
      border: 2px solid var(--border); cursor: pointer; background: var(--surface);
      display: flex; align-items: center; justify-content: center;
      font-size: 16px; font-weight: 600; color: var(--text-2); transition: all .12s;
      &:hover    { border-color: var(--blue); background: var(--blue-light); }
      &.selected { border-color: var(--blue); background: var(--blue); color: #fff; }
    }

    /* Error banner */
    .error-banner {
      display: flex; align-items: center; gap: 8px; flex-shrink: 0;
      background: var(--red-light); border-top: 1px solid #FECACA; border-bottom: 1px solid #FECACA;
      color: #991B1B; padding: 10px 24px; font-size: 12.5px;
    }

    /* Footer */
    .dialog-footer {
      display: flex; justify-content: space-between; align-items: center;
      padding: 14px 24px; border-top: 1px solid var(--border);
      background: var(--surface); flex-shrink: 0;
    }
    .footer-actions { display: flex; gap: 8px; }
    .btn-ghost {
      background: none; border: none; cursor: pointer;
      font-size: 13px; color: var(--text-3); padding: 0 10px; height: 36px; border-radius: 7px;
      &:hover { background: var(--border-light); }
    }
    .btn-outline {
      display: flex; align-items: center; gap: 5px;
      background: #fff; color: var(--text-2); border: 1px solid var(--border);
      border-radius: 8px; height: 36px; padding: 0 16px;
      font-size: 13px; font-weight: 500; cursor: pointer;
      &:hover:not(:disabled) { background: var(--bg); }
      &:disabled { opacity: .6; cursor: not-allowed; }
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
export class JournalFormDialogComponent implements OnInit {
  private fb        = inject(FormBuilder);
  private api       = inject(ApiService);
  private dialogRef = inject(MatDialogRef<JournalFormDialogComponent>);

  data: { date: string; classes: SchoolClass[]; journal?: Journal } = inject(MAT_DIALOG_DATA);

  isEdit        = !!this.data.journal;
  students      = signal<Student[]>([]);
  selectedClass = signal('');
  submitting    = signal(false);
  error         = signal('');
  activeTab     = signal('student');

  tabs = [
    { key: 'student',    emoji: '👤', label: 'Student & Mood' },
    { key: 'meals',      emoji: '🍽',  label: 'Meals' },
    { key: 'nap',        emoji: '😴',  label: 'Nap' },
    { key: 'activities', emoji: '🎯',  label: 'Activities' },
    { key: 'toilet',     emoji: '🚿',  label: 'Toilet' },
  ];

  moods = [
    { value: 'happy',     emoji: '😊', label: 'Happy'     },
    { value: 'calm',      emoji: '😌', label: 'Calm'      },
    { value: 'unsettled', emoji: '😟', label: 'Unsettled' },
    { value: 'upset',     emoji: '😢', label: 'Upset'     },
  ];

  mealTypes = [
    { key: 'breakfast', label: 'Breakfast' },
    { key: 'lunch',     label: 'Lunch'     },
    { key: 'snack',     label: 'Snack'     },
  ];

  mealQty = [
    { value: 'well',    emoji: '✅', label: 'Ate Well',  color: '#10B981' },
    { value: 'partial', emoji: '⚡', label: 'Partial',   color: '#F59E0B' },
    { value: 'refused', emoji: '❌', label: 'Refused',   color: '#EF4444' },
  ];

  napQty = [
    { value: 'good', emoji: '😴', label: 'Good',  color: '#6366F1' },
    { value: 'poor', emoji: '😑', label: 'Poor',  color: '#F59E0B' },
    { value: 'none', emoji: '🚫', label: 'None',  color: '#EF4444' },
  ];

  activityTypes = ACTIVITY_TYPES;

  j = this.data.journal;

  form = this.fb.group({
    journal_date: [this.j?.journal_date?.slice(0,10) ?? this.data.date, Validators.required],
    student_id:   [this.j?.student_id ?? '', Validators.required],
    mood:         [this.j?.mood ?? null],
    mood_note:    [this.j?.mood_note ?? ''],
    teacher_note: [this.j?.teacher_note ?? ''],
    meal: this.fb.group({
      breakfast: [this.j?.meal?.breakfast ?? null],
      lunch:     [this.j?.meal?.lunch ?? null],
      snack:     [this.j?.meal?.snack ?? null],
      notes:     [this.j?.meal?.notes ?? ''],
    }),
    nap: this.fb.group({
      quality:    [this.j?.nap?.quality ?? null],
      start_time: [this.j?.nap?.start_time ?? ''],
      end_time:   [this.j?.nap?.end_time ?? ''],
      notes:      [this.j?.nap?.notes ?? ''],
    }),
    toilet: this.fb.group({
      count: [this.j?.toilet?.count ?? 0],
      notes: [this.j?.toilet?.notes ?? ''],
    }),
    activities: this.fb.array(
      (this.j?.activities ?? []).map(a => this.fb.group({
        type:          [a.type],
        description:   [a.description],
        duration_mins: [a.duration_mins ?? null],
      }))
    ),
  });

  get activities(): FormArray { return this.form.get('activities') as FormArray; }

  ngOnInit() {
    if (!this.isEdit) this.loadStudents('');
  }

  loadStudents(classId: string) {
    const params: Record<string, string> = { limit: '500', page: '1', is_active: 'true' };
    if (classId) params['class_id'] = classId;
    this.api.get<any>('/students', params).subscribe({
      next: (res: any) => this.students.set(res.data ?? []),
    });
  }

  onClassChange(id: string) {
    this.selectedClass.set(id);
    this.form.patchValue({ student_id: '' });
    this.loadStudents(id);
  }

  addActivity() {
    this.activities.push(this.fb.group({
      type:          ['montessori_work'],
      description:   [''],
      duration_mins: [null],
    }));
  }

  removeActivity(i: number) { this.activities.removeAt(i); }

  getColor(name: string): string {
    const colors = ['#2563EB','#7C3AED','#DB2777','#D97706','#059669'];
    return colors[(name?.charCodeAt(0) || 0) % colors.length];
  }

  buildPayload(publish: boolean): Record<string, unknown> {
    const val = this.form.value;
    const payload: Record<string, unknown> = { publish };

    if (val.teacher_note) payload['teacher_note'] = val.teacher_note;
    if (val.mood)         payload['mood']          = val.mood;
    if (val.mood_note)    payload['mood_note']      = val.mood_note;

    const meal = val.meal as any;
    const mealClean: Record<string, unknown> = {};
    if (meal.breakfast) mealClean['breakfast'] = meal.breakfast;
    if (meal.lunch)     mealClean['lunch']     = meal.lunch;
    if (meal.snack)     mealClean['snack']     = meal.snack;
    if (meal.notes)     mealClean['notes']     = meal.notes;
    if (Object.keys(mealClean).length) payload['meal'] = mealClean;

    const nap = val.nap as any;
    if (nap.quality) {
      const napClean: Record<string, unknown> = { quality: nap.quality };
      if (nap.start_time) napClean['start_time'] = nap.start_time;
      if (nap.end_time)   napClean['end_time']   = nap.end_time;
      if (nap.notes)      napClean['notes']      = nap.notes;
      payload['nap'] = napClean;
    }

    const toilet = val.toilet as any;
    if (toilet.count > 0) {
      payload['toilet'] = { count: toilet.count, ...(toilet.notes ? { notes: toilet.notes } : {}) };
    }

    const acts = ((val.activities ?? []) as any[])
      .filter(a => a.type && a.description && a.description.trim())
      .map(a => ({
        type:        a.type,
        description: a.description.trim(),
        ...(a.duration_mins ? { duration_mins: +a.duration_mins } : {}),
      }));
    if (acts.length) payload['activities'] = acts;

    return payload;
  }

  submit(publish: boolean) {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    this.submitting.set(true);
    this.error.set('');

    const payload = this.buildPayload(publish);
    const req = this.isEdit
      ? this.api.put<any>('/journals/' + this.j!.id, payload)
      : this.api.post<any>('/journals', {
          ...payload,
          student_id:   this.form.value.student_id,
          journal_date: this.form.value.journal_date,
        });

    req.subscribe({
      next: (res: any) => { this.submitting.set(false); this.dialogRef.close(res.data); },
      error: (err: any) => {
        this.submitting.set(false);
        this.error.set(err.error?.error?.message ?? 'Failed to save journal. Please try again.');
      },
    });
  }
}
