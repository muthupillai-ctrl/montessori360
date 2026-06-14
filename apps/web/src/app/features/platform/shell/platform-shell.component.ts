import { Component, inject } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { PlatformAuthService } from '../../../core/services/platform-auth.service';

@Component({
  selector: 'app-platform-shell',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, MatIconModule],
  template: `
    <div class="ps-layout">

      <aside class="ps-sidebar">
        <div class="ps-brand">
          <div class="ps-logo">M</div>
          <div>
            <div class="ps-brand-name">Montessori360</div>
            <div class="ps-brand-sub">Platform Admin</div>
          </div>
        </div>

        <nav class="ps-nav">
          <a class="ps-item" routerLink="/platform/schools" routerLinkActive="active">
            <mat-icon>school</mat-icon> Schools
          </a>
        </nav>

        <div class="ps-footer">
          <div class="ps-admin">
            <div class="ps-av">{{ initials() }}</div>
            <div class="ps-info">
              <div class="ps-name">{{ auth.admin()?.name }}</div>
              <div class="ps-role">Platform Admin</div>
            </div>
          </div>
          <button class="ps-logout" (click)="auth.logout()">
            <mat-icon>logout</mat-icon>
          </button>
        </div>
      </aside>

      <main class="ps-main">
        <router-outlet />
      </main>

    </div>
  `,
  styles: [`
    .ps-layout { display: flex; height: 100vh; overflow: hidden; background: #F8FAFC; }

    .ps-sidebar {
      width: 220px; background: #0F172A; display: flex; flex-direction: column;
      flex-shrink: 0; padding: 0;
    }
    .ps-brand {
      display: flex; align-items: center; gap: 10px;
      padding: 20px 16px 16px; border-bottom: 1px solid #1E293B;
    }
    .ps-logo {
      width: 32px; height: 32px; border-radius: 8px;
      background: #3B82F6; color: #fff; font-size: 14px; font-weight: 700;
      display: flex; align-items: center; justify-content: center; flex-shrink: 0;
    }
    .ps-brand-name { font-size: 13px; font-weight: 700; color: #F1F5F9; }
    .ps-brand-sub  { font-size: 10px; color: #64748B; }

    .ps-nav { flex: 1; padding: 12px 8px; }
    .ps-item {
      display: flex; align-items: center; gap: 10px;
      padding: 9px 12px; border-radius: 8px; font-size: 13px; font-weight: 500;
      color: #64748B; text-decoration: none; cursor: pointer;
      mat-icon { font-size: 18px; width: 18px; height: 18px; }
      &:hover { background: #1E293B; color: #94A3B8; }
      &.active { background: #1E40AF; color: #fff; }
    }

    .ps-footer {
      display: flex; align-items: center; gap: 8px; padding: 12px 14px;
      border-top: 1px solid #1E293B;
    }
    .ps-admin { display: flex; align-items: center; gap: 8px; flex: 1; min-width: 0; }
    .ps-av {
      width: 28px; height: 28px; border-radius: 50%; background: #1E40AF;
      color: #fff; font-size: 11px; font-weight: 600; flex-shrink: 0;
      display: flex; align-items: center; justify-content: center;
    }
    .ps-name { font-size: 12px; font-weight: 500; color: #E2E8F0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .ps-role { font-size: 10px; color: #64748B; }
    .ps-logout {
      background: none; border: none; cursor: pointer; color: #64748B; padding: 4px;
      display: flex; border-radius: 6px;
      mat-icon { font-size: 16px; }
      &:hover { color: #EF4444; background: rgba(239,68,68,.1); }
    }

    .ps-main { flex: 1; overflow-y: auto; }
  `],
})
export class PlatformShellComponent {
  auth = inject(PlatformAuthService);
  initials() {
    const name = this.auth.admin()?.name ?? '';
    return name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || 'PA';
  }
}
