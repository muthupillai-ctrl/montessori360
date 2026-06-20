import { Component, inject, signal, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { DatePipe, TitleCasePipe } from '@angular/common';
import { ApiService } from '../../core/services/api.service';

@Component({
  selector: 'app-parent-dashboard',
  standalone: true,
  imports: [MatProgressSpinnerModule, DatePipe, TitleCasePipe],
  template: `
    <div class="dash">
      @if (loading()) {
        <div class="dash-loader"><mat-progress-spinner diameter="32" mode="indeterminate"/></div>
      } @else {
        @for (card of cards(); track card.student.id) {

          <!-- Child hero card -->
          <div class="hero-card" [style.background]="childGradient(card.student.first_name)">
            <div class="hero-avatar">{{ card.student.first_name[0] }}{{ card.student.last_name[0] }}</div>
            <div class="hero-info">
              <div class="hero-name">{{ card.student.first_name }} {{ card.student.last_name }}</div>
              <div class="hero-class">{{ card.student.class_name ?? 'No class' }}{{ card.student.section ? ' · ' + card.student.section : '' }}</div>
            </div>
            <div class="hero-date">{{ today | date:'d MMM' }}</div>
          </div>

          <!-- Today's snapshot -->
          <div class="section-title">Today's Snapshot</div>
          <div class="stat-grid">

            <div class="stat-card" [class]="'stat-' + attendanceVariant(card.today_attendance)"
                 (click)="go('/parent/attendance')">
              <div class="stat-icon-wrap">
                <i class="ti {{ attendanceIcon(card.today_attendance) }}"></i>
              </div>
              <div class="stat-body">
                <div class="stat-label">Attendance</div>
                <div class="stat-value">{{ card.today_attendance ? (card.today_attendance | titlecase) : 'Not marked' }}</div>
              </div>
              <i class="ti ti-chevron-right stat-arrow"></i>
            </div>

            <div class="stat-card" [class]="card.outstanding_fees > 0 ? 'stat-warning' : 'stat-success'"
                 (click)="go('/parent/fees')">
              <div class="stat-icon-wrap">
                <i class="ti ti-receipt"></i>
              </div>
              <div class="stat-body">
                <div class="stat-label">Fees</div>
                <div class="stat-value">{{ card.outstanding_fees > 0 ? card.outstanding_fees + ' pending' : 'Cleared' }}</div>
              </div>
              <i class="ti ti-chevron-right stat-arrow"></i>
            </div>

            <div class="stat-card" [class]="busVariant(card.transport_morning_boarded)"
                 (click)="go('/parent/transport')">
              <div class="stat-icon-wrap">
                <i class="ti ti-bus"></i>
              </div>
              <div class="stat-body">
                <div class="stat-label">Morning Bus</div>
                <div class="stat-value">{{ busLabel(card.transport_morning_boarded) }}</div>
              </div>
              <i class="ti ti-chevron-right stat-arrow"></i>
            </div>

            <div class="stat-card stat-mood" (click)="go('/parent/journal')">
              <div class="stat-icon-wrap mood-icon">{{ moodEmoji(card.latest_mood) }}</div>
              <div class="stat-body">
                <div class="stat-label">Today's Mood</div>
                <div class="stat-value">{{ card.latest_mood ? (card.latest_mood | titlecase) : 'No entry' }}</div>
              </div>
              <i class="ti ti-chevron-right stat-arrow"></i>
            </div>

          </div>

          <!-- Quick links -->
          <div class="section-title">Quick Access</div>
          <div class="quick-links">
            <button class="ql-btn" (click)="go('/parent/journal')">
              <div class="ql-icon" style="background:#EEF2FF;color:#4F46E5"><i class="ti ti-book"></i></div>
              <span>Journal</span>
            </button>
            <button class="ql-btn" (click)="go('/parent/homework')">
              <div class="ql-icon" style="background:#FFF7ED;color:#C2410C"><i class="ti ti-pencil"></i></div>
              <span>Homework</span>
            </button>
            <button class="ql-btn" (click)="go('/parent/messages')">
              <div class="ql-icon" style="background:#F0FDF4;color:#166534"><i class="ti ti-message-circle"></i></div>
              <span>Messages</span>
            </button>
            <button class="ql-btn" (click)="go('/parent/progress')">
              <div class="ql-icon" style="background:#FDF4FF;color:#7E22CE"><i class="ti ti-chart-bar"></i></div>
              <span>Progress</span>
            </button>
          </div>

        }

        @if (!cards().length) {
          <div class="empty-state">
            <div class="empty-icon">👶</div>
            <div class="empty-title">No children linked</div>
            <div class="empty-sub">Contact the school to link your children to this account.</div>
          </div>
        }
      }
    </div>
  `,
  styles: [`
    .dash { padding: 0 0 24px; }
    .dash-loader { display: flex; justify-content: center; padding: 80px 0; }

    /* ── Hero card ── */
    .hero-card {
      display: flex; align-items: center; gap: 14px;
      margin: 16px 16px 0; border-radius: 18px;
      padding: 18px 18px;
      box-shadow: 0 4px 20px rgba(0,0,0,.12);
    }
    .hero-avatar {
      width: 52px; height: 52px; border-radius: 16px;
      background: rgba(255,255,255,.25);
      color: #fff; font-size: 18px; font-weight: 800;
      display: flex; align-items: center; justify-content: center;
      flex-shrink: 0; letter-spacing: -.5px;
    }
    .hero-info { flex: 1; min-width: 0; }
    .hero-name { font-size: 17px; font-weight: 700; color: #fff; }
    .hero-class { font-size: 12px; color: rgba(255,255,255,.75); margin-top: 2px; }
    .hero-date { font-size: 12px; font-weight: 700; color: rgba(255,255,255,.8); white-space: nowrap; }

    /* ── Section title ── */
    .section-title {
      font-size: 11px; font-weight: 700; text-transform: uppercase;
      letter-spacing: .06em; color: #98A2B3;
      padding: 20px 18px 10px;
    }

    /* ── Stat grid ── */
    .stat-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; padding: 0 16px; }
    .stat-card {
      display: flex; align-items: center; gap: 10px;
      background: #fff; border-radius: 14px; padding: 14px 12px;
      box-shadow: 0 1px 4px rgba(0,0,0,.06); cursor: pointer;
      transition: transform .1s, box-shadow .1s;
      border: 1px solid transparent;
      &:active { transform: scale(.97); }
    }
    .stat-icon-wrap {
      width: 38px; height: 38px; border-radius: 10px;
      display: flex; align-items: center; justify-content: center;
      font-size: 20px; flex-shrink: 0;
    }
    .mood-icon { font-size: 24px; }
    .stat-body { flex: 1; min-width: 0; }
    .stat-label { font-size: 10px; font-weight: 600; color: #98A2B3; text-transform: uppercase; letter-spacing: .04em; }
    .stat-value { font-size: 13px; font-weight: 700; color: #1D2939; margin-top: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .stat-arrow { font-size: 14px; color: #D0D5DD; flex-shrink: 0; }

    /* Variants */
    .stat-success .stat-icon-wrap { background: #ECFDF5; color: #059669; }
    .stat-success { border-color: #A7F3D0; }
    .stat-danger  .stat-icon-wrap { background: #FEF2F2; color: #DC2626; }
    .stat-danger  { border-color: #FECACA; }
    .stat-warning .stat-icon-wrap { background: #FFFBEB; color: #D97706; }
    .stat-warning { border-color: #FDE68A; }
    .stat-neutral .stat-icon-wrap { background: #F9FAFB; color: #6B7280; }
    .stat-info    .stat-icon-wrap { background: #EFF6FF; color: #2563EB; }
    .stat-info    { border-color: #BFDBFE; }
    .stat-mood    .stat-icon-wrap { background: #FDF4FF; }
    .stat-mood    { border-color: #E9D5FF; }

    /* ── Quick links ── */
    .quick-links { display: grid; grid-template-columns: repeat(4,1fr); gap: 10px; padding: 0 16px; }
    .ql-btn {
      display: flex; flex-direction: column; align-items: center; gap: 8px;
      background: #fff; border: 1px solid #EAECF0; border-radius: 14px;
      padding: 14px 8px; cursor: pointer;
      box-shadow: 0 1px 4px rgba(0,0,0,.05); transition: transform .1s;
      &:active { transform: scale(.95); }
    }
    .ql-icon {
      width: 40px; height: 40px; border-radius: 11px;
      display: flex; align-items: center; justify-content: center;
      font-size: 20px;
    }
    .ql-btn span { font-size: 10.5px; font-weight: 600; color: #344054; }

    /* ── Empty ── */
    .empty-state { display: flex; flex-direction: column; align-items: center; gap: 10px; padding: 80px 24px; text-align: center; }
    .empty-icon { font-size: 48px; }
    .empty-title { font-size: 16px; font-weight: 700; color: #1D2939; }
    .empty-sub { font-size: 13px; color: #98A2B3; line-height: 1.5; }
  `],
})
export class ParentDashboardComponent implements OnInit {
  private api    = inject(ApiService);
  private router = inject(Router);
  loading        = signal(true);
  cards          = signal<any[]>([]);
  today          = new Date();

  private readonly GRADIENTS = [
    'linear-gradient(135deg,#4F46E5,#7C3AED)',
    'linear-gradient(135deg,#0284C7,#0EA5E9)',
    'linear-gradient(135deg,#059669,#10B981)',
    'linear-gradient(135deg,#D97706,#F59E0B)',
    'linear-gradient(135deg,#DB2777,#EC4899)',
  ];

  ngOnInit() {
    this.api.get<any>('/parent/dashboard').subscribe({
      next: (res: any) => { this.cards.set(res.data ?? []); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  go(path: string) { this.router.navigate([path]); }

  childGradient(name: string) {
    return this.GRADIENTS[(name?.charCodeAt(0) ?? 0) % this.GRADIENTS.length];
  }

  attendanceVariant(s: string | null) {
    return s === 'present' ? 'success' : s === 'absent' ? 'danger' : s === 'late' ? 'warning' : 'neutral';
  }
  attendanceIcon(s: string | null) {
    return s === 'present' ? 'ti-circle-check' : s === 'absent' ? 'ti-circle-x' : s === 'late' ? 'ti-clock' : 'ti-help-circle';
  }

  busVariant(b: boolean | null) {
    return b === true ? 'info' : b === false ? 'warning' : 'neutral';
  }
  busLabel(b: boolean | null) {
    return b === null ? 'No route' : b ? 'Boarded' : 'Not boarded';
  }

  moodEmoji(mood: string | null) {
    const map: Record<string, string> = { happy: '😊', calm: '😌', unsettled: '😟', upset: '😢' };
    return mood ? (map[mood] ?? '😐') : '😐';
  }
}
