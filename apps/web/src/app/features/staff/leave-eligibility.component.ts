import { Component, inject, signal, OnInit } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/services/api.service';

interface StaffBalance {
  staff_id:     string;
  staff_name:   string;
  employee_no:  string;
  role:         string;
  academic_year: string;
  casual:       number;
  sick:         number;
  earned:       number;
  casual_used:  number;
  sick_used:    number;
  earned_used:  number;
}

@Component({
  selector: 'app-leave-eligibility',
  standalone: true,
  imports: [ MatIconModule, MatProgressSpinnerModule, FormsModule ],
  template: `
    <div class="tab-body">

      <div class="page-header">
        <div>
          <div style="font-size:15px;font-weight:600;color:var(--text)">Leave Eligibility</div>
          <div class="subtitle">Set and manage leave balance for each staff member</div>
        </div>
        <div class="header-actions">
          <select class="filter-select" [(ngModel)]="academicYear" (ngModelChange)="loadBalances()">
            @for (y of academicYears; track y) {
              <option [value]="y">{{ y }}</option>
            }
          </select>
          <button class="btn-outline-custom" (click)="initAll()" [disabled]="initialising()">
            <mat-icon style="font-size:15px;width:15px;height:15px">refresh</mat-icon>
            Initialise All
          </button>
        </div>
      </div>

      <div class="info-note">
        <mat-icon style="font-size:14px;width:14px;height:14px;color:var(--blue);flex-shrink:0">info</mat-icon>
        Click any leave count to edit it inline. Changes are saved immediately. Use "Initialise All" to create default balances for all active staff.
      </div>

      @if (loading()) {
        <div class="loading-state"><mat-progress-spinner diameter="28" mode="indeterminate"/></div>
      } @else if (!balances().length) {
        <div class="empty-state">
          <div class="empty-icon">📋</div>
          <div class="empty-title">No leave balances found</div>
          <div class="empty-sub">Click "Initialise All" to create default leave balances for all active staff for {{ academicYear }}.</div>
          <button class="btn-primary-custom" (click)="initAll()" [disabled]="initialising()">
            @if (initialising()) {
              <mat-progress-spinner diameter="16" mode="indeterminate"
                style="--mdc-circular-progress-active-indicator-color:#fff"/>
            } @else {
              <mat-icon style="font-size:15px;width:15px;height:15px">add</mat-icon>
            }
            Initialise Leave Balances
          </button>
        </div>
      } @else {
        <div class="table-container">
          <table class="data-table">
            <thead>
              <tr>
                <th>Staff Member</th>
                <th>Casual Leave</th>
                <th>Sick Leave</th>
                <th>Earned Leave</th>
                <th>Total Allocated</th>
                <th>Total Used</th>
                <th>Balance</th>
              </tr>
            </thead>
            <tbody>
              @for (b of balances(); track b.staff_id) {
                <tr class="data-row">
                  <td>
                    <div class="cell-primary">{{ b.staff_name }}</div>
                    <div class="cell-secondary">{{ b.role }} {{ b.employee_no ? '· ' + b.employee_no : '' }}</div>
                  </td>
                  @for (lt of ['casual','sick','earned']; track lt) {
                    <td>
                      <div class="leave-cell">
                        <div class="lc-alloc">
                          @if (editingKey() === b.staff_id + '_' + lt) {
                            <input class="edit-input" type="number" min="0" max="365"
                                   [(ngModel)]="editValue"
                                   (blur)="saveEdit(b, lt)"
                                   (keydown.enter)="saveEdit(b, lt)"
                                   (keydown.escape)="cancelEdit()"
                                   #editInput>
                          } @else {
                            <span class="alloc-val" (click)="startEdit(b, lt)" title="Click to edit">
                              {{ getVal(b, lt) }}
                            </span>
                          }
                          <span class="alloc-label">days</span>
                        </div>
                        <div class="lc-used">{{ getUsed(b, lt) }} used</div>
                      </div>
                    </td>
                  }
                  <td>
                    <span class="total-alloc">{{ b.casual + b.sick + b.earned }}d</span>
                  </td>
                  <td>
                    <span class="total-used">{{ b.casual_used + b.sick_used + b.earned_used }}d</span>
                  </td>
                  <td>
                    <span class="balance-val"
                          [style.color]="getBalance(b) < 5 ? 'var(--red)' : 'var(--green)'">
                      {{ getBalance(b) }}d
                    </span>
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
    .tab-body { padding: 16px; }

    .header-actions { display: flex; gap: 8px; align-items: center; }
    .filter-select {
      height: 34px; padding: 0 10px;
      background: var(--surface); border: 1px solid var(--border);
      border-radius: 8px; font-size: 13px; color: var(--text-2); outline: none; cursor: pointer;
    }
    .btn-outline-custom {
      display: inline-flex; align-items: center; gap: 5px;
      background: #fff; color: var(--text-2); border: 1px solid var(--border);
      border-radius: 8px; padding: 0 14px; height: 34px;
      font-size: 12.5px; font-weight: 500; cursor: pointer;
      &:hover:not(:disabled) { background: var(--bg); }
      &:disabled { opacity: .6; cursor: not-allowed; }
    }
    .btn-primary-custom {
      display: inline-flex; align-items: center; gap: 6px;
      background: var(--blue); color: #fff; border: none;
      border-radius: 8px; padding: 0 16px; height: 36px;
      font-size: 13px; font-weight: 500; cursor: pointer;
      &:hover:not(:disabled) { background: #1D4ED8; }
      &:disabled { opacity: .6; cursor: not-allowed; }
    }

    .info-note {
      display: flex; align-items: center; gap: 8px;
      background: var(--blue-light); border-radius: 8px;
      padding: 10px 12px; font-size: 12px; color: #1E40AF;
      margin-bottom: 14px; line-height: 1.5;
    }

    .loading-state { display: flex; justify-content: center; padding: 48px; }
    .empty-state {
      display: flex; flex-direction: column; align-items: center; gap: 10px;
      padding: 60px; color: var(--text-3);
      .empty-icon { font-size: 40px; }
      .empty-title { font-size: 15px; font-weight: 600; color: var(--text-2); }
      .empty-sub { font-size: 13px; text-align: center; max-width: 360px; }
    }

    .table-container { background: var(--surface); border: 1px solid var(--border); border-radius: 10px; overflow: hidden; }
    .data-table {
      width: 100%; border-collapse: collapse;
      th {
        text-align: left; padding: 10px 14px;
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
    .cell-primary   { font-size: 13px; font-weight: 500; color: var(--text); }
    .cell-secondary { font-size: 11px; color: var(--text-3); }

    .leave-cell { display: flex; flex-direction: column; gap: 2px; }
    .lc-alloc   { display: flex; align-items: baseline; gap: 4px; }
    .alloc-val  {
      font-size: 16px; font-weight: 700; color: var(--text);
      cursor: pointer; border-bottom: 1.5px dashed var(--border);
      padding: 0 2px;
      &:hover { color: var(--blue); border-color: var(--blue); }
    }
    .alloc-label { font-size: 11px; color: var(--text-3); }
    .lc-used     { font-size: 11px; color: var(--text-3); }

    .edit-input {
      width: 60px; height: 28px; padding: 0 6px;
      border: 2px solid var(--blue); border-radius: 6px;
      font-size: 14px; font-weight: 700; color: var(--text);
      outline: none; background: var(--blue-light);
    }

    .total-alloc { font-size: 13px; font-weight: 600; color: var(--text-2); }
    .total-used  { font-size: 13px; color: var(--text-3); }
    .balance-val { font-size: 13px; font-weight: 700; }
  `],
})
export class LeaveEligibilityComponent implements OnInit {
  private api   = inject(ApiService);
  private snack = inject(MatSnackBar);

  balances     = signal<StaffBalance[]>([]);
  loading      = signal(false);
  initialising = signal(false);
  editingKey   = signal('');
  editValue    = 0;

  now = new Date();
  academicYear = this.currentAcademicYear();
  academicYears = [
    this.currentAcademicYear(),
    this.nextAcademicYear(),
    this.prevAcademicYear(),
  ];

  ngOnInit() { this.loadBalances(); }

  currentAcademicYear(): string {
    const y = new Date().getFullYear();
    const m = new Date().getMonth() + 1;
    return m >= 6 ? `${y}-${y+1}` : `${y-1}-${y}`;
  }
  nextAcademicYear(): string {
    const parts = this.currentAcademicYear().split('-');
    return `${+parts[0]+1}-${+parts[1]+1}`;
  }
  prevAcademicYear(): string {
    const parts = this.currentAcademicYear().split('-');
    return `${+parts[0]-1}-${+parts[1]-1}`;
  }

  loadBalances() {
    this.loading.set(true);
    this.api.get<any>('/staff/leave/balances', { academic_year: this.academicYear }).subscribe({
      next: (res: any) => { this.balances.set(res.data ?? []); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  initAll() {
    this.initialising.set(true);
    this.api.post<any>('/staff/leave/balances/init', { academic_year: this.academicYear }).subscribe({
      next: (res: any) => {
        this.initialising.set(false);
        this.snack.open(res.data?.count + ' staff balances initialised', 'OK', { duration: 3000 });
        this.loadBalances();
      },
      error: (err: any) => {
        this.initialising.set(false);
        this.snack.open(err.error?.error?.message ?? 'Error', 'OK', { duration: 3000 });
      },
    });
  }

  startEdit(b: StaffBalance, lt: string) {
    this.editingKey.set(b.staff_id + '_' + lt);
    this.editValue = this.getVal(b, lt);
    // Focus input after render
    setTimeout(() => document.querySelector<HTMLInputElement>('.edit-input')?.focus(), 50);
  }

  cancelEdit() { this.editingKey.set(''); }

  saveEdit(b: StaffBalance, lt: string) {
    const key = b.staff_id + '_' + lt;
    if (this.editingKey() !== key) return;
    const val = Math.max(0, Math.min(365, this.editValue));
    this.editingKey.set('');

    this.api.put<any>('/staff/leave/balances/' + b.staff_id, {
      academic_year: this.academicYear,
      [lt]: val,
    }).subscribe({
      next: () => {
        this.balances.update(list => list.map(x =>
          x.staff_id === b.staff_id ? { ...x, [lt]: val } : x
        ));
        this.snack.open('Leave balance updated', 'OK', { duration: 2000 });
      },
      error: (err: any) => this.snack.open(err.error?.error?.message ?? 'Error', 'OK', { duration: 3000 }),
    });
  }

  getVal(b: StaffBalance, lt: string): number { return (b as any)[lt] ?? 0; }
  getUsed(b: StaffBalance, lt: string): number { return (b as any)[lt + '_used'] ?? 0; }
  getBalance(b: StaffBalance): number {
    return (b.casual - b.casual_used) + (b.sick - b.sick_used) + (b.earned - b.earned_used);
  }
}
