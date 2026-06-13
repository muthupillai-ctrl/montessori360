import { Component, inject, signal, OnInit } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatMenuModule } from '@angular/material/menu';
import { MatDialog } from '@angular/material/dialog';
import { MatDialogModule } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { DatePipe, TitleCasePipe } from '@angular/common';
import { ApiService } from '../../core/services/api.service';
import { CheckInDialogComponent } from './check-in-dialog.component';
import { MarkAllDialogComponent } from './mark-all-dialog.component';
import type { DailySummary, AttendanceRecord, SchoolClass, ApiResponse } from '../../core/models';

@Component({
  selector: 'app-attendance',
  standalone: true,
  imports: [
    MatIconModule, MatProgressSpinnerModule,
    MatMenuModule, MatDialogModule, DatePipe, TitleCasePipe,
  ],
  template: `
    <!-- Page header -->
    <div class="page-header">
      <div>
        <h1>Attendance</h1>
        <div class="subtitle">
          {{ selectedDate() | date:'EEEE, d MMMM yyyy' }}
          @if (summary()) {
            · {{ summary()!.present + summary()!.late }} / {{ summary()!.total }} present
          }
        </div>
      </div>
      <div class="actions">
        <button class="btn-outline-custom" (click)="markAllPresent()" [disabled]="marking()">
          <mat-icon style="font-size:16px;width:16px;height:16px">done_all</mat-icon>
          Mark All Present
        </button>
        <button class="btn-primary-custom" (click)="openCheckIn()">
          <mat-icon style="font-size:16px;width:16px;height:16px">how_to_reg</mat-icon>
          Check In
        </button>
      </div>
    </div>

    <!-- Filter bar -->
    <div class="filter-bar">
      <div class="date-nav">
        <button class="nav-btn" (click)="changeDate(-1)">
          <mat-icon style="font-size:18px;width:18px;height:18px">chevron_left</mat-icon>
        </button>
        <input class="date-input" type="date"
               [value]="selectedDateStr()"
               (change)="onDateChange($any($event.target).value)" />
        <button class="nav-btn" (click)="changeDate(1)" [disabled]="isTodaySelected()">
          <mat-icon style="font-size:18px;width:18px;height:18px">chevron_right</mat-icon>
        </button>
        @if (!isTodaySelected()) {
          <button class="today-btn" (click)="goToToday()">Today</button>
        }
      </div>

      <div class="filter-selects">
        <select class="filter-select" [value]="selectedClass()"
                (change)="onClassChange($any($event.target).value)">
          <option value="">All Classes</option>
          @for (cls of classes(); track cls.id) {
            <option [value]="cls.id">{{ cls.name }}</option>
          }
        </select>

        <select class="filter-select" [value]="statusFilter()"
                (change)="onStatusFilter($any($event.target).value)">
          <option value="">All Status</option>
          <option value="present">Present</option>
          <option value="absent">Absent</option>
          <option value="late">Late</option>
          <option value="not_marked">Not Marked</option>
        </select>
      </div>

      <button class="icon-btn" (click)="loadSummary()" title="Refresh">
        <mat-icon style="font-size:18px;width:18px;height:18px">refresh</mat-icon>
      </button>
    </div>

    @if (loading()) {
      <div class="loading-state">
        <mat-progress-spinner mode="indeterminate" diameter="32" />
        <span>Loading attendance…</span>
      </div>
    }

    @if (!loading() && summary(); as s) {

      <!-- Stat cards -->
      <div class="stats-row">
        <div class="stat-card">
          <div class="sc-icon blue"><mat-icon style="font-size:16px;width:16px;height:16px">people</mat-icon></div>
          <div class="sc-body">
            <div class="sc-value">{{ s.total }}</div>
            <div class="sc-label">Total</div>
          </div>
        </div>
        <div class="stat-card">
          <div class="sc-icon green"><mat-icon style="font-size:16px;width:16px;height:16px">check_circle</mat-icon></div>
          <div class="sc-body">
            <div class="sc-value" style="color:var(--green)">{{ s.present }}</div>
            <div class="sc-label">Present</div>
          </div>
        </div>
        <div class="stat-card">
          <div class="sc-icon red"><mat-icon style="font-size:16px;width:16px;height:16px">cancel</mat-icon></div>
          <div class="sc-body">
            <div class="sc-value" style="color:var(--red)">{{ s.absent }}</div>
            <div class="sc-label">Absent</div>
          </div>
        </div>
        <div class="stat-card">
          <div class="sc-icon amber"><mat-icon style="font-size:16px;width:16px;height:16px">schedule</mat-icon></div>
          <div class="sc-body">
            <div class="sc-value" style="color:var(--amber)">{{ s.late }}</div>
            <div class="sc-label">Late</div>
          </div>
        </div>
        <div class="stat-card">
          <div class="sc-icon grey"><mat-icon style="font-size:16px;width:16px;height:16px">help_outline</mat-icon></div>
          <div class="sc-body">
            <div class="sc-value" style="color:var(--text-3)">{{ s.not_marked }}</div>
            <div class="sc-label">Not Marked</div>
          </div>
        </div>

        <!-- Rate card -->
        <div class="rate-card">
          <div class="rate-header">
            <span class="rate-label">Attendance Rate</span>
            <span class="rate-value" [style.color]="getRate(s) >= 85 ? 'var(--green)' : 'var(--amber)'">
              {{ getRate(s) }}%
            </span>
          </div>
          <div class="rate-track">
            <div class="rate-fill"
                 [style.width.%]="getRate(s)"
                 [style.background]="getRate(s) >= 85 ? 'var(--green)' : 'var(--amber)'"></div>
          </div>
          <div class="rate-sub">{{ s.present + s.late }} of {{ s.total }} students</div>
        </div>
      </div>

      <!-- Records table -->
      <div class="table-container">
        @if (!filteredRecords().length) {
          <div class="table-empty">
            <div class="empty-icon">📋</div>
            <div class="empty-title">No records found</div>
            <div class="empty-sub">
              @if (statusFilter()) {
                No students with status "{{ statusFilter() | titlecase }}" for this date.
              } @else {
                No attendance records for {{ selectedDate() | date:'d MMMM yyyy' }}.
              }
            </div>
          </div>
        } @else {
          <table class="data-table">
            <thead>
              <tr>
                <th>Student</th>
                <th>Class</th>
                <th>Status</th>
                <th>Check In</th>
                <th>Check Out</th>
                <th>Mode</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              @for (r of filteredRecords(); track r.id) {
                <tr class="data-row">
                  <td>
                    <div class="student-cell">
                      <div class="student-av" [style.background]="getAvatarColor(r.student_name ?? '')">
                        {{ (r.student_name ?? '?')[0] }}
                      </div>
                      <div>
                        <div class="cell-primary">{{ r.student_name }}</div>
                        <div class="cell-secondary">{{ r.admission_no }}</div>
                      </div>
                    </div>
                  </td>
                  <td class="text-sm">{{ r.class_name ?? '—' }}</td>
                  <td>
                    <span [class]="'badge badge-' + r.status">
                      {{ r.status === 'not_marked' ? 'Not Marked' : (r.status | titlecase) }}
                    </span>
                  </td>
                  <td class="text-sm">
                    {{ r.check_in_time ? (r.check_in_time | date:'h:mm a') : '—' }}
                  </td>
                  <td class="text-sm">
                    {{ r.check_out_time ? (r.check_out_time | date:'h:mm a') : '—' }}
                  </td>
                  <td class="text-sm">
                    @if (r.mode) {
                      <span class="mode-chip">{{ r.mode | titlecase }}</span>
                    } @else { — }
                  </td>
                  <td class="text-sm text-muted">{{ r.notes || '—' }}</td>
                </tr>
              }
            </tbody>
          </table>

          <div class="table-footer">
            <div class="tf-info">
              Showing {{ filteredRecords().length }} of {{ s.records.length }} records
            </div>
          </div>
        }
      </div>
    }
  `,
  styles: [`
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
      &:hover:not(:disabled) { background: var(--bg); }
      &:disabled { opacity: .6; cursor: not-allowed; }
    }

    /* Filter bar */
    .filter-bar {
      display: flex; gap: 10px; align-items: center;
      margin-bottom: 16px; flex-wrap: wrap;
    }
    .date-nav {
      display: flex; align-items: center; gap: 4px;
      background: var(--surface); border: 1px solid var(--border);
      border-radius: 8px; padding: 2px 4px; height: 36px;
    }
    .nav-btn {
      background: none; border: none; cursor: pointer; color: var(--text-3);
      width: 28px; height: 28px; border-radius: 5px;
      display: flex; align-items: center; justify-content: center;
      &:hover { background: var(--bg); color: var(--text-2); }
      &:disabled { opacity: .4; cursor: not-allowed; }
    }
    .date-input {
      border: none; outline: none; font-size: 13px; color: var(--text);
      background: transparent; font-family: inherit; cursor: pointer;
    }
    .today-btn {
      background: var(--blue-light); color: var(--blue); border: none;
      border-radius: 5px; padding: 2px 8px; font-size: 11px; font-weight: 600;
      cursor: pointer; white-space: nowrap;
      &:hover { background: var(--blue-mid); }
    }
    .filter-selects { display: flex; gap: 8px; }
    .filter-select {
      height: 36px; padding: 0 10px;
      background: var(--surface); border: 1px solid var(--border);
      border-radius: 8px; font-size: 13px; color: var(--text-2);
      outline: none; cursor: pointer;
      &:focus { border-color: var(--blue); }
    }
    .icon-btn {
      width: 36px; height: 36px; border-radius: 8px;
      background: var(--surface); border: 1px solid var(--border);
      display: flex; align-items: center; justify-content: center;
      cursor: pointer; color: var(--text-3);
      &:hover { background: var(--bg); color: var(--text-2); }
    }

    /* Loading */
    .loading-state {
      display: flex; align-items: center; gap: 12px;
      justify-content: center; padding: 80px;
      color: var(--text-3); font-size: 13px;
    }

    /* Stats row */
    .stats-row {
      display: flex; gap: 10px; margin-bottom: 14px; flex-wrap: wrap;
    }
    .stat-card {
      display: flex; align-items: center; gap: 10px;
      background: var(--surface); border: 1px solid var(--border);
      border-radius: 9px; padding: 12px 16px; min-width: 100px;
    }
    .sc-icon {
      width: 32px; height: 32px; border-radius: 8px;
      display: flex; align-items: center; justify-content: center; flex-shrink: 0;
      &.blue  { background: var(--blue-light);   color: var(--blue); }
      &.green { background: var(--green-light);  color: var(--green); }
      &.red   { background: var(--red-light);    color: var(--red); }
      &.amber { background: var(--amber-light);  color: var(--amber); }
      &.grey  { background: var(--bg);           color: var(--text-3); }
    }
    .sc-value { font-size: 20px; font-weight: 700; color: var(--text); line-height: 1; }
    .sc-label { font-size: 11px; color: var(--text-3); margin-top: 2px; }

    /* Rate card */
    .rate-card {
      flex: 1; min-width: 180px;
      background: var(--surface); border: 1px solid var(--border);
      border-radius: 9px; padding: 12px 16px;
    }
    .rate-header { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 8px; }
    .rate-label  { font-size: 12px; color: var(--text-3); font-weight: 500; }
    .rate-value  { font-size: 18px; font-weight: 700; }
    .rate-track  { height: 6px; background: var(--border); border-radius: 3px; overflow: hidden; margin-bottom: 5px; }
    .rate-fill   { height: 100%; border-radius: 3px; transition: width .4s; }
    .rate-sub    { font-size: 11px; color: var(--text-4); }

    /* Table */
    .table-container {
      background: var(--surface); border: 1px solid var(--border);
      border-radius: 10px; overflow: hidden;
    }
    .table-empty {
      display: flex; flex-direction: column; align-items: center;
      justify-content: center; gap: 8px; padding: 60px;
      color: var(--text-3); font-size: 13px;
    }
    .empty-icon  { font-size: 36px; line-height: 1; }
    .empty-title { font-size: 15px; font-weight: 600; color: var(--text-2); }
    .empty-sub   { font-size: 13px; color: var(--text-3); text-align: center; }

    .data-table {
      width: 100%; border-collapse: collapse;
      th {
        text-align: left; padding: 11px 14px;
        font-size: 10px; font-weight: 600;
        text-transform: uppercase; letter-spacing: .4px;
        color: var(--text-4); background: var(--bg);
        border-bottom: 1px solid var(--border);
      }
      td { padding: 10px 14px; border-bottom: 1px solid var(--border-light); vertical-align: middle; }
    }
    .data-row {
      transition: background .1s;
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
    .cell-secondary { font-size: 11px; color: var(--text-3); margin-top: 1px; }
    .text-sm   { font-size: 12.5px; color: var(--text-2); }
    .text-muted { color: var(--text-3); }

    .mode-chip {
      background: var(--bg); color: var(--text-3);
      font-size: 11px; padding: 2px 7px; border-radius: 4px;
    }

    .table-footer {
      display: flex; align-items: center; justify-content: space-between;
      padding: 8px 14px; border-top: 1px solid var(--border-light); background: var(--bg);
    }
    .tf-info { font-size: 12px; color: var(--text-3); }
  `],
})
export class AttendanceComponent implements OnInit {
  private api    = inject(ApiService);
  private snack  = inject(MatSnackBar);
  private dialog = inject(MatDialog);

  loading       = signal(true);
  marking       = signal(false);
  summary       = signal<DailySummary | null>(null);
  classes       = signal<SchoolClass[]>([]);
  selectedDate  = signal(new Date());
  selectedClass = signal('');
  statusFilter  = signal('');

  filteredRecords = () => {
    const records = this.summary()?.records ?? [];
    const f = this.statusFilter();
    if (!f) return records;
    return records.filter(r => r.status === f);
  };

  selectedDateStr = () => this.selectedDate().toISOString().slice(0, 10);
  isTodaySelected = () => this.selectedDateStr() === new Date().toISOString().slice(0, 10);

  ngOnInit() { this.loadClasses(); this.loadSummary(); }

  loadClasses() {
    this.api.get<ApiResponse<SchoolClass[]>>('/students/classes').subscribe({
      next: (res: any) => this.classes.set(res.data ?? []),
    });
  }

  loadSummary() {
    this.loading.set(true);
    const params: Record<string, unknown> = { date: this.selectedDateStr() };
    if (this.selectedClass()) params['class_id'] = this.selectedClass();

    this.api.get<{ data: DailySummary }>('/attendance/daily-summary', params).subscribe({
      next: (res: any) => { this.summary.set(res.data); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  onDateChange(val: string) {
    this.selectedDate.set(new Date(val + 'T00:00:00'));
    this.loadSummary();
  }

  changeDate(days: number) {
    const d = new Date(this.selectedDate());
    d.setDate(d.getDate() + days);
    this.selectedDate.set(d);
    this.loadSummary();
  }

  goToToday() { this.selectedDate.set(new Date()); this.loadSummary(); }

  onClassChange(val: string)  { this.selectedClass.set(val);  this.loadSummary(); }
  onStatusFilter(val: string) { this.statusFilter.set(val); }

  getRate(s: DailySummary): number {
    if (!s.total) return 0;
    return Math.round((s.present + s.late) * 100 / s.total);
  }

  getAvatarColor(name: string): string {
    const colors = ['#2563EB','#7C3AED','#DB2777','#D97706','#059669','#0891B2'];
    return colors[(name.charCodeAt(0) || 0) % colors.length];
  }

  openCheckIn() {
    const ref = this.dialog.open(CheckInDialogComponent, {
      width: '500px', disableClose: true,
    });
    ref.afterClosed().subscribe((result: any) => {
      if (result) {
        this.snack.open('Attendance recorded successfully', 'OK', { duration: 3000 });
        this.loadSummary();
      }
    });
  }
  markAllPresent() {
    const ref = this.dialog.open(MarkAllDialogComponent, {
      width: '480px', disableClose: true,
      data: { date: this.selectedDateStr(), classes: this.classes() },
    });
    ref.afterClosed().subscribe((result: any) => {
      if (result) {
        this.snack.open(result.count + ' students marked present', 'OK', { duration: 3000 });
        this.loadSummary();
      }
    });
  }
}
