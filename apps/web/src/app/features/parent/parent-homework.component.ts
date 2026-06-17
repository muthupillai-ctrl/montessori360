import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { DatePipe } from '@angular/common';
import { ApiService } from '../../core/services/api.service';
import { ParentStateService } from './parent-state.service';

@Component({
  selector: 'app-parent-homework',
  standalone: true,
  imports: [MatIconModule, MatProgressSpinnerModule, DatePipe],
  template: `
    <div class="page">
      <div class="page-title">Homework</div>

      <div class="filter-tabs">
        <button class="ftab" [class.active]="filter() === 'upcoming'" (click)="filter.set('upcoming')">Upcoming</button>
        <button class="ftab" [class.active]="filter() === 'past'"     (click)="filter.set('past')">Past</button>
        <button class="ftab" [class.active]="filter() === 'all'"      (click)="filter.set('all')">All</button>
      </div>

      @if (loading()) {
        <div class="loading"><mat-progress-spinner diameter="28" mode="indeterminate"/></div>
      } @else if (!filtered().length) {
        <div class="empty">No homework {{ filter() === 'upcoming' ? 'due upcoming' : filter() === 'past' ? 'in past' : '' }}.</div>
      } @else {
        <div class="hw-list">
          @for (hw of filtered(); track hw.id) {
            <div class="hw-card" [class.overdue]="isOverdue(hw.due_date)">
              <div class="hw-top">
                <div>
                  @if (hw.subject) { <span class="subject-tag">{{ hw.subject }}</span> }
                  <div class="hw-title">{{ hw.title }}</div>
                </div>
                <div class="due-date" [class.overdue]="isOverdue(hw.due_date)">
                  <mat-icon style="font-size:13px;width:13px;height:13px">event</mat-icon>
                  {{ hw.due_date | date:'d MMM' }}
                </div>
              </div>
              @if (hw.description) {
                <p class="hw-desc">{{ hw.description }}</p>
              }
              @if (hw.assigned_by) {
                <div class="hw-teacher">By {{ hw.assigned_by }}</div>
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
    .filter-tabs { display: flex; gap: 8px; margin-bottom: 16px; }
    .ftab { padding: 6px 16px; border-radius: 20px; border: 1.5px solid var(--border); background: var(--bg); font-size: 12px; font-weight: 600; cursor: pointer; color: var(--text-2); &.active { background: var(--primary); border-color: var(--primary); color: #fff; } }
    .loading { display: flex; justify-content: center; padding: 60px; }
    .empty { text-align: center; color: var(--text-3); padding: 60px 20px; font-size: 14px; }
    .hw-list { display: flex; flex-direction: column; gap: 10px; }
    .hw-card { background: var(--surface); border: 1.5px solid var(--border); border-radius: 12px; padding: 14px; &.overdue { border-color: var(--red); } }
    .hw-top { display: flex; align-items: flex-start; justify-content: space-between; gap: 8px; margin-bottom: 8px; }
    .subject-tag { font-size: 10px; font-weight: 700; color: var(--primary); text-transform: uppercase; letter-spacing: .5px; margin-bottom: 4px; display: block; }
    .hw-title { font-size: 14px; font-weight: 700; color: var(--text-1); }
    .due-date { display: flex; align-items: center; gap: 3px; font-size: 11px; font-weight: 600; color: var(--text-3); white-space: nowrap; &.overdue { color: var(--red); } }
    .hw-desc { font-size: 13px; color: var(--text-2); line-height: 1.5; margin: 0 0 8px; }
    .hw-teacher { font-size: 11px; color: var(--text-4); }
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
}
