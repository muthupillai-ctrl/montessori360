import { Component, inject, signal, OnInit, computed } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { DatePipe, TitleCasePipe } from '@angular/common';
import { Router } from '@angular/router';
import { ApiService } from '../../core/services/api.service';
import { AuthService } from '../../core/services/auth.service';

const LEAVE_META: Record<string, { label: string; color: string; bg: string }> = {
  casual:    { label: 'Casual',    color: '#1D4ED8', bg: '#EFF6FF' },
  sick:      { label: 'Sick',      color: '#065F46', bg: '#ECFDF5' },
  earned:    { label: 'Earned',    color: '#5B21B6', bg: '#F5F3FF' },
  maternity: { label: 'Maternity', color: '#9D174D', bg: '#FDF2F8' },
  paternity: { label: 'Paternity', color: '#92400E', bg: '#FFFBEB' },
  lwp:       { label: 'LWP',       color: '#991B1B', bg: '#FEF2F2' },
  other:     { label: 'Other',     color: '#6B7280', bg: '#F9FAFB' },
};
const STATUS_META: Record<string, { color: string; bg: string }> = {
  pending:  { color: '#92400E', bg: '#FFFBEB' },
  approved: { color: '#065F46', bg: '#ECFDF5' },
  rejected: { color: '#991B1B', bg: '#FEF2F2' },
};

const QUICK_ACTIONS = [
  { icon: 'how_to_reg', label: 'Mark Attendance', route: '/attendance', bg: '#EFF6FF',   color: '#2563EB' },
  { icon: 'menu_book',  label: 'Write Journal',   route: '/journal',    bg: '#ECFDF5',   color: '#059669' },
  { icon: 'beach_access',label:'Apply Leave',     route: '/staff',      bg: '#F5F3FF',   color: '#7C3AED' },
  { icon: 'forum',      label: 'Send Message',    route: '/communication', bg: '#FFFBEB', color: '#D97706' },
  { icon: 'psychology', label: 'Observation',     route: '/observations',bg: '#FDF2F8',  color: '#DB2777' },
  { icon: 'people',     label: 'Students',        route: '/students',   bg: '#ECFEFF',   color: '#0891B2' },
];

@Component({
  selector: 'app-staff-dashboard',
  standalone: true,
  imports: [ MatIconModule, MatProgressSpinnerModule, DatePipe, TitleCasePipe ],
  template: `
    @if (loading()) {
      <div class="loading-state"><mat-progress-spinner mode="indeterminate" diameter="32"/></div>
    } @else {
      <div class="staff-dash">

        <!-- Row 1: Quick Actions + Announcements -->
        <!-- Today's Timetable - full width above row-2 -->
        @if (data()?.today_schedule !== undefined) {
          <div class="widget today-schedule-widget">
            <div class="widget-head">
              <mat-icon class="wh-icon" style="color:var(--blue)">calendar_view_day</mat-icon>
              Today's Schedule — {{ today | date:'EEEE, d MMM' }}
            </div>
            @if (!data()!.today_schedule?.length) {
              <div class="empty-widget">No classes scheduled for today</div>
            } @else {
            <div class="ts-list">
              @for (slot of data()!.today_schedule; track slot.slot_name) {
                <div class="ts-row" [class]="'stype-' + slot.slot_type">
                  <div class="ts-time">
                    <div class="ts-start">{{ slot.start_time }}</div>
                    <div class="ts-end">{{ slot.end_time }}</div>
                  </div>
                  <div class="ts-bar" [style.background]="slot.subject_color ?? '#E5E7EB'"></div>
                  <div class="ts-info">
                    <div class="ts-slot-name">{{ slot.slot_name }}</div>
                    @if (slot.subject_name) {
                      <div class="ts-subject" [style.color]="slot.subject_color">{{ slot.subject_name }}</div>
                    } @else {
                      <div class="ts-subject muted">{{ slot.slot_type | titlecase }}</div>
                    }
                  </div>
                  <div class="ts-class">
                    {{ slot.class_name }}{{ slot.class_section ? ' — ' + slot.class_section : '' }}
                  </div>
                </div>
              }
            </div>
            }
          </div>
        }

        <div class="row-2">

          <!-- Quick Actions -->
          <div class="widget">
            <div class="widget-head">
              <mat-icon class="wh-icon" style="color:var(--green)">bolt</mat-icon>
              Quick Actions
            </div>
            <div class="qa-grid">
              @for (a of quickActions; track a.route) {
                <button class="qa-btn" (click)="nav(a.route)">
                  <div class="qa-icon" [style.background]="a.bg" [style.color]="a.color">
                    <mat-icon style="font-size:20px;width:20px;height:20px">{{ a.icon }}</mat-icon>
                  </div>
                  <span>{{ a.label }}</span>
                </button>
              }
            </div>
          </div>

          <!-- Announcements -->
          <div class="widget">
            <div class="widget-head">
              <mat-icon class="wh-icon" style="color:var(--amber)">campaign</mat-icon>
              Announcements
              <button class="wh-link" (click)="nav('/communication')">View all →</button>
            </div>
            @if (!data()?.announcements?.length) {
              <div class="empty-widget">No announcements</div>
            } @else {
              <div class="ann-list">
                @for (a of data()!.announcements; track a.id) {
                  <div class="ann-row">
                    <div class="ann-dot"></div>
                    <div class="ann-body">
                      <div class="ann-title">{{ a.title }}</div>
                      <div class="ann-meta">{{ a.published_at | date:'d MMM' }} · {{ a.author }}</div>
                    </div>
                  </div>
                }
              </div>
            }
          </div>

        </div>

        <!-- Row 2: Today + My Classes + Leave Balance -->
        <div class="row-3">

          <!-- Today -->
          <div class="widget">
            <div class="widget-head">
              <mat-icon class="wh-icon" style="color:var(--amber)">today</mat-icon>
              Today
              <span class="wh-date">{{ today | date:'EEE, d MMM' }}</span>
            </div>
            @if (data()?.my_classes?.length) {
              <div class="today-grid">
                <div class="tg-card" style="background:var(--blue-light)">
                  <div class="tg-val">{{ totalPresent() }}</div>
                  <div class="tg-lbl">Present</div>
                </div>
                <div class="tg-card" style="background:var(--amber-light)">
                  <div class="tg-val">{{ totalStudents() - totalPresent() }}</div>
                  <div class="tg-lbl">Absent</div>
                </div>
                <div class="tg-card" style="background:var(--green-light)">
                  <div class="tg-val">{{ data()!.my_classes.length }}</div>
                  <div class="tg-lbl">My Classes</div>
                </div>
              </div>
            } @else {
              <div class="empty-widget">No classes assigned</div>
            }
            <div class="msg-row" (click)="nav('/communication')">
              <mat-icon style="font-size:14px;width:14px;height:14px;color:var(--blue)">mail</mat-icon>
              <span>{{ data()?.unread_messages ?? 0 }} unread message{{ (data()?.unread_messages ?? 0) !== 1 ? 's' : '' }}</span>
              <span class="wh-link" style="font-size:11px">View →</span>
            </div>
          </div>

          <!-- My Classes -->
          <div class="widget">
            <div class="widget-head">
              <mat-icon class="wh-icon" style="color:var(--purple)">class</mat-icon>
              My Classes
            </div>
            @if (!data()?.my_classes?.length) {
              <div class="empty-widget">No classes assigned</div>
            } @else {
              @for (cls of data()!.my_classes; track cls.id) {
                <div class="cls-row" (click)="nav('/attendance')">
                  <div class="cls-av" [style.background]="getColor(cls.name)">
                    {{ cls.name.slice(0,2).toUpperCase() }}
                  </div>
                  <div class="cls-info">
                    <div class="cls-name">{{ cls.name }}</div>
                    <div class="cls-meta">{{ cls.student_count }} students</div>
                  </div>
                  <div class="cls-att">
                    <span style="color:var(--green);font-weight:700;font-size:14px">{{ cls.present_today }}</span>
                    <span style="color:var(--text-3);font-size:11px">/{{ cls.student_count }}</span>
                  </div>
                </div>
              }
            }
          </div>

          <!-- Leave Balance -->
          <div class="widget">
            <div class="widget-head">
              <mat-icon class="wh-icon" style="color:var(--blue)">beach_access</mat-icon>
              Leave Balance
              <button class="wh-link" (click)="nav('/staff')">Apply →</button>
            </div>
            @if (data()?.balance) {
              <div class="bal-list">
                @for (b of balanceRows(); track b.key) {
                  <div class="bal-row">
                    <span class="bal-type">{{ b.label }}</span>
                    <div class="bal-bar-outer">
                      <div class="bal-bar-inner"
                           [style.width.%]="b.total > 0 ? (b.used/b.total*100) : 0"
                           [style.background]="b.color"></div>
                    </div>
                    <span class="bal-avail" [style.color]="b.color">{{ b.avail }} left</span>
                  </div>
                }
              </div>
              @if (data()!.leave_requests?.length) {
                <div class="pending-section">
                  <div class="ps-title">My Requests</div>
                  @for (r of data()!.leave_requests; track r.id) {
                    <div class="pr-row">
                      <span class="lt-pill" [style.background]="lm(r.leave_type).bg"
                            [style.color]="lm(r.leave_type).color">{{ lm(r.leave_type).label }}</span>
                      <span class="pr-date">{{ r.from_date | date:'d MMM' }}
                        @if (r.from_date !== r.to_date) { – {{ r.to_date | date:'d MMM' }} }
                      </span>
                      <span class="pr-stat" [style.background]="sm(r.status).bg"
                            [style.color]="sm(r.status).color">{{ r.status }}</span>
                    </div>
                  }
                </div>
              }
            } @else {
              <div class="empty-widget">No balance configured</div>
            }
          </div>

        </div>
      </div>
    }
  `,
  styles: [`
    .loading-state { display: flex; justify-content: center; padding: 60px; }
    .staff-dash { display: flex; flex-direction: column; gap: 12px; }

    .row-2 { display: grid; grid-template-columns: 1fr 1.4fr; gap: 12px; }
    .row-3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }

    .today-schedule-widget { margin-bottom: 14px; }
    .ts-list { display: flex; flex-direction: column; }
    .ts-row  { display: flex; align-items: center; gap: 12px; padding: 10px 0; border-bottom: 1px solid var(--border-light); &:last-child { border: none; } &.stype-break { opacity: .6; } }
    .ts-time  { width: 70px; flex-shrink: 0; }
    .ts-start { font-size: 13px; font-weight: 600; color: var(--text-2); }
    .ts-end   { font-size: 11px; color: var(--text-4); }
    .ts-bar   { width: 4px; height: 36px; border-radius: 3px; flex-shrink: 0; }
    .ts-info  { flex: 1; }
    .ts-slot-name { font-size: 12px; color: var(--text-3); }
    .ts-subject   { font-size: 14px; font-weight: 600; margin-top: 1px; }
    .ts-subject.muted { color: var(--text-3) !important; }
    .ts-class { font-size: 12px; font-weight: 600; color: var(--text-2); background: var(--bg); padding: 4px 10px; border-radius: 8px; white-space: nowrap; }

    .widget {
      background: var(--surface); border: 1px solid var(--border);
      border-radius: 10px; padding: 14px; display: flex; flex-direction: column; gap: 10px;
    }
    .widget-head {
      display: flex; align-items: center; gap: 7px;
      font-size: 13px; font-weight: 600; color: var(--text); flex-shrink: 0;
    }
    .wh-icon { font-size: 16px; width: 16px; height: 16px; flex-shrink: 0; }
    .wh-link { margin-left: auto; font-size: 11px; color: var(--blue); background: none; border: none; cursor: pointer; }
    .wh-date { margin-left: auto; font-size: 11px; color: var(--text-3); font-weight: 400; }
    .empty-widget { font-size: 12px; color: var(--text-3); text-align: center; padding: 12px 0; }

    /* Quick actions */
    .qa-grid { display: grid; grid-template-columns: repeat(3,1fr); gap: 8px; }
    .qa-btn {
      display: flex; flex-direction: column; align-items: center; gap: 7px;
      background: var(--bg); border: 1px solid var(--border); border-radius: 9px;
      padding: 12px 6px; cursor: pointer; font-size: 11px; color: var(--text-2);
      font-family: inherit; text-align: center; line-height: 1.3;
      &:hover { background: var(--blue-light); border-color: var(--blue); color: var(--blue); }
    }
    .qa-icon { width: 36px; height: 36px; border-radius: 9px; display: flex; align-items: center; justify-content: center; }

    /* Announcements */
    .ann-list { display: flex; flex-direction: column; gap: 0; }
    .ann-row  { display: flex; align-items: flex-start; gap: 9px; padding: 8px 0; border-bottom: 1px solid var(--border-light); &:last-child { border-bottom: none; } }
    .ann-dot  { width: 6px; height: 6px; border-radius: 50%; background: var(--amber); flex-shrink: 0; margin-top: 5px; }
    .ann-title { font-size: 12.5px; font-weight: 500; color: var(--text); line-height: 1.4; }
    .ann-meta  { font-size: 10.5px; color: var(--text-3); margin-top: 2px; }

    /* Today */
    .today-grid { display: grid; grid-template-columns: repeat(3,1fr); gap: 6px; }
    .tg-card { border-radius: 8px; padding: 10px 6px; text-align: center; }
    .tg-val  { font-size: 20px; font-weight: 700; color: var(--text); }
    .tg-lbl  { font-size: 10px; color: var(--text-3); margin-top: 2px; }
    .msg-row { display: flex; align-items: center; gap: 6px; padding: 8px 10px; background: var(--bg); border-radius: 7px; cursor: pointer; font-size: 12px; color: var(--text-2); &:hover { background: var(--border-light); } }

    /* Classes */
    .cls-row { display: flex; align-items: center; gap: 10px; padding: 7px 0; border-bottom: 1px solid var(--border-light); cursor: pointer; &:last-child { border-bottom: none; } &:hover { opacity: .85; } }
    .cls-av  { width: 32px; height: 32px; border-radius: 8px; color: #fff; font-size: 10px; font-weight: 700; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
    .cls-name { font-size: 12.5px; font-weight: 500; color: var(--text); }
    .cls-meta { font-size: 11px; color: var(--text-3); }
    .cls-att  { display: flex; align-items: baseline; gap: 2px; flex-shrink: 0; }

    /* Leave balance */
    .bal-list { display: flex; flex-direction: column; gap: 8px; }
    .bal-row  { display: flex; align-items: center; gap: 7px; }
    .bal-type { font-size: 11px; color: var(--text-2); width: 44px; flex-shrink: 0; }
    .bal-bar-outer { flex: 1; height: 5px; background: var(--border); border-radius: 3px; overflow: hidden; }
    .bal-bar-inner { height: 100%; border-radius: 3px; }
    .bal-avail { font-size: 11px; font-weight: 600; width: 40px; text-align: right; flex-shrink: 0; }
    .pending-section { border-top: 1px solid var(--border-light); padding-top: 8px; display: flex; flex-direction: column; gap: 5px; }
    .ps-title { font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: .3px; color: var(--text-4); }
    .pr-row  { display: flex; align-items: center; gap: 6px; }
    .lt-pill { font-size: 10px; font-weight: 600; padding: 1px 6px; border-radius: 4px; white-space: nowrap; }
    .pr-date { font-size: 11px; color: var(--text-3); flex: 1; }
    .pr-stat { font-size: 10px; font-weight: 600; padding: 1px 7px; border-radius: 10px; text-transform: capitalize; }
  `],
})
export class StaffDashboardComponent implements OnInit {
  private api    = inject(ApiService);
  private router = inject(Router);
  private auth   = inject(AuthService);

  data    = signal<any | null>(null);
  loading = signal(true);
  today   = new Date();
  quickActions = QUICK_ACTIONS;

  ngOnInit() {
    this.api.get<any>('/analytics/staff-dashboard').subscribe({
      next: (res: any) => { this.data.set(res.data); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  balanceRows() {
    const b = this.data()?.balance; if (!b) return [];
    return [
      { key:'casual', label:'Casual', color:'#2563EB', total:b.casual,  used:b.casual_used,  avail:b.casual -b.casual_used  },
      { key:'sick',   label:'Sick',   color:'#10B981', total:b.sick,    used:b.sick_used,    avail:b.sick   -b.sick_used    },
      { key:'earned', label:'Earned', color:'#7C3AED', total:b.earned,  used:b.earned_used,  avail:b.earned -b.earned_used  },
    ];
  }

  isTeacher() { return ['teacher','assistant_teacher'].includes(this.auth.user()?.role ?? ''); }
  totalStudents() { return (this.data()?.my_classes ?? []).reduce((s: number, c: any) => s + (+c.student_count||0), 0); }
  totalPresent()  { return (this.data()?.my_classes ?? []).reduce((s: number, c: any) => s + (+c.present_today||0), 0); }

  lm(t: string) { return LEAVE_META[t] ?? { label: t, color: '#6B7280', bg: '#F9FAFB' }; }
  sm(s: string) { return STATUS_META[s] ?? { color: '#6B7280', bg: '#F9FAFB' }; }
  getColor(n: string) { const c=['#2563EB','#7C3AED','#DB2777','#D97706','#059669','#0891B2']; return c[(n?.charCodeAt(0)||0)%c.length]; }
  nav(path: string) { this.router.navigate([path]); }
}
