import { Component, inject, signal, OnInit, computed } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTabsModule } from '@angular/material/tabs';
import { MatMenuModule } from '@angular/material/menu';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/services/api.service';
import { AuthService } from '../../core/services/auth.service';
import { StaffFormDialogComponent } from './staff-form-dialog.component';
import { StaffProfileDialogComponent } from './staff-profile-dialog.component';
import { StaffLeaveComponent } from './staff-leave.component';
import { StaffPayrollComponent } from './staff-payroll.component';

export interface StaffMember {
  id:            string;
  email:         string;
  role:          string;
  first_name:    string;
  last_name:     string;
  phone:         string | null;
  dob:           string | null;
  joining_date:  string | null;
  is_active:     boolean;
  employee_no:   string | null;
  department:    string | null;
  designation:   string | null;
  salary:        number | null;
  qualifications: any[];
}

export interface LeaveRequest {
  id:           string;
  staff_id:     string;
  staff_name:   string;
  leave_type:   string;
  from_date:    string;
  to_date:      string;
  days:         number;
  reason:       string;
  status:       string;
  review_note:  string | null;
  created_at:   string;
}

const ROLE_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  owner:             { label: 'Owner',             color: '#7C3AED', bg: '#F5F3FF' },
  principal:         { label: 'Principal',          color: '#2563EB', bg: '#EFF6FF' },
  teacher:           { label: 'Teacher',            color: '#059669', bg: '#ECFDF5' },
  assistant_teacher: { label: 'Asst. Teacher',      color: '#0891B2', bg: '#ECFEFF' },
  accountant:        { label: 'Accountant',          color: '#D97706', bg: '#FFFBEB' },
  driver:            { label: 'Driver',              color: '#6B7280', bg: '#F9FAFB' },
  support:           { label: 'Support',             color: '#9CA3AF', bg: '#F9FAFB' },
};

@Component({
  selector: 'app-staff',
  standalone: true,
  imports: [
    MatIconModule, MatProgressSpinnerModule,
    MatTabsModule, MatMenuModule, MatDialogModule, FormsModule,
    DatePipe,
    StaffLeaveComponent, StaffPayrollComponent,
  ],
  template: `
    <mat-tab-group class="staff-page-tabs">

      <!-- ── Staff Directory ─────────────────────────────────── -->
      <mat-tab label="👥  Directory">
        <div class="tab-body">

          <div class="page-header">
            <div>
              <h1>Staff</h1>
              <div class="subtitle">
                {{ activeStaff().length }} active members
                @if (inactiveCount() > 0) { · {{ inactiveCount() }} inactive }
              </div>
            </div>
            @if (isAdmin()) {
              <button class="btn-primary-custom" (click)="openStaffForm()">
                <mat-icon style="font-size:16px;width:16px;height:16px">person_add</mat-icon>
                Add Staff
              </button>
            }
          </div>

          <!-- Filter bar -->
          <div class="filter-bar">
            <div class="search-box">
              <mat-icon style="font-size:16px;width:16px;height:16px;color:var(--text-3)">search</mat-icon>
              <input class="search-input" [value]="searchQuery()" (input)="searchQuery.set($any($event.target).value)" placeholder="Search by name, email, role…">
            </div>
            <select class="filter-select" [value]="roleFilter()" (change)="roleFilter.set($any($event.target).value)">
              <option value="">All Roles</option>
              <option value="principal">Principal</option>
              <option value="teacher">Teacher</option>
              <option value="assistant_teacher">Asst. Teacher</option>
              <option value="accountant">Accountant</option>
              <option value="driver">Driver</option>
              <option value="support">Support</option>
            </select>
            <select class="filter-select" [value]="statusFilter()" (change)="statusFilter.set($any($event.target).value)">
              <option value="true">Active</option>
              <option value="false">Inactive</option>
              <option value="">All</option>
            </select>
            <button class="icon-btn" (click)="loadStaff()">
              <mat-icon style="font-size:18px;width:18px;height:18px">refresh</mat-icon>
            </button>
          </div>

          <!-- Stats row -->
          <div class="stats-row">
            @for (stat of roleStats(); track stat.role) {
              <div class="stat-chip" [style.background]="stat.bg" [style.color]="stat.color"
                   [class.selected]="roleFilter() === stat.role"
                   (click)="roleFilter.set(roleFilter() === stat.role ? '' : stat.role)">
                {{ stat.label }}: {{ stat.count }}
              </div>
            }
          </div>

          @if (loading()) {
            <div class="loading-state">
              <mat-progress-spinner mode="indeterminate" diameter="32" />
              <span>Loading staff…</span>
            </div>
          } @else if (!filteredStaff().length) {
            <div class="empty-state">
              <div class="empty-icon">👥</div>
              <div class="empty-title">No staff found</div>
              <div class="empty-sub">Try adjusting filters or add a new staff member.</div>
            </div>
          } @else {
            <div class="table-container">
              <table class="data-table">
                <thead>
                  <tr>
                    <th>Staff Member</th>
                    <th>Role</th>
                    <th>Department</th>
                    <th>Phone</th>
                    <th>Joined</th>
                    <th>Status</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  @for (s of filteredStaff(); track s.id) {
                    <tr class="data-row" (click)="viewProfile(s)">
                      <td>
                        <div class="staff-cell">
                          <div class="staff-av" [style.background]="getAvatarColor(s.first_name)">
                            {{ s.first_name[0] }}{{ s.last_name[0] }}
                          </div>
                          <div>
                            <div class="cell-primary">{{ s.first_name }} {{ s.last_name }}</div>
                            <div class="cell-secondary">{{ s.email }}</div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span class="role-badge"
                              [style.background]="getRoleConfig(s.role).bg"
                              [style.color]="getRoleConfig(s.role).color">
                          {{ getRoleConfig(s.role).label }}
                        </span>
                      </td>
                      <td class="text-sm">{{ s.department || '—' }}</td>
                      <td class="text-sm">{{ s.phone || '—' }}</td>
                      <td class="text-sm">{{ s.joining_date ? (s.joining_date | date:'d MMM yyyy') : '—' }}</td>
                      <td>
                        <span [class]="s.is_active ? 'status-badge active' : 'status-badge inactive'">
                          {{ s.is_active ? 'Active' : 'Inactive' }}
                        </span>
                      </td>
                      <td (click)="$event.stopPropagation()">
                        <button class="row-menu-btn" [matMenuTriggerFor]="rowMenu">
                          <mat-icon style="font-size:18px;width:18px;height:18px">more_horiz</mat-icon>
                        </button>
                        <mat-menu #rowMenu="matMenu">
                          <button mat-menu-item (click)="viewProfile(s)">
                            <mat-icon>person</mat-icon> View Profile
                          </button>
                          @if (canManage(s.role)) {
                            <button mat-menu-item (click)="openStaffForm(s)">
                              <mat-icon>edit</mat-icon> Edit
                            </button>
                            @if (s.is_active) {
                              <button mat-menu-item (click)="deactivate(s)">
                                <mat-icon>person_off</mat-icon> Deactivate
                              </button>
                            }
                          }
                        </mat-menu>
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
              <div class="table-footer">
                <div class="tf-info">Showing {{ filteredStaff().length }} of {{ staff().length }} staff</div>
              </div>
            </div>
          }
        </div>
      </mat-tab>

      <!-- ── Leave ─────────────────────────────────────────────── -->
      <mat-tab label="🏖  Leave"><app-staff-leave /></mat-tab>

      <!-- ── Payroll ───────────────────────────────────────────── -->
      <mat-tab label="💰  Payroll">
        <div style="padding-top:0">
          @if (isAdmin()) {
            <app-staff-payroll />
          } @else {
            <div class="tab-body">
              <div class="empty-state">
                <div class="empty-icon">🔒</div>
                <div class="empty-title">Admin access required</div>
                <div class="empty-sub">Payroll is only visible to admin and principal.</div>
              </div>
            </div>
          }
        </div>
      </mat-tab>

    </mat-tab-group>
  `,
  styles: [`
    ::ng-deep .staff-page-tabs .mat-mdc-tab-body-wrapper { padding: 0; }
    .tab-body { padding-top: 16px; }

    .btn-primary-custom {
      display: inline-flex; align-items: center; gap: 6px;
      background: var(--blue); color: #fff; border: none;
      border-radius: 8px; padding: 0 16px; height: 36px;
      font-size: 13px; font-weight: 500; cursor: pointer;
      &:hover { background: #1D4ED8; }
    }
    .btn-outline-custom {
      display: inline-flex; align-items: center; gap: 6px;
      background: #fff; color: var(--text-2); border: 1px solid var(--border);
      border-radius: 8px; padding: 0 14px; height: 36px;
      font-size: 13px; font-weight: 500; cursor: pointer;
      &:hover { background: var(--bg); }
    }

    /* Filter bar */
    .filter-bar { display: flex; gap: 8px; align-items: center; margin-bottom: 12px; flex-wrap: wrap; }
    .search-box {
      display: flex; align-items: center; gap: 8px;
      background: var(--surface); border: 1px solid var(--border);
      border-radius: 8px; padding: 0 10px; height: 36px; min-width: 220px;
      &:focus-within { border-color: var(--blue); }
    }
    .search-input {
      border: none; outline: none; background: none;
      font-size: 13px; font-family: inherit; flex: 1; color: var(--text);
      &::placeholder { color: var(--text-4); }
    }
    .filter-select {
      height: 36px; padding: 0 10px;
      background: var(--surface); border: 1px solid var(--border);
      border-radius: 8px; font-size: 13px; color: var(--text-2);
      outline: none; cursor: pointer;
    }
    .icon-btn {
      width: 36px; height: 36px; border-radius: 8px;
      background: var(--surface); border: 1px solid var(--border);
      display: flex; align-items: center; justify-content: center;
      cursor: pointer; color: var(--text-3);
      &:hover { background: var(--bg); }
    }

    /* Stats chips */
    .stats-row { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 14px; }
    .stat-chip {
      font-size: 12px; font-weight: 500; padding: 4px 10px; border-radius: 20px;
      cursor: pointer; transition: all .12s; border: 1.5px solid transparent;
      &:hover  { opacity: .85; }
      &.selected { border-color: currentColor; }
    }

    /* Loading/empty */
    .loading-state {
      display: flex; align-items: center; gap: 12px; justify-content: center;
      padding: 60px; color: var(--text-3); font-size: 13px;
    }
    .empty-state {
      display: flex; flex-direction: column; align-items: center; gap: 10px;
      padding: 60px; color: var(--text-3);
      .empty-icon  { font-size: 40px; }
      .empty-title { font-size: 15px; font-weight: 600; color: var(--text-2); }
      .empty-sub   { font-size: 13px; text-align: center; }
    }

    /* Table */
    .table-container {
      background: var(--surface); border: 1px solid var(--border);
      border-radius: 10px; overflow: hidden;
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
      cursor: pointer; transition: background .1s;
      &:hover { background: #FAFAFA; }
      &:last-child td { border-bottom: none; }
    }
    .staff-cell { display: flex; align-items: center; gap: 10px; }
    .staff-av {
      width: 34px; height: 34px; border-radius: 9px; flex-shrink: 0;
      color: #fff; font-size: 12px; font-weight: 700;
      display: flex; align-items: center; justify-content: center;
    }
    .cell-primary   { font-size: 13px; font-weight: 500; color: var(--text); }
    .cell-secondary { font-size: 11px; color: var(--text-3); }
    .text-sm   { font-size: 12.5px; color: var(--text-2); }
    .text-muted { color: var(--text-3); }

    .role-badge {
      font-size: 11px; font-weight: 500; padding: 3px 8px; border-radius: 5px; white-space: nowrap;
    }
    .status-badge {
      font-size: 11px; font-weight: 600; padding: 2px 8px; border-radius: 10px;
      &.active   { background: var(--green-light); color: #065F46; }
      &.inactive { background: var(--bg); color: var(--text-3); }
    }
    .row-menu-btn {
      background: none; border: none; cursor: pointer; color: var(--text-3);
      width: 28px; height: 28px; border-radius: 5px;
      display: flex; align-items: center; justify-content: center;
      &:hover { background: var(--bg); }
    }
    .table-footer {
      padding: 8px 14px; border-top: 1px solid var(--border-light); background: var(--bg);
    }
    .tf-info { font-size: 12px; color: var(--text-3); }

    /* Leave */
    .leave-type-badge {
      font-size: 11px; font-weight: 500; padding: 2px 8px; border-radius: 5px;
      background: var(--blue-light); color: var(--blue);
    }
    .days-badge {
      font-size: 12px; font-weight: 600; color: var(--text-2);
    }
    .leave-status {
      font-size: 11px; font-weight: 600; padding: 2px 8px; border-radius: 10px;
      &.leave-pending  { background: var(--amber-light); color: #92400E; }
      &.leave-approved { background: var(--green-light);  color: #065F46; }
      &.leave-rejected { background: var(--red-light);    color: #991B1B; }
      &.leave-cancelled { background: var(--bg); color: var(--text-3); }
    }
    .leave-actions { display: flex; gap: 6px; }
    .btn-approve {
      display: inline-flex; align-items: center; gap: 4px;
      background: var(--green-light); color: #065F46; border: none;
      border-radius: 6px; padding: 0 10px; height: 28px; font-size: 11.5px; cursor: pointer;
      &:hover { background: var(--green); color: #fff; }
    }
    .btn-reject {
      display: inline-flex; align-items: center; gap: 4px;
      background: var(--red-light); color: #991B1B; border: none;
      border-radius: 6px; padding: 0 10px; height: 28px; font-size: 11.5px; cursor: pointer;
      &:hover { background: var(--red); color: #fff; }
    }

    /* Payroll */
    .payroll-summary {
      display: flex; gap: 10px; margin-bottom: 14px;
    }
    .ps-card {
      background: var(--surface); border: 1px solid var(--border);
      border-radius: 9px; padding: 14px 20px; min-width: 140px;
    }
    .ps-val { font-size: 20px; font-weight: 700; color: var(--text); }
    .ps-lbl { font-size: 11px; color: var(--text-3); margin-top: 2px; }
    .net-pay { font-size: 13px; font-weight: 600; color: var(--green); }
  `],
})
export class StaffComponent implements OnInit {
  private api    = inject(ApiService);
  private auth   = inject(AuthService);

  isOwner  = () => this.auth.user()?.role === 'owner';
  isAdmin  = () => ['owner', 'principal'].includes(this.auth.user()?.role ?? '');
  canManage = (targetRole: string) => this.isOwner() || (this.isAdmin() && !['owner','principal'].includes(targetRole));
  private dialog = inject(MatDialog);
  private snack  = inject(MatSnackBar);

  staff         = signal<StaffMember[]>([]);
  leaveRequests = signal<LeaveRequest[]>([]);
  payroll       = signal<any[]>([]);

  loading        = signal(true);
  leaveLoading   = signal(false);
  payrollLoading = signal(false);

  searchQuery  = signal('');
  roleFilter   = signal('');
  statusFilter = signal('true');
  leaveStatus  = signal('pending');
  leaveType    = '';

  now = new Date();
  payrollMonth = signal(this.now.getMonth() + 1);
  payrollYear  = signal(this.now.getFullYear());

  months = [
    { value: 1, label: 'January' }, { value: 2, label: 'February' },
    { value: 3, label: 'March' },   { value: 4, label: 'April' },
    { value: 5, label: 'May' },     { value: 6, label: 'June' },
    { value: 7, label: 'July' },    { value: 8, label: 'August' },
    { value: 9, label: 'September'},{ value: 10, label: 'October' },
    { value: 11, label: 'November'},{ value: 12, label: 'December' },
  ];
  years = [this.now.getFullYear() - 1, this.now.getFullYear()];

  activeStaff    = computed(() => this.staff().filter(s => s.is_active));
  inactiveCount  = computed(() => this.staff().filter(s => !s.is_active).length);
  totalPayroll   = computed(() => this.payroll().reduce((s, p) => s + (+p.net_pay || 0), 0));
  avgSalary      = computed(() => this.payroll().length ? this.totalPayroll() / this.payroll().length : 0);

  filteredStaff = computed(() => {
    let list = this.staff();
    if (this.statusFilter() !== '') list = list.filter(s => String(s.is_active) === this.statusFilter());
    if (this.roleFilter())          list = list.filter(s => s.role === this.roleFilter());
    const q = this.searchQuery().toLowerCase().trim();
    if (q) list = list.filter(s =>
      (s.first_name + ' ' + s.last_name).toLowerCase().includes(q) ||
      s.email.toLowerCase().includes(q) ||
      (s.designation ?? '').toLowerCase().includes(q)
    );
    return list;
  });

  roleStats = computed(() =>
    Object.entries(ROLE_CONFIG)
      .filter(([r]) => r !== 'owner')
      .map(([role, cfg]) => ({
        role,
        label: cfg.label,
        color: cfg.color,
        bg:    cfg.bg,
        count: this.staff().filter(s => s.role === role && s.is_active).length,
      }))
      .filter(r => r.count > 0)
  );

  ngOnInit() { this.loadStaff(); }

  loadStaff() {
    this.loading.set(true);
    this.api.get<any>('/staff', { limit: '100' }).subscribe({
      next: (res: any) => {
        console.log('[Staff] loaded:', res.data?.length, res.data?.[0]);
        this.staff.set(res.data ?? []);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  loadLeave() {
    this.leaveLoading.set(true);
    const params: Record<string, string> = { limit: '100' };
    if (this.leaveStatus())  params['status']     = this.leaveStatus();
    if (this.leaveType)     params['leave_type'] = this.leaveType;
    this.api.get<any>('/staff/leave/requests', params).subscribe({
      next: (res: any) => { this.leaveRequests.set(res.data ?? []); this.leaveLoading.set(false); },
      error: () => this.leaveLoading.set(false),
    });
  }

  loadPayroll() {
    this.payrollLoading.set(true);
    this.api.get<any>('/staff/payroll/report', {
      month: String(this.payrollMonth()),
      year:  String(this.payrollYear()),
    }).subscribe({
      next: (res: any) => { this.payroll.set(res.data ?? []); this.payrollLoading.set(false); },
      error: () => this.payrollLoading.set(false),
    });
  }

  applyFilters() { /* filteredStaff is computed — auto-reacts */ }

  openStaffForm(staff?: StaffMember) {
    const ref = this.dialog.open(StaffFormDialogComponent, {
  width: '95vw', maxWidth: '660px', maxHeight: '90vh', disableClose: true, data: staff ?? null,
    });
    ref.afterClosed().subscribe((result: any) => {
      if (result) {
        this.snack.open(staff ? 'Staff updated' : 'Staff member added', 'OK', { duration: 3000 });
        this.loadStaff();
      }
    });
  }

  viewProfile(s: StaffMember) {
    this.dialog.open(StaffProfileDialogComponent, {
      width: '95vw', maxWidth: '520px', maxHeight: '90vh', data: s,
    });
  }

  deactivate(s: StaffMember) {
    if (!confirm('Deactivate ' + s.first_name + ' ' + s.last_name + '? They will lose access to the system.')) return;
    this.api.delete<any>('/staff/' + s.id).subscribe({
      next: () => { this.snack.open('Staff member deactivated', 'OK', { duration: 3000 }); this.loadStaff(); },
      error: (err: any) => this.snack.open(err.error?.error?.message ?? 'Error', 'OK', { duration: 3000 }),
    });
  }

  reviewLeave(l: LeaveRequest, status: 'approved' | 'rejected') {
    const note = status === 'rejected' ? prompt('Reason for rejection (optional):') : null;
    this.api.patch<any>('/staff/leave/requests/' + l.id + '/review', { status, review_note: note }).subscribe({
      next: () => {
        this.snack.open('Leave ' + status, 'OK', { duration: 2000 });
        this.loadLeave();
      },
      error: (err: any) => this.snack.open(err.error?.error?.message ?? 'Error', 'OK', { duration: 3000 }),
    });
  }

  downloadPayroll() {
    const token = localStorage.getItem('access_token');
    const url = '/api/v1/staff/payroll/download?month=' + this.payrollMonth() + '&year=' + this.payrollYear();
    fetch(url, { headers: { Authorization: 'Bearer ' + token } })
      .then(r => r.blob()).then(blob => {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'payroll-' + this.payrollYear() + '-' + String(this.payrollMonth()).padStart(2, '0') + '.csv';
        a.click(); URL.revokeObjectURL(a.href);
      });
  }

  getRoleConfig(role: string) { return ROLE_CONFIG[role] ?? { label: role, color: '#6B7280', bg: '#F9FAFB' }; }

  getAvatarColor(name: string): string {
    const colors = ['#2563EB','#7C3AED','#DB2777','#D97706','#059669','#0891B2'];
    return colors[(name?.charCodeAt(0) || 0) % colors.length];
  }
}
