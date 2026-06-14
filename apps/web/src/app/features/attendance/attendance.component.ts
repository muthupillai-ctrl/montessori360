import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/services/api.service';
import { AuthService } from '../../core/services/auth.service';

interface RosterStudent {
  id: string;
  admission_no: string;
  first_name: string;
  last_name: string;
  class_id: string | null;
  class_name: string | null;
  attendance_id: string | null;
  status: 'present' | 'absent' | 'late' | 'half_day' | 'not_marked';
  notes: string | null;
}

interface SchoolClass { id: string; name: string; enrolled_count: number; capacity: number; }

const STATUS_CONFIG = {
  present:    { label: 'P', fullLabel: 'Present',    color: '#065F46', bg: '#DCFCE7', active: '#10B981' },
  absent:     { label: 'A', fullLabel: 'Absent',     color: '#991B1B', bg: '#FEE2E2', active: '#EF4444' },
  late:       { label: 'L', fullLabel: 'Late',       color: '#92400E', bg: '#FEF3C7', active: '#F59E0B' },
  half_day:   { label: 'H', fullLabel: 'Half Day',   color: '#1E40AF', bg: '#DBEAFE', active: '#3B82F6' },
  not_marked: { label: '—', fullLabel: 'Not Marked', color: '#9CA3AF', bg: '#F3F4F6', active: '#9CA3AF' },
};

@Component({
  selector: 'app-attendance',
  standalone: true,
  imports: [ MatIconModule, MatProgressSpinnerModule, DatePipe, FormsModule ],
  template: `
    <div class="att-page">

      <!-- Header -->
      <div class="page-header">
        <div>
          <h1>Attendance</h1>
          <div class="subtitle">{{ selectedDate() | date:'EEEE, d MMMM yyyy' }}</div>
        </div>
        <div class="header-actions">
          <!-- Date navigator -->
          <div class="date-nav">
            <button class="nav-btn" (click)="changeDate(-1)">
              <mat-icon style="font-size:17px;width:17px;height:17px">chevron_left</mat-icon>
            </button>
            <input type="date" class="date-input" [value]="selectedDate()"
                   (change)="onDateChange($event)">
            <button class="nav-btn" (click)="changeDate(1)" [disabled]="isToday()">
              <mat-icon style="font-size:17px;width:17px;height:17px">chevron_right</mat-icon>
            </button>
          </div>
          @if (isAdmin()) {
            <button class="btn-outline" (click)="markAllPresent()" [disabled]="marking()">
              <mat-icon style="font-size:15px;width:15px;height:15px">done_all</mat-icon>
              Mark All Present
            </button>
          }
        </div>
      </div>

      <!-- Class selector dropdown -->
      <div class="class-selector-row">
        <div class="class-select-wrap">
          <mat-icon class="cs-icon">class</mat-icon>
          <select class="class-select" [value]="selectedClass() ?? ''"
                  (change)="onClassChange($event)">
            @if (isAdmin()) {
              <option value="">All Classes</option>
            }
            @for (cls of classes(); track cls.id) {
              <option [value]="cls.id">
                {{ cls.name }} — {{ cls.enrolled_count }} students
              </option>
            }
          </select>
        </div>
        @if (selectedClass()) {
          <div class="selected-class-info">
            <span class="sci-name">{{ getClassName(selectedClass()!) }}</span>
            <span class="sci-count">{{ roster().length }} students</span>
          </div>
        }
      </div>

      <!-- Summary strip -->
      @if (roster().length) {
        <div class="summary-strip">
          <div class="summary-progress">
            <div class="progress-bar">
              <div class="progress-fill" [style.width.%]="markedPct()"></div>
            </div>
            <span class="progress-label">{{ markedCount() }}/{{ roster().length }} marked</span>
          </div>
          <div class="summary-chips">
            <span class="schip green">✓ {{ countByStatus('present') }} Present</span>
            <span class="schip red">✗ {{ countByStatus('absent') }} Absent</span>
            <span class="schip amber">⏱ {{ countByStatus('late') }} Late</span>
            <span class="schip grey">— {{ countByStatus('not_marked') }} Unmarked</span>
          </div>
          @if (isAdmin()) {
            <button class="btn-outline" (click)="markAllPresent()" [disabled]="marking()">
              <mat-icon style="font-size:14px;width:14px;height:14px">done_all</mat-icon>
              Mark All Present
            </button>
          }
        </div>
      }

      <!-- Roster list -->
      @if (loading()) {
        <div class="loading-state">
          <mat-progress-spinner diameter="28" mode="indeterminate"/>
          <span>Loading students…</span>
        </div>
      } @else if (!roster().length) {
        <div class="empty-state">
          <mat-icon style="font-size:36px;width:36px;height:36px;color:var(--text-4)">groups</mat-icon>
          <div>No students found for this class and date.</div>
        </div>
      } @else {
        <!-- Search -->
        <div class="search-row">
          <div class="search-wrap">
            <mat-icon class="search-icon">search</mat-icon>
            <input class="search-input" [(ngModel)]="searchTerm" placeholder="Search by name or admission no…">
            @if (searchTerm) {
              <button class="clear-btn" (click)="searchTerm = ''">
                <mat-icon style="font-size:15px;width:15px;height:15px">close</mat-icon>
              </button>
            }
          </div>
          <div class="filter-tabs">
            <button class="ftab" [class.active]="statusFilter === ''"
                    (click)="statusFilter = ''">All</button>
            <button class="ftab" [class.active]="statusFilter === 'not_marked'"
                    (click)="statusFilter = 'not_marked'">Unmarked</button>
            <button class="ftab" [class.active]="statusFilter === 'present'"
                    (click)="statusFilter = 'present'">Present</button>
            <button class="ftab" [class.active]="statusFilter === 'absent'"
                    (click)="statusFilter = 'absent'">Absent</button>
            <button class="ftab" [class.active]="statusFilter === 'late'"
                    (click)="statusFilter = 'late'">Late</button>
          </div>
        </div>

        <div class="roster-container">
          <table class="roster-table">
            <thead>
              <tr>
                <th class="th-no">#</th>
                <th>Student</th>
                @if (!selectedClass() && isAdmin()) { <th>Class</th> }
                <th class="th-status">Status</th>
              </tr>
            </thead>
            <tbody>
              @for (s of filteredRoster(); track s.id; let i = $index) {
                <tr class="roster-row" [class]="'row-' + s.status">
                  <td class="td-no">{{ i + 1 }}</td>
                  <td class="td-student">
                    <div class="student-av" [style.background]="getColor(s.first_name)">
                      {{ s.first_name[0] }}{{ s.last_name[0] }}
                    </div>
                    <div class="student-info">
                      <div class="student-name">{{ s.first_name }} {{ s.last_name }}</div>
                      <div class="student-meta">{{ s.admission_no }}</div>
                    </div>
                  </td>
                  @if (!selectedClass() && isAdmin()) {
                    <td class="td-class">{{ s.class_name ?? '—' }}</td>
                  }
                  <td class="td-status">
                    <div class="seg-pill">
                      @for (st of markableStatuses; track st.key) {
                        <button class="seg-btn"
                                [class.active]="s.status === st.key"
                                [style.background]="s.status === st.key ? st.activeColor : ''"
                                [style.color]="s.status === st.key ? '#fff' : ''"
                                [disabled]="savingId() === s.id"
                                (click)="mark(s, st.key)"
                                [title]="st.fullLabel">
                          {{ st.label }}
                        </button>
                      }
                    </div>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }

    </div>
  `,
  styles: [`
    .att-page { display: flex; flex-direction: column; gap: 12px; }

    /* Header */
    .page-header { display: flex; align-items: flex-start; justify-content: space-between; }
    .header-actions { display: flex; align-items: center; gap: 8px; }
    .date-nav { display: flex; align-items: center; gap: 4px; }
    .nav-btn {
      width: 30px; height: 30px; border-radius: 7px;
      background: var(--surface); border: 1px solid var(--border);
      display: flex; align-items: center; justify-content: center;
      cursor: pointer; color: var(--text-2);
      &:hover:not(:disabled) { background: var(--bg); }
      &:disabled { opacity: .4; cursor: not-allowed; }
    }
    .date-input {
      height: 30px; padding: 0 10px; background: var(--surface);
      border: 1px solid var(--border); border-radius: 7px;
      font-size: 12.5px; color: var(--text); outline: none; cursor: pointer;
      &:focus { border-color: var(--blue); }
    }
    .btn-outline {
      display: inline-flex; align-items: center; gap: 5px;
      height: 30px; padding: 0 12px; border-radius: 7px;
      background: var(--surface); border: 1px solid var(--border);
      font-size: 12px; color: var(--text-2); cursor: pointer;
      &:hover:not(:disabled) { background: var(--bg); }
      &:disabled { opacity: .5; cursor: not-allowed; }
    }

    /* Class selector */
    .class-selector-row { display: flex; align-items: center; gap: 12px; }
    .class-select-wrap {
      display: flex; align-items: center; gap: 8px;
      background: var(--surface); border: 1px solid var(--border);
      border-radius: 8px; padding: 0 12px; height: 36px; min-width: 260px;
      &:focus-within { border-color: var(--blue); }
    }
    .cs-icon { font-size: 16px; width: 16px; height: 16px; color: var(--text-3); flex-shrink: 0; }
    .class-select {
      flex: 1; border: none; background: none; outline: none;
      font-size: 13px; font-weight: 500; color: var(--text); cursor: pointer;
      font-family: inherit;
    }
    .selected-class-info { display: flex; align-items: center; gap: 8px; }
    .sci-name  { font-size: 13px; font-weight: 600; color: var(--text); }
    .sci-count { font-size: 12px; color: var(--text-3); padding: 2px 8px; background: var(--bg); border-radius: 10px; }

    /* Summary strip */
    .summary-strip { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
    .summary-progress { display: flex; align-items: center; gap: 8px; flex: 1; min-width: 200px; }
    .progress-bar { flex: 1; height: 6px; background: var(--border); border-radius: 3px; overflow: hidden; }
    .progress-fill { height: 100%; background: var(--green); border-radius: 3px; transition: width .3s; }
    .progress-label { font-size: 12px; font-weight: 600; color: var(--green); white-space: nowrap; }
    .summary-chips { display: flex; gap: 5px; flex-wrap: wrap; }
    .schip { font-size: 11px; font-weight: 600; padding: 3px 10px; border-radius: 20px; white-space: nowrap; }
    .schip.green { background: var(--green-light); color: #065F46; }
    .schip.red   { background: var(--red-light);   color: #991B1B; }
    .schip.amber { background: var(--amber-light);  color: #92400E; }
    .schip.grey  { background: var(--bg);           color: var(--text-3); }

    /* Search & filter */
    .search-row { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
    .search-wrap {
      display: flex; align-items: center; gap: 6px; flex: 1; min-width: 200px;
      background: var(--surface); border: 1px solid var(--border);
      border-radius: 8px; padding: 0 10px; height: 34px;
      &:focus-within { border-color: var(--blue); }
    }
    .search-icon { font-size: 16px; width: 16px; height: 16px; color: var(--text-4); flex-shrink: 0; }
    .search-input { flex: 1; border: none; background: none; outline: none; font-size: 13px; color: var(--text); }
    .clear-btn { background: none; border: none; cursor: pointer; color: var(--text-3); display: flex; align-items: center; }
    .filter-tabs { display: flex; gap: 3px; }
    .ftab {
      padding: 4px 12px; border-radius: 6px; border: none;
      background: var(--bg); font-size: 11.5px; color: var(--text-3); cursor: pointer;
      &:hover { background: var(--border-light); }
      &.active { background: var(--blue); color: #fff; font-weight: 500; }
    }

    /* Roster table */
    .roster-container {
      background: var(--surface); border: 1px solid var(--border);
      border-radius: 10px; overflow: hidden;
    }
    .roster-table { width: 100%; border-collapse: collapse; }
    .roster-table thead th {
      padding: 9px 14px; text-align: left;
      font-size: 10px; font-weight: 600; text-transform: uppercase;
      letter-spacing: .4px; color: var(--text-4);
      background: var(--bg); border-bottom: 1px solid var(--border);
      position: sticky; top: 0; z-index: 1;
    }
    .th-no     { width: 40px; }
    .th-status { width: 140px; text-align: center; }

    .roster-row {
      border-bottom: 1px solid var(--border-light);
      &:last-child { border-bottom: none; }
      &:hover { background: var(--bg); }
      &.row-present { background: #F0FDF4; &:hover { background: #DCFCE7; } }
      &.row-absent  { background: #FEF2F2; &:hover { background: #FEE2E2; } }
      &.row-late    { background: #FFFBEB; &:hover { background: #FEF3C7; } }
    }
    .td-no { padding: 8px 14px; font-size: 11px; color: var(--text-4); width: 40px; }
    .td-student { padding: 7px 14px; display: flex; align-items: center; gap: 10px; }
    .td-class { padding: 8px 14px; font-size: 12px; color: var(--text-3); }
    .td-status { padding: 7px 14px; text-align: center; }

    .student-av {
      width: 30px; height: 30px; border-radius: 7px;
      color: #fff; font-size: 10px; font-weight: 700;
      display: flex; align-items: center; justify-content: center; flex-shrink: 0;
    }
    .student-name { font-size: 13px; font-weight: 500; color: var(--text); }
    .student-meta { font-size: 10.5px; color: var(--text-3); }

    /* Segmented pill — THE KEY DESIGN */
    .seg-pill {
      display: inline-flex; border: 1.5px solid var(--border);
      border-radius: 7px; overflow: hidden;
    }
    .seg-btn {
      height: 26px; padding: 0 12px; border: none; border-right: 1px solid var(--border);
      background: var(--bg); font-size: 11px; font-weight: 700;
      cursor: pointer; color: var(--text-3); transition: all .1s;
      &:last-child { border-right: none; }
      &:hover:not(:disabled):not(.active) { background: var(--border-light); color: var(--text-2); }
      &.active { font-weight: 700; }
      &:disabled { opacity: .5; cursor: not-allowed; }
    }

    /* States */
    .loading-state { display: flex; align-items: center; gap: 12px; justify-content: center; padding: 60px; color: var(--text-3); font-size: 13px; }
    .empty-state { display: flex; flex-direction: column; align-items: center; gap: 10px; padding: 60px; color: var(--text-3); font-size: 13px; }
  `],
})
export class AttendanceComponent implements OnInit {
  private api   = inject(ApiService);
  private snack = inject(MatSnackBar);
  private auth  = inject(AuthService);

  roster        = signal<RosterStudent[]>([]);
  classes       = signal<SchoolClass[]>([]);
  loading       = signal(true);
  marking       = signal(false);
  savingId      = signal<string | null>(null);
  selectedClass = signal<string | null>(null);
  selectedDate  = signal(new Date().toISOString().slice(0, 10));
  searchTerm    = '';
  statusFilter  = '';

  isAdmin = () => ['owner', 'principal', 'accountant', 'admission_staff'].includes(this.auth.user()?.role ?? '');
  isToday = () => this.selectedDate() === new Date().toISOString().slice(0, 10);

  markableStatuses = [
    { key: 'present',  label: 'P', fullLabel: 'Present',  activeColor: '#10B981' },
    { key: 'absent',   label: 'A', fullLabel: 'Absent',   activeColor: '#EF4444' },
    { key: 'late',     label: 'L', fullLabel: 'Late',     activeColor: '#F59E0B' },
    { key: 'half_day', label: 'H', fullLabel: 'Half Day', activeColor: '#3B82F6' },
  ];

  markedCount = computed(() => this.roster().filter(s => s.status !== 'not_marked').length);
  markedPct   = computed(() => this.roster().length ? Math.round(this.markedCount() / this.roster().length * 100) : 0);

  countByStatus(status: string) {
    return this.roster().filter(s => s.status === status).length;
  }

  filteredRoster = computed(() => {
    let list = this.roster();
    if (this.statusFilter) list = list.filter(s => s.status === this.statusFilter);
    if (this.searchTerm) {
      const q = this.searchTerm.toLowerCase();
      list = list.filter(s =>
        (s.first_name + ' ' + s.last_name).toLowerCase().includes(q) ||
        s.admission_no.toLowerCase().includes(q)
      );
    }
    return list;
  });

  ngOnInit() {
    this.loadClasses();
  }

  loadClasses() {
    this.api.get<any>('/students/classes').subscribe({
      next: (res: any) => {
        this.classes.set(res.data ?? []);
        // Auto-select teacher's class
        if (!this.isAdmin() && res.data?.length) {
          this.selectedClass.set(res.data[0].id);
        }
        this.loadRoster();
      },
      error: () => this.loadRoster(),
    });
  }

  loadRoster() {
    this.loading.set(true);
    const params: Record<string, string> = { date: this.selectedDate() };
    if (this.selectedClass()) params['class_id'] = this.selectedClass()!;
    this.api.get<any>('/attendance/roster', params).subscribe({
      next: (res: any) => { this.roster.set(res.data ?? []); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  onClassChange(e: Event) {
    const val = (e.target as HTMLSelectElement).value;
    this.selectClass(val || null);
  }

  selectClass(id: string | null) {
    this.selectedClass.set(id);
    this.loadRoster();
  }

  onDateChange(e: Event) {
    this.selectedDate.set((e.target as HTMLInputElement).value);
    this.loadRoster();
  }

  changeDate(dir: number) {
    const d = new Date(this.selectedDate());
    d.setDate(d.getDate() + dir);
    this.selectedDate.set(d.toISOString().slice(0, 10));
    this.loadRoster();
  }

  mark(student: RosterStudent, status: string) {
    if (this.savingId()) return;
    // Optimistic update
    const prev = student.status;
    student.status = status as any;
    this.savingId.set(student.id);

    this.api.post<any>('/attendance/quick-mark', {
      student_id: student.id,
      date: this.selectedDate(),
      status,
    }).subscribe({
      next: () => this.savingId.set(null),
      error: () => {
        student.status = prev; // rollback
        this.savingId.set(null);
        this.snack.open('Failed to mark attendance', 'OK', { duration: 2500 });
      },
    });
  }

  markAllPresent() {
    if (this.marking()) return;
    this.marking.set(true);
    const params: Record<string, string> = { date: this.selectedDate() };
    if (this.selectedClass()) params['class_id'] = this.selectedClass()!;

    this.api.post<any>('/attendance/bulk-mark', {
      class_id: this.selectedClass() ?? undefined,
      date: this.selectedDate(),
      status: 'present',
    }).subscribe({
      next: (res: any) => {
        this.marking.set(false);
        this.snack.open((res.data?.count ?? res.count ?? '') + ' students marked present', 'OK', { duration: 3000 });
        this.loadRoster();
      },
      error: () => { this.marking.set(false); this.snack.open('Error', 'OK', { duration: 2500 }); },
    });
  }

  getClassName(id: string): string {
    return this.classes().find(c => c.id === id)?.name ?? '';
  }

  getColor(name: string): string {
    const colors = ['#2563EB','#7C3AED','#DB2777','#D97706','#059669','#0891B2'];
    return colors[(name?.charCodeAt(0) || 0) % colors.length];
  }
}
