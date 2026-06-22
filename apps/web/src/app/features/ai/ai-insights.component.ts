import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { DatePipe, DecimalPipe, NgTemplateOutlet } from '@angular/common';
import { ApiService } from '../../core/services/api.service';

interface AiInsight {
  id: string;
  type: string;
  severity: 'low' | 'medium' | 'high';
  student_id: string | null;
  student_name?: string;
  message: string;
  metadata: Record<string, unknown>;
  created_at: string;
  resolved_at: string | null;
}

interface SchoolHealth {
  attendance_today_rate: number;
  attendance_monthly_avg: number;
  students_at_risk: number;        // < 75% attendance this month
  fee_collection_rate: number;     // collected / total invoiced this month
  overdue_invoices: number;
  overdue_amount: number;
  active_students: number;
  total_staff: number;
}

@Component({
  selector: 'app-ai-insights',
  standalone: true,
  imports: [DatePipe, DecimalPipe, NgTemplateOutlet],
  template: `
    <div class="page-header">
      <div>
        <h1><i class="ti ti-brain" style="margin-right:8px;color:#7C3AED"></i>AI Insights</h1>
        <div class="subtitle">Powered by AI Analytics — continuously monitoring your school data</div>
      </div>
      <div class="header-actions">
        @if (insights().length > 0) {
          <button class="btn-outline" (click)="clearAll()" [disabled]="clearing()">
            <i class="ti ti-checks"></i>
            {{ clearing() ? 'Clearing...' : 'Clear All Alerts' }}
          </button>
        }
        <button class="btn-primary" (click)="runNow()" [disabled]="running()">
          <i class="ti {{ running() ? 'ti-loader-2 spin' : 'ti-refresh' }}"></i>
          {{ running() ? 'Scanning...' : 'Scan Now' }}
        </button>
      </div>
    </div>

    <!-- School Health Overview — always visible -->
    @if (health()) {
      <div class="section-label" style="margin-top:0">
        <i class="ti ti-heart-rate-monitor" style="color:#7C3AED"></i> School Health Overview
        <span class="ai-badge"><i class="ti ti-sparkles"></i> AI Analysis</span>
      </div>
      <div class="health-grid">
        <div class="health-card" [class.warn]="health()!.attendance_today_rate < 75">
          <div class="health-icon"><i class="ti ti-calendar-check"></i></div>
          <div class="health-body">
            <div class="health-val">{{ health()!.attendance_today_rate | number:'1.0-1' }}%</div>
            <div class="health-label">Today's Attendance</div>
            <div class="health-sub">Monthly avg: {{ health()!.attendance_monthly_avg | number:'1.0-1' }}%</div>
          </div>
          <div class="health-status" [class.ok]="health()!.attendance_today_rate >= 85"
               [class.warn]="health()!.attendance_today_rate >= 75 && health()!.attendance_today_rate < 85"
               [class.bad]="health()!.attendance_today_rate < 75">
            {{ health()!.attendance_today_rate >= 85 ? 'Good' : health()!.attendance_today_rate >= 75 ? 'Fair' : 'Low' }}
          </div>
        </div>

        <div class="health-card" [class.warn]="health()!.students_at_risk > 0">
          <div class="health-icon"><i class="ti ti-user-exclamation"></i></div>
          <div class="health-body">
            <div class="health-val">{{ health()!.students_at_risk }}</div>
            <div class="health-label">Fee Defaulters</div>
            <div class="health-sub">Students with overdue invoices</div>
          </div>
          <div class="health-status" [class.ok]="health()!.students_at_risk === 0"
               [class.bad]="health()!.students_at_risk > 0">
            {{ health()!.students_at_risk === 0 ? 'Clear' : 'Action Needed' }}
          </div>
        </div>

        <div class="health-card" [class.warn]="health()!.fee_collection_rate < 80">
          <div class="health-icon"><i class="ti ti-receipt"></i></div>
          <div class="health-body">
            <div class="health-val">{{ health()!.fee_collection_rate | number:'1.0-1' }}%</div>
            <div class="health-label">Fee Collection Rate</div>
            <div class="health-sub">{{ health()!.overdue_invoices }} overdue invoice{{ health()!.overdue_invoices === 1 ? '' : 's' }}</div>
          </div>
          <div class="health-status" [class.ok]="health()!.fee_collection_rate >= 90"
               [class.warn]="health()!.fee_collection_rate >= 75 && health()!.fee_collection_rate < 90"
               [class.bad]="health()!.fee_collection_rate < 75">
            {{ health()!.fee_collection_rate >= 90 ? 'Excellent' : health()!.fee_collection_rate >= 75 ? 'Fair' : 'Low' }}
          </div>
        </div>

        <div class="health-card" [class.warn]="health()!.overdue_amount > 0">
          <div class="health-icon"><i class="ti ti-coin-off"></i></div>
          <div class="health-body">
            <div class="health-val">₹{{ health()!.overdue_amount | number:'1.0-0' }}</div>
            <div class="health-label">Overdue Amount</div>
            <div class="health-sub">Across {{ health()!.overdue_invoices }} invoice{{ health()!.overdue_invoices === 1 ? '' : 's' }}</div>
          </div>
          <div class="health-status" [class.ok]="health()!.overdue_amount === 0"
               [class.bad]="health()!.overdue_amount > 0">
            {{ health()!.overdue_amount === 0 ? 'Clear' : 'Pending' }}
          </div>
        </div>
      </div>
    }

    <!-- Active Alerts -->
    <div class="section-label">
      <i class="ti ti-alert-triangle" style="color:#D97706"></i> Active Alerts
      <div class="alert-counts">
        @if (highCount() > 0)   { <span class="count-chip high">{{ highCount() }} High</span> }
        @if (mediumCount() > 0) { <span class="count-chip medium">{{ mediumCount() }} Medium</span> }
        @if (lowCount() > 0)    { <span class="count-chip low">{{ lowCount() }} Low</span> }
      </div>
    </div>

    @if (loading()) {
      <div class="empty-state">
        <i class="ti ti-loader-2 spin" style="font-size:32px;color:#7C3AED"></i>
        <p>Scanning your school data...</p>
      </div>
    } @else if (insights().length === 0) {
      <div class="empty-state">
        <div class="empty-icon"><i class="ti ti-mood-happy"></i></div>
        <h3>All clear!</h3>
        <p>No anomalies detected. The AI is continuously monitoring attendance patterns, fee defaults, and performance trends.</p>
        <button class="btn-primary" (click)="runNow()" [disabled]="running()" style="margin-top:16px">
          <i class="ti ti-refresh"></i> Run Analysis Now
        </button>
      </div>
    } @else {

      @if (attendanceInsights().length) {
        <div class="type-label">
          <i class="ti ti-chart-line" style="color:#2563EB"></i> Attendance Anomalies
        </div>
        <div class="cards">
          @for (ins of attendanceInsights(); track ins.id) {
            <ng-container [ngTemplateOutlet]="insightCard" [ngTemplateOutletContext]="{ $implicit: ins }" />
          }
        </div>
      }

      @if (feeInsights().length) {
        <div class="type-label">
          <i class="ti ti-coin-off" style="color:#DC2626"></i> Fee Default Risk
        </div>
        <div class="cards">
          @for (ins of feeInsights(); track ins.id) {
            <ng-container [ngTemplateOutlet]="insightCard" [ngTemplateOutletContext]="{ $implicit: ins }" />
          }
        </div>
      }

      @if (otherInsights().length) {
        <div class="type-label">
          <i class="ti ti-alert-triangle" style="color:#D97706"></i> Other Alerts
        </div>
        <div class="cards">
          @for (ins of otherInsights(); track ins.id) {
            <ng-container [ngTemplateOutlet]="insightCard" [ngTemplateOutletContext]="{ $implicit: ins }" />
          }
        </div>
      }
    }

    <!-- AI Usage for this school -->
    @if (usageData()) {
      <div class="section-label" style="margin-top:24px">
        <i class="ti ti-chart-bar" style="color:#7C3AED"></i> AI Credit Usage (This School)
        <span class="ai-badge"><i class="ti ti-sparkles"></i> Anthropic API</span>
      </div>
      <div class="usage-cards">
        <div class="usage-kpi">
          <div class="ukpi-label">Total Cost</div>
          <div class="ukpi-val cost">\${{ usageData()!.total_cost_usd | number:'1.4-4' }}</div>
          <div class="ukpi-sub">all time</div>
        </div>
        <div class="usage-kpi">
          <div class="ukpi-label">API Calls</div>
          <div class="ukpi-val">{{ usageData()!.total_calls | number }}</div>
          <div class="ukpi-sub">all time</div>
        </div>
        <div class="usage-kpi">
          <div class="ukpi-label">Input Tokens</div>
          <div class="ukpi-val">{{ usageData()!.total_input_tokens | number }}</div>
          <div class="ukpi-sub">all time</div>
        </div>
        <div class="usage-kpi">
          <div class="ukpi-label">Output Tokens</div>
          <div class="ukpi-val">{{ usageData()!.total_output_tokens | number }}</div>
          <div class="ukpi-sub">all time</div>
        </div>
      </div>
      @if (usageData()!.by_feature.length) {
        <div class="usage-features">
          @for (row of usageData()!.by_feature; track row.feature) {
            <div class="ufeat-row">
              <span class="ufeat-name">{{ featureLabel(row.feature) }}</span>
              <span class="ufeat-calls">{{ row.calls }} calls</span>
              <span class="ufeat-cost cost">\${{ row.cost_usd | number:'1.4-4' }}</span>
            </div>
          }
        </div>
      }
    }

    <ng-template #insightCard let-ins>
      <div class="insight-card" [attr.data-severity]="ins.severity">
        <div class="card-left">
          <div class="sev-dot" [attr.data-severity]="ins.severity"></div>
          <i class="ti {{ typeIcon(ins.type) }} type-icon" [style.color]="typeColor(ins.type)"></i>
        </div>
        <div class="card-body">
          <div class="card-message">{{ ins.message }}</div>
          <div class="card-detail">
            @if (ins.type === 'attendance_drop' && ins.metadata['recent_rate'] !== undefined) {
              <span class="detail-chip">
                Recent: <strong>{{ ins.metadata['recent_rate'] }}%</strong>
              </span>
              <span class="detail-chip">
                Baseline: <strong>{{ ins.metadata['baseline_rate'] }}%</strong>
              </span>
              <span class="detail-chip drop">
                Drop: <strong>{{ ins.metadata['drop'] }}pp</strong>
              </span>
            }
            @if (ins.type === 'chronic_absenteeism' && ins.metadata['absent_rate'] !== undefined) {
              <span class="detail-chip drop">
                Absent: <strong>{{ ins.metadata['absent_rate'] }}%</strong>
              </span>
              <span class="detail-chip">
                Days absent: <strong>{{ ins.metadata['absent_days'] }}</strong>
              </span>
            }
            @if (ins.type === 'fee_default_risk' && ins.metadata['total_overdue'] !== undefined) {
              <span class="detail-chip drop">
                Overdue: <strong>₹{{ ins.metadata['total_overdue'] | number }}</strong>
              </span>
              <span class="detail-chip">
                Days: <strong>{{ ins.metadata['max_days_overdue'] }}d</strong>
              </span>
              <span class="detail-chip">
                Invoices: <strong>{{ ins.metadata['overdue_count'] }}</strong>
              </span>
            }
          </div>
          <div class="card-meta">
            <span class="sev-badge" [attr.data-severity]="ins.severity">{{ ins.severity }}</span>
            <span class="meta-sep">·</span>
            <span>{{ typeLabel(ins.type) }}</span>
            <span class="meta-sep">·</span>
            <span>{{ ins.created_at | date:'d MMM, h:mm a' }}</span>
          </div>
        </div>
        <button class="dismiss-btn" (click)="resolve(ins.id)" title="Dismiss">
          <i class="ti ti-x"></i>
        </button>
      </div>
    </ng-template>
  `,
  styles: [`
    :host { display: block; }

    .page-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 24px; }
    h1 { font-size: 22px; font-weight: 700; margin: 0 0 4px; color: var(--text-1); display: flex; align-items: center; }
    .subtitle { font-size: 13px; color: var(--text-3); }
    .header-actions { display: flex; gap: 10px; align-items: center; }

    .btn-primary {
      display: flex; align-items: center; gap: 6px; padding: 0 16px; height: 36px;
      border-radius: 8px; border: none; cursor: pointer; background: #7C3AED; color: #fff;
      font-size: 13px; font-weight: 500;
      &:hover:not(:disabled) { background: #6D28D9; }
      &:disabled { opacity: .6; cursor: not-allowed; }
    }
    .btn-outline {
      display: flex; align-items: center; gap: 6px; padding: 0 16px; height: 36px;
      border-radius: 8px; cursor: pointer; background: #fff; border: 1px solid var(--border);
      color: var(--text-2); font-size: 13px;
      &:hover:not(:disabled) { background: #F3F4F6; }
      &:disabled { opacity: .6; cursor: not-allowed; }
    }

    /* ── Health Grid ── */
    .health-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 12px; margin-bottom: 28px; }
    .health-card {
      display: flex; align-items: flex-start; gap: 12px; padding: 16px;
      background: #fff; border: 1px solid var(--border); border-radius: 12px;
      border-left: 3px solid #E5E7EB;
      &.warn { border-left-color: #F59E0B; background: #FFFBEB; }
    }
    .health-icon {
      width: 36px; height: 36px; border-radius: 9px; background: #F3F0FF;
      display: flex; align-items: center; justify-content: center; flex-shrink: 0;
      i { font-size: 18px; color: #7C3AED; }
    }
    .health-body { flex: 1; min-width: 0; }
    .health-val   { font-size: 22px; font-weight: 700; color: var(--text-1); line-height: 1.1; }
    .health-label { font-size: 12px; font-weight: 600; color: var(--text-2); margin-top: 2px; }
    .health-sub   { font-size: 11px; color: var(--text-4); margin-top: 3px; }
    .health-status {
      font-size: 10px; font-weight: 700; padding: 2px 8px; border-radius: 20px; white-space: nowrap;
      align-self: flex-start; text-transform: uppercase; letter-spacing: .04em;
      &.ok   { background: #D1FAE5; color: #065F46; }
      &.warn { background: #FEF3C7; color: #92400E; }
      &.bad  { background: #FEE2E2; color: #991B1B; }
    }

    /* ── Section labels ── */
    .section-label {
      display: flex; align-items: center; gap: 6px; margin: 0 0 12px;
      font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: .06em; color: var(--text-3);
    }
    .ai-badge {
      margin-left: auto; font-size: 10px; font-weight: 600; color: #7C3AED;
      background: #F3F0FF; border: 1px solid #DDD6FE; border-radius: 20px;
      padding: 2px 8px; text-transform: none; letter-spacing: 0;
      display: flex; align-items: center; gap: 4px;
    }
    .alert-counts { display: flex; gap: 6px; margin-left: auto; }
    .count-chip {
      font-size: 10px; font-weight: 600; padding: 2px 8px; border-radius: 20px; text-transform: none; letter-spacing: 0;
      &.high   { background: #FEE2E2; color: #991B1B; }
      &.medium { background: #FEF3C7; color: #92400E; }
      &.low    { background: #DBEAFE; color: #1E40AF; }
    }
    .type-label {
      display: flex; align-items: center; gap: 6px; margin: 16px 0 8px;
      font-size: 11px; font-weight: 600; color: var(--text-3);
    }

    /* ── Insight Cards ── */
    .cards { display: flex; flex-direction: column; gap: 8px; }
    .insight-card {
      display: flex; align-items: flex-start; gap: 12px; padding: 14px 16px;
      border-radius: 10px; background: #fff; border: 1px solid var(--border);
      transition: box-shadow .15s;
      &:hover { box-shadow: 0 2px 8px rgba(0,0,0,.07); }
      &[data-severity="high"]   { border-left: 3px solid #DC2626; }
      &[data-severity="medium"] { border-left: 3px solid #D97706; }
      &[data-severity="low"]    { border-left: 3px solid #2563EB; }
    }
    .card-left { display: flex; align-items: center; gap: 8px; padding-top: 2px; }
    .sev-dot {
      width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0;
      &[data-severity="high"]   { background: #DC2626; box-shadow: 0 0 0 3px #FEE2E2; }
      &[data-severity="medium"] { background: #D97706; box-shadow: 0 0 0 3px #FEF3C7; }
      &[data-severity="low"]    { background: #2563EB; box-shadow: 0 0 0 3px #DBEAFE; }
    }
    .type-icon { font-size: 18px; }
    .card-body { flex: 1; min-width: 0; }
    .card-message { font-size: 14px; color: var(--text-1); line-height: 1.45; }
    .card-detail { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; }
    .detail-chip {
      font-size: 11px; color: var(--text-3); background: #F9FAFB;
      border: 1px solid var(--border); border-radius: 5px; padding: 2px 8px;
      strong { color: var(--text-1); }
      &.drop strong { color: #DC2626; }
    }
    .card-meta {
      display: flex; align-items: center; gap: 6px; margin-top: 8px;
      font-size: 11px; color: var(--text-4);
    }
    .meta-sep { opacity: .4; }
    .sev-badge {
      font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: .05em;
      padding: 1px 6px; border-radius: 4px;
      &[data-severity="high"]   { background: #FEE2E2; color: #991B1B; }
      &[data-severity="medium"] { background: #FEF3C7; color: #92400E; }
      &[data-severity="low"]    { background: #DBEAFE; color: #1E40AF; }
    }
    .dismiss-btn {
      flex-shrink: 0; border: none; background: transparent; cursor: pointer;
      padding: 4px 6px; border-radius: 6px; color: var(--text-4);
      &:hover { background: var(--bg); color: var(--text-2); }
    }

    .empty-state {
      text-align: center; padding: 40px 20px; color: var(--text-3);
      h3 { font-size: 16px; color: var(--text-1); margin: 12px 0 6px; }
      p  { font-size: 13px; max-width: 380px; margin: 0 auto; line-height: 1.6; }
    }
    .empty-icon { font-size: 42px; color: #7C3AED; }

    .spin { animation: spin .8s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }

    /* ── AI Usage section ── */
    .usage-cards {
      display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
      gap: 12px; margin-bottom: 12px;
    }
    .usage-kpi {
      background: #fff; border: 1px solid var(--border); border-radius: 10px; padding: 14px 16px;
    }
    .ukpi-label { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: .05em; color: var(--text-4); margin-bottom: 6px; }
    .ukpi-val   { font-size: 20px; font-weight: 800; color: var(--text-1); }
    .ukpi-val.cost { color: #7C3AED; }
    .ukpi-sub   { font-size: 10px; color: var(--text-4); margin-top: 2px; }
    .cost { color: #7C3AED; font-weight: 600; }
    .usage-features {
      background: #fff; border: 1px solid var(--border); border-radius: 10px;
      overflow: hidden; margin-bottom: 24px;
    }
    .ufeat-row {
      display: flex; align-items: center; gap: 10px; padding: 10px 16px;
      border-bottom: 1px solid var(--border); font-size: 13px;
      &:last-child { border-bottom: none; }
    }
    .ufeat-name  { flex: 1; color: var(--text-1); font-weight: 500; }
    .ufeat-calls { font-size: 11px; color: var(--text-4); min-width: 60px; }
    .ufeat-cost  { font-size: 13px; font-weight: 700; min-width: 80px; text-align: right; }
  `],
})
export class AiInsightsComponent implements OnInit {
  private api = inject(ApiService);

  insights   = signal<AiInsight[]>([]);
  health     = signal<SchoolHealth | null>(null);
  usageData  = signal<any>(null);
  loading    = signal(true);
  running    = signal(false);
  clearing   = signal(false);

  highCount   = computed(() => this.insights().filter(i => i.severity === 'high').length);
  mediumCount = computed(() => this.insights().filter(i => i.severity === 'medium').length);
  lowCount    = computed(() => this.insights().filter(i => i.severity === 'low').length);

  attendanceInsights = computed(() =>
    this.insights().filter(i => ['attendance_drop', 'chronic_absenteeism'].includes(i.type))
  );
  feeInsights   = computed(() => this.insights().filter(i => i.type === 'fee_default_risk'));
  otherInsights = computed(() =>
    this.insights().filter(i => !['attendance_drop', 'chronic_absenteeism', 'fee_default_risk'].includes(i.type))
  );

  ngOnInit() {
    this.load();
    this.loadHealth();
    this.loadUsage();
  }

  private load() {
    this.loading.set(true);
    this.api.get<any>('/ai/insights').subscribe({
      next: (r: any) => { this.insights.set(r.data ?? []); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  private loadUsage() {
    this.api.get<any>('/ai/usage').subscribe({
      next: (r: any) => this.usageData.set(r.data),
      error: () => {},
    });
  }

  private loadHealth() {
    this.api.get<any>('/analytics/dashboard').subscribe({
      next: (r: any) => {
        const d   = r.data;
        const fees = d?.fees ?? {};
        const att  = d?.attendance ?? {};
        this.health.set({
          attendance_today_rate:  att.today?.rate_pct ?? 0,
          attendance_monthly_avg: att.monthly_avg ?? 0,
          students_at_risk:       fees.defaulters_count ?? 0,
          fee_collection_rate:    fees.current_month?.collection_pct ?? 0,
          overdue_invoices:       (fees.by_status?.overdue ?? 0) + (fees.by_status?.pending ?? 0),
          overdue_amount:         fees.current_month?.outstanding ?? 0,
          active_students:        d?.students?.active ?? 0,
          total_staff:            d?.staff?.active ?? 0,
        });
      },
      error: () => {},
    });
  }

  resolve(id: string) {
    this.api.patch<any>(`/ai/insights/${id}/resolve`, {}).subscribe({
      next: () => this.insights.update(list => list.filter(i => i.id !== id)),
      error: () => {},
    });
  }

  clearAll() {
    this.clearing.set(true);
    this.api.post<any>('/ai/insights/resolve-all', {}).subscribe({
      next: () => { this.insights.set([]); this.clearing.set(false); },
      error: () => this.clearing.set(false),
    });
  }

  runNow() {
    this.running.set(true);
    this.api.post<any>('/ai/insights/run', {}).subscribe({
      next: () => { this.running.set(false); this.load(); },
      error: () => this.running.set(false),
    });
  }

  typeIcon(type: string): string {
    const map: Record<string, string> = {
      attendance_drop:     'ti-trending-down',
      chronic_absenteeism: 'ti-user-exclamation',
      fee_default_risk:    'ti-coin-off',
      uncovered_class:     'ti-school',
    };
    return map[type] ?? 'ti-alert-triangle';
  }

  typeColor(type: string): string {
    if (type === 'fee_default_risk') return '#DC2626';
    if (['attendance_drop', 'chronic_absenteeism'].includes(type)) return '#2563EB';
    return '#D97706';
  }

  typeLabel(type: string): string {
    const map: Record<string, string> = {
      attendance_drop:     'Attendance Drop',
      chronic_absenteeism: 'Chronic Absenteeism',
      fee_default_risk:    'Fee Default Risk',
      uncovered_class:     'Uncovered Class',
    };
    return map[type] ?? type;
  }

  featureLabel(f: string): string {
    const map: Record<string, string> = {
      remark_assist: 'Remark Assist (Journal)',
      insights:      'AI Insights',
    };
    return map[f] ?? f;
  }
}
