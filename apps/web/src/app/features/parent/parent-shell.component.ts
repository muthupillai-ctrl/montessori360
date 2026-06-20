import { Component, inject, signal, OnInit } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive, Router } from '@angular/router';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { DatePipe } from '@angular/common';
import { ApiService } from '../../core/services/api.service';
import { AuthService } from '../../core/services/auth.service';
import { ParentStateService } from './parent-state.service';

const TABS = [
  { path: '/parent/dashboard',  icon: 'ti-home-2',        label: 'Home' },
  { path: '/parent/attendance', icon: 'ti-calendar-check', label: 'Attendance' },
  { path: '/parent/fees',       icon: 'ti-receipt',        label: 'Fees' },
  { path: '/parent/journal',    icon: 'ti-book',           label: 'Journal' },
  { path: '/parent/messages',   icon: 'ti-message-circle', label: 'Messages' },
];

@Component({
  selector: 'app-parent-shell',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, MatProgressSpinnerModule, DatePipe],
  template: `
    <div class="ps-root">

      <!-- ── Header ─────────────────────────────────────────── -->
      <header class="ps-header">
        <div class="ps-header-top">
          <div class="ps-brand">
            <div class="ps-brand-logo">M</div>
            <span class="ps-brand-name">Montessori360</span>
          </div>
          <div class="ps-header-actions">
            @if (unreadMessages() > 0) {
              <div class="ps-notif-dot"></div>
            }
            <button class="ps-icon-btn" (click)="logout()" title="Sign out">
              <i class="ti ti-logout"></i>
            </button>
          </div>
        </div>
        <div class="ps-greeting">
          <div class="ps-greeting-text">Good {{ timeOfDay() }}, {{ firstName() }} 👋</div>
          <div class="ps-greeting-date">{{ today | date:'EEEE, d MMMM yyyy' }}</div>
        </div>
      </header>

      <!-- ── Child selector ──────────────────────────────────── -->
      @if (state.children().length > 1) {
        <div class="ps-child-bar">
          @for (child of state.children(); track child.id) {
            <button class="ps-child-chip"
                    [class.active]="state.activeChildId() === child.id"
                    (click)="state.selectChild(child.id)">
              <div class="ps-child-av" [style.background]="childColor(child.first_name)">
                {{ child.first_name[0] }}
              </div>
              <span>{{ child.first_name }}</span>
            </button>
          }
        </div>
      }

      <!-- ── Page content ────────────────────────────────────── -->
      <main class="ps-content">
        @if (loading()) {
          <div class="ps-loader">
            <mat-progress-spinner diameter="36" mode="indeterminate"/>
          </div>
        } @else {
          <router-outlet/>
        }
      </main>

      <!-- ── Bottom nav ──────────────────────────────────────── -->
      <nav class="ps-bottom-nav">
        @for (tab of tabs; track tab.path) {
          <a class="ps-nav-item" [routerLink]="tab.path" routerLinkActive="active">
            <div class="ps-nav-icon">
              <i class="ti {{ tab.icon }}"></i>
              @if (tab.path === '/parent/messages' && unreadMessages() > 0) {
                <span class="ps-nav-badge">{{ unreadMessages() > 9 ? '9+' : unreadMessages() }}</span>
              }
            </div>
            <span class="ps-nav-label">{{ tab.label }}</span>
          </a>
        }
      </nav>

    </div>
  `,
  styles: [`
    :host { display: block; }

    .ps-root {
      display: flex; flex-direction: column;
      height: 100dvh; background: #F5F7FA;
      font-family: -apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', sans-serif;
    }

    /* ── Header ── */
    .ps-header {
      background: linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%);
      padding: 16px 20px 20px;
      flex-shrink: 0;
    }
    .ps-header-top {
      display: flex; align-items: center; justify-content: space-between;
      margin-bottom: 14px;
    }
    .ps-brand { display: flex; align-items: center; gap: 8px; }
    .ps-brand-logo {
      width: 28px; height: 28px; border-radius: 7px;
      background: rgba(255,255,255,.25); color: #fff;
      font-size: 13px; font-weight: 800;
      display: flex; align-items: center; justify-content: center;
    }
    .ps-brand-name { font-size: 13px; font-weight: 700; color: rgba(255,255,255,.9); letter-spacing: .01em; }

    .ps-header-actions { display: flex; align-items: center; gap: 4px; position: relative; }
    .ps-notif-dot {
      position: absolute; top: 2px; right: 32px;
      width: 8px; height: 8px; border-radius: 50%;
      background: #FCD34D; border: 2px solid #5B21B6;
    }
    .ps-icon-btn {
      width: 34px; height: 34px; border-radius: 10px;
      background: rgba(255,255,255,.15); border: none; cursor: pointer;
      color: #fff; font-size: 17px;
      display: flex; align-items: center; justify-content: center;
      transition: background .15s;
      &:hover { background: rgba(255,255,255,.25); }
    }

    .ps-greeting-text { font-size: 20px; font-weight: 700; color: #fff; }
    .ps-greeting-date { font-size: 12px; color: rgba(255,255,255,.7); margin-top: 2px; }

    /* ── Child selector ── */
    .ps-child-bar {
      display: flex; gap: 8px; padding: 10px 16px;
      background: #fff; border-bottom: 1px solid #EAECF0;
      overflow-x: auto; flex-shrink: 0;
      scrollbar-width: none; &::-webkit-scrollbar { display: none; }
    }
    .ps-child-chip {
      display: flex; align-items: center; gap: 7px;
      padding: 6px 12px 6px 6px; border-radius: 20px;
      border: 1.5px solid #E4E7EC; background: #fff;
      font-size: 13px; font-weight: 600; color: #667085;
      white-space: nowrap; cursor: pointer; transition: all .15s;
      &.active {
        background: #EEF2FF; border-color: #A5B4FC; color: #4338CA;
      }
    }
    .ps-child-av {
      width: 22px; height: 22px; border-radius: 50%;
      color: #fff; font-size: 11px; font-weight: 700;
      display: flex; align-items: center; justify-content: center;
      flex-shrink: 0;
    }

    /* ── Content ── */
    .ps-content { flex: 1; overflow-y: auto; }
    .ps-loader { display: flex; justify-content: center; align-items: center; height: 240px; }

    /* ── Bottom nav ── */
    .ps-bottom-nav {
      display: flex; background: #fff;
      border-top: 1px solid #EAECF0;
      flex-shrink: 0;
      padding-bottom: env(safe-area-inset-bottom, 0px);
      box-shadow: 0 -1px 0 #EAECF0, 0 -4px 12px rgba(0,0,0,.04);
    }
    .ps-nav-item {
      flex: 1; display: flex; flex-direction: column;
      align-items: center; gap: 3px;
      padding: 10px 4px 8px;
      text-decoration: none; color: #98A2B3;
      transition: color .15s;
    }
    .ps-nav-item.active { color: #4F46E5; }
    .ps-nav-icon {
      position: relative;
      width: 28px; height: 28px; border-radius: 8px;
      display: flex; align-items: center; justify-content: center;
      font-size: 20px; transition: background .15s;
    }
    .ps-nav-item.active .ps-nav-icon { background: #EEF2FF; }
    .ps-nav-label { font-size: 9.5px; font-weight: 600; letter-spacing: .01em; }
    .ps-nav-badge {
      position: absolute; top: -4px; right: -6px;
      background: #EF4444; color: #fff;
      font-size: 8px; font-weight: 700;
      min-width: 14px; height: 14px; border-radius: 7px;
      display: flex; align-items: center; justify-content: center;
      padding: 0 3px; border: 1.5px solid #fff;
    }
  `],
})
export class ParentShellComponent implements OnInit {
  private api    = inject(ApiService);
  private auth   = inject(AuthService);
  private router = inject(Router);
  state          = inject(ParentStateService);

  loading        = signal(false);
  unreadMessages = signal(0);
  today          = new Date();
  tabs           = TABS;

  private readonly CHILD_COLORS = [
    '#4F46E5','#7C3AED','#DB2777','#D97706','#059669','#0284C7',
  ];

  firstName() { return this.auth.user()?.name?.split(' ')[0] ?? 'Parent'; }

  timeOfDay() {
    const h = new Date().getHours();
    return h < 12 ? 'morning' : h < 17 ? 'afternoon' : 'evening';
  }

  childColor(name: string) {
    return this.CHILD_COLORS[(name?.charCodeAt(0) ?? 0) % this.CHILD_COLORS.length];
  }

  ngOnInit() {
    this.loadUnreadCount();
    if (!this.state.children().length) {
      this.loading.set(true);
      this.api.get<any>('/parent/students').subscribe({
        next: (res: any) => { this.state.setChildren(res.data ?? []); this.loading.set(false); },
        error: () => this.loading.set(false),
      });
    }
  }

  private loadUnreadCount() {
    this.api.get<any>('/parent/messages/unread-count').subscribe({
      next: (res: any) => this.unreadMessages.set(res.data?.unread_count ?? 0),
      error: () => {},
    });
  }

  logout() { this.auth.logout(); }
}
