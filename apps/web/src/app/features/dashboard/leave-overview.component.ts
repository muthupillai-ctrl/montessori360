import { Component, inject, signal, OnInit } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';
import { DatePipe } from '@angular/common';
import { ApiService } from '../../core/services/api.service';

const LEAVE_META: Record<string, { label: string; color: string; bg: string }> = {
  casual:    { label: 'Casual',    color: '#2563EB', bg: '#EFF6FF' },
  sick:      { label: 'Sick',      color: '#10B981', bg: '#ECFDF5' },
  earned:    { label: 'Earned',    color: '#7C3AED', bg: '#F5F3FF' },
  maternity: { label: 'Maternity', color: '#DB2777', bg: '#FDF2F8' },
  paternity: { label: 'Paternity', color: '#F59E0B', bg: '#FFFBEB' },
  lwp:       { label: 'LWP',       color: '#EF4444', bg: '#FEF2F2' },
  other:     { label: 'Other',     color: '#6B7280', bg: '#F9FAFB' },
};

@Component({
  selector: 'app-leave-overview',
  standalone: true,
  imports: [ MatIconModule, MatProgressSpinnerModule, DatePipe ],
  template: `
    @if (loading()) {
      <div class="loading-state"><mat-progress-spinner diameter="24" mode="indeterminate"/></div>
    } @else if (data()) {
      <div class="leave-overview">

        <!-- Stats strip -->
        <div class="stats-strip">
          <div class="stat-chip amber">
            <div class="sc-val">{{ data()!.stats.pending }}</div>
            <div class="sc-lbl">Pending</div>
          </div>
          <div class="stat-chip blue">
            <div class="sc-val">{{ data()!.stats.on_leave_today }}</div>
            <div class="sc-lbl">On leave today</div>
          </div>
          <div class="stat-chip purple">
            <div class="sc-val">{{ data()!.stats.this_month }}</div>
            <div class="sc-lbl">This month</div>
          </div>
          <div class="stat-chip red">
            <div class="sc-val">{{ data()!.stats.lwp_month }}</div>
            <div class="sc-lbl">LWP</div>
          </div>
        </div>

        <!-- 3-column panels -->
        <div class="panels">

          <!-- On leave today -->
          <div class="panel">
            <div class="panel-head">
              <mat-icon style="font-size:14px;width:14px;height:14px;color:var(--blue)">person_off</mat-icon>
              On Leave Today
              @if (data()!.on_leave_today.length) {
                <span class="cnt-badge">{{ data()!.on_leave_today.length }}</span>
              }
            </div>
            @if (!data()!.on_leave_today.length) {
              <div class="empty-panel">All staff present today</div>
            } @else {
              @for (r of data()!.on_leave_today; track r.id) {
                <div class="staff-row">
                  <div class="sr-av" [style.background]="getColor(r.staff_name)">
                    {{ r.staff_name[0] }}
                  </div>
                  <div class="sr-info">
                    <div class="sr-name">{{ r.staff_name }}</div>
                    <div class="sr-meta">
                      <span class="lt-tag" [style.background]="lm(r.leave_type).bg"
                            [style.color]="lm(r.leave_type).color">{{ lm(r.leave_type).label }}</span>
                      · returns {{ r.to_date | date:'d MMM' }}
                    </div>
                  </div>
                </div>
              }
            }
          </div>

          <!-- Pending approvals -->
          <div class="panel">
            <div class="panel-head">
              <mat-icon style="font-size:14px;width:14px;height:14px;color:var(--amber)">pending_actions</mat-icon>
              Pending Approvals
              @if (data()!.pending_approvals.length) {
                <span class="cnt-badge amber">{{ data()!.pending_approvals.length }}</span>
              }
            </div>
            @if (!data()!.pending_approvals.length) {
              <div class="empty-panel">No pending requests</div>
            } @else {
              @for (r of data()!.pending_approvals; track r.id) {
                <div class="staff-row">
                  <div class="sr-av" [style.background]="getColor(r.staff_name)">
                    {{ r.staff_name[0] }}
                  </div>
                  <div class="sr-info">
                    <div class="sr-name">{{ r.staff_name }}</div>
                    <div class="sr-meta">
                      <span class="lt-tag" [style.background]="lm(r.leave_type).bg"
                            [style.color]="lm(r.leave_type).color">{{ lm(r.leave_type).label }}</span>
                      · {{ r.from_date | date:'d MMM' }}
                      @if (r.from_date !== r.to_date) { – {{ r.to_date | date:'d MMM' }} }
                      · {{ r.days }}d
                    </div>
                  </div>
                  <div class="act-btns">
                    <button class="btn-ok" (click)="review(r.id, 'approved')" title="Approve">
                      <mat-icon style="font-size:13px;width:13px;height:13px">check</mat-icon>
                    </button>
                    <button class="btn-no" (click)="review(r.id, 'rejected')" title="Reject">
                      <mat-icon style="font-size:13px;width:13px;height:13px">close</mat-icon>
                    </button>
                  </div>
                </div>
              }
            }
          </div>

          <!-- Upcoming leaves -->
          <div class="panel">
            <div class="panel-head">
              <mat-icon style="font-size:14px;width:14px;height:14px;color:var(--green)">event_available</mat-icon>
              Upcoming (next 7 days)
            </div>
            @if (!data()!.upcoming_leaves.length) {
              <div class="empty-panel">No upcoming leaves</div>
            } @else {
              @for (r of data()!.upcoming_leaves; track r.id) {
                <div class="staff-row">
                  <div class="sr-av" [style.background]="getColor(r.staff_name)">
                    {{ r.staff_name[0] }}
                  </div>
                  <div class="sr-info">
                    <div class="sr-name">{{ r.staff_name }}</div>
                    <div class="sr-meta">
                      <span class="lt-tag" [style.background]="lm(r.leave_type).bg"
                            [style.color]="lm(r.leave_type).color">{{ lm(r.leave_type).label }}</span>
                      · {{ r.from_date | date:'d MMM' }}
                      @if (r.from_date !== r.to_date) { – {{ r.to_date | date:'d MMM' }} }
                    </div>
                  </div>
                  <span class="days-b">{{ r.days }}d</span>
                </div>
              }
            }
          </div>

        </div>
      </div>
    }
  `,
  styles: [`
    .loading-state { display: flex; justify-content: center; padding: 32px; }
    .leave-overview { display: flex; flex-direction: column; gap: 12px; }

    /* Stats strip */
    .stats-strip { display: grid; grid-template-columns: repeat(4,1fr); gap: 8px; }
    .stat-chip { border-radius: 9px; padding: 10px 12px; text-align: center; }
    .stat-chip.amber  { background: var(--amber-light); }
    .stat-chip.blue   { background: var(--blue-light);  }
    .stat-chip.purple { background: var(--purple-light);}
    .stat-chip.red    { background: var(--red-light);   }
    .sc-val { font-size: 22px; font-weight: 700; color: var(--text); }
    .sc-lbl { font-size: 11px; color: var(--text-3); margin-top: 2px; }

    /* 3-panel grid */
    .panels { display: grid; grid-template-columns: repeat(3,1fr); gap: 10px; }
    .panel {
      background: var(--surface); border: 1px solid var(--border);
      border-radius: 10px; padding: 12px; display: flex; flex-direction: column; gap: 8px;
    }
    .panel-head {
      display: flex; align-items: center; gap: 6px;
      font-size: 12px; font-weight: 600; color: var(--text);
      padding-bottom: 8px; border-bottom: 1px solid var(--border-light);
    }
    .cnt-badge {
      margin-left: auto; background: var(--amber-light); color: #92400E;
      font-size: 10px; font-weight: 700; padding: 1px 7px; border-radius: 10px;
      &.amber { background: var(--amber-light); color: #92400E; }
    }
    .empty-panel { font-size: 12px; color: var(--text-3); text-align: center; padding: 12px 0; }

    /* Staff row */
    .staff-row { display: flex; align-items: center; gap: 8px; padding: 5px 0; border-bottom: 1px solid var(--border-light); &:last-child { border-bottom: none; } }
    .sr-av { width: 26px; height: 26px; border-radius: 7px; color: #fff; font-size: 10px; font-weight: 700; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
    .sr-info { flex: 1; min-width: 0; }
    .sr-name { font-size: 12px; font-weight: 500; color: var(--text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .sr-meta { font-size: 10.5px; color: var(--text-3); display: flex; align-items: center; gap: 3px; flex-wrap: wrap; }
    .lt-tag { font-size: 10px; font-weight: 600; padding: 1px 6px; border-radius: 4px; white-space: nowrap; }
    .days-b { font-size: 11px; font-weight: 600; color: var(--text-2); background: var(--bg); padding: 2px 6px; border-radius: 4px; flex-shrink: 0; }

    /* Approve/reject */
    .act-btns { display: flex; gap: 4px; flex-shrink: 0; }
    .btn-ok { width: 24px; height: 24px; border-radius: 5px; border: none; cursor: pointer; background: var(--green-light); color: #065F46; display: flex; align-items: center; justify-content: center; &:hover { background: var(--green); color: #fff; } }
    .btn-no { width: 24px; height: 24px; border-radius: 5px; border: none; cursor: pointer; background: var(--red-light); color: #991B1B; display: flex; align-items: center; justify-content: center; &:hover { background: var(--red); color: #fff; } }
  `],
})
export class LeaveOverviewComponent implements OnInit {
  private api   = inject(ApiService);
  private snack = inject(MatSnackBar);

  data    = signal<any | null>(null);
  loading = signal(true);

  ngOnInit() { this.load(); }

  load() {
    this.api.get<any>('/analytics/leave-overview').subscribe({
      next: (res: any) => { this.data.set(res.data); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  review(id: string, status: 'approved' | 'rejected') {
    const note = status === 'rejected' ? prompt('Rejection reason (optional):') : null;
    this.api.patch<any>('/staff/leave/requests/' + id + '/review', {
      status, review_note: note ?? undefined,
    }).subscribe({
      next: () => { this.snack.open('Leave ' + status, 'OK', { duration: 2000 }); this.load(); },
      error: (err: any) => this.snack.open(err.error?.error?.message ?? 'Error', 'OK', { duration: 3000 }),
    });
  }

  lm(t: string) { return LEAVE_META[t] ?? { label: t, color: '#6B7280', bg: '#F9FAFB' }; }
  getColor(name: string) {
    const colors = ['#2563EB','#7C3AED','#DB2777','#D97706','#059669','#0891B2'];
    return colors[(name?.charCodeAt(0) || 0) % colors.length];
  }
}
