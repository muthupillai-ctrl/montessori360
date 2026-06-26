import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';
import { FormsModule } from '@angular/forms';
import { DecimalPipe } from '@angular/common';
import { ApiService } from '../../core/services/api.service';
import { AuthService } from '../../core/services/auth.service';

interface ClassRow {
  id: string;
  name: string;
  age_group_min: number | null;
  age_group_max: number | null;
  section: string | null;
  capacity: number;
  room_number: string | null;
  is_active: boolean;
  teacher_id: string | null;
  teacher_name: string | null;
  enrolled_count: number;
}

interface StaffMember {
  id: string;
  first_name: string;
  last_name: string;
  role: string;
}

@Component({
  selector: 'app-classes',
  standalone: true,
  imports: [ ReactiveFormsModule, FormsModule, MatIconModule, MatProgressSpinnerModule, DecimalPipe ],
  template: `
    <div class="classes-page">

      <!-- Header -->
      <div class="page-header">
        <div>
          <h1>Classes</h1>
          <div class="subtitle">{{ activeClasses().length }} active classes · {{ totalEnrolled() }} students enrolled</div>
        </div>
        @if (isAdmin()) {
          <button class="btn-primary" (click)="openForm(null)">
            <mat-icon style="font-size:16px;width:16px;height:16px">add</mat-icon>
            New Class
          </button>
        }
      </div>

      <!-- Class grid -->
      @if (loading()) {
        <div class="loading-state">
          <mat-progress-spinner diameter="28" mode="indeterminate"/>
          <span>Loading classes…</span>
        </div>
      } @else if (!classes().length) {
        <div class="empty-state">
          <mat-icon style="font-size:40px;width:40px;height:40px;color:var(--text-4)">class</mat-icon>
          <div class="empty-title">No classes yet</div>
          <div class="empty-sub">Create your first class to get started</div>
          @if (isAdmin()) {
            <button class="btn-primary" (click)="openForm(null)">
              <mat-icon style="font-size:15px;width:15px;height:15px">add</mat-icon>
              New Class
            </button>
          }
        </div>
      } @else {
        <div class="class-grid">
          @for (cls of classes(); track cls.id) {
            <div class="class-card" [class.inactive]="!cls.is_active"
                 (click)="selectClass(cls)">
              <!-- Card header -->
              <div class="cc-header" [style.background]="getCardColor(cls.name) + '18'">
                <div class="cc-av" [style.background]="getCardColor(cls.name)">
                  {{ cls.section ? (cls.name[0] + cls.section[0]).toUpperCase() : cls.name.slice(0,2).toUpperCase() }}
                </div>
                <div class="cc-title-wrap">
                  <div class="cc-name">
                    {{ cls.name }}
                    @if (cls.section) {
                      <span class="cc-section">{{ cls.section }}</span>
                    }
                  </div>
                  @if (cls.room_number) {
                    <div class="cc-room">Room {{ cls.room_number }}</div>
                  }
                </div>
                @if (!cls.is_active) {
                  <span class="inactive-tag">Inactive</span>
                }
                @if (isAdmin()) {
                  <div class="cc-actions" (click)="$event.stopPropagation()">
                    <button class="cc-btn" (click)="openForm(cls)" title="Edit">
                      <mat-icon style="font-size:15px;width:15px;height:15px">edit</mat-icon>
                    </button>
                    <button class="cc-btn danger" (click)="toggleActive(cls)" 
                            [title]="cls.is_active ? 'Deactivate' : 'Activate'">
                      <mat-icon style="font-size:15px;width:15px;height:15px">
                        {{ cls.is_active ? 'do_not_disturb' : 'check_circle' }}
                      </mat-icon>
                    </button>
                  </div>
                }
              </div>

              <!-- Stats -->
              <div class="cc-stats">
                <div class="cc-stat">
                  <div class="cs-val" [style.color]="getCardColor(cls.name)">
                    {{ cls.enrolled_count }}
                  </div>
                  <div class="cs-lbl">Enrolled</div>
                </div>
                <div class="cs-divider"></div>
                <div class="cc-stat">
                  <div class="cs-val">{{ cls.capacity }}</div>
                  <div class="cs-lbl">Capacity</div>
                </div>
                <div class="cs-divider"></div>
                <div class="cc-stat">
                  <div class="cs-val">{{ cls.capacity - cls.enrolled_count }}</div>
                  <div class="cs-lbl">Available</div>
                </div>
              </div>

              <!-- Capacity bar -->
              <div class="cc-bar-wrap">
                <div class="cc-bar">
                  <div class="cc-bar-fill"
                       [style.width.%]="cls.capacity > 0 ? (cls.enrolled_count / cls.capacity * 100) : 0"
                       [style.background]="fillColor(cls)">
                  </div>
                </div>
                <span class="cc-pct">{{ cls.capacity > 0 ? (cls.enrolled_count / cls.capacity * 100 | number:'1.0-0') : 0 }}%</span>
              </div>

              <!-- Teacher -->
              <div class="cc-teacher">
                <mat-icon style="font-size:14px;width:14px;height:14px;color:var(--text-4)">person</mat-icon>
                @if (cls.teacher_name) {
                  <span class="ct-name">{{ cls.teacher_name }}</span>
                  <span class="ct-role">Class Teacher</span>
                } @else {
                  <span class="ct-none">No teacher assigned</span>
                }
              </div>

              <!-- Age group -->
              @if (cls.age_group_min || cls.age_group_max) {
                <div class="cc-age">
                  <mat-icon style="font-size:13px;width:13px;height:13px;color:var(--text-4)">child_care</mat-icon>
                  Ages {{ cls.age_group_min }}–{{ cls.age_group_max }} months
                </div>
              }
            </div>
          }
        </div>
      }

      <!-- Selected class students panel -->
      @if (selectedClass()) {
        <div class="students-panel">
          <div class="sp-header">
            <div class="sp-title">
              <mat-icon style="font-size:16px;width:16px;height:16px">people</mat-icon>
              {{ selectedClass()!.name }} — Students
            </div>
            <span class="sp-count">{{ classStudents().length }} students</span>
            <button class="sp-close" (click)="selectedClass.set(null)">
              <mat-icon style="font-size:16px;width:16px;height:16px">close</mat-icon>
            </button>
          </div>
          @if (studentsLoading()) {
            <div class="sp-loading"><mat-progress-spinner diameter="20" mode="indeterminate"/></div>
          } @else if (!classStudents().length) {
            <div class="sp-empty">No students enrolled in this class</div>
          } @else {
            <div class="sp-list">
              @for (s of classStudents(); track s.id; let i = $index) {
                <div class="sp-row">
                  <span class="sp-num">{{ i + 1 }}</span>
                  <div class="sp-av" [style.background]="getCardColor(s.first_name)">
                    {{ s.first_name[0] }}{{ s.last_name[0] }}
                  </div>
                  <div class="sp-info">
                    <div class="sp-name">{{ s.first_name }} {{ s.last_name }}</div>
                    <div class="sp-meta">{{ s.admission_no }}</div>
                  </div>
                </div>
              }
            </div>
          }
        </div>
      }

      <!-- Add/Edit form modal -->
      @if (showForm()) {
        <div class="modal-backdrop" (click)="closeForm()">
          <div class="modal" (click)="$event.stopPropagation()">
            <div class="modal-head">
              <div class="mh-icon">
                <mat-icon style="font-size:18px;width:18px;height:18px">class</mat-icon>
              </div>
              <div>
                <div class="mh-title">{{ editingClass() ? 'Edit Class' : 'New Class' }}</div>
                <div class="mh-sub">{{ editingClass() ? editingClass()!.name : 'Add a new class' }}</div>
              </div>
              <button class="modal-close" (click)="closeForm()">
                <mat-icon style="font-size:18px;width:18px;height:18px">close</mat-icon>
              </button>
            </div>

            <div class="modal-body">
              <form [formGroup]="form" class="cls-form">

                <div class="field-group">
                  <label class="fl">Class Name <span class="req">*</span></label>
                  <input class="fi" formControlName="name" placeholder="e.g. Sunflower, Rainbow, Toddlers A">
                  @if (form.get('name')?.invalid && form.get('name')?.touched) {
                    <div class="field-error">Class name is required</div>
                  }
                </div>

                <div class="form-row">
                  <div class="field-group fill">
                    <label class="fl">Section <span style="font-size:10px;color:var(--text-4);font-weight:400">— optional, e.g. A, B, C</span></label>
                    <input class="fi" formControlName="section" placeholder="Leave blank if no sections">
                  </div>
                  <div class="field-group fill">
                    <label class="fl">Room Number</label>
                    <input class="fi" formControlName="room_number" placeholder="e.g. 101, A1">
                  </div>
                  <div class="field-group fill">
                    <label class="fl">Capacity <span class="req">*</span></label>
                    <input class="fi" type="number" formControlName="capacity" placeholder="20" min="1">
                  </div>
                </div>

                <div class="form-row">
                  <div class="field-group fill">
                    <label class="fl">Min Age (months)</label>
                    <input class="fi" type="number" formControlName="age_group_min" placeholder="24" min="0" max="120">
                  </div>
                  <div class="field-group fill">
                    <label class="fl">Max Age (months)</label>
                    <input class="fi" type="number" formControlName="age_group_max" placeholder="60" min="0" max="120">
                  </div>
                </div>

                <div class="field-group">
                  <label class="fl">Class Teacher</label>
                  <select class="fi" formControlName="teacher_id">
                    <option value="">— Unassigned —</option>
                    @for (t of teachers(); track t.id) {
                      <option [value]="t.id">{{ t.first_name }} {{ t.last_name }} ({{ roleLabel(t.role) }})</option>
                    }
                  </select>
                </div>

              </form>
            </div>

            @if (formError()) {
              <div class="form-err">
                <mat-icon style="font-size:13px;width:13px;height:13px;flex-shrink:0">error_outline</mat-icon>
                {{ formError() }}
              </div>
            }

            <div class="modal-footer">
              <button class="btn-ghost" (click)="closeForm()">Cancel</button>
              <button class="btn-primary" (click)="saveClass()" [disabled]="form.invalid || saving()">
                @if (saving()) {
                  <mat-progress-spinner diameter="16" mode="indeterminate"
                    style="--mdc-circular-progress-active-indicator-color:#fff"/>
                } @else {
                  <mat-icon style="font-size:14px;width:14px;height:14px">save</mat-icon>
                }
                {{ editingClass() ? 'Save Changes' : 'Create Class' }}
              </button>
            </div>
          </div>
        </div>
      }

    </div>
  `,
  styles: [`
    .classes-page { display: flex; flex-direction: column; gap: 16px; }

    .btn-primary {
      display: inline-flex; align-items: center; gap: 6px;
      background: var(--blue); color: #fff; border: none;
      border-radius: 8px; height: 36px; padding: 0 16px;
      font-size: 13px; font-weight: 500; cursor: pointer;
      &:hover:not(:disabled) { background: #1D4ED8; }
      &:disabled { opacity: .6; cursor: not-allowed; }
    }

    /* Class grid */
    .class-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
      gap: 14px;
    }
    .class-card {
      background: var(--surface); border: 1px solid var(--border);
      border-radius: 12px; overflow: hidden; cursor: pointer;
      transition: box-shadow .15s, transform .15s;
      &:hover { box-shadow: 0 4px 12px rgba(0,0,0,.08); transform: translateY(-1px); }
      &.inactive { opacity: .6; }
    }
    .cc-header {
      display: flex; align-items: center; gap: 10px;
      padding: 12px 14px; border-bottom: 1px solid var(--border-light);
    }
    .cc-av {
      width: 36px; height: 36px; border-radius: 9px; flex-shrink: 0;
      color: #fff; font-size: 11px; font-weight: 700;
      display: flex; align-items: center; justify-content: center;
    }
    .cc-title-wrap { flex: 1; min-width: 0; }
    .cc-section { font-size: 11px; font-weight: 700; padding: 1px 7px; border-radius: 8px; background: var(--blue-light); color: var(--blue); margin-left: 6px; vertical-align: middle; }
    .cc-name { font-size: 14px; font-weight: 700; color: var(--text); }
    .cc-room { font-size: 11px; color: var(--text-3); margin-top: 1px; }
    .inactive-tag { font-size: 10px; font-weight: 600; padding: 2px 7px; border-radius: 10px; background: var(--border); color: var(--text-3); }
    .cc-actions { display: flex; gap: 3px; }
    .cc-btn {
      width: 26px; height: 26px; border-radius: 6px; border: none; cursor: pointer;
      background: var(--border-light); color: var(--text-3);
      display: flex; align-items: center; justify-content: center;
      &:hover { background: var(--blue-light); color: var(--blue); }
      &.danger:hover { background: var(--red-light); color: var(--red); }
    }

    .cc-stats { display: flex; align-items: center; padding: 10px 14px; gap: 0; }
    .cc-stat { flex: 1; text-align: center; }
    .cs-val  { font-size: 20px; font-weight: 700; color: var(--text); }
    .cs-lbl  { font-size: 10px; color: var(--text-3); margin-top: 1px; text-transform: uppercase; letter-spacing: .3px; }
    .cs-divider { width: 1px; height: 32px; background: var(--border-light); }

    .cc-bar-wrap { display: flex; align-items: center; gap: 8px; padding: 0 14px 10px; }
    .cc-bar { flex: 1; height: 5px; background: var(--border); border-radius: 3px; overflow: hidden; }
    .cc-bar-fill { height: 100%; border-radius: 3px; transition: width .3s; }
    .cc-pct { font-size: 10px; font-weight: 600; color: var(--text-3); min-width: 28px; }

    .cc-teacher {
      display: flex; align-items: center; gap: 6px;
      padding: 8px 14px; border-top: 1px solid var(--border-light);
      font-size: 12px;
    }
    .ct-name { font-weight: 500; color: var(--text); }
    .ct-role { color: var(--text-3); font-size: 10px; margin-left: 4px; }
    .ct-none { color: var(--text-4); font-style: italic; }

    .cc-age {
      display: flex; align-items: center; gap: 5px;
      padding: 6px 14px 10px; font-size: 11.5px; color: var(--text-3);
    }

    /* Students panel */
    .students-panel {
      background: var(--surface); border: 1px solid var(--border);
      border-radius: 12px; overflow: hidden;
    }
    .sp-header {
      display: flex; align-items: center; gap: 8px;
      padding: 12px 16px; background: var(--bg);
      border-bottom: 1px solid var(--border);
      font-size: 13px; font-weight: 600; color: var(--text);
    }
    .sp-count { font-size: 11px; color: var(--text-3); background: var(--border-light); padding: 2px 8px; border-radius: 10px; }
    .sp-close { margin-left: auto; background: none; border: none; cursor: pointer; color: var(--text-3); display: flex; align-items: center; &:hover { color: var(--text); } }
    .sp-loading { display: flex; justify-content: center; padding: 24px; }
    .sp-empty  { font-size: 13px; color: var(--text-3); text-align: center; padding: 24px; }
    .sp-list { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 0; }
    .sp-row  { display: flex; align-items: center; gap: 8px; padding: 8px 16px; border-bottom: 1px solid var(--border-light); &:last-child { border-bottom: none; } }
    .sp-num  { font-size: 11px; color: var(--text-4); width: 22px; text-align: right; flex-shrink: 0; }
    .sp-av   { width: 26px; height: 26px; border-radius: 6px; color: #fff; font-size: 9px; font-weight: 700; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
    .sp-name { font-size: 12.5px; font-weight: 500; color: var(--text); }
    .sp-meta { font-size: 10px; color: var(--text-3); }

    /* Form modal */
    .modal-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,.4); display: flex; align-items: center; justify-content: center; z-index: 1000; }
    .modal { background: var(--surface); border-radius: 12px; width: 95vw; max-width: 480px; display: flex; flex-direction: column; max-height: 90vh; overflow: hidden; }
    .modal-head { display: flex; align-items: center; gap: 12px; padding: 14px 20px; border-bottom: 1px solid var(--border); flex-shrink: 0; }
    .mh-icon { width: 36px; height: 36px; border-radius: 9px; background: var(--blue-light); color: var(--blue); display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
    .mh-title { font-size: 15px; font-weight: 600; color: var(--text); }
    .mh-sub   { font-size: 11px; color: var(--text-3); }
    .modal-close { margin-left: auto; background: none; border: none; cursor: pointer; color: var(--text-3); width: 28px; height: 28px; border-radius: 6px; display: flex; align-items: center; justify-content: center; &:hover { background: var(--bg); } }
    .modal-body { flex: 1; overflow-y: auto; padding: 16px 20px; background: var(--bg); }
    .modal-footer { display: flex; justify-content: flex-end; gap: 8px; padding: 12px 20px; border-top: 1px solid var(--border); background: var(--surface); flex-shrink: 0; }

    .cls-form { display: flex; flex-direction: column; gap: 12px; }
    .form-row { display: flex; gap: 10px; }
    .fill { flex: 1; min-width: 0; }
    .field-group { display: flex; flex-direction: column; gap: 4px; }
    .fl  { font-size: 12px; font-weight: 500; color: var(--text-2); .req { color: var(--red); } }
    .fi  { height: 34px; padding: 0 10px; width: 100%; background: var(--surface); border: 1px solid var(--border); border-radius: 7px; font-size: 13px; color: var(--text); outline: none; font-family: inherit; &:focus { border-color: var(--blue); } }
    select.fi { cursor: pointer; }
    .field-error { font-size: 11px; color: var(--red); }
    .form-err { display: flex; align-items: center; gap: 7px; padding: 10px 20px; background: var(--red-light); font-size: 12.5px; color: #991B1B; flex-shrink: 0; }
    .btn-ghost { background: none; border: none; cursor: pointer; font-size: 13px; color: var(--text-3); padding: 0 10px; height: 34px; border-radius: 7px; &:hover { background: var(--border-light); } }

    /* States */
    .loading-state { display: flex; align-items: center; gap: 12px; justify-content: center; padding: 60px; color: var(--text-3); font-size: 13px; }
    .empty-state { display: flex; flex-direction: column; align-items: center; gap: 10px; padding: 60px; color: var(--text-3); }
    .empty-title { font-size: 16px; font-weight: 600; color: var(--text-2); }
    .empty-sub   { font-size: 13px; }
  `],
})
export class ClassesComponent implements OnInit {
  private api   = inject(ApiService);
  private snack = inject(MatSnackBar);
  private auth  = inject(AuthService);
  private fb    = inject(FormBuilder);

  classes        = signal<ClassRow[]>([]);
  teachers       = signal<StaffMember[]>([]);
  classStudents  = signal<any[]>([]);
  loading        = signal(true);
  saving         = signal(false);
  studentsLoading = signal(false);
  showForm       = signal(false);
  editingClass   = signal<ClassRow | null>(null);
  selectedClass  = signal<ClassRow | null>(null);
  formError      = signal('');

  isAdmin = () => ['owner', 'principal'].includes(this.auth.user()?.role ?? '');

  activeClasses  = computed(() => this.classes().filter(c => c.is_active));
  totalEnrolled  = computed(() => this.classes().reduce((s, c) => s + c.enrolled_count, 0));

  form = this.fb.group({
    name:          ['', Validators.required],
    room_number:   [''],
    capacity:      [20, [Validators.required, Validators.min(1)]],
    age_group_min: [null as number | null],
    age_group_max: [null as number | null],
    section:       [''],
    teacher_id:    [''],
  });

  ngOnInit() {
    this.loadClasses();
    this.loadTeachers();
  }

  loadClasses() {
    this.loading.set(true);
    this.api.get<any>('/students/classes').subscribe({
      next: (res: any) => { this.classes.set(res.data ?? []); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  loadTeachers() {
    this.api.get<any>('/staff', { role: 'teacher,assistant_teacher,principal', limit: '100' }).subscribe({
      next: (res: any) => {
        const teachers = (res.data?.items ?? res.data ?? []);
        this.teachers.set(teachers);
      },
      error: () => {},
    });
  }

  selectClass(cls: ClassRow) {
    if (this.selectedClass()?.id === cls.id) { this.selectedClass.set(null); return; }
    this.selectedClass.set(cls);
    this.studentsLoading.set(true);
    this.api.get<any>('/students', { class_id: cls.id, limit: '100' }).subscribe({
      next: (res: any) => { this.classStudents.set(res.data?.items ?? []); this.studentsLoading.set(false); },
      error: () => this.studentsLoading.set(false),
    });
  }

  openForm(cls: ClassRow | null) {
    this.editingClass.set(cls);
    this.formError.set('');
    if (cls) {
      this.form.patchValue({
        name:          cls.name,
        room_number:   cls.room_number ?? '',
        capacity:      cls.capacity,
        age_group_min: cls.age_group_min,
        age_group_max: cls.age_group_max,
        section:       cls.section ?? '',
        teacher_id:    cls.teacher_id ?? '',
      });
    } else {
      this.form.reset({ capacity: 20 });
    }
    this.showForm.set(true);
  }

  closeForm() { this.showForm.set(false); this.editingClass.set(null); }

  saveClass() {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    this.saving.set(true); this.formError.set('');

    const v = this.form.value;
    const payload: Record<string, unknown> = {
      name:     v.name,
      capacity: +v.capacity!,
    };
    if (v.section?.trim())      payload['section']       = v.section.trim() || null;
    if (v.room_number?.trim())  payload['room_number']   = v.room_number.trim();
    if (v.age_group_min)        payload['age_group_min'] = +v.age_group_min;
    if (v.age_group_max)        payload['age_group_max'] = +v.age_group_max;
    if (v.teacher_id)           payload['teacher_id']    = v.teacher_id;
    else                        payload['teacher_id']    = null;

    const req = this.editingClass()
      ? this.api.put<any>('/students/classes/' + this.editingClass()!.id, payload)
      : this.api.post<any>('/students/classes', payload);

    req.subscribe({
      next: () => {
        this.saving.set(false);
        this.closeForm();
        this.snack.open(this.editingClass() ? 'Class updated' : 'Class created', 'OK', { duration: 2500 });
        this.loadClasses();
      },
      error: (err: any) => {
        this.saving.set(false);
        this.formError.set(err.error?.error?.message ?? 'Failed to save');
      },
    });
  }

  toggleActive(cls: ClassRow) {
    const msg = cls.is_active
      ? `Deactivate ${cls.name}? Students will remain but class won't appear in dropdowns.`
      : `Reactivate ${cls.name}?`;
    if (!confirm(msg)) return;
    this.api.put<any>('/students/classes/' + cls.id, { is_active: !cls.is_active }).subscribe({
      next: () => { this.snack.open(cls.is_active ? 'Class deactivated' : 'Class activated', 'OK', { duration: 2500 }); this.loadClasses(); },
      error: (err: any) => this.snack.open(err.error?.error?.message ?? 'Error', 'OK', { duration: 3000 }),
    });
  }

  fillColor(cls: ClassRow): string {
    const pct = cls.capacity > 0 ? cls.enrolled_count / cls.capacity : 0;
    if (pct >= 0.9) return 'var(--amber)';
    if (pct >= 1)   return 'var(--red)';
    return 'var(--green)';
  }

  getCardColor(name: string): string {
    const colors = ['#2563EB','#7C3AED','#DB2777','#D97706','#059669','#0891B2','#DC2626','#9333EA'];
    return colors[(name?.charCodeAt(0) || 0) % colors.length];
  }

  roleLabel(role: string): string {
    const m: Record<string,string> = { teacher: 'Teacher', assistant_teacher: 'Asst. Teacher', principal: 'Principal' };
    return m[role] ?? role;
  }
}
