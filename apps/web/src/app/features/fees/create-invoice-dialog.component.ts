import { Component, inject, signal, OnInit, computed } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators, FormArray } from '@angular/forms';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { DecimalPipe } from '@angular/common';
import { ApiService } from '../../core/services/api.service';
import type { Student, SchoolClass, FeeStructure, ApiResponse, PaginatedResponse } from '../../core/models';

@Component({
  selector: 'app-create-invoice-dialog',
  standalone: true,
  imports: [
    ReactiveFormsModule, MatDialogModule,
    MatButtonModule, MatIconModule,
    MatProgressSpinnerModule, DecimalPipe,
  ],
  template: `
    <div class="dialog-shell">

      <!-- Header -->
      <div class="dialog-header">
        <div class="dh-icon"><mat-icon>receipt_long</mat-icon></div>
        <div>
          <div class="dh-title">New Invoice</div>
          <div class="dh-sub">Create a fee invoice for a student</div>
        </div>
        <button class="dh-close" mat-dialog-close><mat-icon>close</mat-icon></button>
      </div>

      <!-- Step indicator -->
      <div class="step-track">
        <div class="step-node" [class.active]="true" [class.done]="!!form.value.student_id">
          <div class="sn-dot">
            @if (form.value.student_id) {
              <mat-icon style="font-size:12px;width:12px;height:12px">check</mat-icon>
            } @else { 1 }
          </div>
          <span>Student</span>
        </div>
        <div class="step-line" [class.done]="!!form.value.student_id"></div>
        <div class="step-node" [class.active]="!!form.value.student_id" [class.done]="hasValidItems()">
          <div class="sn-dot">
            @if (hasValidItems()) {
              <mat-icon style="font-size:12px;width:12px;height:12px">check</mat-icon>
            } @else { 2 }
          </div>
          <span>Fee Items</span>
        </div>
        <div class="step-line" [class.done]="hasValidItems()"></div>
        <div class="step-node" [class.active]="hasValidItems() && !!form.value.billing_period">
          <div class="sn-dot">3</div>
          <span>Review</span>
        </div>
      </div>

      <!-- Body -->
      <div class="dialog-body">
        <form [formGroup]="form" class="inv-form">

          <!-- Student selection -->
          <div class="section-block">
            <div class="sb-title"><mat-icon>person</mat-icon> Student</div>
            <div class="form-row">
              <div class="field-group" style="width:160px;flex-shrink:0">
                <label class="field-label">Filter by Class</label>
                <select class="field-input" [value]="selectedClass()"
                        (change)="onClassChange($any($event.target).value)">
                  <option value="">All Classes</option>
                  @for (cls of classes(); track cls.id) {
                    <option [value]="cls.id">{{ cls.name }}</option>
                  }
                </select>
              </div>
              <div class="field-group flex-1">
                <label class="field-label">Student <span class="req">*</span></label>
                @if (studentsLoading()) {
                  <div class="field-input loading-input">
                    <mat-progress-spinner diameter="14" mode="indeterminate" />
                    Loading students…
                  </div>
                } @else {
                  <select class="field-input" formControlName="student_id"
                          [class.err]="form.get('student_id')?.invalid && form.get('student_id')?.touched">
                    <option value="">— Select student ({{ students().length }} available) —</option>
                    @for (s of students(); track s.id) {
                      <option [value]="s.id">
                        {{ s.first_name }} {{ s.last_name }} · {{ s.admission_no }}
                        @if (s.class_name) { ({{ s.class_name }}) }
                      </option>
                    }
                  </select>
                }
              </div>
            </div>
          </div>

          <!-- Invoice details -->
          <div class="section-block">
            <div class="sb-title"><mat-icon>receipt</mat-icon> Invoice Details</div>

            <div class="form-row">
              <div class="field-group flex-1">
                <label class="field-label">Billing Period <span class="req">*</span></label>
                <div class="billing-period-wrap">
                  <select class="field-input bp-type" [value]="billingType()"
                          (change)="onBillingTypeChange($any($event.target).value)">
                    <option value="monthly">Monthly</option>
                    <option value="quarterly">Quarterly</option>
                    <option value="half_yearly">Half-Yearly</option>
                    <option value="annually">Annual</option>
                    <option value="custom">Custom</option>
                  </select>
                  @if (billingType() === 'monthly') {
                    <select class="field-input bp-value" formControlName="billing_period">
                      @for (m of months; track m.value) {
                        <option [value]="m.value">{{ m.label }}</option>
                      }
                    </select>
                  } @else if (billingType() === 'quarterly') {
                    <select class="field-input bp-value" formControlName="billing_period">
                      @for (q of quarters; track q.value) {
                        <option [value]="q.value">{{ q.label }}</option>
                      }
                    </select>
                  } @else if (billingType() === 'half_yearly') {
                    <select class="field-input bp-value" formControlName="billing_period">
                      @for (h of halfYears; track h.value) {
                        <option [value]="h.value">{{ h.label }}</option>
                      }
                    </select>
                  } @else if (billingType() === 'annually') {
                    <select class="field-input bp-value" formControlName="billing_period">
                      <option value="2024-2025">2024–2025</option>
                      <option value="2025-2026">2025–2026</option>
                      <option value="2026-2027">2026–2027</option>
                    </select>
                  } @else {
                    <input class="field-input bp-value" formControlName="billing_period"
                           placeholder="e.g. Special Fee June 2026">
                  }
                </div>
              </div>
              <div class="field-group" style="width:160px;flex-shrink:0">
                <label class="field-label">Due Date <span class="req">*</span></label>
                <input class="field-input" type="date" formControlName="due_date">
              </div>
            </div>
          </div>

          <!-- Fee structure quick-fill -->
          @if (feeStructures().length) {
            <div class="section-block">
              <div class="sb-title">
                <mat-icon>auto_fix_high</mat-icon> Quick Fill from Fee Structure
                <span class="optional-tag">optional</span>
              </div>
              <select class="field-input" style="width:100%" [value]="selectedStructure()"
                      (change)="onStructureChange($any($event.target).value)">
                <option value="">— Choose a fee structure to auto-fill items —</option>
                @for (fs of feeStructures(); track fs.id) {
                  <option [value]="fs.id">{{ fs.name }} · {{ fs.billing_cycle }}</option>
                }
              </select>
            </div>
          }

          <!-- Line items -->
          <div class="section-block">
            <div class="sb-title">
              <mat-icon>list</mat-icon> Fee Items <span class="req">*</span>
            </div>

            <div formArrayName="line_items" class="line-items">
              <div class="li-header">
                <span class="li-name-col">Item Name</span>
                <span class="li-amt-col">Amount (₹)</span>
                <span class="li-del-col"></span>
              </div>
              @for (item of lineItems.controls; track $index) {
                <div [formGroupName]="$index" class="li-row">
                  <input class="field-input li-name-col" formControlName="name"
                         placeholder="e.g. Tuition Fee">
                  <div class="li-amt-wrap li-amt-col">
                    <span class="amt-prefix">₹</span>
                    <input class="field-input amt-input" type="number" formControlName="amount"
                           placeholder="0" min="0">
                  </div>
                  <button type="button" class="li-del li-del-col" (click)="removeItem($index)"
                          [disabled]="lineItems.length === 1">
                    <mat-icon style="font-size:16px;width:16px;height:16px">delete</mat-icon>
                  </button>
                </div>
              }
            </div>

            <button type="button" class="add-item-btn" (click)="addItem()">
              <mat-icon style="font-size:16px;width:16px;height:16px">add_circle_outline</mat-icon>
              Add Fee Item
            </button>
          </div>

          <!-- Discount / Tax -->
          <div class="section-block">
            <div class="sb-title"><mat-icon>calculate</mat-icon> Adjustments <span class="optional-tag">optional</span></div>
            <div class="form-row">
              <div class="field-group flex-1">
                <label class="field-label">Discount (₹)</label>
                <div class="li-amt-wrap">
                  <span class="amt-prefix">₹</span>
                  <input class="field-input amt-input" type="number" formControlName="discount" placeholder="0" min="0">
                </div>
              </div>
              <div class="field-group flex-1">
                <label class="field-label">Tax (₹)</label>
                <div class="li-amt-wrap">
                  <span class="amt-prefix">₹</span>
                  <input class="field-input amt-input" type="number" formControlName="tax" placeholder="0" min="0">
                </div>
              </div>
            </div>
          </div>

          <!-- Total preview -->
          <div class="total-preview">
            <div class="tp-row"><span>Subtotal</span><span>₹{{ subtotal() | number }}</span></div>
            @if ((form.value.discount ?? 0) > 0) {
              <div class="tp-row discount"><span>Discount</span><span>−₹{{ form.value.discount | number }}</span></div>
            }
            @if ((form.value.tax ?? 0) > 0) {
              <div class="tp-row"><span>Tax</span><span>+₹{{ form.value.tax | number }}</span></div>
            }
            <div class="tp-divider"></div>
            <div class="tp-row total"><span>Total Payable</span><span>₹{{ grandTotal() | number }}</span></div>
          </div>

          @if (error()) {
            <div class="error-banner">
              <mat-icon style="font-size:15px;width:15px;height:15px;flex-shrink:0">error_outline</mat-icon>
              {{ error() }}
            </div>
          }
        </form>
      </div>

      <!-- Footer -->
      <div class="dialog-footer">
        <button class="btn-ghost" mat-dialog-close>Cancel</button>
        <button class="btn-primary" (click)="submit()" [disabled]="form.invalid || !hasValidItems() || submitting()">
          @if (submitting()) {
            <mat-progress-spinner diameter="16" mode="indeterminate"
              style="--mdc-circular-progress-active-indicator-color:#fff" />
          } @else {
            <ng-container>
              <mat-icon style="font-size:15px;width:15px;height:15px">receipt_long</mat-icon>
              Create Invoice
            </ng-container>
          }
        </button>
      </div>
    </div>
  `,
  styles: [`
    .dialog-shell { width: 580px; display: flex; flex-direction: column; max-height: 90vh; }

    .dialog-header {
      display: flex; align-items: center; gap: 12px;
      padding: 20px 24px 16px; border-bottom: 1px solid var(--border); flex-shrink: 0;
    }
    .dh-icon {
      width: 36px; height: 36px; border-radius: 9px;
      background: var(--amber-light); color: var(--amber);
      display: flex; align-items: center; justify-content: center; flex-shrink: 0;
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

    /* Step track */
    .step-track {
      display: flex; align-items: center; padding: 12px 24px;
      background: var(--bg); border-bottom: 1px solid var(--border); flex-shrink: 0;
    }
    .step-node {
      display: flex; align-items: center; gap: 6px;
      font-size: 11px; font-weight: 500; color: var(--text-4);
      .sn-dot {
        width: 20px; height: 20px; border-radius: 50%;
        border: 1.5px solid var(--border); background: #fff;
        color: var(--text-4); font-size: 10px; font-weight: 600;
        display: flex; align-items: center; justify-content: center; flex-shrink: 0;
      }
      &.active { color: var(--blue); .sn-dot { border-color: var(--blue); color: var(--blue); } }
      &.done   { color: var(--green); .sn-dot { background: var(--green); border-color: var(--green); color: #fff; } }
    }
    .step-line { flex: 1; height: 1.5px; background: var(--border); margin: 0 8px; &.done { background: var(--green); } }

    .dialog-body { flex: 1; overflow-y: auto; padding: 16px 24px; }
    .inv-form    { display: flex; flex-direction: column; gap: 14px; }

    .section-block {
      background: var(--bg); border-radius: 9px; padding: 14px;
      display: flex; flex-direction: column; gap: 10px;
    }
    .sb-title {
      display: flex; align-items: center; gap: 6px;
      font-size: 12px; font-weight: 600; color: var(--text-2);
      mat-icon { font-size: 15px; width: 15px; height: 15px; color: var(--blue); }
    }
    .optional-tag {
      font-size: 10px; font-weight: 400; color: var(--text-4);
      background: var(--border-light); padding: 1px 6px; border-radius: 4px; margin-left: 4px;
    }

    .form-row    { display: flex; gap: 10px; }
    .flex-1      { flex: 1; min-width: 0; }
    .field-group { display: flex; flex-direction: column; gap: 4px; }
    .field-label {
      font-size: 11px; font-weight: 500; color: var(--text-3);
      .req { color: var(--red); }
    }
    .field-input {
      height: 34px; padding: 0 9px;
      background: #fff; border: 1px solid var(--border);
      border-radius: 7px; font-size: 13px; color: var(--text);
      outline: none; font-family: inherit; width: 100%;
      &::placeholder { color: var(--text-4); }
      &:focus { border-color: var(--blue); box-shadow: 0 0 0 2px rgba(37,99,235,.1); }
      &.err { border-color: var(--red); }
    }
    select.field-input { cursor: pointer; }
    .loading-input {
      display: flex; align-items: center; gap: 8px;
      color: var(--text-3); font-size: 12px; background: var(--bg);
    }

    /* Billing period */
    .billing-period-wrap { display: flex; gap: 6px; }
    .bp-type  { width: 130px; flex-shrink: 0; }
    .bp-value { flex: 1; }

    /* Line items */
    .line-items  { display: flex; flex-direction: column; gap: 6px; }
    .li-header   {
      display: flex; gap: 8px;
      font-size: 10px; font-weight: 600; text-transform: uppercase;
      letter-spacing: .3px; color: var(--text-4); padding: 0 2px;
    }
    .li-row      { display: flex; gap: 8px; align-items: center; }
    .li-name-col { flex: 1; min-width: 0; }
    .li-amt-col  { width: 130px; flex-shrink: 0; }
    .li-del-col  { width: 30px; flex-shrink: 0; }

    .li-amt-wrap { display: flex; align-items: center; }
    .amt-prefix  {
      height: 34px; padding: 0 8px;
      background: var(--bg); border: 1px solid var(--border); border-right: none;
      border-radius: 7px 0 0 7px; font-size: 13px; color: var(--text-3);
      display: flex; align-items: center; flex-shrink: 0;
    }
    .amt-input   { border-radius: 0 7px 7px 0 !important; text-align: right; }
    .li-del {
      width: 30px; height: 34px; border-radius: 7px;
      background: none; border: 1px solid var(--border);
      cursor: pointer; color: var(--red);
      display: flex; align-items: center; justify-content: center;
      &:hover:not(:disabled) { background: var(--red-light); }
      &:disabled { opacity: .4; cursor: not-allowed; }
    }
    .add-item-btn {
      display: flex; align-items: center; gap: 6px;
      background: none; border: 1px dashed #D1D5DB;
      border-radius: 8px; width: 100%; padding: 8px;
      font-size: 12.5px; color: var(--blue); cursor: pointer;
      justify-content: center; font-weight: 500;
      &:hover { background: var(--blue-light); border-color: var(--blue-mid); }
    }

    /* Total */
    .total-preview {
      background: #fff; border: 1px solid var(--border);
      border-radius: 9px; padding: 12px 14px;
      display: flex; flex-direction: column; gap: 8px;
    }
    .tp-row {
      display: flex; justify-content: space-between;
      font-size: 13px; color: var(--text-2);
      &.discount { color: var(--green); }
      &.total { font-size: 15px; font-weight: 700; color: var(--text); span:last-child { color: var(--blue); } }
    }
    .tp-divider { height: 1px; background: var(--border); }

    .error-banner {
      display: flex; align-items: center; gap: 8px;
      background: var(--red-light); border: 1px solid #FECACA;
      color: #991B1B; padding: 10px 12px; border-radius: 8px; font-size: 12.5px;
    }

    .dialog-footer {
      display: flex; justify-content: flex-end; gap: 8px;
      padding: 14px 24px; border-top: 1px solid var(--border);
      background: var(--bg); flex-shrink: 0;
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
export class CreateInvoiceDialogComponent implements OnInit {
  private fb        = inject(FormBuilder);
  private api       = inject(ApiService);
  private dialogRef = inject(MatDialogRef<CreateInvoiceDialogComponent>);

  classes           = signal<SchoolClass[]>([]);
  students          = signal<Student[]>([]);
  feeStructures     = signal<FeeStructure[]>([]);
  studentsLoading   = signal(false);
  selectedClass     = signal('');
  selectedStructure = signal('');
  billingType       = signal('monthly');
  submitting        = signal(false);
  error             = signal('');

  // Billing period options
  months = (() => {
    const year = new Date().getFullYear();
    const names = ['January','February','March','April','May','June',
                   'July','August','September','October','November','December'];
    const result = [];
    // Current year and next year months
    for (const y of [year - 1, year, year + 1]) {
      for (let m = 0; m < 12; m++) {
        result.push({ value: `${names[m]} ${y}`, label: `${names[m]} ${y}` });
      }
    }
    return result;
  })();

  quarters = (() => {
    const year = new Date().getFullYear();
    const result = [];
    for (const y of [year - 1, year, year + 1]) {
      result.push(
        { value: `Q1 ${y} (Jan–Mar)`,  label: `Q1 ${y} — Jan–Mar` },
        { value: `Q2 ${y} (Apr–Jun)`,  label: `Q2 ${y} — Apr–Jun` },
        { value: `Q3 ${y} (Jul–Sep)`,  label: `Q3 ${y} — Jul–Sep` },
        { value: `Q4 ${y} (Oct–Dec)`,  label: `Q4 ${y} — Oct–Dec` },
      );
    }
    return result;
  })();

  halfYears = (() => {
    const year = new Date().getFullYear();
    const result = [];
    for (const y of [year - 1, year, year + 1]) {
      result.push(
        { value: `H1 ${y} (Jan–Jun)`, label: `H1 ${y} — Jan–Jun` },
        { value: `H2 ${y} (Jul–Dec)`, label: `H2 ${y} — Jul–Dec` },
      );
    }
    return result;
  })();

  form = this.fb.group({
    student_id:     ['', Validators.required],
    billing_period: [this.defaultBillingPeriod(), Validators.required],
    due_date:       [this.defaultDueDate(), Validators.required],
    discount:       [0],
    tax:            [0],
    line_items:     this.fb.array([this.newLineItem()]),
  });

  get lineItems(): FormArray { return this.form.get('line_items') as FormArray; }

  hasValidItems(): boolean {
    return this.lineItems.controls.some(c => c.value.name && +c.value.amount > 0);
  }

  ngOnInit() {
    this.api.get<any>('/students/classes').subscribe({
      next: (res: any) => this.classes.set(res.data ?? []),
    });
    this.loadStudents('');
    this.api.get<any>('/fees/structures').subscribe({
      next: (res: any) => this.feeStructures.set(res.data ?? []),
      error: () => {},
    });
  }

  loadStudents(classId: string) {
    this.studentsLoading.set(true);
    const params: Record<string, string> = { limit: '500', page: '1', is_active: 'true' };
    if (classId) params['class_id'] = classId;
    this.api.get<any>('/students', params).subscribe({
      next: (res: any) => { this.students.set(res.data ?? []); this.studentsLoading.set(false); },
      error: () => this.studentsLoading.set(false),
    });
  }

  onClassChange(classId: string) {
    this.selectedClass.set(classId);
    this.form.patchValue({ student_id: '' });
    this.loadStudents(classId);
  }

  onBillingTypeChange(type: string) {
    this.billingType.set(type);
    // Set default value for the new type
    if (type === 'monthly')     this.form.patchValue({ billing_period: this.defaultBillingPeriod() });
    else if (type === 'quarterly')  this.form.patchValue({ billing_period: this.quarters[0].value });
    else if (type === 'half_yearly') this.form.patchValue({ billing_period: this.halfYears[0].value });
    else if (type === 'annually') this.form.patchValue({ billing_period: '2025-2026' });
    else this.form.patchValue({ billing_period: '' });
  }

  onStructureChange(structureId: string) {
    this.selectedStructure.set(structureId);
    if (!structureId) return;
    const structure = this.feeStructures().find(s => s.id === structureId);
    if (!structure) return;
    while (this.lineItems.length) this.lineItems.removeAt(0);
    (structure.heads ?? []).forEach((head: any) => {
      this.lineItems.push(this.fb.group({
        name:   [head.name, Validators.required],
        amount: [head.amount, [Validators.required, Validators.min(0)]],
      }));
    });
  }

  newLineItem() {
    return this.fb.group({
      name:   ['', Validators.required],
      amount: [0, [Validators.required, Validators.min(0)]],
    });
  }

  addItem()             { this.lineItems.push(this.newLineItem()); }
  removeItem(i: number) { this.lineItems.removeAt(i); }

  subtotal(): number {
    return this.lineItems.controls.reduce((sum, c) => sum + (+c.value.amount || 0), 0);
  }
  grandTotal(): number {
    return this.subtotal() - (+(this.form.value.discount ?? 0)) + (+(this.form.value.tax ?? 0));
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
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    if (!this.hasValidItems()) { this.error.set('Add at least one fee item with a name and amount'); return; }
    if (this.grandTotal() <= 0) { this.error.set('Total amount must be greater than zero'); return; }

    this.submitting.set(true);
    this.error.set('');

    const val = this.form.value;
    const payload = {
      student_id:     val.student_id,
      billing_period: val.billing_period,
      due_date:       val.due_date,
      discount:       +(val.discount ?? 0),
      tax:            +(val.tax ?? 0),
      line_items:     (val.line_items ?? [])
        .filter((i: any) => i.name && +i.amount > 0)
        .map((i: any) => ({ name: i.name, amount: +i.amount })),
    };

    this.api.post<any>('/fees/invoices', payload).subscribe({
      next: (res: any) => { this.submitting.set(false); this.dialogRef.close(res.data); },
      error: (err: any) => {
        this.submitting.set(false);
        this.error.set(err.error?.error?.message ?? 'Failed to create invoice. Please try again.');
      },
    });
  }
}
