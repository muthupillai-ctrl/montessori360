import { Component, inject, signal, OnInit, computed } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatMenuModule } from '@angular/material/menu';
import { MatTabsModule } from '@angular/material/tabs';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { DatePipe, SlicePipe } from '@angular/common';
import { ApiService } from '../../core/services/api.service';
import { JournalFormDialogComponent } from './journal-form-dialog.component';
import { JournalReportsComponent } from './journal-reports.component';
import { JournalViewDialogComponent } from './journal-view-dialog.component';
import type { SchoolClass } from '../../core/models';

export interface Journal {
  id:           string;
  student_id:   string;
  student_name: string;
  admission_no: string;
  class_name:   string;
  journal_date: string;
  mood:         string | null;
  teacher_note: string | null;
  published_at: string | null;
  activities:   any[];
  meal:         any;
  nap:          any;
  toilet:       any;
  homework:     any[];
  mood_note:    string | null;
  author_name:  string | null;
}

@Component({
  selector: 'app-journal',
  standalone: true,
  imports: [
    MatIconModule, MatProgressSpinnerModule,
    MatMenuModule, MatDialogModule, MatTabsModule,
    DatePipe, SlicePipe, JournalReportsComponent,
  ],
  template: `
    <mat-tab-group class="journal-page-tabs">

      <!-- ── Journals tab ─────────────────────────────────────── -->
      <mat-tab label="📓  Journals">
        <div class="tab-body">

          <div class="page-header">
            <div>
              <h1>Daily Journals</h1>
              <div class="subtitle">
                {{ selectedDate() | date:'EEEE, d MMMM yyyy' }}
                @if (!loading()) {
                  · {{ journals().length }} entries · {{ publishedCount() }} published
                }
              </div>
            </div>
            <div class="actions">
              <button class="btn-primary-custom" (click)="openNewJournal()">
                <mat-icon style="font-size:16px;width:16px;height:16px">add</mat-icon>
                New Journal
              </button>
            </div>
          </div>

          <!-- Filter bar -->
          <div class="filter-bar">
            <div class="date-nav">
              <button class="nav-btn" (click)="changeDate(-1)">
                <mat-icon style="font-size:18px;width:18px;height:18px">chevron_left</mat-icon>
              </button>
              <input class="date-input" type="date"
                     [value]="selectedDateStr()"
                     (change)="onDateChange($any($event.target).value)" />
              <button class="nav-btn" (click)="changeDate(1)" [disabled]="isTodaySelected()">
                <mat-icon style="font-size:18px;width:18px;height:18px">chevron_right</mat-icon>
              </button>
              @if (!isTodaySelected()) {
                <button class="today-btn" (click)="goToToday()">Today</button>
              }
            </div>

            <div class="filter-selects">
              <select class="filter-select" [value]="selectedClass()"
                      (change)="onClassChange($any($event.target).value)">
                <option value="">All Classes</option>
                @for (cls of classes(); track cls.id) {
                  <option [value]="cls.id">{{ cls.name }}</option>
                }
              </select>

              <select class="filter-select" [value]="publishedFilter()"
                      (change)="publishedFilter.set($any($event.target).value); loadJournals()">
                <option value="">All</option>
                <option value="true">Published</option>
                <option value="false">Drafts</option>
              </select>
            </div>

            <button class="icon-btn" (click)="loadJournals()" title="Refresh">
              <mat-icon style="font-size:18px;width:18px;height:18px">refresh</mat-icon>
            </button>
          </div>

          <!-- Stats pills -->
          @if (!loading()) {
            <div class="stats-row">
              <div class="stat-pill blue">
                <mat-icon style="font-size:14px;width:14px;height:14px">auto_stories</mat-icon>
                <span>{{ journals().length }} Total</span>
              </div>
              <div class="stat-pill green">
                <mat-icon style="font-size:14px;width:14px;height:14px">send</mat-icon>
                <span>{{ publishedCount() }} Published</span>
              </div>
              <div class="stat-pill amber">
                <mat-icon style="font-size:14px;width:14px;height:14px">edit_note</mat-icon>
                <span>{{ unpublishedCount() }} Drafts</span>
              </div>
              @for (m of moodBreakdown(); track m.mood) {
                <div class="stat-pill" [style.background]="m.bg" [style.color]="m.color">
                  <span>{{ m.emoji }} {{ m.count }}</span>
                </div>
              }
            </div>
          }

          @if (loading()) {
            <div class="loading-state">
              <mat-progress-spinner mode="indeterminate" diameter="32" />
              <span>Loading journals…</span>
            </div>
          } @else if (!journals().length) {
            <div class="empty-state">
              <div class="empty-icon">📓</div>
              <div class="empty-title">No journals for this date</div>
              <div class="empty-sub">Start writing journals for your students.</div>
              <button class="btn-primary-custom" (click)="openNewJournal()">
                <mat-icon style="font-size:16px;width:16px;height:16px">add</mat-icon>
                Write First Journal
              </button>
            </div>
          } @else {
            <div class="journals-grid">
              @for (j of journals(); track j.id) {
                <div class="journal-card" (click)="viewJournal(j)">

                  <div class="jc-header">
                    <div class="jc-av" [style.background]="getAvatarColor(j.student_name)">
                      {{ j.student_name[0] }}
                    </div>
                    <div class="jc-info">
                      <div class="jc-name">{{ j.student_name }}</div>
                      <div class="jc-meta">{{ j.class_name }} · {{ j.admission_no }}</div>
                    </div>
                    <div class="jc-mood">{{ getMoodEmoji(j.mood) }}</div>
                    <button class="jc-menu-btn" [matMenuTriggerFor]="cardMenu"
                            (click)="$event.stopPropagation()">
                      <mat-icon style="font-size:16px;width:16px;height:16px">more_horiz</mat-icon>
                    </button>
                    <mat-menu #cardMenu="matMenu">
                      <button mat-menu-item (click)="viewJournal(j)">
                        <mat-icon>visibility</mat-icon> View
                      </button>
                      <button mat-menu-item (click)="editJournal(j)">
                        <mat-icon>edit</mat-icon> Edit
                      </button>
                      @if (!j.published_at) {
                        <button mat-menu-item (click)="publishJournal(j)">
                          <mat-icon>send</mat-icon> Publish to Parent
                        </button>
                      }
                    </mat-menu>
                  </div>

                  <div class="jc-status">
                    @if (j.published_at) {
                      <span class="pub-badge">
                        <mat-icon style="font-size:11px;width:11px;height:11px">check_circle</mat-icon>
                        Published {{ j.published_at | date:'h:mm a' }}
                      </span>
                    } @else {
                      <span class="draft-badge">
                        <mat-icon style="font-size:11px;width:11px;height:11px">edit_note</mat-icon>
                        Draft
                      </span>
                    }
                  </div>

                  <div class="jc-preview">
                    @if (j.teacher_note) {
                      <div class="preview-note">
                        {{ j.teacher_note | slice:0:100 }}{{ j.teacher_note.length > 100 ? '…' : '' }}
                      </div>
                    }
                    <div class="jc-chips">
                      @if (j.meal?.lunch) {
                        <span class="chip meal">🍽 {{ j.meal.lunch }}</span>
                      }
                      @if (j.nap?.quality) {
                        <span class="chip nap">😴 {{ j.nap.quality }}</span>
                      }
                      @if (j.activities && j.activities.length) {
                        <span class="chip activity">🎯 {{ j.activities.length }} activities</span>
                      }
                      @if (j.toilet?.count > 0) {
                        <span class="chip toilet">🚿 {{ j.toilet.count }}x</span>
                      }
                    </div>
                  </div>

                </div>
              }
            </div>
          }

        </div>
      </mat-tab>

      <!-- ── Reports tab ───────────────────────────────────────── -->
      <mat-tab label="📊  Reports">
        <div class="tab-body">
          <app-journal-reports />
        </div>
      </mat-tab>

    </mat-tab-group>
  `,
  styles: [`
    ::ng-deep .journal-page-tabs .mat-mdc-tab-body-wrapper { padding: 0; }
    .tab-body { padding-top: 16px; }

    .btn-primary-custom {
      display: inline-flex; align-items: center; gap: 6px;
      background: var(--blue); color: #fff;
      border: none; border-radius: 8px; padding: 0 16px; height: 36px;
      font-size: 13px; font-weight: 500; cursor: pointer;
      &:hover:not(:disabled) { background: #1D4ED8; }
      &:disabled { opacity: 1; cursor: not-allowed; color: var(--text-4); border-color: var(--border-light); background: var(--bg); }
    }
    .filter-bar { display: flex; gap: 10px; align-items: center; margin-bottom: 14px; flex-wrap: wrap; }
    .date-nav {
      display: flex; align-items: center; gap: 4px;
      background: var(--surface); border: 1px solid var(--border);
      border-radius: 8px; padding: 2px 4px; height: 36px;
    }
    .nav-btn {
      background: none; border: none; cursor: pointer; color: var(--text-3);
      width: 28px; height: 28px; border-radius: 5px;
      display: flex; align-items: center; justify-content: center;
      &:hover { background: var(--bg); }
      &:disabled { opacity: .4; cursor: not-allowed; }
    }
    .date-input {
      border: none; outline: none; font-size: 13px; color: var(--text);
      background: transparent; font-family: inherit; cursor: pointer;
    }
    .today-btn {
      background: var(--blue-light); color: var(--blue); border: none;
      border-radius: 5px; padding: 2px 8px; font-size: 11px; font-weight: 600; cursor: pointer;
    }
    .filter-selects { display: flex; gap: 8px; }
    .filter-select {
      height: 36px; padding: 0 10px;
      background: var(--surface); border: 1px solid var(--border);
      border-radius: 8px; font-size: 13px; color: var(--text-2);
      outline: none; cursor: pointer;
    }
    .icon-btn {
      width: 36px; height: 36px; border-radius: 8px;
      background: var(--surface); border: 1px solid var(--border);
      display: flex; align-items: center; justify-content: center;
      cursor: pointer; color: var(--text-3);
      &:hover { background: var(--bg); }
    }

    .stats-row { display: flex; gap: 8px; margin-bottom: 14px; flex-wrap: wrap; }
    .stat-pill {
      display: flex; align-items: center; gap: 5px;
      padding: 5px 10px; border-radius: 20px; font-size: 12px; font-weight: 500;
      &.blue  { background: var(--blue-light);  color: var(--blue); }
      &.green { background: var(--green-light); color: var(--green); }
      &.amber { background: var(--amber-light); color: var(--amber); }
    }

    .loading-state {
      display: flex; align-items: center; gap: 12px;
      justify-content: center; padding: 80px;
      color: var(--text-3); font-size: 13px;
    }
    .empty-state {
      display: flex; flex-direction: column; align-items: center; gap: 10px;
      padding: 80px; color: var(--text-3);
    }
    .empty-icon  { font-size: 48px; line-height: 1; }
    .empty-title { font-size: 16px; font-weight: 600; color: var(--text-2); }
    .empty-sub   { font-size: 13px; }

    .journals-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
      gap: 12px;
    }
    .journal-card {
      background: var(--surface); border: 1px solid var(--border);
      border-radius: 10px; overflow: hidden; cursor: pointer;
      transition: box-shadow .15s, border-color .15s;
      &:hover { box-shadow: 0 4px 16px rgba(0,0,0,.08); border-color: #D1D5DB; }
    }
    .jc-header {
      display: flex; align-items: center; gap: 10px;
      padding: 14px 14px 10px;
    }
    .jc-av {
      width: 36px; height: 36px; border-radius: 9px; flex-shrink: 0;
      color: #fff; font-size: 14px; font-weight: 700;
      display: flex; align-items: center; justify-content: center;
    }
    .jc-name { font-size: 13px; font-weight: 600; color: var(--text); }
    .jc-meta { font-size: 11px; color: var(--text-3); margin-top: 1px; }
    .jc-mood { font-size: 22px; margin-left: auto; line-height: 1; }
    .jc-menu-btn {
      background: none; border: none; cursor: pointer;
      width: 26px; height: 26px; border-radius: 5px;
      display: flex; align-items: center; justify-content: center; color: var(--text-3);
      &:hover { background: var(--bg); }
    }
    .jc-status { padding: 0 14px 8px; }
    .pub-badge {
      display: inline-flex; align-items: center; gap: 4px;
      background: var(--green-light); color: #065F46;
      font-size: 10px; font-weight: 600; padding: 2px 8px; border-radius: 10px;
    }
    .draft-badge {
      display: inline-flex; align-items: center; gap: 4px;
      background: var(--amber-light); color: #92400E;
      font-size: 10px; font-weight: 600; padding: 2px 8px; border-radius: 10px;
    }
    .jc-preview { padding: 0 14px 14px; border-top: 1px solid var(--border-light); padding-top: 10px; }
    .preview-note { font-size: 12px; color: var(--text-2); line-height: 1.5; margin-bottom: 8px; font-style: italic; }
    .jc-chips { display: flex; gap: 5px; flex-wrap: wrap; }
    .chip {
      font-size: 10px; font-weight: 500; padding: 2px 7px; border-radius: 5px;
      background: var(--bg); color: var(--text-2);
      &.meal   { background: #FFF7ED; color: #92400E; }
      &.nap    { background: var(--purple-light); color: var(--purple); }
      &.activity { background: var(--blue-light); color: var(--blue); }
      &.toilet { background: #F0FDF4; color: #065F46; }
    }
  `],
})
export class JournalComponent implements OnInit {
  private api    = inject(ApiService);
  private snack  = inject(MatSnackBar);
  private dialog = inject(MatDialog);

  journals        = signal<Journal[]>([]);
  classes         = signal<SchoolClass[]>([]);
  loading         = signal(true);
  selectedDate    = signal(new Date());
  selectedClass   = signal('');
  publishedFilter = signal('');

  publishedCount   = computed(() => this.journals().filter(j => !!j.published_at).length);
  unpublishedCount = computed(() => this.journals().filter(j => !j.published_at).length);

  moodBreakdown = computed(() => {
    const cfg: Record<string, any> = {
      happy:     { emoji: '😊', bg: '#ECFDF5', color: '#065F46' },
      calm:      { emoji: '😌', bg: '#EFF6FF', color: '#1E40AF' },
      unsettled: { emoji: '😟', bg: '#FFFBEB', color: '#92400E' },
      upset:     { emoji: '😢', bg: '#FEF2F2', color: '#991B1B' },
    };
    return ['happy','calm','unsettled','upset']
      .map(m => ({ mood: m, count: this.journals().filter(j => j.mood === m).length, ...cfg[m] }))
      .filter(m => m.count > 0);
  });

  selectedDateStr = () => this.selectedDate().toISOString().slice(0, 10);
  isTodaySelected = () => this.selectedDateStr() === new Date().toISOString().slice(0, 10);

  ngOnInit() {
    this.api.get<any>('/students/classes').subscribe({
      next: (res: any) => this.classes.set(res.data ?? []),
    });
    this.loadJournals();
  }

  loadJournals() {
    this.loading.set(true);
    const params: Record<string, string> = { date: this.selectedDateStr(), limit: '100' };
    if (this.selectedClass())    params['class_id']  = this.selectedClass();
    if (this.publishedFilter())  params['published']  = this.publishedFilter();
    this.api.get<any>('/journals', params).subscribe({
      next: (res: any) => { this.journals.set(res.data ?? []); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  onDateChange(val: string) { this.selectedDate.set(new Date(val + 'T00:00:00')); this.loadJournals(); }
  changeDate(days: number)  { const d = new Date(this.selectedDate()); d.setDate(d.getDate() + days); this.selectedDate.set(d); this.loadJournals(); }
  goToToday()               { this.selectedDate.set(new Date()); this.loadJournals(); }
  onClassChange(val: string){ this.selectedClass.set(val); this.loadJournals(); }

  getMoodEmoji(mood: string | null): string {
    const map: Record<string,string> = { happy:'😊', calm:'😌', unsettled:'😟', upset:'😢' };
    return mood ? (map[mood] ?? '😐') : '—';
  }

  getAvatarColor(name: string): string {
    const colors = ['#2563EB','#7C3AED','#DB2777','#D97706','#059669','#0891B2'];
    return colors[(name?.charCodeAt(0) || 0) % colors.length];
  }

  openNewJournal() {
    const ref = this.dialog.open(JournalFormDialogComponent, {
      width: '95vw', maxWidth: '860px', maxHeight: '90vh', disableClose: true,
      panelClass: 'journal-dialog',
      data: { date: this.selectedDateStr(), classes: this.classes() },
    });
    ref.afterClosed().subscribe((result: any) => {
      if (result) { this.snack.open('Journal saved', 'OK', { duration: 3000 }); this.loadJournals(); }
    });
  }

  editJournal(j: Journal) {
    const ref = this.dialog.open(JournalFormDialogComponent, {
      width: '95vw', maxWidth: '860px', maxHeight: '90vh', disableClose: true,
      panelClass: 'journal-dialog',
      data: { journal: j, date: this.selectedDateStr(), classes: this.classes() },
    });
    ref.afterClosed().subscribe((result: any) => {
      if (result) { this.snack.open('Journal updated', 'OK', { duration: 3000 }); this.loadJournals(); }
    });
  }

  viewJournal(j: Journal) {
    this.dialog.open(JournalViewDialogComponent, {
      width: '580px', maxHeight: '90vh', data: j,
    });
  }

  publishJournal(j: Journal) {
    this.api.patch<any>('/journals/' + j.id + '/publish', {}).subscribe({
      next: () => { this.snack.open('Journal published to parent', 'OK', { duration: 3000 }); this.loadJournals(); },
      error: (err: any) => this.snack.open(err.error?.error?.message ?? 'Error', 'OK', { duration: 3000 }),
    });
  }

  bulkPublish() {
    const body: Record<string, string> = { date: this.selectedDateStr() };
    if (this.selectedClass()) body['class_id'] = this.selectedClass();
    this.api.post<any>('/journals/bulk-publish', body).subscribe({
      next: (res: any) => {
        this.snack.open((res.data?.count ?? '?') + ' journals published', 'OK', { duration: 3000 });
        this.loadJournals();
      },
      error: (err: any) => this.snack.open(err.error?.error?.message ?? 'Error', 'OK', { duration: 3000 }),
    });
  }
}
