import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ApiService } from '../../core/services/api.service';
import { ParentStateService } from './parent-state.service';

function localYearMonth(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

@Component({
  selector: 'app-parent-attendance',
  standalone: true,
  imports: [MatProgressSpinnerModule],
  template: `
    <div class="page">

      <!-- Month nav -->
      <div class="month-nav">
        <button class="nav-btn" (click)="changeMonth(-1)">
          <i class="ti ti-chevron-left"></i>
        </button>
        <span class="month-label">{{ monthLabel() }}</span>
        <button class="nav-btn" (click)="changeMonth(1)">
          <i class="ti ti-chevron-right"></i>
        </button>
      </div>

      @if (loading()) {
        <div class="loading"><mat-progress-spinner diameter="28" mode="indeterminate"/></div>
      } @else {

        <!-- Summary -->
        <div class="summary-row">
          <div class="sum-card present">
            <div class="sum-num">{{ summary().present }}</div>
            <div class="sum-lbl">Present</div>
          </div>
          <div class="sum-card absent">
            <div class="sum-num">{{ summary().absent }}</div>
            <div class="sum-lbl">Absent</div>
          </div>
          <div class="sum-card late">
            <div class="sum-num">{{ summary().late }}</div>
            <div class="sum-lbl">Late</div>
          </div>
          <div class="sum-card total">
            <div class="sum-num">{{ summary().present + summary().absent + summary().late }}</div>
            <div class="sum-lbl">School Days</div>
          </div>
        </div>

        <!-- Calendar -->
        <div class="cal-card">
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
                  @if (day.status) {
                    <span class="day-dot"></span>
                  }
                }
              </div>
            }
          </div>
        </div>

        <!-- Legend -->
        <div class="legend">
          <span class="leg present"><span class="leg-dot"></span>Present</span>
          <span class="leg absent"><span class="leg-dot"></span>Absent</span>
          <span class="leg late"><span class="leg-dot"></span>Late</span>
          <span class="leg unmarked"><span class="leg-dot"></span>No data</span>
        </div>

      }
    </div>
  `,
  styles: [`
    .page { padding: 16px 16px 24px; background: #F5F7FA; min-height: 100%; }

    /* ── Month nav ── */
    .month-nav {
      display: flex; align-items: center; justify-content: space-between;
      background: #fff; border: 1px solid #EAECF0;
      border-radius: 14px; padding: 6px 10px; margin-bottom: 14px;
      box-shadow: 0 1px 4px rgba(0,0,0,.05);
    }
    .nav-btn {
      width: 34px; height: 34px; border-radius: 9px;
      background: #F5F7FA; border: 1px solid #EAECF0; cursor: pointer;
      color: #667085; font-size: 16px;
      display: flex; align-items: center; justify-content: center;
      transition: background .15s;
      &:hover { background: #EEF2FF; color: #4F46E5; }
    }
    .month-label { font-size: 15px; font-weight: 700; color: #1D2939; }

    /* ── Summary ── */
    .summary-row { display: grid; grid-template-columns: repeat(4,1fr); gap: 8px; margin-bottom: 14px; }
    .sum-card {
      border-radius: 12px; padding: 12px 8px; text-align: center;
      border: 1px solid transparent;
    }
    .sum-num { font-size: 22px; font-weight: 800; line-height: 1; }
    .sum-lbl { font-size: 10px; font-weight: 600; margin-top: 4px; text-transform: uppercase; letter-spacing: .04em; }
    .sum-card.present { background: #ECFDF5; border-color: #A7F3D0; .sum-num { color: #059669; } .sum-lbl { color: #059669; } }
    .sum-card.absent  { background: #FEF2F2; border-color: #FECACA; .sum-num { color: #DC2626; } .sum-lbl { color: #DC2626; } }
    .sum-card.late    { background: #FFFBEB; border-color: #FDE68A; .sum-num { color: #D97706; } .sum-lbl { color: #D97706; } }
    .sum-card.total   { background: #EEF2FF; border-color: #C7D2FE; .sum-num { color: #4F46E5; } .sum-lbl { color: #4F46E5; } }

    /* ── Calendar ── */
    .cal-card { background: #fff; border-radius: 16px; border: 1px solid #EAECF0; padding: 14px; box-shadow: 0 1px 6px rgba(0,0,0,.05); margin-bottom: 14px; }
    .calendar-grid { display: grid; grid-template-columns: repeat(7,1fr); gap: 4px; }
    .dow-cell {
      height: 24px; display: flex; align-items: center; justify-content: center;
      font-size: 10px; font-weight: 700; color: #98A2B3; text-transform: uppercase;
    }
    .day-cell {
      height: 38px; border-radius: 8px;
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      gap: 2px; background: #F9FAFB;
      &.empty { opacity: 0; pointer-events: none; }
      &.present { background: #ECFDF5; }
      &.absent  { background: #FEF2F2; }
      &.late    { background: #FFFBEB; }
    }
    .day-num { font-size: 12px; font-weight: 600; color: #667085; line-height: 1; }
    .day-cell.present .day-num { color: #059669; }
    .day-cell.absent  .day-num { color: #DC2626; }
    .day-cell.late    .day-num { color: #D97706; }
    .day-dot { width: 4px; height: 4px; border-radius: 50%; }
    .day-cell.present .day-dot { background: #059669; }
    .day-cell.absent  .day-dot { background: #DC2626; }
    .day-cell.late    .day-dot { background: #D97706; }

    /* ── Legend ── */
    .legend { display: flex; gap: 14px; flex-wrap: wrap; padding: 2px 4px; }
    .leg { display: flex; align-items: center; gap: 5px; font-size: 11px; font-weight: 600; color: #667085; }
    .leg-dot { width: 8px; height: 8px; border-radius: 50%; }
    .leg.present .leg-dot { background: #059669; }
    .leg.absent  .leg-dot { background: #DC2626; }
    .leg.late    .leg-dot { background: #D97706; }
    .leg.unmarked .leg-dot { background: #D0D5DD; }

    .loading { display: flex; justify-content: center; padding: 60px; }
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
    const d = new Date(y, m - 1 + dir, 1);
    this.currentMonth.set(localYearMonth(d));
    this.load();
  }
}
