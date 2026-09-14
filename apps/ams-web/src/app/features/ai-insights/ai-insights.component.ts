import { Component, inject, signal, OnInit } from '@angular/core';
import { DecimalPipe, DatePipe } from '@angular/common';
import { ApiService } from '../../core/services/api.service';

const USD_TO_INR = 85;

interface UsageData {
  total_calls: number;
  total_input_tokens: number;
  total_output_tokens: number;
  total_cost_usd: number;
  by_feature: { feature: string; calls: number; cost_usd: number }[];
  daily: { date: string; calls: number; cost_usd: number }[];
}

@Component({
  selector: 'ams-ai-insights',
  standalone: true,
  imports: [DecimalPipe, DatePipe],
  template: `
    <div class="page-header">
      <div>
        <h1>AI Insights</h1>
        <div class="subtitle">Claude API usage for your school</div>
      </div>
      <div class="rate-note">1 USD = ₹{{ usdToInr }}</div>
    </div>

    @if (loading()) {
      <div class="empty-state"><div class="spinner"></div><span>Loading…</span></div>
    } @else if (data()) {

      <!-- KPI row -->
      <div class="kpi-row">
        <div class="kpi-card">
          <div class="kpi-label">Total Cost</div>
          <div class="kpi-value cost">₹{{ toInr(data()!.total_cost_usd) | number:'1.2-2' }}</div>
          <div class="kpi-sub">\${{ data()!.total_cost_usd | number:'1.4-4' }} USD · all time</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label">Total Calls</div>
          <div class="kpi-value">{{ data()!.total_calls | number }}</div>
          <div class="kpi-sub">AI generations</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label">Input Tokens</div>
          <div class="kpi-value">{{ data()!.total_input_tokens | number }}</div>
          <div class="kpi-sub">prompt tokens</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label">Output Tokens</div>
          <div class="kpi-value">{{ data()!.total_output_tokens | number }}</div>
          <div class="kpi-sub">generated tokens</div>
        </div>
      </div>

      <div class="two-col">

        <!-- By feature -->
        <div class="card">
          <div class="card-title">Usage by Feature</div>
          @if (!data()!.by_feature.length) {
            <div class="empty-row">No AI usage recorded yet</div>
          } @else {
            @for (row of data()!.by_feature; track row.feature) {
              <div class="feature-row">
                <div class="feature-info">
                  <div class="feature-name">{{ featureLabel(row.feature) }}</div>
                  <div class="feature-calls">{{ row.calls }} calls</div>
                </div>
                <div class="feature-right">
                  <div class="feature-cost">₹{{ toInr(row.cost_usd) | number:'1.2-2' }}</div>
                  <div class="feature-bar-wrap">
                    <div class="feature-bar" [style.width.%]="barPct(row.cost_usd)"></div>
                  </div>
                </div>
              </div>
            }
          }
        </div>

        <!-- Cost per call estimate -->
        <div class="card">
          <div class="card-title">Cost Summary</div>
          @if (!data()!.total_calls) {
            <div class="empty-row">No usage yet</div>
          } @else {
            <div class="summary-row">
              <span class="summary-label">Avg cost per generation</span>
              <span class="summary-val">₹{{ avgCostInr() | number:'1.2-2' }}</span>
            </div>
            <div class="summary-row">
              <span class="summary-label">Total cost (INR)</span>
              <span class="summary-val cost">₹{{ toInr(data()!.total_cost_usd) | number:'1.2-2' }}</span>
            </div>
            <div class="summary-row">
              <span class="summary-label">Total cost (USD)</span>
              <span class="summary-val">\${{ data()!.total_cost_usd | number:'1.4-4' }}</span>
            </div>
            <div class="summary-row">
              <span class="summary-label">Total tokens used</span>
              <span class="summary-val">{{ (data()!.total_input_tokens + data()!.total_output_tokens) | number }}</span>
            </div>

            <div class="divider"></div>
            <div class="card-title" style="margin-top:0">This Month</div>
            <div class="summary-row">
              <span class="summary-label">Calls (last 30 days)</span>
              <span class="summary-val">{{ monthCalls() | number }}</span>
            </div>
            <div class="summary-row">
              <span class="summary-label">Cost (last 30 days)</span>
              <span class="summary-val cost">₹{{ toInr(monthCostUsd()) | number:'1.2-2' }}</span>
            </div>
          }
        </div>
      </div>

      <!-- Daily chart -->
      <div class="card mt">
        <div class="card-title">Daily Cost — Last 30 Days (INR)</div>
        @if (!data()!.daily.length || !monthCostUsd()) {
          <div class="empty-row">No usage in the last 30 days</div>
        } @else {
          <div class="daily-chart">
            @for (day of data()!.daily; track day.date) {
              <div class="day-col" [title]="day.date + ' — ₹' + toInr(day.cost_usd).toFixed(2)">
                <div class="bar-track">
                  <div class="day-bar" [style.height.px]="dayBarPx(day.cost_usd)"></div>
                </div>
                <div class="day-label">{{ day.date | date:'d' }}</div>
              </div>
            }
          </div>
        }
      </div>

    } @else {
      <div class="empty-state"><span>Failed to load usage data</span></div>
    }
  `,
  styles: [`
    .page-header { display:flex; align-items:flex-start; justify-content:space-between; margin-bottom:24px; }
    h1 { font-size:20px; font-weight:700; color:#0F172A; margin:0 0 4px; }
    .subtitle { font-size:13px; color:#64748B; margin:0; }
    .rate-note { font-size:11px; color:#94A3B8; padding:4px 10px; background:#F8FAFC; border:1px solid #E2E8F0; border-radius:8px; align-self:center; }

    .empty-state { display:flex; flex-direction:column; align-items:center; justify-content:center; gap:10px; padding:56px 24px; color:#94A3B8; font-size:13px; }
    .spinner { width:24px; height:24px; border:2px solid #E2E8F0; border-top-color:#7C3AED; border-radius:50%; animation:spin .7s linear infinite; }
    @keyframes spin { to { transform:rotate(360deg); } }

    .kpi-row { display:grid; grid-template-columns:repeat(4,1fr); gap:16px; margin-bottom:20px; }
    .kpi-card { background:#fff; border:1px solid #E2E8F0; border-radius:12px; padding:20px; }
    .kpi-label { font-size:11px; font-weight:600; text-transform:uppercase; letter-spacing:.05em; color:#64748B; margin-bottom:8px; }
    .kpi-value { font-size:24px; font-weight:800; color:#0F172A; }
    .kpi-value.cost { color:#7C3AED; }
    .kpi-sub { font-size:11px; color:#94A3B8; margin-top:4px; }

    .two-col { display:grid; grid-template-columns:1fr 1fr; gap:16px; margin-bottom:16px; }
    .card { background:#fff; border:1px solid #E2E8F0; border-radius:12px; padding:20px; }
    .card.mt { }
    .card-title { font-size:13px; font-weight:700; color:#0F172A; margin-bottom:16px; }
    .empty-row { font-size:13px; color:#94A3B8; text-align:center; padding:24px 0; }

    .feature-row { display:flex; justify-content:space-between; align-items:flex-start; padding:10px 0; border-bottom:1px solid #F8FAFC; }
    .feature-row:last-child { border-bottom:none; }
    .feature-name { font-size:13px; font-weight:500; color:#334155; }
    .feature-calls { font-size:11px; color:#94A3B8; margin-top:2px; }
    .feature-right { text-align:right; min-width:100px; }
    .feature-cost { font-size:13px; font-weight:700; color:#7C3AED; margin-bottom:4px; }
    .feature-bar-wrap { background:#F1F5F9; border-radius:4px; height:4px; }
    .feature-bar { background:#7C3AED; border-radius:4px; height:4px; transition:width .3s; }

    .summary-row { display:flex; justify-content:space-between; align-items:center; padding:8px 0; border-bottom:1px solid #F8FAFC; }
    .summary-row:last-child { border-bottom:none; }
    .summary-label { font-size:12px; color:#64748B; }
    .summary-val { font-size:13px; font-weight:600; color:#0F172A; }
    .summary-val.cost { color:#7C3AED; }
    .divider { border-top:1px solid #E2E8F0; margin:12px 0; }

    .daily-chart { display:flex; align-items:flex-end; gap:3px; }
    .day-col { flex:1; min-width:0; max-width:32px; display:flex; flex-direction:column; align-items:center; }
    .bar-track { width:100%; height:80px; display:flex; align-items:flex-end; }
    .day-bar { width:100%; background:#7C3AED; border-radius:3px 3px 0 0; min-height:2px; transition:height .3s; }
    .day-label { font-size:9px; color:#94A3B8; margin-top:4px; }
  `],
})
export class AiInsightsComponent implements OnInit {
  private api = inject(ApiService);

  readonly usdToInr = USD_TO_INR;
  loading = signal(true);
  data    = signal<UsageData | null>(null);

  ngOnInit() {
    this.api.get<{ data: UsageData }>('/ai-usage').subscribe({
      next: res => { this.data.set(res.data); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  toInr(usd: number): number { return usd * USD_TO_INR; }

  avgCostInr(): number {
    const d = this.data();
    if (!d || !d.total_calls) return 0;
    return this.toInr(d.total_cost_usd / d.total_calls);
  }

  monthCalls(): number {
    return this.data()?.daily.reduce((s, d) => s + d.calls, 0) ?? 0;
  }

  monthCostUsd(): number {
    return this.data()?.daily.reduce((s, d) => s + d.cost_usd, 0) ?? 0;
  }

  barPct(cost: number): number {
    const max = Math.max(...(this.data()?.by_feature ?? []).map(r => r.cost_usd), 0.0001);
    return Math.round((cost / max) * 100);
  }

  dayBarPx(cost: number): number {
    const max = Math.max(...(this.data()?.daily ?? []).map(d => d.cost_usd), 0.0001);
    return Math.max(Math.round((cost / max) * 80), 2);
  }

  featureLabel(f: string): string {
    const map: Record<string, string> = {
      ams_worksheet_generate:      'Worksheet Generator',
      ams_lesson_plan_generate:    'Lesson Plan Generator',
      ams_question_paper_generate: 'Question Paper Generator',
    };
    return map[f] ?? f;
  }
}
