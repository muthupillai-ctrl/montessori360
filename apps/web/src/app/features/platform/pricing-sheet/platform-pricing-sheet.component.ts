import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { DatePipe } from '@angular/common';
import { environment } from '../../../../environments/environment';
import type { Plan } from '../plans/platform-plans.component';

// Client-facing pricing pamphlet, generated from the live public plans.
// Opens outside the platform shell so "Print / Save as PDF" gives a clean A4 document.

interface Options {
  preparedFor: string;
  currency: string;         // ISO code shown on the sheet
  inrPerUnit: number;       // exchange rate: how many INR = 1 unit of `currency`
  validDays: number;
  pilot: boolean;
  pilotDays: number;
  earlyAdopter: boolean;
  earlyPct: number;
  earlyCount: number;
  setupFee: boolean;
  setupAmountInr: number | null;   // null = "on request"
  addOns: boolean;
  email: string;
  phone: string;
  website: string;
}

const CURRENCIES = [
  { code: 'INR', label: 'Indian rupee (INR)', rate: 1 },
  { code: 'USD', label: 'US dollar (USD)', rate: 88 },
  { code: 'KES', label: 'Kenyan shilling (KES)', rate: 0.68 },
  { code: 'NGN', label: 'Nigerian naira (NGN)', rate: 0.058 },
  { code: 'ZAR', label: 'South African rand (ZAR)', rate: 5 },
  { code: 'UGX', label: 'Ugandan shilling (UGX)', rate: 0.024 },
  { code: 'TZS', label: 'Tanzanian shilling (TZS)', rate: 0.034 },
  { code: 'GHS', label: 'Ghanaian cedi (GHS)', rate: 7.5 },
  { code: 'AED', label: 'UAE dirham (AED)', rate: 24 },
];

const STORAGE_KEY = 'pricing_sheet_options';

@Component({
  selector: 'app-platform-pricing-sheet',
  standalone: true,
  imports: [FormsModule, DatePipe],
  template: `
    <div class="toolbar no-print">
      <div class="tb-head">
        <div>
          <div class="tb-title">Pricing sheet</div>
          <div class="tb-sub">Built from the plans offered in the Plans page. Adjust below, then print or save as PDF.</div>
        </div>
        <button class="btn-primary" (click)="print()" [disabled]="!plans().length">Print / Save as PDF</button>
      </div>

      <div class="tb-grid">
        <label>Prepared for (optional)
          <input [(ngModel)]="o.preparedFor" (ngModelChange)="save()" placeholder="School name" />
        </label>
        <label>Currency
          <select [ngModel]="o.currency" (ngModelChange)="setCurrency($event)">
            @for (c of currencies; track c.code) { <option [value]="c.code">{{ c.label }}</option> }
          </select>
        </label>
        <label>Exchange rate: INR per 1 {{ o.currency }}
          <input type="number" min="0.0001" step="any" [(ngModel)]="o.inrPerUnit" (ngModelChange)="save()" [disabled]="o.currency === 'INR'" />
          @if (o.currency !== 'INR') { <span class="hint">Check today's rate; prices are rounded for the sheet.</span> }
        </label>
        <label>Valid for (days)
          <input type="number" min="1" [(ngModel)]="o.validDays" (ngModelChange)="save()" />
        </label>

        <label class="chk"><input type="checkbox" [(ngModel)]="o.pilot" (ngModelChange)="save()" /> Free pilot</label>
        <label>Pilot length (days)
          <input type="number" min="1" [(ngModel)]="o.pilotDays" (ngModelChange)="save()" [disabled]="!o.pilot" />
        </label>
        <label class="chk"><input type="checkbox" [(ngModel)]="o.earlyAdopter" (ngModelChange)="save()" /> Early-adopter offer</label>
        <label>Discount % / for first N schools
          <span class="pair">
            <input type="number" min="1" max="100" [(ngModel)]="o.earlyPct" (ngModelChange)="save()" [disabled]="!o.earlyAdopter" />
            <input type="number" min="1" [(ngModel)]="o.earlyCount" (ngModelChange)="save()" [disabled]="!o.earlyAdopter" />
          </span>
        </label>
        <label class="chk"><input type="checkbox" [(ngModel)]="o.setupFee" (ngModelChange)="save()" /> One-time setup fee</label>
        <label>Setup fee in INR (blank = "on request")
          <input type="number" min="0" [(ngModel)]="o.setupAmountInr" (ngModelChange)="save()" [disabled]="!o.setupFee" />
        </label>
        <label class="chk"><input type="checkbox" [(ngModel)]="o.addOns" (ngModelChange)="save()" /> Add-ons on request</label>
        <span></span>

        <label>Email <input [(ngModel)]="o.email" (ngModelChange)="save()" /></label>
        <label>Phone <input [(ngModel)]="o.phone" (ngModelChange)="save()" /></label>
        <label>Website <input [(ngModel)]="o.website" (ngModelChange)="save()" /></label>
      </div>
      @if (error()) { <div class="err">{{ error() }}</div> }
    </div>

    <!-- ── The pamphlet ─────────────────────────────────────────────────── -->
    <article class="sheet">
      <header class="hd">
        <div class="brand">
          <svg width="40" height="40" viewBox="0 0 40 40" aria-hidden="true">
            <circle cx="20" cy="20" r="19" fill="#0f766e" stroke="#f4c46b" stroke-width="2"/>
            <circle cx="20" cy="20" r="11" fill="none" stroke="#fbfaf5" stroke-width="2.2" stroke-dasharray="52 17.1" stroke-linecap="round" transform="rotate(-60 20 20)"/>
            <circle cx="20" cy="20" r="3.2" fill="#f4c46b"/>
          </svg>
          <div>
            <div class="bn">Taji <span>by AhamSys</span></div>
            <div class="bs">School management &amp; academics</div>
          </div>
        </div>
        <div class="hd-right">
          <div class="doc">Pricing</div>
          <div class="meta">{{ today | date:'d MMMM y' }}@if (o.preparedFor) { · Prepared for <b>{{ o.preparedFor }}</b> }</div>
        </div>
      </header>

      <p class="intro">
        <b>Taji One</b> runs the school office: students, attendance, fees, staff, transport and the parent portal.
        <b>Taji AMS</b> runs the learning: curriculum, each child's progress and AI-assisted teaching material.
        Choose the plan that fits your school; every plan is billed yearly.
      </p>

      <section class="plans">
        @for (p of plans(); track p.id) {
          <div class="plan" [class.feat]="p.includes_sis && p.includes_ams">
            @if (p.includes_sis && p.includes_ams) { <div class="ribbon">Complete</div> }
            <div class="pname">{{ p.display_name ?? p.name }}</div>
            <div class="pdesc">{{ bestFor(p) }}</div>
            <div class="price">
              <span class="amt">{{ money(p.price_inr, p.pricing_model === 'per_student') }}</span>
              <span class="per">{{ p.pricing_model === 'per_student' ? 'per student / ' : '/ ' }}{{ p.billing_period === 'monthly' ? 'month' : 'year' }}</span>
            </div>
            <div class="pmin">
              @if (p.pricing_model === 'per_student' && +p.min_charge_inr > 0) { Minimum {{ money(p.min_charge_inr) }} / {{ p.billing_period === 'monthly' ? 'month' : 'year' }} }
              @else if (p.pricing_model === 'flat' && p.max_students) { Up to {{ p.max_students }} students }
              @else { &nbsp; }
            </div>
            <ul>
              @for (line of includes(p); track line) { <li>{{ line }}</li> }
            </ul>
          </div>
        }
      </section>

      <section class="cmp">
        <h2>Compare plans</h2>
        <table>
          <thead>
            <tr><th></th>@for (p of plans(); track p.id) { <th>{{ p.display_name ?? p.name }}</th> }</tr>
          </thead>
          <tbody>
            @for (row of compareRows(); track row.label) {
              <tr>
                <td>{{ row.label }}</td>
                @for (v of row.values; track $index) {
                  <td [class.yes]="v === true" [class.no]="v === false">{{ v === true ? '✓' : v === false ? '—' : v }}</td>
                }
              </tr>
            }
          </tbody>
        </table>
      </section>

      @if (o.pilot || o.earlyAdopter || o.setupFee || o.addOns) {
        <section class="offers">
          @if (o.pilot) {
            <div class="offer"><div class="ot">{{ o.pilotDays }}-day free pilot</div>
              <p>Try Taji with your own school's data before you pay anything.</p></div>
          }
          @if (o.earlyAdopter) {
            <div class="offer hl"><div class="ot">{{ o.earlyPct }}% off your first year</div>
              <p>Early-adopter offer for the first {{ o.earlyCount }} schools that sign up.</p></div>
          }
          @if (o.setupFee) {
            <div class="offer"><div class="ot">One-time setup{{ o.setupAmountInr != null && o.setupAmountInr !== 0 ? ': ' + money(o.setupAmountInr) : '' }}</div>
              <p>Importing your existing data, configuring classes and fees, and training your staff.{{ o.setupAmountInr == null || o.setupAmountInr === 0 ? ' Priced on request.' : '' }}</p></div>
          }
          @if (o.addOns) {
            <div class="offer"><div class="ot">Add-ons on request</div>
              <p>Extra SMS and AI generations, RFID cards and readers for attendance, and custom integrations.</p></div>
          }
        </section>
      }

      <section class="terms">
        <h3>How pricing works</h3>
        <ul>
          <li>Per-student plans are charged on the number of active students, subject to the plan's minimum charge.</li>
          <li>Billed yearly in advance; move to a larger plan at any time. AI and SMS allowances reset monthly (SMS where delivery is supported).</li>
          <li>Each school's data is kept separate and private. The software runs in the browser; there is nothing to install.</li>
          <li>Prices exclude applicable taxes.@if (o.currency !== 'INR') { Prices in {{ o.currency }} are converted from INR and may be adjusted in your quotation. }
            Valid until {{ validUntil() | date:'d MMMM y' }}.</li>
        </ul>
      </section>

      <footer class="ft">
        <div><b>Talk to us</b> for a demo or a quotation for your school.</div>
        <div class="contact">{{ o.email }}&nbsp;&nbsp;·&nbsp;&nbsp;{{ o.phone }}&nbsp;&nbsp;·&nbsp;&nbsp;{{ o.website }}</div>
      </footer>
    </article>
  `,
  styles: [`
    :host { display: block; background: #E7EBE8; min-height: 100vh; padding: 24px 0 48px;
      font-family: 'Inter', system-ui, -apple-system, 'Segoe UI', sans-serif; color: #13201E; }

    /* Controls (not printed) */
    .toolbar { max-width: 210mm; margin: 0 auto 20px; background: #fff; border: 1px solid #D5DCD6; border-radius: 12px; padding: 18px 20px; }
    .tb-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; margin-bottom: 14px; }
    .tb-title { font-size: 18px; font-weight: 700; }
    .tb-sub { font-size: 12.5px; color: #66736F; }
    .btn-primary { background: #0F766E; color: #fff; border: none; border-radius: 8px; padding: 10px 16px; font-weight: 600; font-size: 13px; cursor: pointer; white-space: nowrap;
      &:disabled { opacity: .5; cursor: not-allowed; } }
    .tb-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px 14px; align-items: start; }
    .tb-grid label { display: flex; flex-direction: column; gap: 4px; font-size: 11.5px; font-weight: 600; color: #3C4A47; }
    .tb-grid input, .tb-grid select { box-sizing: border-box; width: 100%; height: 34px; border: 1px solid #D5DCD6; border-radius: 7px; padding: 0 10px; font: inherit; font-size: 13px; font-weight: 400;
      &:disabled { background: #F2F4F1; color: #9AA5A1; } }
    .tb-grid .chk { flex-direction: row; align-items: center; gap: 8px; padding-top: 20px; font-size: 13px;
      input { width: 16px; height: 16px; accent-color: #0F766E; } }
    .pair { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }
    .hint { font-weight: 400; color: #8A948F; font-size: 11px; }
    .err { margin-top: 10px; color: #B91C1C; font-size: 13px; }

    /* A4 pamphlet */
    .sheet { box-sizing: border-box; width: 210mm; min-height: 297mm; margin: 0 auto; background: #FBFAF5; padding: 12mm 13mm 10mm;
      box-shadow: 0 10px 30px rgba(19,32,30,.15); font-size: 10.5pt; line-height: 1.45; }
    .hd { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #0F766E; padding-bottom: 10px; }
    .brand { display: flex; align-items: center; gap: 10px; }
    .bn { font-family: Georgia, serif; font-size: 20pt; font-weight: 700; line-height: 1; span { font-family: 'Inter', sans-serif; font-size: 10pt; font-weight: 500; color: #66736F; } }
    .bs { font-size: 8.5pt; letter-spacing: .12em; text-transform: uppercase; color: #66736F; margin-top: 3px; }
    .hd-right { text-align: right; }
    .doc { font-family: Georgia, serif; font-size: 22pt; font-weight: 700; color: #0F766E; line-height: 1; }
    .meta { font-size: 9pt; color: #66736F; margin-top: 4px; }
    .intro { margin: 10px 0 14px; color: #3C4A47; font-size: 9.8pt; }

    .plans { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; }
    .plan { position: relative; background: #fff; border: 1px solid #DCE2DC; border-top: 4px solid #0F766E; border-radius: 8px; padding: 10px 10px 8px; }
    .plan.feat { border-top-color: #D97706; box-shadow: 0 0 0 1.5px #F4C46B inset; }
    .ribbon { position: absolute; top: -11px; right: 8px; background: #D97706; color: #fff; font-size: 7pt; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; padding: 2px 7px; border-radius: 20px; }
    .pname { font-weight: 800; font-size: 11pt; }
    .pdesc { font-size: 8pt; color: #66736F; min-height: 24px; margin-top: 2px; }
    .price { margin-top: 8px; }
    .amt { font-size: 16pt; font-weight: 800; color: #0B4F4A; }
    .per { display: block; font-size: 8pt; color: #66736F; }
    .pmin { font-size: 8pt; font-weight: 600; color: #7A4306; margin-top: 2px; min-height: 12px; }
    .plan ul { margin: 6px 0 0; padding: 0; list-style: none; font-size: 8.2pt; line-height: 1.35; }
    .plan li { padding-left: 13px; position: relative; margin: 2px 0; }
    .plan li::before { content: '✓'; position: absolute; left: 0; color: #0F766E; font-weight: 700; }

    .cmp h2, .terms h3 { font-family: Georgia, serif; font-size: 12pt; margin: 12px 0 5px; }
    .cmp table { width: 100%; border-collapse: collapse; font-size: 8.2pt; line-height: 1.3; background: #fff; }
    .cmp th, .cmp td { border-bottom: 1px solid #E4E8E3; padding: 2.5px 6px; text-align: center; }
    .cmp th { background: #EEF3EF; font-size: 8.3pt; }
    .cmp td:first-child, .cmp th:first-child { text-align: left; }
    .cmp td.yes { color: #0F766E; font-weight: 700; }
    .cmp td.no { color: #B6BFBA; }

    .offers { display: grid; grid-template-columns: repeat(auto-fit, minmax(0, 1fr)); gap: 8px; margin-top: 12px; }
    .offer { background: #fff; border: 1px dashed #A9CFC7; border-radius: 8px; padding: 8px 10px; }
    .offer.hl { background: #FDF6E7; border-color: #E3B55C; }
    .ot { font-weight: 800; font-size: 9.5pt; color: #0B4F4A; }
    .offer.hl .ot { color: #7A4306; }
    .offer p { margin: 2px 0 0; font-size: 8pt; line-height: 1.35; color: #3C4A47; }

    .terms ul { margin: 0; padding-left: 16px; font-size: 8.2pt; line-height: 1.35; color: #3C4A47; }
    .terms li { margin: 1px 0; }
    .ft { margin-top: 10px; padding-top: 8px; border-top: 1px solid #DCE2DC; display: flex; justify-content: space-between; gap: 12px; font-size: 9pt; flex-wrap: wrap; }
    .contact { color: #0B4F4A; font-weight: 600; }

    @media print {
      @page { size: A4; margin: 0; }
      :host { background: #fff; padding: 0; }
      .no-print { display: none !important; }
      .sheet { box-shadow: none; margin: 0; width: 210mm; min-height: 297mm; }
      .sheet, .plan, .offer, .cmp th, .ribbon { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .plan, .offer, .cmp, .terms { break-inside: avoid; }
    }
    @media screen and (max-width: 860px) {
      .toolbar, .sheet { width: auto; margin-left: 12px; margin-right: 12px; }
      .tb-grid { grid-template-columns: 1fr 1fr; }
      .plans { grid-template-columns: 1fr 1fr; }
    }
  `],
})
export class PlatformPricingSheetComponent implements OnInit {
  private http = inject(HttpClient);

  currencies = CURRENCIES;
  plans = signal<Plan[]>([]);
  error = signal('');
  today = new Date();

  o: Options = {
    preparedFor: '', currency: 'INR', inrPerUnit: 1, validDays: 90,
    pilot: true, pilotDays: 30, earlyAdopter: true, earlyPct: 30, earlyCount: 10,
    setupFee: true, setupAmountInr: null, addOns: true,
    email: 'hello@ahamsys.com', phone: '+91 70900 40515', website: 'www.ahamsys.com',
  };

  private rev = signal(0);   // bumps on option changes so computed values refresh
  validUntil = computed(() => { this.rev(); return new Date(Date.now() + this.o.validDays * 86_400_000); });

  compareRows = computed(() => {
    this.rev();
    const ps = this.plans();
    const f = (p: Plan, k: string) => p.includes_sis && ((p as any).features?.[k] !== false);
    const lim = (n: number | null, unit = '') => (n == null ? 'Unlimited' : `${n.toLocaleString('en-IN')}${unit}`);
    return [
      { label: 'Students, attendance & fees',       values: ps.map(p => p.includes_sis) },
      { label: 'Parent portal, journal & messaging', values: ps.map(p => p.includes_sis) },
      { label: 'Staff, leave & payroll',            values: ps.map(p => f(p, 'staff_payroll')) },
      { label: 'Transport & trips',                 values: ps.map(p => f(p, 'transport')) },
      { label: 'Timetable',                         values: ps.map(p => f(p, 'timetable')) },
      { label: 'AI insights (attendance, fee risk)', values: ps.map(p => f(p, 'ai_insights')) },
      { label: 'Curriculum & child progress (AMS)', values: ps.map(p => p.includes_ams) },
      { label: 'AI worksheets, lesson plans, papers', values: ps.map(p => p.includes_ams) },
      { label: 'Students',                          values: ps.map(p => lim(p.max_students)) },
      { label: 'AI generations / month',            values: ps.map(p => lim(p.ai_monthly_generations)) },
      { label: 'SMS / month',                       values: ps.map(p => (p.sms_monthly ? lim(p.sms_monthly) : false)) },
    ] as { label: string; values: (boolean | string)[] }[];
  });

  ngOnInit() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null');
      if (saved) this.o = { ...this.o, ...saved };
    } catch { /* storage unavailable */ }
    this.http.get<{ data: Plan[] }>(`${environment.apiUrl}/platform/plans`).subscribe({
      next: res => this.plans.set(res.data),
      error: () => this.error.set('Could not load plans. Check the Plans page.'),
    });
  }

  save() {
    this.rev.update(n => n + 1);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(this.o)); } catch { /* storage unavailable */ }
  }

  setCurrency(code: string) {
    const c = CURRENCIES.find(x => x.code === code);
    this.o.currency = code;
    if (c) this.o.inrPerUnit = c.rate;
    this.save();
  }

  /** INR amount shown in the chosen currency; per-student prices keep cents for strong currencies. */
  money(inr: string | number, perStudent = false): string {
    const value = Number(inr) / (this.o.currency === 'INR' ? 1 : (this.o.inrPerUnit || 1));
    const big = value >= 1000;
    const rounded = perStudent || !big ? value : Math.round(value / 10) * 10;
    const fmt = new Intl.NumberFormat(this.o.currency === 'INR' ? 'en-IN' : 'en', {
      style: 'currency', currency: this.o.currency,
      minimumFractionDigits: 0, maximumFractionDigits: perStudent && value < 100 ? 2 : 0,
    });
    return fmt.format(rounded);
  }

  /** "Who it's for": the plan description up to its first colon or full stop. */
  bestFor(p: Plan): string {
    const d = (p.description ?? '').trim();
    return d.split(/[:.]/)[0].trim();
  }

  /** Short highlights for the plan card; the comparison table has the detail. */
  includes(p: Plan): string[] {
    const f = (k: string) => (p as any).features?.[k] !== false;
    const out: string[] = [];
    if (p.includes_sis) {
      out.push('Students, attendance, fees & parent portal');
      const extra = [f('staff_payroll') && 'payroll', f('transport') && 'transport', f('timetable') && 'timetable'].filter(Boolean);
      if (extra.length) out.push(`Staff ${extra.join(', ')}`);
      if (f('ai_insights')) out.push('AI insights');
    }
    if (p.includes_ams) out.push('Curriculum, child progress & AI teaching material');
    const allowance = [p.ai_monthly_generations && `${p.ai_monthly_generations} AI`, p.sms_monthly && `${p.sms_monthly.toLocaleString('en-IN')} SMS`].filter(Boolean);
    if (allowance.length) out.push(`${allowance.join(' · ')} a month`);
    return out;
  }

  print() { window.print(); }
}
