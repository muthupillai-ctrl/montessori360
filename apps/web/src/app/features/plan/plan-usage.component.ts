import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { ApiService } from '../../core/services/api.service';

// The school's own plan: what it includes, status/dates and usage vs limits.
// Owners and principals only; prices are not shown here (they're in the quotation).

interface Warning { code: string; severity: 'info' | 'warning' | 'critical'; message: string; }
interface Summary {
  plan: {
    name: string; display_name: string | null; description: string | null;
    billing_period: 'monthly' | 'yearly';
    max_students: number | null; max_staff: number | null;
    includes_sis: boolean; includes_ams: boolean;
    ai_monthly_generations: number | null; sms_monthly: number | null;
    features: Record<string, boolean>;
  } | null;
  subscription: {
    plan_status: 'trial' | 'active' | 'overdue' | 'cancelled';
    plan_started_on: string | null; renews_on: string | null; trial_ends_on: string | null;
  };
  usage: { students: number; staff: number; ai_generations_month: number };
  warnings: Warning[];
}

interface Meter { label: string; used: number; max: number | null; hint?: string; }

const STATUS_LABEL: Record<string, string> = {
  trial: 'Trial', active: 'Active', overdue: 'Payment overdue', cancelled: 'Cancelled',
};

@Component({
  selector: 'app-plan-usage',
  standalone: true,
  imports: [DatePipe, DecimalPipe],
  template: `
<div class="pg">
  <div class="pg-header">
    <div>
      <h1 class="pg-title">Plan &amp; usage</h1>
      <p class="pg-sub">Your school's Taji subscription and how much of it you're using.</p>
    </div>
  </div>

  @if (loading()) {
    <div class="card muted">Loading…</div>
  } @else if (error()) {
    <div class="card err">{{ error() }}</div>
  } @else if (data(); as d) {

    @for (w of alerts(); track w.code) {
      <div class="alert" [class.critical]="w.severity === 'critical'">
        <i class="ti ti-alert-triangle" aria-hidden="true"></i> {{ w.message }}
      </div>
    }

    <div class="card plan">
      <div class="plan-top">
        <div>
          <div class="eyebrow">Current plan</div>
          <div class="plan-name">{{ d.plan ? (d.plan.display_name ?? d.plan.name) : 'No plan assigned' }}</div>
          @if (d.plan?.description) { <div class="plan-desc">{{ d.plan?.description }}</div> }
        </div>
        <span class="status" [class]="'status ' + d.subscription.plan_status">{{ statusLabel(d.subscription.plan_status) }}</span>
      </div>

      <div class="dates">
        @if (d.subscription.plan_status === 'trial' && d.subscription.trial_ends_on) {
          <div><span>Trial ends</span><b>{{ d.subscription.trial_ends_on | date:'d MMM y' }}</b></div>
        }
        @if (d.subscription.plan_started_on) {
          <div><span>Started</span><b>{{ d.subscription.plan_started_on | date:'d MMM y' }}</b></div>
        }
        @if (d.subscription.renews_on) {
          <div><span>Renews</span><b>{{ d.subscription.renews_on | date:'d MMM y' }}</b></div>
        }
        @if (d.plan) {
          <div><span>Billing</span><b>{{ d.plan.billing_period === 'monthly' ? 'Monthly' : 'Yearly' }}</b></div>
        }
      </div>
    </div>

    @if (d.plan) {
      <div class="grid">
        <div class="card">
          <div class="card-title">Usage</div>
          @for (m of meters(); track m.label) {
            <div class="meter">
              <div class="m-row">
                <span>{{ m.label }}</span>
                <span class="m-val" [class.over]="isOver(m)">
                  {{ m.used | number }}{{ m.max != null ? ' of ' + (m.max | number) : '' }}
                  @if (m.max == null) { <em>unlimited</em> }
                </span>
              </div>
              @if (m.max != null) {
                <div class="bar"><i [style.width.%]="pct(m)" [class.warn]="pct(m) >= 90" [class.over]="isOver(m)"></i></div>
              }
              @if (m.hint) { <div class="m-hint">{{ m.hint }}</div> }
            </div>
          }
        </div>

        <div class="card">
          <div class="card-title">Included in your plan</div>
          <ul class="incl">
            @for (i of included(); track i.label) {
              <li [class.off]="!i.on"><i class="ti" [class.ti-check]="i.on" [class.ti-minus]="!i.on" aria-hidden="true"></i>{{ i.label }}</li>
            }
          </ul>
        </div>
      </div>
    }

    <div class="card contact">
      <div>
        <div class="card-title">Need more?</div>
        <p>To upgrade, add Taji AMS, raise your limits or renew, contact the Taji team.</p>
      </div>
      <a class="btn-primary" href="mailto:hello@ahamsys.com?subject=Taji%20plan%20enquiry">
        <i class="ti ti-mail" aria-hidden="true"></i> hello&#64;ahamsys.com
      </a>
    </div>
  }
</div>
  `,
  styles: [`
    .pg { padding: 28px 32px; max-width: 960px; }
    .pg-header { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 20px; }
    .pg-title { font-size: 22px; font-weight: 700; color: #0F172A; margin: 0 0 4px; }
    .pg-sub   { font-size: 13px; color: #64748B; margin: 0; }

    .card { background: #fff; border: 1px solid #E2E8F0; border-radius: 12px; padding: 20px 22px; margin-bottom: 16px; }
    .card.muted { color: #64748B; font-size: 13px; }
    .card.err { color: #B91C1C; background: #FEF2F2; border-color: #FECACA; font-size: 13px; }
    .card-title { font-size: 13px; font-weight: 700; color: #0F172A; margin-bottom: 12px; }
    .eyebrow { font-size: 11px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; color: #64748B; }

    .alert { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; padding: 10px 14px; border-radius: 10px;
      background: #FFFBEB; border: 1px solid #FDE68A; color: #92400E; font-size: 13px;
      &.critical { background: #FEF2F2; border-color: #FECACA; color: #B91C1C; } }

    .plan-top { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; }
    .plan-name { font-size: 22px; font-weight: 800; color: #0F172A; margin-top: 2px; }
    .plan-desc { font-size: 13px; color: #475569; margin-top: 4px; max-width: 60ch; }
    .status { flex: none; font-size: 11px; font-weight: 700; padding: 4px 12px; border-radius: 20px; background: #E2E8F0; color: #475569;
      &.active { background: #D1FAE5; color: #065F46; } &.trial { background: #DBEAFE; color: #1D4ED8; }
      &.overdue { background: #FEF3C7; color: #92400E; } &.cancelled { background: #FEE2E2; color: #991B1B; } }
    .dates { display: flex; flex-wrap: wrap; gap: 10px 32px; margin-top: 18px; padding-top: 14px; border-top: 1px solid #F1F5F9; }
    .dates div { display: flex; flex-direction: column; gap: 2px; }
    .dates span { font-size: 11px; color: #64748B; text-transform: uppercase; letter-spacing: .05em; font-weight: 600; }
    .dates b { font-size: 14px; color: #0F172A; }

    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
    .grid .card { margin-bottom: 0; }
    .meter { margin-bottom: 14px; &:last-child { margin-bottom: 0; } }
    .m-row { display: flex; justify-content: space-between; font-size: 13px; color: #334155; }
    .m-val { font-weight: 600; color: #0F172A; em { font-style: normal; font-weight: 400; color: #64748B; margin-left: 4px; }
      &.over { color: #B91C1C; } }
    .bar { height: 8px; background: #F1F5F9; border-radius: 999px; overflow: hidden; margin-top: 6px;
      i { display: block; height: 100%; background: #3B82F6; border-radius: 999px; }
      i.warn { background: #F59E0B; } i.over { background: #DC2626; } }
    .m-hint { font-size: 11px; color: #94A3B8; margin-top: 4px; }

    .incl { list-style: none; margin: 0; padding: 0; display: grid; gap: 7px; font-size: 13px; color: #1E293B; }
    .incl li { display: flex; align-items: center; gap: 8px; }
    .incl .ti-check { color: #059669; font-size: 16px; }
    .incl li.off { color: #94A3B8; .ti-minus { font-size: 16px; } }

    .contact { display: flex; justify-content: space-between; align-items: center; gap: 16px; margin-top: 16px;
      .card-title { margin-bottom: 4px; } p { margin: 0; font-size: 13px; color: #475569; } }
    .btn-primary { display: inline-flex; align-items: center; gap: 6px; background: #3B82F6; color: #fff; border-radius: 8px;
      padding: 9px 16px; font-size: 13px; font-weight: 600; text-decoration: none; white-space: nowrap;
      &:hover { background: #2563EB; } }

    @media (max-width: 760px) {
      .pg { padding: 20px 16px; }
      .grid { grid-template-columns: 1fr; }
      .contact { flex-direction: column; align-items: flex-start; }
    }
  `],
})
export class PlanUsageComponent implements OnInit {
  private api = inject(ApiService);

  data    = signal<Summary | null>(null);
  loading = signal(true);
  error   = signal('');

  // Info-level items (e.g. "renews in 20 days") are shown as dates, not alerts
  alerts = computed(() => (this.data()?.warnings ?? []).filter(w => w.severity !== 'info'));

  meters = computed<Meter[]>(() => {
    const d = this.data();
    if (!d?.plan) return [];
    return [
      { label: 'Active students', used: d.usage.students, max: d.plan.max_students },
      { label: 'Active staff', used: d.usage.staff, max: d.plan.max_staff },
      { label: 'AI generations this month', used: d.usage.ai_generations_month, max: d.plan.ai_monthly_generations,
        hint: 'Worksheets, lesson plans, question papers and journal notes. Resets on the 1st.' },
    ];
  });

  included = computed(() => {
    const p = this.data()?.plan;
    if (!p) return [];
    const f = (k: string) => p.includes_sis && p.features?.[k] !== false;
    return [
      { label: 'Students, attendance & fees', on: p.includes_sis },
      { label: 'Parent portal, journal & messaging', on: p.includes_sis },
      { label: 'Staff, leave & payroll', on: f('staff_payroll') },
      { label: 'Transport', on: f('transport') },
      { label: 'Timetable', on: f('timetable') },
      { label: 'AI insights', on: f('ai_insights') },
      { label: 'Taji AMS: curriculum & child progress', on: p.includes_ams },
      { label: 'Taji AMS: AI worksheets, lesson plans & papers', on: p.includes_ams },
      { label: p.sms_monthly ? `${p.sms_monthly.toLocaleString('en-IN')} SMS a month` : 'SMS', on: !!p.sms_monthly },
    ];
  });

  ngOnInit() {
    this.api.get<{ data: Summary }>('/subscription').subscribe({
      next: res => { this.data.set(res.data); this.loading.set(false); },
      error: e => { this.error.set(e?.error?.error?.message ?? 'Could not load your plan.'); this.loading.set(false); },
    });
  }

  statusLabel(s: string) { return STATUS_LABEL[s] ?? s; }
  pct(m: Meter) { return m.max ? Math.min(100, Math.round((m.used / m.max) * 100)) : 0; }
  isOver(m: Meter) { return m.max != null && m.used > m.max; }
}
