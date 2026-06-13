import { Component, inject, signal, OnInit, computed } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { DecimalPipe, TitleCasePipe } from '@angular/common';
import { ApiService } from '../../core/services/api.service';
import type { FeeStructure, SchoolClass } from '../../core/models';

@Component({
  selector: 'app-bulk-invoice-dialog',
  standalone: true,
  imports: [
    ReactiveFormsModule, MatDialogModule,
    MatButtonModule, MatIconModule,
    MatProgressSpinnerModule, DecimalPipe, TitleCasePipe,
  ],
  template: `
    <div class="dialog-shell">

      <div class="dialog-header">
        <div class="dh-icon"><mat-icon>auto_awesome</mat-icon></div>
        <div>
          <div class="dh-title">Generate Bulk Invoices</div>
          <div class="dh-sub">Create invoices for multiple students at once</div>
        </div>
        <button class="dh-close" mat-dialog-close><mat-icon>close</mat-icon></button>
      </div>

      <div class="dialog-body">

        <div class="info-banner">
          <mat-icon style="font-size:16px;width:16px;height:16px;flex-shrink:0;color:var(--blue)">info</mat-icon>
          Students who already have an invoice for the same billing period will be skipped automatically.
        </div>

        <form [formGroup]="form" class="bulk-form">

          <!-- Step 1: Fee Structure -->
          <div class="section-block">
            <div class="sb-label">
              <span class="sb-num">1</span> Fee Structure <span class="req">*</span>
            </div>

            @if (!feeStructures().length) {
              <div class="warn-box">
                <mat-icon style="font-size:16px;width:16px;height:16px">warning</mat-icon>
                No fee structures found. Create one in the Fee Structures tab first.
              </div>
            } @else {
              <select class="field-input" formControlName="fee_structure_id"
                      (change)="onStructureChange($any($event.target).value)">
                <option value="">— Select a fee structure —</option>
                @for (fs of feeStructures(); track fs.id) {
                  <option [value]="fs.id">
                    {{ fs.name }}
                    · {{ fs.billing_cycle | titlecase }}
                    · ₹{{ getTotal(fs) | number }}
                    @if (fs.applies_to === 'class') { · Class-specific }
                  </option>
                }
              </select>
            }

            <!-- Structure preview -->
            @if (selectedStructure()) {
              <div class="structure-preview">
                @for (h of mandatoryHeads(); track h.name) {
                  <div class="sp-row">
                    <span>{{ h.name }}</span>
                    <span>₹{{ h.amount | number }}</span>
                  </div>
                }
                @if (optionalHeads().length) {
                  <div class="sp-optional">
                    + {{ optionalHeads().length }} optional head(s) — not included in bulk
                  </div>
                }
                <div class="sp-total">
                  <span>Total per student</span>
                  <span>₹{{ mandatoryTotal() | number }}</span>
                </div>
              </div>
            }
          </div>

          <!-- Step 2: Scope (class filter) -->
          @if (selectedStructure()) {
            <div class="section-block">
              <div class="sb-label">
                <span class="sb-num">2</span> Apply To
                @if (selectedStructure()!.applies_to === 'class') {
                  <span class="scope-note">This structure is class-specific</span>
                }
              </div>

              @if (selectedStructure()!.applies_to === 'class') {
                <!-- Class-specific structure: must pick from its assigned classes -->
                <div class="scope-info">
                  <mat-icon style="font-size:14px;width:14px;height:14px;color:var(--amber)">info</mat-icon>
                  This fee structure is assigned to specific classes. Select one to invoice.
                </div>
                <select class="field-input" formControlName="class_id">
                  <option value="">— Select a class —</option>
                  @for (cls of assignedClasses(); track cls.id) {
                    <option [value]="cls.id">{{ cls.name }} ({{ cls.enrolled_count }} students)</option>
                  }
                </select>
              } @else {
                <!-- All-students structure: optionally filter by class -->
                <div class="scope-options">
                  <div class="scope-card"
                       [class.selected]="form.value.class_id === ''"
                       (click)="form.patchValue({ class_id: '' })">
                    <div class="sc-icon"><mat-icon>school</mat-icon></div>
                    <div class="sc-text">
                      <div class="sc-title">All Students</div>
                      <div class="sc-sub">{{ totalStudents() }} active students</div>
                    </div>
                    @if (form.value.class_id === '') {
                      <mat-icon class="sc-check">check_circle</mat-icon>
                    }
                  </div>
                  @for (cls of classes(); track cls.id) {
                    <div class="scope-card"
                         [class.selected]="form.value.class_id === cls.id"
                         (click)="form.patchValue({ class_id: cls.id })">
                      <div class="sc-icon class">{{ cls.name[0] }}</div>
                      <div class="sc-text">
                        <div class="sc-title">{{ cls.name }}</div>
                        <div class="sc-sub">{{ cls.enrolled_count }} students</div>
                      </div>
                      @if (form.value.class_id === cls.id) {
                        <mat-icon class="sc-check">check_circle</mat-icon>
                      }
                    </div>
                  }
                </div>
              }
            </div>

            <!-- Step 3: Billing period & due date -->
            <div class="section-block">
              <div class="sb-label"><span class="sb-num">3</span> Billing Period & Due Date</div>

              <div class="form-row">
                <div class="field-group flex-1">
                  <label class="field-label">Billing Period <span class="req">*</span></label>
                  <div class="bp-wrap">
                    <select class="field-input bp-type" [value]="billingType()"
                            (change)="onBillingTypeChange($any($event.target).value)">
                      <option value="monthly">Monthly</option>
                      <option value="quarterly">Quarterly</option>
                      <option value="half_yearly">Half-Yearly</option>
                      <option value="annually">Annual</option>
                      <option value="one_time">One Time</option>
                      <option value="custom">Custom</option>
                    </select>
                    @if (billingType() === 'monthly') {
                      <select class="field-input bp-val" formControlName="billing_period">
                        @for (m of months; track m.value) {
                          <option [value]="m.value">{{ m.label }}</option>
                        }
                      </select>
                    } @else if (billingType() === 'quarterly') {
                      <select class="field-input bp-val" formControlName="billing_period">
                        @for (q of quarters; track q.value) {
                          <option [value]="q.value">{{ q.label }}</option>
                        }
                      </select>
                    } @else if (billingType() === 'half_yearly') {
                      <select class="field-input bp-val" formControlName="billing_period">
                        @for (h of halfYears; track h.value) {
                          <option [value]="h.value">{{ h.label }}</option>
                        }
                      </select>
                    } @else if (billingType() === 'annually') {
                      <select class="field-input bp-val" formControlName="billing_period">
                        <option value="2024-2025">2024–2025</option>
                        <option value="2025-2026">2025–2026</option>
                        <option value="2026-2027">2026–2027</option>
                      </select>
                    } @else {
                      <input class="field-input bp-val" formControlName="billing_period"
                             placeholder="e.g. Annual Day 2026 / One-time Fee">
                    }
                  </div>
                </div>
                <div class="field-group" style="width:150px;flex-shrink:0">
                  <label class="field-label">Due Date <span class="req">*</span></label>
                  <input class="field-input" type="date" formControlName="due_date">
                </div>
              </div>

              <div class="form-row">
                <div class="field-group flex-1">
                  <label class="field-label">Discount per invoice (₹) <span class="hint">— optional</span></label>
                  <div class="amt-wrap">
                    <span class="amt-prefix">₹</span>
                    <input class="field-input amt-input" type="number" formControlName="discount"
                           placeholder="0" min="0">
                  </div>
                </div>
              </div>
            </div>

            <!-- Estimate -->
            <div class="estimate-box">
              <div class="eb-row">
                <span>Students to invoice</span>
                <strong>~{{ estimatedCount() }}</strong>
              </div>
              <div class="eb-row">
                <span>Amount per student</span>
                <strong>₹{{ mandatoryTotal() - (+(form.value.discount ?? 0)) | number }}</strong>
              </div>
              <div class="eb-row total">
                <span>Estimated total revenue</span>
                <strong>₹{{ estimatedRevenue() | number }}</strong>
              </div>
            </div>
          }

        </form>
      </div>

      @if (error()) {
        <div class="error-banner-footer">
          <mat-icon style="font-size:15px;width:15px;height:15px;flex-shrink:0">error_outline</mat-icon>
          {{ error() }}
        </div>
      }

      <div class="dialog-footer">
        <button class="btn-ghost" mat-dialog-close>Cancel</button>
        <button class="btn-primary" (click)="submit()"
                [disabled]="!canSubmit() || submitting()">
          @if (submitting()) {
            <mat-progress-spinner diameter="16" mode="indeterminate"
              style="--mdc-circular-progress-active-indicator-color:#fff" />
          } @else {
            <ng-container>
              <mat-icon style="font-size:15px;width:15px;height:15px">auto_awesome</mat-icon>
              Generate {{ estimatedCount() > 0 ? estimatedCount() + ' ' : '' }}Invoices
            </ng-container>
          }
        </button>
      </div>
    </div>
  `,
  styles: [`
    .dialog-shell { width: 540px; display: flex; flex-direction: column; max-height: 90vh; }

    .dialog-header {
      display: flex; align-items: center; gap: 12px;
      padding: 20px 24px 16px; border-bottom: 1px solid var(--border); flex-shrink: 0;
    }
    .dh-icon {
      width: 36px; height: 36px; border-radius: 9px;
      background: linear-gradient(135deg, var(--blue-light), var(--purple-light));
      color: var(--blue); display: flex; align-items: center; justify-content: center; flex-shrink: 0;
      mat-icon { font-size: 18px; width: 18px; height: 18px; }
    }
    .dh-title { font-size: 15px; font-weight: 600; color: var(--text); }
    .dh-sub   { font-size: 11px; color: var(--text-3); margin-top: 2px; }
    .dh-close {
      margin-left: auto; background: none; border: none;
      width: 28px; height: 28px; border-radius: 6px; cursor: pointer; color: var(--text-3);
      display: flex; align-items: center; justify-content: center;
      &:hover { background: var(--bg); }
      mat-icon { font-size: 18px; width: 18px; height: 18px; }
    }

    .dialog-body { flex: 1; overflow-y: auto; padding: 16px 24px; display: flex; flex-direction: column; gap: 12px; }

    .info-banner {
      display: flex; align-items: flex-start; gap: 8px;
      background: var(--blue-light); border-radius: 8px;
      padding: 10px 12px; font-size: 12px; color: #1E40AF; line-height: 1.5;
    }

    .bulk-form { display: flex; flex-direction: column; gap: 12px; }

    /* Section blocks */
    .section-block {
      border: 1px solid var(--border); border-radius: 10px;
      overflow: hidden; background: var(--surface);
    }
    .sb-label {
      display: flex; align-items: center; gap: 8px;
      padding: 10px 14px; background: var(--bg);
      border-bottom: 1px solid var(--border);
      font-size: 12px; font-weight: 600; color: var(--text-2);
    }
    .sb-num {
      width: 20px; height: 20px; border-radius: 50%;
      background: var(--blue); color: #fff;
      font-size: 11px; font-weight: 700;
      display: flex; align-items: center; justify-content: center; flex-shrink: 0;
    }
    .req { color: var(--red); }
    .scope-note {
      font-size: 10px; font-weight: 400; color: var(--amber);
      background: var(--amber-light); padding: 2px 7px; border-radius: 4px; margin-left: 4px;
    }
    .section-block > select, .section-block > .field-group,
    .section-block > .warn-box, .section-block > .scope-info,
    .section-block > .scope-options, .section-block > .structure-preview,
    .section-block > .form-row { padding: 12px 14px; }
    .section-block > .form-row + .form-row { padding-top: 0; }

    /* Fields */
    .form-row    { display: flex; gap: 10px; }
    .flex-1      { flex: 1; min-width: 0; }
    .field-group { display: flex; flex-direction: column; gap: 5px; }
    .field-label {
      font-size: 12px; font-weight: 500; color: var(--text-2);
      .hint { font-size: 11px; color: var(--text-4); font-weight: 400; }
    }
    .field-input {
      height: 34px; padding: 0 9px; width: 100%;
      background: #fff; border: 1px solid var(--border);
      border-radius: 7px; font-size: 13px; color: var(--text);
      outline: none; font-family: inherit;
      &::placeholder { color: var(--text-4); }
      &:focus { border-color: var(--blue); box-shadow: 0 0 0 2px rgba(37,99,235,.1); }
    }
    select.field-input { cursor: pointer; }

    .warn-box {
      display: flex; align-items: center; gap: 8px;
      background: var(--amber-light); color: #92400E;
      padding: 10px 14px; font-size: 12.5px; border-radius: 0;
    }
    .scope-info {
      display: flex; align-items: center; gap: 6px;
      font-size: 12px; color: #92400E; background: var(--amber-light);
      padding: 8px 14px; border-bottom: 1px solid var(--border);
    }

    /* Structure preview */
    .structure-preview { border-top: 1px solid var(--border-light); }
    .sp-row { display: flex; justify-content: space-between; font-size: 12px; color: var(--text-2); padding: 3px 0; }
    .sp-optional { font-size: 11px; color: var(--text-4); padding: 4px 0; }
    .sp-total {
      display: flex; justify-content: space-between;
      font-size: 13px; font-weight: 600; color: var(--text);
      margin-top: 6px; padding-top: 6px; border-top: 1px solid var(--border-light);
      span:last-child { color: var(--blue); }
    }

    /* Scope cards (all-students structures) */
    .scope-options { display: flex; flex-direction: column; gap: 6px; }
    .scope-card {
      display: flex; align-items: center; gap: 10px;
      padding: 10px 12px; border: 1.5px solid var(--border);
      border-radius: 9px; cursor: pointer; transition: all .12s; background: #fff;
      &:hover    { border-color: var(--blue); background: var(--blue-light); }
      &.selected { border-color: var(--blue); background: var(--blue-light); }
    }
    .sc-icon {
      width: 32px; height: 32px; border-radius: 8px;
      background: var(--purple-light); color: var(--purple);
      display: flex; align-items: center; justify-content: center;
      flex-shrink: 0; font-size: 13px; font-weight: 700;
      mat-icon { font-size: 18px; width: 18px; height: 18px; }
      &.class { background: var(--blue-light); color: var(--blue); }
    }
    .sc-text { flex: 1; min-width: 0; }
    .sc-title { font-size: 13px; font-weight: 500; color: var(--text); }
    .sc-sub   { font-size: 11px; color: var(--text-3); margin-top: 1px; }
    .sc-check { color: var(--blue); font-size: 18px; width: 18px; height: 18px; flex-shrink: 0; }

    /* Billing period */
    .bp-wrap { display: flex; gap: 6px; }
    .bp-type { width: 130px; flex-shrink: 0; }
    .bp-val  { flex: 1; }

    .amt-wrap   { display: flex; align-items: center; }
    .amt-prefix {
      height: 34px; padding: 0 8px;
      background: var(--bg); border: 1px solid var(--border); border-right: none;
      border-radius: 7px 0 0 7px; font-size: 13px; color: var(--text-3);
      display: flex; align-items: center; flex-shrink: 0;
    }
    .amt-input { border-radius: 0 7px 7px 0 !important; }

    /* Estimate */
    .estimate-box {
      background: linear-gradient(135deg, #EFF6FF, #F5F3FF);
      border: 1px solid var(--blue-mid); border-radius: 10px;
      padding: 12px 14px; display: flex; flex-direction: column; gap: 6px;
    }
    .eb-row {
      display: flex; justify-content: space-between;
      font-size: 12.5px; color: var(--text-2);
      &.total {
        font-size: 14px; font-weight: 700; color: var(--text);
        padding-top: 6px; border-top: 1px solid var(--blue-mid);
        strong { color: var(--blue); }
      }
    }

    .error-banner-footer {
      display: flex; align-items: center; gap: 8px;
      background: var(--red-light); border-top: 1px solid #FECACA; border-bottom: 1px solid #FECACA;
      color: #991B1B; padding: 10px 24px; font-size: 12.5px; flex-shrink: 0;
    }

    .dialog-footer {
      display: flex; justify-content: flex-end; gap: 8px;
      padding: 14px 24px; border-top: 1px solid var(--border); background: var(--bg); flex-shrink: 0;
    }
    .btn-ghost {
      background: none; border: none; cursor: pointer;
      font-size: 13px; color: var(--text-3); padding: 0 10px; height: 36px; border-radius: 7px;
      &:hover { background: var(--border-light); }
    }
    .btn-primary {
      display: flex; align-items: center; gap: 6px;
      background: var(--blue); color: #fff;
      border: none; border-radius: 8px; height: 36px; padding: 0 18px;
      font-size: 13px; font-weight: 500; cursor: pointer;
      &:hover:not(:disabled) { background: #1D4ED8; }
      &:disabled { opacity: .6; cursor: not-allowed; }
    }
  `],
})
export class BulkInvoiceDialogComponent implements OnInit {
  private fb        = inject(FormBuilder);
  private api       = inject(ApiService);
  private dialogRef = inject(MatDialogRef<BulkInvoiceDialogComponent>);

  feeStructures     = signal<FeeStructure[]>([]);
  classes           = signal<SchoolClass[]>([]);
  selectedStructure = signal<FeeStructure | null>(null);
  billingType       = signal('monthly');
  submitting        = signal(false);
  error             = signal('');

  // Derived from selected structure
  mandatoryHeads = computed(() =>
    (this.selectedStructure()?.heads ?? []).filter((h: any) => !h.is_optional)
  );
  optionalHeads = computed(() =>
    (this.selectedStructure()?.heads ?? []).filter((h: any) => h.is_optional)
  );
  mandatoryTotal = computed(() =>
    this.mandatoryHeads().reduce((s: number, h: any) => s + (+h.amount || 0), 0)
  );

  // Classes assigned to the selected class-specific structure
  assignedClasses = computed(() => {
    const fs = this.selectedStructure();
    if (!fs || fs.applies_to !== 'class') return [];
    return this.classes().filter(c => (fs.class_ids ?? []).includes(c.id));
  });

  totalStudents = computed(() =>
    this.classes().reduce((s, c) => s + (c.enrolled_count ?? 0), 0)
  );

  months = (() => {
    const year = new Date().getFullYear();
    const names = ['January','February','March','April','May','June',
                   'July','August','September','October','November','December'];
    const result = [];
    for (const y of [year - 1, year, year + 1])
      for (let m = 0; m < 12; m++)
        result.push({ value: `${names[m]} ${y}`, label: `${names[m]} ${y}` });
    return result;
  })();

  quarters = (() => {
    const y = new Date().getFullYear();
    const result = [];
    for (const yr of [y - 1, y, y + 1])
      result.push(
        { value: `Q1 ${yr} (Jan–Mar)`, label: `Q1 ${yr} — Jan–Mar` },
        { value: `Q2 ${yr} (Apr–Jun)`, label: `Q2 ${yr} — Apr–Jun` },
        { value: `Q3 ${yr} (Jul–Sep)`, label: `Q3 ${yr} — Jul–Sep` },
        { value: `Q4 ${yr} (Oct–Dec)`, label: `Q4 ${yr} — Oct–Dec` },
      );
    return result;
  })();

  halfYears = (() => {
    const y = new Date().getFullYear();
    const result = [];
    for (const yr of [y - 1, y, y + 1])
      result.push(
        { value: `H1 ${yr} (Jan–Jun)`, label: `H1 ${yr} — Jan–Jun` },
        { value: `H2 ${yr} (Jul–Dec)`, label: `H2 ${yr} — Jul–Dec` },
      );
    return result;
  })();

  form = this.fb.group({
    fee_structure_id: ['', Validators.required],
    class_id:         [''],
    billing_period:   [this.defaultBillingPeriod(), Validators.required],
    due_date:         [this.defaultDueDate(), Validators.required],
    discount:         [0],
  });

  ngOnInit() {
    this.api.get<any>('/fees/structures').subscribe({
      next: (res: any) => this.feeStructures.set(res.data ?? []),
    });
    this.api.get<any>('/students/classes').subscribe({
      next: (res: any) => this.classes.set(res.data ?? []),
    });
  }

  onStructureChange(id: string) {
    const fs = this.feeStructures().find(s => s.id === id) ?? null;
    this.selectedStructure.set(fs);
    // Reset class selection when structure changes
    this.form.patchValue({ class_id: '' });
    // Auto-select billing type based on structure cycle
    if (fs) {
      const cycle = fs.billing_cycle;
      if (cycle === 'monthly')    this.billingType.set('monthly');
      else if (cycle === 'quarterly')  this.billingType.set('quarterly');
      else if (cycle === 'half_yearly') this.billingType.set('half_yearly');
      else if (cycle === 'annually')   { this.billingType.set('annually'); this.form.patchValue({ billing_period: fs.academic_year }); }
      else if (cycle === 'one_time')   this.billingType.set('one_time');
    }
  }

  onBillingTypeChange(type: string) {
    this.billingType.set(type);
    if (type === 'monthly')      this.form.patchValue({ billing_period: this.defaultBillingPeriod() });
    else if (type === 'quarterly')    this.form.patchValue({ billing_period: this.quarters[0].value });
    else if (type === 'half_yearly')  this.form.patchValue({ billing_period: this.halfYears[0].value });
    else if (type === 'annually')     this.form.patchValue({ billing_period: '2025-2026' });
    else this.form.patchValue({ billing_period: '' });
  }

  getTotal(fs: FeeStructure): number {
    return (fs.heads ?? []).filter((h: any) => !h.is_optional).reduce((s: number, h: any) => s + (+h.amount || 0), 0);
  }

  estimatedCount(): number {
    const classId = this.form.value.class_id;
    if (classId) return this.classes().find(c => c.id === classId)?.enrolled_count ?? 0;
    return this.totalStudents();
  }

  estimatedRevenue(): number {
    const perStudent = this.mandatoryTotal() - (+(this.form.value.discount ?? 0));
    return perStudent * this.estimatedCount();
  }

  canSubmit(): boolean {
    if (!this.form.value.fee_structure_id) return false;
    if (!this.form.value.billing_period)   return false;
    if (!this.form.value.due_date)         return false;
    // Class-specific structure must have a class selected
    const fs = this.selectedStructure();
    if (fs?.applies_to === 'class' && !this.form.value.class_id) return false;
    return true;
  }

  defaultBillingPeriod(): string {
    const now = new Date();
    return now.toLocaleString('en-US', { month: 'long' }) + ' ' + now.getFullYear();
  }
  defaultDueDate(): string {
    const d = new Date(); d.setDate(d.getDate() + 15);
    return d.toISOString().slice(0, 10);
  }

  submit() {
    this.error.set('');
    if (!this.canSubmit()) return;
    this.submitting.set(true);

    const val = this.form.value;
    const payload: Record<string, unknown> = {
      fee_structure_id: val.fee_structure_id,
      billing_period:   val.billing_period,
      due_date:         val.due_date,
      discount:         +(val.discount ?? 0),
    };
    if (val.class_id) payload['class_id'] = val.class_id;

    this.api.post<any>('/fees/invoices/bulk', payload).subscribe({
      next: (res: any) => {
        this.submitting.set(false);
        this.dialogRef.close({ count: res.data?.count ?? res.count ?? '?' });
      },
      error: (err: any) => {
        this.submitting.set(false);
        this.error.set(err.error?.error?.message ?? 'Bulk generation failed. Please try again.');
      },
    });
  }
}
