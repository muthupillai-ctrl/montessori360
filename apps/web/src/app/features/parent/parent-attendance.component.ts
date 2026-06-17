import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ApiService } from '../../core/services/api.service';
import { ParentStateService } from './parent-state.service';

function localYearMonth(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

@Component({
  selector: 'app-parent-attendance',
  standalone: true,
  imports: [MatIconModule, MatProgressSpinnerModule],
  template: `
    <div class="page">

      <div class="month-nav">
        <button class="nav-btn" (click)="changeMonth(-1)">
          <mat-icon>chevron_left</mat-icon>
        </button>
        <span class="month-label">{{ monthLabel() }}</span>
        <button class="nav-btn" (click)="changeMonth(1)">
          <mat-icon>chevron_right</mat-icon>
        </button>
      </div>

      @if (loading()) {
        <div class="loading"><mat-progress-spinner diameter="28" mode="indeterminate"/></div>
      } @else {
        <div class="summary-row">
          <div class="sum-chip present">✓ {{ summary().present }} Present</div>
          <div class="sum-chip absent">✗ {{ summary().absent }} Absent</div>
          <div class="sum-chip late">◷ {{ summary().late }} Late</div>
        </div>

        <!-- Day-of-week header -->
        <div class="calendar-grid">
          @for (d of dayNames; track d) {
            <div class="dow-cell">{{ d }}</div>
          }
          @for (day of calendarDays(); track $index) {
            <div class="day-cell"
                 [class.present]="day.status === 'present'"
                 [class.absent]="day.status === 'absent'"
                 [class.late]="day.status === 'late'"
                 [class.empty]="day.dayNum === 0">
              @if (day.dayNum > 0) {
                <span class="day-num">{{ day.dayNum }}</span>
              }
            </div>
          }
        </div>

        <div class="legend">
          <span class="leg present">Present</span>
          <span class="leg absent">Absent</span>
          <span class="leg late">Late</span>
          <span class="leg unmarked">Unmarked</span>
        </div>
      }
    </div>
  `,
  styles: [`
    .page { padding: 12px 14px; }

    .month-nav {
      display: flex; align-items: center; justify-content: space-between;
      background: var(--surface); border: 1px solid var(--border);
      border-radius: 10px; padding: 4px 8px; margin-bottom: 12px;
    }
    .nav-btn {
      background: none; border: none; cursor: pointer;
      color: var(--text-2); display: flex; align-items: center;
      padding: 6px; border-radius: 6px;
      &:hover { background: var(--bg); }
      mat-icon { font-size: 20px; width: 20px; height: 20px; }
    }
    .month-label { font-size: 14px; font-weight: 700; color: var(--text-1); }

    .loading { display: flex; justify-content: center; padding: 40px; }

    .summary-row { display: flex; gap: 6px; margin-bottom: 10px; }
    .sum-chip {
      flex: 1; text-align: center; padding: 6px 2px;
      border-radius: 8px; font-size: 11px; font-weight: 700;
      &.present { background: var(--green-light); color: #065F46; }
      &.absent  { background: var(--red-light);   color: var(--red); }
      &.late    { background: #FFF7ED;             color: #C2410C; }
    }

    .calendar-grid {
      display: grid;
      grid-template-columns: repeat(7, 1fr);
      gap: 3px;
      margin-bottom: 10px;
    }

    .dow-cell {
      height: 22px; display: flex; align-items: center; justify-content: center;
      font-size: 10px; font-weight: 600; color: var(--text-4);
      text-transform: uppercase;
    }

    .day-cell {
      height: 34px; border-radius: 6px;
      display: flex; align-items: center; justify-content: center;
      background: var(--bg);
      &.present { background: var(--green-light); }
      &.absent  { background: var(--red-light); }
      &.late    { background: #FFF7ED; }
      &.empty   { opacity: 0; pointer-events: none; }
    }
    .day-num { font-size: 11px; font-weight: 600; color: var(--text-2); }
    .day-cell.present .day-num { color: #065F46; }
    .day-cell.absent  .day-num { color: #991B1B; }
    .day-cell.late    .day-num { color: #C2410C; }

    .legend { display: flex; gap: 10px; flex-wrap: wrap; }
    .leg {
      font-size: 11px; color: var(--text-3);
      display: flex; align-items: center; gap: 4px;
      &.present::before { content: '●'; color: #065F46; }
      &.absent::before  { content: '●'; color: var(--red); }
      &.late::before    { content: '●'; color: #C2410C; }
      &.unmarked::before { content: '●'; color: var(--border); }
    }
  `],
})
export class ParentAttendanceComponent implements OnInit {
  private api = inject(ApiService);
  state       = inject(ParentStateService);
  loading     = signal(false);
  records     = signal<{ date: string; status: string }[]>([]);

  private _now = new Date();
  currentMonth = signal<string>(localYearMonth(this._now));

  dayNames = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

  summary = computed(() => ({
    present: this.records().filter(r => r.status === 'present').length,
    absent:  this.records().filter(r => r.status === 'absent').length,
    late:    this.records().filter(r => r.status === 'late').length,
  }));

  monthLabel = computed(() => {
    const [y, m] = this.currentMonth().split('-');
    return new Date(+y, +m - 1, 1).toLocaleDateString('en', { month: 'long', year: 'numeric' });
  });

  calendarDays = computed(() => {
    const [y, m] = this.currentMonth().split('-').map(Number);
    const firstDay    = new Date(y, m - 1, 1).getDay();
    const daysInMonth = new Date(y, m, 0).getDate();
    const statusMap   = Object.fromEntries(this.records().map(r => [r.date, r.status]));
    const cells: { dayNum: number; status: string | null }[] = [];
    for (let i = 0; i < firstDay; i++) cells.push({ dayNum: 0, status: null });
    for (let d = 1; d <= daysInMonth; d++) {
      const date = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      cells.push({ dayNum: d, status: statusMap[date] ?? null });
    }
    return cells;
  });

  ngOnInit() { this.load(); }

  load() {
    const child = this.state.activeChild();
    if (!child) return;
    this.loading.set(true);
    this.api.get<any>(`/parent/students/${child.id}/attendance`, { month: this.currentMonth() }).subscribe({
      next: (res: any) => { this.records.set(res.data?.records ?? []); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  changeMonth(dir: number) {
    const [y, m] = this.currentMonth().split('-').map(Number);
    // Use local date arithmetic — avoid toISOString() which converts to UTC and can shift month
    const d = new Date(y, m - 1 + dir, 1);
    this.currentMonth.set(localYearMonth(d));
    this.load();
  }
}
