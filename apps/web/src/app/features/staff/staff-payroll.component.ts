import { Component, inject, signal, OnInit, computed } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';
import { DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/services/api.service';
import { AuthService } from '../../core/services/auth.service';

const ROLE_LABELS: Record<string, string> = {
  owner: 'Owner', principal: 'Principal', teacher: 'Teacher',
  assistant_teacher: 'Asst. Teacher', accountant: 'Accountant',
  driver: 'Driver', support: 'Support',
};

@Component({
  selector: 'app-staff-payroll',
  standalone: true,
  imports: [ MatIconModule, MatProgressSpinnerModule, DecimalPipe, FormsModule ],
  template: `
    <div class="payroll-page">

      @if (isAdmin()) {
        <!-- ── Admin: full payroll report ──────────────────────── -->
        <div class="page-header">
          <div>
            <h1>Payroll</h1>
            <div class="subtitle">Monthly salary report</div>
          </div>
          <button class="btn-outline-custom" (click)="exportCsv()" [disabled]="!payroll().length">
            <mat-icon style="font-size:15px;width:15px;height:15px">download</mat-icon>
            Export CSV
          </button>
        </div>

        <div class="period-bar">
          <button class="period-nav" (click)="prevMonth()">
            <mat-icon style="font-size:18px;width:18px;height:18px">chevron_left</mat-icon>
          </button>
          <div class="period-label">{{ monthLabel() }}</div>
          <button class="period-nav" (click)="nextMonth()" [disabled]="isCurrentMonth()">
            <mat-icon style="font-size:18px;width:18px;height:18px">chevron_right</mat-icon>
          </button>
          <select class="filter-select" [(ngModel)]="roleFilter" (ngModelChange)="loadPayroll()">
            <option value="">All Roles</option>
            <option value="principal">Principal</option>
            <option value="teacher">Teacher</option>
            <option value="assistant_teacher">Asst. Teacher</option>
            <option value="accountant">Accountant</option>
            <option value="driver">Driver</option>
            <option value="support">Support</option>
          </select>
        </div>

        @if (payroll().length) {
          <div class="summary-row">
            <div class="sum-card">
              <div class="sum-icon blue"><mat-icon style="font-size:18px;width:18px;height:18px">people</mat-icon></div>
              <div><div class="sum-val">{{ payroll().length }}</div><div class="sum-lbl">Staff</div></div>
            </div>
            <div class="sum-card">
              <div class="sum-icon green"><mat-icon style="font-size:18px;width:18px;height:18px">account_balance_wallet</mat-icon></div>
              <div><div class="sum-val">₹{{ totalGross() | number:'1.0-0' }}</div><div class="sum-lbl">Total Gross</div></div>
            </div>
            <div class="sum-card">
              <div class="sum-icon red"><mat-icon style="font-size:18px;width:18px;height:18px">remove_circle</mat-icon></div>
              <div><div class="sum-val">₹{{ totalDeductions() | number:'1.0-0' }}</div><div class="sum-lbl">Deductions</div></div>
            </div>
            <div class="sum-card">
              <div class="sum-icon purple"><mat-icon style="font-size:18px;width:18px;height:18px">payments</mat-icon></div>
              <div><div class="sum-val">₹{{ totalNet() | number:'1.0-0' }}</div><div class="sum-lbl">Net Pay</div></div>
            </div>
          </div>
        }

        @if (loading()) {
          <div class="loading-state"><mat-progress-spinner mode="indeterminate" diameter="32"/></div>
        } @else if (!payroll().length) {
          <div class="empty-state">
            <div class="empty-icon">💰</div>
            <div class="empty-title">No payroll data</div>
            <div class="empty-sub">No staff with salary configured for {{ monthLabel() }}.</div>
          </div>
        } @else {
          <div class="table-container">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Employee</th><th>Role</th><th>Gross</th>
                  <th>LWP Days</th><th>Deduction</th><th>Net Pay</th><th>Bank</th>
                </tr>
              </thead>
              <tbody>
                @for (p of payroll(); track p.staff_id) {
                  <tr class="data-row">
                    <td>
                      <div class="emp-cell">
                        <div class="emp-av" [style.background]="getColor(p.first_name)">
                          {{ p.first_name[0] }}{{ p.last_name[0] }}
                        </div>
                        <div>
                          <div class="cell-primary">{{ p.first_name }} {{ p.last_name }}</div>
                          <div class="cell-secondary">{{ p.employee_no || p.email }}</div>
                        </div>
                      </div>
                    </td>
                    <td><span class="role-chip">{{ ROLE_LABELS[p.role] || p.role }}</span></td>
                    <td class="amt">₹{{ p.gross_salary | number:'1.0-0' }}</td>
                    <td>
                      @if (p.lwp_days > 0) {
                        <span class="lwp-badge">{{ p.lwp_days }}d</span>
                      } @else { <span class="text-muted">—</span> }
                    </td>
                    <td>
                      @if (+p.gross_salary - +p.net_salary > 0) {
                        <span class="deduction">-₹{{ (+p.gross_salary - +p.net_salary) | number:'1.0-0' }}</span>
                      } @else { <span class="text-muted">—</span> }
                    </td>
                    <td><span class="net-pay">₹{{ p.net_salary | number:'1.0-0' }}</span></td>
                    <td class="text-sm text-muted">
                      @if (p.bank_account) { ****{{ p.bank_account.slice(-4) }} }
                      @else { — }
                    </td>
                  </tr>
                }
              </tbody>
              <tfoot>
                <tr class="total-row">
                  <td colspan="2" class="total-label">Total</td>
                  <td class="amt">₹{{ totalGross() | number:'1.0-0' }}</td>
                  <td></td>
                  <td class="deduction">-₹{{ totalDeductions() | number:'1.0-0' }}</td>
                  <td><span class="net-pay">₹{{ totalNet() | number:'1.0-0' }}</span></td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
        }

      } @else {
        <!-- ── Staff: my salary slip ─────────────────────────── -->
        <div class="page-header">
          <div>
            <h1>My Payslip</h1>
            <div class="subtitle">{{ monthLabel() }}</div>
          </div>
          <div class="period-nav-inline">
            <button class="period-nav" (click)="prevMonth()">
              <mat-icon style="font-size:18px;width:18px;height:18px">chevron_left</mat-icon>
            </button>
            <span class="period-label-sm">{{ monthLabel() }}</span>
            <button class="period-nav" (click)="nextMonth()" [disabled]="isCurrentMonth()">
              <mat-icon style="font-size:18px;width:18px;height:18px">chevron_right</mat-icon>
            </button>
          </div>
        </div>

        @if (loading()) {
          <div class="loading-state"><mat-progress-spinner mode="indeterminate" diameter="28"/></div>
        } @else if (!mySlip()) {
          <div class="empty-state">
            <div class="empty-icon">💰</div>
            <div class="empty-title">No payslip found</div>
            <div class="empty-sub">Your salary details haven't been configured yet. Contact your admin.</div>
          </div>
        } @else {
          <div class="slip-container">

            <!-- Slip header -->
            <div class="slip-header">
              <div class="slip-school">
                <div class="slip-school-name">Montessori360</div>
                <div class="slip-school-sub">Payslip for {{ monthLabel() }}</div>
              </div>
              <div class="slip-emp">
                <div class="slip-emp-av" [style.background]="getColor(mySlip()!.first_name)">
                  {{ mySlip()!.first_name[0] }}{{ mySlip()!.last_name[0] }}
                </div>
                <div>
                  <div class="slip-emp-name">{{ mySlip()!.first_name }} {{ mySlip()!.last_name }}</div>
                  <div class="slip-emp-role">{{ ROLE_LABELS[mySlip()!.role] || mySlip()!.role }}</div>
                  @if (mySlip()!.employee_no) {
                    <div class="slip-emp-no">{{ mySlip()!.employee_no }}</div>
                  }
                </div>
              </div>
            </div>

            <!-- Earning / Deduction split -->
            <div class="slip-body">

              <div class="slip-section">
                <div class="ss-title">Earnings</div>
                <table class="slip-table">
                  <tbody>
                    <tr>
                      <td class="sl-lbl">Basic Salary</td>
                      <td class="sl-amt">₹{{ mySlip()!.gross_salary | number:'1.2-2' }}</td>
                    </tr>
                    <tr class="sl-total-row">
                      <td class="sl-lbl fw">Gross Earnings</td>
                      <td class="sl-amt fw green">₹{{ mySlip()!.gross_salary | number:'1.2-2' }}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div class="slip-divider"></div>

              <div class="slip-section">
                <div class="ss-title">Deductions</div>
                <table class="slip-table">
                  <tbody>
                    @if (mySlip()!.lwp_days > 0) {
                      <tr>
                        <td class="sl-lbl">
                          LWP Deduction
                          <span class="sl-note">({{ mySlip()!.lwp_days }} days @ ₹{{ perDayRate() | number:'1.0-0' }}/day)</span>
                        </td>
                        <td class="sl-amt red">-₹{{ lwpDeduction() | number:'1.2-2' }}</td>
                      </tr>
                    } @else {
                      <tr>
                        <td class="sl-lbl" style="color:var(--text-4)">No deductions this month</td>
                        <td class="sl-amt" style="color:var(--text-4)">₹0.00</td>
                      </tr>
                    }
                    <tr class="sl-total-row">
                      <td class="sl-lbl fw">Total Deductions</td>
                      <td class="sl-amt fw red">-₹{{ lwpDeduction() | number:'1.2-2' }}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

            </div>

            <!-- Net pay footer -->
            <div class="slip-footer">
              <div class="net-label">Net Pay</div>
              <div class="net-amount">₹{{ mySlip()!.net_salary | number:'1.2-2' }}</div>
            </div>

            <!-- Bank & working days info -->
            <div class="slip-info">
              <div class="si-item">
                <div class="si-lbl">Working Days</div>
                <div class="si-val">{{ mySlip()!.working_days }}</div>
              </div>
              <div class="si-item">
                <div class="si-lbl">LWP Days</div>
                <div class="si-val" [style.color]="mySlip()!.lwp_days > 0 ? 'var(--red)' : 'var(--text-3)'">
                  {{ mySlip()!.lwp_days }}
                </div>
              </div>
              @if (mySlip()!.bank_account) {
                <div class="si-item">
                  <div class="si-lbl">Bank Account</div>
                  <div class="si-val">****{{ mySlip()!.bank_account.slice(-4) }}</div>
                </div>
                <div class="si-item">
                  <div class="si-lbl">IFSC</div>
                  <div class="si-val">{{ mySlip()!.bank_ifsc || '—' }}</div>
                </div>
              }
              @if (mySlip()!.pan_no) {
                <div class="si-item">
                  <div class="si-lbl">PAN</div>
                  <div class="si-val">{{ mySlip()!.pan_no }}</div>
                </div>
              }
            </div>

            <div class="slip-note">
              This is a computer-generated payslip and does not require a signature.
            </div>

          </div>
        }
      }
    </div>
  `,
  styles: [`
    .payroll-page { padding: 16px; display: flex; flex-direction: column; gap: 14px; }

    .btn-outline-custom {
      display: inline-flex; align-items: center; gap: 6px;
      background: var(--surface); color: var(--text-2); border: 1px solid var(--border);
      border-radius: 8px; padding: 0 14px; height: 36px;
      font-size: 13px; font-weight: 500; cursor: pointer;
      &:hover:not(:disabled) { background: var(--bg); }
      &:disabled { opacity: .5; cursor: not-allowed; }
    }

    /* Period bar */
    .period-bar { display: flex; align-items: center; gap: 10px; }
    .period-nav-inline { display: flex; align-items: center; gap: 6px; }
    .period-nav {
      width: 32px; height: 32px; border-radius: 7px;
      background: var(--surface); border: 1px solid var(--border);
      display: flex; align-items: center; justify-content: center;
      cursor: pointer; color: var(--text-2);
      &:hover:not(:disabled) { background: var(--bg); }
      &:disabled { opacity: .4; cursor: not-allowed; }
    }
    .period-label    { font-size: 15px; font-weight: 600; color: var(--text); min-width: 140px; text-align: center; }
    .period-label-sm { font-size: 13px; font-weight: 600; color: var(--text); min-width: 120px; text-align: center; }
    .filter-select { height: 32px; padding: 0 10px; margin-left: auto; background: var(--surface); border: 1px solid var(--border); border-radius: 7px; font-size: 12.5px; color: var(--text-2); outline: none; cursor: pointer; }

    /* Summary cards */
    .summary-row { display: grid; grid-template-columns: repeat(4,1fr); gap: 10px; }
    .sum-card { display: flex; align-items: center; gap: 12px; background: var(--surface); border: 1px solid var(--border); border-radius: 10px; padding: 12px 14px; }
    .sum-icon { width: 34px; height: 34px; border-radius: 8px; flex-shrink: 0; display: flex; align-items: center; justify-content: center; }
    .sum-icon.blue   { background: var(--blue-light);   color: var(--blue);   }
    .sum-icon.green  { background: var(--green-light);  color: var(--green);  }
    .sum-icon.red    { background: var(--red-light);    color: var(--red);    }
    .sum-icon.purple { background: var(--purple-light); color: var(--purple); }
    .sum-val { font-size: 17px; font-weight: 700; color: var(--text); }
    .sum-lbl { font-size: 11px; color: var(--text-3); margin-top: 1px; }

    /* Admin table */
    .table-container { background: var(--surface); border: 1px solid var(--border); border-radius: 10px; overflow: hidden; }
    .data-table {
      width: 100%; border-collapse: collapse;
      th { text-align: left; padding: 10px 14px; font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: .4px; color: var(--text-4); background: var(--bg); border-bottom: 1px solid var(--border); }
      td { padding: 10px 14px; border-bottom: 1px solid var(--border-light); vertical-align: middle; }
      tfoot td { border-top: 2px solid var(--border); border-bottom: none; background: var(--bg); }
    }
    .data-row { &:last-child td { border-bottom: none; } }
    .total-row { }
    .total-label { font-size: 12px; font-weight: 700; color: var(--text); }
    .emp-cell { display: flex; align-items: center; gap: 10px; }
    .emp-av { width: 30px; height: 30px; border-radius: 7px; flex-shrink: 0; color: #fff; font-size: 10px; font-weight: 700; display: flex; align-items: center; justify-content: center; }
    .cell-primary   { font-size: 12.5px; font-weight: 500; color: var(--text); }
    .cell-secondary { font-size: 11px; color: var(--text-3); }
    .text-sm   { font-size: 12px; color: var(--text-2); }
    .text-muted { color: var(--text-3); }
    .amt       { font-size: 12.5px; color: var(--text-2); font-variant-numeric: tabular-nums; }
    .role-chip { font-size: 11px; font-weight: 500; padding: 2px 7px; border-radius: 5px; background: var(--bg); color: var(--text-2); }
    .lwp-badge { font-size: 11px; font-weight: 600; padding: 2px 7px; border-radius: 5px; background: var(--red-light); color: #991B1B; }
    .deduction { font-size: 12.5px; color: var(--red); font-weight: 500; }
    .net-pay   { font-size: 13px; font-weight: 700; color: var(--green); }

    /* Salary slip */
    .slip-container {
      background: var(--surface); border: 1px solid var(--border);
      border-radius: 12px; overflow: hidden; max-width: 640px;
    }

    .slip-header {
      display: flex; justify-content: space-between; align-items: center;
      padding: 18px 24px; background: var(--blue); color: #fff;
    }
    .slip-school-name { font-size: 16px; font-weight: 700; }
    .slip-school-sub  { font-size: 11px; opacity: .75; margin-top: 3px; }
    .slip-emp { display: flex; align-items: center; gap: 12px; }
    .slip-emp-av {
      width: 42px; height: 42px; border-radius: 10px; flex-shrink: 0;
      color: #fff; font-size: 14px; font-weight: 700;
      display: flex; align-items: center; justify-content: center;
      border: 2px solid rgba(255,255,255,.3);
    }
    .slip-emp-name { font-size: 14px; font-weight: 600; text-align: right; }
    .slip-emp-role { font-size: 11px; opacity: .75; text-align: right; }
    .slip-emp-no   { font-size: 10px; opacity: .6; text-align: right; font-family: monospace; }

    .slip-body { display: grid; grid-template-columns: 1fr auto 1fr; padding: 18px 24px; gap: 0; }
    .slip-section { display: flex; flex-direction: column; gap: 10px; }
    .ss-title { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .5px; color: var(--text-4); margin-bottom: 4px; }
    .slip-divider { width: 1px; background: var(--border); margin: 0 20px; }

    .slip-table { width: 100%; border-collapse: collapse; }
    .slip-table tr { border-bottom: 1px solid var(--border-light); }
    .slip-table tr:last-child { border-bottom: none; }
    .sl-lbl { font-size: 12.5px; color: var(--text-2); padding: 7px 0; }
    .sl-amt { font-size: 12.5px; color: var(--text-2); padding: 7px 0; text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
    .sl-note { font-size: 10px; color: var(--text-4); display: block; margin-top: 2px; }
    .sl-total-row { background: var(--bg); }
    .sl-total-row .sl-lbl,
    .sl-total-row .sl-amt { padding: 8px 6px; }
    .fw   { font-weight: 700; color: var(--text) !important; }
    .green { color: var(--green) !important; }
    .red   { color: var(--red) !important; }

    .slip-footer {
      display: flex; justify-content: space-between; align-items: center;
      padding: 14px 24px; background: var(--bg);
      border-top: 2px solid var(--border);
    }
    .net-label  { font-size: 14px; font-weight: 600; color: var(--text); }
    .net-amount { font-size: 22px; font-weight: 700; color: var(--green); }

    .slip-info {
      display: flex; gap: 0; border-top: 1px solid var(--border);
      flex-wrap: wrap;
    }
    .si-item {
      flex: 1; min-width: 100px; padding: 10px 14px;
      border-right: 1px solid var(--border-light);
      &:last-child { border-right: none; }
    }
    .si-lbl { font-size: 10px; color: var(--text-4); text-transform: uppercase; letter-spacing: .3px; margin-bottom: 3px; }
    .si-val { font-size: 13px; font-weight: 600; color: var(--text); }

    .slip-note {
      padding: 10px 24px; font-size: 11px; color: var(--text-4);
      text-align: center; border-top: 1px solid var(--border-light);
      background: var(--bg); font-style: italic;
    }

    /* Shared */
    .loading-state { display: flex; align-items: center; gap: 12px; justify-content: center; padding: 60px; }
    .empty-state { display: flex; flex-direction: column; align-items: center; gap: 10px; padding: 60px; color: var(--text-3); .empty-icon { font-size: 40px; } .empty-title { font-size: 15px; font-weight: 600; color: var(--text-2); } .empty-sub { font-size: 13px; text-align: center; max-width: 320px; } }
  `],
})
export class StaffPayrollComponent implements OnInit {
  private api   = inject(ApiService);
  private snack = inject(MatSnackBar);
  private auth  = inject(AuthService);

  ROLE_LABELS = ROLE_LABELS;
  payroll     = signal<any[]>([]);
  mySlip      = signal<any | null>(null);
  loading     = signal(true);
  roleFilter  = '';

  now          = new Date();
  currentMonth = signal(this.now.getMonth() + 1);
  currentYear  = signal(this.now.getFullYear());

  isAdmin = () => ['owner', 'principal'].includes(this.auth.user()?.role ?? '');

  totalGross      = computed(() => this.payroll().reduce((s, p) => s + (+p.gross_salary || 0), 0));
  totalNet        = computed(() => this.payroll().reduce((s, p) => s + (+p.net_salary || 0), 0));
  totalDeductions = computed(() => this.totalGross() - this.totalNet());

  perDayRate = computed(() => {
    const s = this.mySlip();
    if (!s || !s.working_days) return 0;
    return +s.gross_salary / +s.working_days;
  });
  lwpDeduction = computed(() => {
    const s = this.mySlip(); if (!s) return 0;
    return +s.gross_salary - +s.net_salary;
  });

  monthLabel = computed(() => {
    return new Date(this.currentYear(), this.currentMonth() - 1, 1)
      .toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
  });
  isCurrentMonth = computed(() =>
    this.currentMonth() === this.now.getMonth() + 1 &&
    this.currentYear() === this.now.getFullYear()
  );

  ngOnInit() {
    this.isAdmin() ? this.loadPayroll() : this.loadMySlip();
  }

  loadPayroll() {
    this.loading.set(true);
    const params: Record<string, string> = { month: String(this.currentMonth()), year: String(this.currentYear()) };
    if (this.roleFilter) params['role'] = this.roleFilter;
    this.api.get<any>('/staff/payroll/report', params).subscribe({
      next: (res: any) => { this.payroll.set(res.data ?? []); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  loadMySlip() {
    this.loading.set(true);
    this.api.get<any>('/staff/payroll/my-slip', {
      month: String(this.currentMonth()), year: String(this.currentYear()),
    }).subscribe({
      next: (res: any) => { this.mySlip.set(res.data); this.loading.set(false); },
      error: () => { this.mySlip.set(null); this.loading.set(false); },
    });
  }

  prevMonth() {
    if (this.currentMonth() === 1) { this.currentMonth.set(12); this.currentYear.update(y => y - 1); }
    else this.currentMonth.update(m => m - 1);
    this.isAdmin() ? this.loadPayroll() : this.loadMySlip();
  }

  nextMonth() {
    if (this.isCurrentMonth()) return;
    if (this.currentMonth() === 12) { this.currentMonth.set(1); this.currentYear.update(y => y + 1); }
    else this.currentMonth.update(m => m + 1);
    this.isAdmin() ? this.loadPayroll() : this.loadMySlip();
  }

  exportCsv() {
    const rows = [['Employee No','Name','Role','Department','Gross Salary','LWP Days','Net Pay','Bank','IFSC','PAN']];
    this.payroll().forEach(p => rows.push([
      p.employee_no, p.first_name + ' ' + p.last_name, ROLE_LABELS[p.role] || p.role,
      p.department, String(p.gross_salary), String(p.lwp_days), String(p.net_salary),
      p.bank_account ?? '', p.bank_ifsc ?? '', p.pan_no ?? '',
    ]));
    rows.push(['','TOTAL','','',String(this.totalGross()),'',String(this.totalNet()),'','','']);
    const csv = rows.map(r => r.map(v => '"' + String(v).replace(/"/g,'""') + '"').join(',')).join('\n');
    const a   = document.createElement('a');
    a.href    = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = 'payroll-' + this.currentYear() + '-' + String(this.currentMonth()).padStart(2,'0') + '.csv';
    a.click(); URL.revokeObjectURL(a.href);
  }

  getColor(name: string): string {
    const colors = ['#2563EB','#7C3AED','#DB2777','#D97706','#059669','#0891B2'];
    return colors[(name?.charCodeAt(0) || 0) % colors.length];
  }
}
