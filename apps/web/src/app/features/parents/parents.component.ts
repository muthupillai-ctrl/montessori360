import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { MatTabsModule } from '@angular/material/tabs';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatMenuModule } from '@angular/material/menu';
import { MatDividerModule } from '@angular/material/divider';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/services/api.service';
import { ParentFormDialogComponent } from '../students/parent-form-dialog.component';

interface StudentOption {
  id:         string;
  first_name: string;
  last_name:  string;
  class_name: string | null;
}

interface ParentRow {
  group_key:         string;
  parent_record_id:  string;
  first_name:        string;
  last_name:         string;
  email:             string | null;
  mobile:            string | null;
  is_primary:        boolean;
  portal_status:     'none' | 'active' | 'inactive';
  portal_account_id: string | null;
  students: { id: string; name: string; class: string; relation: string }[];
}

interface PortalAccount {
  id:         string;
  email:      string;
  first_name: string;
  last_name:  string;
  phone:      string;
  is_active:  boolean;
  created_at: string;
  students:   { id: string; name: string; class: string }[] | null;
}

@Component({
  selector: 'app-parents',
  standalone: true,
  imports: [
    MatTabsModule, MatIconModule, MatProgressSpinnerModule,
    MatMenuModule, MatDividerModule, MatDialogModule, FormsModule,
  ],
  template: `
    <div class="page-wrap">

      <div class="page-header">
        <div>
          <div class="page-title">Parents</div>
          <div class="page-sub">{{ allParents().length }} parents · {{ portalAccounts().length }} with portal access</div>
        </div>
      </div>

      <mat-tab-group class="parents-tabs" [selectedIndex]="selectedTab()" (selectedTabChange)="onTabChange($event.index)">

        <!-- ── Directory ────────────────────────────────────────── -->
        <mat-tab label="Directory">
          <div class="tab-body">

            <div class="filter-bar">
              <div class="search-box">
                <mat-icon class="sb-icon">search</mat-icon>
                <input placeholder="Search by name or email…"
                       [(ngModel)]="dirSearch"
                       (ngModelChange)="onDirSearch()" />
                @if (dirSearch) {
                  <button class="sb-clear" (click)="dirSearch = ''; loadDirectory()">
                    <mat-icon style="font-size:14px;width:14px;height:14px">close</mat-icon>
                  </button>
                }
              </div>
              <select class="filter-select" [(ngModel)]="portalFilter" (ngModelChange)="applyPortalFilter()">
                <option value="">All Status</option>
                <option value="none">No Portal Account</option>
                <option value="active">Portal Active</option>
                <option value="inactive">Portal Inactive</option>
              </select>
              <button class="btn-primary" (click)="showPicker = !showPicker">
                <mat-icon style="font-size:15px;width:15px;height:15px">add</mat-icon>
                Add Parent
              </button>
            </div>

            <!-- Student picker panel -->
            @if (showPicker) {
              <div class="picker-panel">
                <div class="picker-header">
                  <span class="picker-title">Select a student to add parent for</span>
                  <button class="sb-clear" (click)="showPicker = false; pickerSearch = ''">
                    <mat-icon style="font-size:16px;width:16px;height:16px">close</mat-icon>
                  </button>
                </div>
                <div class="picker-search">
                  <mat-icon class="sb-icon">search</mat-icon>
                  <input #pickerInput placeholder="Type student name…"
                         [(ngModel)]="pickerSearch"
                         (ngModelChange)="onPickerSearch()"
                         autofocus />
                </div>
                @if (pickerLoading()) {
                  <div class="picker-loading">
                    <mat-progress-spinner mode="indeterminate" diameter="20" />
                    <span>Searching…</span>
                  </div>
                } @else if (studentOptions().length) {
                  <div class="picker-list">
                    @for (s of studentOptions(); track s.id) {
                      <button class="picker-item" (click)="openAddParent(s)">
                        <div class="picker-av" [style.background]="avatarColor(s.first_name + s.last_name)">
                          {{ s.first_name[0] }}
                        </div>
                        <div>
                          <div class="picker-name">{{ s.first_name }} {{ s.last_name }}</div>
                          @if (s.class_name) {
                            <div class="picker-class">{{ s.class_name }}</div>
                          }
                        </div>
                      </button>
                    }
                  </div>
                } @else if (pickerSearch.length >= 2) {
                  <div class="picker-empty">No students found</div>
                } @else {
                  <div class="picker-empty">Type at least 2 characters to search</div>
                }
              </div>
            }

            @if (dirLoading()) {
              <div class="loading-state">
                <mat-progress-spinner mode="indeterminate" diameter="32" />
                <span>Loading parents…</span>
              </div>
            } @else if (!filteredParents().length) {
              <div class="empty-state">
                <div class="empty-icon">👨‍👩‍👧</div>
                <div class="empty-title">No parents found</div>
                <div class="empty-sub">Click "Add Parent" to add a parent to a student.</div>
              </div>
            } @else {
              <div class="table-container">
                <table class="data-table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Contact</th>
                      <th>Children</th>
                      <th>Portal</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (p of filteredParents(); track p.group_key) {
                      <tr class="data-row">
                        <td>
                          <div class="person-cell">
                            <div class="avatar" [style.background]="avatarColor(p.first_name + p.last_name)">
                              {{ p.first_name[0] }}{{ p.last_name[0] }}
                            </div>
                            <div>
                              <div class="cell-primary">{{ p.first_name }} {{ p.last_name }}</div>
                              @if (p.is_primary) {
                                <span class="primary-badge">Primary</span>
                              }
                            </div>
                          </div>
                        </td>
                        <td>
                          <div class="contact-cell">
                            @if (p.email) {
                              <div class="contact-row">
                                <mat-icon class="contact-icon">email</mat-icon>
                                <span>{{ p.email }}</span>
                              </div>
                            }
                            @if (p.mobile) {
                              <div class="contact-row">
                                <mat-icon class="contact-icon">phone</mat-icon>
                                <span>{{ p.mobile }}</span>
                              </div>
                            }
                          </div>
                        </td>
                        <td>
                          <div class="children-cell">
                            @for (s of p.students; track s.id) {
                              <div class="child-chip">
                                <span class="child-name">{{ s.name }}</span>
                                @if (s.class) { <span class="child-class">{{ s.class }}</span> }
                                <span class="relation-tag">{{ relationLabel(s.relation) }}</span>
                              </div>
                            }
                          </div>
                        </td>
                        <td>
                          <span [class]="'portal-badge portal-' + p.portal_status">
                            {{ portalLabel(p.portal_status) }}
                          </span>
                        </td>
                        <td>
                          <button class="row-menu-btn" [matMenuTriggerFor]="dirMenu">
                            <mat-icon style="font-size:18px;width:18px;height:18px">more_horiz</mat-icon>
                          </button>
                          <mat-menu #dirMenu="matMenu">
                            <button mat-menu-item (click)="editParent(p)">
                              <mat-icon>edit</mat-icon> Edit
                            </button>
                            <mat-divider />
                            @if (p.email) {
                              @if (p.portal_status === 'none') {
                                <button mat-menu-item (click)="inviteParent(p)">
                                  <mat-icon>send</mat-icon> Send Portal Invite
                                </button>
                              } @else {
                                <button mat-menu-item (click)="resendInvite(p.portal_account_id!)">
                                  <mat-icon>forward_to_inbox</mat-icon> Resend Invite
                                </button>
                                <button mat-menu-item (click)="toggleAccount(p.portal_account_id!, p.portal_status === 'active')">
                                  <mat-icon>{{ p.portal_status === 'active' ? 'block' : 'check_circle' }}</mat-icon>
                                  {{ p.portal_status === 'active' ? 'Deactivate' : 'Activate' }} Portal
                                </button>
                                <button mat-menu-item class="danger-item" (click)="deletePortalAccount(p.portal_account_id!, p)">
                                  <mat-icon>no_accounts</mat-icon> Delete Portal Account
                                </button>
                              }
                              <mat-divider />
                            }
                            <button mat-menu-item class="danger-item" (click)="deleteParent(p)">
                              <mat-icon>delete</mat-icon> Delete Parent Record
                            </button>
                          </mat-menu>
                        </td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
            }

          </div>
        </mat-tab>

        <!-- ── Portal Accounts ──────────────────────────────────── -->
        <mat-tab label="Portal Accounts">
          <div class="tab-body">

            <div class="filter-bar">
              <div class="search-box">
                <mat-icon class="sb-icon">search</mat-icon>
                <input placeholder="Search by name or email…"
                       [(ngModel)]="portalSearch"
                       (ngModelChange)="onPortalSearch()" />
                @if (portalSearch) {
                  <button class="sb-clear" (click)="portalSearch = ''; loadPortalAccounts()">
                    <mat-icon style="font-size:14px;width:14px;height:14px">close</mat-icon>
                  </button>
                }
              </div>
              <select class="filter-select" [(ngModel)]="portalStatusFilter" (ngModelChange)="loadPortalAccounts()">
                <option value="">All Accounts</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
              <div class="stats-chip">
                <span class="stat-active">{{ activeCount() }} active</span>
                &nbsp;·&nbsp;
                <span class="stat-inactive">{{ inactiveCount() }} inactive</span>
              </div>
            </div>

            @if (portalLoading()) {
              <div class="loading-state">
                <mat-progress-spinner mode="indeterminate" diameter="32" />
                <span>Loading accounts…</span>
              </div>
            } @else if (!portalAccounts().length) {
              <div class="empty-state">
                <div class="empty-icon">🔐</div>
                <div class="empty-title">No portal accounts yet</div>
                <div class="empty-sub">Go to Directory and use "Send Portal Invite" to grant parents access.</div>
              </div>
            } @else {
              <div class="table-container">
                <table class="data-table">
                  <thead>
                    <tr>
                      <th>Parent</th>
                      <th>Email / Login</th>
                      <th>Linked Children</th>
                      <th>Status</th>
                      <th>Account Created</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (pa of portalAccounts(); track pa.id) {
                      <tr class="data-row">
                        <td>
                          <div class="person-cell">
                            <div class="avatar" [style.background]="avatarColor(pa.first_name + pa.last_name)">
                              {{ pa.first_name[0] }}{{ pa.last_name[0] }}
                            </div>
                            <span class="cell-primary">{{ pa.first_name }} {{ pa.last_name }}</span>
                          </div>
                        </td>
                        <td>
                          <div class="login-cell">
                            <span class="email-text">{{ pa.email }}</span>
                            <span class="login-hint">Username = email address</span>
                          </div>
                        </td>
                        <td>
                          <div class="children-cell">
                            @for (s of (pa.students ?? []); track s.id) {
                              <div class="child-chip">
                                <span class="child-name">{{ s.name }}</span>
                                @if (s.class) { <span class="child-class">{{ s.class }}</span> }
                              </div>
                            }
                            @if (!(pa.students ?? []).length) {
                              <span class="text-muted">—</span>
                            }
                          </div>
                        </td>
                        <td>
                          <span [class]="pa.is_active ? 'portal-badge portal-active' : 'portal-badge portal-inactive'">
                            {{ pa.is_active ? 'Active' : 'Inactive' }}
                          </span>
                        </td>
                        <td class="text-sm text-muted">{{ formatDate(pa.created_at) }}</td>
                        <td>
                          <button class="row-menu-btn" [matMenuTriggerFor]="portalMenu">
                            <mat-icon style="font-size:18px;width:18px;height:18px">more_horiz</mat-icon>
                          </button>
                          <mat-menu #portalMenu="matMenu">
                            <button mat-menu-item (click)="resendInvite(pa.id)">
                              <mat-icon>forward_to_inbox</mat-icon> Resend Invite Email
                            </button>
                            <mat-divider />
                            <button mat-menu-item (click)="toggleAccount(pa.id, pa.is_active)">
                              <mat-icon>{{ pa.is_active ? 'block' : 'check_circle' }}</mat-icon>
                              {{ pa.is_active ? 'Deactivate' : 'Activate' }} Account
                            </button>
                            <mat-divider />
                            <button mat-menu-item class="danger-item" (click)="deletePortalAccount(pa.id)">
                              <mat-icon>delete</mat-icon> Delete Portal Account
                            </button>
                          </mat-menu>
                        </td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
            }

          </div>
        </mat-tab>

      </mat-tab-group>
    </div>
  `,
  styles: [`
    ::ng-deep .parents-tabs .mat-mdc-tab-body-wrapper { padding: 0; }

    .page-wrap   { padding: 24px; max-width: 1200px; margin: 0 auto; }
    .page-header { margin-bottom: 20px; }
    .page-title  { font-size: 22px; font-weight: 700; color: var(--text-1); }
    .page-sub    { font-size: 13px; color: var(--text-2); margin-top: 2px; }

    .tab-body  { padding-top: 16px; }

    /* ── filter bar ── */
    .filter-bar { display: flex; gap: 8px; align-items: center; margin-bottom: 14px; flex-wrap: wrap; }
    .search-box {
      display: flex; align-items: center; gap: 6px;
      background: var(--surface); border: 1px solid var(--border);
      border-radius: 8px; padding: 6px 10px; flex: 1; min-width: 220px; max-width: 340px;
    }
    .sb-icon  { font-size: 16px; width: 16px; height: 16px; color: var(--text-2); flex-shrink: 0; }
    .search-box input { border: none; outline: none; background: transparent; font-size: 13px; color: var(--text-1); flex: 1; }
    .sb-clear { background: none; border: none; cursor: pointer; color: var(--text-2); display: flex; align-items: center; }
    .filter-select {
      border: 1px solid var(--border); border-radius: 8px;
      padding: 6px 10px; font-size: 13px; color: var(--text-1);
      background: var(--surface); cursor: pointer; outline: none;
    }
    .btn-primary {
      display: flex; align-items: center; gap: 5px;
      background: var(--blue); color: #fff; border: none; border-radius: 8px;
      height: 34px; padding: 0 14px; font-size: 13px; font-weight: 500;
      cursor: pointer; white-space: nowrap;
      &:hover { background: #1D4ED8; }
    }
    .stats-chip { font-size: 12px; color: var(--text-2); white-space: nowrap; }
    .stat-active   { color: #059669; font-weight: 600; }
    .stat-inactive { color: var(--text-2); }

    /* ── student picker ── */
    .picker-panel {
      background: var(--surface); border: 1px solid var(--border);
      border-radius: 10px; margin-bottom: 14px; overflow: hidden;
      box-shadow: 0 4px 16px rgba(0,0,0,.08);
    }
    .picker-header {
      display: flex; align-items: center; justify-content: space-between;
      padding: 10px 14px; border-bottom: 1px solid var(--border);
    }
    .picker-title { font-size: 13px; font-weight: 600; color: var(--text-1); }
    .picker-search {
      display: flex; align-items: center; gap: 8px;
      padding: 8px 14px; border-bottom: 1px solid var(--border);
    }
    .picker-search input {
      border: none; outline: none; background: transparent;
      font-size: 13px; color: var(--text-1); flex: 1;
    }
    .picker-loading {
      display: flex; align-items: center; gap: 10px;
      padding: 16px 14px; font-size: 13px; color: var(--text-2);
    }
    .picker-list { max-height: 260px; overflow-y: auto; }
    .picker-item {
      display: flex; align-items: center; gap: 10px;
      width: 100%; padding: 9px 14px; background: none; border: none;
      text-align: left; cursor: pointer; border-bottom: 1px solid var(--border-light);
      &:last-child { border-bottom: none; }
      &:hover { background: var(--bg); }
    }
    .picker-av {
      width: 30px; height: 30px; border-radius: 50%; flex-shrink: 0;
      display: flex; align-items: center; justify-content: center;
      font-size: 12px; font-weight: 700; color: #fff;
    }
    .picker-name  { font-size: 13px; font-weight: 600; color: var(--text-1); }
    .picker-class { font-size: 11px; color: var(--text-2); }
    .picker-empty { padding: 16px 14px; font-size: 13px; color: var(--text-2); text-align: center; }

    /* ── states ── */
    .loading-state {
      display: flex; align-items: center; gap: 12px; padding: 48px 0;
      justify-content: center; color: var(--text-2); font-size: 14px;
    }
    .empty-state  { text-align: center; padding: 64px 0; }
    .empty-icon   { font-size: 40px; margin-bottom: 12px; }
    .empty-title  { font-size: 16px; font-weight: 600; color: var(--text-1); margin-bottom: 4px; }
    .empty-sub    { font-size: 13px; color: var(--text-2); }

    /* ── table ── */
    .table-container { border: 1px solid var(--border); border-radius: 10px; overflow: hidden; }
    .data-table  { width: 100%; border-collapse: collapse; }
    .data-table th {
      background: var(--bg); font-size: 11px; font-weight: 600; color: var(--text-2);
      text-transform: uppercase; letter-spacing: .05em;
      padding: 10px 14px; text-align: left; border-bottom: 1px solid var(--border);
    }
    .data-table td { padding: 12px 14px; border-bottom: 1px solid var(--border); vertical-align: top; }
    .data-row:last-child td { border-bottom: none; }
    .data-row:hover td { background: var(--bg); }

    /* ── cells ── */
    .person-cell  { display: flex; align-items: center; gap: 10px; }
    .avatar {
      width: 34px; height: 34px; border-radius: 50%; flex-shrink: 0;
      display: flex; align-items: center; justify-content: center;
      font-size: 12px; font-weight: 700; color: #fff;
    }
    .cell-primary { font-size: 13px; font-weight: 600; color: var(--text-1); }
    .primary-badge {
      display: inline-block; margin-top: 2px;
      background: #EFF6FF; color: #1D4ED8;
      font-size: 10px; font-weight: 600; padding: 1px 6px; border-radius: 4px;
    }
    .contact-cell { display: flex; flex-direction: column; gap: 3px; }
    .contact-row  { display: flex; align-items: center; gap: 5px; font-size: 12px; color: var(--text-2); }
    .contact-icon { font-size: 13px; width: 13px; height: 13px; }
    .login-cell   { display: flex; flex-direction: column; gap: 2px; }
    .email-text   { font-size: 12px; color: var(--text-1); }
    .login-hint   { font-size: 10px; color: var(--text-2); font-style: italic; }
    .children-cell { display: flex; flex-direction: column; gap: 4px; }
    .child-chip   { display: flex; align-items: center; gap: 4px; flex-wrap: wrap; }
    .child-name   { font-size: 12px; font-weight: 600; color: var(--text-1); }
    .child-class  { font-size: 11px; color: var(--text-2); background: var(--bg); padding: 1px 6px; border-radius: 4px; }
    .relation-tag { font-size: 10px; color: var(--text-2); font-style: italic; }

    .portal-badge {
      display: inline-block; font-size: 11px; font-weight: 600;
      padding: 3px 8px; border-radius: 5px; white-space: nowrap;
    }
    .portal-none     { background: #F1F5F9; color: #64748B; }
    .portal-active   { background: #DCFCE7; color: #166534; }
    .portal-inactive { background: #FEF9C3; color: #854D0E; }

    .text-sm   { font-size: 12px; }
    .text-muted { color: var(--text-2); }

    .row-menu-btn {
      background: none; border: 1px solid transparent; border-radius: 6px;
      cursor: pointer; color: var(--text-2); display: flex; align-items: center; padding: 3px;
      &:hover { background: var(--bg); border-color: var(--border); }
    }
    ::ng-deep .danger-item { color: #DC2626 !important; }
    ::ng-deep .danger-item mat-icon { color: #DC2626 !important; }
  `],
})
export class ParentsComponent implements OnInit {
  private api    = inject(ApiService);
  private snack  = inject(MatSnackBar);
  private dialog = inject(MatDialog);

  allParents     = signal<ParentRow[]>([]);
  portalAccounts = signal<PortalAccount[]>([]);
  studentOptions = signal<StudentOption[]>([]);
  dirLoading     = signal(true);
  portalLoading  = signal(false);
  pickerLoading  = signal(false);
  selectedTab    = signal(0);
  showPicker     = false;

  dirSearch          = '';
  portalSearch       = '';
  portalFilter       = '';
  portalStatusFilter = '';
  pickerSearch       = '';

  private dirTimer:    any;
  private portalTimer: any;
  private pickerTimer: any;

  filteredParents = computed(() => {
    let rows = this.allParents();
    if (this.portalFilter) rows = rows.filter(p => p.portal_status === this.portalFilter);
    return rows;
  });

  activeCount   = computed(() => this.portalAccounts().filter(p => p.is_active).length);
  inactiveCount = computed(() => this.portalAccounts().filter(p => !p.is_active).length);

  ngOnInit(): void { this.loadDirectory(); }

  onTabChange(idx: number): void {
    this.selectedTab.set(idx);
    if (idx === 1 && !this.portalAccounts().length) this.loadPortalAccounts();
  }

  loadDirectory(): void {
    this.dirLoading.set(true);
    const params: any = {};
    if (this.dirSearch) params['search'] = this.dirSearch;
    this.api.get<any>('/students/all-parents', params).subscribe({
      next: (res: any) => { this.allParents.set(res.data ?? []); this.dirLoading.set(false); },
      error: () => { this.dirLoading.set(false); },
    });
  }

  loadPortalAccounts(): void {
    this.portalLoading.set(true);
    const params: any = {};
    if (this.portalSearch)      params['search'] = this.portalSearch;
    if (this.portalStatusFilter) params['status'] = this.portalStatusFilter;
    this.api.get<any>('/students/portal-accounts', params).subscribe({
      next: (res: any) => { this.portalAccounts.set(res.data ?? []); this.portalLoading.set(false); },
      error: () => { this.portalLoading.set(false); },
    });
  }

  onDirSearch(): void {
    clearTimeout(this.dirTimer);
    this.dirTimer = setTimeout(() => this.loadDirectory(), 350);
  }

  onPortalSearch(): void {
    clearTimeout(this.portalTimer);
    this.portalTimer = setTimeout(() => this.loadPortalAccounts(), 350);
  }

  applyPortalFilter(): void { /* filteredParents computed handles this */ }

  onPickerSearch(): void {
    clearTimeout(this.pickerTimer);
    if (this.pickerSearch.length < 2) { this.studentOptions.set([]); return; }
    this.pickerTimer = setTimeout(() => {
      this.pickerLoading.set(true);
      this.api.get<any>('/students', { search: this.pickerSearch, limit: '20' }).subscribe({
        next: (res: any) => {
          this.studentOptions.set(res.data ?? []);
          this.pickerLoading.set(false);
        },
        error: () => this.pickerLoading.set(false),
      });
    }, 300);
  }

  openAddParent(student: StudentOption): void {
    this.showPicker   = false;
    this.pickerSearch = '';
    this.studentOptions.set([]);

    const ref = this.dialog.open(ParentFormDialogComponent, {
      data: {
        studentId:   student.id,
        studentName: `${student.first_name} ${student.last_name}`,
        parent:      null,
      },
      width: '620px', disableClose: true, maxHeight: '90vh',
    });
    ref.afterClosed().subscribe((result: any) => {
      if (result) this.loadDirectory();
    });
  }

  editParent(p: ParentRow): void {
    const studentId = p.students[0]?.id;
    if (!studentId) return;
    this.api.get<any>(`/students/${studentId}/parents`).subscribe({
      next: (res: any) => {
        const record = (res.data ?? []).find((r: any) => r.id === p.parent_record_id) ?? res.data?.[0];
        if (!record) return;
        const ref = this.dialog.open(ParentFormDialogComponent, {
          data: {
            studentId,
            studentName: p.students[0].name,
            parent: record,
          },
          width: '620px', disableClose: true, maxHeight: '90vh',
        });
        ref.afterClosed().subscribe((saved: any) => {
          if (saved) {
            this.snack.open('Parent updated', 'OK', { duration: 2500 });
            this.loadDirectory();
          }
        });
      },
    });
  }

  inviteParent(p: ParentRow): void {
    this.api.post<any>(`/students/all-parents/${p.parent_record_id}/invite`, {}).subscribe({
      next: () => {
        this.snack.open(`Invite sent to ${p.email}`, 'OK', { duration: 3000 });
        this.loadDirectory();
      },
      error: (err: any) => this.snack.open(err.error?.error?.message ?? 'Failed to send invite', 'OK', { duration: 3000 }),
    });
  }

  resendInvite(accountId: string): void {
    this.api.post<any>(`/students/portal-accounts/${accountId}/resend`, {}).subscribe({
      next: () => this.snack.open('Invite email resent', 'OK', { duration: 3000 }),
      error: (err: any) => this.snack.open(err.error?.error?.message ?? 'Failed to resend', 'OK', { duration: 3000 }),
    });
  }

  deleteParent(p: ParentRow): void {
    const studentId = p.students[0]?.id;
    if (!studentId) return;
    const name = `${p.first_name} ${p.last_name}`;
    const portalNote = p.portal_status !== 'none'
      ? '\n\nNote: their portal account will NOT be deleted — use "Delete Portal Account" for that.'
      : '';
    if (!confirm(`Delete parent record for ${name}?${portalNote}\n\nThis cannot be undone.`)) return;
    this.api.delete<any>(`/students/${studentId}/parents/${p.parent_record_id}`).subscribe({
      next: () => {
        this.snack.open(`${name} removed`, 'OK', { duration: 3000 });
        this.loadDirectory();
      },
      error: (err: any) => this.snack.open(err.error?.error?.message ?? 'Delete failed', 'OK', { duration: 3000 }),
    });
  }

  deletePortalAccount(accountId: string, dirRow?: ParentRow): void {
    const name = dirRow ? `${dirRow.first_name} ${dirRow.last_name}` : 'this parent';
    if (!confirm(`Delete portal account for ${name}?\n\nThey will lose all login access. Their parent record in the directory will remain.\n\nThis cannot be undone.`)) return;
    this.api.delete<any>(`/students/portal-accounts/${accountId}`).subscribe({
      next: () => {
        this.snack.open('Portal account deleted', 'OK', { duration: 3000 });
        this.loadDirectory();
        if (this.selectedTab() === 1) this.loadPortalAccounts();
      },
      error: (err: any) => this.snack.open(err.error?.error?.message ?? 'Delete failed', 'OK', { duration: 3000 }),
    });
  }

  toggleAccount(accountId: string, currentlyActive: boolean): void {
    this.api.patch<any>(`/students/portal-accounts/${accountId}/toggle`, { is_active: !currentlyActive }).subscribe({
      next: () => {
        this.snack.open(currentlyActive ? 'Account deactivated' : 'Account activated', 'OK', { duration: 3000 });
        this.loadDirectory();
        if (this.selectedTab() === 1) this.loadPortalAccounts();
      },
      error: (err: any) => this.snack.open(err.error?.error?.message ?? 'Error', 'OK', { duration: 3000 }),
    });
  }

  portalLabel(status: string): string {
    return status === 'active' ? 'Active' : status === 'inactive' ? 'Inactive' : 'No Account';
  }

  relationLabel(rel: string): string {
    const map: Record<string, string> = {
      father: 'Father', mother: 'Mother', guardian: 'Guardian',
      step_father: 'Step-father', step_mother: 'Step-mother', other: 'Other',
    };
    return map[rel] ?? rel;
  }

  formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  avatarColor(name: string): string {
    const colors = ['#7C3AED','#2563EB','#059669','#D97706','#DC2626','#DB2777','#0891B2','#65A30D'];
    let hash = 0;
    for (const ch of name) hash = ch.charCodeAt(0) + ((hash << 5) - hash);
    return colors[Math.abs(hash) % colors.length];
  }
}
