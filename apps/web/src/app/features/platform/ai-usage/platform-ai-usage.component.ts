import { Component, inject, signal, OnInit } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { DecimalPipe, DatePipe } from '@angular/common';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { environment } from '../../../../environments/environment';
import { PlatformAuthService } from '../../../core/services/platform-auth.service';

@Component({
  selector: 'app-platform-ai-usage',
  standalone: true,
  imports: [DecimalPipe, DatePipe, MatProgressSpinnerModule],
  template: `
    <div class="pg">
      <div class="pg-header">
        <div>
          <h1 class="pg-title">AI Usage</h1>
          <p class="pg-sub">Anthropic API consumption across all schools</p>
        </div>
      </div>

      @if (loading()) {
        <div class="spinner-wrap"><mat-spinner diameter="36"/></div>
      } @else if (data()) {

        <!-- KPI row -->
        <div class="kpi-row">
          <div class="kpi-card">
            <div class="kpi-label">Total Cost</div>
            <div class="kpi-value cost">\${{ data()!.total_cost_usd | number:'1.4-4' }}</div>
            <div class="kpi-sub">all time</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-label">Total Calls</div>
            <div class="kpi-value">{{ data()!.total_calls | number }}</div>
            <div class="kpi-sub">API requests</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-label">Input Tokens</div>
            <div class="kpi-value">{{ data()!.total_input_tokens | number }}</div>
            <div class="kpi-sub">all time</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-label">Output Tokens</div>
            <div class="kpi-value">{{ data()!.total_output_tokens | number }}</div>
            <div class="kpi-sub">all time</div>
          </div>
        </div>

        <div class="two-col">

          <!-- By school -->
          <div class="card">
            <div class="card-title">Usage by School</div>
            @if (!data()!.by_school.length) {
              <div class="empty-row">No usage recorded yet</div>
            } @else {
              <table class="usage-table">
                <thead><tr><th>School</th><th>Calls</th><th class="right">Cost (USD)</th></tr></thead>
                <tbody>
                  @for (row of data()!.by_school; track row.schema) {
                    <tr>
                      <td class="schema-cell">{{ row.schema }}</td>
                      <td>{{ row.calls | number }}</td>
                      <td class="right cost">\${{ row.cost_usd | number:'1.4-4' }}</td>
                    </tr>
                  }
                </tbody>
              </table>
            }
          </div>

          <!-- By feature -->
          <div class="card">
            <div class="card-title">Usage by Feature</div>
            @if (!data()!.by_feature.length) {
              <div class="empty-row">No usage recorded yet</div>
            } @else {
              @for (row of data()!.by_feature; track row.feature) {
                <div class="feature-row">
                  <div class="feature-info">
                    <div class="feature-name">{{ featureLabel(row.feature) }}</div>
                    <div class="feature-calls">{{ row.calls }} calls</div>
                  </div>
                  <div class="feature-right">
                    <div class="feature-cost cost">\${{ row.cost_usd | number:'1.4-4' }}</div>
                    <div class="feature-bar-wrap">
                      <div class="feature-bar"
                           [style.width.%]="barPct(row.cost_usd)"></div>
                    </div>
                  </div>
                </div>
              }
            }
          </div>
        </div>

        <!-- Daily trend (last 30 days) -->
        <div class="card mt">
          <div class="card-title">Daily Cost — Last 30 Days</div>
          @if (!data()!.daily.length) {
            <div class="empty-row">No usage in the last 30 days</div>
          } @else {
            <div class="daily-chart">
              @for (day of data()!.daily; track day.date) {
                <div class="day-col" [title]="day.date + ' — $' + day.cost_usd">
                  <div class="bar-track">
                    <div class="day-bar" [style.height.px]="dayBarPx(day.cost_usd)"></div>
                  </div>
                  <div class="day-label">{{ day.date | date:'d' }}</div>
                </div>
              }
            </div>
          }
        </div>

      }
    </div>
  `,
  styles: [`
    .pg { padding: 28px 32px; max-width: 1100px; }
    .pg-header { margin-bottom: 24px; }
    .pg-title { font-size: 22px; font-weight: 700; color: #0F172A; margin: 0 0 4px; }
    .pg-sub   { font-size: 13px; color: #64748B; margin: 0; }
    .spinner-wrap { display:flex; justify-content:center; padding:80px; }

    /* KPI */
    .kpi-row { display: grid; grid-template-columns: repeat(4,1fr); gap: 16px; margin-bottom: 20px; }
    .kpi-card {
      background:#fff; border:1px solid #E2E8F0; border-radius:12px; padding:20px;
    }
    .kpi-label { font-size:11px; font-weight:600; text-transform:uppercase; letter-spacing:.05em; color:#64748B; margin-bottom:8px; }
    .kpi-value { font-size:26px; font-weight:800; color:#0F172A; }
    .kpi-value.cost { color:#7C3AED; }
    .kpi-sub   { font-size:11px; color:#94A3B8; margin-top:4px; }

    /* Two-col */
    .two-col { display:grid; grid-template-columns:1fr 1fr; gap:16px; margin-bottom:16px; }

    /* Card */
    .card { background:#fff; border:1px solid #E2E8F0; border-radius:12px; padding:20px; }
    .card.mt { margin-top:0; }
    .card-title { font-size:13px; font-weight:700; color:#0F172A; margin-bottom:16px; }
    .empty-row { font-size:13px; color:#94A3B8; text-align:center; padding:24px 0; }

    /* Table */
    .usage-table { width:100%; border-collapse:collapse; font-size:13px; }
    .usage-table th { text-align:left; font-size:11px; font-weight:600; text-transform:uppercase; letter-spacing:.04em; color:#64748B; border-bottom:1px solid #F1F5F9; padding:6px 8px; }
    .usage-table td { padding:10px 8px; border-bottom:1px solid #F8FAFC; color:#334155; }
    .usage-table tr:last-child td { border-bottom:none; }
    .right { text-align:right; }
    .cost  { color:#7C3AED; font-weight:600; }
    .schema-cell { font-family:monospace; font-size:12px; color:#475569; }

    /* Feature rows */
    .feature-row { display:flex; justify-content:space-between; align-items:flex-start; padding:10px 0; border-bottom:1px solid #F8FAFC; }
    .feature-row:last-child { border-bottom:none; }
    .feature-name  { font-size:13px; font-weight:500; color:#334155; }
    .feature-calls { font-size:11px; color:#94A3B8; margin-top:2px; }
    .feature-right { text-align:right; min-width:120px; }
    .feature-cost  { font-size:13px; font-weight:700; margin-bottom:4px; }
    .feature-bar-wrap { background:#F1F5F9; border-radius:4px; height:4px; }
    .feature-bar { background:#7C3AED; border-radius:4px; height:4px; transition:width .3s; }

    /* Daily chart */
    .daily-chart { display:flex; align-items:flex-end; gap:3px; }
    .day-col { flex:1; min-width:0; max-width:32px; display:flex; flex-direction:column; align-items:center; }
    .bar-track { width:100%; height:80px; display:flex; align-items:flex-end; }
    .day-bar { width:100%; background:#7C3AED; border-radius:3px 3px 0 0; min-height:2px; transition:height .3s; }
    .day-label { font-size:9px; color:#94A3B8; margin-top:4px; line-height:1; }
  `],
})
export class PlatformAiUsageComponent implements OnInit {
  private http = inject(HttpClient);
  private auth = inject(PlatformAuthService);

  loading = signal(true);
  data    = signal<any>(null);

  private get headers() {
    const token = this.auth.token();
    return new HttpHeaders({ Authorization: `Bearer ${token}` });
  }

  ngOnInit() {
    this.http.get<any>(`${environment.apiUrl}/platform/ai-usage`, { headers: this.headers })
      .subscribe({
        next: (res) => { this.data.set(res.data); this.loading.set(false); },
        error: () => this.loading.set(false),
      });
  }

  featureLabel(f: string): string {
    const map: Record<string, string> = {
      remark_assist: 'Remark Assist (Journal)',
      insights:      'AI Insights',
    };
    return map[f] ?? f;
  }

  barPct(cost: number): number {
    const max = Math.max(...(this.data()?.by_feature ?? []).map((r: any) => r.cost_usd), 0.0001);
    return Math.round((cost / max) * 100);
  }

  dayBarPx(cost: number): number {
    const max = Math.max(...(this.data()?.daily ?? []).map((r: any) => r.cost_usd), 0.0001);
    return Math.max(Math.round((cost / max) * 80), 2);
  }
}
