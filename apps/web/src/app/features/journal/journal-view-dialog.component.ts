import { Component, inject } from '@angular/core';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { DatePipe, TitleCasePipe } from '@angular/common';
import type { Journal } from './journal.component';

@Component({
  selector: 'app-journal-view-dialog',
  standalone: true,
  imports: [ MatDialogModule, MatButtonModule, MatIconModule, DatePipe, TitleCasePipe ],
  template: `
    <div class="dialog-shell">

      <div class="dialog-header">
        <div class="header-left">
          <div class="av" [style.background]="getColor(j.student_name)">{{ j.student_name[0] }}</div>
          <div>
            <div class="student-name">{{ j.student_name }}</div>
            <div class="student-meta">{{ j.class_name }} · {{ j.journal_date | date:'d MMMM yyyy' }}</div>
          </div>
        </div>
        <div class="header-right">
          @if (j.published_at) {
            <span class="pub-badge">✓ Published</span>
          } @else {
            <span class="draft-badge">Draft</span>
          }
          <button class="dh-close" mat-dialog-close><mat-icon>close</mat-icon></button>
        </div>
      </div>

      <div class="dialog-body">

        <!-- Mood -->
        @if (j.mood) {
          <div class="section">
            <div class="section-title">Mood</div>
            <div class="mood-display">
              <span class="mood-emoji">{{ getMoodEmoji(j.mood) }}</span>
              <div>
                <div class="mood-label">{{ j.mood | titlecase }}</div>
                @if (j.mood_note) {
                  <div class="mood-note">{{ j.mood_note }}</div>
                }
              </div>
            </div>
          </div>
        }

        <!-- Teacher's Note -->
        @if (j.teacher_note) {
          <div class="section">
            <div class="section-title">Teacher's Note</div>
            <div class="note-box">{{ j.teacher_note }}</div>
          </div>
        }

        <!-- Meals -->
        @if (j.meal && (j.meal.breakfast || j.meal.lunch || j.meal.snack)) {
          <div class="section">
            <div class="section-title">🍽 Meals</div>
            <div class="info-grid">
              @if (j.meal.breakfast) {
                <div class="ig-item">
                  <div class="ig-label">Breakfast</div>
                  <div class="ig-val" [class]="'qty-' + j.meal.breakfast">{{ j.meal.breakfast | titlecase }}</div>
                </div>
              }
              @if (j.meal.lunch) {
                <div class="ig-item">
                  <div class="ig-label">Lunch</div>
                  <div class="ig-val" [class]="'qty-' + j.meal.lunch">{{ j.meal.lunch | titlecase }}</div>
                </div>
              }
              @if (j.meal.snack) {
                <div class="ig-item">
                  <div class="ig-label">Snack</div>
                  <div class="ig-val" [class]="'qty-' + j.meal.snack">{{ j.meal.snack | titlecase }}</div>
                </div>
              }
            </div>
            @if (j.meal.notes) {
              <div class="sub-note">{{ j.meal.notes }}</div>
            }
          </div>
        }

        <!-- Nap -->
        @if (j.nap && j.nap.quality) {
          <div class="section">
            <div class="section-title">😴 Nap</div>
            <div class="info-grid">
              <div class="ig-item">
                <div class="ig-label">Quality</div>
                <div class="ig-val" [class]="'nap-' + j.nap.quality">{{ j.nap.quality | titlecase }}</div>
              </div>
              @if (j.nap.start_time) {
                <div class="ig-item">
                  <div class="ig-label">Start</div>
                  <div class="ig-val">{{ j.nap.start_time }}</div>
                </div>
              }
              @if (j.nap.end_time) {
                <div class="ig-item">
                  <div class="ig-label">End</div>
                  <div class="ig-val">{{ j.nap.end_time }}</div>
                </div>
              }
            </div>
            @if (j.nap.notes) {
              <div class="sub-note">{{ j.nap.notes }}</div>
            }
          </div>
        }

        <!-- Activities -->
        @if (j.activities && j.activities.length) {
          <div class="section">
            <div class="section-title">🎯 Activities</div>
            <div class="activities-list">
              @for (a of j.activities; track a.type) {
                <div class="activity-row">
                  <div class="act-type-badge">{{ a.type.replace('_', ' ') | titlecase }}</div>
                  <div class="act-desc">{{ a.description }}</div>
                  @if (a.duration_mins) {
                    <div class="act-dur">{{ a.duration_mins }}m</div>
                  }
                </div>
              }
            </div>
          </div>
        }

        <!-- Toilet -->
        @if (j.toilet?.count) {
          <div class="section">
            <div class="section-title">🚿 Toilet</div>
            <div class="toilet-count">
              <span class="count-badge">{{ j.toilet.count }}</span>
              <span class="count-label">visit{{ j.toilet.count > 1 ? 's' : '' }} today</span>
            </div>
            @if (j.toilet.notes) {
              <div class="sub-note">{{ j.toilet.notes }}</div>
            }
          </div>
        }

        <!-- Footer info -->
        <div class="journal-footer">
          @if (j.author_name) {
            <span>Written by {{ j.author_name }}</span>
          }
          @if (j.published_at) {
            <span>· Published {{ j.published_at | date:'d MMM, h:mm a' }}</span>
          }
        </div>

      </div>

      <div class="dialog-footer">
        <button class="btn-ghost" mat-dialog-close>Close</button>
      </div>
    </div>
  `,
  styles: [`
    .dialog-shell { width: 520px; display: flex; flex-direction: column; max-height: 90vh; }

    .dialog-header {
      display: flex; align-items: center; justify-content: space-between;
      padding: 16px 20px; border-bottom: 1px solid var(--border); flex-shrink: 0;
    }
    .header-left { display: flex; align-items: center; gap: 12px; }
    .header-right { display: flex; align-items: center; gap: 8px; }
    .av {
      width: 40px; height: 40px; border-radius: 10px; color: #fff;
      font-size: 15px; font-weight: 700; display: flex; align-items: center; justify-content: center;
    }
    .student-name { font-size: 14px; font-weight: 600; color: var(--text); }
    .student-meta { font-size: 11px; color: var(--text-3); margin-top: 2px; }

    .pub-badge   { background: var(--green-light); color: #065F46; font-size: 10px; font-weight: 600; padding: 3px 8px; border-radius: 10px; }
    .draft-badge { background: var(--amber-light); color: #92400E; font-size: 10px; font-weight: 600; padding: 3px 8px; border-radius: 10px; }
    .dh-close {
      background: none; border: none; width: 28px; height: 28px; border-radius: 6px;
      cursor: pointer; color: var(--text-3); display: flex; align-items: center; justify-content: center;
      &:hover { background: var(--bg); }
      mat-icon { font-size: 18px; width: 18px; height: 18px; }
    }

    .dialog-body { flex: 1; overflow-y: auto; padding: 16px 20px; display: flex; flex-direction: column; gap: 14px; }

    .section { }
    .section-title {
      font-size: 11px; font-weight: 600; text-transform: uppercase;
      letter-spacing: .4px; color: var(--text-4); margin-bottom: 8px;
    }

    /* Mood */
    .mood-display { display: flex; align-items: center; gap: 12px; }
    .mood-emoji   { font-size: 36px; line-height: 1; }
    .mood-label   { font-size: 15px; font-weight: 600; color: var(--text); }
    .mood-note    { font-size: 12px; color: var(--text-3); margin-top: 3px; font-style: italic; }

    /* Note box */
    .note-box {
      background: #FFFBEB; border: 1px solid #FDE68A; border-radius: 9px;
      padding: 12px 14px; font-size: 13px; color: #78350F;
      line-height: 1.6; font-style: italic;
    }

    /* Info grid */
    .info-grid { display: flex; gap: 10px; flex-wrap: wrap; margin-bottom: 6px; }
    .ig-item   { background: var(--bg); border-radius: 8px; padding: 8px 12px; }
    .ig-label  { font-size: 10px; color: var(--text-4); text-transform: uppercase; letter-spacing: .3px; margin-bottom: 3px; }
    .ig-val    { font-size: 13px; font-weight: 600; color: var(--text); }
    .qty-well    { color: #065F46; }
    .qty-partial { color: #92400E; }
    .qty-refused { color: #991B1B; }
    .nap-good { color: #5B21B6; }
    .nap-poor { color: #92400E; }
    .nap-none { color: #991B1B; }

    .sub-note { font-size: 12px; color: var(--text-3); font-style: italic; }

    /* Activities */
    .activities-list { display: flex; flex-direction: column; gap: 6px; }
    .activity-row {
      display: flex; align-items: center; gap: 8px;
      background: var(--bg); border-radius: 8px; padding: 8px 10px;
    }
    .act-type-badge {
      background: var(--blue-light); color: var(--blue);
      font-size: 10px; font-weight: 600; padding: 2px 7px; border-radius: 4px;
      white-space: nowrap; flex-shrink: 0;
    }
    .act-desc { flex: 1; font-size: 12.5px; color: var(--text-2); }
    .act-dur  { font-size: 11px; color: var(--text-3); white-space: nowrap; }

    /* Toilet */
    .toilet-count { display: flex; align-items: center; gap: 8px; }
    .count-badge  {
      width: 36px; height: 36px; border-radius: 9px;
      background: #F0FDF4; color: #065F46;
      font-size: 18px; font-weight: 700;
      display: flex; align-items: center; justify-content: center;
    }
    .count-label { font-size: 13px; color: var(--text-2); }

    /* Footer */
    .journal-footer { font-size: 11px; color: var(--text-4); padding-top: 8px; border-top: 1px solid var(--border-light); }

    .dialog-footer {
      display: flex; justify-content: flex-end;
      padding: 12px 20px; border-top: 1px solid var(--border); background: var(--bg); flex-shrink: 0;
    }
    .btn-ghost {
      background: none; border: none; cursor: pointer;
      font-size: 13px; color: var(--text-3); padding: 0 10px; height: 34px; border-radius: 7px;
      &:hover { background: var(--border-light); }
    }
  `],
})
export class JournalViewDialogComponent {
  private dialogRef = inject(MatDialogRef<JournalViewDialogComponent>);
  j: Journal = inject(MAT_DIALOG_DATA);

  getMoodEmoji(mood: string | null): string {
    const map: Record<string, string> = { happy: '😊', calm: '😌', unsettled: '😟', upset: '😢' };
    return mood ? (map[mood] ?? '😐') : '—';
  }

  getColor(name: string): string {
    const colors = ['#2563EB','#7C3AED','#DB2777','#D97706','#059669','#0891B2'];
    return colors[(name?.charCodeAt(0) || 0) % colors.length];
  }
}
