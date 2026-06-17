import { Component, inject, signal, OnInit } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { DatePipe, TitleCasePipe } from '@angular/common';
import { ApiService } from '../../core/services/api.service';
import { ParentStateService } from './parent-state.service';

@Component({
  selector: 'app-parent-journal',
  standalone: true,
  imports: [MatIconModule, MatProgressSpinnerModule, DatePipe, TitleCasePipe],
  template: `
    <div class="page">
      <div class="page-title">Daily Journal</div>

      @if (loading()) {
        <div class="loading"><mat-progress-spinner diameter="28" mode="indeterminate"/></div>
      } @else if (!entries().length) {
        <div class="empty">No journal entries yet.</div>
      } @else {
        <div class="feed">
          @for (entry of entries(); track entry.id) {
            <div class="journal-card">
              <div class="jc-header">
                <div class="jc-date">{{ entry.date | date:'EEE, d MMM yyyy' }}</div>
                <span class="mood-chip">{{ moodEmoji(entry.mood) }} {{ entry.mood | titlecase }}</span>
              </div>
              @if (entry.teacher_note) {
                <p class="note">{{ entry.teacher_note }}</p>
              }
              <div class="meta-row">
                @if (entry.meal_summary) {
                  <span class="meta-chip">🍽 {{ entry.meal_summary }}</span>
                }
                @if (entry.nap_minutes) {
                  <span class="meta-chip">😴 {{ entry.nap_minutes }}min nap</span>
                }
              </div>
              @if (entry.homework?.length) {
                <div class="hw-section">
                  <div class="hw-title">Homework</div>
                  @for (hw of entry.homework; track $index) {
                    <div class="hw-item">📝 {{ hw }}</div>
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
    .page { padding: 16px; }
    .page-title { font-size: 18px; font-weight: 700; color: var(--text-1); margin-bottom: 16px; }
    .loading { display: flex; justify-content: center; padding: 60px; }
    .empty { text-align: center; color: var(--text-3); padding: 60px 20px; font-size: 14px; }
    .feed { display: flex; flex-direction: column; gap: 12px; }
    .journal-card { background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 14px; }
    .jc-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; }
    .jc-date { font-size: 13px; font-weight: 700; color: var(--text-1); }
    .mood-chip { font-size: 11px; font-weight: 600; padding: 3px 8px; border-radius: 20px; background: var(--bg); color: var(--text-2); }
    .note { font-size: 13px; color: var(--text-2); line-height: 1.5; margin: 0 0 10px; }
    .meta-row { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 8px; }
    .meta-chip { font-size: 11px; color: var(--text-3); background: var(--bg); padding: 3px 8px; border-radius: 20px; }
    .hw-section { border-top: 1px solid var(--border); padding-top: 10px; margin-top: 6px; }
    .hw-title { font-size: 11px; font-weight: 700; color: var(--text-3); text-transform: uppercase; letter-spacing: .5px; margin-bottom: 6px; }
    .hw-item { font-size: 13px; color: var(--text-2); padding: 2px 0; }
  `],
})
export class ParentJournalComponent implements OnInit {
  private api = inject(ApiService);
  state       = inject(ParentStateService);
  loading     = signal(true);
  entries     = signal<any[]>([]);

  ngOnInit() {
    const child = this.state.activeChild();
    if (!child) { this.loading.set(false); return; }
    this.api.get<any>(`/parent/students/${child.id}/journal`).subscribe({
      next: (res: any) => { this.entries.set(res.data?.items ?? res.data ?? []); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  moodEmoji(mood: string) {
    const map: Record<string, string> = { happy: '😊', sad: '😢', neutral: '😐', excited: '🎉', tired: '😴', anxious: '😟' };
    return map[mood] ?? '😶';
  }
}
