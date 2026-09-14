import { Component, inject, signal, computed } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive, Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs';
import { MatMenuModule } from '@angular/material/menu';
import { AuthService } from '../../core/services/auth.service';

interface NavItem { label: string; icon: string; route: string; }
const NAV: NavItem[] = [
  { label: 'Worksheets',      icon: '📄',  route: '/worksheets'      },
  { label: 'Lesson Plans',    icon: '📋',  route: '/lesson-plans'    },
  { label: 'Question Papers', icon: '📝',  route: '/question-papers' },
  { label: 'Curriculum',      icon: '🗂️',  route: '/curriculum'      },
  { label: 'Assignments',     icon: '📌',  route: '/assignments'     },
  { label: 'Progress',        icon: '✅',  route: '/progress'        },
  { label: 'AI Insights',     icon: '✨',  route: '/ai-insights'     },
];

@Component({
  selector: 'ams-shell',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, MatMenuModule],
  template: `
    <div class="shell-layout">

      <!-- ── Sidebar ── -->
      <aside class="sidebar">

        <div class="sb-brand">
          <div class="sb-logo">A</div>
          <div>
            <div class="sb-name">{{ auth.user()?.tenantName ?? 'AMS Portal' }}</div>
            <div class="sb-sub">Academic Management</div>
          </div>
        </div>

        <button class="sb-role-pill" [matMenuTriggerFor]="userMenu">
          <div class="sb-av">{{ initials() }}</div>
          <div class="sb-role-text">
            <div class="sb-role-name">{{ auth.user()?.name ?? '' }}</div>
            <div class="sb-role-tag">
              <span class="sb-dot"></span>
              {{ auth.user()?.role ?? '' }}
            </div>
          </div>
          <span class="sb-chevron">›</span>
        </button>
        <mat-menu #userMenu="matMenu">
          <button mat-menu-item (click)="auth.logout()" style="color:#f87171">
            Sign out
          </button>
        </mat-menu>

        <nav class="sb-nav">
          <div class="sb-group-label">Academic</div>
          @for (item of nav; track item.route) {
            <a class="sb-item" [routerLink]="item.route" routerLinkActive="active">
              <span class="sb-icon">{{ item.icon }}</span>
              <span>{{ item.label }}</span>
            </a>
          }
        </nav>

      </aside>

      <!-- ── Main ── -->
      <div class="main-area">

        <header class="topbar">
          <span class="tb-page">{{ currentTitle() }}</span>
          <div class="tb-right">
            <div class="tb-role-badge">AMS</div>
            <button class="tb-avatar" [matMenuTriggerFor]="topMenu">{{ initials() }}</button>
            <mat-menu #topMenu="matMenu">
              <button mat-menu-item (click)="auth.logout()">Sign out</button>
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

    .shell-layout { display: flex; height: 100vh; overflow: hidden; background: var(--bg); }

    /* ── Sidebar ── */
    .sidebar {
      width: 220px; background: var(--sidebar-bg);
      display: flex; flex-direction: column; flex-shrink: 0; overflow-y: auto;
    }

    .sb-brand {
      padding: 16px 14px 12px;
      border-bottom: 1px solid rgba(255,255,255,.08);
      display: flex; align-items: center; gap: 10px;
    }
    .sb-logo {
      width: 32px; height: 32px; border-radius: 8px;
      background: var(--sidebar-accent); color: #fff;
      font-size: 16px; font-weight: 700;
      display: flex; align-items: center; justify-content: center; flex-shrink: 0;
    }
    .sb-name { font-size: 13px; font-weight: 500; color: #fff; }
    .sb-sub  { font-size: 10px; color: rgba(255,255,255,.45); margin-top: 1px; }

    .sb-role-pill {
      margin: 10px 10px 4px; background: rgba(0,0,0,.25);
      border-radius: 9px; padding: 9px 11px;
      display: flex; align-items: center; gap: 9px;
      border: 1px solid rgba(255,255,255,.08);
      width: calc(100% - 20px); cursor: pointer; transition: background .15s;
      &:hover { background: rgba(0,0,0,.38); }
    }
    .sb-av {
      width: 28px; height: 28px; border-radius: 7px;
      background: rgba(255,255,255,.18); color: #fff;
      font-size: 11px; font-weight: 500;
      display: flex; align-items: center; justify-content: center; flex-shrink: 0;
    }
    .sb-role-text { min-width: 0; flex: 1; }
    .sb-role-name {
      font-size: 12px; font-weight: 500; color: #fff;
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }
    .sb-role-tag {
      font-size: 10px; color: rgba(255,255,255,.55);
      margin-top: 2px; display: flex; align-items: center; gap: 5px;
    }
    .sb-dot {
      width: 5px; height: 5px; border-radius: 50%;
      background: #c4b5fd; flex-shrink: 0;
    }
    .sb-chevron { margin-left: auto; font-size: 16px; color: rgba(255,255,255,.35); flex-shrink: 0; }

    .sb-nav { flex: 1; padding: 4px 8px; }
    .sb-group-label {
      font-size: 9px; font-weight: 600;
      text-transform: uppercase; letter-spacing: .07em;
      color: rgba(255,255,255,.3); padding: 12px 8px 4px;
    }
    .sb-item {
      display: flex; align-items: center; gap: 9px;
      padding: 7px 8px; border-radius: 7px;
      text-decoration: none;
      color: rgba(255,255,255,.55);
      font-size: 13px; font-weight: 400; margin-bottom: 1px;
      transition: background .1s, color .1s;
      &:hover { background: rgba(255,255,255,.08); color: rgba(255,255,255,.85); }
      &.active { background: rgba(124,58,237,.25); color: #c4b5fd; font-weight: 500; }
    }
    .sb-icon { font-size: 15px; flex-shrink: 0; }

    /* ── Main area ── */
    .main-area { flex: 1; display: flex; flex-direction: column; overflow: hidden; }

    .topbar {
      height: 52px; background: #fff;
      border-bottom: 1px solid var(--border);
      display: flex; align-items: center; justify-content: space-between;
      padding: 0 20px; flex-shrink: 0; gap: 12px;
    }
    .tb-page { font-size: 14px; font-weight: 500; color: var(--text); }
    .tb-right { display: flex; align-items: center; gap: 8px; }

    .tb-role-badge {
      font-size: 11px; font-weight: 600; padding: 3px 10px; border-radius: 20px;
      background: var(--purple-light); color: var(--purple);
    }
    .tb-avatar {
      width: 32px; height: 32px; border-radius: 8px;
      background: var(--sidebar-accent); color: #fff;
      font-size: 11px; font-weight: 500;
      display: flex; align-items: center; justify-content: center;
      border: none; cursor: pointer; transition: opacity .1s;
      &:hover { opacity: .85; }
    }

    .page-area { flex: 1; overflow-y: auto; padding: 22px 24px; }
  `],
})
export class ShellComponent {
  auth   = inject(AuthService);
  router = inject(Router);
  nav    = NAV;

  currentTitle = signal<string>('Worksheets');

  initials = computed(() => {
    const name = this.auth.user()?.name ?? '';
    return name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || 'AU';
  });

  constructor() {
    this.router.events.pipe(filter(e => e instanceof NavigationEnd)).subscribe(() => {
      const url  = this.router.url;
      const item = NAV.find(i => url.startsWith(i.route));
      if (item) this.currentTitle.set(item.label);
    });
  }
}
