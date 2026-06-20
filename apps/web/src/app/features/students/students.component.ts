import { Component, inject, signal, OnInit } from '@angular/core';
import { MatTableModule } from '@angular/material/table';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatDialogModule, MatDialog } from '@angular/material/dialog';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatMenuModule } from '@angular/material/menu';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDividerModule } from '@angular/material/divider';
import { MatTabsModule } from '@angular/material/tabs';
import { MatSnackBar } from '@angular/material/snack-bar';
import { DatePipe, TitleCasePipe } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { debounceTime, distinctUntilChanged, Subject } from 'rxjs';
import { ActivatedRoute } from '@angular/router';
import { ApiService } from '../../core/services/api.service';
import { AuthService } from '../../core/services/auth.service';
import { EnrolStudentDialogComponent } from './enrol-student-dialog.component';
import { EditClassDialogComponent } from './edit-class-dialog.component';
import { EditStudentDialogComponent } from './edit-student-dialog.component';
import { AssignClassDialogComponent } from './assign-class-dialog.component';
import { StudentProfileComponent } from './student-profile.component';
import type { Student, SchoolClass, PaginatedResponse, ApiResponse } from '../../core/models';

@Component({
  selector: 'app-students',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    MatTableModule, MatCardModule, MatButtonModule, MatIconModule,
    MatFormFieldModule, MatInputModule, MatSelectModule,
    MatDialogModule, MatPaginatorModule, MatProgressSpinnerModule,
    MatMenuModule, MatTooltipModule, MatDividerModule, MatTabsModule,
    DatePipe, TitleCasePipe, StudentProfileComponent,
  ],
  template: `
    <!-- Page header -->
    <div class="page-header">
      <div>
        <h1>Students</h1>
        <div class="subtitle">{{ total() }} students enrolled across {{ classes().length }} classes</div>
      </div>
      <div class="actions">

        @if (canManage()) {
          <button class="btn-primary-custom" (click)="openEnrolDialog()">
            <mat-icon style="font-size:16px;width:16px;height:16px">person_add</mat-icon>
            Enrol Student
          </button>
        }
      </div>
    </div>

    <mat-tab-group [selectedIndex]="selectedTab()" (selectedIndexChange)="selectedTab.set($event)" class="students-tabs">

      <!-- ── Tab 1: Students list ───────────────────────────────────── -->
      <mat-tab label="Students">

        <!-- Stats bar -->
        <div class="stats-bar">
          <div class="stat-pill">
            <div class="sp-icon blue"><mat-icon style="font-size:14px;width:14px;height:14px">people</mat-icon></div>
            <div><div class="sp-val">{{ total() }}</div><div class="sp-lbl">Total</div></div>
          </div>
          <div class="stat-pill">
            <div class="sp-icon green"><mat-icon style="font-size:14px;width:14px;height:14px">check_circle</mat-icon></div>
            <div><div class="sp-val">{{ activeCount() }}</div><div class="sp-lbl">Active</div></div>
          </div>
          <div class="stat-pill">
            <div class="sp-icon amber"><mat-icon style="font-size:14px;width:14px;height:14px">schedule</mat-icon></div>
            <div><div class="sp-val">{{ unassignedCount() }}</div><div class="sp-lbl">No class</div></div>
          </div>
          <div class="stat-pill">
            <div class="sp-icon purple"><mat-icon style="font-size:14px;width:14px;height:14px">class</mat-icon></div>
            <div><div class="sp-val">{{ classes().length }}</div><div class="sp-lbl">Classes</div></div>
          </div>
        </div>

        <!-- Filters -->
        <div class="filter-bar">
          <div class="search-box">
            <mat-icon class="sb-icon">search</mat-icon>
            <input [value]="searchTerm()" (input)="onSearch($event)"
                   placeholder="Search by name or admission no…" />
            @if (searchTerm()) {
              <button class="sb-clear" (click)="clearSearch()">
                <mat-icon style="font-size:14px;width:14px;height:14px">close</mat-icon>
              </button>
            }
          </div>

          <div class="filter-selects">
            <select class="filter-select" [value]="selectedClass()" (change)="onClassFilter($any($event.target).value)">
              <option value="">All Classes</option>
              @for (cls of classes(); track cls.id) {
                <option [value]="cls.id">{{ cls.name }}</option>
              }
            </select>

            <select class="filter-select" [value]="activeFilter()" (change)="onActiveFilter($any($event.target).value)">
              <option value="true">Active</option>
              <option value="false">Inactive</option>
            </select>
          </div>
        </div>

        <!-- Table -->
        <div class="table-container">
          @if (loading()) {
            <div class="table-loading">
              <mat-progress-spinner mode="indeterminate" diameter="32" />
              <span>Loading students…</span>
            </div>
          } @else if (!students().length) {
            <div class="table-empty">
              <div class="empty-icon">👤</div>
              <div class="empty-title">No students found</div>
              <div class="empty-sub">
                @if (searchTerm()) {
                  Try a different search term or clear the filter.
                } @else {
                  Enrol your first student to get started.
                }
              </div>
              @if (!searchTerm() && canManage()) {
                <button class="btn-primary-custom" (click)="openEnrolDialog()">
                  <mat-icon style="font-size:16px;width:16px;height:16px">person_add</mat-icon>
                  Enrol First Student
                </button>
              }
            </div>
          } @else {
            <table class="data-table">
              <thead>
                <tr>
                  <th>Student</th>
                  <th>Admission No</th>
                  <th>Class</th>
                  <th>Date of Birth</th>
                  <th>Gender</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                @for (s of students(); track s.id) {
                  <tr class="data-row">
                    <td>
                      <div class="student-cell">
                        <div class="student-av" [style.background]="getAvatarColor(s.first_name)">
                          {{ s.first_name[0] }}{{ s.last_name[0] }}
                        </div>
                        <div>
                          <div class="student-name">{{ s.first_name }} {{ s.last_name }}</div>
                          <div class="student-email text-xs text-muted">Admitted {{ s.admission_date | date:'d MMM yyyy' }}</div>
                        </div>
                      </div>
                    </td>
                    <td><span class="mono-chip">{{ s.admission_no }}</span></td>
                    <td>
                      @if (s.class_name) {
                        <span class="class-tag">{{ s.class_name }}</span>
                      } @else {
                        <span class="text-muted text-xs">— Unassigned</span>
                      }
                    </td>
                    <td class="text-sm">{{ s.dob | date:'d MMM yyyy' }}</td>
                    <td class="text-sm">{{ s.gender | titlecase }}</td>
                    <td>
                      <span [class]="'badge badge-' + (s.is_active ? 'active' : 'inactive')">
                        {{ s.is_active ? 'Active' : 'Inactive' }}
                      </span>
                    </td>
                    <td>
                      <button class="row-menu-btn" [matMenuTriggerFor]="menu" (click)="$event.stopPropagation()">
                        <mat-icon style="font-size:18px;width:18px;height:18px">more_horiz</mat-icon>
                      </button>
                      <mat-menu #menu="matMenu">
                        <button mat-menu-item (click)="viewStudent(s)">
                          <mat-icon>visibility</mat-icon> View Profile
                        </button>
                        @if (canManage()) {
                          <button mat-menu-item (click)="editStudent(s)">
                            <mat-icon>edit</mat-icon> Edit Details
                          </button>
                          <button mat-menu-item (click)="openAssignClass(s)">
                            <mat-icon>class</mat-icon> Assign Class
                          </button>
                          <mat-divider />
                          <button mat-menu-item (click)="deactivate(s)" style="color:#EF4444">
                            <mat-icon style="color:#EF4444">person_off</mat-icon> Deactivate
                          </button>
                        }
                      </mat-menu>
                    </td>
                  </tr>
                }
              </tbody>
            </table>

            <!-- Pagination -->
            <div class="table-footer">
              <div class="tf-info">Showing {{ (page()-1)*pageSize + 1 }}–{{ min(page()*pageSize, total()) }} of {{ total() }}</div>
              <mat-paginator
                [length]="total()"
                [pageSize]="pageSize"
                [pageSizeOptions]="[10,20,50]"
                [pageIndex]="page()-1"
                (page)="onPage($event)"
                showFirstLastButtons />
            </div>
          }
        </div>
      </mat-tab>

    </mat-tab-group>

    <!-- Student profile slide-over -->
    <app-student-profile
      [studentId]="viewProfileId()"
      (click)="viewProfileId.set(null)" />
  `,
  styles: [`
    /* Tabs */
    .students-tabs { margin-top: 0; }
    ::ng-deep .students-tabs .mat-mdc-tab-body-wrapper { padding-top: 16px; }

    /* Buttons */
    .btn-primary-custom {
      display: inline-flex; align-items: center; gap: 6px;
      background: var(--blue); color: #fff;
      border: none; border-radius: 8px; padding: 0 16px; height: 36px;
      font-size: 13px; font-weight: 500; cursor: pointer;
      transition: background .15s;
      &:hover:not(:disabled) { background: #1D4ED8; }
      &:disabled { opacity: .6; cursor: not-allowed; }
    }
    .btn-outline-custom {
      display: inline-flex; align-items: center; gap: 6px;
      background: #fff; color: var(--text-2);
      border: 1px solid var(--border); border-radius: 8px; padding: 0 14px; height: 36px;
      font-size: 13px; font-weight: 500; cursor: pointer;
      &:hover { background: var(--bg); }
    }

    /* Stats bar */
    .stats-bar {
      display: flex; gap: 12px; margin-bottom: 14px;
      flex-wrap: wrap;
    }
    .stat-pill {
      display: flex; align-items: center; gap: 10px;
      background: var(--surface); border: 1px solid var(--border);
      border-radius: 9px; padding: 10px 16px; min-width: 120px;
    }
    .sp-icon {
      width: 30px; height: 30px; border-radius: 8px;
      display: flex; align-items: center; justify-content: center; flex-shrink: 0;
      &.blue   { background: var(--blue-light);   color: var(--blue); }
      &.green  { background: var(--green-light);  color: var(--green); }
      &.amber  { background: var(--amber-light);  color: var(--amber); }
      &.purple { background: var(--purple-light); color: var(--purple); }
    }
    .sp-val { font-size: 18px; font-weight: 600; color: var(--text); line-height: 1.1; }
    .sp-lbl { font-size: 11px; color: var(--text-3); margin-top: 1px; }

    /* Filter bar */
    .filter-bar {
      display: flex; gap: 10px; align-items: center;
      margin-bottom: 12px; flex-wrap: wrap;
    }

    .search-box {
      display: flex; align-items: center; gap: 8px;
      background: var(--surface); border: 1px solid var(--border);
      border-radius: 8px; padding: 0 12px; height: 36px;
      flex: 1; min-width: 240px;
      &:focus-within { border-color: var(--blue); box-shadow: 0 0 0 3px rgba(37,99,235,.1); }
      .sb-icon { font-size: 16px; width: 16px; height: 16px; color: var(--text-4); flex-shrink: 0; }
      input { flex: 1; border: none; background: transparent; outline: none; font-size: 13px; color: var(--text); &::placeholder { color: var(--text-4); } }
      .sb-clear { background: none; border: none; cursor: pointer; color: var(--text-4); display: flex; align-items: center; padding: 0; &:hover { color: var(--text-2); } }
    }

    .filter-selects { display: flex; gap: 8px; }
    .filter-select {
      height: 36px; padding: 0 10px;
      background: var(--surface); border: 1px solid var(--border);
      border-radius: 8px; font-size: 13px; color: var(--text-2);
      outline: none; cursor: pointer;
      &:focus { border-color: var(--blue); }
    }

    /* Table */
    .table-container {
      background: var(--surface); border: 1px solid var(--border);
      border-radius: 10px; overflow: hidden;
    }

    .table-loading, .table-empty {
      display: flex; flex-direction: column; align-items: center;
      justify-content: center; gap: 10px;
      padding: 60px; color: var(--text-3); font-size: 13px;
    }
    .empty-icon  { font-size: 40px; line-height: 1; }
    .empty-title { font-size: 15px; font-weight: 600; color: var(--text-2); }
    .empty-sub   { font-size: 13px; color: var(--text-3); text-align: center; max-width: 300px; }

    .data-table {
      width: 100%; border-collapse: collapse;
      th {
        text-align: left; padding: 11px 14px;
        font-size: 10px; font-weight: 600;
        text-transform: uppercase; letter-spacing: .4px;
        color: var(--text-4); background: var(--bg);
        border-bottom: 1px solid var(--border);
      }
      td { padding: 11px 14px; border-bottom: 1px solid var(--border-light); vertical-align: middle; }
    }
    .data-row {
      transition: background .1s;
      &:hover { background: #FAFAFA; }
      &:last-child td { border-bottom: none; }
    }

    .student-cell { display: flex; align-items: center; gap: 11px; }
    .student-av {
      width: 34px; height: 34px; border-radius: 9px;
      color: #fff; font-size: 12px; font-weight: 600;
      display: flex; align-items: center; justify-content: center; flex-shrink: 0;
    }
    .student-name { font-size: 13px; font-weight: 500; color: var(--text); }

    .mono-chip {
      font-family: 'SF Mono', 'Fira Code', monospace;
      font-size: 11.5px; background: var(--bg); color: var(--blue);
      padding: 2px 8px; border-radius: 5px; font-weight: 500;
    }
    .class-tag {
      background: var(--purple-light); color: var(--purple);
      font-size: 11px; font-weight: 500; padding: 2px 8px; border-radius: 5px;
    }

    .row-menu-btn {
      background: none; border: none; cursor: pointer;
      width: 28px; height: 28px; border-radius: 6px;
      display: flex; align-items: center; justify-content: center; color: var(--text-3);
      &:hover { background: var(--bg); color: var(--text-2); }
    }

    .table-footer {
      display: flex; align-items: center; justify-content: space-between;
      padding: 8px 14px; border-top: 1px solid var(--border-light);
      background: var(--bg);
    }
    .tf-info { font-size: 12px; color: var(--text-3); }

    /* Classes tab */
    .classes-panel { display: flex; flex-direction: column; gap: 16px; }

    .classes-grid {
      display: grid; grid-template-columns: repeat(auto-fill, minmax(190px, 1fr)); gap: 12px;
    }
    .class-card {
      background: var(--surface); border: 1px solid var(--border);
      border-radius: 10px; padding: 16px;
    }
    .cc-top { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 10px; }
    .cc-icon { width: 40px; height: 40px; border-radius: 10px; display: flex; align-items: center; justify-content: center; }
    .cc-name { font-size: 14px; font-weight: 600; color: var(--text); margin-bottom: 3px; }
    .cc-meta { font-size: 11px; color: var(--text-3); margin-bottom: 12px; }
    .cc-fill { display: flex; align-items: center; gap: 8px; }
    .cf-track { flex: 1; height: 5px; background: var(--border); border-radius: 3px; overflow: hidden; }
    .cf-bar   { height: 100%; border-radius: 3px; transition: width .3s; }
    .cf-count { font-size: 11px; font-weight: 500; color: var(--text-3); white-space: nowrap; }

    .add-class-card {
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      gap: 8px; border: 1.5px dashed var(--border); cursor: pointer;
      min-height: 140px; transition: all .15s;
      &:hover { border-color: var(--blue); background: var(--blue-light); }
      .ac-icon { color: var(--blue); mat-icon { font-size: 28px; width: 28px; height: 28px; } }
      .ac-label { font-size: 13px; font-weight: 500; color: var(--blue); }
    }

    .add-class-form {
      background: var(--surface); border: 1px solid var(--border);
      border-radius: 10px; padding: 18px 20px;
      .acf-title { display: flex; align-items: center; gap: 7px; font-size: 14px; font-weight: 600; color: var(--text); margin-bottom: 16px; }
    }
    .acf-grid {
      display: grid; grid-template-columns: repeat(4, 1fr) auto; gap: 12px; align-items: end;
    }
    .acf-actions { display: flex; gap: 8px; align-items: center; }

    .field-group { display: flex; flex-direction: column; gap: 5px; }
    .field-label { font-size: 12px; font-weight: 500; color: var(--text-2); }
    .field-input {
      width: 100%; height: 36px; padding: 0 10px;
      background: var(--bg); border: 1px solid var(--border);
      border-radius: 7px; font-size: 13px; color: var(--text);
      outline: none; font-family: inherit;
      &:focus { background: #fff; border-color: var(--blue); box-shadow: 0 0 0 3px rgba(37,99,235,.1); }
      &::placeholder { color: var(--text-4); }
    }
  `],
})
export class StudentsComponent implements OnInit {
  private api    = inject(ApiService);
  private auth   = inject(AuthService);
  private snack  = inject(MatSnackBar);
  private dialog = inject(MatDialog);
  private fb     = inject(FormBuilder);
  private route  = inject(ActivatedRoute);

  canManage = () => ['owner', 'principal', 'admission_staff'].includes(this.auth.user()?.role ?? '');

  students      = signal<Student[]>([]);
  classes       = signal<SchoolClass[]>([]);
  loading       = signal(true);
  total         = signal(0);
  activeCount   = signal(0);
  unassignedCount = signal(0);
  searchTerm    = signal('');
  selectedClass = signal('');
  activeFilter  = signal('true');
  page          = signal(1);
  pageSize      = 20;
  selectedTab   = signal(0);
  showAddClass  = signal(false);
  viewProfileId = signal<string | null>(null);
  addingClass   = signal(false);

  private search$ = new Subject<string>();

  classForm = this.fb.group({
    name:     ['', Validators.required],
    capacity: [20, [Validators.required, Validators.min(1)]],
    age_min:  [null as number | null],
    age_max:  [null as number | null],
  });

  ngOnInit() {
    const q = this.route.snapshot.queryParamMap.get('search');
    if (q) this.searchTerm.set(q);
    this.loadClasses();
    this.loadStudents();
    this.loadCounts();
    this.search$.pipe(debounceTime(350), distinctUntilChanged()).subscribe(() => {
      this.page.set(1); this.loadStudents();
    });
  }

  loadStudents() {
    this.loading.set(true);
    const params: Record<string, unknown> = { page: this.page(), limit: this.pageSize, is_active: this.activeFilter() };
    if (this.searchTerm()) params['search'] = this.searchTerm();
    if (this.selectedClass()) params['class_id'] = this.selectedClass();
    this.api.get<PaginatedResponse<Student>>('/students', params).subscribe({
      next: res => { this.students.set(res.data); this.total.set(res.meta.total); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  loadCounts() {
    this.api.get<PaginatedResponse<Student>>('/students', { is_active: 'true', limit: 1 }).subscribe({
      next: res => this.activeCount.set(res.meta.total),
    });
    this.api.get<PaginatedResponse<Student>>('/students', { is_active: 'true', limit: 1, no_class: 'true' }).subscribe({
      next: res => this.unassignedCount.set(res.meta.total),
      error: () => {},
    });
  }

  loadClasses() {
    this.api.get<ApiResponse<SchoolClass[]>>('/students/classes').subscribe({
      next: res => this.classes.set(res.data),
    });
  }

  onSearch(e: Event) { this.searchTerm.set((e.target as HTMLInputElement).value); this.search$.next(this.searchTerm()); }
  clearSearch()       { this.searchTerm.set(''); this.page.set(1); this.loadStudents(); }
  onClassFilter(val: string)  { this.selectedClass.set(val);  this.page.set(1); this.loadStudents(); }
  onActiveFilter(val: string) { this.activeFilter.set(val);   this.page.set(1); this.loadStudents(); }
  onPage(e: PageEvent)        { this.page.set(e.pageIndex + 1); this.pageSize = e.pageSize; this.loadStudents(); }

  min(a: number, b: number) { return Math.min(a, b); }

  getAvatarColor(name: string): string {
    const colors = ['#2563EB','#7C3AED','#DB2777','#D97706','#059669','#0891B2'];
    const i = name.charCodeAt(0) % colors.length;
    return colors[i];
  }

  getClassColor(name: string): string {
    const colors = ['#2563EB','#7C3AED','#DB2777','#D97706','#059669','#0891B2','#DC2626'];
    return colors[name.charCodeAt(0) % colors.length];
  }

  getEnrolPct(cls: SchoolClass): number {
    return cls.capacity > 0 ? Math.round((cls.enrolled_count / cls.capacity) * 100) : 0;
  }

  openEnrolDialog() {
    const ref = this.dialog.open(EnrolStudentDialogComponent, {
      disableClose: true, width: '580px', maxHeight: '90vh', panelClass: 'clean-dialog',
    });
    ref.afterClosed().subscribe((student: Student) => {
      if (student) {
        this.snack.open('Student enrolled — Adm No: ' + student.admission_no, 'OK', { duration: 5000 });
        this.loadStudents();
        this.loadClasses();
      }
    });
  }

  viewStudent(s: Student) {
    this.viewProfileId.set(s.id);
  }

  editStudent(s: Student) {
    const ref = this.dialog.open(EditStudentDialogComponent, {
      data: s, width: '95vw', maxWidth: '560px', maxHeight: '90vh', disableClose: true,
    });
    ref.afterClosed().subscribe((updated: Student) => {
      if (updated) {
        this.snack.open('Student updated successfully', 'OK', { duration: 3000 });
        this.loadStudents();
      }
    });
  }

  openAssignClass(s: Student) {
    const ref = this.dialog.open(AssignClassDialogComponent, {
      data: s, width: '500px', disableClose: true,
    });
    ref.afterClosed().subscribe((result: any) => {
      if (result) {
        this.snack.open('Class assigned successfully', 'OK', { duration: 3000 });
        this.loadStudents();
        this.loadClasses();
      }
    });
  }

  editClass(cls: SchoolClass) {
    const ref = this.dialog.open(EditClassDialogComponent, {
      data: cls,
      width: '460px',
      disableClose: true,
    });
    ref.afterClosed().subscribe((updated: SchoolClass) => {
      if (updated) {
        this.snack.open('Class updated successfully', 'OK', { duration: 3000 });
        this.loadClasses();
        this.loadStudents();
      }
    });
  }

  confirmDeleteClass(cls: SchoolClass) {
    if (!confirm('Delete class "' + cls.name + '"? This cannot be undone.\nNote: Classes with active students cannot be deleted.')) return;
    this.api.delete('/students/classes/' + cls.id).subscribe({
      next: () => {
        this.snack.open('Class deleted', 'OK', { duration: 3000 });
        this.loadClasses();
      },
      error: (err: any) => {
        this.snack.open(err.error?.error?.message ?? 'Could not delete class', 'OK', { duration: 4000 });
      },
    });
  }

  submitClass() {
    if (this.classForm.invalid) return;
    this.addingClass.set(true);
    const val = this.classForm.value;
    const payload: Record<string, unknown> = { name: val.name, capacity: val.capacity };
    if (val.age_min) payload['age_group_min'] = val.age_min;
    if (val.age_max) payload['age_group_max'] = val.age_max;

    this.api.post('/students/classes', payload).subscribe({
      next: () => {
        this.addingClass.set(false);
        this.showAddClass.set(false);
        this.classForm.reset({ capacity: 20 });
        this.snack.open('Class created successfully', 'OK', { duration: 3000 });
        this.loadClasses();
      },
      error: (err: any) => {
        this.addingClass.set(false);
        this.snack.open(err.error?.error?.message ?? 'Error creating class', 'OK', { duration: 3000 });
      },
    });
  }

  deactivate(s: Student) {
    if (!confirm('Deactivate ' + s.first_name + ' ' + s.last_name + '?')) return;
    this.api.delete('/students/' + s.id).subscribe({
      next: () => { this.snack.open('Student deactivated', 'OK', { duration: 3000 }); this.loadStudents(); },
      error: (err: any) => this.snack.open(err.error?.error?.message ?? 'Error', 'OK', { duration: 3000 }),
    });
  }
}
