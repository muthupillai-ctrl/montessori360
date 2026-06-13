import { Component, inject, signal, OnInit } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatButtonModule } from '@angular/material/button';
import { DecimalPipe, DatePipe } from '@angular/common';
import { ApiService } from '../../core/services/api.service';
import type { DashboardData } from '../../core/models';
import { AuthService } from '../../core/services/auth.service';
import { StaffDashboardComponent } from './staff-dashboard.component';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [ MatIconModule, MatProgressSpinnerModule, MatButtonModule, DecimalPipe, DatePipe,
    StaffDashboardComponent ],
  template: `
    <div class="page-header">
      <div>
        <h1>Good {{ greeting() }}{{ auth.user()?.name ? ', ' + auth.user()!.name.split(' ')[0] : '' }}</h1>
        <div class="subtitle">{{ today | date:'EEEE, d MMMM yyyy' }}</div>
      </div>
    </div>

    @if (isStaff()) {
      <app-staff-dashboard />
    }

    @if (loading()) {
      <div class="loading-state">
        <mat-progress-spinner mode="indeterminate" diameter="36" />
        <span>Loading dashboard…</span>
      </div>
    }

    @if (data(); as d) {

      <!-- Metric cards -->
      <div class="metrics-grid">
        <div class="metric-card blue">
          <div class="mc-icon"><mat-icon>people</mat-icon></div>
          <div class="mc-label">Total Students</div>
          <div class="mc-value">{{ d.students.active }}</div>
          <div class="mc-sub up">
            <mat-icon style="font-size:12px;width:12px;height:12px">arrow_upward</mat-icon>
            {{ d.students.new_this_month }} new this month
          </div>
        </div>

        <div class="metric-card green">
          <div class="mc-icon"><mat-icon>how_to_reg</mat-icon></div>
          <div class="mc-label">Attendance Today</div>
          <div class="mc-value">{{ d.attendance.today.rate_pct }}%</div>
          <div class="mc-sub" [class.up]="d.attendance.today.rate_pct >= 85" [class.warn]="d.attendance.today.rate_pct < 85">
            {{ d.attendance.today.present }} present · {{ d.attendance.today.absent }} absent
          </div>
        </div>

        <div class="metric-card amber">
          <div class="mc-icon"><mat-icon>payments</mat-icon></div>
          <div class="mc-label">Fee Collection</div>
          <div class="mc-value">{{ d.fees.current_month.collection_pct }}%</div>
          <div class="mc-sub warn">
            ₹{{ d.fees.current_month.outstanding | number }} outstanding
          </div>
        </div>

        <div class="metric-card purple">
          <div class="mc-icon"><mat-icon>psychology</mat-icon></div>
          <div class="mc-label">Dev. Mastery</div>
          <div class="mc-value">{{ d.observations.overall_mastery_pct }}%</div>
          <div class="mc-sub up">Across 5 domains</div>
        </div>
      </div>

      <!-- Row 2: Leave + Overview -->
      <div class="two-col-grid">

        <!-- Staff Leave card -->
        <div class="section-card">
          <div class="sc-header">
            <div class="sc-title">Staff Leave</div>
          </div>
          <div class="sc-body">
            <div class="leave-sec-title">On Leave Today</div>
            @if (!leaveOverview()?.on_leave_today?.length) {
              <div class="leave-empty">All staff present today</div>
            } @else {
              @for (r of leaveOverview()!.on_leave_today; track r.id) {
                <div class="lv-row">
                  <div class="lv-av" [style.background]="getAvatarColor(r.staff_name)">{{ r.staff_name[0] }}</div>
                  <div class="lv-info">
                    <div class="lv-name">{{ r.staff_name }}</div>
                    <div class="lv-sub">
                      <span class="lv-pill" [style.background]="leaveColor(r.leave_type).bg" [style.color]="leaveColor(r.leave_type).color">{{ leaveLabel(r.leave_type) }}</span>
                      · returns {{ r.to_date | date:'d MMM' }}
                    </div>
                  </div>
                  <span class="lv-days">{{ r.days }}d left</span>
                </div>
              }
            }
            <div class="leave-sec-title" style="margin-top:10px">Upcoming · next 7 days</div>
            @if (!leaveOverview()?.upcoming_leaves?.length) {
              <div class="leave-empty">No upcoming leaves</div>
            } @else {
              @for (r of leaveOverview()!.upcoming_leaves; track r.id) {
                <div class="lv-row">
                  <div class="lv-av" [style.background]="getAvatarColor(r.staff_name)">{{ r.staff_name[0] }}</div>
                  <div class="lv-info">
                    <div class="lv-name">{{ r.staff_name }}</div>
                    <div class="lv-sub">
                      <span class="lv-pill" [style.background]="leaveColor(r.leave_type).bg" [style.color]="leaveColor(r.leave_type).color">{{ leaveLabel(r.leave_type) }}</span>
                      · {{ r.from_date | date:'d MMM' }}
                      @if (r.from_date !== r.to_date) { – {{ r.to_date | date:'d MMM' }} }
                    </div>
                  </div>
                  <span class="lv-days">{{ r.days }}d</span>
                </div>
              }
            }
          </div>
        </div>

        <!-- Overview card -->
        <div class="section-card">
          <div class="sc-header">
            <div class="sc-title">Overview</div>
            <div class="sc-sub">At a glance</div>
          </div>
          <div class="sc-body">
            <div class="qs-list">
              <div class="qs-item">
                <div class="qs-icon" style="background:rgba(16,185,129,.1);color:#10B981">
                  <mat-icon style="font-size:16px;width:16px;height:16px">school</mat-icon>
                </div>
                <div class="qs-text">
                  <div class="qs-label">Staff Active</div>
                  <div class="qs-sub">{{ d.staff.pending_leaves }} leave pending</div>
                </div>
                <div class="qs-val">{{ d.staff.total_active }}</div>
              </div>
              <div class="qs-item">
                <div class="qs-icon" style="background:rgba(239,68,68,.1);color:#EF4444">
                  <mat-icon style="font-size:16px;width:16px;height:16px">warning</mat-icon>
                </div>
                <div class="qs-text">
                  <div class="qs-label">Fee Defaulters</div>
                  <div class="qs-sub">Overdue invoices</div>
                </div>
                <div class="qs-val" style="color:#EF4444">{{ d.fees.defaulters_count }}</div>
              </div>
              <div class="qs-item">
                <div class="qs-icon" style="background:rgba(249,115,22,.1);color:#F97316">
                  <mat-icon style="font-size:16px;width:16px;height:16px">forum</mat-icon>
                </div>
                <div class="qs-text">
                  <div class="qs-label">Unread Messages</div>
                  <div class="qs-sub">{{ d.communication.pending_ack_circulars }} circular acks pending</div>
                </div>
                <div class="qs-val">{{ d.communication.unread_messages }}</div>
              </div>
              <div class="qs-item">
                <div class="qs-icon" style="background:rgba(236,72,153,.1);color:#EC4899">
                  <mat-icon style="font-size:16px;width:16px;height:16px">auto_stories</mat-icon>
                </div>
                <div class="qs-text">
                  <div class="qs-label">Journals Today</div>
                  <div class="qs-sub">{{ d.journals.today.completion_pct }}% completion</div>
                </div>
                <div class="qs-val">{{ d.journals.today.journals_published }}/{{ d.journals.today.total_students }}</div>
              </div>
              <div class="qs-item">
                <div class="qs-icon" style="background:rgba(20,184,166,.1);color:#14B8A6">
                  <mat-icon style="font-size:16px;width:16px;height:16px">directions_bus</mat-icon>
                </div>
                <div class="qs-text">
                  <div class="qs-label">Transport</div>
                  <div class="qs-sub">{{ d.transport.active_routes }} active routes</div>
                </div>
                <div class="qs-val">{{ d.transport.trips_in_progress }} trips</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Class enrolment — full width -->
      <div class="section-card">
        <div class="sc-header">
          <div><div class="sc-title">Class Enrolment</div><div class="sc-sub">Students vs capacity</div></div>
        </div>
        <div class="sc-body">
          <div class="class-grid">
            @for (cls of d.students.by_class; track cls.class_name) {
              <div class="class-card">
                <div class="cc-top">
                  <span class="cc-name">{{ cls.class_name }}</span>
                  <span class="cc-count">{{ cls.count }}<span class="cc-cap">/{{ cls.capacity }}</span></span>
                </div>
                <div class="cc-bar-track">
                  <div class="cc-bar-fill" [style.width.%]="cls.fill_pct"
                       [style.background]="cls.fill_pct >= 90 ? 'var(--amber)' : 'var(--blue)'"></div>
                </div>
                <div class="cc-pct">{{ cls.fill_pct }}% full</div>
              </div>
            }
          </div>
        </div>
      </div>

    }
  `,
  styles: [`
    .two-col-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }

    /* Staff Leave card */
    .leave-sec-title { font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: .4px; color: var(--text-4); margin-bottom: 6px; }
    .leave-empty { font-size: 12px; color: var(--text-3); padding: 8px 0; }
    .lv-row { display: flex; align-items: center; gap: 9px; padding: 7px 0; border-bottom: 1px solid var(--border-light); &:last-child { border-bottom: none; } }
    .lv-av  { width: 26px; height: 26px; border-radius: 6px; color: #fff; font-size: 10px; font-weight: 700; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
    .lv-info { flex: 1; min-width: 0; }
    .lv-name { font-size: 12px; font-weight: 500; color: var(--text); }
    .lv-sub  { font-size: 10.5px; color: var(--text-3); margin-top: 2px; display: flex; align-items: center; gap: 4px; }
    .lv-pill { font-size: 10px; font-weight: 600; padding: 1px 5px; border-radius: 3px; white-space: nowrap; }
    .lv-days { font-size: 10px; font-weight: 600; padding: 2px 6px; border-radius: 10px; background: var(--bg); color: var(--text-2); flex-shrink: 0; }

    .section-heading {
      display: flex; align-items: center; gap: 8px;
      font-size: 14px; font-weight: 600; color: var(--text);
      padding: 4px 0 8px; border-bottom: 1px solid var(--border); margin-bottom: 4px;
    }
    .loading-state {
      display: flex; align-items: center; gap: 12px;
      justify-content: center; padding: 80px;
      color: var(--text-3); font-size: 13px;
    }

    .metrics-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 12px;
    }

    .content-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      grid-auto-rows: auto;
      gap: 12px;
      .span-2 { grid-column: span 2; }
    }

    /* Trend chart */
    .trend-chart {
      display: flex;
      align-items: flex-end;
      gap: 8px;
      height: 80px;
      margin-bottom: 14px;
    }
    .bar-col   { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 3px; height: 100%; }
    .bar-pct   { font-size: 9px; color: var(--text-4); font-weight: 500; }
    .bar-track { flex: 1; width: 100%; background: var(--bg); border-radius: 3px; overflow: hidden; display: flex; align-items: flex-end; }
    .bar-fill  { width: 100%; background: var(--blue); border-radius: 3px; transition: height .3s; min-height: 4px; }
    .bar-day   { font-size: 10px; color: var(--text-4); }

    .att-legend { display: flex; gap: 16px; }
    .att-stat   { display: flex; align-items: center; gap: 5px; }
    .att-dot    { width: 6px; height: 6px; border-radius: 50%; }
    .att-dot.green { background: var(--green); }
    .att-dot.red   { background: var(--red); }
    .att-dot.amber { background: var(--amber); }
    .att-dot.grey  { background: var(--text-4); }
    .att-num  { font-size: 12px; font-weight: 600; color: var(--text); }
    .att-lbl  { font-size: 11px; color: var(--text-3); }

    /* Quick stats */
    .qs-list { display: flex; flex-direction: column; }
    .qs-item {
      display: flex; align-items: center; gap: 10px;
      padding: 9px 0; border-bottom: 1px solid var(--border-light);
      &:last-child { border-bottom: none; }
    }
    .qs-icon { width: 30px; height: 30px; border-radius: 8px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
    .qs-text { flex: 1; min-width: 0; }
    .qs-label { font-size: 12.5px; font-weight: 500; color: var(--text-2); }
    .qs-sub   { font-size: 11px; color: var(--text-3); margin-top: 1px; }
    .qs-val   { font-size: 14px; font-weight: 600; color: var(--text); }

    /* Class grid */
    .class-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 12px; }
    .class-card { background: var(--bg); border-radius: 8px; padding: 12px; }
    .cc-top   { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 8px; }
    .cc-name  { font-size: 12px; font-weight: 500; color: var(--text-2); }
    .cc-count { font-size: 15px; font-weight: 600; color: var(--text); }
    .cc-cap   { font-size: 11px; color: var(--text-3); font-weight: 400; }
    .cc-bar-track { height: 5px; background: var(--border); border-radius: 3px; overflow: hidden; margin-bottom: 5px; }
    .cc-bar-fill  { height: 100%; border-radius: 3px; transition: width .3s; }
    .cc-pct   { font-size: 10px; color: var(--text-4); }
  `],
})
export class DashboardComponent implements OnInit {
  private api  = inject(ApiService);
  auth = inject(AuthService);

  isAdmin = () => ['owner','principal'].includes(this.auth.user()?.role ?? '');
  isStaff = () => !this.isAdmin();

  loading       = signal(true);
  data          = signal<DashboardData | null>(null);
  leaveOverview = signal<any | null>(null);
  leaveLoading  = signal(false);
  today   = new Date();

  loadLeaveOverview() {
    this.leaveLoading.set(true);
    this.api.get<any>('/analytics/leave-overview').subscribe({
      next: (res: any) => { this.leaveOverview.set(res.data); this.leaveLoading.set(false); },
      error: () => this.leaveLoading.set(false),
    });
  }

  getAvatarColor(name: string): string {
    const colors = ['#2563EB','#7C3AED','#DB2777','#D97706','#059669','#0891B2'];
    return colors[(name?.charCodeAt(0) || 0) % colors.length];
  }

  leaveColor(type: string) {
    const m: Record<string,{color:string;bg:string}> = {
      casual:    { color:'#1D4ED8', bg:'#EFF6FF' },
      sick:      { color:'#065F46', bg:'#ECFDF5' },
      earned:    { color:'#5B21B6', bg:'#F5F3FF' },
      maternity: { color:'#9D174D', bg:'#FDF2F8' },
      paternity: { color:'#92400E', bg:'#FFFBEB' },
      lwp:       { color:'#991B1B', bg:'#FEF2F2' },
      other:     { color:'#6B7280', bg:'#F9FAFB' },
    };
    return m[type] ?? { color:'#6B7280', bg:'#F9FAFB' };
  }

  leaveLabel(type: string) {
    const m: Record<string,string> = { casual:'Casual', sick:'Sick', earned:'Earned', maternity:'Maternity', paternity:'Paternity', lwp:'LWP', other:'Other' };
    return m[type] ?? type;
  }

  greeting = signal((() => {
    const h = new Date().getHours();
    if (h < 12) return 'morning 👋';
    if (h < 17) return 'afternoon 👋';
    return 'evening 👋';
  })());

  ngOnInit() {
    if (this.isAdmin()) this.loadLeaveOverview();
    this.api.get<{ data: DashboardData }>('/analytics/dashboard').subscribe({
      next:  res => { this.data.set(res.data); this.loading.set(false); },
      error: ()  => this.loading.set(false),
    });
  }
}
