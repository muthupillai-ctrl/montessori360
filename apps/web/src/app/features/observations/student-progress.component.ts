import { Component, inject, signal, Input, OnChanges, Output, EventEmitter } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ApiService } from '../../core/services/api.service';
import type { Domain } from './observations.component';

interface MilestoneProgress {
  milestone_id:   string;
  milestone_code: string;
  milestone_name: string;
  grade:          string | null;
  notes:          string | null;
  observed_on:    string | null;
}

interface DomainProgress {
  domain_id:   string;
  domain_name: string;
  domain_code: string;
  total:       number;
  not_started: number;
  in_progress: number;
  led:         number;
  mastered:    number;
  percentage:  number;
  milestones:  MilestoneProgress[];
}

const GRADE_CONFIG: Record<string, { label: string; color: string; bg: string; icon: string; short: string }> = {
  not_started: { label: 'Not Started', short: 'NS', color: '#9CA3AF', bg: '#F9FAFB',  icon: 'radio_button_unchecked' },
  in_progress: { label: 'In Progress', short: 'IP', color: '#F59E0B', bg: '#FFFBEB',  icon: 'pending' },
  led:         { label: 'Led',         short: 'L',  color: '#3B82F6', bg: '#EFF6FF',  icon: 'support' },
  mastered:    { label: 'Mastered',    short: 'M',  color: '#10B981', bg: '#ECFDF5',  icon: 'check_circle' },
};

@Component({
  selector: 'app-student-progress',
  standalone: true,
  imports: [ MatIconModule, MatProgressSpinnerModule ],
  template: `
    @if (loading()) {
      <div class="loading-state">
        <mat-progress-spinner mode="indeterminate" diameter="32" />
        <span>Loading progress…</span>
      </div>
    } @else if (progress().length) {

      <!-- Overall mastery summary -->
      <div class="overall-bar">
        @for (g of gradeSummary(); track g.grade) {
          <div class="ob-segment"
               [style.width.%]="g.pct"
               [style.background]="g.color"
               [title]="g.label + ': ' + g.count">
          </div>
        }
      </div>
      <div class="overall-legend">
        @for (g of gradeSummary(); track g.grade) {
          <div class="ol-item">
            <div class="ol-dot" [style.background]="g.color"></div>
            <span>{{ g.label }}</span>
            <strong>{{ g.count }}</strong>
          </div>
        }
        <div class="ol-item total">
          <span>Overall mastery</span>
          <strong>{{ overallMastery() }}%</strong>
        </div>
      </div>

      <!-- Domain cards -->
      <div class="domains-grid">
        @for (d of progress(); track d.domain_id) {
          <div class="domain-card">

            <!-- Domain header -->
            <div class="dc-header" [style.border-color]="getDomainColor(d.domain_code)">
              <div class="dc-icon" [style.background]="getDomainColor(d.domain_code) + '20'"
                   [style.color]="getDomainColor(d.domain_code)">
                {{ getDomainEmoji(d.domain_code) }}
              </div>
              <div class="dc-info">
                <div class="dc-name">{{ d.domain_name }}</div>
                <div class="dc-stats">{{ d.mastered }}/{{ d.total }} mastered</div>
              </div>
              <div class="dc-pct" [style.color]="getDomainColor(d.domain_code)">
                {{ d.percentage }}%
              </div>
            </div>

            <!-- Domain progress bar -->
            <div class="dc-bar">
              @for (g of getDomainGrades(d); track g.grade) {
                <div class="dcb-seg" [style.width.%]="g.pct"
                     [style.background]="g.color" [title]="g.label + ': ' + g.count"></div>
              }
            </div>

            <!-- Milestones grid -->
            <div class="milestones-grid">
              @for (m of d.milestones; track m.milestone_id) {
                <div class="milestone-chip"
                     [style.background]="getGradeConfig(m.grade).bg"
                     [style.border-color]="getGradeConfig(m.grade).color + '60'"
                     [title]="m.milestone_name + ' — ' + getGradeConfig(m.grade).label + (m.notes ? ': ' + m.notes : '')"
                     (click)="observationRecorded.emit(m.milestone_id)">
                  <div class="mc-code">{{ m.milestone_code }}</div>
                  <div class="mc-grade">
                    <mat-icon [style.color]="getGradeConfig(m.grade).color"
                              style="font-size:12px;width:12px;height:12px">
                      {{ getGradeConfig(m.grade).icon }}
                    </mat-icon>
                  </div>
                </div>
              }
            </div>

          </div>
        }
      </div>

      <!-- Legend -->
      <div class="grade-legend">
        <div class="gl-title">Click any milestone to record an observation</div>
        <div class="gl-items">
          @for (g of gradeKeys; track g) {
            <div class="gl-item">
              <mat-icon [style.color]="gradeConfig[g].color" style="font-size:14px;width:14px;height:14px">
                {{ gradeConfig[g].icon }}
              </mat-icon>
              <span>{{ gradeConfig[g].label }}</span>
            </div>
          }
        </div>
      </div>

    } @else {
      <div class="empty-state">
        <div class="empty-icon">📊</div>
        <div class="empty-title">No progress data yet</div>
        <div class="empty-sub">Record the first observation for this student to start tracking their development.</div>
        <button class="btn-primary-custom" (click)="observationRecorded.emit('')">
          <mat-icon style="font-size:16px;width:16px;height:16px">add</mat-icon>
          Record First Observation
        </button>
      </div>
    }
  `,
  styles: [`
    .loading-state {
      display: flex; align-items: center; gap: 12px;
      justify-content: center; padding: 60px; color: var(--text-3); font-size: 13px;
    }

    /* Overall bar */
    .overall-bar {
      display: flex; height: 10px; border-radius: 5px; overflow: hidden;
      background: var(--border); margin-bottom: 8px;
    }
    .ob-segment { height: 100%; transition: width .4s; min-width: 2px; }

    .overall-legend { display: flex; gap: 14px; flex-wrap: wrap; margin-bottom: 20px; }
    .ol-item { display: flex; align-items: center; gap: 5px; font-size: 12px; color: var(--text-2); }
    .ol-dot  { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
    .ol-item.total { margin-left: auto; font-weight: 600; font-size: 13px; color: var(--text); }

    /* Domain cards */
    .domains-grid {
      display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 14px;
      margin-bottom: 16px;
    }
    .domain-card {
      background: var(--surface); border: 1px solid var(--border);
      border-radius: 10px; overflow: hidden;
    }
    .dc-header {
      display: flex; align-items: center; gap: 10px;
      padding: 12px 14px; border-bottom: 2px solid;
    }
    .dc-icon {
      width: 34px; height: 34px; border-radius: 8px;
      display: flex; align-items: center; justify-content: center;
      font-size: 16px; flex-shrink: 0;
    }
    .dc-name  { font-size: 13px; font-weight: 600; color: var(--text); }
    .dc-stats { font-size: 11px; color: var(--text-3); margin-top: 1px; }
    .dc-pct   { margin-left: auto; font-size: 18px; font-weight: 700; }

    .dc-bar {
      display: flex; height: 5px; background: var(--border-light);
    }
    .dcb-seg { height: 100%; min-width: 2px; }

    /* Milestones grid */
    .milestones-grid {
      display: flex; flex-wrap: wrap; gap: 6px; padding: 12px 14px;
    }
    .milestone-chip {
      display: flex; align-items: center; gap: 4px;
      padding: 4px 8px; border-radius: 6px; border: 1px solid;
      cursor: pointer; transition: all .12s;
      &:hover { filter: brightness(.95); transform: translateY(-1px); }
    }
    .mc-code {
      font-family: 'SF Mono', monospace; font-size: 10px; font-weight: 600;
      color: var(--text-2);
    }

    /* Grade legend */
    .grade-legend {
      display: flex; align-items: center; gap: 16px; flex-wrap: wrap;
      padding: 12px 14px; background: var(--surface); border: 1px solid var(--border);
      border-radius: 9px;
    }
    .gl-title { font-size: 11px; color: var(--text-3); }
    .gl-items { display: flex; gap: 14px; flex-wrap: wrap; }
    .gl-item  { display: flex; align-items: center; gap: 4px; font-size: 11.5px; color: var(--text-2); }

    /* Buttons */
    .btn-primary-custom {
      display: inline-flex; align-items: center; gap: 6px;
      background: var(--blue); color: #fff;
      border: none; border-radius: 8px; padding: 0 16px; height: 36px;
      font-size: 13px; font-weight: 500; cursor: pointer;
      &:hover { background: #1D4ED8; }
    }
    .empty-state {
      display: flex; flex-direction: column; align-items: center; gap: 10px;
      padding: 60px; color: var(--text-3);
      .empty-icon  { font-size: 40px; }
      .empty-title { font-size: 15px; font-weight: 600; color: var(--text-2); }
      .empty-sub   { font-size: 13px; text-align: center; max-width: 320px; }
    }
  `],
})
export class StudentProgressComponent implements OnChanges {
  private api = inject(ApiService);

  @Input() studentId!: string;
  @Input() domains: Domain[] = [];
  @Output() observationRecorded = new EventEmitter<string>();
  @Output() progressLoaded       = new EventEmitter<any[]>();

  progress  = signal<DomainProgress[]>([]);
  loading   = signal(false);

  gradeConfig = GRADE_CONFIG;
  gradeKeys   = ['not_started', 'in_progress', 'led', 'mastered'];

  gradeSummary = () => {
    const all = this.progress().flatMap(d => d.milestones);
    const total = all.length || 1;
    return this.gradeKeys.map(g => ({
      grade: g,
      label: GRADE_CONFIG[g].label,
      color: GRADE_CONFIG[g].color,
      count: all.filter(m => (m.grade ?? 'not_started') === g).length,
      pct:   Math.round(all.filter(m => (m.grade ?? 'not_started') === g).length / total * 100),
    }));
  };

  overallMastery = () => {
    const all = this.progress().flatMap(d => d.milestones);
    if (!all.length) return 0;
    return Math.round(all.filter(m => m.grade === 'mastered').length / all.length * 100);
  };

  ngOnChanges() {
    if (this.studentId) this.loadProgress();
  }

  loadProgress() {
    this.loading.set(true);
    this.api.get<any>('/observations/progress/' + this.studentId).subscribe({
      next: (res: any) => { this.progress.set(res.data ?? []); this.loading.set(false); this.progressLoaded.emit(res.data ?? []); },
      error: () => this.loading.set(false),
    });
  }

  getDomainGrades(d: DomainProgress) {
    const total = d.total || 1;
    return this.gradeKeys.map(g => ({
      grade: g, color: GRADE_CONFIG[g].color,
      count: (d as any)[g] ?? 0,
      pct:   Math.round(((d as any)[g] ?? 0) / total * 100),
      label: GRADE_CONFIG[g].label,
    }));
  }

  getGradeConfig(grade: string | null) {
    return GRADE_CONFIG[grade ?? 'not_started'] ?? GRADE_CONFIG['not_started'];
  }

  getDomainColor(code: string): string {
    const map: Record<string, string> = {
      practical_life: '#F59E0B', language: '#3B82F6',
      mathematics: '#8B5CF6', cultural: '#10B981', social_emotional: '#EC4899',
    };
    return map[code] ?? '#6B7280';
  }

  getDomainEmoji(code: string): string {
    const map: Record<string, string> = {
      practical_life: '🏠', language: '📖',
      mathematics: '🔢', cultural: '🌍', social_emotional: '💛',
    };
    return map[code] ?? '📌';
  }
}
