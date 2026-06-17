import { Component, inject, signal, OnInit } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive, Router } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { DatePipe } from '@angular/common';
import { ApiService } from '../../core/services/api.service';
import { AuthService } from '../../core/services/auth.service';
import { ParentStateService } from './parent-state.service';

@Component({
  selector: 'app-parent-shell',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, MatIconModule, MatProgressSpinnerModule, DatePipe],
  template: `
    <div class="parent-app">

      <!-- Top bar -->
      <div class="top-bar">
        <div class="tb-left">
          <div class="tb-greeting">Hello, {{ firstName() }} 👋</div>
          <div class="tb-date">{{ today | date:'EEEE, d MMM' }}</div>
        </div>
        <button class="tb-logout" (click)="logout()">
          <mat-icon style="font-size:20px;width:20px;height:20px">logout</mat-icon>
        </button>
      </div>

      <!-- Child selector (shown only when multiple children) -->
      @if (state.children().length > 1) {
        <div class="child-selector">
          @for (child of state.children(); track child.id) {
            <button class="child-pill"
                    [class.active]="state.activeChildId() === child.id"
                    (click)="state.selectChild(child.id)">
              {{ child.first_name }}
            </button>
          }
        </div>
      }

      <!-- Page content -->
      <div class="page-content">
        @if (loading()) {
          <div class="loading-center">
            <mat-progress-spinner diameter="32" mode="indeterminate"/>
          </div>
        } @else {
          <router-outlet/>
        }
      </div>

      <!-- Bottom nav -->
      <nav class="bottom-nav">
        @for (tab of tabs; track tab.path) {
          <a class="nav-item" [routerLink]="tab.path" routerLinkActive="active">
            <div class="nav-icon-wrap">
              <mat-icon style="font-size:22px;width:22px;height:22px">{{ tab.icon }}</mat-icon>
              @if (tab.path === '/parent/messages' && unreadMessages() > 0) {
                <span class="nav-badge">{{ unreadMessages() > 9 ? '9+' : unreadMessages() }}</span>
              }
              @if (tab.path === '/parent/homework' && homeworkDue() > 0) {
                <span class="nav-badge hw">{{ homeworkDue() > 9 ? '9+' : homeworkDue() }}</span>
              }
            </div>
            <span>{{ tab.label }}</span>
          </a>
        }
      </nav>

    </div>
  `,
  styles: [`
    .parent-app { display: flex; flex-direction: column; height: 100dvh; background: var(--bg); font-family: inherit; }
    .top-bar { display: flex; align-items: center; justify-content: space-between; padding: 16px 20px 12px; background: var(--surface); border-bottom: 1px solid var(--border); flex-shrink: 0; }
    .tb-greeting { font-size: 16px; font-weight: 700; color: var(--text-1); }
    .tb-date { font-size: 12px; color: var(--text-3); margin-top: 1px; }
    .tb-logout { background: none; border: none; cursor: pointer; color: var(--text-3); display: flex; align-items: center; padding: 6px; border-radius: 8px; &:hover { background: var(--bg); } }
    .child-selector { display: flex; gap: 8px; padding: 10px 20px; background: var(--surface); border-bottom: 1px solid var(--border); overflow-x: auto; flex-shrink: 0; }
    .child-pill { padding: 6px 16px; border-radius: 20px; border: 1.5px solid var(--border); background: var(--bg); font-size: 13px; font-weight: 600; cursor: pointer; color: var(--text-2); white-space: nowrap; transition: all .15s; &.active { background: var(--primary); border-color: var(--primary); color: #fff; } }
    .page-content { flex: 1; overflow-y: auto; }
    .loading-center { display: flex; justify-content: center; align-items: center; height: 200px; }
    .bottom-nav { display: flex; background: var(--surface); border-top: 1px solid var(--border); flex-shrink: 0; padding-bottom: env(safe-area-inset-bottom); }
    .nav-item { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 3px; padding: 8px 4px; color: var(--text-3); text-decoration: none; font-size: 10px; font-weight: 600; transition: color .15s; &.active { color: var(--primary); } }
    .nav-icon-wrap { position: relative; display: flex; align-items: center; justify-content: center; }
    .nav-badge {
      position: absolute; top: -5px; right: -8px;
      background: #EF4444; color: #fff;
      font-size: 9px; font-weight: 700; min-width: 15px; height: 15px;
      border-radius: 8px; display: flex; align-items: center; justify-content: center;
      padding: 0 3px; line-height: 1;
      &.hw { background: #D97706; }
    }
  `],
})
export class ParentShellComponent implements OnInit {
  private api    = inject(ApiService);
  private auth   = inject(AuthService);
  private router = inject(Router);
  state          = inject(ParentStateService);
  loading        = signal(false);
  today          = new Date();
  unreadMessages = signal(0);
  homeworkDue    = signal(0);

  tabs = [
    { path: '/parent/dashboard',  icon: 'home',            label: 'Home' },
    { path: '/parent/attendance', icon: 'event_available', label: 'Attendance' },
    { path: '/parent/fees',       icon: 'receipt',         label: 'Fees' },
    { path: '/parent/homework',   icon: 'assignment',      label: 'Homework' },
    { path: '/parent/messages',   icon: 'chat',            label: 'Messages' },
  ];

  firstName() { return this.auth.user()?.name?.split(' ')[0] ?? 'Parent'; }

  ngOnInit() {
    this.loadUnreadCount();
    if (!this.state.children().length) {
      this.loading.set(true);
      this.api.get<any>('/parent/students').subscribe({
        next: (res: any) => {
          this.state.setChildren(res.data ?? []);
          this.loading.set(false);
          this.loadHomeworkDue();
        },
        error: () => this.loading.set(false),
      });
    } else {
      this.loadHomeworkDue();
    }
  }

  private loadUnreadCount() {
    this.api.get<any>('/parent/messages/unread-count').subscribe({
      next: (res: any) => this.unreadMessages.set(res.data?.unread_count ?? 0),
      error: () => {},
    });
  }

  private loadHomeworkDue() {
    const child = this.state.activeChild();
    if (!child) return;
    const today = new Date().toISOString().slice(0, 10);
    this.api.get<any>(`/parent/students/${child.id}/homework`).subscribe({
      next: (res: any) => {
        const tasks: any[] = res.data ?? [];
        // API already filters to is_published=true; just count tasks due today or later
        const due = tasks.filter(t => t.due_date && t.due_date >= today).length;
        this.homeworkDue.set(due);
      },
      error: () => {},
    });
  }

  logout() { this.auth.logout(); this.router.navigate(['/login']); }
}
