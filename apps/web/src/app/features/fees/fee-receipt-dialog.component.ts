import { Component, inject, signal, OnInit } from '@angular/core';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { DecimalPipe, DatePipe, TitleCasePipe } from '@angular/common';
import { ApiService } from '../../core/services/api.service';
import { AuthService } from '../../core/services/auth.service';
import type { FeeInvoice } from '../../core/models';

@Component({
  selector: 'app-fee-receipt-dialog',
  standalone: true,
  imports: [
    MatDialogModule, MatButtonModule, MatIconModule,
    MatProgressSpinnerModule, DecimalPipe, DatePipe, TitleCasePipe,
  ],
  template: `
    <div class="dialog-shell">

      <!-- Header -->
      <div class="dialog-header">
        <div class="dh-icon"><mat-icon>receipt</mat-icon></div>
        <div>
          <div class="dh-title">Fee Receipt</div>
          <div class="dh-sub">{{ invoice.invoice_no }}</div>
        </div>
        <button class="dh-close" mat-dialog-close><mat-icon>close</mat-icon></button>
      </div>

      <!-- Receipt preview -->
      <div class="receipt-wrap" id="receipt-content">
        <div class="receipt">

          <!-- School header -->
          <div class="receipt-header">
            <div class="school-logo">{{ schoolInitials() }}</div>
            <div class="school-info">
              <div class="school-name">{{ schoolName() }}</div>
              <div class="school-sub">Fee Receipt</div>
            </div>
            @if (invoice.status === 'paid') {
              <div class="paid-stamp">PAID</div>
            }
          </div>

          <div class="receipt-divider"></div>

          <!-- Invoice meta -->
          <div class="receipt-meta">
            <div class="meta-row">
              <span class="meta-label">Receipt No</span>
              <span class="meta-value bold">{{ invoice.invoice_no }}</span>
            </div>
            <div class="meta-row">
              <span class="meta-label">Date</span>
              <span class="meta-value">{{ invoice.created_at | date:'d MMMM yyyy' }}</span>
            </div>
            <div class="meta-row">
              <span class="meta-label">Due Date</span>
              <span class="meta-value">{{ invoice.due_date | date:'d MMMM yyyy' }}</span>
            </div>
            <div class="meta-row">
              <span class="meta-label">Billing Period</span>
              <span class="meta-value">{{ invoice.billing_period }}</span>
            </div>
          </div>

          <div class="receipt-divider"></div>

          <!-- Student info -->
          <div class="student-section">
            <div class="section-label">Billed To</div>
            <div class="student-name">{{ invoice.student_name }}</div>
            <div class="student-meta">{{ invoice.class_name ?? 'Unassigned' }} · Adm: {{ invoice.admission_no }}</div>
          </div>

          <div class="receipt-divider"></div>

          <!-- Line items -->
          <div class="items-section">
            <div class="items-header">
              <span class="item-name-col">Description</span>
              <span class="item-amt-col">Amount</span>
            </div>
            @for (item of lineItems(); track item.name) {
              <div class="item-row">
                <span class="item-name-col">{{ item.name }}</span>
                <span class="item-amt-col">₹{{ item.amount | number:'1.2-2' }}</span>
              </div>
            }
          </div>

          <div class="receipt-divider"></div>

          <!-- Totals -->
          <div class="totals-section">
            <div class="total-row">
              <span>Subtotal</span>
              <span>₹{{ invoice.subtotal | number:'1.2-2' }}</span>
            </div>
            @if (+invoice.discount > 0) {
              <div class="total-row discount">
                <span>
                  Discount
                  @if (invoice.discount_note) {
                    <span class="discount-label">{{ invoice.discount_note }}</span>
                  }
                </span>
                <span>−₹{{ invoice.discount | number:'1.2-2' }}</span>
              </div>
            }
            @if (+invoice.tax > 0) {
              <div class="total-row">
                <span>Tax</span>
                <span>+₹{{ invoice.tax | number:'1.2-2' }}</span>
              </div>
            }
            <div class="total-row grand">
              <span>Total</span>
              <span>₹{{ invoice.total | number:'1.2-2' }}</span>
            </div>
            <div class="total-row paid-row">
              <span>Amount Paid</span>
              <span>₹{{ invoice.paid_amount | number:'1.2-2' }}</span>
            </div>
            @if (+invoice.total - +invoice.paid_amount > 0) {
              <div class="total-row balance-row">
                <span>Balance Due</span>
                <span>₹{{ +invoice.total - +invoice.paid_amount | number:'1.2-2' }}</span>
              </div>
            }
          </div>

          <!-- Payment history -->
          @if (invoice.payments?.length) {
            <div class="receipt-divider"></div>
            <div class="payment-section">
              <div class="section-label">Payment History</div>
              @for (p of invoice.payments; track p.id) {
                <div class="payment-row">
                  <div class="pay-method">
                    <mat-icon style="font-size:12px;width:12px;height:12px">payments</mat-icon>
                    {{ p.method | titlecase }}
                    @if (p.reference_no) { · {{ p.reference_no }} }
                  </div>
                  <div class="pay-right">
                    <span class="pay-date">{{ p.paid_at | date:'d MMM yyyy' }}</span>
                    <span class="pay-amt">₹{{ p.amount | number:'1.2-2' }}</span>
                  </div>
                </div>
              }
            </div>
          }

          <!-- Status badge -->
          <div class="receipt-divider"></div>
          <div class="receipt-status">
            <span [class]="'status-pill status-' + invoice.status">
              {{ invoice.status | titlecase }}
            </span>
          </div>

          <!-- Footer -->
          <div class="receipt-footer">
            <div class="footer-note">This is a computer-generated receipt.</div>
            <div class="footer-school">{{ schoolName() }}</div>
          </div>

        </div>
      </div>

      <!-- Actions -->
      <div class="dialog-footer">
        <button class="btn-ghost" mat-dialog-close>Close</button>
        <button class="btn-outline" (click)="downloadPdf()">
          <mat-icon style="font-size:16px;width:16px;height:16px">download</mat-icon>
          Download
        </button>
        <button class="btn-primary" (click)="print()">
          <mat-icon style="font-size:16px;width:16px;height:16px">print</mat-icon>
          Print
        </button>
      </div>
    </div>
  `,
  styles: [`
    .dialog-shell { width: 520px; display: flex; flex-direction: column; max-height: 90vh; }

    .dialog-header {
      display: flex; align-items: center; gap: 12px;
      padding: 16px 24px; border-bottom: 1px solid var(--border); flex-shrink: 0;
    }
    .dh-icon {
      width: 32px; height: 32px; border-radius: 8px;
      background: var(--blue-light); color: var(--blue);
      display: flex; align-items: center; justify-content: center;
      mat-icon { font-size: 16px; width: 16px; height: 16px; }
    }
    .dh-title { font-size: 14px; font-weight: 600; color: var(--text); }
    .dh-sub   { font-size: 11px; color: var(--text-3); }
    .dh-close {
      margin-left: auto; background: none; border: none;
      width: 28px; height: 28px; border-radius: 6px; cursor: pointer; color: var(--text-3);
      display: flex; align-items: center; justify-content: center;
      &:hover { background: var(--bg); }
      mat-icon { font-size: 18px; width: 18px; height: 18px; }
    }

    /* Receipt wrapper */
    .receipt-wrap {
      flex: 1; overflow-y: auto; padding: 16px 24px; background: var(--bg);
    }

    /* Receipt card */
    .receipt {
      background: #fff;
      border: 1px solid #E5E7EB;
      border-radius: 10px;
      padding: 24px;
      font-family: -apple-system, BlinkMacSystemFont, 'Inter', sans-serif;
    }

    /* Header */
    .receipt-header {
      display: flex; align-items: center; gap: 14px; position: relative;
    }
    .school-logo {
      width: 44px; height: 44px; border-radius: 10px;
      background: #1E3A5F; color: #fff;
      font-size: 16px; font-weight: 700;
      display: flex; align-items: center; justify-content: center; flex-shrink: 0;
    }
    .school-name { font-size: 15px; font-weight: 700; color: #111827; }
    .school-sub  { font-size: 11px; color: #6B7280; margin-top: 2px; }
    .paid-stamp {
      margin-left: auto;
      border: 2.5px solid #10B981; color: #10B981;
      font-size: 14px; font-weight: 800; letter-spacing: 2px;
      padding: 4px 12px; border-radius: 6px;
      transform: rotate(-8deg);
    }

    .receipt-divider { height: 1px; background: #F3F4F6; margin: 14px 0; }

    /* Meta */
    .receipt-meta  { display: grid; grid-template-columns: 1fr 1fr; gap: 6px 0; }
    .meta-row      { display: contents; }
    .meta-label    { font-size: 11px; color: #6B7280; padding: 2px 0; }
    .meta-value    { font-size: 12px; color: #111827; padding: 2px 0; text-align: right; }
    .meta-value.bold { font-weight: 600; font-family: 'Courier New', monospace; color: #2563EB; }

    /* Student */
    .student-section { }
    .section-label { font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: .4px; color: #9CA3AF; margin-bottom: 4px; }
    .student-name  { font-size: 14px; font-weight: 600; color: #111827; }
    .student-meta  { font-size: 12px; color: #6B7280; margin-top: 2px; }

    /* Line items */
    .items-header {
      display: flex; font-size: 10px; font-weight: 600;
      text-transform: uppercase; letter-spacing: .3px; color: #9CA3AF;
      padding-bottom: 6px; border-bottom: 1px dashed #E5E7EB; margin-bottom: 6px;
    }
    .item-row      { display: flex; padding: 4px 0; font-size: 12.5px; color: #374151; }
    .item-name-col { flex: 1; }
    .item-amt-col  { text-align: right; font-variant-numeric: tabular-nums; }

    /* Totals */
    .totals-section { display: flex; flex-direction: column; gap: 5px; }
    .discount-label {
      display: inline-block; margin-left: 6px;
      font-size: 10px; font-weight: 600; color: #059669;
      background: #DCFCE7; border-radius: 4px; padding: 1px 6px;
      vertical-align: middle;
    }
    .total-row {
      display: flex; justify-content: space-between;
      font-size: 12.5px; color: #374151;
      &.discount { color: #10B981; }
      &.grand {
        font-size: 15px; font-weight: 700; color: #111827;
        padding-top: 6px; border-top: 1.5px solid #E5E7EB; margin-top: 3px;
      }
      &.paid-row    { color: #10B981; font-weight: 500; }
      &.balance-row { color: #EF4444; font-weight: 600; }
    }

    /* Payments */
    .payment-section { }
    .payment-row {
      display: flex; justify-content: space-between; align-items: center;
      padding: 5px 8px; background: #F9FAFB; border-radius: 6px; margin-bottom: 4px;
    }
    .pay-method { display: flex; align-items: center; gap: 4px; font-size: 11.5px; color: #374151; }
    .pay-right  { display: flex; align-items: center; gap: 10px; }
    .pay-date   { font-size: 10.5px; color: #9CA3AF; }
    .pay-amt    { font-size: 12px; font-weight: 600; color: #10B981; }

    /* Status */
    .receipt-status { display: flex; justify-content: center; }
    .status-pill {
      font-size: 11px; font-weight: 600; padding: 4px 14px; border-radius: 20px;
      &.status-paid    { background: #ECFDF5; color: #065F46; }
      &.status-pending { background: #EFF6FF; color: #1E40AF; }
      &.status-partial { background: #FFFBEB; color: #92400E; }
      &.status-overdue { background: #FEF2F2; color: #991B1B; }
      &.status-waived  { background: #F9FAFB; color: #6B7280; }
    }

    /* Footer */
    .receipt-footer {
      margin-top: 16px; text-align: center;
      border-top: 1px dashed #E5E7EB; padding-top: 12px;
    }
    .footer-note   { font-size: 10px; color: #9CA3AF; }
    .footer-school { font-size: 11px; font-weight: 600; color: #374151; margin-top: 3px; }

    /* Dialog footer */
    .dialog-footer {
      display: flex; justify-content: flex-end; gap: 8px;
      padding: 12px 24px; border-top: 1px solid var(--border); background: var(--bg); flex-shrink: 0;
    }
    .btn-ghost {
      background: none; border: none; cursor: pointer;
      font-size: 13px; color: var(--text-3); padding: 0 10px; height: 34px; border-radius: 7px;
      &:hover { background: var(--border-light); }
    }
    .btn-outline {
      display: inline-flex; align-items: center; gap: 5px;
      background: #fff; color: var(--text-2);
      border: 1px solid var(--border); border-radius: 7px;
      padding: 0 14px; height: 34px; font-size: 12.5px; font-weight: 500; cursor: pointer;
      &:hover { background: var(--bg); }
    }
    .btn-primary {
      display: inline-flex; align-items: center; gap: 5px;
      background: var(--blue); color: #fff;
      border: none; border-radius: 7px; height: 34px; padding: 0 16px;
      font-size: 12.5px; font-weight: 500; cursor: pointer;
      &:hover { background: #1D4ED8; }
    }

    /* Print styles */
    @media print {
      .dialog-header, .dialog-footer { display: none !important; }
      .receipt-wrap { padding: 0; background: white; overflow: visible; }
      .receipt { border: none; border-radius: 0; box-shadow: none; }
    }
  `],
})
export class FeeReceiptDialogComponent implements OnInit {
  private api       = inject(ApiService);
  private auth      = inject(AuthService);
  private dialogRef = inject(MatDialogRef<FeeReceiptDialogComponent>);
  private raw: FeeInvoice = inject(MAT_DIALOG_DATA);

  inv    = signal<FeeInvoice>(this.raw);
  get invoice() { return this.inv(); }

  schoolName    = signal('Montessori School');
  schoolInitials = signal('MS');

  lineItems = signal<{ name: string; amount: number }[]>([]);

  ngOnInit() {
    // Parse line items from initial data
    this.parseLineItems(this.raw);

    // Always re-fetch to pick up discount_note, payments, and latest status
    this.api.get<any>('/fees/invoices/' + this.raw.id).subscribe({
      next: (res: any) => {
        const fetched = res.data ?? res;
        this.inv.set({ ...this.raw, ...fetched });
        this.parseLineItems(fetched);
      },
    });

    // Use tenant code from auth service as school name
    const code = this.auth.user()?.tenantId ?? '';
    const name = code ? code.charAt(0).toUpperCase() + code.slice(1) + ' School' : 'Montessori School';
    this.schoolName.set(name);
    this.schoolInitials.set(
      name.split(' ').slice(0, 2).map((w: string) => w[0]).join('').toUpperCase()
    );
  }

  private parseLineItems(inv: any) {
    try {
      const items = typeof inv.line_items === 'string'
        ? JSON.parse(inv.line_items)
        : (inv.line_items ?? []);
      if (items.length) this.lineItems.set(items);
    } catch {}
  }

  print() {
    const content = document.getElementById('receipt-content');
    if (!content) return;

    const win = window.open('', '_blank', 'width=600,height=800');
    if (!win) return;

    win.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Receipt - ${this.invoice.invoice_no}</title>
        <style>
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body { font-family: -apple-system, BlinkMacSystemFont, 'Inter', sans-serif; padding: 20px; }
          ${this.getReceiptStyles()}
        </style>
      </head>
      <body>
        ${content.innerHTML}
      </body>
      </html>
    `);
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); win.close(); }, 500);
  }

  downloadPdf() {
    // Fallback: trigger print with save-as-PDF
    this.print();
  }

  private getReceiptStyles(): string {
    return `
      .receipt { max-width: 500px; margin: 0 auto; }
      .receipt-header { display: flex; align-items: center; gap: 14px; position: relative; margin-bottom: 14px; }
      .school-logo { width: 44px; height: 44px; border-radius: 10px; background: #1E3A5F; color: #fff; font-size: 16px; font-weight: 700; display: flex; align-items: center; justify-content: center; }
      .school-name { font-size: 15px; font-weight: 700; color: #111827; }
      .school-sub  { font-size: 11px; color: #6B7280; margin-top: 2px; }
      .paid-stamp  { margin-left: auto; border: 2.5px solid #10B981; color: #10B981; font-size: 14px; font-weight: 800; letter-spacing: 2px; padding: 4px 12px; border-radius: 6px; transform: rotate(-8deg); }
      .receipt-divider { height: 1px; background: #F3F4F6; margin: 14px 0; }
      .receipt-meta { display: grid; grid-template-columns: 1fr 1fr; gap: 5px 0; margin-bottom: 14px; }
      .meta-label { font-size: 11px; color: #6B7280; }
      .meta-value { font-size: 12px; color: #111827; text-align: right; }
      .meta-value.bold { font-weight: 600; color: #2563EB; font-family: monospace; }
      .section-label { font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: .4px; color: #9CA3AF; margin-bottom: 4px; }
      .student-name { font-size: 14px; font-weight: 600; color: #111827; }
      .student-meta { font-size: 12px; color: #6B7280; margin-top: 2px; }
      .items-header { display: flex; font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: .3px; color: #9CA3AF; padding-bottom: 6px; border-bottom: 1px dashed #E5E7EB; margin-bottom: 6px; }
      .item-row { display: flex; padding: 4px 0; font-size: 12.5px; color: #374151; }
      .item-name-col { flex: 1; }
      .item-amt-col { text-align: right; }
      .totals-section { display: flex; flex-direction: column; gap: 5px; }
      .total-row { display: flex; justify-content: space-between; font-size: 12.5px; color: #374151; }
      .total-row.discount { color: #10B981; }
      .total-row.grand { font-size: 15px; font-weight: 700; color: #111827; padding-top: 6px; border-top: 1.5px solid #E5E7EB; margin-top: 3px; }
      .total-row.paid-row { color: #10B981; font-weight: 500; }
      .total-row.balance-row { color: #EF4444; font-weight: 600; }
      .payment-row { display: flex; justify-content: space-between; padding: 5px 8px; background: #F9FAFB; border-radius: 6px; margin-bottom: 4px; }
      .pay-method { font-size: 11.5px; color: #374151; }
      .pay-right { display: flex; gap: 10px; }
      .pay-date { font-size: 10.5px; color: #9CA3AF; }
      .pay-amt { font-size: 12px; font-weight: 600; color: #10B981; }
      .receipt-status { display: flex; justify-content: center; }
      .status-pill { font-size: 11px; font-weight: 600; padding: 4px 14px; border-radius: 20px; }
      .status-paid { background: #ECFDF5; color: #065F46; }
      .status-pending { background: #EFF6FF; color: #1E40AF; }
      .status-partial { background: #FFFBEB; color: #92400E; }
      .status-overdue { background: #FEF2F2; color: #991B1B; }
      .receipt-footer { margin-top: 16px; text-align: center; border-top: 1px dashed #E5E7EB; padding-top: 12px; }
      .footer-note { font-size: 10px; color: #9CA3AF; }
      .footer-school { font-size: 11px; font-weight: 600; color: #374151; margin-top: 3px; }
      mat-icon { display: none; }
    `;
  }
}
