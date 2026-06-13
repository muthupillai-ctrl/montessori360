import { Component, inject, Input } from '@angular/core';
import { MatDialogModule, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { DatePipe, DecimalPipe } from '@angular/common';
import { AuthService } from '../../core/services/auth.service';
import type { StaffMember } from './staff.component';

const ROLE_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  owner:             { label: 'Owner',          color: '#7C3AED', bg: '#F5F3FF' },
  principal:         { label: 'Principal',      color: '#2563EB', bg: '#EFF6FF' },
  teacher:           { label: 'Teacher',        color: '#059669', bg: '#ECFDF5' },
  assistant_teacher: { label: 'Asst. Teacher',  color: '#0891B2', bg: '#ECFEFF' },
  accountant:        { label: 'Accountant',     color: '#D97706', bg: '#FFFBEB' },
  driver:            { label: 'Driver',         color: '#6B7280', bg: '#F9FAFB' },
  support:           { label: 'Support Staff',  color: '#9CA3AF', bg: '#F9FAFB' },
};

@Component({
  selector: 'app-staff-profile-dialog',
  standalone: true,
  imports: [ MatDialogModule, MatIconModule, DatePipe, DecimalPipe ],
  template: `
    <div class="dialog-shell">

      <!-- Top bar -->
      <div class="top-bar">
        <button class="close-btn" mat-dialog-close>
          <mat-icon>close</mat-icon>
        </button>
      </div>

      <!-- Hero section -->
      <div class="hero">
        <div class="hero-av" [style.background]="getColor(s.first_name)">
          {{ s.first_name[0] }}{{ s.last_name[0] }}
        </div>
        <div class="hero-name">{{ s.first_name }} {{ s.last_name }}</div>
        <div class="hero-badges">
          <span class="role-tag"
                [style.background]="getRoleCfg().bg"
                [style.color]="getRoleCfg().color">
            {{ getRoleCfg().label }}
          </span>
          @if (s.designation) {
            <span class="desig-tag">{{ s.designation }}</span>
          }
        </div>
        @if (s.employee_no) {
          <div class="emp-no">{{ s.employee_no }}</div>
        }
        <div class="status-dot" [class.active]="s.is_active">
          <span class="dot"></span>
          {{ s.is_active ? 'Active' : 'Inactive' }}
        </div>
      </div>

      <!-- Info cards -->
      <div class="info-section">

        <!-- Contact card — always visible -->
        <div class="info-card">
          <div class="ic-title">Contact</div>
          <div class="ic-row">
            <mat-icon class="ic-icon">email</mat-icon>
            <span>{{ s.email }}</span>
          </div>
          @if (s.phone) {
            <div class="ic-row">
              <mat-icon class="ic-icon">phone</mat-icon>
              <span>{{ s.phone }}</span>
            </div>
          }
          @if (s.dob && isAdmin()) {
            <div class="ic-row">
              <mat-icon class="ic-icon">cake</mat-icon>
              <span>{{ s.dob | date:'d MMMM yyyy' }}</span>
            </div>
          }
        </div>

        <!-- Employment card — always visible basic info -->
        <div class="info-card">
          <div class="ic-title">Employment</div>
          @if (s.department) {
            <div class="ic-row">
              <mat-icon class="ic-icon">business</mat-icon>
              <span>{{ s.department }}</span>
            </div>
          }
          @if (s.joining_date) {
            <div class="ic-row">
              <mat-icon class="ic-icon">calendar_today</mat-icon>
              <span>Joined {{ s.joining_date | date:'d MMM yyyy' }}</span>
            </div>
          }
          @if (s.salary && isAdmin()) {
            <div class="ic-row">
              <mat-icon class="ic-icon">payments</mat-icon>
              <span>₹{{ s.salary | number:'1.0-0' }} / month</span>
            </div>
          }
        </div>

        <!-- Qualifications — visible to all -->
        @if (s.qualifications && s.qualifications.length) {
          <div class="info-card">
            <div class="ic-title">Qualifications</div>
            @for (q of s.qualifications; track q.degree) {
              <div class="qual-row">
                <div class="qual-badge">🎓</div>
                <div>
                  <div class="qual-degree">{{ q.degree }}</div>
                  <div class="qual-inst">{{ q.institution }} · {{ q.year }}</div>
                </div>
              </div>
            }
          </div>
        }

      </div>

      <div class="dialog-footer">
        <button class="close-action" mat-dialog-close>Close</button>
      </div>
    </div>
  `,
  styles: [`
    .dialog-shell {
      width: 100%; display: flex; flex-direction: column; max-height: 88vh;
      background: var(--bg);
    }

    /* Top bar */
    .top-bar {
      display: flex; justify-content: flex-end;
      padding: 10px 12px 0; flex-shrink: 0;
    }
    .close-btn {
      background: none; border: none; cursor: pointer; color: var(--text-3);
      width: 30px; height: 30px; border-radius: 7px;
      display: flex; align-items: center; justify-content: center;
      &:hover { background: var(--border); }
      mat-icon { font-size: 18px; width: 18px; height: 18px; }
    }

    /* Hero */
    .hero {
      display: flex; flex-direction: column; align-items: center;
      padding: 0 24px 20px; text-align: center; flex-shrink: 0;
    }
    .hero-av {
      width: 72px; height: 72px; border-radius: 20px;
      color: #fff; font-size: 24px; font-weight: 700;
      display: flex; align-items: center; justify-content: center;
      box-shadow: 0 8px 24px rgba(0,0,0,.15); margin-bottom: 12px;
    }
    .hero-name  { font-size: 20px; font-weight: 700; color: var(--text); letter-spacing: -.3px; }
    .hero-badges { display: flex; gap: 6px; margin-top: 8px; justify-content: center; flex-wrap: wrap; }
    .role-tag   { font-size: 12px; font-weight: 600; padding: 4px 10px; border-radius: 20px; }
    .desig-tag  { font-size: 12px; color: var(--text-3); background: var(--surface); border: 1px solid var(--border); padding: 4px 10px; border-radius: 20px; }
    .emp-no     { font-family: monospace; font-size: 12px; color: var(--text-4); margin-top: 6px; }
    .status-dot {
      display: flex; align-items: center; gap: 5px;
      font-size: 12px; color: var(--text-3); margin-top: 6px;
      .dot { width: 7px; height: 7px; border-radius: 50%; background: var(--text-3); }
      &.active { color: var(--green);
        .dot { background: var(--green); }
      }
    }

    /* Info section */
    .info-section { flex: 1; overflow-y: auto; padding: 0 16px 16px; display: flex; flex-direction: column; gap: 10px; }

    .info-card {
      background: var(--surface); border: 1px solid var(--border);
      border-radius: 10px; padding: 14px 16px; display: flex; flex-direction: column; gap: 10px;
    }
    .ic-title {
      font-size: 10px; font-weight: 700; text-transform: uppercase;
      letter-spacing: .6px; color: var(--text-4); padding-bottom: 2px;
      border-bottom: 1px solid var(--border-light);
    }
    .ic-row  { display: flex; align-items: center; gap: 10px; font-size: 13px; color: var(--text-2); }
    .ic-icon { font-size: 16px; width: 16px; height: 16px; color: var(--text-3); flex-shrink: 0; }

    /* Qualifications */
    .qual-row   { display: flex; align-items: flex-start; gap: 10px; }
    .qual-badge { font-size: 18px; flex-shrink: 0; }
    .qual-degree { font-size: 13px; font-weight: 500; color: var(--text); }
    .qual-inst   { font-size: 11px; color: var(--text-3); margin-top: 1px; }

    /* Footer */
    .dialog-footer {
      display: flex; justify-content: center;
      padding: 12px 16px; border-top: 1px solid var(--border);
      background: var(--surface); flex-shrink: 0;
    }
    .close-action {
      background: none; border: 1px solid var(--border);
      color: var(--text-2); border-radius: 8px;
      padding: 0 24px; height: 34px; font-size: 13px; cursor: pointer;
      &:hover { background: var(--bg); }
    }
  `],
})
export class StaffProfileDialogComponent {
  private auth = inject(AuthService);
  s: StaffMember = inject(MAT_DIALOG_DATA);

  isAdmin = () => ['owner', 'principal', 'accountant'].includes(this.auth.user()?.role ?? '');

  getRoleCfg() { return ROLE_CONFIG[this.s.role] ?? { label: this.s.role, color: '#6B7280', bg: '#F9FAFB' }; }

  getColor(name: string): string {
    const colors = ['#2563EB','#7C3AED','#DB2777','#D97706','#059669','#0891B2'];
    return colors[(name?.charCodeAt(0) || 0) % colors.length];
  }
}
