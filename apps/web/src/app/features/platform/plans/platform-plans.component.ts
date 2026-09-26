import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { DecimalPipe } from '@angular/common';
import { environment } from '../../../../environments/environment';
import { PlatformAuthService } from '../../../core/services/platform-auth.service';

export interface Plan {
  id: string;
  name: string;
  display_name: string | null;
  description: string | null;
  pricing_model: 'flat' | 'per_student';
  billing_period: 'monthly' | 'yearly';
  price_inr: string;
  min_charge_inr: string;
  max_students: number | null;
  max_staff: number | null;
  includes_sis: boolean;
  includes_ams: boolean;
  ai_monthly_generations: number | null;
  sms_monthly: number | null;
  is_public: boolean;
  is_archived: boolean;
  sort_order: number;
  school_count?: number;
}

/** "₹200 / student / year · min ₹30,000" or "₹15,000 / year". */
export function planPriceLabel(p: Plan): string {
  const inr = (n: string | number) => '₹' + Number(n).toLocaleString('en-IN');
  const per = p.billing_period === 'monthly' ? 'month' : 'year';
  if (p.pricing_model === 'per_student') {
    const min = Number(p.min_charge_inr) > 0 ? ` · min ${inr(p.min_charge_inr)}` : '';
    return `${inr(p.price_inr)} / student / ${per}${min}`;
  }
  return `${inr(p.price_inr)} / ${per}`;
}

@Component({
  selector: 'app-platform-plans',
  standalone: true,
  imports: [ReactiveFormsModule, MatIconModule, MatProgressSpinnerModule, DecimalPipe],
  template: `
    <div class="pg">
      <div class="pg-header">
        <div>
          <h1 class="pg-title">Plans</h1>
          <p class="pg-sub">{{ activePlans().length }} offered · {{ archivedPlans().length }} archived</p>
        </div>
        <div class="hd-actions">
          <a class="btn-ghost" href="/platform/pricing-sheet" target="_blank" rel="noopener"><mat-icon>picture_as_pdf</mat-icon> Pricing sheet</a>
          <button class="btn-primary" (click)="openCreate()"><mat-icon>add</mat-icon> New Plan</button>
        </div>
      </div>

      @if (error()) {
        <div class="err-banner"><mat-icon>error_outline</mat-icon> {{ error() }}</div>
      }

      <div class="card">
        @if (loading()) {
          <div class="spinner-wrap"><mat-spinner diameter="36" /></div>
        } @else {
          <table class="tbl">
            <thead>
              <tr>
                <th>Plan</th><th>Price</th><th>Products</th><th>Limits</th>
                <th>Monthly allowance</th><th>Schools</th><th>Status</th><th></th>
              </tr>
            </thead>
            <tbody>
              @for (p of plans(); track p.id) {
                <tr [class.archived]="p.is_archived">
                  <td>
                    <div class="name-cell">{{ p.display_name ?? p.name }}</div>
                    <code class="code-chip">{{ p.name }}</code>
                  </td>
                  <td class="price">{{ priceLabel(p) }}</td>
                  <td>
                    @if (p.includes_sis) { <span class="prod sis">Taji One</span> }
                    @if (p.includes_ams) { <span class="prod ams">Taji AMS</span> }
                  </td>
                  <td class="muted">
                    {{ p.max_students ? (p.max_students | number) + ' students' : 'Unlimited students' }}<br>
                    {{ p.max_staff ? (p.max_staff | number) + ' staff' : 'Unlimited staff' }}
                  </td>
                  <td class="muted">
                    {{ p.ai_monthly_generations ?? '∞' }} AI · {{ p.sms_monthly ?? '∞' }} SMS
                  </td>
                  <td>{{ p.school_count ?? 0 }}</td>
                  <td>
                    @if (p.is_archived) { <span class="badge inactive">Archived</span> }
                    @else if (!p.is_public) { <span class="badge hidden">Hidden</span> }
                    @else { <span class="badge active">Offered</span> }
                  </td>
                  <td class="actions">
                    <button class="icon-btn" title="Edit" (click)="openEdit(p)"><mat-icon>edit</mat-icon></button>
                    <button class="icon-btn" [title]="p.is_archived ? 'Restore' : 'Archive'" (click)="toggleArchive(p)">
                      <mat-icon>{{ p.is_archived ? 'unarchive' : 'archive' }}</mat-icon>
                    </button>
                    <button class="icon-btn danger" title="Delete" [disabled]="(p.school_count ?? 0) > 0"
                            (click)="remove(p)"><mat-icon>delete</mat-icon></button>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        }
      </div>
      <p class="foot-note">Archived plans stay valid for the schools already on them; they just aren't offered for new schools.
        A plan can only be deleted when no school uses it.</p>
    </div>

    @if (showForm()) {
      <div class="overlay" (click)="closeForm()"></div>
      <div class="drawer">
        <div class="drawer-header">
          <h2>{{ editing() ? 'Edit plan' : 'New plan' }}</h2>
          <button class="icon-btn" (click)="closeForm()"><mat-icon>close</mat-icon></button>
        </div>
        @if (formError()) {
          <div class="err-banner sm"><mat-icon>error_outline</mat-icon> {{ formError() }}</div>
        }
        <form [formGroup]="form" class="drawer-form" (ngSubmit)="save()">
          <div class="row-2">
            <div class="field">
              <label>Plan name <span class="req">*</span></label>
              <input formControlName="display_name" placeholder="Taji One" />
            </div>
            <div class="field">
              <label>Code <span class="req">*</span></label>
              <input formControlName="name" placeholder="taji_one" />
              <span class="hint">lowercase, digits, _ · can't change later</span>
            </div>
          </div>
          <div class="field">
            <label>Description</label>
            <input formControlName="description" placeholder="Who the plan is for and what it includes" />
          </div>

          <div class="section-label">Pricing</div>
          <div class="row-2">
            <div class="field">
              <label>Model</label>
              <select formControlName="pricing_model">
                <option value="per_student">Per student</option>
                <option value="flat">Flat price</option>
              </select>
            </div>
            <div class="field">
              <label>Billing period</label>
              <select formControlName="billing_period">
                <option value="yearly">Yearly</option>
                <option value="monthly">Monthly</option>
              </select>
            </div>
          </div>
          <div class="row-2">
            <div class="field">
              <label>{{ form.value.pricing_model === 'per_student' ? 'Price per student (₹)' : 'Price (₹)' }} <span class="req">*</span></label>
              <input formControlName="price_inr" type="number" min="0" />
            </div>
            <div class="field">
              <label>Minimum charge (₹)</label>
              <input formControlName="min_charge_inr" type="number" min="0" />
            </div>
          </div>
          <div class="preview">{{ previewLabel() }}</div>

          <div class="section-label">Products</div>
          <label class="check"><input type="checkbox" formControlName="includes_sis" /> Taji One (school management)</label>
          <label class="check"><input type="checkbox" formControlName="includes_ams" /> Taji AMS (academics)</label>

          <div class="section-label">Limits & allowances <span class="hint">(leave blank for unlimited)</span></div>
          <div class="row-2">
            <div class="field"><label>Max students</label><input formControlName="max_students" type="number" min="1" /></div>
            <div class="field"><label>Max staff</label><input formControlName="max_staff" type="number" min="1" /></div>
          </div>
          <div class="row-2">
            <div class="field"><label>AI generations / month</label><input formControlName="ai_monthly_generations" type="number" min="0" /></div>
            <div class="field"><label>SMS / month</label><input formControlName="sms_monthly" type="number" min="0" /></div>
          </div>

          <div class="section-label">Visibility</div>
          <label class="check"><input type="checkbox" formControlName="is_public" /> Offer for new schools</label>
          <div class="row-2">
            <div class="field">
              <label>Sort order</label>
              <input formControlName="sort_order" type="number" min="0" />
              <span class="hint">Lower numbers appear first</span>
            </div>
          </div>
        </form>
        <div class="drawer-footer">
          <button class="btn-ghost" (click)="closeForm()">Cancel</button>
          <button class="btn-primary" [disabled]="form.invalid || saving()" (click)="save()">
            @if (saving()) { <mat-spinner diameter="14" /> }
            {{ editing() ? 'Save changes' : 'Create plan' }}
          </button>
        </div>
      </div>
    }

    @if (successMsg()) {
      <div class="toast"><mat-icon>check_circle</mat-icon> {{ successMsg() }}</div>
    }
  `,
  styles: [`
    .pg { padding: 32px; max-width: 1200px; }
    .pg-header { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 24px; }
    .pg-title { font-size: 22px; font-weight: 700; color: #0F172A; margin: 0 0 4px; }
    .pg-sub   { font-size: 13px; color: #64748B; margin: 0; }
    .btn-primary {
      display: flex; align-items: center; gap: 6px; background: #3B82F6; color: #fff; border: none; border-radius: 8px;
      padding: 9px 16px; font-size: 13px; font-weight: 600; cursor: pointer;
      mat-icon { font-size: 16px; }
      &:disabled { opacity: .5; cursor: not-allowed; }
      &:not(:disabled):hover { background: #2563EB; }
    }
    .btn-ghost { background: none; border: 1px solid #E2E8F0; border-radius: 8px; padding: 9px 16px; font-size: 13px; color: #64748B; cursor: pointer;
      display: inline-flex; align-items: center; gap: 6px; text-decoration: none; mat-icon { font-size: 16px; width: 16px; height: 16px; } }
    .hd-actions { display: flex; gap: 10px; }
    .err-banner {
      display: flex; align-items: center; gap: 8px; background: #FEF2F2; border: 1px solid #FECACA; color: #B91C1C;
      font-size: 13px; padding: 10px 14px; border-radius: 8px; margin-bottom: 16px;
      mat-icon { font-size: 16px; width: 16px; height: 16px; }
      &.sm { margin: 16px 24px 0; }
    }
    .card { background: #fff; border: 1px solid #E2E8F0; border-radius: 12px; overflow: auto; }
    .spinner-wrap { display: flex; justify-content: center; padding: 48px; }
    .tbl { width: 100%; border-collapse: collapse; font-size: 13px; }
    .tbl th { background: #F8FAFC; color: #64748B; font-weight: 600; font-size: 11px; text-transform: uppercase;
      letter-spacing: .04em; padding: 10px 14px; text-align: left; white-space: nowrap; border-bottom: 1px solid #E2E8F0; }
    .tbl td { padding: 12px 14px; border-bottom: 1px solid #F1F5F9; color: #1E293B; vertical-align: middle; }
    .tbl tr.archived td { color: #94A3B8; }
    .name-cell { font-weight: 600; color: #0F172A; margin-bottom: 3px; }
    tr.archived .name-cell { color: #94A3B8; }
    .code-chip { background: #EFF6FF; color: #1D4ED8; padding: 1px 6px; border-radius: 4px; font-family: monospace; font-size: 11px; }
    .price { font-weight: 600; white-space: nowrap; }
    .muted { color: #64748B; font-size: 12px; line-height: 1.5; }
    .prod { display: inline-block; font-size: 11px; font-weight: 600; padding: 2px 8px; border-radius: 20px; margin: 1px 4px 1px 0; }
    .prod.sis { background: #DBEAFE; color: #1D4ED8; }
    .prod.ams { background: #EDE9FE; color: #6D28D9; }
    .badge { padding: 3px 10px; border-radius: 20px; font-size: 11px; font-weight: 600;
      &.active { background: #D1FAE5; color: #065F46; }
      &.hidden { background: #FEF3C7; color: #92400E; }
      &.inactive { background: #E2E8F0; color: #475569; }
    }
    .actions { text-align: right; white-space: nowrap; }
    .icon-btn { background: none; border: none; cursor: pointer; color: #64748B; padding: 4px; border-radius: 6px; display: inline-flex;
      mat-icon { font-size: 18px; }
      &:hover:not(:disabled) { background: #F1F5F9; color: #0F172A; }
      &.danger:hover:not(:disabled) { background: #FEE2E2; color: #B91C1C; }
      &:disabled { opacity: .35; cursor: not-allowed; }
    }
    .foot-note { font-size: 12px; color: #94A3B8; margin: 12px 2px 0; }
    .overlay { position: fixed; inset: 0; background: rgba(0,0,0,.4); z-index: 100; }
    .drawer { position: fixed; top: 0; right: 0; bottom: 0; width: 520px; max-width: 100vw; background: #fff; z-index: 101;
      overflow-y: auto; display: flex; flex-direction: column; box-shadow: -4px 0 24px rgba(0,0,0,.12); }
    .drawer-header { display: flex; align-items: center; justify-content: space-between; padding: 20px 24px;
      border-bottom: 1px solid #E2E8F0; position: sticky; top: 0; background: #fff; z-index: 1;
      h2 { margin: 0; font-size: 17px; font-weight: 700; color: #0F172A; } }
    .drawer-form { padding: 24px; display: flex; flex-direction: column; gap: 14px; flex: 1; }
    .drawer-footer { display: flex; justify-content: flex-end; gap: 10px; padding: 16px 24px; border-top: 1px solid #E2E8F0;
      position: sticky; bottom: 0; background: #fff; }
    .section-label { font-size: 11px; font-weight: 700; color: #94A3B8; text-transform: uppercase; letter-spacing: .06em; margin-top: 6px; }
    .row-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; align-items: start; }
    .field { display: flex; flex-direction: column; gap: 5px; }
    .field label { font-size: 12px; font-weight: 500; color: #475569; }
    .field input, .field select {
      box-sizing: border-box; width: 100%; height: 38px; border: 1px solid #E2E8F0; border-radius: 8px;
      padding: 0 12px; font: inherit; font-size: 13px; color: #0F172A; background-color: #fff;
      &:focus { outline: none; border-color: #3B82F6; box-shadow: 0 0 0 3px rgba(59,130,246,.1); } }
    /* Same look for dropdowns as text boxes: custom chevron instead of the native control */
    .field select { appearance: none; -webkit-appearance: none; padding-right: 34px; cursor: pointer;
      background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20' fill='%2364748B'%3E%3Cpath d='M5.3 7.3a1 1 0 011.4 0L10 10.6l3.3-3.3a1 1 0 111.4 1.4l-4 4a1 1 0 01-1.4 0l-4-4a1 1 0 010-1.4z'/%3E%3C/svg%3E");
      background-repeat: no-repeat; background-position: right 10px center; background-size: 16px; }
    /* Hide number spinners so number boxes match text boxes */
    .field input[type=number] { -moz-appearance: textfield; }
    .field input[type=number]::-webkit-inner-spin-button,
    .field input[type=number]::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
    .hint { font-size: 11px; color: #94A3B8; text-transform: none; letter-spacing: 0; font-weight: 400; }
    .req { color: #EF4444; }
    .check { display: flex; align-items: center; gap: 8px; font-size: 13px; color: #334155; cursor: pointer;
      input { width: 16px; height: 16px; margin: 0; accent-color: #3B82F6; } }
    .preview { font-size: 13px; font-weight: 600; color: #1D4ED8; background: #EFF6FF; border-radius: 8px; padding: 8px 12px; }
    .toast { position: fixed; bottom: 24px; right: 24px; z-index: 200; background: #064E3B; color: #A7F3D0; border: 1px solid #065F46;
      padding: 12px 20px; border-radius: 10px; font-size: 13px; font-weight: 500; display: flex; align-items: center; gap: 8px;
      mat-icon { font-size: 16px; } }
  `],
})
export class PlatformPlansComponent implements OnInit {
  private http = inject(HttpClient);
  private auth = inject(PlatformAuthService);
  private fb   = inject(FormBuilder);

  plans      = signal<Plan[]>([]);
  loading    = signal(true);
  error      = signal('');
  showForm   = signal(false);
  editing    = signal<Plan | null>(null);
  saving     = signal(false);
  formError  = signal('');
  successMsg = signal('');

  activePlans   = computed(() => this.plans().filter(p => !p.is_archived));
  archivedPlans = computed(() => this.plans().filter(p => p.is_archived));

  form = this.fb.group({
    name:           ['', [Validators.required, Validators.pattern(/^[a-z0-9_]+$/), Validators.minLength(2)]],
    display_name:   ['', [Validators.required, Validators.minLength(2)]],
    description:    [''],
    pricing_model:  ['per_student' as 'flat' | 'per_student'],
    billing_period: ['yearly' as 'monthly' | 'yearly'],
    price_inr:      [null as number | null, [Validators.required, Validators.min(0)]],
    min_charge_inr: [0 as number | null, [Validators.min(0)]],
    max_students:   [null as number | null, [Validators.min(1)]],
    max_staff:      [null as number | null, [Validators.min(1)]],
    includes_sis:   [true],
    includes_ams:   [false],
    ai_monthly_generations: [null as number | null, [Validators.min(0)]],
    sms_monthly:    [null as number | null, [Validators.min(0)]],
    is_public:      [true],
    sort_order:     [0 as number | null],
  });

  priceLabel = planPriceLabel;

  previewLabel() {
    const v = this.form.getRawValue();
    if (v.price_inr == null) return 'Enter a price';
    return planPriceLabel({
      pricing_model: v.pricing_model, billing_period: v.billing_period,
      price_inr: String(v.price_inr), min_charge_inr: String(v.min_charge_inr ?? 0),
    } as Plan);
  }

  private headers() { return new HttpHeaders({ Authorization: `Bearer ${this.auth.token()}` }); }
  private url(path = '') { return `${environment.apiUrl}/platform/plans${path}`; }

  ngOnInit() { this.load(); }

  private load() {
    this.loading.set(true);
    this.http.get<{ data: Plan[] }>(this.url('/all'), { headers: this.headers() }).subscribe({
      next: res => { this.plans.set(res.data); this.loading.set(false); },
      error: e => { this.error.set(e?.error?.error?.message ?? 'Failed to load plans'); this.loading.set(false); },
    });
  }

  openCreate() {
    this.editing.set(null);
    this.form.reset({
      name: '', display_name: '', description: '', pricing_model: 'per_student', billing_period: 'yearly',
      price_inr: null, min_charge_inr: 0, max_students: null, max_staff: null, includes_sis: true, includes_ams: false,
      ai_monthly_generations: null, sms_monthly: null, is_public: true, sort_order: 0,
    });
    this.form.controls.name.enable();
    this.formError.set('');
    this.showForm.set(true);
  }

  openEdit(p: Plan) {
    this.editing.set(p);
    this.form.reset({
      name: p.name, display_name: p.display_name ?? p.name, description: p.description ?? '',
      pricing_model: p.pricing_model, billing_period: p.billing_period,
      price_inr: Number(p.price_inr), min_charge_inr: Number(p.min_charge_inr),
      max_students: p.max_students, max_staff: p.max_staff, includes_sis: p.includes_sis, includes_ams: p.includes_ams,
      ai_monthly_generations: p.ai_monthly_generations, sms_monthly: p.sms_monthly,
      is_public: p.is_public, sort_order: p.sort_order,
    });
    this.form.controls.name.disable();
    this.formError.set('');
    this.showForm.set(true);
  }

  closeForm() { this.showForm.set(false); }

  save() {
    if (this.form.invalid) return;
    const v = this.form.getRawValue();
    if (!v.includes_sis && !v.includes_ams) { this.formError.set('Pick at least one product'); return; }
    const blank = (n: number | null) => (n === null || (n as unknown) === '' ? null : Number(n));
    const body: Record<string, unknown> = {
      display_name: v.display_name, description: v.description || null,
      pricing_model: v.pricing_model, billing_period: v.billing_period,
      price_inr: Number(v.price_inr), min_charge_inr: Number(v.min_charge_inr ?? 0),
      max_students: blank(v.max_students), max_staff: blank(v.max_staff),
      includes_sis: !!v.includes_sis, includes_ams: !!v.includes_ams,
      ai_monthly_generations: blank(v.ai_monthly_generations), sms_monthly: blank(v.sms_monthly),
      is_public: !!v.is_public, sort_order: Number(v.sort_order ?? 0),
    };
    const editing = this.editing();
    const req = editing
      ? this.http.put<{ message: string }>(this.url(`/${editing.id}`), body, { headers: this.headers() })
      : this.http.post<{ message: string }>(this.url(), { name: v.name, ...body }, { headers: this.headers() });
    this.saving.set(true);
    this.formError.set('');
    req.subscribe({
      next: res => { this.saving.set(false); this.closeForm(); this.load(); this.toast(res.message); },
      error: e => { this.saving.set(false); this.formError.set(e?.error?.error?.message ?? 'Failed to save plan'); },
    });
  }

  toggleArchive(p: Plan) {
    const archiving = !p.is_archived;
    if (archiving && !confirm(`Archive "${p.display_name ?? p.name}"? Schools on it keep it; it won't be offered for new schools.`)) return;
    this.http.patch<{ message: string }>(this.url(`/${p.id}/archive`), { is_archived: archiving }, { headers: this.headers() })
      .subscribe({
        next: res => { this.load(); this.toast(res.message); },
        error: e => this.error.set(e?.error?.error?.message ?? 'Failed to update plan'),
      });
  }

  remove(p: Plan) {
    if (!confirm(`Delete plan "${p.display_name ?? p.name}"? This cannot be undone.`)) return;
    this.http.delete<{ message: string }>(this.url(`/${p.id}`), { headers: this.headers() }).subscribe({
      next: res => { this.load(); this.toast(res.message); },
      error: e => this.error.set(e?.error?.error?.message ?? 'Failed to delete plan'),
    });
  }

  private toast(msg: string) {
    this.successMsg.set(msg);
    setTimeout(() => this.successMsg.set(''), 3500);
  }
}
