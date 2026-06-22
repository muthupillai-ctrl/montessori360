import { Component, inject, signal, effect } from '@angular/core';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { DatePipe, TitleCasePipe } from '@angular/common';
import { ApiService } from '../../core/services/api.service';
import { ParentStateService } from './parent-state.service';

@Component({
  selector: 'app-parent-journal',
  standalone: true,
  imports: [MatProgressSpinnerModule, DatePipe, TitleCasePipe],
  template: `
    <div class="page">

      @if (loading()) {
        <div class="loading"><mat-progress-spinner diameter="28" mode="indeterminate"/></div>
      } @else if (apiError()) {
        <div class="empty-state">
          <div class="empty-icon">⚠️</div>
          <div class="empty-title">Could not load journals</div>
          <div class="empty-sub">{{ apiError() }}</div>
        </div>
      } @else if (!entries().length) {
        <div class="empty-state">
          <div class="empty-icon">📓</div>
          <div class="empty-title">No journal entries yet</div>
          <div class="empty-sub">Your child's teacher will add journal entries here soon.</div>
        </div>
      } @else {
        <div class="feed">
          @for (entry of entries(); track entry.id) {
            <div class="journal-card">

              <!-- Date + mood row -->
              <div class="jc-header">
                <div class="jc-date-wrap">
                  <div class="jc-day">{{ entry.journal_date | date:'d' }}</div>
                  <div class="jc-month-year">
                    <div class="jc-month">{{ entry.journal_date | date:'MMM' }}</div>
                    <div class="jc-year">{{ entry.journal_date | date:'EEEE' }}</div>
                  </div>
                </div>
                @if (entry.mood) {
                  <div class="mood-chip" [class]="'mood-' + entry.mood">
                    <span class="mood-emoji">{{ moodEmoji(entry.mood) }}</span>
                    <span class="mood-label">{{ entry.mood | titlecase }}</span>
                  </div>
                }
              </div>

              <!-- Teacher note -->
              @if (entry.teacher_note) {
                <div class="note-section">
                  <div class="note-label"><i class="ti ti-message-circle"></i> Teacher's Note</div>
                  <p class="note-text">{{ entry.teacher_note }}</p>
                </div>
              }

              <!-- Meal + nap chips -->
              @if (mealSummary(entry.meal) || napMinutes(entry.nap) > 0) {
                <div class="meta-chips">
                  @if (mealSummary(entry.meal)) {
                    <div class="meta-chip">
                      <span class="meta-icon">🍽</span>
                      <span>{{ mealSummary(entry.meal) }}</span>
                    </div>
                  }
                  @if (napMinutes(entry.nap) > 0) {
                    <div class="meta-chip">
                      <span class="meta-icon">😴</span>
                      <span>Nap: {{ napMinutes(entry.nap) }}min</span>
                    </div>
                  }
                </div>
              }

              <!-- Homework -->
              @if (entry.homework?.length) {
                <div class="hw-section">
                  <div class="hw-section-title"><i class="ti ti-pencil"></i> Homework</div>
                  @for (hw of entry.homework; track $index) {
                    <div class="hw-row">
                      <div class="hw-subject">{{ hw.subject }}</div>
                      <div class="hw-desc">{{ hw.description }}</div>
                    </div>
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
    .page { padding: 16px 16px 24px; background: #F5F7FA; min-height: 100%; }
    .loading { display: flex; justify-content: center; padding: 80px; }

    /* ── Empty ── */
    .empty-state { display: flex; flex-direction: column; align-items: center; gap: 10px; padding: 80px 24px; text-align: center; }
    .empty-icon { font-size: 48px; }
    .empty-title { font-size: 16px; font-weight: 700; color: #1D2939; }
    .empty-sub { font-size: 13px; color: #98A2B3; line-height: 1.5; }

    /* ── Feed ── */
    .feed { display: flex; flex-direction: column; gap: 12px; }

    /* ── Card ── */
    .journal-card {
      background: #fff; border: 1px solid #EAECF0; border-radius: 16px;
      padding: 16px; box-shadow: 0 1px 6px rgba(0,0,0,.04);
    }

    /* ── Header ── */
    .jc-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px; }
    .jc-date-wrap { display: flex; align-items: center; gap: 10px; }
    .jc-day { font-size: 28px; font-weight: 800; color: #4F46E5; line-height: 1; }
    .jc-month { font-size: 12px; font-weight: 700; color: #344054; text-transform: uppercase; letter-spacing: .04em; }
    .jc-year { font-size: 10px; color: #98A2B3; margin-top: 1px; }

    /* ── Mood chip ── */
    .mood-chip {
      display: flex; align-items: center; gap: 5px;
      padding: 5px 11px; border-radius: 20px; border: 1px solid transparent;
    }
    .mood-emoji { font-size: 16px; }
    .mood-label { font-size: 11px; font-weight: 700; }
    .mood-chip.mood-happy    { background: #ECFDF5; border-color: #A7F3D0; .mood-label { color: #059669; } }
    .mood-chip.mood-calm     { background: #EEF2FF; border-color: #C7D2FE; .mood-label { color: #4338CA; } }
    .mood-chip.mood-unsettled{ background: #FFFBEB; border-color: #FDE68A; .mood-label { color: #D97706; } }
    .mood-chip.mood-upset    { background: #FEF2F2; border-color: #FECACA; .mood-label { color: #DC2626; } }

    /* ── Note ── */
    .note-section { margin-bottom: 12px; }
    .note-label { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: .05em; color: #98A2B3; margin-bottom: 6px; display: flex; align-items: center; gap: 4px; i { font-size: 13px; } }
    .note-text { font-size: 13.5px; color: #344054; line-height: 1.6; margin: 0; background: #F9FAFB; border-radius: 10px; padding: 10px 12px; border-left: 3px solid #C7D2FE; }

    /* ── Meta chips ── */
    .meta-chips { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 12px; }
    .meta-chip {
      display: flex; align-items: center; gap: 5px;
      background: #F5F7FA; border: 1px solid #EAECF0; border-radius: 20px;
      padding: 4px 10px; font-size: 11px; font-weight: 600; color: #667085;
    }
    .meta-icon { font-size: 14px; }

    /* ── Homework ── */
    .hw-section { border-top: 1px solid #F2F4F7; padding-top: 12px; }
    .hw-section-title { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: .05em; color: #98A2B3; margin-bottom: 8px; display: flex; align-items: center; gap: 4px; i { font-size: 13px; } }
    .hw-row { background: #FFFBEB; border: 1px solid #FDE68A; border-radius: 10px; padding: 9px 11px; margin-bottom: 6px; &:last-child { margin-bottom: 0; } }
    .hw-subject { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: .04em; color: #D97706; margin-bottom: 3px; }
    .hw-desc { font-size: 13px; color: #344054; }
  `],
})
export class ParentJournalComponent {
  private api = inject(ApiService);
  state       = inject(ParentStateService);
  loading     = signal(true);
  entries     = signal<any[]>([]);
  apiError    = signal('');

  constructor() {
    effect(() => {
      const child = this.state.activeChild();
      this.entries.set([]);
      this.apiError.set('');
      if (!child) { this.loading.set(false); return; }
      this.loading.set(true);
      this.api.get<any>(`/parent/students/${child.id}/journal`).subscribe({
        next: (res: any) => {
          const raw = res.data?.data ?? res.data?.items ?? res.data ?? [];
          this.entries.set(Array.isArray(raw) ? raw : []);
          this.loading.set(false);
        },
        error: (err: any) => {
          const msg = err.error?.error?.message ?? err.message ?? `Error ${err.status}`;
          this.apiError.set(msg);
          this.loading.set(false);
        },
      });
    });
  }

  mealSummary(meal: any): string {
    if (!meal) return '';
    const parts: string[] = [];
    if (meal.breakfast) parts.push(`B: ${meal.breakfast}`);
    if (meal.lunch)     parts.push(`L: ${meal.lunch}`);
    if (meal.snack)     parts.push(`S: ${meal.snack}`);
    return parts.join(' · ');
  }

  napMinutes(nap: any): number {
    if (!nap?.start_time || !nap?.end_time) return 0;
    const [sh, sm] = nap.start_time.split(':').map(Number);
    const [eh, em] = nap.end_time.split(':').map(Number);
    return (eh * 60 + em) - (sh * 60 + sm);
  }

  moodEmoji(mood: string) {
    const map: Record<string, string> = { happy: '😊', calm: '😌', unsettled: '😟', upset: '😢' };
    return map[mood] ?? '😐';
  }
}
