import { Component, inject, signal, OnInit, computed } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatMenuModule } from '@angular/material/menu';
import { MatTabsModule } from '@angular/material/tabs';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { FormsModule } from '@angular/forms';
import { MatSnackBar } from '@angular/material/snack-bar';
import { DatePipe } from '@angular/common';
import { ApiService } from '../../core/services/api.service';
import { RecordObservationDialogComponent } from './record-observation-dialog.component';
import { StudentProgressComponent } from './student-progress.component';
import type { SchoolClass } from '../../core/models';

export interface Domain {
  id:          string;
  name:        string;
  code:        string;
  is_standard: boolean;
  description: string | null;
  sort_order:  number;
}

export interface Milestone {
  id:          string;
  domain_id:   string;
  domain_name: string;
  domain_code: string;
  code:        string;
  name:        string;
  description: string | null;
  age_min:     number | null;
  age_max:     number | null;
  sort_order:  number;
}

export interface Observation {
  id:             string;
  student_id:     string;
  student_name:   string;
  admission_no:   string;
  milestone_id:   string;
  milestone_name: string;
  milestone_code: string;
  domain_id:      string;
  domain_name:    string;
  domain_code:    string;
  grade:          'not_started' | 'in_progress' | 'led' | 'mastered';
  notes:          string | null;
  observed_on:    string;
  observer_name:  string;
}

const GRADE_CONFIG: Record<string, { label: string; color: string; bg: string; icon: string }> = {
  not_started: { label: 'Not Started', color: '#9CA3AF', bg: '#F9FAFB',   icon: 'radio_button_unchecked' },
  in_progress: { label: 'In Progress', color: '#F59E0B', bg: '#FFFBEB',   icon: 'pending' },
  led:         { label: 'Led',         color: '#3B82F6', bg: '#EFF6FF',   icon: 'support' },
  mastered:    { label: 'Mastered',    color: '#10B981', bg: '#ECFDF5',   icon: 'check_circle' },
};

@Component({
  selector: 'app-observations',
  standalone: true,
  imports: [
    MatIconModule, MatProgressSpinnerModule,
    MatMenuModule, MatTabsModule, MatDialogModule, FormsModule,
    DatePipe, StudentProgressComponent,
  ],
  template: `
    <mat-tab-group class="obs-page-tabs">

      <!-- ── Student Progress tab ──────────────────────────── -->
      <mat-tab label="🎯  Student Progress">
        <div class="tab-body">
          <div class="page-header">
            <div>
              <h1>Observations</h1>
              <div class="subtitle">Track child developmental milestones across all Montessori domains</div>
            </div>
            <button class="btn-primary-custom" (click)="openRecord()">
              <mat-icon style="font-size:16px;width:16px;height:16px">add</mat-icon>
              Record Observation
            </button>
          </div>

          <!-- Student selector -->
          <div class="selector-bar">
            <div class="filter-selects">
              <select class="filter-select" [value]="selectedClass()"
                      (change)="onClassChange($any($event.target).value)">
                <option value="">All Classes</option>
                @for (cls of classes(); track cls.id) {
                  <option [value]="cls.id">{{ cls.name }}</option>
                }
              </select>

              <select class="filter-select w-240" [value]="selectedStudentId()"
                      (change)="selectedStudentId.set($any($event.target).value)">
                <option value="">— Select a student to view progress —</option>
                @for (s of students(); track s.id) {
                  <option [value]="s.id">
                    {{ s.first_name }} {{ s.last_name }} · {{ s.admission_no }}
                  </option>
                }
              </select>
            </div>
          </div>

          @if (selectedStudentId()) {
            <div class="progress-toolbar">
              <div class="pt-info">
                {{ getStudentName(selectedStudentId()) }}
              </div>
              <div class="pt-actions">
                <button class="btn-outline-sm" (click)="exportCsv()">
                  <mat-icon style="font-size:14px;width:14px;height:14px">download</mat-icon>
                  Export CSV
                </button>
                <button class="btn-outline-sm" (click)="printReport()">
                  <mat-icon style="font-size:14px;width:14px;height:14px">print</mat-icon>
                  Print Report
                </button>
              </div>
            </div>
            <app-student-progress
              [studentId]="selectedStudentId()"
              [domains]="domains()"
              (observationRecorded)="openRecord($event)"
              (progressLoaded)="onProgressLoaded($event)" />
          } @else {
            <div class="empty-state">
              <div class="empty-icon">🎯</div>
              <div class="empty-title">Select a student</div>
              <div class="empty-sub">Choose a student above to view their developmental progress across all Montessori domains.</div>
            </div>
          }
        </div>
      </mat-tab>

      <!-- ── Recent Observations tab ───────────────────────── -->
      <mat-tab label="📋  Recent Observations">
        <div class="tab-body">

          <div class="filter-bar">
            <div class="filter-selects">
              <select class="filter-select" [value]="obsClass()"
                      (change)="obsClass.set($any($event.target).value); loadObservations()">
                <option value="">All Classes</option>
                @for (cls of classes(); track cls.id) {
                  <option [value]="cls.id">{{ cls.name }}</option>
                }
              </select>

              <select class="filter-select" [value]="obsDomainId()"
                      (change)="obsDomainId.set($any($event.target).value); loadObservations()">
                <option value="">All Domains</option>
                @for (d of domains(); track d.id) {
                  <option [value]="d.id">{{ d.name }}</option>
                }
              </select>

              <select class="filter-select" [value]="obsGrade()"
                      (change)="obsGrade.set($any($event.target).value); loadObservations()">
                <option value="">All Grades</option>
                <option value="not_started">Not Started</option>
                <option value="in_progress">In Progress</option>
                <option value="led">Led</option>
                <option value="mastered">Mastered</option>
              </select>
            </div>

            <button class="icon-btn" (click)="loadObservations()">
              <mat-icon style="font-size:18px;width:18px;height:18px">refresh</mat-icon>
            </button>
          </div>

          <div class="table-container">
            @if (obsLoading()) {
              <div class="table-loading">
                <mat-progress-spinner mode="indeterminate" diameter="32" />
              </div>
            } @else if (!observations().length) {
              <div class="table-empty">
                <div class="empty-icon">🔍</div>
                <div class="empty-title">No observations found</div>
                <div class="empty-sub">Try adjusting filters or record a new observation.</div>
              </div>
            } @else {
              <table class="data-table">
                <thead>
                  <tr>
                    <th>Student</th>
                    <th>Domain</th>
                    <th>Milestone</th>
                    <th>Grade</th>
                    <th>Date</th>
                    <th>Notes</th>
                    <th>Observer</th>
                  </tr>
                </thead>
                <tbody>
                  @for (o of observations(); track o.id) {
                    <tr class="data-row">
                      <td>
                        <div class="student-cell">
                          <div class="student-av" [style.background]="getAvatarColor(o.student_name)">
                            {{ o.student_name[0] }}
                          </div>
                          <div>
                            <div class="cell-primary">{{ o.student_name }}</div>
                            <div class="cell-secondary">{{ o.admission_no }}</div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span class="domain-tag" [style.background]="getDomainColor(o.domain_code) + '20'"
                              [style.color]="getDomainColor(o.domain_code)">
                          {{ o.domain_name }}
                        </span>
                      </td>
                      <td>
                        <div class="cell-primary">{{ o.milestone_name }}</div>
                        <div class="cell-secondary">{{ o.milestone_code }}</div>
                      </td>
                      <td>
                        <span class="grade-badge"
                              [style.background]="gradeConfig[o.grade].bg"
                              [style.color]="gradeConfig[o.grade].color">
                          <mat-icon style="font-size:11px;width:11px;height:11px">{{ gradeConfig[o.grade].icon }}</mat-icon>
                          {{ gradeConfig[o.grade].label }}
                        </span>
                      </td>
                      <td class="text-sm">{{ o.observed_on | date:'d MMM yyyy' }}</td>
                      <td class="text-sm text-muted">{{ o.notes || '—' }}</td>
                      <td class="text-sm">{{ o.observer_name }}</td>
                    </tr>
                  }
                </tbody>
              </table>

              <div class="table-footer">
                <div class="tf-info">{{ observations().length }} observations</div>
              </div>
            }
          </div>
        </div>
      </mat-tab>

      <!-- ── Milestones Setup tab ───────────────────────────── -->
      <mat-tab label="⚙️  Milestones">
        <div class="tab-body">
          <div class="page-header">
            <div>
              <div style="font-size:15px;font-weight:600;color:var(--text)">Milestones Setup</div>
              <div class="subtitle">Manage developmental milestones by domain</div>
            </div>
          </div>

          <div class="domain-tabs">
            @for (d of domains(); track d.id) {
              <button class="domain-tab" [class.active]="activeDomainId() === d.id"
                      (click)="activeDomainId.set(d.id); cancelEdit()">
                <span class="dt-icon" [style.background]="getDomainColor(d.code) + '20'"
                      [style.color]="getDomainColor(d.code)">
                  {{ getDomainEmoji(d.code) }}
                </span>
                {{ d.name }}
              </button>
            }
          </div>

          @if (activeDomainId()) {
            <div class="milestones-list">

              @for (m of activeDomainMilestones(); track m.id) {
                @if (editingMilestoneId() === m.id) {
                  <!-- Inline edit row -->
                  <div class="milestone-row editing">
                    <input class="me-input code" [(ngModel)]="editCode" placeholder="Code">
                    <div class="me-main">
                      <input class="me-input name" [(ngModel)]="editName" placeholder="Milestone name">
                      <input class="me-input desc" [(ngModel)]="editDescription" placeholder="Description (optional)">
                      <div class="me-row">
                        <input class="me-input sm" type="number" [(ngModel)]="editAgeMin" placeholder="Age min (m)">
                        <input class="me-input sm" type="number" [(ngModel)]="editAgeMax" placeholder="Age max (m)">
                      </div>
                    </div>
                    <div class="me-actions">
                      <button class="me-save-btn" (click)="saveMilestone(m.id)" [disabled]="saving()">
                        <mat-icon style="font-size:15px;width:15px;height:15px">check</mat-icon>
                      </button>
                      <button class="me-cancel-btn" (click)="cancelEdit()">
                        <mat-icon style="font-size:15px;width:15px;height:15px">close</mat-icon>
                      </button>
                    </div>
                  </div>
                } @else {
                  <!-- Normal row -->
                  <div class="milestone-row">
                    <div class="mr-code">{{ m.code }}</div>
                    <div class="mr-info">
                      <div class="mr-name">{{ m.name }}</div>
                      @if (m.description) {
                        <div class="mr-desc">{{ m.description }}</div>
                      }
                    </div>
                    @if (m.age_min && m.age_max) {
                      <div class="mr-age">{{ m.age_min }}–{{ m.age_max }}m</div>
                    }
                    <div class="mr-actions">
                      <button class="mr-action-btn" (click)="startEdit(m)" title="Edit">
                        <mat-icon style="font-size:15px;width:15px;height:15px">edit</mat-icon>
                      </button>
                      <button class="mr-action-btn danger" (click)="deleteMilestone(m)" title="Delete">
                        <mat-icon style="font-size:15px;width:15px;height:15px">delete</mat-icon>
                      </button>
                    </div>
                  </div>
                }
              }

              <!-- Add new milestone row -->
              @if (addingMilestone()) {
                <div class="milestone-row editing new-row">
                  <input class="me-input code" [(ngModel)]="newCode" placeholder="e.g. PL-042">
                  <div class="me-main">
                    <input class="me-input name" [(ngModel)]="newName" placeholder="Milestone name *">
                    <input class="me-input desc" [(ngModel)]="newDescription" placeholder="Description (optional)">
                    <div class="me-row">
                      <input class="me-input sm" type="number" [(ngModel)]="newAgeMin" placeholder="Age min (m)">
                      <input class="me-input sm" type="number" [(ngModel)]="newAgeMax" placeholder="Age max (m)">
                    </div>
                  </div>
                  <div class="me-actions">
                    <button class="me-save-btn" (click)="addMilestone()" [disabled]="saving()">
                      <mat-icon style="font-size:15px;width:15px;height:15px">check</mat-icon>
                    </button>
                    <button class="me-cancel-btn" (click)="addingMilestone.set(false)">
                      <mat-icon style="font-size:15px;width:15px;height:15px">close</mat-icon>
                    </button>
                  </div>
                </div>
              }

              <button class="add-milestone-btn" (click)="startAdd()" [disabled]="addingMilestone()">
                <mat-icon style="font-size:16px;width:16px;height:16px">add_circle_outline</mat-icon>
                Add Milestone
              </button>
            </div>
          }
        </div>
      </mat-tab>

    </mat-tab-group>
  `,
  styles: [`
    ::ng-deep .obs-page-tabs .mat-mdc-tab-body-wrapper { padding: 0; }
    .tab-body { padding-top: 16px; }

    .btn-primary-custom {
      display: inline-flex; align-items: center; gap: 6px;
      background: var(--blue); color: #fff;
      border: none; border-radius: 8px; padding: 0 16px; height: 36px;
      font-size: 13px; font-weight: 500; cursor: pointer;
      &:hover { background: #1D4ED8; }
    }

    .selector-bar, .filter-bar {
      display: flex; gap: 10px; align-items: center;
      margin-bottom: 16px; flex-wrap: wrap;
    }
    .filter-selects { display: flex; gap: 8px; flex-wrap: wrap; }
    .filter-select {
      height: 36px; padding: 0 10px;
      background: var(--surface); border: 1px solid var(--border);
      border-radius: 8px; font-size: 13px; color: var(--text-2);
      outline: none; cursor: pointer;
      &:focus { border-color: var(--blue); }
    }
    .w-240 { width: 280px; }
    .icon-btn {
      width: 36px; height: 36px; border-radius: 8px;
      background: var(--surface); border: 1px solid var(--border);
      display: flex; align-items: center; justify-content: center;
      cursor: pointer; color: var(--text-3);
      &:hover { background: var(--bg); }
    }

    .progress-toolbar {
      display: flex; align-items: center; justify-content: space-between;
      margin-bottom: 12px; padding: 10px 14px;
      background: var(--surface); border: 1px solid var(--border); border-radius: 9px;
    }
    .pt-info { font-size: 14px; font-weight: 600; color: var(--text); }
    .pt-actions { display: flex; gap: 8px; }
    .btn-outline-sm {
      display: inline-flex; align-items: center; gap: 5px;
      background: #fff; color: var(--text-2);
      border: 1px solid var(--border); border-radius: 7px;
      padding: 0 12px; height: 32px; font-size: 12px; font-weight: 500; cursor: pointer;
      &:hover { background: var(--bg); }
    }

    .empty-state {
      display: flex; flex-direction: column; align-items: center; gap: 10px;
      padding: 80px; color: var(--text-3);
      .empty-icon  { font-size: 48px; line-height: 1; }
      .empty-title { font-size: 16px; font-weight: 600; color: var(--text-2); }
      .empty-sub   { font-size: 13px; text-align: center; max-width: 360px; }
    }

    /* Table */
    .table-container {
      background: var(--surface); border: 1px solid var(--border);
      border-radius: 10px; overflow: hidden;
    }
    .table-loading { display: flex; justify-content: center; padding: 48px; }
    .table-empty {
      display: flex; flex-direction: column; align-items: center; gap: 8px;
      padding: 48px; color: var(--text-3);
      .empty-icon  { font-size: 36px; }
      .empty-title { font-size: 14px; font-weight: 600; color: var(--text-2); }
      .empty-sub   { font-size: 12px; }
    }
    .data-table {
      width: 100%; border-collapse: collapse;
      th {
        text-align: left; padding: 11px 14px;
        font-size: 10px; font-weight: 600; text-transform: uppercase;
        letter-spacing: .4px; color: var(--text-4); background: var(--bg);
        border-bottom: 1px solid var(--border);
      }
      td { padding: 10px 14px; border-bottom: 1px solid var(--border-light); vertical-align: middle; }
    }
    .data-row {
      &:hover { background: #FAFAFA; }
      &:last-child td { border-bottom: none; }
    }
    .student-cell { display: flex; align-items: center; gap: 10px; }
    .student-av {
      width: 30px; height: 30px; border-radius: 8px; flex-shrink: 0;
      color: #fff; font-size: 12px; font-weight: 600;
      display: flex; align-items: center; justify-content: center;
    }
    .cell-primary   { font-size: 13px; font-weight: 500; color: var(--text); }
    .cell-secondary { font-size: 11px; color: var(--text-3); }
    .text-sm   { font-size: 12.5px; color: var(--text-2); }
    .text-muted { color: var(--text-3); }

    .domain-tag {
      font-size: 11px; font-weight: 500; padding: 2px 8px; border-radius: 5px;
      white-space: nowrap;
    }
    .grade-badge {
      display: inline-flex; align-items: center; gap: 4px;
      font-size: 11px; font-weight: 600; padding: 3px 8px; border-radius: 20px;
      white-space: nowrap;
    }
    .table-footer {
      padding: 8px 14px; border-top: 1px solid var(--border-light); background: var(--bg);
    }
    .tf-info { font-size: 12px; color: var(--text-3); }

    /* Domain tabs */
    .domain-tabs {
      display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 14px;
    }
    .domain-tab {
      display: flex; align-items: center; gap: 7px;
      background: var(--surface); border: 1px solid var(--border);
      border-radius: 8px; padding: 7px 14px; cursor: pointer;
      font-size: 12.5px; font-weight: 500; color: var(--text-2);
      transition: all .12s;
      &:hover  { border-color: var(--blue); color: var(--blue); }
      &.active { background: var(--blue); color: #fff; border-color: var(--blue); }
    }
    .dt-icon {
      width: 22px; height: 22px; border-radius: 5px;
      display: flex; align-items: center; justify-content: center;
      font-size: 13px; flex-shrink: 0;
      .domain-tab.active & { background: rgba(255,255,255,.2) !important; color: #fff !important; }
    }

    /* Milestones list */
    .milestones-list {
      background: var(--surface); border: 1px solid var(--border);
      border-radius: 10px; overflow: hidden;
    }
    .milestone-row {
      display: flex; align-items: flex-start; gap: 14px;
      padding: 12px 16px; border-bottom: 1px solid var(--border-light);
      &:last-child { border-bottom: none; }
      &:hover { background: #FAFAFA; }
    }
    .mr-code {
      font-family: 'SF Mono', monospace; font-size: 11px; font-weight: 600;
      color: var(--blue); background: var(--blue-light);
      padding: 2px 7px; border-radius: 4px; flex-shrink: 0; margin-top: 2px;
    }
    .mr-info { flex: 1; }
    .mr-name { font-size: 13px; font-weight: 500; color: var(--text); }
    .mr-desc { font-size: 11px; color: var(--text-3); margin-top: 2px; }
    .mr-age  {
      font-size: 11px; color: var(--text-3); white-space: nowrap;
      background: var(--bg); padding: 2px 7px; border-radius: 4px;
    }
    .empty-report { text-align: center; padding: 40px; color: var(--text-3); font-size: 13px; }

    .mr-actions { display: flex; gap: 4px; margin-left: auto; opacity: 0; transition: opacity .15s; }
    .milestone-row:hover .mr-actions { opacity: 1; }
    .mr-action-btn {
      background: none; border: none; cursor: pointer; width: 28px; height: 28px;
      border-radius: 5px; display: flex; align-items: center; justify-content: center; color: var(--text-3);
      &:hover { background: var(--bg); color: var(--text-2); }
      &.danger:hover { background: var(--red-light); color: var(--red); }
    }

    .milestone-row.editing { background: var(--blue-light); border-radius: 8px; align-items: flex-start; gap: 8px; }
    .milestone-row.new-row { background: #F0FDF4; }
    .me-input {
      height: 32px; padding: 0 8px; border: 1px solid var(--border);
      border-radius: 6px; font-size: 12.5px; color: var(--text); outline: none;
      font-family: inherit; background: #fff;
      &:focus { border-color: var(--blue); }
      &.code { width: 90px; flex-shrink: 0; font-family: monospace; }
      &.name { width: 100%; margin-bottom: 5px; }
      &.desc { width: 100%; margin-bottom: 5px; font-size: 12px; }
      &.sm   { width: 90px; }
    }
    .me-main { flex: 1; display: flex; flex-direction: column; }
    .me-row  { display: flex; gap: 6px; }
    .me-actions { display: flex; flex-direction: column; gap: 5px; flex-shrink: 0; padding-top: 2px; }
    .me-save-btn {
      width: 30px; height: 30px; border-radius: 6px; border: none;
      background: var(--green); color: #fff; cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      &:hover:not(:disabled) { background: #059669; }
      &:disabled { opacity: .6; }
    }
    .me-cancel-btn {
      width: 30px; height: 30px; border-radius: 6px; border: 1px solid var(--border);
      background: #fff; color: var(--text-3); cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      &:hover { background: var(--bg); }
    }
    .add-milestone-btn {
      display: flex; align-items: center; gap: 6px; width: 100%;
      background: none; border: 1px dashed #D1D5DB; border-radius: 8px;
      padding: 9px; font-size: 12.5px; color: var(--blue); cursor: pointer;
      justify-content: center; font-weight: 500; margin-top: 4px;
      &:hover:not(:disabled) { background: var(--blue-light); border-color: var(--blue-mid); }
      &:disabled { opacity: .5; cursor: not-allowed; }
    }
  `],
})
export class ObservationsComponent implements OnInit {
  private api    = inject(ApiService);
  private dialog = inject(MatDialog);
  private snack  = inject(MatSnackBar);

  classes          = signal<SchoolClass[]>([]);
  students         = signal<any[]>([]);
  domains          = signal<Domain[]>([]);
  milestones       = signal<Milestone[]>([]);
  observations     = signal<Observation[]>([]);
  obsLoading       = signal(false);

  selectedClass    = signal('');
  selectedStudentId = signal('');
  obsClass         = signal('');
  obsDomainId      = signal('');
  obsGrade         = signal('');
  activeDomainId   = signal('');

  gradeConfig = GRADE_CONFIG;

  activeDomainMilestones = computed(() =>
    this.milestones().filter(m => m.domain_id === this.activeDomainId())
      .sort((a, b) => a.sort_order - b.sort_order)
  );

  ngOnInit() {
    this.api.get<any>('/students/classes').subscribe({
      next: (res: any) => this.classes.set(res.data ?? []),
    });
    this.api.get<any>('/observations/domains').subscribe({
      next: (res: any) => {
        this.domains.set(res.data ?? []);
        if (res.data?.length) this.activeDomainId.set(res.data[0].id);
      },
    });
    this.api.get<any>('/observations/milestones').subscribe({
      next: (res: any) => this.milestones.set(res.data ?? []),
    });
    this.loadStudents('');
    this.loadObservations();
  }

  loadStudents(classId: string) {
    const params: Record<string, string> = { limit: '500', page: '1', is_active: 'true' };
    if (classId) params['class_id'] = classId;
    this.api.get<any>('/students', params).subscribe({
      next: (res: any) => this.students.set(res.data ?? []),
    });
  }

  onClassChange(classId: string) {
    this.selectedClass.set(classId);
    this.selectedStudentId.set('');
    this.loadStudents(classId);
  }

  loadObservations() {
    this.obsLoading.set(true);
    const params: Record<string, string> = { limit: '100' };
    if (this.obsClass())    params['class_id']   = this.obsClass();
    if (this.obsDomainId()) params['domain_id']  = this.obsDomainId();
    if (this.obsGrade())    params['grade']       = this.obsGrade();
    this.api.get<any>('/observations', params).subscribe({
      next: (res: any) => { this.observations.set(res.data ?? []); this.obsLoading.set(false); },
      error: () => this.obsLoading.set(false),
    });
  }

  openRecord(milestoneId?: string) {
    const ref = this.dialog.open(RecordObservationDialogComponent, {
      width: '540px', disableClose: true,
      data: {
        domains:     this.domains(),
        milestones:  this.milestones(),
        students:    this.students(),
        studentId:   this.selectedStudentId() || null,
        milestoneId: milestoneId || null,
      },
    });
    ref.afterClosed().subscribe((result: any) => {
      if (result) {
        this.snack.open('Observation recorded', 'OK', { duration: 3000 });
        this.loadObservations();
        // Trigger student progress refresh
        const id = this.selectedStudentId();
        if (id) { this.selectedStudentId.set(''); setTimeout(() => this.selectedStudentId.set(id), 50); }
      }
    });
  }

  studentProgress = signal<any[]>([]);

  onProgressLoaded(progress: any[]) {
    this.studentProgress.set(progress);
  }

  getStudentName(id: string): string {
    const s = this.students().find(s => s.id === id);
    return s ? s.first_name + ' ' + s.last_name : '';
  }

  exportCsv() {
    const progress = this.studentProgress();
    if (!progress.length) { this.snack.open('No data to export', 'OK', { duration: 2000 }); return; }

    const rows: string[][] = [
      ['Domain', 'Milestone Code', 'Milestone', 'Grade', 'Observed On', 'Notes']
    ];
    progress.forEach(domain => {
      domain.milestones.forEach((m: any) => {
        rows.push([
          domain.domain_name,
          m.milestone_code,
          m.milestone_name,
          m.grade ?? 'not_started',
          m.observed_on ? new Date(m.observed_on).toLocaleDateString('en-IN') : '—',
          m.notes ?? '',
        ]);
      });
    });

    const csv  = rows.map(r => r.map(v => '"' + v.replace(/"/g, '""') + '"').join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url;
    a.download = 'observations-' + this.getStudentName(this.selectedStudentId()).replace(/ /g, '-') + '.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  printReport() {
    const progress = this.studentProgress();
    const studentName = this.getStudentName(this.selectedStudentId());
    if (!progress.length) { this.snack.open('No data to print', 'OK', { duration: 2000 }); return; }

    const gradeIcon: Record<string, string> = {
      not_started: '⭕', in_progress: '🟡', led: '🔵', mastered: '🟢',
    };
    const gradeLabel: Record<string, string> = {
      not_started: 'Not Started', in_progress: 'In Progress', led: 'Led', mastered: 'Mastered',
    };
    const domainColor: Record<string, string> = {
      practical_life: '#F59E0B', language: '#3B82F6',
      mathematics: '#8B5CF6', cultural: '#10B981', social_emotional: '#EC4899',
    };

    let html = progress.map(domain => {
      const mastered   = domain.milestones.filter((m: any) => m.grade === 'mastered').length;
      const color      = domainColor[domain.domain_code] ?? '#6B7280';
      const milestoneRows = domain.milestones.map((m: any) => {
        const g = m.grade ?? 'not_started';
        return '<tr>' +
          '<td style="font-family:monospace;font-size:11px;color:#2563EB;background:#EFF6FF;padding:4px 8px;border-radius:4px;white-space:nowrap">' + m.milestone_code + '</td>' +
          '<td style="padding:6px 10px;font-size:12px">' + m.milestone_name + '</td>' +
          '<td style="padding:6px 10px;font-size:12px;white-space:nowrap">' + gradeIcon[g] + ' ' + gradeLabel[g] + '</td>' +
          '<td style="padding:6px 10px;font-size:11px;color:#6B7280">' + (m.observed_on ? new Date(m.observed_on).toLocaleDateString('en-IN') : '—') + '</td>' +
          '<td style="padding:6px 10px;font-size:11px;color:#6B7280;font-style:italic">' + (m.notes ?? '') + '</td>' +
          '</tr>';
      }).join('');

      return '<div style="margin-bottom:24px;border:1px solid #E5E7EB;border-radius:8px;overflow:hidden">' +
        '<div style="padding:12px 16px;background:' + color + '20;border-bottom:3px solid ' + color + ';display:flex;justify-content:space-between;align-items:center">' +
          '<span style="font-size:14px;font-weight:700;color:#111">' + domain.domain_name + '</span>' +
          '<span style="font-size:13px;color:' + color + ';font-weight:600">' + domain.percentage + '% mastered (' + mastered + '/' + domain.total + ')</span>' +
        '</div>' +
        '<table style="width:100%;border-collapse:collapse">' +
          '<thead><tr style="background:#F9FAFB">' +
            '<th style="text-align:left;padding:6px 10px;font-size:10px;text-transform:uppercase;letter-spacing:.4px;color:#9CA3AF">Code</th>' +
            '<th style="text-align:left;padding:6px 10px;font-size:10px;text-transform:uppercase;letter-spacing:.4px;color:#9CA3AF">Milestone</th>' +
            '<th style="text-align:left;padding:6px 10px;font-size:10px;text-transform:uppercase;letter-spacing:.4px;color:#9CA3AF">Grade</th>' +
            '<th style="text-align:left;padding:6px 10px;font-size:10px;text-transform:uppercase;letter-spacing:.4px;color:#9CA3AF">Date</th>' +
            '<th style="text-align:left;padding:6px 10px;font-size:10px;text-transform:uppercase;letter-spacing:.4px;color:#9CA3AF">Notes</th>' +
          '</tr></thead>' +
          '<tbody>' + milestoneRows + '</tbody>' +
        '</table></div>';
    }).join('');

    const win = window.open('', '_blank', 'width=900,height=1100');
    if (!win) return;
    win.document.write('<html><head><title>Observations — ' + studentName + '</title>' +
      '<style>*{box-sizing:border-box;margin:0;padding:0;font-family:-apple-system,sans-serif}' +
      'body{padding:32px;color:#111}' +
      'tr:nth-child(even){background:#F9FAFB}' +
      '@media print{@page{margin:20mm}}' +
      '</style></head><body>' +
      '<div style="margin-bottom:24px;padding-bottom:16px;border-bottom:2px solid #E5E7EB">' +
        '<h1 style="font-size:22px;margin-bottom:4px">Developmental Observations</h1>' +
        '<div style="font-size:14px;color:#6B7280">' + studentName + ' · Printed ' + new Date().toLocaleDateString('en-IN', { day:'numeric', month:'long', year:'numeric' }) + '</div>' +
      '</div>' +
      html +
      '<div style="margin-top:24px;font-size:11px;color:#9CA3AF;text-align:center">Generated by Montessori360</div>' +
      '</body></html>');
    win.document.close();
    setTimeout(() => { win.print(); win.close(); }, 400);
  }

  // Milestone CRUD state
  editingMilestoneId = signal('');
  addingMilestone    = signal(false);
  saving             = signal(false);
  editCode = ''; editName = ''; editDescription = ''; editAgeMin: number|null = null; editAgeMax: number|null = null;
  newCode  = ''; newName  = ''; newDescription  = ''; newAgeMin:  number|null = null; newAgeMax:  number|null = null;

  startEdit(m: Milestone) {
    this.editingMilestoneId.set(m.id);
    this.editCode = m.code; this.editName = m.name;
    this.editDescription = m.description ?? '';
    this.editAgeMin = m.age_min; this.editAgeMax = m.age_max;
  }

  cancelEdit() { this.editingMilestoneId.set(''); }

  startAdd() {
    this.addingMilestone.set(true);
    this.newCode = ''; this.newName = ''; this.newDescription = '';
    this.newAgeMin = null; this.newAgeMax = null;
  }

  saveMilestone(id: string) {
    if (!this.editName.trim()) return;
    this.saving.set(true);
    const payload: Record<string, unknown> = {
      code: this.editCode, name: this.editName,
      description: this.editDescription || null,
      age_min: this.editAgeMin || null, age_max: this.editAgeMax || null,
    };
    this.api.put<any>('/observations/milestones/' + id, payload).subscribe({
      next: (res: any) => {
        this.milestones.update(list => list.map(m => m.id === id ? { ...m, ...res.data } : m));
        this.editingMilestoneId.set('');
        this.saving.set(false);
        this.snack.open('Milestone updated', 'OK', { duration: 2000 });
      },
      error: (err: any) => { this.saving.set(false); this.snack.open(err.error?.error?.message ?? 'Error', 'OK', { duration: 3000 }); },
    });
  }

  addMilestone() {
    if (!this.newName.trim()) { this.snack.open('Name is required', 'OK', { duration: 2000 }); return; }
    this.saving.set(true);
    const payload: Record<string, unknown> = {
      domain_id: this.activeDomainId(), code: this.newCode, name: this.newName,
      description: this.newDescription || null,
      age_min: this.newAgeMin || null, age_max: this.newAgeMax || null,
    };
    this.api.post<any>('/observations/milestones', payload).subscribe({
      next: (res: any) => {
        this.milestones.update(list => [...list, res.data]);
        this.addingMilestone.set(false);
        this.saving.set(false);
        this.snack.open('Milestone added', 'OK', { duration: 2000 });
      },
      error: (err: any) => { this.saving.set(false); this.snack.open(err.error?.error?.message ?? 'Error', 'OK', { duration: 3000 }); },
    });
  }

  deleteMilestone(m: Milestone) {
    if (!confirm('Delete "' + m.name + '"? This cannot be undone if no observations reference it.')) return;
    this.api.delete<any>('/observations/milestones/' + m.id).subscribe({
      next: () => {
        this.milestones.update(list => list.filter(x => x.id !== m.id));
        this.snack.open('Milestone deleted', 'OK', { duration: 2000 });
      },
      error: (err: any) => this.snack.open(err.error?.error?.message ?? 'Error', 'OK', { duration: 3000 }),
    });
  }

  getAvatarColor(name: string): string {
    const colors = ['#2563EB','#7C3AED','#DB2777','#D97706','#059669','#0891B2'];
    return colors[(name?.charCodeAt(0) || 0) % colors.length];
  }

  getDomainColor(code: string): string {
    const map: Record<string, string> = {
      practical_life:  '#F59E0B',
      language:        '#3B82F6',
      mathematics:     '#8B5CF6',
      cultural:        '#10B981',
      social_emotional:'#EC4899',
    };
    return map[code] ?? '#6B7280';
  }

  getDomainEmoji(code: string): string {
    const map: Record<string, string> = {
      practical_life:   '🏠',
      language:         '📖',
      mathematics:      '🔢',
      cultural:         '🌍',
      social_emotional: '💛',
    };
    return map[code] ?? '📌';
  }
}
