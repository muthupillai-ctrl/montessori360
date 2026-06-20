import { Component, inject, signal, computed, OnInit, ElementRef, Renderer2 } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive, Router, NavigationEnd } from '@angular/router';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { filter } from 'rxjs';
import { MatMenuModule } from '@angular/material/menu';
import { MatDividerModule } from '@angular/material/divider';
import { AuthService } from '../../../core/services/auth.service';
import { RoleService } from '../../../core/services/role.service';
import { ApiService } from '../../../core/services/api.service';

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, MatMenuModule, MatDividerModule, DatePipe, FormsModule],
  template: `
    <div class="shell-layout">

      <!-- ── Sidebar ─────────────────────────────────────────── -->
      <aside class="sidebar" [attr.data-role]="roles.role()">

        <!-- Brand -->
        <div class="sb-brand">
          <div class="sb-logo">M</div>
          <div>
            <div class="sb-name">Montessori360</div>
            <div class="sb-sub">School Portal</div>
          </div>
        </div>

        <!-- Role identity pill -->
        <button class="sb-role-pill" [matMenuTriggerFor]="sidebarUserMenu" aria-label="User menu">
          <div class="sb-role-av">{{ userInitials() }}</div>
          <div class="sb-role-text">
            <div class="sb-role-name">{{ auth.user()?.name ?? '' }}</div>
            <div class="sb-role-tag">
              <span class="sb-role-dot"></span>
              {{ roles.roleLabel() }}
            </div>
          </div>
          <i class="ti ti-chevron-down sb-role-chevron" aria-hidden="true"></i>
        </button>
        <mat-menu #sidebarUserMenu="matMenu">
          <button mat-menu-item (click)="auth.logout()" style="color:#f87171">
            <i class="ti ti-logout" style="margin-right:8px;font-size:16px;color:#f87171"></i> Sign out
          </button>
        </mat-menu>

        <!-- Nav -->
        <nav class="sb-nav" aria-label="Main navigation">
          @for (group of roles.navGroups(); track group.label) {
            <div class="sb-group-label">{{ group.label }}</div>
            @for (item of group.items; track item.route) {
              <a class="sb-item"
                 [routerLink]="item.route"
                 routerLinkActive="active"
                 [attr.aria-label]="item.label">
                <i class="ti ti-{{ item.icon }} sb-icon" aria-hidden="true"></i>
                <span class="sb-label">{{ item.label }}</span>
                @if (item.badgeKey === 'unread' && msgUnread() > 0) {
                  <span class="sb-badge">{{ msgUnread() }}</span>
                }
              </a>
            }
          }
        </nav>

      </aside>

      <!-- ── Main ──────────────────────────────────────────────── -->
      <div class="main-area">

        <!-- Topbar -->
        <header class="topbar">
          <span class="tb-page">{{ currentTitle() }}</span>
          <div class="tb-right">

            <!-- Quick search / filter dropdown -->
            <button class="tb-search-btn" [matMenuTriggerFor]="searchMenu" aria-label="Search">
              <i class="ti ti-search"></i>
              <span>Search</span>
              <i class="ti ti-chevron-down tb-search-caret"></i>
            </button>

            <mat-menu #searchMenu="matMenu" class="search-menu">

              <!-- Student name search -->
              <div class="sm-search-row" (click)="$event.stopPropagation()">
                <i class="ti ti-user-search sm-search-icon"></i>
                <input #studentSearch
                       class="sm-search-input"
                       type="text"
                       placeholder="Search student name…"
                       [(ngModel)]="studentQuery"
                       (keydown.enter)="runStudentSearch(); studentSearch.blur()" />
                @if (studentQuery) {
                  <button class="sm-search-go" (click)="runStudentSearch()">
                    <i class="ti ti-arrow-right"></i>
                  </button>
                }
              </div>

              <mat-divider />

              <div class="sm-section-label">Quick links</div>

              <button mat-menu-item class="sm-item" (click)="quickNav('/fees', {status:'overdue'})">
                <span class="sm-dot sm-red"></span>
                <i class="ti ti-receipt"></i>
                Fee Overdue
              </button>

              <button mat-menu-item class="sm-item" (click)="quickNav('/transport', {})">
                <span class="sm-dot sm-blue"></span>
                <i class="ti ti-bus"></i>
                Transport
              </button>

              <button mat-menu-item class="sm-item" (click)="quickNav('/journal', {})">
                <span class="sm-dot sm-green"></span>
                <i class="ti ti-notebook"></i>
                Journals
              </button>

              <button mat-menu-item class="sm-item" (click)="quickNav('/communication', {tab:'0'})">
                <span class="sm-dot sm-purple"></span>
                <i class="ti ti-speakerphone"></i>
                Announcements
              </button>

            </mat-menu>

            <!-- Notifications -->
            <button class="tb-icon-btn" [matMenuTriggerFor]="notifMenu" (menuOpened)="onNotifPanelOpen()" aria-label="Notifications">
              <i class="ti ti-bell" aria-hidden="true"></i>
              @if (unseenCount() > 0) {
                <span class="tb-notif-dot" aria-hidden="true"></span>
              }
            </button>
            <mat-menu #notifMenu="matMenu" class="notif-menu">
              <div class="notif-header" (click)="$event.stopPropagation()">
                <span class="notif-title">Notifications</span>
                @if (unseenCount() > 0) {
                  <span class="notif-badge">{{ unseenCount() }}</span>
                }
              </div>
              <mat-divider />

              @if (unseenCount() === 0) {
                <div class="notif-empty" (click)="$event.stopPropagation()">
                  <i class="ti ti-bell-off notif-empty-icon"></i>
                  <span>No notifications</span>
                </div>
              }

              @if (msgUnread() > 0) {
                <div class="notif-section-label" (click)="$event.stopPropagation()">Messages</div>
                <div class="notif-item notif-unseen notif-clickable" (click)="goToComm(2)">
                  <span class="notif-dot"></span>
                  <div class="notif-item-body">
                    <div class="notif-item-title">{{ msgUnread() }} unread message{{ msgUnread() > 1 ? 's' : '' }}</div>
                    <div class="notif-item-sub">Tap to open Messages</div>
                  </div>
                  <i class="ti ti-chevron-right" style="color:var(--text-4);font-size:14px;flex-shrink:0"></i>
                </div>
              }

              @if (circulars().length > 0) {
                <div class="notif-section-label" (click)="$event.stopPropagation()">Circulars — action needed</div>
                @for (c of circulars(); track c.id) {
                  <div class="notif-item notif-unseen notif-clickable" (click)="goToComm(1)">
                    <span class="notif-dot" style="background:#F59E0B"></span>
                    <div class="notif-item-body">
                      <div class="notif-item-title">{{ c.title }}</div>
                      <div class="notif-item-sub">{{ c.published_at | date:'d MMM' }} · Tap to acknowledge</div>
                    </div>
                    <i class="ti ti-chevron-right" style="color:var(--text-4);font-size:14px;flex-shrink:0"></i>
                  </div>
                }
              }

              @if (announcements().length > 0) {
                <div class="notif-section-label" (click)="$event.stopPropagation()">Announcements</div>
                @for (a of announcements(); track a.id) {
                  <div class="notif-item notif-clickable" [class.notif-unseen]="isUnseen(a)" (click)="goToComm(0)">
                    @if (isUnseen(a)) { <span class="notif-dot"></span> }
                    <div class="notif-item-body">
                      <div class="notif-item-title">{{ a.title }}</div>
                      <div class="notif-item-sub">{{ a.published_at | date:'d MMM, h:mm a' }}</div>
                    </div>
                    <i class="ti ti-chevron-right" style="color:var(--text-4);font-size:14px;flex-shrink:0"></i>
                  </div>
                }
              }
            </mat-menu>

            <!-- Role badge in topbar -->
            <div class="tb-role-badge" [attr.data-role]="roles.role()">
              {{ roles.roleLabel() }}
            </div>

            <!-- Avatar -->
            <button class="tb-avatar" [matMenuTriggerFor]="topMenu" aria-label="Account menu">
              {{ userInitials() }}
            </button>
            <mat-menu #topMenu="matMenu">
              <button mat-menu-item (click)="auth.logout()">
                <i class="ti ti-logout" style="margin-right:8px;font-size:16px"></i> Sign out
              </button>
            </mat-menu>
          </div>
        </header>

        <main class="page-area">
          <router-outlet />
        </main>
      </div>
    </div>
  `,
  styles: [`
    :host { display: block; }

    .shell-layout {
      display: flex;
      height: 100vh;
      overflow: hidden;
      background: var(--bg);
    }

    /* ── Sidebar base ── */
    .sidebar {
      width: 220px;
      background: #0F2D52;
      display: flex;
      flex-direction: column;
      flex-shrink: 0;
      overflow-y: auto;
    }

    /* ── Role-specific sidebar backgrounds ── */
    .sidebar[data-role="owner"]            { background: var(--role-principal-sidebar); }
    .sidebar[data-role="principal"]        { background: var(--role-principal-sidebar); }
    .sidebar[data-role="teacher"]          { background: var(--role-teacher-sidebar); }
    .sidebar[data-role="assistant_teacher"]{ background: var(--role-assistant_teacher-sidebar); }
    .sidebar[data-role="accountant"]       { background: var(--role-accountant-sidebar); }
    .sidebar[data-role="admission_staff"]  { background: var(--role-admission_staff-sidebar); }
    .sidebar[data-role="driver"]           { background: var(--role-driver-sidebar); }
    .sidebar[data-role="support"]          { background: var(--role-support-sidebar); }

    /* ── Brand ── */
    .sb-brand {
      padding: 16px 14px 12px;
      border-bottom: 1px solid rgba(255,255,255,.08);
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .sb-logo {
      width: 32px; height: 32px; border-radius: 8px;
      background: rgba(255,255,255,.15);
      color: #fff; font-size: 16px; font-weight: 500;
      display: flex; align-items: center; justify-content: center;
      flex-shrink: 0;
    }
    .sb-name { font-size: 13px; font-weight: 500; color: #fff; }
    .sb-sub  { font-size: 10px; color: rgba(255,255,255,.45); margin-top: 1px; }

    /* ── Role identity pill ── */
    .sb-role-pill {
      margin: 10px 10px 4px;
      background: rgba(0,0,0,.25);
      border-radius: 9px;
      padding: 9px 11px;
      display: flex;
      align-items: center;
      gap: 9px;
      border: 1px solid rgba(255,255,255,.08);
      width: calc(100% - 20px);
      cursor: pointer;
      transition: background .15s;
    }
    .sb-role-pill:hover { background: rgba(0,0,0,.38); }
    .sb-role-chevron {
      margin-left: auto;
      font-size: 14px;
      color: rgba(255,255,255,.35);
      flex-shrink: 0;
    }
    .sb-role-av {
      width: 28px; height: 28px; border-radius: 7px;
      background: rgba(255,255,255,.18);
      color: #fff; font-size: 11px; font-weight: 500;
      display: flex; align-items: center; justify-content: center;
      flex-shrink: 0;
    }
    .sb-role-text { min-width: 0; }
    .sb-role-name {
      font-size: 12px; font-weight: 500; color: #fff;
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }
    .sb-role-tag {
      font-size: 10px; color: rgba(255,255,255,.55);
      margin-top: 2px; display: flex; align-items: center; gap: 5px;
    }
    .sb-role-dot {
      width: 5px; height: 5px; border-radius: 50%;
      background: rgba(255,255,255,.4); flex-shrink: 0;
    }

    /* Role-tinted pill dot */
    .sidebar[data-role="owner"]             .sb-role-dot,
    .sidebar[data-role="principal"]         .sb-role-dot { background: #7EC8F5; }
    .sidebar[data-role="teacher"]           .sb-role-dot,
    .sidebar[data-role="assistant_teacher"] .sb-role-dot { background: #5DCAA5; }
    .sidebar[data-role="accountant"]        .sb-role-dot { background: #EF9F27; }
    .sidebar[data-role="admission_staff"]   .sb-role-dot { background: #AFA9EC; }
    .sidebar[data-role="driver"]            .sb-role-dot { background: #5DCAA5; }
    .sidebar[data-role="support"]           .sb-role-dot { background: #B4B2A9; }

    /* ── Nav ── */
    .sb-nav { flex: 1; padding: 4px 8px; }

    .sb-group-label {
      font-size: 9px; font-weight: 600;
      text-transform: uppercase; letter-spacing: .07em;
      color: rgba(255,255,255,.3);
      padding: 12px 8px 4px;
    }

    .sb-item {
      display: flex; align-items: center; gap: 9px;
      padding: 7px 8px; border-radius: 7px;
      text-decoration: none;
      color: rgba(255,255,255,.55);
      font-size: 13px; font-weight: 400;
      margin-bottom: 1px;
      transition: background .1s, color .1s;
    }
    .sb-item:hover {
      background: rgba(255,255,255,.08);
      color: rgba(255,255,255,.85);
    }

    /* Active state — role-tinted */
    .sb-item.active { color: #fff; font-weight: 500; }

    .sidebar[data-role="owner"]             .sb-item.active,
    .sidebar[data-role="principal"]         .sb-item.active { background: var(--role-principal-item-active-bg); color: var(--role-principal-item-active-text); }
    .sidebar[data-role="teacher"]           .sb-item.active { background: var(--role-teacher-item-active-bg); color: var(--role-teacher-item-active-text); }
    .sidebar[data-role="assistant_teacher"] .sb-item.active { background: var(--role-assistant_teacher-item-active-bg); color: var(--role-assistant_teacher-item-active-text); }
    .sidebar[data-role="accountant"]        .sb-item.active { background: var(--role-accountant-item-active-bg); color: var(--role-accountant-item-active-text); }
    .sidebar[data-role="admission_staff"]   .sb-item.active { background: var(--role-admission_staff-item-active-bg); color: var(--role-admission_staff-item-active-text); }
    .sidebar[data-role="driver"]            .sb-item.active { background: var(--role-driver-item-active-bg); color: var(--role-driver-item-active-text); }
    .sidebar[data-role="support"]           .sb-item.active { background: var(--role-support-item-active-bg); color: var(--role-support-item-active-text); }

    .sb-icon { font-size: 17px; flex-shrink: 0; }
    .sb-label { flex: 1; }
    .sb-badge {
      background: #E24B4A; color: #fff;
      font-size: 10px; font-weight: 500;
      padding: 1px 6px; border-radius: 20px;
    }


    /* ── Topbar ── */
    .main-area { flex: 1; display: flex; flex-direction: column; overflow: hidden; }

    .topbar {
      height: 52px;
      background: #fff;
      border-bottom: 1px solid var(--border);
      display: flex; align-items: center; justify-content: space-between;
      padding: 0 20px; flex-shrink: 0; gap: 12px;
    }
    .tb-page { font-size: 14px; font-weight: 500; color: var(--text); }
    .tb-right { display: flex; align-items: center; gap: 8px; }

    /* Search dropdown button */
    .tb-search-btn {
      display: flex; align-items: center; gap: 7px;
      height: 34px; padding: 0 13px; border-radius: 8px;
      border: 1px solid var(--border); background: var(--bg);
      font-size: 13px; font-weight: 500; color: var(--text-3);
      font-family: inherit; cursor: pointer;
      transition: border-color .15s, background .15s;
      i { font-size: 15px; }
      &:hover { background: #fff; border-color: #9CA3AF; color: var(--text-2); }
    }
    .tb-search-caret { font-size: 12px !important; opacity: .6; }

    /* Notification button */
    .tb-icon-btn {
      position: relative;
      width: 34px; height: 34px; border-radius: 8px;
      border: 1px solid var(--border);
      background: transparent; cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      color: var(--text-3); font-size: 18px;
      transition: background .1s;
    }
    .tb-icon-btn:hover { background: var(--bg); color: var(--text-2); }
    .tb-notif-dot {
      position: absolute; top: 7px; right: 7px;
      width: 7px; height: 7px; border-radius: 50%;
      background: #E24B4A;
      border: 1.5px solid #fff;
    }
    .notif-header {
      display: flex; align-items: center; gap: 8px;
      padding: 12px 16px 10px;
    }
    .notif-title { font-size: 13px; font-weight: 700; color: var(--text-1); flex: 1; }
    .notif-badge {
      font-size: 10px; font-weight: 700;
      background: #E24B4A; color: #fff;
      border-radius: 20px; padding: 1px 6px;
    }
    .notif-empty {
      display: flex; flex-direction: column; align-items: center; gap: 8px;
      padding: 24px 16px 20px; color: var(--text-4); font-size: 13px;
    }
    .notif-empty-icon { font-size: 28px; opacity: .4; }
    .notif-item {
      display: flex; align-items: flex-start; gap: 10px;
      padding: 10px 16px; cursor: default;
      border-bottom: 1px solid var(--border);
      transition: background .1s;
    }
    .notif-item:last-child { border-bottom: none; }
    .notif-unseen { background: #EFF6FF; }
    .notif-dot {
      width: 7px; height: 7px; border-radius: 50%;
      background: #3B82F6; flex-shrink: 0; margin-top: 5px;
    }
    .notif-item-body { flex: 1; min-width: 0; }
    .notif-item-title { font-size: 13px; font-weight: 500; color: var(--text-1); line-height: 1.4; }
    .notif-item-sub { font-size: 11px; color: var(--text-4); margin-top: 2px; }
    .notif-clickable { cursor: pointer; }
    .notif-clickable:hover { background: #DBEAFE; }
    .notif-section-label {
      font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: .06em;
      color: var(--text-4); padding: 8px 16px 4px;
    }

    /* Role badge in topbar */
    .tb-role-badge {
      font-size: 11px; font-weight: 500;
      padding: 3px 10px; border-radius: 20px;
      background: #E6F1FB; color: #0C447C;
    }
    .tb-role-badge[data-role="teacher"],
    .tb-role-badge[data-role="assistant_teacher"] { background: #E1F5EE; color: #085041; }
    .tb-role-badge[data-role="accountant"]        { background: #FAEEDA; color: #633806; }
    .tb-role-badge[data-role="admission_staff"]   { background: #EEEDFE; color: #26215C; }
    .tb-role-badge[data-role="driver"]            { background: #E1F5EE; color: #085041; }
    .tb-role-badge[data-role="support"]           { background: #F1EFE8; color: #2C2C2A; }

    /* Avatar */
    .tb-avatar {
      width: 32px; height: 32px; border-radius: 8px;
      background: #185FA5; color: #fff;
      font-size: 11px; font-weight: 500;
      display: flex; align-items: center; justify-content: center;
      border: none; cursor: pointer;
      transition: opacity .1s;
    }
    .tb-avatar:hover { opacity: .85; }

    .page-area { flex: 1; overflow-y: auto; padding: 22px 24px; }
  `],
})
export class ShellComponent implements OnInit {
  auth  = inject(AuthService);
  roles = inject(RoleService);
  private api    = inject(ApiService);
  private router = inject(Router);

  msgUnread      = signal(0);   // unread direct messages (sidebar badge + bell)
  announcementUnseen = signal(0); // announcements not yet seen (bell only)
  circulars      = signal<any[]>([]); // unacknowledged circulars needing action
  announcements  = signal<any[]>([]);
  studentQuery   = '';
  private lastOpenedAt: Date | null = null;

  // Bell badge = all three sources
  unseenCount = computed(() =>
    this.msgUnread() + this.announcementUnseen() + this.circulars().length
  );

  currentTitle = signal('Dashboard');
  unreadCount  = computed(() => this.msgUnread()); // sidebar messages badge

  userInitials = computed(() => {
    const name = this.auth.user()?.name ?? '';
    return name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || 'AU';
  });

  constructor() {
    this.router.events.pipe(filter(e => e instanceof NavigationEnd)).subscribe(() => {
      const url  = this.router.url;
      const all  = this.roles.navGroups().flatMap(g => g.items);
      const item = all.find(i => url.startsWith(i.route));
      if (item) this.currentTitle.set(item.label);
      // Refresh counts after every navigation so badges stay accurate
      this.loadMsgUnread();
      this.loadCirculars();
    });
  }

  ngOnInit() {
    const ts = localStorage.getItem(this.lastOpenedKey());
    this.lastOpenedAt = ts ? new Date(ts) : null;

    this.refresh();
    setInterval(() => this.refresh(), 120_000);
  }

  private refresh() {
    this.loadMsgUnread();
    this.loadAnnouncements();
    this.loadCirculars();
  }

  private loadMsgUnread() {
    this.api.get<any>('/communication/messages/unread-count').subscribe({
      next: (res: any) => this.msgUnread.set(res.data?.unread_count ?? 0),
      error: () => {},
    });
  }

  private loadAnnouncements() {
    this.api.get<any>('/communication/announcements?limit=10').subscribe({
      next: (res: any) => {
        const items: any[]     = res.data?.data ?? res.data ?? [];
        const published: any[] = items.filter((a: any) => a.published_at);
        this.announcements.set(published);
        const unseen = this.lastOpenedAt
          ? published.filter((a: any) => new Date(a.published_at) > this.lastOpenedAt!)
          : published;
        this.announcementUnseen.set(unseen.length);
      },
      error: () => {},
    });
  }

  private loadCirculars() {
    this.api.get<any>('/communication/circulars?published=true&limit=20').subscribe({
      next: (res: any) => {
        const items: any[] = res.data?.data ?? res.data ?? [];
        // Only circulars that require ack and haven't been acknowledged yet
        const pending = items.filter((c: any) => c.published_at && c.requires_ack && !c.user_acknowledged);
        this.circulars.set(pending);
      },
      error: () => {},
    });
  }

  onNotifPanelOpen() {
    // Mark announcements as seen; circulars & messages need explicit action
    const now = new Date();
    this.lastOpenedAt = now;
    localStorage.setItem(this.lastOpenedKey(), now.toISOString());
    this.announcementUnseen.set(0);
  }

  goToComm(tab: number) {
    this.router.navigate(['/communication'], { queryParams: { tab } });
  }

  isUnseen(a: any): boolean {
    if (!this.lastOpenedAt) return true;
    return new Date(a.published_at) > this.lastOpenedAt;
  }

  runStudentSearch() {
    const q = this.studentQuery.trim();
    if (!q) return;
    this.router.navigate(['/students'], { queryParams: { search: q } });
    this.studentQuery = '';
  }

  quickNav(path: string, queryParams: Record<string, string>) {
    const params = Object.keys(queryParams).length ? queryParams : undefined;
    this.router.navigate([path], { queryParams: params });
  }

  private lastOpenedKey(): string {
    return `notif_opened_${this.auth.user()?.id ?? 'anon'}`;
  }
}
