import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { DatePipe } from '@angular/common';
import { ApiService } from '../../core/services/api.service';
import { ParentStateService } from './parent-state.service';

@Component({
  selector: 'app-parent-homework',
  standalone: true,
  imports: [MatProgressSpinnerModule, DatePipe],
  template: `
    <div class="page">

      <!-- Filter tabs -->
      <div class="filter-bar">
        <button class="ftab" [class.active]="filter() === 'upcoming'" (click)="filter.set('upcoming')">
          <i class="ti ti-clock"></i> Upcoming
        </button>
        <button class="ftab" [class.active]="filter() === 'past'" (click)="filter.set('past')">
          <i class="ti ti-history"></i> Past
        </button>
        <button class="ftab" [class.active]="filter() === 'all'" (click)="filter.set('all')">
          <i class="ti ti-list"></i> All
        </button>
      </div>

      @if (loading()) {
        <div class="loading"><mat-progress-spinner diameter="28" mode="indeterminate"/></div>
      } @else if (!filtered().length) {
        <div class="empty-state">
          <div class="empty-icon">{{ filter() === 'upcoming' ? '🎉' : '📝' }}</div>
          <div class="empty-title">{{ filter() === 'upcoming' ? 'All done!' : 'Nothing here' }}</div>
          <div class="empty-sub">{{ filter() === 'upcoming' ? 'No upcoming homework. Great job!' : 'No homework for this period.' }}</div>
        </div>
      } @else {
        <div class="hw-list">
          @for (hw of filtered(); track hw.id) {
            <div class="hw-card" [class.overdue]="isOverdue(hw.due_date) && filter() !== 'past'">

              <div class="hw-top">
                <div class="hw-icon-wrap" [class]="subjectColor(hw.subject)">
                  <i class="ti ti-pencil"></i>
                </div>
                <div class="hw-meta">
                  @if (hw.subject) {
                    <div class="hw-subject">{{ hw.subject }}</div>
                  }
                  <div class="hw-title">{{ hw.title }}</div>
                </div>
              </div>

              @if (hw.description) {
                <p class="hw-desc">{{ hw.description }}</p>
              }

              <div class="hw-footer">
                @if (hw.assigned_by) {
                  <span class="hw-teacher"><i class="ti ti-user"></i> {{ hw.assigned_by }}</span>
                }
                <span class="due-badge" [class]="dueBadgeClass(hw.due_date)">
                  <i class="ti ti-calendar"></i>
                  {{ hw.due_date | date:'d MMM' }}
                  {{ isOverdue(hw.due_date) && filter() !== 'past' ? ' · Overdue' : '' }}
                </span>
              </div>

            </div>
          }
        </div>
      }
    </div>
  `,
  styles: [`
    .page { padding: 16px 16px 24px; background: #F5F7FA; min-height: 100%; }
    .loading { display: flex; justify-content: center; padding: 80px; }

    /* ── Filter ── */
    .filter-bar { display: flex; gap: 8px; margin-bottom: 16px; }
    .ftab {
      flex: 1; display: flex; align-items: center; justify-content: center; gap: 5px;
      padding: 8px 10px; border-radius: 12px; border: 1.5px solid #EAECF0;
      background: #fff; font-size: 12px; font-weight: 600; color: #667085;
      cursor: pointer; transition: all .15s;
      i { font-size: 14px; }
      &.active { background: #4F46E5; border-color: #4F46E5; color: #fff; }
    }

    /* ── Empty ── */
    .empty-state { display: flex; flex-direction: column; align-items: center; gap: 10px; padding: 80px 24px; text-align: center; }
    .empty-icon { font-size: 48px; }
    .empty-title { font-size: 16px; font-weight: 700; color: #1D2939; }
    .empty-sub { font-size: 13px; color: #98A2B3; line-height: 1.5; }

    /* ── HW list ── */
    .hw-list { display: flex; flex-direction: column; gap: 10px; }
    .hw-card {
      background: #fff; border: 1.5px solid #EAECF0; border-radius: 16px;
      padding: 14px; box-shadow: 0 1px 4px rgba(0,0,0,.04);
      transition: border-color .15s;
      &.overdue { border-color: #FECACA; }
    }

    /* ── Top row ── */
    .hw-top { display: flex; align-items: flex-start; gap: 12px; margin-bottom: 10px; }
    .hw-icon-wrap {
      width: 38px; height: 38px; border-radius: 10px; flex-shrink: 0;
      display: flex; align-items: center; justify-content: center; font-size: 18px;
    }
    .subject-indigo  { background: #EEF2FF; color: #4F46E5; }
    .subject-emerald { background: #ECFDF5; color: #059669; }
    .subject-amber   { background: #FFFBEB; color: #D97706; }
    .subject-rose    { background: #FFF1F2; color: #E11D48; }
    .subject-sky     { background: #F0F9FF; color: #0284C7; }
    .subject-purple  { background: #FDF4FF; color: #7C3AED; }

    .hw-meta { flex: 1; min-width: 0; }
    .hw-subject { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: .05em; color: #4F46E5; margin-bottom: 3px; }
    .hw-title { font-size: 14px; font-weight: 700; color: #1D2939; }

    .hw-desc { font-size: 13px; color: #667085; line-height: 1.55; margin: 0 0 12px; }

    /* ── Footer ── */
    .hw-footer { display: flex; align-items: center; justify-content: space-between; }
    .hw-teacher { font-size: 11px; color: #98A2B3; display: flex; align-items: center; gap: 3px; i { font-size: 13px; } }
    .due-badge {
      display: flex; align-items: center; gap: 4px;
      font-size: 11px; font-weight: 700; padding: 3px 9px; border-radius: 20px;
      i { font-size: 12px; }
    }
    .due-normal { background: #EEF2FF; color: #4338CA; }
    .due-soon   { background: #FFFBEB; color: #D97706; }
    .due-overdue{ background: #FEF2F2; color: #DC2626; }
    .due-past   { background: #F9FAFB; color: #98A2B3; }
  `],
})
export class ParentHomeworkComponent implements OnInit {
  private api = inject(ApiService);
  state       = inject(ParentStateService);
  loading     = signal(true);
  tasks       = signal<any[]>([]);
  filter      = signal<'upcoming' | 'past' | 'all'>('upcoming');
  today       = new Date().toISOString().slice(0, 10);

  filtered = computed(() => {
    const f = this.filter();
    return this.tasks().filter(hw => {
      if (f === 'upcoming') return hw.due_date >= this.today;
      if (f === 'past')     return hw.due_date < this.today;
      return true;
    });
  });

  ngOnInit() {
    const child = this.state.activeChild();
    if (!child) { this.loading.set(false); return; }
    this.api.get<any>(`/parent/students/${child.id}/homework`).subscribe({
      next: (res: any) => { this.tasks.set(res.data ?? []); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  isOverdue(due: string) { return due < this.today; }

  subjectColor(subject: string): string {
    const map: Record<string, string> = {
      Math:     'subject-indigo',  Maths: 'subject-indigo',
      English:  'subject-emerald', Science: 'subject-sky',
      Hindi:    'subject-rose',    Art: 'subject-purple',
    };
    const key = Object.keys(map).find(k => subject?.toLowerCase().includes(k.toLowerCase()));
    return key ? map[key] : 'subject-amber';
  }

  dueBadgeClass(due: string): string {
    if (this.filter() === 'past') return 'due-past';
    if (due < this.today) return 'due-overdue';
    const diff = (new Date(due).getTime() - new Date(this.today).getTime()) / 86400000;
    return diff <= 2 ? 'due-soon' : 'due-normal';
  }
}
