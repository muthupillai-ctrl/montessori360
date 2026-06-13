import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { DecimalPipe, DatePipe } from '@angular/common';
import { ApiService } from '../../core/services/api.service';
import type { FeeInvoice } from '../../core/models';

const METHODS = [
  { value: 'cash',          label: 'Cash',               icon: 'payments' },
  { value: 'bank_transfer', label: 'Bank Transfer / NEFT', icon: 'account_balance' },
  { value: 'cheque',        label: 'Cheque',             icon: 'receipt_long' },
  { value: 'razorpay',      label: 'UPI / Card / Razorpay', icon: 'credit_card' },
];

@Component({
  selector: 'app-record-payment-dialog',
  standalone: true,
  imports: [
    ReactiveFormsModule, MatDialogModule,
    MatButtonModule, MatIconModule,
    MatProgressSpinnerModule, DecimalPipe, DatePipe,
  ],
  template: `
    <div class="dialog-shell">

      <!-- Header -->
      <div class="dialog-header">
        <div class="dh-icon"><mat-icon>payment</mat-icon></div>
        <div>
          <div class="dh-title">Record Payment</div>
          <div class="dh-sub">{{ invoice.invoice_no }} · {{ invoice.student_name }}</div>
        </div>
        <button class="dh-close" mat-dialog-close><mat-icon>close</mat-icon></button>
      </div>

      <div class="dialog-body">

        <!-- Invoice summary strip -->
        <div class="invoice-strip">
          <div class="is-item">
            <div class="is-label">Invoice Total</div>
            <div class="is-value">₹{{ invoice.total | number }}</div>
          </div>
          <div class="is-divider"></div>
          <div class="is-item">
            <div class="is-label">Already Paid</div>
            <div class="is-value paid">₹{{ invoice.paid_amount | number }}</div>
          </div>
          <div class="is-divider"></div>
          <div class="is-item">
            <div class="is-label">Balance Due</div>
            <div class="is-value due">₹{{ balance() | number }}</div>
          </div>
          <div class="is-divider"></div>
          <div class="is-item">
            <div class="is-label">Due Date</div>
            <div class="is-value" [style.color]="isPastDue() ? 'var(--red)' : 'var(--text)'">
              {{ invoice.due_date | date:'d MMM yyyy' }}
              @if (isPastDue()) { <span class="overdue-tag">Overdue</span> }
            </div>
          </div>
        </div>

        <!-- Amount input -->
        <form [formGroup]="form" class="pay-form">

          <div class="field-group">
            <label class="field-label">Payment Amount <span class="req">*</span></label>
            <div class="amount-input-wrap">
              <span class="currency-prefix">₹</span>
              <input class="amount-input" type="number"
                     formControlName="amount"
                     [placeholder]="balance().toString()"
                     min="0.01" [max]="balance()"
                     (input)="onAmountInput()">
              <button type="button" class="full-btn" (click)="setFullAmount()">
                Pay Full
              </button>
            </div>
            @if (form.get('amount')?.hasError('min') && form.get('amount')?.touched) {
              <div class="field-error">Amount must be greater than 0</div>
            }
            @if (form.get('amount')?.hasError('max') && form.get('amount')?.touched) {
              <div class="field-error">Amount cannot exceed balance of ₹{{ balance() | number }}</div>
            }
          </div>

          <!-- Payment method -->
          <div class="field-group">
            <label class="field-label">Payment Method <span class="req">*</span></label>
            <div class="method-grid">
              @for (m of methods; track m.value) {
                <div class="method-card"
                     [class.selected]="form.value.method === m.value"
                     (click)="form.patchValue({ method: m.value })">
                  <mat-icon class="mc-icon">{{ m.icon }}</mat-icon>
                  <span class="mc-label">{{ m.label }}</span>
                </div>
              }
            </div>
          </div>

          <!-- Reference -->
          <div class="field-group">
            <label class="field-label">
              Reference No
              <span class="hint">— UTR / cheque no / transaction ID</span>
            </label>
            <input class="field-input" formControlName="reference_no"
                   placeholder="e.g. UTR123456789">
          </div>

          <!-- Notes -->
          <div class="field-group">
            <label class="field-label">Notes <span class="hint">— optional</span></label>
            <textarea class="field-input textarea" formControlName="notes"
                      rows="2" placeholder="Any additional notes…"></textarea>
          </div>

          <!-- Payment preview -->
          @if ((form.value.amount ?? 0) > 0) {
            <div class="payment-preview"
                 [class.full]="+(form.value.amount ?? 0) >= balance()"
                 [class.partial]="+(form.value.amount ?? 0) < balance()">
              <mat-icon class="pp-icon">
                {{ +(form.value.amount ?? 0) >= balance() ? 'check_circle' : 'pending' }}
              </mat-icon>
              <div class="pp-text">
                @if (+(form.value.amount ?? 0) >= balance()) {
                  This will mark the invoice as <strong>Paid in Full</strong>.
                } @else {
                  Partial payment of <strong>₹{{ form.value.amount | number }}</strong>.
                  Remaining: <strong>₹{{ balance() - +(form.value.amount ?? 0) | number }}</strong>
                }
              </div>
            </div>
          }

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
        <button class="btn-primary" (click)="submit()"
                [disabled]="form.invalid || submitting()">
          @if (submitting()) {
            <mat-progress-spinner diameter="16" mode="indeterminate"
              style="--mdc-circular-progress-active-indicator-color:#fff" />
          } @else {
            <ng-container>
              <mat-icon style="font-size:15px;width:15px;height:15px">check</mat-icon>
              Confirm Payment
            </ng-container>
          }
        </button>
      </div>
    </div>
  `,
  styles: [`
    .dialog-shell { width: 460px; display: flex; flex-direction: column; }

    /* Header */
    .dialog-header {
      display: flex; align-items: center; gap: 12px;
      padding: 20px 24px 16px; border-bottom: 1px solid var(--border); flex-shrink: 0;
    }
    .dh-icon {
      width: 36px; height: 36px; border-radius: 9px;
      background: var(--green-light); color: var(--green);
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

    /* Invoice strip */
    .invoice-strip {
      display: flex; align-items: center;
      background: var(--bg); border-bottom: 1px solid var(--border);
      padding: 14px 24px; gap: 0; flex-shrink: 0;
    }
    .is-item    { flex: 1; text-align: center; }
    .is-divider { width: 1px; height: 32px; background: var(--border); flex-shrink: 0; }
    .is-label   { font-size: 10px; text-transform: uppercase; letter-spacing: .3px; color: var(--text-4); font-weight: 500; margin-bottom: 4px; }
    .is-value   { font-size: 14px; font-weight: 600; color: var(--text); display: flex; align-items: center; justify-content: center; gap: 5px; }
    .is-value.paid { color: var(--green); }
    .is-value.due  { color: #DC2626; font-size: 16px; }
    .overdue-tag {
      font-size: 9px; font-weight: 600; background: var(--red-light); color: #991B1B;
      padding: 1px 5px; border-radius: 3px; text-transform: uppercase; letter-spacing: .2px;
    }

    /* Body */
    .dialog-body { padding: 20px 24px; overflow-y: auto; }
    .pay-form    { display: flex; flex-direction: column; gap: 16px; }
    .field-group { display: flex; flex-direction: column; gap: 5px; }
    .field-label {
      font-size: 12px; font-weight: 500; color: var(--text-2);
      .req  { color: var(--red); }
      .hint { font-size: 11px; color: var(--text-4); font-weight: 400; }
    }
    .field-error { font-size: 11px; color: var(--red); }

    /* Amount input */
    .amount-input-wrap {
      display: flex; align-items: center;
      border: 1.5px solid var(--border); border-radius: 9px; overflow: hidden;
      background: #fff;
      &:focus-within { border-color: var(--blue); box-shadow: 0 0 0 3px rgba(37,99,235,.1); }
    }
    .currency-prefix {
      padding: 0 12px; font-size: 18px; font-weight: 500;
      color: var(--text-3); background: var(--bg);
      border-right: 1px solid var(--border);
      height: 48px; display: flex; align-items: center; flex-shrink: 0;
    }
    .amount-input {
      flex: 1; height: 48px; padding: 0 12px;
      border: none; outline: none; font-size: 22px; font-weight: 600;
      color: var(--text); background: transparent; font-family: inherit;
      &::placeholder { color: var(--text-4); font-weight: 400; font-size: 18px; }
    }
    .full-btn {
      height: 48px; padding: 0 16px; background: none;
      border: none; border-left: 1px solid var(--border);
      font-size: 12px; font-weight: 600; color: var(--blue); cursor: pointer;
      flex-shrink: 0; white-space: nowrap;
      &:hover { background: var(--blue-light); }
    }

    /* Method grid */
    .method-grid {
      display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px;
    }
    .method-card {
      display: flex; align-items: center; gap: 10px;
      padding: 10px 12px; border: 1.5px solid var(--border);
      border-radius: 9px; cursor: pointer; transition: all .15s;
      background: #fff;
      &:hover { border-color: var(--blue); background: var(--blue-light); }
      &.selected { border-color: var(--blue); background: var(--blue-light); }
    }
    .mc-icon  {
      font-size: 18px; width: 18px; height: 18px; color: var(--text-3); flex-shrink: 0;
      .method-card.selected & { color: var(--blue); }
    }
    .mc-label { font-size: 12.5px; font-weight: 500; color: var(--text-2);
      .method-card.selected & { color: var(--blue); font-weight: 600; }
    }

    /* Other fields */
    .field-input {
      height: 36px; padding: 0 10px; width: 100%;
      background: #fff; border: 1px solid var(--border);
      border-radius: 7px; font-size: 13px; color: var(--text);
      outline: none; font-family: inherit;
      &::placeholder { color: var(--text-4); }
      &:focus { border-color: var(--blue); box-shadow: 0 0 0 2px rgba(37,99,235,.1); }
    }
    .textarea { height: auto; padding: 8px 10px; resize: vertical; }

    /* Payment preview */
    .payment-preview {
      display: flex; align-items: flex-start; gap: 10px;
      padding: 12px 14px; border-radius: 9px; font-size: 12.5px;
      &.full    { background: var(--green-light); color: #065F46; .pp-icon { color: var(--green); } }
      &.partial { background: var(--amber-light); color: #92400E; .pp-icon { color: var(--amber); } }
    }
    .pp-icon { font-size: 18px; width: 18px; height: 18px; flex-shrink: 0; margin-top: 1px; }
    .pp-text { line-height: 1.5; }

    .error-banner {
      display: flex; align-items: center; gap: 8px;
      background: var(--red-light); border: 1px solid #FECACA;
      color: #991B1B; padding: 10px 12px; border-radius: 8px; font-size: 12.5px;
    }

    /* Footer */
    .dialog-footer {
      display: flex; justify-content: flex-end; gap: 8px;
      padding: 14px 24px; border-top: 1px solid var(--border); background: var(--bg);
    }
    .btn-ghost {
      background: none; border: none; cursor: pointer;
      font-size: 13px; color: var(--text-3); padding: 0 10px; height: 36px; border-radius: 7px;
      &:hover { background: var(--border-light); }
    }
    .btn-primary {
      display: flex; align-items: center; gap: 6px;
      background: var(--green); color: #fff;
      border: none; border-radius: 8px; height: 36px; padding: 0 20px;
      font-size: 13px; font-weight: 500; cursor: pointer;
      &:hover:not(:disabled) { background: #059669; }
      &:disabled { opacity: .6; cursor: not-allowed; }
    }
  `],
})
export class RecordPaymentDialogComponent {
  private fb        = inject(FormBuilder);
  private api       = inject(ApiService);
  private dialogRef = inject(MatDialogRef<RecordPaymentDialogComponent>);

  invoice: FeeInvoice = inject(MAT_DIALOG_DATA);
  methods    = METHODS;
  submitting = signal(false);
  error      = signal('');

  balance = signal(Number(this.invoice.total) - Number(this.invoice.paid_amount));

  form = this.fb.nonNullable.group({
    amount:       [this.balance(), [
      Validators.required,
      Validators.min(0.01),
      Validators.max(this.balance()),
    ]],
    method:       ['cash', Validators.required],
    reference_no: [''],
    notes:        [''],
  });

  isPastDue(): boolean {
    return new Date(this.invoice.due_date) < new Date();
  }

  setFullAmount() {
    this.form.patchValue({ amount: this.balance() });
  }

  onAmountInput() {
    this.form.get('amount')!.setValidators([
      Validators.required,
      Validators.min(0.01),
      Validators.max(this.balance()),
    ]);
    this.form.get('amount')!.updateValueAndValidity();
  }

  submit() {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    this.submitting.set(true);
    this.error.set('');

    const body: Record<string, unknown> = {
      amount: +this.form.value.amount!,
      method: this.form.value.method,
    };
    if (this.form.value.reference_no) body['reference_no'] = this.form.value.reference_no;
    if (this.form.value.notes)        body['notes']        = this.form.value.notes;

    this.api.post<any>(`/fees/invoices/${this.invoice.id}/pay`, body).subscribe({
      next: (res: any) => { this.submitting.set(false); this.dialogRef.close(res.data); },
      error: (err: any) => {
        this.submitting.set(false);
        this.error.set(err.error?.error?.message ?? 'Payment failed. Please try again.');
      },
    });
  }
}
