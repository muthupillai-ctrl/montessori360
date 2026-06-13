import { Component, inject, signal, OnInit, computed } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/services/api.service';
import { AuthService } from '../../core/services/auth.service';
import { LeaveEligibilityComponent } from './leave-eligibility.component';

interface LeaveBalance {
  casual: number; casual_used: number;
  sick: number;   sick_used: number;
  earned: number; earned_used: number;
  academic_year: string;
}
interface LeaveRequest {
  id: string; staff_id: string; staff_name: string;
  leave_type: string; from_date: string; to_date: string;
  days: number; reason: string; status: string;
  review_note: string | null; created_at: string;
}

const LEAVE_META: Record<string, { label: string; color: string; light: string }> = {
  casual:    { label: 'Casual',    color: '#2563EB', light: 'var(--blue-light)'   },
  sick:      { label: 'Sick',      color: '#10B981', light: 'var(--green-light)'  },
  earned:    { label: 'Earned',    color: '#7C3AED', light: 'var(--purple-light)' },
  maternity: { label: 'Maternity', color: '#DB2777', light: '#FDF2F8'             },
  paternity: { label: 'Paternity', color: '#F59E0B', light: 'var(--amber-light)'  },
  lwp:       { label: 'LWP',       color: '#EF4444', light: 'var(--red-light)'    },
  other:     { label: 'Other',     color: '#6B7280', light: '#F9FAFB'             },
};
const STATUS_META: Record<string, { label: string; color: string; bg: string }> = {
  pending:   { label: 'Pending',   color: '#92400E', bg: 'var(--amber-light)' },
  approved:  { label: 'Approved',  color: '#065F46', bg: 'var(--green-light)' },
  rejected:  { label: 'Rejected',  color: '#991B1B', bg: 'var(--red-light)'   },
  cancelled: { label: 'Cancelled', color: 'var(--text-3)', bg: 'var(--border-light)' },
};

@Component({
  selector: 'app-staff-leave',
  standalone: true,
  imports: [
    ReactiveFormsModule, MatIconModule, MatProgressSpinnerModule,
    FormsModule, DatePipe, LeaveEligibilityComponent,
  ],
  template: `
    <div class="leave-page">

      <!-- ── Two-panel layout ──────────────────────────────────── -->
      <div class="two-panel">

        <!-- LEFT: My Leave (balance + requests merged) -->
        <div class="panel">
          <div class="panel-head">
            <span class="ph-title">My Leave</span>
            <div class="ph-sub">{{ balance()?.academic_year ?? '' }}</div>
            <button class="btn-apply"
                    [class.dimmed]="isOwner()"
                    [disabled]="isOwner()"
                    [title]="isOwner() ? 'Owners are not eligible for leave' : ''"
                    (click)="!isOwner() && showApply.set(!showApply())">
              <mat-icon style="font-size:14px;width:14px;height:14px">add</mat-icon>
              Apply
            </button>
          </div>

          <!-- Apply form (inline, collapsible) -->
          @if (showApply()) {
            <div class="apply-form">
              <form [formGroup]="applyForm">
                <div class="af-row">
                  <div class="fg">
                    <label class="fl">Type</label>
                    <select class="fi" formControlName="leave_type">
                      @for (lt of leaveTypes; track lt.value) {
                        <option [value]="lt.value">{{ lt.label }}</option>
                      }
                    </select>
                  </div>
                  <div class="fg">
                    <label class="fl">From</label>
                    <input class="fi" type="date" formControlName="from_date" (change)="calcDays()">
                  </div>
                  <div class="fg">
                    <label class="fl">To</label>
                    <input class="fi" type="date" formControlName="to_date" (change)="calcDays()">
                  </div>
                  @if (reqDays() > 0) {
                    <div class="days-pill">{{ reqDays() }}d</div>
                  }
                </div>
                <div class="fg" style="margin-bottom:8px">
                  <label class="fl">Reason</label>
                  <textarea class="fi ta" formControlName="reason" rows="2"
                            placeholder="Reason for leave…"></textarea>
                </div>
                @if (applyErr()) {
                  <div class="err-bar">
                    <mat-icon style="font-size:13px;width:13px;height:13px;flex-shrink:0">error_outline</mat-icon>
                    {{ applyErr() }}
                  </div>
                }
                <div class="af-footer">
                  <button type="button" class="btn-ghost" (click)="showApply.set(false)">Cancel</button>
                  <button type="button" class="btn-submit" (click)="submit()"
                          [disabled]="applyForm.invalid || applying()">
                    @if (applying()) {
                      <mat-progress-spinner diameter="14" mode="indeterminate"
                        style="--mdc-circular-progress-active-indicator-color:#fff"/>
                    } @else {
                      <mat-icon style="font-size:13px;width:13px;height:13px">send</mat-icon>
                    }
                    Submit
                  </button>
                </div>
              </form>
            </div>
          }

          <!-- Merged table -->
          <div class="panel-body">
            <table class="tbl">
              <thead>
                <tr>
                  <th>Type</th>
                  <th class="tc">Allocated</th>
                  <th class="tc">Used</th>
                  <th class="tc">Available</th>
                </tr>
              </thead>
              <tbody>
                <!-- Balance rows -->
                @if (balance()) {
                  @for (b of balanceRows(); track b.key) {
                    <tr class="bal-row">
                      <td>
                        <span class="type-pill"
                              [style.background]="b.light"
                              [style.color]="b.color">{{ b.label }}</span>
                      </td>
                      <td class="tc fw">{{ b.total }}</td>
                      <td class="tc">
                        <div class="used-cell">
                          <span>{{ b.used }}</span>
                          <div class="mini-bar">
                            <div class="mini-fill"
                                 [style.width.%]="b.total > 0 ? (b.used / b.total * 100) : 0"
                                 [style.background]="b.color"></div>
                          </div>
                        </div>
                      </td>
                      <td class="tc fw" [style.color]="b.color">{{ b.available }}</td>
                    </tr>
                  }
                }

                <!-- Section divider -->
                <tr class="sec-div">
                  <td colspan="4">My Requests</td>
                </tr>

                <!-- Request rows -->
                @if (myLoading()) {
                  <tr><td colspan="4" class="loading-cell">
                    <mat-progress-spinner diameter="20" mode="indeterminate"/>
                  </td></tr>
                } @else if (!myRequests().length) {
                  <tr><td colspan="4" class="empty-cell">No requests yet</td></tr>
                } @else {
                  @for (r of myRequests(); track r.id) {
                    <tr class="req-row">
                      <td>
                        <span class="type-pill"
                              [style.background]="lm(r.leave_type).light"
                              [style.color]="lm(r.leave_type).color">
                          {{ lm(r.leave_type).label }}
                        </span>
                      </td>
                      <td colspan="2" class="period-cell">
                        {{ r.from_date | date:'d MMM' }}
                        @if (r.from_date !== r.to_date) { → {{ r.to_date | date:'d MMM yy' }} }
                        @else { {{ r.from_date | date:'yyyy' }} }
                        · {{ r.days }}d
                      </td>
                      <td class="tc">
                        <div style="display:flex;align-items:center;justify-content:flex-end;gap:4px">
                          <span class="stat-pill"
                                [style.background]="sm(r.status).bg"
                                [style.color]="sm(r.status).color">
                            {{ sm(r.status).label }}
                          </span>
                          @if (r.status === 'pending') {
                            <button class="btn-cancel-xs" (click)="cancel(r)" title="Cancel">
                              <mat-icon style="font-size:12px;width:12px;height:12px">close</mat-icon>
                            </button>
                          }
                        </div>
                      </td>
                    </tr>
                  }
                }
              </tbody>
            </table>
          </div>
        </div>

        <!-- RIGHT: Holidays (staff) or All Requests (admin) -->
        @if (!isAdmin()) {
          <div class="panel">
            <div class="panel-head">
              <span class="ph-title">Upcoming Holidays</span>
              <span class="ph-sub">School calendar</span>
            </div>
            <div class="panel-body">
              @if (!holidays().length) {
                <div class="empty-cell" style="padding:40px;text-align:center;color:var(--text-3)">
                  No upcoming holidays found
                </div>
              } @else {
                <table class="tbl">
                  <thead>
                    <tr><th>Holiday</th><th>Date</th><th>Day</th></tr>
                  </thead>
                  <tbody>
                    @for (h of holidays(); track h.id) {
                      <tr class="req-row">
                        <td class="fw" style="font-size:12px">{{ h.title }}</td>
                        <td class="period-cell">{{ h.start_date | date:'d MMM yyyy' }}</td>
                        <td class="period-cell">{{ h.start_date | date:'EEE' }}</td>
                      </tr>
                    }
                  </tbody>
                </table>
              }
            </div>
          </div>
        }

        @if (isAdmin()) {
          <div class="panel">
            <div class="panel-head">
              <span class="ph-title">All Staff Requests</span>
              <div class="ph-filters">
                <select class="fs" [(ngModel)]="adminStatus" (ngModelChange)="loadAll()">
                  <option value="pending">Pending</option>
                  <option value="approved">Approved</option>
                  <option value="rejected">Rejected</option>
                  <option value="">All</option>
                </select>
                <select class="fs" [(ngModel)]="adminType" (ngModelChange)="loadAll()">
                  <option value="">All Types</option>
                  @for (lt of leaveTypes; track lt.value) {
                    <option [value]="lt.value">{{ lt.label }}</option>
                  }
                </select>
                <button class="icon-btn" (click)="loadAll()">
                  <mat-icon style="font-size:16px;width:16px;height:16px">refresh</mat-icon>
                </button>
              </div>
            </div>
            <div class="panel-body">
              @if (allLoading()) {
                <div class="center-load"><mat-progress-spinner diameter="24" mode="indeterminate"/></div>
              } @else if (!allRequests().length) {
                <div class="empty-cell" style="padding:40px;text-align:center">No requests found</div>
              } @else {
                <table class="tbl">
                  <thead>
                    <tr>
                      <th>Staff</th>
                      <th>Type</th>
                      <th>Period</th>
                      <th class="tc">Days</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (r of allRequests(); track r.id) {
                      <tr class="req-row">
                        <td>
                          <div class="fw" style="font-size:12px">{{ r.staff_name }}</div>
                          <div style="font-size:10px;color:var(--text-3)">{{ r.created_at | date:'d MMM' }}</div>
                        </td>
                        <td>
                          <span class="type-pill"
                                [style.background]="lm(r.leave_type).light"
                                [style.color]="lm(r.leave_type).color">
                            {{ lm(r.leave_type).label }}
                          </span>
                        </td>
                        <td class="period-cell">
                          {{ r.from_date | date:'d MMM' }}
                          @if (r.from_date !== r.to_date) { – {{ r.to_date | date:'d MMM yy' }} }
                        </td>
                        <td class="tc">{{ r.days }}d</td>
                        <td>
                          @if (r.status === 'pending') {
                            <div class="act-row">
                              <button class="btn-ok" (click)="review(r,'approved')">
                                <mat-icon style="font-size:12px;width:12px;height:12px">check</mat-icon>
                              </button>
                              <button class="btn-no" (click)="review(r,'rejected')">
                                <mat-icon style="font-size:12px;width:12px;height:12px">close</mat-icon>
                              </button>
                            </div>
                          } @else {
                            <span class="stat-pill"
                                  [style.background]="sm(r.status).bg"
                                  [style.color]="sm(r.status).color">
                              {{ sm(r.status).label }}
                            </span>
                          }
                        </td>
                      </tr>
                    }
                  </tbody>
                </table>
              }
            </div>
          </div>
        }
      </div>

      <!-- ── Eligibility (admin only, full-width below) ─────────── -->
      @if (isAdmin()) {
        <div class="elig-wrap">
          <app-leave-eligibility />
        </div>
      }

    </div>
  `,
  styles: [`
    .leave-page { padding: 16px; display: flex; flex-direction: column; gap: 12px; }

    /* Two-panel grid */
    .two-panel {
      display: grid;
      grid-template-columns: 1fr 1.6fr;
      gap: 12px;
      height: calc(100vh - 260px);
      min-height: 380px;
    }

    .panel {
      background: var(--surface); border: 1px solid var(--border);
      border-radius: 10px; display: flex; flex-direction: column; overflow: hidden;
    }
    .panel-head {
      display: flex; align-items: center; gap: 8px;
      padding: 10px 14px; background: var(--bg);
      border-bottom: 1px solid var(--border); flex-shrink: 0;
    }
    .ph-title { font-size: 13px; font-weight: 600; color: var(--text); }
    .ph-sub   { font-size: 11px; color: var(--text-4); flex: 1; }
    .ph-filters { display: flex; gap: 6px; align-items: center; margin-left: auto; }

    .btn-apply {
      display: inline-flex; align-items: center; gap: 4px;
      background: var(--blue); color: #fff; border: none;
      border-radius: 7px; padding: 0 12px; height: 30px;
      font-size: 12px; font-weight: 500; cursor: pointer;
      &:hover:not(:disabled):not(.dimmed) { background: #1D4ED8; }
      &.dimmed { background: var(--border); color: var(--text-3); cursor: not-allowed; }
    }

    /* Apply form */
    .apply-form {
      padding: 10px 14px; background: var(--blue-light);
      border-bottom: 1px solid var(--border); flex-shrink: 0;
    }
    .af-row { display: flex; gap: 8px; align-items: flex-end; margin-bottom: 8px; flex-wrap: wrap; }
    .fg     { display: flex; flex-direction: column; gap: 3px; flex: 1; min-width: 90px; }
    .fl     { font-size: 11px; font-weight: 500; color: var(--text-2); }
    .fi     { height: 32px; padding: 0 8px; width: 100%; background: var(--surface); border: 1px solid var(--border); border-radius: 6px; font-size: 12px; color: var(--text); outline: none; font-family: inherit; &:focus { border-color: var(--blue); } }
    select.fi { cursor: pointer; }
    .ta     { height: auto; padding: 6px 8px; resize: none; }
    .days-pill { background: var(--blue); color: #fff; font-size: 11px; font-weight: 700; padding: 4px 9px; border-radius: 6px; white-space: nowrap; align-self: flex-end; flex-shrink: 0; }
    .err-bar { display: flex; align-items: center; gap: 6px; background: var(--red-light); border: 1px solid #FECACA; color: #991B1B; padding: 7px 10px; border-radius: 7px; font-size: 11.5px; margin-bottom: 8px; }
    .af-footer { display: flex; justify-content: flex-end; gap: 6px; }
    .btn-ghost  { background: none; border: none; cursor: pointer; font-size: 12px; color: var(--text-3); padding: 0 8px; height: 30px; border-radius: 6px; &:hover { background: var(--border-light); } }
    .btn-submit { display: flex; align-items: center; gap: 4px; background: var(--blue); color: #fff; border: none; border-radius: 7px; height: 30px; padding: 0 14px; font-size: 12px; font-weight: 500; cursor: pointer; &:hover:not(:disabled) { background: #1D4ED8; } &:disabled { opacity: .6; cursor: not-allowed; } }

    /* Shared table */
    .panel-body { flex: 1; overflow-y: auto; }
    .tbl { width: 100%; border-collapse: collapse; }
    .tbl th {
      text-align: left; padding: 8px 12px;
      font-size: 10px; font-weight: 600; text-transform: uppercase;
      letter-spacing: .4px; color: var(--text-4); background: var(--surface);
      border-bottom: 1px solid var(--border);
      position: sticky; top: 0; z-index: 1;
    }
    .tbl td { padding: 8px 12px; border-bottom: 1px solid var(--border-light); vertical-align: middle; }
    .tc  { text-align: center; }
    .fw  { font-weight: 600; color: var(--text); }

    /* Balance rows */
    .bal-row { background: var(--bg); }
    .bal-row td { padding: 7px 12px; }
    .used-cell { display: flex; align-items: center; gap: 6px; justify-content: center; }
    .mini-bar  { width: 40px; height: 4px; background: var(--border); border-radius: 2px; overflow: hidden; flex-shrink: 0; }
    .mini-fill { height: 100%; border-radius: 2px; }

    /* Section divider */
    .sec-div td {
      padding: 5px 12px; background: var(--bg);
      border-top: 1px solid var(--border); border-bottom: 1px solid var(--border);
      font-size: 10px; font-weight: 600; text-transform: uppercase;
      letter-spacing: .4px; color: var(--text-4);
    }

    /* Request rows */
    .req-row { &:last-child td { border-bottom: none; } }
    .period-cell { font-size: 11.5px; color: var(--text-2); }
    .loading-cell { text-align: center; padding: 24px; }
    .empty-cell   { font-size: 12px; color: var(--text-3); }

    /* Chips */
    .type-pill { font-size: 10.5px; font-weight: 600; padding: 2px 8px; border-radius: 5px; white-space: nowrap; }
    .stat-pill { font-size: 10.5px; font-weight: 600; padding: 2px 8px; border-radius: 20px; white-space: nowrap; }

    /* Action buttons */
    .act-row { display: flex; gap: 4px; }
    .btn-ok {
      width: 26px; height: 26px; border-radius: 6px; border: none; cursor: pointer;
      background: var(--green-light); color: #065F46; display: flex; align-items: center; justify-content: center;
      &:hover { background: var(--green); color: #fff; }
    }
    .btn-no {
      width: 26px; height: 26px; border-radius: 6px; border: none; cursor: pointer;
      background: var(--red-light); color: #991B1B; display: flex; align-items: center; justify-content: center;
      &:hover { background: var(--red); color: #fff; }
    }
    .btn-cancel-xs {
      width: 22px; height: 22px; border-radius: 5px; border: 1px solid var(--border);
      background: none; color: var(--text-3); cursor: pointer; display: flex; align-items: center; justify-content: center;
      &:hover { background: var(--red-light); color: var(--red); border-color: var(--red); }
    }

    /* Filters */
    .fs { height: 28px; padding: 0 8px; background: var(--surface); border: 1px solid var(--border); border-radius: 6px; font-size: 11.5px; color: var(--text-2); outline: none; cursor: pointer; }
    .icon-btn { width: 28px; height: 28px; border-radius: 6px; background: var(--surface); border: 1px solid var(--border); display: flex; align-items: center; justify-content: center; cursor: pointer; color: var(--text-3); &:hover { background: var(--bg); } }

    /* Eligibility wrapper */
    .elig-wrap { flex-shrink: 0; }

    .center-load { display: flex; justify-content: center; padding: 40px; }
  `],
})
export class StaffLeaveComponent implements OnInit {
  private api   = inject(ApiService);
  private snack = inject(MatSnackBar);
  private auth  = inject(AuthService);
  private fb    = inject(FormBuilder);

  balance     = signal<LeaveBalance | null>(null);
  myRequests  = signal<LeaveRequest[]>([]);
  allRequests = signal<LeaveRequest[]>([]);
  myLoading   = signal(false);
  allLoading  = signal(false);
  showApply   = signal(false);
  applying    = signal(false);
  applyErr    = signal('');
  reqDays     = signal(0);
  adminStatus = 'pending';
  adminType   = '';

  isAdmin = () => ['owner', 'principal'].includes(this.auth.user()?.role ?? '');
  isOwner = () => this.auth.user()?.role === 'owner';

  holidays = signal<any[]>([]);

  leaveTypes = Object.entries(LEAVE_META).map(([value, m]) => ({ value, label: m.label }));

  balanceRows = computed(() => {
    const b = this.balance(); if (!b) return [];
    return [
      { key:'casual', ...LEAVE_META['casual'], total:b.casual,  used:b.casual_used,  available:b.casual -b.casual_used  },
      { key:'sick',   ...LEAVE_META['sick'],   total:b.sick,    used:b.sick_used,    available:b.sick   -b.sick_used    },
      { key:'earned', ...LEAVE_META['earned'], total:b.earned,  used:b.earned_used,  available:b.earned -b.earned_used  },
    ];
  });

  applyForm = this.fb.group({
    leave_type: ['casual', Validators.required],
    from_date:  ['', Validators.required],
    to_date:    ['', Validators.required],
    reason:     ['', Validators.required],
  });

  ngOnInit() {
    this.loadBalance();
    this.loadMine();
    this.loadHolidays();
    if (this.isAdmin()) this.loadAll();
  }

  loadHolidays() {
    const today = new Date().toISOString().slice(0, 10);
    const end   = new Date(new Date().getFullYear() + 1, 11, 31).toISOString().slice(0, 10);
    this.api.get<any>('/calendar/events', { event_type: 'holiday', from: today, to: end }).subscribe({
      next: (res: any) => this.holidays.set((res.data ?? []).slice(0, 10)),
      error: () => {},
    });
  }

  loadBalance() {
    this.api.get<any>('/staff/leave/balance/me').subscribe({
      next: (res: any) => this.balance.set(res.data), error: () => {},
    });
  }

  loadMine() {
    this.myLoading.set(true);
    const userId = this.auth.user()?.id ?? '';
    this.api.get<any>('/staff/leave/requests', { staff_id: userId, limit: '50' }).subscribe({
      next: (res: any) => { this.myRequests.set(res.data ?? []); this.myLoading.set(false); },
      error: () => this.myLoading.set(false),
    });
  }

  loadAll() {
    this.allLoading.set(true);
    const p: Record<string, string> = { limit: '100' };
    if (this.adminStatus) p['status']     = this.adminStatus;
    if (this.adminType)   p['leave_type'] = this.adminType;
    this.api.get<any>('/staff/leave/requests', p).subscribe({
      next: (res: any) => { this.allRequests.set(res.data ?? []); this.allLoading.set(false); },
      error: () => this.allLoading.set(false),
    });
  }

  calcDays() {
    const f = this.applyForm.value.from_date, t = this.applyForm.value.to_date;
    if (f && t) this.reqDays.set(Math.max(0, Math.floor((new Date(t).getTime() - new Date(f).getTime()) / 864e5) + 1));
  }

  submit() {
    if (this.applyForm.invalid) { this.applyForm.markAllAsTouched(); return; }
    this.applying.set(true); this.applyErr.set('');
    const v = this.applyForm.value;
    this.api.post<any>('/staff/leave/request', {
      leave_type: v.leave_type, from_date: v.from_date,
      to_date: v.to_date, reason: v.reason?.trim(),
    }).subscribe({
      next: () => {
        this.applying.set(false); this.showApply.set(false);
        this.applyForm.reset({ leave_type: 'casual' }); this.reqDays.set(0);
        this.snack.open('Leave application submitted', 'OK', { duration: 3000 });
        this.loadMine(); this.loadBalance();
      },
      error: (err: any) => {
        this.applying.set(false);
        const d = err.error?.error?.details;
        this.applyErr.set(d
          ? Object.entries(d).map(([k, v]) => `${k}: ${(v as string[]).join(', ')}`).join(' | ')
          : (err.error?.error?.message ?? 'Failed to submit.'));
      },
    });
  }

  cancel(r: LeaveRequest) {
    if (!confirm('Cancel this leave request?')) return;
    this.api.patch<any>('/staff/leave/requests/' + r.id + '/cancel', {}).subscribe({
      next: () => { this.snack.open('Cancelled', 'OK', { duration: 2000 }); this.loadMine(); },
      error: (err: any) => this.snack.open(err.error?.error?.message ?? 'Error', 'OK', { duration: 3000 }),
    });
  }

  review(r: LeaveRequest, status: 'approved' | 'rejected') {
    const note = status === 'rejected' ? prompt('Rejection reason (optional):') : null;
    this.api.patch<any>('/staff/leave/requests/' + r.id + '/review', {
      status, review_note: note ?? undefined,
    }).subscribe({
      next: () => { this.snack.open('Leave ' + status, 'OK', { duration: 2000 }); this.loadAll(); },
      error: (err: any) => this.snack.open(err.error?.error?.message ?? 'Error', 'OK', { duration: 3000 }),
    });
  }

  lm(type: string) { return LEAVE_META[type] ?? { label: type, color: 'var(--text-3)', light: 'var(--border-light)' }; }
  sm(status: string) { return STATUS_META[status] ?? { label: status, color: 'var(--text-3)', bg: 'var(--border-light)' }; }
}
