import { Component, inject, signal, OnInit, computed } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatMenuModule } from '@angular/material/menu';
import { MatSnackBar } from '@angular/material/snack-bar';
import { DatePipe, TitleCasePipe } from '@angular/common';
import { ApiService } from '../../core/services/api.service';
import type { SchoolClass } from '../../core/models';

@Component({
  selector: 'app-journal-reports',
  standalone: true,
  imports: [
    MatIconModule, MatProgressSpinnerModule,
    MatMenuModule, DatePipe, TitleCasePipe,
  ],
  template: `
    <div class="reports-shell">

      <!-- Report tabs -->
      <div class="report-tabs">
        @for (t of reportTabs; track t.key) {
          <button class="rtab" [class.active]="activeReport() === t.key"
                  (click)="activeReport.set(t.key); loadReport()">
            {{ t.emoji }} {{ t.label }}
          </button>
        }
      </div>

      <!-- ── Completion Report ─────────────────────────────────── -->
      @if (activeReport() === 'completion') {
        <div class="report-panel">
          <div class="report-header">
            <div>
              <div class="rh-title">Journal Completion</div>
              <div class="rh-sub">How many journals have been written today per class</div>
            </div>
            <div class="rh-controls">
              <input class="field-input" type="date" [value]="completionDate()"
                     (change)="completionDate.set($any($event.target).value); loadCompletion()">
              <button class="btn-outline-sm" (click)="exportCompletion()">
                <mat-icon style="font-size:14px;width:14px;height:14px">download</mat-icon> Export
              </button>
            </div>
          </div>

          @if (completionLoading()) {
            <div class="loading-row"><mat-progress-spinner diameter="24" mode="indeterminate" /></div>
          } @else if (completionData().length) {

            <!-- School summary -->
            <div class="school-summary">
              <div class="ss-item blue">
                <div class="ss-val">{{ schoolTotal() }}</div>
                <div class="ss-lbl">Students</div>
              </div>
              <div class="ss-item green">
                <div class="ss-val">{{ schoolWritten() }}</div>
                <div class="ss-lbl">Written</div>
              </div>
              <div class="ss-item amber">
                <div class="ss-val">{{ schoolPublished() }}</div>
                <div class="ss-lbl">Published</div>
              </div>
              <div class="ss-item purple">
                <div class="ss-val">{{ schoolCompletionPct() }}%</div>
                <div class="ss-lbl">Completion</div>
              </div>
            </div>

            <!-- Per class breakdown -->
            <div class="class-breakdown">
              @for (cls of completionData(); track cls.class_id) {
                <div class="cb-row">
                  <div class="cbr-name">{{ cls.class_name }}</div>
                  <div class="cbr-stats">
                    <span class="cbr-written">{{ cls.journals_written }}/{{ cls.total_students }}</span>
                    <span class="cbr-pub">{{ cls.published }} published</span>
                  </div>
                  <div class="cbr-bar-wrap">
                    <div class="cbr-track">
                      <div class="cbr-fill written"
                           [style.width.%]="cls.completion_pct"></div>
                      <div class="cbr-fill published"
                           [style.width.%]="cls.total_students > 0 ? (cls.published / cls.total_students * 100) : 0"></div>
                    </div>
                    <span class="cbr-pct"
                          [style.color]="cls.completion_pct >= 80 ? 'var(--green)' : cls.completion_pct >= 50 ? 'var(--amber)' : 'var(--red)'">
                      {{ cls.completion_pct }}%
                    </span>
                  </div>
                </div>
              }
            </div>

            <!-- Missing journals -->
            @if (missingStudents().length) {
              <div class="missing-section">
                <div class="missing-title">
                  <mat-icon style="font-size:14px;width:14px;height:14px;color:var(--amber)">warning</mat-icon>
                  {{ missingStudents().length }} students without journals today
                </div>
              </div>
            }
          } @else {
            <div class="empty-report">No data for selected date.</div>
          }
        </div>
      }

      <!-- ── Mood Trends ────────────────────────────────────────── -->
      @if (activeReport() === 'mood') {
        <div class="report-panel">
          <div class="report-header">
            <div>
              <div class="rh-title">Mood & Wellness Trends</div>
              <div class="rh-sub">School-wide mood distribution over the selected period</div>
            </div>
            <div class="rh-controls">
              <select class="field-input" [value]="moodDays()"
                      (change)="moodDays.set(+$any($event.target).value); loadMoodSummary()">
                <option [value]="7">Last 7 days</option>
                <option [value]="14">Last 14 days</option>
                <option [value]="30">Last 30 days</option>
              </select>
            </div>
          </div>

          @if (moodLoading()) {
            <div class="loading-row"><mat-progress-spinner diameter="24" mode="indeterminate" /></div>
          } @else if (moodSummary()) {

            <!-- Mood breakdown cards -->
            <div class="mood-summary-grid">
              @for (m of moodCards(); track m.mood) {
                <div class="mood-summary-card" [style.border-color]="m.color + '40'">
                  <div class="msc-top">
                    <span class="msc-emoji">{{ m.emoji }}</span>
                    <span class="msc-pct" [style.color]="m.color">{{ m.pct }}%</span>
                  </div>
                  <div class="msc-label">{{ m.label }}</div>
                  <div class="msc-count">{{ m.count }} journals</div>
                  <div class="msc-bar">
                    <div class="msc-fill" [style.width.%]="m.pct" [style.background]="m.color"></div>
                  </div>
                </div>
              }
            </div>

            <!-- Daily trend chart -->
            @if (moodByDay().length) {
              <div class="trend-section">
                <div class="ts-title">Daily Journal Count</div>
                <div class="trend-chart">
                  @for (day of moodByDay(); track day.date) {
                    <div class="tc-col">
                      <div class="tc-bars">
                        <div class="tc-bar happy"
                             [style.height.px]="barHeight(day.happy, maxDayTotal())"
                             [title]="'Happy: ' + day.happy"></div>
                        <div class="tc-bar calm"
                             [style.height.px]="barHeight(day.calm, maxDayTotal())"
                             [title]="'Calm: ' + day.calm"></div>
                        <div class="tc-bar unsettled"
                             [style.height.px]="barHeight(day.unsettled, maxDayTotal())"
                             [title]="'Unsettled: ' + day.unsettled"></div>
                        <div class="tc-bar upset"
                             [style.height.px]="barHeight(day.upset, maxDayTotal())"
                             [title]="'Upset: ' + day.upset"></div>
                      </div>
                      <div class="tc-label">{{ day.date | date:'d MMM' }}</div>
                    </div>
                  }
                </div>
                <div class="chart-legend">
                  @for (m of moodCards(); track m.mood) {
                    <div class="legend-item">
                      <div class="legend-dot" [style.background]="m.color"></div>
                      <span>{{ m.label }}</span>
                    </div>
                  }
                </div>
              </div>
            }

          } @else {
            <div class="empty-report">No mood data for selected period.</div>
          }
        </div>
      }

      <!-- ── Weekly Digest ──────────────────────────────────────── -->
      @if (activeReport() === 'digest') {
        <div class="report-panel">
          <div class="report-header">
            <div>
              <div class="rh-title">Weekly Digest</div>
              <div class="rh-sub">Full journal summary for a student over a week</div>
            </div>
            <div class="rh-controls">
              <select class="field-input" [value]="digestClass()"
                      (change)="digestClass.set($any($event.target).value); loadDigestStudents()">
                <option value="">All Classes</option>
                @for (cls of classes(); track cls.id) {
                  <option [value]="cls.id">{{ cls.name }}</option>
                }
              </select>
              <select class="field-input" [value]="digestStudentId()"
                      (change)="digestStudentId.set($any($event.target).value); loadDigest()">
                <option value="">— Select student —</option>
                @for (s of digestStudents(); track s.id) {
                  <option [value]="s.id">{{ s.first_name }} {{ s.last_name }}</option>
                }
              </select>
              <input class="field-input" type="date" [value]="digestWeekStart()"
                     (change)="digestWeekStart.set($any($event.target).value); loadDigest()">
              @if (digestData().length) {
                <button class="btn-outline-sm" (click)="printDigest()">
                  <mat-icon style="font-size:14px;width:14px;height:14px">print</mat-icon> Print
                </button>
              }
            </div>
          </div>

          @if (digestLoading()) {
            <div class="loading-row"><mat-progress-spinner diameter="24" mode="indeterminate" /></div>
          } @else if (!digestStudentId()) {
            <div class="empty-report">Select a student to view their weekly digest.</div>
          } @else if (!digestData().length) {
            <div class="empty-report">No journals found for this week.</div>
          } @else {
            <div class="digest-grid" id="digest-print-area">
              @for (entry of digestData(); track entry.date) {
                <div class="digest-card">
                  <div class="dc-date">
                    <div class="dc-day">{{ entry.date | date:'EEEE' }}</div>
                    <div class="dc-full">{{ entry.date | date:'d MMM yyyy' }}</div>
                    @if (entry.mood) {
                      <div class="dc-mood">{{ getMoodEmoji(entry.mood) }}</div>
                    }
                  </div>

                  @if (entry.teacher_note) {
                    <div class="dc-note">{{ entry.teacher_note }}</div>
                  }

                  <div class="dc-chips">
                    @if (entry.meal?.lunch) {
                      <span class="dc-chip meal">🍽 Lunch: {{ entry.meal.lunch | titlecase }}</span>
                    }
                    @if (entry.nap?.quality) {
                      <span class="dc-chip nap">😴 Nap: {{ entry.nap.quality | titlecase }}</span>
                    }
                    @if (entry.activities?.length) {
                      <span class="dc-chip act">🎯 {{ entry.activities.length }} activities</span>
                    }
                    @if (entry.toilet?.count > 0) {
                      <span class="dc-chip toilet">🚿 {{ entry.toilet.count }}x</span>
                    }
                  </div>

                  @if (entry.activities?.length) {
                    <div class="dc-acts">
                      @for (a of entry.activities; track a.type) {
                        <div class="dc-act">
                          <span class="dca-type">{{ a.type.replace('_',' ') | titlecase }}</span>
                          <span class="dca-desc">{{ a.description }}</span>
                        </div>
                      }
                    </div>
                  }

                  @if (!entry.published_at) {
                    <div class="dc-draft">Draft — not shared with parent</div>
                  }
                </div>
              }
            </div>
          }
        </div>
      }

    </div>
  `,
  styles: [`
    .reports-shell { display: flex; flex-direction: column; gap: 16px; }

    /* Report tabs */
    .report-tabs {
      display: flex; gap: 4px;
      background: var(--surface); border: 1px solid var(--border);
      border-radius: 10px; padding: 6px; width: fit-content;
    }
    .rtab {
      background: none; border: none; cursor: pointer;
      padding: 7px 16px; border-radius: 7px;
      font-size: 13px; font-weight: 500; color: var(--text-3); white-space: nowrap;
      transition: all .12s;
      &:hover  { background: var(--bg); color: var(--text-2); }
      &.active { background: var(--blue); color: #fff; }
    }

    /* Report panel */
    .report-panel {
      background: var(--surface); border: 1px solid var(--border);
      border-radius: 10px; overflow: hidden;
    }
    .report-header {
      display: flex; align-items: flex-start; justify-content: space-between;
      padding: 16px 18px; border-bottom: 1px solid var(--border); gap: 16px;
    }
    .rh-title { font-size: 14px; font-weight: 600; color: var(--text); }
    .rh-sub   { font-size: 12px; color: var(--text-3); margin-top: 2px; }
    .rh-controls { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; flex-shrink: 0; }

    .field-input {
      height: 34px; padding: 0 9px;
      background: var(--bg); border: 1px solid var(--border);
      border-radius: 7px; font-size: 12.5px; color: var(--text);
      outline: none; font-family: inherit;
      &:focus { border-color: var(--blue); }
    }
    select.field-input { cursor: pointer; }

    .btn-outline-sm {
      display: inline-flex; align-items: center; gap: 5px;
      background: #fff; color: var(--text-2);
      border: 1px solid var(--border); border-radius: 7px;
      padding: 0 12px; height: 34px; font-size: 12px; font-weight: 500; cursor: pointer;
      &:hover { background: var(--bg); }
    }

    .loading-row {
      display: flex; justify-content: center; padding: 40px;
    }
    .empty-report {
      text-align: center; padding: 48px; color: var(--text-3); font-size: 13px;
    }

    /* Completion */
    .school-summary {
      display: flex; gap: 1px; background: var(--border);
      border-bottom: 1px solid var(--border);
    }
    .ss-item {
      flex: 1; text-align: center; padding: 14px; background: var(--surface);
      .ss-val { font-size: 22px; font-weight: 700; }
      .ss-lbl { font-size: 11px; color: var(--text-3); margin-top: 2px; }
      &.blue   .ss-val { color: var(--blue); }
      &.green  .ss-val { color: var(--green); }
      &.amber  .ss-val { color: var(--amber); }
      &.purple .ss-val { color: var(--purple); }
    }

    .class-breakdown { padding: 14px 18px; display: flex; flex-direction: column; gap: 12px; }
    .cb-row { display: flex; align-items: center; gap: 14px; }
    .cbr-name  { font-size: 13px; font-weight: 500; color: var(--text); width: 120px; flex-shrink: 0; }
    .cbr-stats { display: flex; flex-direction: column; gap: 1px; width: 100px; flex-shrink: 0; }
    .cbr-written { font-size: 13px; font-weight: 600; color: var(--text); }
    .cbr-pub     { font-size: 10px; color: var(--text-3); }
    .cbr-bar-wrap { flex: 1; display: flex; align-items: center; gap: 8px; }
    .cbr-track {
      flex: 1; height: 8px; background: var(--border); border-radius: 4px; overflow: hidden;
      position: relative;
    }
    .cbr-fill {
      position: absolute; height: 100%; border-radius: 4px;
      &.written   { background: var(--blue-mid); }
      &.published { background: var(--blue); }
    }
    .cbr-pct { font-size: 12px; font-weight: 600; width: 40px; text-align: right; flex-shrink: 0; }

    .missing-section { padding: 10px 18px 14px; }
    .missing-title {
      display: flex; align-items: center; gap: 6px;
      font-size: 12px; color: var(--amber); font-weight: 500;
    }

    /* Mood summary */
    .mood-summary-grid {
      display: grid; grid-template-columns: repeat(4,1fr); gap: 1px;
      background: var(--border); border-bottom: 1px solid var(--border);
    }
    .mood-summary-card {
      background: var(--surface); padding: 16px;
      border-bottom: 3px solid transparent;
    }
    .msc-top   { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 4px; }
    .msc-emoji { font-size: 24px; line-height: 1; }
    .msc-pct   { font-size: 20px; font-weight: 700; }
    .msc-label { font-size: 13px; font-weight: 500; color: var(--text); }
    .msc-count { font-size: 11px; color: var(--text-3); margin-top: 2px; margin-bottom: 8px; }
    .msc-bar   { height: 4px; background: var(--border); border-radius: 2px; overflow: hidden; }
    .msc-fill  { height: 100%; border-radius: 2px; transition: width .4s; }

    /* Trend chart */
    .trend-section { padding: 16px 18px; }
    .ts-title { font-size: 12px; font-weight: 600; color: var(--text-3); text-transform: uppercase; letter-spacing: .4px; margin-bottom: 12px; }
    .trend-chart { display: flex; align-items: flex-end; gap: 4px; height: 100px; overflow-x: auto; }
    .tc-col { display: flex; flex-direction: column; align-items: center; gap: 4px; flex-shrink: 0; min-width: 36px; }
    .tc-bars { display: flex; align-items: flex-end; gap: 1px; height: 80px; }
    .tc-bar {
      width: 7px; border-radius: 2px 2px 0 0; min-height: 2px; transition: height .3s;
      &.happy     { background: #10B981; }
      &.calm      { background: #3B82F6; }
      &.unsettled { background: #F59E0B; }
      &.upset     { background: #EF4444; }
    }
    .tc-label { font-size: 9px; color: var(--text-4); white-space: nowrap; }
    .chart-legend { display: flex; gap: 14px; margin-top: 10px; }
    .legend-item { display: flex; align-items: center; gap: 5px; font-size: 11px; color: var(--text-3); }
    .legend-dot  { width: 8px; height: 8px; border-radius: 50%; }

    /* Weekly digest */
    .digest-grid {
      padding: 16px 18px; display: flex; flex-direction: column; gap: 10px;
    }
    .digest-card {
      border: 1px solid var(--border); border-radius: 9px; overflow: hidden;
    }
    .dc-date {
      display: flex; align-items: center; gap: 10px;
      padding: 10px 14px; background: var(--bg); border-bottom: 1px solid var(--border);
    }
    .dc-day  { font-size: 12px; font-weight: 600; color: var(--text); width: 80px; }
    .dc-full { font-size: 11px; color: var(--text-3); }
    .dc-mood { font-size: 20px; margin-left: auto; }
    .dc-note {
      padding: 10px 14px; font-size: 12.5px; color: var(--text-2);
      line-height: 1.6; font-style: italic; background: #FFFBEB;
      border-bottom: 1px solid #FDE68A;
    }
    .dc-chips {
      display: flex; gap: 6px; flex-wrap: wrap; padding: 8px 14px;
      border-bottom: 1px solid var(--border-light);
    }
    .dc-chip {
      font-size: 11px; padding: 2px 8px; border-radius: 5px;
      &.meal   { background: #FFF7ED; color: #92400E; }
      &.nap    { background: var(--purple-light); color: var(--purple); }
      &.act    { background: var(--blue-light); color: var(--blue); }
      &.toilet { background: #F0FDF4; color: #065F46; }
    }
    .dc-acts { padding: 8px 14px; display: flex; flex-direction: column; gap: 4px; }
    .dc-act  { display: flex; gap: 8px; align-items: baseline; font-size: 12px; }
    .dca-type { color: var(--blue); font-weight: 500; flex-shrink: 0; }
    .dca-desc { color: var(--text-2); }
    .dc-draft {
      padding: 6px 14px; background: var(--amber-light);
      font-size: 11px; color: #92400E;
    }

    @media print {
      .report-tabs, .report-header, .rh-controls { display: none !important; }
      .digest-grid { padding: 0; }
    }
  `],
})
export class JournalReportsComponent implements OnInit {
  private api   = inject(ApiService);
  private snack = inject(MatSnackBar);

  classes        = signal<SchoolClass[]>([]);
  activeReport   = signal('completion');

  // Completion
  completionDate    = signal(new Date().toISOString().slice(0, 10));
  completionData    = signal<any[]>([]);
  completionLoading = signal(false);
  missingStudents   = signal<any[]>([]);

  schoolTotal      = computed(() => this.completionData().reduce((s, c) => s + c.total_students, 0));
  schoolWritten    = computed(() => this.completionData().reduce((s, c) => s + c.journals_written, 0));
  schoolPublished  = computed(() => this.completionData().reduce((s, c) => s + c.published, 0));
  schoolCompletionPct = computed(() => {
    const t = this.schoolTotal(); const w = this.schoolWritten();
    return t > 0 ? Math.round(w / t * 100) : 0;
  });

  // Mood
  moodDays      = signal(30);
  moodSummary   = signal<any>(null);
  moodByDay     = signal<any[]>([]);
  moodLoading   = signal(false);
  maxDayTotal   = computed(() => Math.max(...this.moodByDay().map(d => d.total || 0), 1));

  moodCards = computed(() => {
    const s = this.moodSummary()?.summary;
    if (!s) return [];
    const total = +s.total || 1;
    return [
      { mood: 'happy',     emoji: '😊', label: 'Happy',     color: '#10B981', count: +s.happy    || 0, pct: Math.round((+s.happy    || 0) / total * 100) },
      { mood: 'calm',      emoji: '😌', label: 'Calm',      color: '#3B82F6', count: +s.calm     || 0, pct: Math.round((+s.calm     || 0) / total * 100) },
      { mood: 'unsettled', emoji: '😟', label: 'Unsettled', color: '#F59E0B', count: +s.unsettled|| 0, pct: Math.round((+s.unsettled|| 0) / total * 100) },
      { mood: 'upset',     emoji: '😢', label: 'Upset',     color: '#EF4444', count: +s.upset    || 0, pct: Math.round((+s.upset    || 0) / total * 100) },
    ];
  });

  // Digest
  digestClass      = signal('');
  digestStudentId  = signal('');
  digestWeekStart  = signal(this.getMonday());
  digestStudents   = signal<any[]>([]);
  digestData       = signal<any[]>([]);
  digestLoading    = signal(false);

  reportTabs = [
    { key: 'completion', emoji: '📊', label: 'Completion' },
    { key: 'mood',       emoji: '😊', label: 'Mood Trends' },
    { key: 'digest',     emoji: '📋', label: 'Weekly Digest' },
  ];

  ngOnInit() {
    this.api.get<any>('/students/classes').subscribe({
      next: (res: any) => this.classes.set(res.data ?? []),
    });
    this.loadCompletion();
  }

  loadReport() {
    this.loadCompletion();
    this.loadDigestStudents(); // pre-load all students
  }

  loadCompletion() {
    this.completionLoading.set(true);
    this.api.get<any>('/journals/reports/completion', { date: this.completionDate() }).subscribe({
      next: (res: any) => { this.completionData.set(res.data ?? []); this.completionLoading.set(false); },
      error: () => this.completionLoading.set(false),
    });
  }

  loadMoodSummary() {
    this.moodLoading.set(true);
    const to   = new Date().toISOString().slice(0, 10);
    const from = new Date(Date.now() - this.moodDays() * 864e5).toISOString().slice(0, 10);
    this.api.get<any>('/journals/reports/mood-summary', { from, to }).subscribe({
      next: (res: any) => {
        this.moodSummary.set(res.data);
        this.moodByDay.set(res.data?.byDay ?? []);
        this.moodLoading.set(false);
      },
      error: () => this.moodLoading.set(false),
    });
  }

  loadDigestStudents() {
    const params: Record<string, string> = { limit: '500', page: '1', is_active: 'true' };
    if (this.digestClass()) params['class_id'] = this.digestClass();
    this.api.get<any>('/students', params).subscribe({
      next: (res: any) => {
        this.digestStudents.set(res.data ?? []);
        // If student was selected but now class changed, reset if not in new list
        if (this.digestStudentId() && !res.data.find((s: any) => s.id === this.digestStudentId())) {
          this.digestStudentId.set('');
          this.digestData.set([]);
        }
      },
    });
  }

  loadDigest() {
    if (!this.digestStudentId()) return;
    this.digestLoading.set(true);
    this.digestData.set([]);
    this.api.get<any>('/journals/students/' + this.digestStudentId() + '/weekly-digest', {
      week_start: this.digestWeekStart(),
    }).subscribe({
      next: (res: any) => {
        this.digestData.set(res.data ?? []);
        this.digestLoading.set(false);
      },
      error: (err: any) => {
        console.error('Weekly digest error:', err);
        this.digestLoading.set(false);
      },
    });
  }

  barHeight(val: number, max: number): number {
    return max > 0 ? Math.round((val / max) * 70) : 0;
  }

  getMoodEmoji(mood: string): string {
    const m: Record<string, string> = { happy: '😊', calm: '😌', unsettled: '😟', upset: '😢' };
    return m[mood] ?? '😐';
  }

  getMonday(): string {
    const d = new Date();
    d.setDate(d.getDate() - (d.getDay() || 7) + 1);
    return d.toISOString().slice(0, 10);
  }

  exportCompletion() {
    const rows = [['Class', 'Total Students', 'Journals Written', 'Published', 'Completion %']];
    this.completionData().forEach(c => rows.push([c.class_name, c.total_students, c.journals_written, c.published, c.completion_pct + '%']));
    const csv = rows.map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = 'journal-completion-' + this.completionDate() + '.csv';
    a.click(); URL.revokeObjectURL(url);
  }

  printDigest() {
    const student = this.digestStudents().find(s => s.id === this.digestStudentId());
    const name = student ? student.first_name + ' ' + student.last_name : 'Student';
    const content = document.getElementById('digest-print-area');
    if (!content) return;
    const win = window.open('', '_blank', 'width=700,height=900');
    if (!win) return;
    win.document.write(`
      <!DOCTYPE html><html><head>
      <title>Weekly Journal — ${name}</title>
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, sans-serif; }
        body { padding: 24px; color: #111; font-size: 13px; }
        h1 { font-size: 18px; margin-bottom: 4px; }
        .sub { font-size: 12px; color: #666; margin-bottom: 20px; }
        .digest-card { border: 1px solid #E5E7EB; border-radius: 8px; margin-bottom: 12px; overflow: hidden; }
        .dc-date { display: flex; align-items: center; gap: 10px; padding: 8px 12px; background: #F9FAFB; border-bottom: 1px solid #E5E7EB; }
        .dc-day  { font-weight: 600; width: 80px; }
        .dc-full { color: #6B7280; font-size: 11px; }
        .dc-mood { margin-left: auto; font-size: 18px; }
        .dc-note { padding: 10px 12px; background: #FFFBEB; border-bottom: 1px solid #FDE68A; font-style: italic; color: #78350F; line-height: 1.6; }
        .dc-chips { display: flex; gap: 6px; flex-wrap: wrap; padding: 8px 12px; }
        .dc-chip { font-size: 11px; padding: 2px 8px; border-radius: 4px; background: #F3F4F6; }
        .dc-acts { padding: 8px 12px; }
        .dc-act  { display: flex; gap: 8px; margin-bottom: 3px; font-size: 12px; }
        .dca-type { color: #2563EB; font-weight: 500; }
      </style>
      </head><body>
      <h1>Weekly Journal — ${name}</h1>
      <div class="sub">Week of ${this.digestWeekStart()}</div>
      ${content.innerHTML}
      </body></html>
    `);
    win.document.close();
    setTimeout(() => { win.print(); win.close(); }, 400);
  }
}
