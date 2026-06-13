import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDialogModule, MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/services/api.service';
import { AuthService } from '../../core/services/auth.service';

interface CalendarEvent {
  id: string;
  title: string;
  description: string | null;
  event_type: string;
  start_date: string;
  end_date: string;
  is_all_day: boolean;
  start_time: string | null;
  end_time: string | null;
  colour: string;
  affects_attendance: boolean;
}

interface DayCell {
  date: Date;
  dateStr: string;
  day: number;
  isCurrentMonth: boolean;
  isToday: boolean;
  isWeekend: boolean;
  events: CalendarEvent[];
}

const EVENT_TYPES = [
  { value: 'holiday',    label: 'Holiday',    color: '#DC2626', bg: '#FEF2F2', default: '#DC2626' },
  { value: 'exam',       label: 'Exam',       color: '#D97706', bg: '#FFFBEB', default: '#D97706' },
  { value: 'event',      label: 'Event',      color: '#2563EB', bg: '#EFF6FF', default: '#2563EB' },
  { value: 'meeting',    label: 'Meeting',    color: '#059669', bg: '#ECFDF5', default: '#059669' },
  { value: 'excursion',  label: 'Excursion',  color: '#7C3AED', bg: '#F5F3FF', default: '#7C3AED' },
  { value: 'closure',    label: 'Closure',    color: '#DC2626', bg: '#FEF2F2', default: '#DC2626' },
  { value: 'term_start', label: 'Term Start', color: '#0891B2', bg: '#ECFEFF', default: '#0891B2' },
  { value: 'term_end',   label: 'Term End',   color: '#0891B2', bg: '#ECFEFF', default: '#0891B2' },
  { value: 'other',      label: 'Other',      color: '#6B7280', bg: '#F9FAFB', default: '#6B7280' },
];

@Component({
  selector: 'app-calendar',
  standalone: true,
  imports: [
    ReactiveFormsModule, FormsModule,
    MatIconModule, MatProgressSpinnerModule, MatDialogModule,
    DatePipe,
  ],
  template: `
    <div class="calendar-page">

      <!-- Header -->
      <div class="cal-header">
        <div class="cal-nav">
          <button class="nav-btn" (click)="prevMonth()">
            <mat-icon style="font-size:18px;width:18px;height:18px">chevron_left</mat-icon>
          </button>
          <div class="month-label">{{ monthLabel() }}</div>
          <button class="nav-btn" (click)="nextMonth()">
            <mat-icon style="font-size:18px;width:18px;height:18px">chevron_right</mat-icon>
          </button>
          <button class="btn-today" (click)="goToday()">Today</button>
        </div>
        @if (isAdmin()) {
          <div class="cal-actions">
            <button class="btn-outline-sm" (click)="showImport.set(!showImport())">
              <mat-icon style="font-size:15px;width:15px;height:15px">download</mat-icon>
              Import Holidays
            </button>
            <button class="btn-primary-sm" (click)="openAddEvent()">
              <mat-icon style="font-size:15px;width:15px;height:15px">add</mat-icon>
              Add Event
            </button>
          </div>
        }
      </div>

      <!-- Import panel -->
      @if (showImport() && isAdmin()) {
        <div class="import-panel">
          <div class="ip-title">
            <mat-icon style="font-size:15px;width:15px;height:15px;color:var(--blue)">info</mat-icon>
            Import Indian Public Holidays for {{ viewYear() }}
          </div>
          <div class="ip-actions">
            <select class="fi" [(ngModel)]="importYear">
              <option [value]="viewYear() - 1">{{ viewYear() - 1 }}</option>
              <option [value]="viewYear()">{{ viewYear() }}</option>
              <option [value]="viewYear() + 1">{{ viewYear() + 1 }}</option>
            </select>
            <button class="btn-primary-sm" (click)="importHolidays()" [disabled]="importing()">
              @if (importing()) {
                <mat-progress-spinner diameter="14" mode="indeterminate"
                  style="--mdc-circular-progress-active-indicator-color:#fff"/>
              }
              Import
            </button>
            <button class="btn-ghost-sm" (click)="showImport.set(false)">Cancel</button>
          </div>
        </div>
      }

      <!-- Event type filters -->
      <div class="type-filters">
        @for (et of eventTypes; track et.value) {
          <button class="type-filter"
                  [class.active]="activeFilters().includes(et.value)"
                  [style.background]="activeFilters().includes(et.value) ? et.bg : 'var(--surface)'"
                  [style.color]="activeFilters().includes(et.value) ? et.color : 'var(--text-3)'"
                  [style.border-color]="activeFilters().includes(et.value) ? et.color : 'var(--border)'"
                  (click)="toggleFilter(et.value)">
            {{ et.label }}
          </button>
        }
      </div>

      <!-- Calendar + Sidebar -->
      <div class="cal-layout">

        <!-- Monthly calendar -->
        <div class="cal-grid-wrap">
          <!-- Day headers -->
          <div class="day-headers">
            @for (d of dayNames; track d) {
              <div class="dh">{{ d }}</div>
            }
          </div>

          <!-- Loading -->
          @if (loading()) {
            <div class="cal-loading">
              <mat-progress-spinner diameter="32" mode="indeterminate"/>
            </div>
          } @else {
            <!-- Day cells -->
            <div class="day-grid">
              @for (cell of dayCells(); track cell.dateStr) {
                <div class="day-cell"
                     [class.other-month]="!cell.isCurrentMonth"
                     [class.today]="cell.isToday"
                     [class.weekend]="cell.isWeekend"
                     (click)="onDayClick(cell)">
                  <div class="day-num">{{ cell.day }}</div>
                  <div class="day-events">
                    @for (ev of cell.events.slice(0,3); track ev.id) {
                      <div class="ev-chip"
                           [style.background]="getEvBg(ev)"
                           [style.color]="getEvColor(ev)"
                           (click)="$event.stopPropagation(); selectEvent(ev)"
                           [title]="ev.title">
                        {{ ev.title }}
                      </div>
                    }
                    @if (cell.events.length > 3) {
                      <div class="ev-more">+{{ cell.events.length - 3 }} more</div>
                    }
                  </div>
                </div>
              }
            </div>
          }
        </div>

        <!-- Sidebar -->
        <div class="cal-sidebar">

          <!-- Selected event detail -->
          @if (selectedEvent()) {
            <div class="sidebar-card event-detail">
              <div class="ed-head">
                <div class="ed-dot" [style.background]="getEvColor(selectedEvent()!)"></div>
                <span class="ed-type">{{ getTypeMeta(selectedEvent()!.event_type).label }}</span>
                <button class="ed-close" (click)="selectedEvent.set(null)">
                  <mat-icon style="font-size:16px;width:16px;height:16px">close</mat-icon>
                </button>
              </div>
              <div class="ed-body">
                <div class="ed-title">{{ selectedEvent()!.title }}</div>
                <div class="ed-dates">
                  {{ selectedEvent()!.start_date | date:'d MMM yyyy' }}
                  @if (selectedEvent()!.start_date !== selectedEvent()!.end_date) {
                    → {{ selectedEvent()!.end_date | date:'d MMM yyyy' }}
                  }
                  @if (!selectedEvent()!.is_all_day && selectedEvent()!.start_time) {
                    · {{ selectedEvent()!.start_time }}
                    @if (selectedEvent()!.end_time) { – {{ selectedEvent()!.end_time }} }
                  }
                </div>
                @if (selectedEvent()!.description) {
                  <div class="ed-desc">{{ selectedEvent()!.description }}</div>
                }
                @if (selectedEvent()!.affects_attendance) {
                  <div class="ed-att">
                    <mat-icon style="font-size:13px;width:13px;height:13px">how_to_reg</mat-icon>
                    Affects attendance
                  </div>
                }
              </div>
              @if (isAdmin()) {
                <div class="ed-actions">
                  <button class="btn-ghost-sm" (click)="editEvent(selectedEvent()!)">Edit</button>
                  <button class="btn-danger-sm" (click)="deleteEvent(selectedEvent()!.id)">Delete</button>
                </div>
              }
            </div>
          }

          <!-- Upcoming events -->
          <div class="sidebar-card">
            <div class="sc-head">Upcoming Events</div>
            <div class="sc-body">
              @if (!upcomingEvents().length) {
                <div class="sc-empty">No upcoming events</div>
              } @else {
                @for (ev of upcomingEvents(); track ev.id) {
                  <div class="up-row" (click)="selectEvent(ev)">
                    <div class="up-dot" [style.background]="getEvColor(ev)"></div>
                    <div class="up-info">
                      <div class="up-title">{{ ev.title }}</div>
                      <div class="up-date">
                        {{ ev.start_date | date:'d MMM' }}
                        @if (ev.start_date !== ev.end_date) { – {{ ev.end_date | date:'d MMM' }} }
                        · {{ getTypeMeta(ev.event_type).label }}
                      </div>
                    </div>
                  </div>
                }
              }
            </div>
          </div>

          <!-- Legend -->
          <div class="sidebar-card">
            <div class="sc-head">Legend</div>
            <div class="sc-body">
              @for (et of eventTypes.slice(0,6); track et.value) {
                <div class="leg-row">
                  <div class="leg-dot" [style.background]="et.bg" [style.border]="'1.5px solid ' + et.color"></div>
                  <span>{{ et.label }}</span>
                </div>
              }
            </div>
          </div>

        </div>
      </div>

      <!-- Add/Edit Event Modal -->
      @if (showEventForm()) {
        <div class="modal-backdrop" (click)="closeEventForm()">
          <div class="modal" (click)="$event.stopPropagation()">
            <div class="modal-head">
              <span>{{ editingEvent() ? 'Edit Event' : 'Add Event' }}</span>
              <button class="ed-close" (click)="closeEventForm()">
                <mat-icon style="font-size:18px;width:18px;height:18px">close</mat-icon>
              </button>
            </div>
            <div class="modal-body">
              <form [formGroup]="eventForm" class="ev-form">
                <div class="field-group">
                  <label class="fl">Title <span class="req">*</span></label>
                  <input class="fi" formControlName="title" placeholder="Event title">
                </div>
                <div class="form-row">
                  <div class="field-group fill">
                    <label class="fl">Type <span class="req">*</span></label>
                    <select class="fi" formControlName="event_type">
                      @for (et of eventTypes; track et.value) {
                        <option [value]="et.value">{{ et.label }}</option>
                      }
                    </select>
                  </div>
                  <div class="field-group fill">
                    <label class="fl">Colour</label>
                    <input class="fi" type="color" formControlName="colour" style="height:36px;padding:2px 4px">
                  </div>
                </div>
                <div class="form-row">
                  <div class="field-group fill">
                    <label class="fl">Start Date <span class="req">*</span></label>
                    <input class="fi" type="date" formControlName="start_date">
                  </div>
                  <div class="field-group fill">
                    <label class="fl">End Date <span class="req">*</span></label>
                    <input class="fi" type="date" formControlName="end_date">
                  </div>
                </div>
                <div class="form-row" style="align-items:center;gap:12px">
                  <label class="check-label">
                    <input type="checkbox" formControlName="is_all_day">
                    All day
                  </label>
                  <label class="check-label">
                    <input type="checkbox" formControlName="affects_attendance">
                    Affects attendance
                  </label>
                </div>
                @if (!eventForm.value.is_all_day) {
                  <div class="form-row">
                    <div class="field-group fill">
                      <label class="fl">Start Time</label>
                      <input class="fi" type="time" formControlName="start_time">
                    </div>
                    <div class="field-group fill">
                      <label class="fl">End Time</label>
                      <input class="fi" type="time" formControlName="end_time">
                    </div>
                  </div>
                }
                <div class="field-group">
                  <label class="fl">Description</label>
                  <textarea class="fi ta" formControlName="description" rows="2"
                            placeholder="Optional description…"></textarea>
                </div>
              </form>
            </div>
            @if (formError()) {
              <div class="form-err">
                <mat-icon style="font-size:13px;width:13px;height:13px;flex-shrink:0">error_outline</mat-icon>
                {{ formError() }}
              </div>
            }
            <div class="modal-footer">
              <button class="btn-ghost-sm" (click)="closeEventForm()">Cancel</button>
              <button class="btn-primary-sm" (click)="saveEvent()" [disabled]="eventForm.invalid || saving()">
                @if (saving()) {
                  <mat-progress-spinner diameter="14" mode="indeterminate"
                    style="--mdc-circular-progress-active-indicator-color:#fff"/>
                } @else {
                  <mat-icon style="font-size:14px;width:14px;height:14px">save</mat-icon>
                }
                {{ editingEvent() ? 'Save Changes' : 'Add Event' }}
              </button>
            </div>
          </div>
        </div>
      }

    </div>
  `,
  styles: [`
    .calendar-page { display: flex; flex-direction: column; gap: 12px; }

    /* Header */
    .cal-header { display: flex; align-items: center; justify-content: space-between; }
    .cal-nav    { display: flex; align-items: center; gap: 8px; }
    .nav-btn {
      width: 30px; height: 30px; border-radius: 7px;
      background: var(--surface); border: 1px solid var(--border);
      display: flex; align-items: center; justify-content: center;
      cursor: pointer; color: var(--text-2);
      &:hover { background: var(--bg); }
    }
    .month-label { font-size: 18px; font-weight: 700; color: var(--text); min-width: 160px; }
    .btn-today {
      height: 28px; padding: 0 12px; border-radius: 7px;
      background: var(--surface); border: 1px solid var(--border);
      font-size: 12px; color: var(--text-2); cursor: pointer;
      &:hover { background: var(--bg); }
    }
    .cal-actions { display: flex; gap: 8px; }
    .btn-primary-sm {
      display: inline-flex; align-items: center; gap: 5px;
      background: var(--blue); color: #fff; border: none;
      border-radius: 7px; height: 32px; padding: 0 14px;
      font-size: 12.5px; font-weight: 500; cursor: pointer;
      &:hover:not(:disabled) { background: #1D4ED8; }
      &:disabled { opacity: .6; cursor: not-allowed; }
    }
    .btn-outline-sm {
      display: inline-flex; align-items: center; gap: 5px;
      background: var(--surface); color: var(--text-2); border: 1px solid var(--border);
      border-radius: 7px; height: 32px; padding: 0 12px; font-size: 12.5px; cursor: pointer;
      &:hover { background: var(--bg); }
    }
    .btn-ghost-sm {
      background: none; border: none; cursor: pointer;
      font-size: 12.5px; color: var(--text-3); padding: 0 10px; height: 32px; border-radius: 6px;
      &:hover { background: var(--border-light); }
    }
    .btn-danger-sm {
      background: var(--red-light); color: #991B1B; border: none;
      border-radius: 6px; height: 28px; padding: 0 12px; font-size: 12px; cursor: pointer;
      &:hover { background: var(--red); color: #fff; }
    }

    /* Import panel */
    .import-panel {
      background: var(--blue-light); border: 1px solid var(--border);
      border-radius: 9px; padding: 10px 14px; display: flex; align-items: center; justify-content: space-between;
    }
    .ip-title { display: flex; align-items: center; gap: 7px; font-size: 12.5px; color: var(--text-2); }
    .ip-actions { display: flex; align-items: center; gap: 8px; }

    /* Type filters */
    .type-filters { display: flex; gap: 6px; flex-wrap: wrap; }
    .type-filter {
      font-size: 11.5px; font-weight: 500; padding: 4px 12px; border-radius: 20px;
      border: 1px solid; cursor: pointer; font-family: inherit; transition: all .12s;
      &:hover { opacity: .85; }
    }

    /* Calendar layout */
    .cal-layout { display: grid; grid-template-columns: 1fr 240px; gap: 12px; align-items: start; }

    .cal-grid-wrap {
      background: var(--surface); border: 1px solid var(--border);
      border-radius: 10px; overflow: hidden;
    }
    .day-headers {
      display: grid; grid-template-columns: repeat(7,1fr);
      background: var(--bg); border-bottom: 1px solid var(--border);
    }
    .dh {
      text-align: center; padding: 8px 4px;
      font-size: 10px; font-weight: 600; text-transform: uppercase;
      letter-spacing: .4px; color: var(--text-4);
    }
    .cal-loading { display: flex; justify-content: center; padding: 60px; }

    .day-grid { display: grid; grid-template-columns: repeat(7,1fr); }
    .day-cell {
      min-height: 80px; padding: 5px;
      border-right: 1px solid var(--border-light);
      border-bottom: 1px solid var(--border-light);
      cursor: pointer;
      &:hover { background: var(--bg); }
      &:nth-child(7n) { border-right: none; }
    }
    .day-num {
      font-size: 11.5px; font-weight: 500; width: 24px; height: 24px;
      border-radius: 50%; display: flex; align-items: center; justify-content: center;
      margin-bottom: 3px; color: var(--text-2);
    }
    .day-cell.today .day-num { background: var(--blue); color: #fff; }
    .day-cell.other-month .day-num { color: var(--text-4); }
    .day-cell.weekend .day-num { color: var(--text-3); }
    .day-cell.weekend { background: var(--bg); }

    .ev-chip {
      font-size: 9.5px; font-weight: 500; padding: 1px 5px; border-radius: 3px;
      margin-bottom: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
      cursor: pointer;
      &:hover { opacity: .8; }
    }
    .ev-more { font-size: 9px; color: var(--text-3); padding-left: 2px; }

    /* Sidebar */
    .cal-sidebar { display: flex; flex-direction: column; gap: 10px; }
    .sidebar-card {
      background: var(--surface); border: 1px solid var(--border);
      border-radius: 10px; overflow: hidden;
    }
    .sc-head {
      padding: 9px 12px; background: var(--bg);
      border-bottom: 1px solid var(--border);
      font-size: 12px; font-weight: 600; color: var(--text);
    }
    .sc-body { padding: 8px 12px; display: flex; flex-direction: column; gap: 0; }
    .sc-empty { font-size: 12px; color: var(--text-3); padding: 8px 0; text-align: center; }

    /* Event detail */
    .event-detail { border-color: var(--blue); }
    .ed-head { display: flex; align-items: center; gap: 7px; padding: 9px 12px; background: var(--bg); border-bottom: 1px solid var(--border); }
    .ed-dot  { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; }
    .ed-type { font-size: 11px; font-weight: 600; color: var(--text-2); flex: 1; text-transform: capitalize; }
    .ed-close { background: none; border: none; cursor: pointer; color: var(--text-3); width: 24px; height: 24px; border-radius: 5px; display: flex; align-items: center; justify-content: center; &:hover { background: var(--border); } }
    .ed-body { padding: 10px 12px; display: flex; flex-direction: column; gap: 5px; }
    .ed-title { font-size: 13px; font-weight: 600; color: var(--text); }
    .ed-dates { font-size: 11px; color: var(--text-3); }
    .ed-desc  { font-size: 12px; color: var(--text-2); }
    .ed-att   { display: flex; align-items: center; gap: 5px; font-size: 11px; color: var(--green); }
    .ed-actions { display: flex; gap: 6px; justify-content: flex-end; padding: 8px 12px; border-top: 1px solid var(--border-light); }

    /* Upcoming */
    .up-row { display: flex; align-items: flex-start; gap: 9px; padding: 7px 0; border-bottom: 1px solid var(--border-light); cursor: pointer; &:last-child { border-bottom: none; } &:hover { opacity: .8; } }
    .up-dot  { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; margin-top: 3px; }
    .up-title { font-size: 12px; font-weight: 500; color: var(--text); }
    .up-date  { font-size: 10.5px; color: var(--text-3); margin-top: 1px; }

    /* Legend */
    .leg-row { display: flex; align-items: center; gap: 8px; padding: 4px 0; font-size: 11.5px; color: var(--text-2); }
    .leg-dot { width: 12px; height: 12px; border-radius: 3px; flex-shrink: 0; }

    /* Event form modal */
    .modal-backdrop {
      position: fixed; inset: 0; background: rgba(0,0,0,.4);
      display: flex; align-items: center; justify-content: center;
      z-index: 1000;
    }
    .modal {
      background: var(--surface); border-radius: 12px;
      width: 95vw; max-width: 520px; max-height: 90vh;
      display: flex; flex-direction: column; overflow: hidden;
    }
    .modal-head {
      display: flex; justify-content: space-between; align-items: center;
      padding: 14px 20px; border-bottom: 1px solid var(--border);
      font-size: 15px; font-weight: 600; color: var(--text); flex-shrink: 0;
    }
    .modal-body { flex: 1; overflow-y: auto; padding: 16px 20px; background: var(--bg); }
    .modal-footer {
      display: flex; justify-content: flex-end; gap: 8px;
      padding: 12px 20px; border-top: 1px solid var(--border);
      background: var(--surface); flex-shrink: 0;
    }
    .ev-form { display: flex; flex-direction: column; gap: 12px; }
    .form-row { display: flex; gap: 10px; align-items: flex-end; }
    .fill { flex: 1; min-width: 0; }
    .field-group { display: flex; flex-direction: column; gap: 4px; }
    .fl { font-size: 12px; font-weight: 500; color: var(--text-2); .req { color: var(--red); } }
    .fi {
      height: 34px; padding: 0 10px; width: 100%;
      background: var(--surface); border: 1px solid var(--border);
      border-radius: 7px; font-size: 13px; color: var(--text);
      outline: none; font-family: inherit;
      &:focus { border-color: var(--blue); }
    }
    select.fi { cursor: pointer; }
    .ta { height: auto; padding: 8px 10px; resize: vertical; }
    .check-label { display: flex; align-items: center; gap: 6px; font-size: 13px; color: var(--text-2); cursor: pointer; }
    .form-err {
      display: flex; align-items: center; gap: 7px; flex-shrink: 0;
      background: var(--red-light); padding: 10px 20px;
      font-size: 12px; color: #991B1B;
    }

    /* Import form */
  `],
})
export class CalendarComponent implements OnInit {
  private api   = inject(ApiService);
  private snack = inject(MatSnackBar);
  private auth  = inject(AuthService);
  private fb    = inject(FormBuilder);

  events       = signal<CalendarEvent[]>([]);
  loading      = signal(true);
  saving       = signal(false);
  importing    = signal(false);
  showImport   = signal(false);
  showEventForm = signal(false);
  editingEvent = signal<CalendarEvent | null>(null);
  selectedEvent = signal<CalendarEvent | null>(null);
  formError    = signal('');
  activeFilters = signal<string[]>(EVENT_TYPES.map(e => e.value));
  importYear   = new Date().getFullYear();

  now          = new Date();
  viewYear     = signal(this.now.getFullYear());
  viewMonth    = signal(this.now.getMonth()); // 0-based

  isAdmin = () => ['owner', 'principal'].includes(this.auth.user()?.role ?? '');

  eventTypes = EVENT_TYPES;
  dayNames   = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  monthLabel = computed(() => {
    return new Date(this.viewYear(), this.viewMonth(), 1)
      .toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
  });

  dayCells = computed((): DayCell[] => {
    const year = this.viewYear(), month = this.viewMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrev  = new Date(year, month, 0).getDate();
    const todayStr = this.now.toISOString().slice(0, 10);
    const activeF  = this.activeFilters();
    const allEvents = this.events();

    const cells: DayCell[] = [];

    // Previous month filler
    for (let i = firstDay - 1; i >= 0; i--) {
      const d = new Date(year, month - 1, daysInPrev - i);
      cells.push(this.makeCell(d, false, todayStr, allEvents, activeF));
    }
    // Current month
    for (let d = 1; d <= daysInMonth; d++) {
      cells.push(this.makeCell(new Date(year, month, d), true, todayStr, allEvents, activeF));
    }
    // Next month filler
    const remaining = 42 - cells.length;
    for (let d = 1; d <= remaining; d++) {
      cells.push(this.makeCell(new Date(year, month + 1, d), false, todayStr, allEvents, activeF));
    }
    return cells;
  });

  upcomingEvents = computed(() => {
    const today = this.now.toISOString().slice(0, 10);
    return this.events()
      .filter(e => e.start_date >= today)
      .sort((a, b) => a.start_date.localeCompare(b.start_date))
      .slice(0, 8);
  });

  eventForm = this.fb.group({
    title:              ['', Validators.required],
    event_type:         ['event', Validators.required],
    start_date:         ['', Validators.required],
    end_date:           ['', Validators.required],
    is_all_day:         [true],
    affects_attendance: [false],
    start_time:         [''],
    end_time:           [''],
    description:        [''],
    colour:             ['#2563EB'],
  });

  ngOnInit() { this.loadEvents(); }

  loadEvents() {
    this.loading.set(true);
    const year = this.viewYear(), month = this.viewMonth();
    const from = new Date(year, month - 1, 1).toISOString().slice(0, 10);
    const to   = new Date(year, month + 2, 0).toISOString().slice(0, 10);
    this.api.get<any>('/calendar/events', { from, to }).subscribe({
      next: (res: any) => { this.events.set(res.data ?? []); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  prevMonth() {
    if (this.viewMonth() === 0) { this.viewMonth.set(11); this.viewYear.update(y => y - 1); }
    else this.viewMonth.update(m => m - 1);
    this.loadEvents();
  }

  nextMonth() {
    if (this.viewMonth() === 11) { this.viewMonth.set(0); this.viewYear.update(y => y + 1); }
    else this.viewMonth.update(m => m + 1);
    this.loadEvents();
  }

  goToday() {
    this.viewYear.set(this.now.getFullYear());
    this.viewMonth.set(this.now.getMonth());
    this.loadEvents();
  }

  toggleFilter(type: string) {
    this.activeFilters.update(f =>
      f.includes(type) ? f.filter(x => x !== type) : [...f, type]
    );
  }

  onDayClick(cell: DayCell) {
    if (!this.isAdmin()) return;
    const v = cell.date.toISOString().slice(0, 10);
    this.eventForm.reset({ event_type: 'event', is_all_day: true, colour: '#2563EB', start_date: v, end_date: v });
    this.editingEvent.set(null);
    this.showEventForm.set(true);
  }

  openAddEvent() {
    const today = new Date().toISOString().slice(0, 10);
    this.eventForm.reset({ event_type: 'event', is_all_day: true, colour: '#2563EB', start_date: today, end_date: today });
    this.editingEvent.set(null);
    this.showEventForm.set(true);
  }

  editEvent(ev: CalendarEvent) {
    this.eventForm.patchValue({
      title: ev.title, event_type: ev.event_type,
      start_date: ev.start_date, end_date: ev.end_date,
      is_all_day: ev.is_all_day, affects_attendance: ev.affects_attendance,
      start_time: ev.start_time ?? '', end_time: ev.end_time ?? '',
      description: ev.description ?? '', colour: ev.colour ?? '#2563EB',
    });
    this.editingEvent.set(ev);
    this.showEventForm.set(true);
  }

  closeEventForm() { this.showEventForm.set(false); this.editingEvent.set(null); this.formError.set(''); }

  saveEvent() {
    if (this.eventForm.invalid) { this.eventForm.markAllAsTouched(); return; }
    this.saving.set(true); this.formError.set('');
    const v = this.eventForm.value;
    const payload: any = {
      title: v.title, event_type: v.event_type,
      start_date: v.start_date, end_date: v.end_date,
      is_all_day: v.is_all_day, affects_attendance: v.affects_attendance,
      colour: v.colour,
    };
    if (!v.is_all_day && v.start_time) payload.start_time = v.start_time;
    if (!v.is_all_day && v.end_time)   payload.end_time   = v.end_time;
    if (v.description?.trim()) payload.description = v.description.trim();

    const req = this.editingEvent()
      ? this.api.patch<any>('/calendar/events/' + this.editingEvent()!.id, payload)
      : this.api.post<any>('/calendar/events', payload);

    req.subscribe({
      next: () => {
        this.saving.set(false);
        this.closeEventForm();
        this.snack.open(this.editingEvent() ? 'Event updated' : 'Event added', 'OK', { duration: 2500 });
        this.loadEvents();
      },
      error: (err: any) => {
        this.saving.set(false);
        this.formError.set(err.error?.error?.message ?? 'Failed to save event');
      },
    });
  }

  deleteEvent(id: string) {
    if (!confirm('Delete this event?')) return;
    this.api.delete<any>('/calendar/events/' + id).subscribe({
      next: () => {
        this.snack.open('Event deleted', 'OK', { duration: 2000 });
        this.selectedEvent.set(null);
        this.loadEvents();
      },
      error: (err: any) => this.snack.open(err.error?.error?.message ?? 'Error', 'OK', { duration: 3000 }),
    });
  }

  selectEvent(ev: CalendarEvent) { this.selectedEvent.set(ev); }

  importHolidays() {
    this.importing.set(true);
    const holidays = this.getIndianHolidays(this.importYear);
    let saved = 0;
    const doNext = (i: number) => {
      if (i >= holidays.length) {
        this.importing.set(false);
        this.showImport.set(false);
        this.snack.open(`${saved} holidays imported for ${this.importYear}`, 'OK', { duration: 3000 });
        this.loadEvents();
        return;
      }
      this.api.post<any>('/calendar/events', holidays[i]).subscribe({
        next: () => { saved++; doNext(i + 1); },
        error: () => doNext(i + 1),
      });
    };
    doNext(0);
  }

  private makeCell(date: Date, isCurrentMonth: boolean, todayStr: string, events: CalendarEvent[], activeF: string[]): DayCell {
    const dateStr = date.toISOString().slice(0, 10);
    const dayEvents = events.filter(e =>
      dateStr >= e.start_date.slice(0, 10) &&
      dateStr <= e.end_date.slice(0, 10) &&
      activeF.includes(e.event_type)
    );
    return {
      date, dateStr, day: date.getDate(), isCurrentMonth,
      isToday: dateStr === todayStr,
      isWeekend: date.getDay() === 0 || date.getDay() === 6,
      events: dayEvents,
    };
  }

  getTypeMeta(type: string) {
    return EVENT_TYPES.find(e => e.value === type) ?? EVENT_TYPES[EVENT_TYPES.length - 1];
  }

  getEvColor(ev: CalendarEvent): string {
    if (ev.colour && ev.colour !== '#2563EB') return ev.colour;
    return this.getTypeMeta(ev.event_type).color;
  }

  getEvBg(ev: CalendarEvent): string {
    return this.getTypeMeta(ev.event_type).bg;
  }

  private getIndianHolidays(year: number) {
    const h = [
      { title: "New Year's Day",    date: `${year}-01-01` },
      { title: 'Republic Day',      date: `${year}-01-26` },
      { title: 'Holi',              date: `${year}-03-14` },
      { title: 'Good Friday',       date: `${year}-04-18` },
      { title: 'Ambedkar Jayanti',  date: `${year}-04-14` },
      { title: 'Labour Day',        date: `${year}-05-01` },
      { title: 'Independence Day',  date: `${year}-08-15` },
      { title: 'Janmashtami',       date: `${year}-08-16` },
      { title: 'Gandhi Jayanti',    date: `${year}-10-02` },
      { title: 'Dussehra',          date: `${year}-10-02` },
      { title: 'Diwali',            date: `${year}-10-20` },
      { title: 'Guru Nanak Jayanti',date: `${year}-11-05` },
      { title: 'Christmas',         date: `${year}-12-25` },
    ];
    return h.map(({ title, date }) => ({
      title, event_type: 'holiday', start_date: date, end_date: date,
      is_all_day: true, affects_attendance: true, colour: '#DC2626',
    }));
  }
}
