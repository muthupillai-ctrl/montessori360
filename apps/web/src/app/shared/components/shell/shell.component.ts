import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive, Router, NavigationEnd } from '@angular/router';
import { NgStyle, TitleCasePipe } from '@angular/common';
import { filter } from 'rxjs';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatMenuModule } from '@angular/material/menu';
import { MatBadgeModule } from '@angular/material/badge';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDividerModule } from '@angular/material/divider';
import { AuthService } from '../../../core/services/auth.service';
import { ApiService } from '../../../core/services/api.service';

interface NavGroup { label: string; items: NavItem[]; }
interface NavItem  { label: string; icon: string; iconBg: string; iconColor: string; route: string; badge?: number; }

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [
    RouterOutlet, RouterLink, RouterLinkActive, TitleCasePipe,
    NgStyle, MatSidenavModule, MatIconModule, MatButtonModule, MatDividerModule,
    MatMenuModule, MatBadgeModule, MatTooltipModule,
  ],
  template: `
    <div class="shell-layout">

      <!-- ── Sidebar ───────────────────────────────────────────────────── -->
      <aside class="sidebar">

        <!-- Logo -->
        <div class="sb-brand">
          <div class="sb-logo-icon">M</div>
          <div>
            <div class="sb-logo-name">Montessori360</div>
            <div class="sb-logo-sub">Admin Portal</div>
          </div>
        </div>

        <!-- School pill -->
        <div class="sb-school">
          <div class="sb-school-av">{{ schoolInitials() }}</div>
          <div>
            <div class="sb-school-name">{{ auth.user()?.name ?? 'School' }}</div>
            <div class="sb-school-role">{{ auth.userRole() | titlecase }}</div>
          </div>
        </div>

        <!-- Nav -->
        <nav class="sb-nav">
          @for (group of navGroups; track group.label) {
            <div class="sb-group-label">{{ group.label }}</div>
            @for (item of group.items; track item.route) {
              <a class="sb-item"
                 [routerLink]="item.route"
                 routerLinkActive="active"
                 [matTooltip]="item.label"
                 matTooltipPosition="right">
                <span class="sb-icon" [style.background]="'var(--icon-bg)'" [ngStyle]="{'background': isActive(item.route) ? item.iconBg.replace('0.1','0.15') : item.iconBg, 'color': item.iconColor}">
                  <mat-icon style="font-size:15px;width:15px;height:15px">{{ item.icon }}</mat-icon>
                </span>
                <span class="sb-label">{{ item.label }}</span>
                @if (item.route === '/communication' && unreadCount() > 0) {
                  <span class="sb-badge">{{ unreadCount() }}</span>
                } @else if (item.badge) {
                  <span class="sb-badge">{{ item.badge }}</span>
                }
              </a>
            }
          }
        </nav>

        <!-- Footer -->
        <div class="sb-footer">
          <button class="sb-user" [matMenuTriggerFor]="userMenu">
            <div class="sb-user-av">{{ userInitials() }}</div>
            <div class="sb-user-info">
              <div class="sb-user-name">{{ auth.user()?.name ?? 'Admin' }}</div>
              <div class="sb-user-role">{{ auth.userRole() | titlecase }}</div>
            </div>
            <mat-icon style="font-size:16px;width:16px;height:16px;color:var(--text-4);margin-left:auto">more_horiz</mat-icon>
          </button>
          <mat-menu #userMenu="matMenu">
            <button mat-menu-item>
              <mat-icon>manage_accounts</mat-icon> Profile
            </button>
            <button mat-menu-item>
              <mat-icon>settings</mat-icon> Settings
            </button>
            <mat-divider />
            <button mat-menu-item (click)="auth.logout()" style="color:#EF4444">
              <mat-icon style="color:#EF4444">logout</mat-icon> Sign Out
            </button>
          </mat-menu>
        </div>
      </aside>

      <!-- ── Main ──────────────────────────────────────────────────────── -->
      <div class="main-area">

        <!-- Topbar -->
        <header class="topbar">
          <div class="tb-left">
            <span class="tb-page">{{ currentTitle() }}</span>
          </div>
          <div class="tb-right">
            <div class="tb-search">
              <mat-icon style="font-size:15px;width:15px;height:15px;color:var(--text-4)">search</mat-icon>
              <input placeholder="Search students, fees…" />
            </div>
            <button mat-icon-button class="tb-icon-btn" matTooltip="Notifications">
              <mat-icon style="font-size:18px">notifications_none</mat-icon>
            </button>
            <div class="tb-avatar" [matMenuTriggerFor]="topUserMenu">{{ userInitials() }}</div>
            <mat-menu #topUserMenu="matMenu">
              <button mat-menu-item (click)="auth.logout()">
                <mat-icon>logout</mat-icon> Sign Out
              </button>
            </mat-menu>
          </div>
        </header>

        <!-- Page -->
        <main class="page-area">
          <router-outlet />
        </main>
      </div>
    </div>
  `,
  styles: [`
    .shell-layout { display: flex; height: 100vh; overflow: hidden; }

    /* ── Sidebar ── */
    .sidebar {
      width: var(--sidebar-w);
      background: var(--surface);
      border-right: 1px solid var(--border);
      display: flex;
      flex-direction: column;
      flex-shrink: 0;
      overflow-y: auto;
    }

    .sb-brand {
      padding: 16px 14px 12px;
      border-bottom: 1px solid var(--border-light);
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .sb-logo-icon {
      width: 32px; height: 32px; border-radius: 8px;
      background: var(--blue);
      color: #fff; font-size: 15px; font-weight: 700;
      display: flex; align-items: center; justify-content: center;
      flex-shrink: 0;
    }
    .sb-logo-name { font-size: 13px; font-weight: 600; color: var(--text); letter-spacing: -.2px; }
    .sb-logo-sub  { font-size: 10px; color: var(--text-4); margin-top: 1px; }

    .sb-school {
      margin: 10px 10px 4px;
      background: #EFF6FF;
      border-radius: 8px;
      padding: 8px 10px;
      display: flex;
      align-items: center;
      gap: 8px;
      cursor: default;
    }
    .sb-school-av   { width: 28px; height: 28px; border-radius: 7px; background: var(--blue); color: #fff; display: flex; align-items: center; justify-content: center; font-size: 10px; font-weight: 600; flex-shrink: 0; }
    .sb-school-name { font-size: 12px; font-weight: 500; color: #1E40AF; }
    .sb-school-role { font-size: 10px; color: #3B82F6; margin-top: 1px; }

    .sb-nav { flex: 1; padding: 4px 8px; }

    .sb-group-label {
      font-size: 10px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: .5px;
      color: var(--text-4);
      padding: 10px 8px 4px;
      &:first-child { padding-top: 6px; }
    }

    .sb-item {
      display: flex;
      align-items: center;
      gap: 9px;
      padding: 6px 8px;
      border-radius: 7px;
      cursor: pointer;
      text-decoration: none;
      color: var(--text-3);
      font-size: 12.5px;
      font-weight: 500;
      margin-bottom: 1px;
      transition: background .12s, color .12s;

      &:hover { background: var(--bg); color: var(--text-2); }
      &.active { background: var(--blue-light); color: var(--blue); font-weight: 600; }
    }

    .sb-icon {
      width: 26px; height: 26px; border-radius: 6px;
      display: flex; align-items: center; justify-content: center;
      flex-shrink: 0; transition: background .12s;
    }

    .sb-label { flex: 1; }

    .sb-badge {
      background: var(--red);
      color: #fff;
      font-size: 10px;
      font-weight: 600;
      padding: 1px 6px;
      border-radius: 10px;
      margin-left: auto;
    }

    .sb-footer {
      padding: 8px;
      border-top: 1px solid var(--border-light);
      margin-top: auto;
    }

    .sb-user {
      display: flex;
      align-items: center;
      gap: 8px;
      width: 100%;
      padding: 7px 8px;
      border-radius: 8px;
      border: none;
      background: transparent;
      cursor: pointer;
      &:hover { background: var(--bg); }
    }
    .sb-user-av   { width: 28px; height: 28px; border-radius: 8px; background: var(--purple); color: #fff; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 600; flex-shrink: 0; }
    .sb-user-name { font-size: 12px; font-weight: 500; color: var(--text); text-align: left; }
    .sb-user-role { font-size: 10px; color: var(--text-4); }

    /* ── Main ── */
    .main-area { flex: 1; display: flex; flex-direction: column; overflow: hidden; background: var(--bg); }

    .topbar {
      height: var(--topbar-h);
      background: var(--surface);
      border-bottom: 1px solid var(--border);
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 20px;
      flex-shrink: 0;
      gap: 12px;
    }

    .tb-page { font-size: 14px; font-weight: 600; color: var(--text); }

    .tb-right { display: flex; align-items: center; gap: 8px; }

    .tb-search {
      display: flex;
      align-items: center;
      gap: 8px;
      background: var(--bg);
      border: 1px solid var(--border);
      border-radius: var(--radius-md);
      padding: 5px 12px;
      width: 220px;
      input {
        border: none;
        background: transparent;
        outline: none;
        font-size: 12px;
        color: var(--text-2);
        width: 100%;
        &::placeholder { color: var(--text-4); }
      }
    }

    .tb-icon-btn { color: var(--text-3) !important; }

    .tb-avatar {
      width: 30px; height: 30px; border-radius: 8px;
      background: linear-gradient(135deg, var(--blue), var(--purple));
      color: #fff; font-size: 11px; font-weight: 600;
      display: flex; align-items: center; justify-content: center;
      cursor: pointer;
    }

    .page-area { flex: 1; overflow-y: auto; padding: 22px 24px; }
  `],
})
export class ShellComponent implements OnInit {
  auth   = inject(AuthService);
  private api = inject(ApiService);
  router = inject(Router);

  unreadCount = signal(0);

  get navGroups(): NavGroup[] {
    const role = this.auth.userRole();
    if (role === 'driver') {
      return [{
        label: 'My Portal',
        items: [
          { label: 'My Trips', icon: 'directions_bus', iconBg: 'rgba(20,184,166,.1)', iconColor: '#14B8A6', route: '/driver' },
          { label: 'Calendar', icon: 'calendar_month', iconBg: 'rgba(14,165,233,.1)', iconColor: '#0EA5E9', route: '/calendar' },
        ],
      }];
    }
    return [
      {
        label: 'Main',
        items: [
          { label: 'Dashboard',  icon: 'grid_view',  iconBg: 'rgba(37,99,235,.1)',  iconColor: '#2563EB', route: '/dashboard' },
          { label: 'Students',   icon: 'people',     iconBg: 'rgba(124,58,237,.1)', iconColor: '#7C3AED', route: '/students' },
          { label: 'Attendance', icon: 'how_to_reg', iconBg: 'rgba(16,185,129,.1)', iconColor: '#10B981', route: '/attendance' },
          { label: 'Fees',       icon: 'payments',   iconBg: 'rgba(245,158,11,.1)', iconColor: '#F59E0B', route: '/fees' },
        ],
      },
      {
        label: 'Academics',
        items: [
          { label: 'Classes',      icon: 'class',             iconBg: 'rgba(5,150,105,.1)',  iconColor: '#059669', route: '/classes' },
          { label: 'Timetable',    icon: 'calendar_view_week', iconBg: 'rgba(20,184,166,.1)', iconColor: '#14B8A6', route: '/timetable' },
          { label: 'Journal',      icon: 'auto_stories',      iconBg: 'rgba(236,72,153,.1)', iconColor: '#EC4899', route: '/journal' },
          { label: 'Observations', icon: 'psychology',        iconBg: 'rgba(99,102,241,.1)', iconColor: '#6366F1', route: '/observations' },
          { label: 'Reports',      icon: 'description',  iconBg: 'rgba(20,184,166,.1)', iconColor: '#14B8A6', route: '/reports' },
        ],
      },
      {
        label: 'School',
        items: [
          { label: 'Calendar',       icon: 'calendar_month',  iconBg: 'rgba(14,165,233,.1)',  iconColor: '#0EA5E9', route: '/calendar' },
          { label: 'Staff',          icon: 'badge',           iconBg: 'rgba(168,85,247,.1)',  iconColor: '#A855F7', route: '/staff' },
          { label: 'Transport',      icon: 'directions_bus',  iconBg: 'rgba(20,184,166,.1)',  iconColor: '#14B8A6', route: '/transport' },
          { label: 'Communication',  icon: 'forum',           iconBg: 'rgba(249,115,22,.1)',  iconColor: '#F97316', route: '/communication' },
          { label: 'Academic Years', icon: 'school',          iconBg: 'rgba(16,185,129,.1)',  iconColor: '#10B981', route: '/academic-years' },
        ],
      },
    ];
  }

  isActive = (route: string) => this.router.url.startsWith(route);

  currentTitle = signal('Dashboard');

  userInitials = computed(() => {
    const name = this.auth.user()?.name ?? '';
    return name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || 'AU';
  });

  schoolInitials = computed(() => {
    const role = this.auth.userRole();
    return role ? role[0].toUpperCase() : 'S';
  });

  constructor() {
    this.router.events.pipe(
      filter(e => e instanceof NavigationEnd)
    ).subscribe(() => {
      const url = this.router.url;
      const all = this.navGroups.flatMap(g => g.items);
      const item = all.find(i => url.startsWith(i.route));
      if (item) this.currentTitle.set(item.label);
    });
  }

  ngOnInit() {
    this.loadUnreadCount();
    setInterval(() => this.loadUnreadCount(), 120_000);
  }

  loadUnreadCount() {
    this.api.get<any>('/communication/messages/unread-count').subscribe({
      next: (res: any) => this.unreadCount.set(res.data?.unread_count ?? 0),
      error: () => {},
    });
  }
}
