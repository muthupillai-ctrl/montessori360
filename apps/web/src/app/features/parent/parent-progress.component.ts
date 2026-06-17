import { Component, inject, signal, OnInit } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ApiService } from '../../core/services/api.service';
import { ParentStateService } from './parent-state.service';

@Component({
  selector: 'app-parent-progress',
  standalone: true,
  imports: [MatIconModule, MatProgressSpinnerModule],
  template: `
    <div class="page">
      <div class="page-title">Montessori Progress</div>

      @if (loading()) {
        <div class="loading"><mat-progress-spinner diameter="28" mode="indeterminate"/></div>
      } @else if (!domains().length) {
        <div class="empty">No progress data yet.</div>
      } @else {
        @for (domain of domains(); track domain.domain_id) {
          <div class="domain-card">
            <div class="domain-header">
              <span class="domain-name">{{ domain.domain_name }}</span>
              <span class="domain-pct">{{ domain.mastered_count }}/{{ domain.total_count }}</span>
            </div>
            <div class="progress-bar">
              <div class="progress-fill" [style.width.%]="domain.total_count > 0 ? (domain.mastered_count / domain.total_count * 100) : 0"></div>
            </div>
            <div class="status-row">
              <span class="status-chip mastered">✓ {{ domain.mastered_count }} Mastered</span>
              <span class="status-chip in-progress">◑ {{ domain.in_progress_count }} In progress</span>
              <span class="status-chip not-started">○ {{ domain.not_started_count }} Not started</span>
            </div>
          </div>
        }
      }
    </div>
  `,
  styles: [`
    .page { padding: 16px; }
    .page-title { font-size: 18px; font-weight: 700; color: var(--text-1); margin-bottom: 16px; }
    .loading { display: flex; justify-content: center; padding: 60px; }
    .empty { text-align: center; color: var(--text-3); padding: 60px 20px; font-size: 14px; }
    .domain-card { background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 14px; margin-bottom: 10px; }
    .domain-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
    .domain-name { font-size: 14px; font-weight: 700; color: var(--text-1); }
    .domain-pct { font-size: 12px; font-weight: 600; color: var(--text-3); }
    .progress-bar { height: 8px; background: var(--bg); border-radius: 4px; overflow: hidden; margin-bottom: 10px; }
    .progress-fill { height: 100%; background: var(--primary); border-radius: 4px; transition: width .3s; }
    .status-row { display: flex; gap: 6px; flex-wrap: wrap; }
    .status-chip { font-size: 10px; font-weight: 600; padding: 3px 8px; border-radius: 20px;
      &.mastered { background: var(--green-light); color: #065F46; }
      &.in-progress { background: #EFF6FF; color: #1D4ED8; }
      &.not-started { background: var(--bg); color: var(--text-3); }
    }
  `],
})
export class ParentProgressComponent implements OnInit {
  private api = inject(ApiService);
  state       = inject(ParentStateService);
  loading     = signal(true);
  domains     = signal<any[]>([]);

  ngOnInit() {
    const child = this.state.activeChild();
    if (!child) { this.loading.set(false); return; }
    this.api.get<any>(`/parent/students/${child.id}/progress`).subscribe({
      next: (res: any) => { this.domains.set(res.data ?? []); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }
}
