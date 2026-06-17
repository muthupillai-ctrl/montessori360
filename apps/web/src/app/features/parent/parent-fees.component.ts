import { Component, inject, signal, OnInit } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { DatePipe, DecimalPipe, TitleCasePipe } from '@angular/common';
import { ApiService } from '../../core/services/api.service';
import { ParentStateService } from './parent-state.service';

@Component({
  selector: 'app-parent-fees',
  standalone: true,
  imports: [MatIconModule, MatProgressSpinnerModule, DatePipe, DecimalPipe, TitleCasePipe],
  template: `
    <div class="page">
      <div class="page-title">Fees & Payments</div>

      @if (loading()) {
        <div class="loading"><mat-progress-spinner diameter="28" mode="indeterminate"/></div>
      } @else if (!invoices().length) {
        <div class="empty">No invoices found.</div>
      } @else {
        <div class="invoices">
          @for (inv of invoices(); track inv.id) {
            <div class="invoice-card" (click)="toggle(inv.id)">
              <div class="inv-top">
                <div>
                  <div class="inv-no">{{ inv.invoice_no }}</div>
                  <div class="inv-period">{{ inv.billing_period }}</div>
                </div>
                <div class="inv-right">
                  <span class="status-badge" [class]="inv.status">{{ inv.status | titlecase }}</span>
                  <mat-icon class="chevron" [class.open]="expanded() === inv.id"
                    style="font-size:18px;width:18px;height:18px;color:var(--text-3)">
                    expand_more
                  </mat-icon>
                </div>
              </div>

              <div class="inv-summary">
                <div class="inv-amount">
                  <span class="label">Total</span>
                  <span class="amount">₹{{ inv.total | number:'1.0-0' }}</span>
                </div>
                @if (inv.paid_amount > 0) {
                  <div class="inv-amount">
                    <span class="label">Paid</span>
                    <span class="amount paid">₹{{ inv.paid_amount | number:'1.0-0' }}</span>
                  </div>
                }
                @if (inv.total - inv.paid_amount > 0 && inv.status !== 'paid' && inv.status !== 'waived') {
                  <div class="inv-amount">
                    <span class="label">Due</span>
                    <span class="amount due">₹{{ (inv.total - inv.paid_amount) | number:'1.0-0' }}</span>
                  </div>
                }
                <div class="inv-due-date">Due {{ inv.due_date | date:'d MMM yyyy' }}</div>
              </div>

              @if (expanded() === inv.id) {
                <div class="inv-detail" (click)="$event.stopPropagation()">
                  <div class="detail-divider"></div>

                  @if (inv.line_items?.length) {
                    <div class="line-items">
                      <div class="li-header">Fee Breakdown</div>
                      @for (li of inv.line_items; track li.label) {
                        <div class="li-row">
                          <span class="li-label">{{ li.label ?? li.name ?? li.description }}</span>
                          <span class="li-amount">₹{{ li.amount | number:'1.0-0' }}</span>
                        </div>
                      }
                    </div>
                    @if (inv.discount > 0) {
                      <div class="li-row discount">
                        <span class="li-label">Discount</span>
                        <span class="li-amount">- ₹{{ inv.discount | number:'1.0-0' }}</span>
                      </div>
                    }
                    @if (inv.tax > 0) {
                      <div class="li-row">
                        <span class="li-label">Tax</span>
                        <span class="li-amount">₹{{ inv.tax | number:'1.0-0' }}</span>
                      </div>
                    }
                  }

                  <div class="detail-row">
                    <span class="dr-label">Invoice Type</span>
                    <span class="dr-val">{{ (inv.invoice_type ?? 'adhoc') | titlecase }}</span>
                  </div>
                  @if (inv.paid_at) {
                    <div class="detail-row">
                      <span class="dr-label">Paid On</span>
                      <span class="dr-val">{{ inv.paid_at | date:'d MMM yyyy' }}</span>
                    </div>
                  }
                  @if (inv.payment_method) {
                    <div class="detail-row">
                      <span class="dr-label">Payment Method</span>
                      <span class="dr-val">{{ inv.payment_method | titlecase }}</span>
                    </div>
                  }
                </div>
              }
            </div>
          }
        </div>
      }
    </div>
  `,
  styles: [`
    .page { padding: 16px; }
    .page-title { font-size: 18px; font-weight: 700; color: var(--text-1); margin-bottom: 16px; }
    .loading { display: flex; justify-content: center; padding: 60px; }
    .empty { text-align: center; color: var(--text-3); padding: 60px 20px; font-size: 14px; }
    .invoices { display: flex; flex-direction: column; gap: 10px; }
    .invoice-card {
      background: var(--surface); border: 1px solid var(--border); border-radius: 12px;
      padding: 14px; cursor: pointer; transition: border-color .15s;
      &:hover { border-color: var(--primary); }
    }
    .inv-top { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 10px; }
    .inv-no { font-size: 13px; font-weight: 700; color: var(--text-1); }
    .inv-period { font-size: 11px; color: var(--text-3); margin-top: 2px; }
    .inv-right { display: flex; align-items: center; gap: 8px; }
    .chevron { transition: transform .2s; &.open { transform: rotate(180deg); } }
    .status-badge { font-size: 10px; font-weight: 700; padding: 3px 8px; border-radius: 20px; text-transform: capitalize;
      &.paid    { background: var(--green-light); color: #065F46; }
      &.partial { background: #FFF7ED; color: #C2410C; }
      &.pending { background: #FFF7ED; color: #C2410C; }
      &.overdue { background: var(--red-light); color: var(--red); }
      &.waived  { background: var(--border-light); color: var(--text-3); }
    }
    .inv-summary { display: flex; align-items: center; gap: 16px; flex-wrap: wrap; }
    .inv-amount { display: flex; flex-direction: column; }
    .label { font-size: 10px; color: var(--text-3); }
    .amount { font-size: 15px; font-weight: 700; color: var(--text-1); &.paid { color: var(--green); } &.due { color: var(--red); } }
    .inv-due-date { margin-left: auto; font-size: 11px; color: var(--text-3); }

    .inv-detail { margin-top: 12px; }
    .detail-divider { height: 1px; background: var(--border-light); margin-bottom: 12px; }
    .line-items { margin-bottom: 8px; }
    .li-header { font-size: 11px; font-weight: 700; color: var(--text-3); text-transform: uppercase; letter-spacing: .4px; margin-bottom: 8px; }
    .li-row { display: flex; justify-content: space-between; padding: 5px 0; border-bottom: 1px dashed var(--border-light); &:last-child { border-bottom: none; } &.discount { color: var(--green); } }
    .li-label { font-size: 13px; color: var(--text-2); }
    .li-amount { font-size: 13px; font-weight: 600; color: var(--text-1); }
    .detail-row { display: flex; justify-content: space-between; align-items: center; padding: 5px 0; }
    .dr-label { font-size: 12px; color: var(--text-3); }
    .dr-val { font-size: 12px; font-weight: 600; color: var(--text-2); }
  `],
})
export class ParentFeesComponent implements OnInit {
  private api = inject(ApiService);
  state       = inject(ParentStateService);
  loading     = signal(true);
  invoices    = signal<any[]>([]);
  expanded    = signal<string | null>(null);

  ngOnInit() {
    const child = this.state.activeChild();
    if (!child) { this.loading.set(false); return; }
    this.api.get<any>(`/parent/students/${child.id}/fees`).subscribe({
      next: (res: any) => { this.invoices.set(res.data ?? []); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  toggle(id: string) {
    this.expanded.set(this.expanded() === id ? null : id);
  }
}
