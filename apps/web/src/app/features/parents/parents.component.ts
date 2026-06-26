import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { MatTabsModule } from '@angular/material/tabs';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatMenuModule } from '@angular/material/menu';
import { MatDividerModule } from '@angular/material/divider';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { FormsModule } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { ApiService } from '../../core/services/api.service';
import { ParentFormDialogComponent } from '../students/parent-form-dialog.component';

interface SchoolClass { id: string; name: string; }

interface ParentInGroup {
  parent_record_id:     string;
  first_name:           string;
  last_name:            string;
  relation:             string;
  mobile:               string | null;
  email:                string | null;
  is_primary:           boolean;
  is_emergency_contact: boolean;
  portal_status:        'none' | 'active' | 'inactive';
  portal_account_id:    string | null;
}

interface StudentGroup {
  student_id:   string;
  first_name:   string;
  last_name:    string;
  student_name: string;
  class_name:   string | null;
  parents:      ParentInGroup[];
}

interface PortalAccount {
  id:         string;
  email:      string;
  first_name: string;
  last_name:  string;
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
    DatePipe,
  ],
  template: `
    <div class="page-wrap">

      <div class="page-header">
        <div>
          <div class="page-title">Parents</div>
          <div class="page-sub">{{ totalParents() }} parents across {{ studentGroups().length }} students · {{ portalAccounts().length }} with portal access</div>
        </div>
      </div>

      <mat-tab-group class="parents-tabs" [selectedIndex]="selectedTab()" (selectedTabChange)="onTabChange($event.index)">

        <!-- ── Directory ────────────────────────────────────────── -->
        <mat-tab label="Directory">
          <div class="tab-body">

            <div class="filter-bar">
              <div class="search-box">
                <mat-icon class="sb-icon">search</mat-icon>
                <input placeholder="Search student or parent name…"
                       [(ngModel)]="dirSearch"
                       (ngModelChange)="onDirSearch()" />
                @if (dirSearch) {
                  <button class="sb-clear" (click)="dirSearch = ''; loadDirectory()">
                    <mat-icon style="font-size:14px;width:14px;height:14px">close</mat-icon>
                  </button>
                }
              </div>
              <select class="filter-select" [(ngModel)]="classFilter" (ngModelChange)="loadDirectory()">
                <option value="">All Classes</option>
                @for (c of classes(); track c.id) {
                  <option [value]="c.id">{{ c.name }}</option>
                }
              </select>
            </div>

            @if (dirLoading()) {
              <div class="loading-state">
                <mat-progress-spinner mode="indeterminate" diameter="32" />
                <span>Loading…</span>
              </div>
            } @else if (!studentGroups().length) {
              <div class="empty-state">
                <div class="empty-icon">👨‍👩‍👧</div>
                <div class="empty-title">No students found</div>
                <div class="empty-sub">Enrol students and add parents via the Students page.</div>
              </div>
            } @else {
              <div class="groups-list">
                @for (sg of studentGroups(); track sg.student_id) {
                  <div class="student-card">
                    <div class="sc-split">

                      <!-- LEFT: student identity -->
                      <div class="sc-left">
                        <div class="sc-identity">
                          <div class="sc-av" [style.background]="avatarColor(sg.student_name)">
                            {{ sg.first_name[0] }}{{ sg.last_name[0] }}
                          </div>
                          <div>
                            <div class="sc-name">{{ sg.student_name }}</div>
                            @if (sg.class_name) {
                              <div class="sc-class">
                                <mat-icon style="font-size:11px;width:11px;height:11px">class</mat-icon>
                                {{ sg.class_name }}
                              </div>
                            } @else {
                              <div class="sc-class muted">No class</div>
                            }
                          </div>
                        </div>
                        @if (sg.parents.length < 3) {
                          <button class="add-parent-btn" (click)="openAddParent(sg)">
                            <mat-icon style="font-size:13px;width:13px;height:13px">add</mat-icon>
                            Add Parent
                          </button>
                        }
                      </div>

                      <!-- RIGHT: parents -->
                      <div class="sc-right">
                        @if (!sg.parents.length) {
                          <div class="no-parents-row">
                            <mat-icon style="font-size:14px;width:14px;height:14px;color:var(--text-4)">person_off</mat-icon>
                            No parents added yet —
                            <button class="add-parent-inline" (click)="openAddParent(sg)">Add now</button>
                          </div>
                        } @else {
                          @for (p of sg.parents; track p.parent_record_id) {
                            <div class="parent-row" [class.not-first]="!$first">
                              <div class="pr-av" [style.background]="avatarColor(p.first_name + p.last_name)">
                                {{ p.first_name[0] }}{{ p.last_name[0] }}
                              </div>
                              <div class="pr-info">
                                <div class="pr-name">
                                  {{ p.first_name }} {{ p.last_name }}
                                  <span class="relation-tag">{{ relationLabel(p.relation) }}</span>
                                </div>
                                <div class="pr-contact">
                                  @if (p.mobile) {
                                    <span class="contact-item">
                                      <mat-icon style="font-size:11px;width:11px;height:11px">phone</mat-icon>
                                      {{ p.mobile }}
                                    </span>
                                  }
                                  @if (p.email) {
                                    <span class="contact-item">
                                      <mat-icon style="font-size:11px;width:11px;height:11px">email</mat-icon>
                                      {{ p.email }}
                                    </span>
                                  }
                                </div>
                              </div>
                              <div class="pr-badges">
                                @if (p.is_primary) {
                                  <span class="badge primary">Primary</span>
                                }
                                <span [class]="'badge portal-' + p.portal_status">
                                  {{ portalLabel(p.portal_status) }}
                                </span>
                              </div>
                              <div class="pr-actions">
                                <button class="row-menu-btn" [matMenuTriggerFor]="parentMenu">
                                  <mat-icon style="font-size:17px;width:17px;height:17px">more_horiz</mat-icon>
                                </button>
                                <mat-menu #parentMenu="matMenu">
                                  <button mat-menu-item (click)="editParent(sg, p)">
                                    <mat-icon>edit</mat-icon> Edit
                                  </button>
                                  <mat-divider />
                                  @if (p.email) {
                                    @if (p.portal_status === 'none') {
                                      <button mat-menu-item (click)="inviteParent(sg, p)">
                                        <mat-icon>send</mat-icon> Send Portal Invite
                                      </button>
                                    } @else {
                                      <button mat-menu-item (click)="resendInvite(p.portal_account_id!, p.first_name + ' ' + p.last_name)">
                                        <mat-icon>forward_to_inbox</mat-icon> Resend Invite
                                      </button>
                                      <button mat-menu-item (click)="toggleAccount(p.portal_account_id!, p.portal_status === 'active')">
                                        <mat-icon>{{ p.portal_status === 'active' ? 'block' : 'check_circle' }}</mat-icon>
                                        {{ p.portal_status === 'active' ? 'Deactivate' : 'Activate' }} Portal
                                      </button>
                                      <button mat-menu-item class="danger-item" (click)="deletePortalAccount(p.portal_account_id!, sg, p)">
                                        <mat-icon>no_accounts</mat-icon> Delete Portal Account
                                      </button>
                                    }
                                    <mat-divider />
                                  }
                                  <button mat-menu-item class="danger-item" (click)="deleteParent(sg, p)">
                                    <mat-icon>delete</mat-icon> Remove Parent
                                  </button>
                                </mat-menu>
                              </div>
                            </div>
                          }
                        }
                      </div>

                    </div>
                  </div>
                }
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
              <div class="pa-list">
                @for (pa of portalAccounts(); track pa.id) {
                  <div class="pa-card">

                    <!-- LEFT: parent identity -->
                    <div class="pa-left">
                      <div class="pa-av" [style.background]="avatarColor(pa.first_name + pa.last_name)">
                        {{ pa.first_name[0] }}{{ pa.last_name[0] }}
                      </div>
                      <div>
                        <div class="pa-name">{{ pa.first_name }} {{ pa.last_name }}</div>
                        <div class="pa-since">Since {{ pa.created_at | date:'d MMM yyyy' }}</div>
                      </div>
                    </div>

                    <!-- RIGHT: details -->
                    <div class="pa-right">
                      <div class="pa-detail-block">
                        <div class="pa-detail-label">Login</div>
                        <div class="pa-email">{{ pa.email }}</div>
                      </div>
                      <div class="pa-detail-block">
                        <div class="pa-detail-label">Status</div>
                        <span [class]="pa.is_active ? 'badge portal-active' : 'badge portal-inactive'">
                          {{ pa.is_active ? 'Active' : 'Inactive' }}
                        </span>
                      </div>
                      <div class="pa-detail-block pa-children">
                        <div class="pa-detail-label">Linked Children</div>
                        <div class="children-cell">
                          @for (s of (pa.students ?? []); track s.id) {
                            <div class="child-chip">
                              <span class="child-name">{{ s.name }}</span>
                              @if (s.class) { <span class="child-class">{{ s.class }}</span> }
                            </div>
                          }
                          @if (!(pa.students ?? []).length) { <span class="text-muted">—</span> }
                        </div>
                      </div>
                    </div>

                    <!-- actions -->
                    <div class="pa-actions">
                      <button class="row-menu-btn" [matMenuTriggerFor]="portalMenu">
                        <mat-icon style="font-size:18px;width:18px;height:18px">more_horiz</mat-icon>
                      </button>
                      <mat-menu #portalMenu="matMenu">
                        <button mat-menu-item (click)="resendInvite(pa.id, pa.first_name + ' ' + pa.last_name)">
                          <mat-icon>forward_to_inbox</mat-icon> Resend Invite / Get Link
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
                    </div>

                  </div>
                }
              </div>
            }
          </div>
        </mat-tab>

      </mat-tab-group>
    </div>

    <!-- Invite link overlay -->
    @if (inviteLink()) {
      <div class="invite-overlay" (click)="inviteLink.set(null)">
        <div class="invite-dialog" (click)="$event.stopPropagation()">
          <div class="invite-icon">
            <mat-icon style="font-size:32px;width:32px;height:32px;color:#2563EB">link</mat-icon>
          </div>
          <div class="invite-title">Invite link ready</div>
          <div class="invite-sub">Share with <strong>{{ inviteParentName() }}</strong>. Expires in 72 hours.</div>
          <div class="invite-link-box">
            <span class="invite-link-text">{{ inviteLink() }}</span>
          </div>
          <div class="invite-actions">
            <button class="invite-btn copy" (click)="copyInviteLink()">
              <mat-icon style="font-size:14px;width:14px;height:14px">content_copy</mat-icon> Copy Link
            </button>
            <button class="invite-btn close" (click)="inviteLink.set(null)">Done</button>
          </div>
        </div>
      </div>
    }
  `,
  styles: [`
    ::ng-deep .parents-tabs .mat-mdc-tab-body-wrapper { padding: 0; }

    .page-wrap   { padding: 24px; max-width: 1200px; margin: 0 auto; }
    .page-header { margin-bottom: 20px; }
    .page-title  { font-size: 22px; font-weight: 700; color: var(--text); }
    .page-sub    { font-size: 13px; color: var(--text-3); margin-top: 2px; }
    .tab-body    { padding-top: 16px; }

    /* filter bar */
    .filter-bar  { display:flex; gap:8px; align-items:center; margin-bottom:14px; flex-wrap:wrap; }
    .search-box  { display:flex; align-items:center; gap:6px; background:var(--surface); border:1px solid var(--border); border-radius:8px; padding:6px 10px; flex:1; min-width:220px; max-width:360px; &:focus-within { border-color:var(--blue); } }
    .sb-icon     { font-size:16px; width:16px; height:16px; color:var(--text-3); flex-shrink:0; }
    .search-box input { border:none; outline:none; background:transparent; font-size:13px; color:var(--text); flex:1; }
    .sb-clear    { background:none; border:none; cursor:pointer; color:var(--text-3); display:flex; align-items:center; }
    .filter-select { border:1px solid var(--border); border-radius:8px; padding:6px 10px; font-size:13px; color:var(--text); background:var(--surface); cursor:pointer; outline:none; height:34px; }
    .stats-chip  { font-size:12px; color:var(--text-3); white-space:nowrap; }
    .stat-active   { color:#059669; font-weight:600; }
    .stat-inactive { color:var(--text-3); }

    /* states */
    .loading-state { display:flex; align-items:center; gap:12px; padding:48px 0; justify-content:center; color:var(--text-3); font-size:14px; }
    .empty-state   { text-align:center; padding:64px 0; }
    .empty-icon    { font-size:40px; margin-bottom:12px; }
    .empty-title   { font-size:16px; font-weight:600; color:var(--text); margin-bottom:4px; }
    .empty-sub     { font-size:13px; color:var(--text-3); }

    /* ── Directory: student cards ── */
    .groups-list  { display:flex; flex-direction:column; gap:10px; }
    .student-card { background:var(--surface); border:1px solid var(--border); border-radius:12px; overflow:hidden; }

    .sc-split     { display:flex; min-height:72px; }

    /* Left panel — student identity */
    .sc-left {
      width: 240px;
      flex-shrink: 0;
      padding: 14px 16px;
      border-right: 1px solid var(--border);
      background: var(--bg);
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      gap: 10px;
    }
    .sc-identity  { display:flex; align-items:center; gap:10px; }
    .sc-av        { width:38px; height:38px; border-radius:10px; flex-shrink:0; display:flex; align-items:center; justify-content:center; font-size:13px; font-weight:700; color:#fff; }
    .sc-name      { font-size:13.5px; font-weight:700; color:var(--text); line-height:1.3; }
    .sc-class     { display:flex; align-items:center; gap:3px; font-size:11px; color:var(--text-3); margin-top:2px; &.muted { color:var(--text-4); } }
    .add-parent-btn {
      display:flex; align-items:center; gap:4px;
      background:transparent; border:1px dashed var(--border);
      border-radius:6px; padding:5px 10px;
      font-size:11.5px; color:var(--blue); cursor:pointer; font-weight:500;
      &:hover { background:var(--blue-light); border-color:var(--blue); border-style:solid; }
    }

    /* Right panel — parents */
    .sc-right     { flex:1; min-width:0; display:flex; flex-direction:column; }
    .no-parents-row { display:flex; align-items:center; gap:6px; padding:0 16px; height:100%; min-height:60px; font-size:12.5px; color:var(--text-4); }
    .add-parent-inline { background:none; border:none; color:var(--blue); font-size:12.5px; cursor:pointer; font-weight:500; padding:0; text-decoration:underline; }

    .parent-row { display:flex; align-items:center; gap:12px; padding:12px 16px; &.not-first { border-top:1px solid var(--border-light); } &:hover { background:#FAFAFA; } }
    .pr-av      { width:32px; height:32px; border-radius:8px; flex-shrink:0; display:flex; align-items:center; justify-content:center; font-size:11px; font-weight:700; color:#fff; }
    .pr-info    { flex:1; min-width:0; }
    .pr-name    { font-size:13px; font-weight:600; color:var(--text); display:flex; align-items:center; gap:6px; flex-wrap:wrap; }
    .relation-tag { font-size:10px; font-weight:500; background:var(--bg); color:var(--text-3); padding:1px 7px; border-radius:4px; border:1px solid var(--border-light); }
    .pr-contact { display:flex; align-items:center; gap:12px; margin-top:3px; flex-wrap:wrap; }
    .contact-item { display:flex; align-items:center; gap:3px; font-size:11.5px; color:var(--text-3); }
    .pr-badges  { display:flex; align-items:center; gap:5px; flex-wrap:wrap; flex-shrink:0; }
    .pr-actions { flex-shrink:0; }

    /* badges */
    .badge { display:inline-flex; align-items:center; gap:3px; font-size:10px; font-weight:600; padding:2px 8px; border-radius:4px; white-space:nowrap; }
    .primary      { background:#EFF6FF; color:#1D4ED8; border:1px solid #BFDBFE; }
    .portal-none     { background:#F1F5F9; color:#64748B; }
    .portal-active   { background:#DCFCE7; color:#166534; }
    .portal-inactive { background:#FEF9C3; color:#854D0E; }

    /* ── Portal Accounts: cards ── */
    .pa-list { display:flex; flex-direction:column; gap:8px; }
    .pa-card {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 12px;
      display: flex;
      align-items: center;
      overflow: hidden;
    }

    /* Left panel — parent identity */
    .pa-left {
      width: 240px;
      flex-shrink: 0;
      padding: 14px 16px;
      border-right: 1px solid var(--border);
      background: var(--bg);
      display: flex;
      align-items: center;
      gap: 10px;
      align-self: stretch;
    }
    .pa-av    { width:38px; height:38px; border-radius:10px; flex-shrink:0; display:flex; align-items:center; justify-content:center; font-size:13px; font-weight:700; color:#fff; }
    .pa-name  { font-size:13.5px; font-weight:700; color:var(--text); }
    .pa-since { font-size:11px; color:var(--text-3); margin-top:2px; }

    /* Right panel — details */
    .pa-right {
      flex: 1;
      min-width: 0;
      padding: 14px 16px;
      display: flex;
      align-items: center;
      gap: 32px;
      flex-wrap: wrap;
    }
    .pa-detail-block { display:flex; flex-direction:column; gap:3px; min-width:120px; }
    .pa-children     { flex:1; min-width:160px; }
    .pa-detail-label { font-size:10px; font-weight:600; color:var(--text-3); text-transform:uppercase; letter-spacing:.05em; }
    .pa-email        { font-size:12.5px; color:var(--text); }

    .children-cell { display:flex; flex-direction:column; gap:3px; }
    .child-chip    { display:flex; align-items:center; gap:5px; }
    .child-name    { font-size:12px; font-weight:600; color:var(--text); }
    .child-class   { font-size:11px; color:var(--text-3); background:var(--bg); padding:1px 6px; border-radius:4px; }
    .text-muted    { color:var(--text-3); font-size:12px; }

    /* actions */
    .pa-actions { flex-shrink:0; padding:0 12px; }
    .row-menu-btn { background:none; border:1px solid transparent; border-radius:6px; cursor:pointer; color:var(--text-3); display:flex; align-items:center; padding:4px; &:hover { background:var(--bg); border-color:var(--border); } }
    ::ng-deep .danger-item { color:#DC2626 !important; }
    ::ng-deep .danger-item mat-icon { color:#DC2626 !important; }

    /* invite overlay */
    .invite-overlay { position:fixed; inset:0; background:rgba(0,0,0,.5); display:flex; align-items:center; justify-content:center; z-index:9999; }
    .invite-dialog  { background:#fff; border-radius:16px; padding:32px 28px; width:100%; max-width:440px; display:flex; flex-direction:column; align-items:center; gap:10px; box-shadow:0 20px 60px rgba(0,0,0,.2); }
    .invite-icon    { margin-bottom:4px; }
    .invite-title   { font-size:17px; font-weight:700; color:var(--text); }
    .invite-sub     { font-size:13px; color:var(--text-3); text-align:center; line-height:1.5; }
    .invite-link-box { width:100%; background:var(--bg); border:1.5px solid var(--border); border-radius:8px; padding:10px 12px; word-break:break-all; margin:4px 0; }
    .invite-link-text { font-size:11px; color:var(--text-3); font-family:monospace; }
    .invite-actions   { display:flex; gap:10px; margin-top:8px; width:100%; }
    .invite-btn { flex:1; padding:10px; border:none; border-radius:8px; font-size:13px; font-weight:600; cursor:pointer; display:flex; align-items:center; justify-content:center; gap:6px; &.copy { background:#2563EB; color:#fff; &:hover { background:#1D4ED8; } } &.close { background:var(--bg); color:var(--text); border:1px solid var(--border); &:hover { background:var(--border); } } }
  `],
})
export class ParentsComponent implements OnInit {
  private api    = inject(ApiService);
  private snack  = inject(MatSnackBar);
  private dialog = inject(MatDialog);

  studentGroups   = signal<StudentGroup[]>([]);
  portalAccounts  = signal<PortalAccount[]>([]);
  classes         = signal<SchoolClass[]>([]);
  dirLoading      = signal(true);
  portalLoading   = signal(false);
  selectedTab     = signal(0);
  inviteLink      = signal<string | null>(null);
  inviteParentName = signal('');

  dirSearch          = '';
  portalSearch       = '';
  portalStatusFilter = '';
  classFilter        = '';

  private dirTimer:    any;
  private portalTimer: any;

  totalParents = computed(() =>
    this.studentGroups().reduce((sum, sg) => sum + sg.parents.length, 0)
  );
  activeCount   = computed(() => this.portalAccounts().filter(p => p.is_active).length);
  inactiveCount = computed(() => this.portalAccounts().filter(p => !p.is_active).length);

  ngOnInit(): void {
    this.api.get<any>('/students/classes').subscribe({
      next: (res: any) => this.classes.set(res.data ?? []),
      error: () => {},
    });
    this.loadDirectory();
  }

  onTabChange(idx: number): void {
    this.selectedTab.set(idx);
    if (idx === 1 && !this.portalAccounts().length) this.loadPortalAccounts();
  }

  loadDirectory(): void {
    this.dirLoading.set(true);
    const params: any = {};
    if (this.dirSearch)   params['search']   = this.dirSearch;
    if (this.classFilter) params['class_id'] = this.classFilter;
    this.api.get<any>('/students/parents-grouped', params).subscribe({
      next: (res: any) => { this.studentGroups.set(res.data ?? []); this.dirLoading.set(false); },
      error: () => this.dirLoading.set(false),
    });
  }

  loadPortalAccounts(): void {
    this.portalLoading.set(true);
    const params: any = {};
    if (this.portalSearch)       params['search'] = this.portalSearch;
    if (this.portalStatusFilter) params['status'] = this.portalStatusFilter;
    this.api.get<any>('/students/portal-accounts', params).subscribe({
      next: (res: any) => { this.portalAccounts.set(res.data ?? []); this.portalLoading.set(false); },
      error: () => this.portalLoading.set(false),
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

  openAddParent(sg: StudentGroup): void {
    const ref = this.dialog.open(ParentFormDialogComponent, {
      data: { studentId: sg.student_id, studentName: sg.student_name, parent: null },
      width: '620px', disableClose: true, maxHeight: '90vh',
    });
    ref.afterClosed().subscribe((result: any) => { if (result) this.loadDirectory(); });
  }

  editParent(sg: StudentGroup, p: ParentInGroup): void {
    this.api.get<any>(`/students/${sg.student_id}/parents`).subscribe({
      next: (res: any) => {
        const record = (res.data ?? []).find((r: any) => r.id === p.parent_record_id);
        if (!record) return;
        const ref = this.dialog.open(ParentFormDialogComponent, {
          data: { studentId: sg.student_id, studentName: sg.student_name, parent: record },
          width: '620px', disableClose: true, maxHeight: '90vh',
        });
        ref.afterClosed().subscribe((saved: any) => {
          if (saved) { this.snack.open('Parent updated', 'OK', { duration: 2500 }); this.loadDirectory(); }
        });
      },
    });
  }

  inviteParent(sg: StudentGroup, p: ParentInGroup): void {
    this.api.post<any>(`/students/all-parents/${p.parent_record_id}/invite`, {}).subscribe({
      next: (res: any) => {
        const token = res.data?.inviteToken;
        if (token) {
          this.inviteLink.set(`${window.location.origin}/parent/set-password?token=${token}`);
          this.inviteParentName.set(`${p.first_name} ${p.last_name}`);
        }
        this.snack.open(`Invite sent to ${p.email}`, 'OK', { duration: 3000 });
        this.loadDirectory();
      },
      error: (err: any) => this.snack.open(err.error?.error?.message ?? 'Failed to send invite', 'OK', { duration: 3000 }),
    });
  }

  resendInvite(accountId: string, parentName?: string): void {
    this.api.post<any>(`/students/portal-accounts/${accountId}/resend`, {}).subscribe({
      next: (res: any) => {
        const token = res.data?.inviteToken;
        if (token) {
          this.inviteLink.set(`${window.location.origin}/parent/set-password?token=${token}`);
          this.inviteParentName.set(parentName ?? '');
        }
        this.snack.open('Invite email resent', 'OK', { duration: 3000 });
      },
      error: (err: any) => this.snack.open(err.error?.error?.message ?? 'Failed to resend', 'OK', { duration: 3000 }),
    });
  }

  copyInviteLink(): void {
    const link = this.inviteLink();
    if (!link) return;
    navigator.clipboard.writeText(link).then(() =>
      this.snack.open('Link copied!', 'OK', { duration: 2000 })
    );
  }

  deleteParent(sg: StudentGroup, p: ParentInGroup): void {
    const name = `${p.first_name} ${p.last_name}`;
    if (!confirm(`Remove ${name} as a parent of ${sg.student_name}?\n\nThis cannot be undone.`)) return;
    this.api.delete<any>(`/students/${sg.student_id}/parents/${p.parent_record_id}`).subscribe({
      next: () => { this.snack.open(`${name} removed`, 'OK', { duration: 3000 }); this.loadDirectory(); },
      error: (err: any) => this.snack.open(err.error?.error?.message ?? 'Delete failed', 'OK', { duration: 3000 }),
    });
  }

  deletePortalAccount(accountId: string, sg?: StudentGroup, p?: ParentInGroup): void {
    const name = p ? `${p.first_name} ${p.last_name}` : 'this parent';
    if (!confirm(`Delete portal account for ${name}?\n\nThey will lose all login access. The parent record stays.\n\nThis cannot be undone.`)) return;
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
    return status === 'active' ? 'Portal Active' : status === 'inactive' ? 'Portal Inactive' : 'No Portal';
  }

  relationLabel(rel: string): string {
    const map: Record<string, string> = {
      father: 'Father', mother: 'Mother', guardian: 'Guardian',
      step_father: 'Step-father', step_mother: 'Step-mother', other: 'Other',
    };
    return map[rel] ?? rel;
  }

  avatarColor(name: string): string {
    const colors = ['#7C3AED','#2563EB','#059669','#D97706','#DC2626','#DB2777','#0891B2','#65A30D'];
    let hash = 0;
    for (const ch of name) hash = ch.charCodeAt(0) + ((hash << 5) - hash);
    return colors[Math.abs(hash) % colors.length];
  }
}
