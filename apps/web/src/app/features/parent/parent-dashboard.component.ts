import { Component, inject, signal, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { TitleCasePipe } from '@angular/common';
import { ApiService } from '../../core/services/api.service';
import { ParentStateService } from './parent-state.service';

@Component({
  selector: 'app-parent-dashboard',
  standalone: true,
  imports: [MatIconModule, MatProgressSpinnerModule, TitleCasePipe],
  template: `
    <div class="dash-page">
      @if (loading()) {
        <div class="loading"><mat-progress-spinner diameter="28" mode="indeterminate"/></div>
      } @else {
        @for (card of cards(); track card.student.id) {
          <div class="child-card">
            <div class="card-header">
              <div class="avatar">{{ card.student.first_name[0] }}</div>
              <div>
                <div class="child-name">{{ card.student.first_name }} {{ card.student.last_name }}</div>
                <div class="child-class">{{ card.student.class_name ?? 'No class assigned' }}{{ card.student.section ? ' · ' + card.student.section : '' }}</div>
              </div>
            </div>
            <div class="stat-row">
              <div class="stat" (click)="go('/parent/attendance')">
                <mat-icon class="stat-icon" [style.color]="attendanceColor(card.today_attendance)">
                  {{ card.today_attendance === 'present' ? 'check_circle' : card.today_attendance === 'absent' ? 'cancel' : 'help_outline' }}
                </mat-icon>
                <div class="stat-label">Today</div>
                <div class="stat-val" [style.color]="attendanceColor(card.today_attendance)">
                  {{ card.today_attendance ?? 'Not marked' | titlecase }}
                </div>
              </div>
              <div class="stat" (click)="go('/parent/fees')">
                <mat-icon class="stat-icon" [style.color]="card.outstanding_fees > 0 ? 'var(--red)' : 'var(--green)'">receipt</mat-icon>
                <div class="stat-label">Dues</div>
                <div class="stat-val" [style.color]="card.outstanding_fees > 0 ? 'var(--red)' : 'var(--green)'">
                  {{ card.outstanding_fees > 0 ? card.outstanding_fees + ' pending' : 'Cleared' }}
                </div>
              </div>
              <div class="stat" (click)="go('/parent/transport')">
                <mat-icon class="stat-icon" [style.color]="card.transport_morning_boarded === null ? 'var(--text-4)' : card.transport_morning_boarded ? 'var(--green)' : 'var(--orange)'">
                  directions_bus
                </mat-icon>
                <div class="stat-label">Bus</div>
                <div class="stat-val">
                  {{ card.transport_morning_boarded === null ? 'No route' : card.transport_morning_boarded ? 'Boarded' : 'Not boarded' }}
                </div>
              </div>
              <div class="stat" (click)="go('/parent/journal')">
                <div class="mood-icon">{{ moodEmoji(card.latest_mood) }}</div>
                <div class="stat-label">Mood</div>
                <div class="stat-val">{{ card.latest_mood ?? '—' | titlecase }}</div>
              </div>
            </div>
          </div>
        }
        @if (!cards().length) {
          <div class="empty">No children linked to your account.</div>
        }
      }
    </div>
  `,
  styles: [`
    .dash-page { padding: 16px; display: flex; flex-direction: column; gap: 14px; }
    .loading { display: flex; justify-content: center; padding: 60px; }
    .child-card { background: var(--surface); border: 1px solid var(--border); border-radius: 14px; overflow: hidden; }
    .card-header { display: flex; align-items: center; gap: 12px; padding: 16px; border-bottom: 1px solid var(--border); }
    .avatar { width: 42px; height: 42px; border-radius: 50%; background: var(--primary-light, #e8f0fe); color: var(--primary); font-size: 18px; font-weight: 700; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
    .child-name { font-size: 15px; font-weight: 700; color: var(--text-1); }
    .child-class { font-size: 12px; color: var(--text-3); margin-top: 2px; }
    .stat-row { display: grid; grid-template-columns: repeat(4,1fr); }
    .stat { display: flex; flex-direction: column; align-items: center; gap: 4px; padding: 14px 8px; cursor: pointer; &:hover { background: var(--bg); } }
    .stat-icon { font-size: 22px !important; width: 22px !important; height: 22px !important; }
    .mood-icon { font-size: 22px; line-height: 1; }
    .stat-label { font-size: 10px; color: var(--text-3); font-weight: 600; text-transform: uppercase; letter-spacing: .5px; }
    .stat-val { font-size: 11px; font-weight: 700; color: var(--text-2); text-align: center; }
    .empty { text-align: center; color: var(--text-3); padding: 60px 20px; font-size: 14px; }
  `],
})
export class ParentDashboardComponent implements OnInit {
  private api    = inject(ApiService);
  private router = inject(Router);
  state          = inject(ParentStateService);
  loading        = signal(true);
  cards          = signal<any[]>([]);

  ngOnInit() {
    this.api.get<any>('/parent/dashboard').subscribe({
      next: (res: any) => { this.cards.set(res.data ?? []); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  go(path: string) { this.router.navigate([path]); }
  attendanceColor(s: string | null) {
    return s === 'present' ? 'var(--green)' : s === 'absent' ? 'var(--red)' : 'var(--text-4)';
  }
  moodEmoji(mood: string | null) {
    const map: Record<string, string> = { happy: '😊', sad: '😢', neutral: '😐', excited: '🎉', tired: '😴', anxious: '😟' };
    return mood ? (map[mood] ?? '😶') : '—';
  }
}
