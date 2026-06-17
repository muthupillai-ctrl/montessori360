import { Component, inject, signal, OnInit } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { DatePipe } from '@angular/common';
import { ApiService } from '../../core/services/api.service';
import { ParentStateService } from './parent-state.service';

@Component({
  selector: 'app-parent-transport',
  standalone: true,
  imports: [MatIconModule, MatProgressSpinnerModule, DatePipe],
  template: `
    <div class="page">
      <div class="page-title">Transport Status</div>

      <div class="date-nav">
        <button class="nav-btn" (click)="changeDate(-1)">
          <mat-icon style="font-size:18px;width:18px;height:18px">chevron_left</mat-icon>
        </button>
        <input type="date" class="date-input" [value]="selectedDate()" (change)="onDateChange($event)">
        <button class="nav-btn" (click)="changeDate(1)">
          <mat-icon style="font-size:18px;width:18px;height:18px">chevron_right</mat-icon>
        </button>
      </div>

      @if (loading()) {
        <div class="loading"><mat-progress-spinner diameter="28" mode="indeterminate"/></div>
      } @else if (!status()) {
        <div class="empty">No transport route assigned.</div>
      } @else {
        <div class="trip-cards">
          <div class="trip-card" [class.boarded]="status()!.morning?.boarded">
            <div class="trip-icon">🌅</div>
            <div class="trip-info">
              <div class="trip-label">Morning Pickup</div>
              @if (status()!.morning) {
                <div class="trip-route">{{ status()!.morning!.route_name }}</div>
                <div class="trip-status" [class.boarded]="status()!.morning!.boarded">
                  {{ status()!.morning!.boarded ? '✓ Boarded' : '✗ Not boarded yet' }}
                  @if (status()!.morning!.boarded_at) {
                    <span class="boarded-at">at {{ status()!.morning!.boarded_at | date:'h:mm a' }}</span>
                  }
                </div>
              } @else {
                <div class="trip-status">No morning trip</div>
              }
            </div>
          </div>
          <div class="trip-card" [class.boarded]="status()!.evening?.boarded">
            <div class="trip-icon">🌆</div>
            <div class="trip-info">
              <div class="trip-label">Evening Drop</div>
              @if (status()!.evening) {
                <div class="trip-route">{{ status()!.evening!.route_name }}</div>
                <div class="trip-status" [class.boarded]="status()!.evening!.boarded">
                  {{ status()!.evening!.boarded ? '✓ Boarded' : '✗ Not boarded yet' }}
                  @if (status()!.evening!.boarded_at) {
                    <span class="boarded-at">at {{ status()!.evening!.boarded_at | date:'h:mm a' }}</span>
                  }
                </div>
              } @else {
                <div class="trip-status">No evening trip</div>
              }
            </div>
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    .page { padding: 16px; }
    .page-title { font-size: 18px; font-weight: 700; color: var(--text-1); margin-bottom: 16px; }
    .date-nav { display: flex; align-items: center; gap: 8px; margin-bottom: 16px; background: var(--surface); border: 1px solid var(--border); border-radius: 10px; padding: 8px 12px; }
    .nav-btn { background: none; border: none; cursor: pointer; color: var(--text-2); display: flex; align-items: center; padding: 4px; }
    .date-input { flex: 1; border: none; background: none; font-size: 14px; font-weight: 600; color: var(--text-1); text-align: center; cursor: pointer; }
    .loading { display: flex; justify-content: center; padding: 60px; }
    .empty { text-align: center; color: var(--text-3); padding: 60px 20px; font-size: 14px; }
    .trip-cards { display: flex; flex-direction: column; gap: 12px; }
    .trip-card { display: flex; align-items: flex-start; gap: 14px; background: var(--surface); border: 1.5px solid var(--border); border-radius: 14px; padding: 16px; transition: border-color .2s; &.boarded { border-color: var(--green); } }
    .trip-icon { font-size: 28px; flex-shrink: 0; }
    .trip-label { font-size: 13px; font-weight: 700; color: var(--text-1); margin-bottom: 4px; }
    .trip-route { font-size: 12px; color: var(--text-3); margin-bottom: 6px; }
    .trip-status { font-size: 13px; font-weight: 600; color: var(--text-3); &.boarded { color: var(--green); } }
    .boarded-at { font-size: 11px; font-weight: 400; color: var(--text-3); margin-left: 6px; }
  `],
})
export class ParentTransportComponent implements OnInit {
  private api  = inject(ApiService);
  state        = inject(ParentStateService);
  loading      = signal(true);
  status       = signal<any | null>(null);
  selectedDate = signal(new Date().toISOString().slice(0, 10));

  ngOnInit() { this.load(); }

  load() {
    const child = this.state.activeChild();
    if (!child) { this.loading.set(false); return; }
    this.loading.set(true);
    this.api.get<any>(`/parent/students/${child.id}/transport`, { date: this.selectedDate() }).subscribe({
      next: (res: any) => { this.status.set(res.data ?? null); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  onDateChange(e: Event) { this.selectedDate.set((e.target as HTMLInputElement).value); this.load(); }
  changeDate(dir: number) {
    const d = new Date(this.selectedDate()); d.setDate(d.getDate() + dir);
    this.selectedDate.set(d.toISOString().slice(0, 10)); this.load();
  }
}
