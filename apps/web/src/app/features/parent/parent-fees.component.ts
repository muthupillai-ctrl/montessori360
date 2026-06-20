import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { DatePipe, DecimalPipe, TitleCasePipe } from '@angular/common';
import { ApiService } from '../../core/services/api.service';
import { ParentStateService } from './parent-state.service';

@Component({
  selector: 'app-parent-fees',
  standalone: true,
  imports: [MatProgressSpinnerModule, DatePipe, DecimalPipe, TitleCasePipe],
  template: `
    <div class="page">

      <!-- Header summary -->
      @if (!loading() && invoices().length) {
        <div class="summary-bar">
          <div class="sb-item">
            <div class="sb-val">₹{{ totalDue() | number:'1.0-0' }}</div>
            <div class="sb-lbl">Total Due</div>
          </div>
          <div class="sb-divider"></div>
          <div class="sb-item">
            <div class="sb-val paid">₹{{ totalPaid() | number:'1.0-0' }}</div>
            <div class="sb-lbl">Total Paid</div>
          </div>
          <div class="sb-divider"></div>
          <div class="sb-item">
            <div class="sb-val" [class.overdue]="overdueCount() > 0">{{ overdueCount() }}</div>
            <div class="sb-lbl">Overdue</div>
          </div>
        </div>
      }

      @if (loading()) {
        <div class="loading"><mat-progress-spinner diameter="28" mode="indeterminate"/></div>
      } @else if (!invoices().length) {
        <div class="empty-state">
          <div class="empty-icon">🎉</div>
          <div class="empty-title">All Clear!</div>
          <div class="empty-sub">No fee invoices found.</div>
        </div>
      } @else {
        <div class="section-title">Invoices</div>
        <div class="invoices">
          @for (inv of invoices(); track inv.id) {
            <div class="invoice-card" [class.overdue]="inv.status === 'overdue'" (click)="toggle(inv.id)">

              <div class="inv-top">
                <div class="inv-left">
                  <div class="inv-icon" [class]="'inv-icon-' + statusVariant(inv.status)">
                    <i class="ti {{ statusIcon(inv.status) }}"></i>
                  </div>
                  <div>
                    <div class="inv-no">{{ inv.invoice_no }}</div>
                    <div class="inv-period">{{ inv.billing_period }}</div>
                  </div>
                </div>
                <div class="inv-right">
                  <span class="status-badge" [class]="'badge-' + statusVariant(inv.status)">
                    {{ inv.status | titlecase }}
                  </span>
                  <i class="ti ti-chevron-down expand-icon" [class.rotated]="expanded() === inv.id"></i>
                </div>
              </div>

              <div class="inv-amounts">
                <div class="amt-item">
                  <div class="amt-label">Total</div>
                  <div class="amt-val">₹{{ inv.total | number:'1.0-0' }}</div>
                </div>
                @if (inv.paid_amount > 0) {
                  <div class="amt-item">
                    <div class="amt-label">Paid</div>
                    <div class="amt-val green">₹{{ inv.paid_amount | number:'1.0-0' }}</div>
                  </div>
                }
                @if ((inv.total - inv.paid_amount) > 0 && inv.status !== 'paid' && inv.status !== 'waived') {
                  <div class="amt-item">
                    <div class="amt-label">Due</div>
                    <div class="amt-val red">₹{{ (inv.total - inv.paid_amount) | number:'1.0-0' }}</div>
                  </div>
                }
                <div class="amt-item due-date-item">
                  <div class="amt-label">Due date</div>
                  <div class="amt-val muted">{{ inv.due_date | date:'d MMM yyyy' }}</div>
                </div>
              </div>

              @if (expanded() === inv.id) {
                <div class="inv-detail" (click)="$event.stopPropagation()">
                  <div class="detail-divider"></div>

                  @if (inv.line_items?.length) {
                    <div class="breakdown-title">Fee Breakdown</div>
                    @for (li of inv.line_items; track $index) {
                      <div class="li-row">
                        <span class="li-label">{{ li.label ?? li.name ?? li.description }}</span>
                        <span class="li-amount">₹{{ li.amount | number:'1.0-0' }}</span>
                      </div>
                    }
                    @if (inv.discount > 0) {
                      <div class="li-row discount">
                        <span class="li-label">Discount</span>
                        <span class="li-amount">− ₹{{ inv.discount | number:'1.0-0' }}</span>
                      </div>
                    }
                    @if (inv.tax > 0) {
                      <div class="li-row">
                        <span class="li-label">Tax</span>
                        <span class="li-amount">₹{{ inv.tax | number:'1.0-0' }}</span>
                      </div>
                    }
                    <div class="li-total">
                      <span>Total</span>
                      <span>₹{{ inv.total | number:'1.0-0' }}</span>
                    </div>
                  }

                  <div class="meta-rows">
                    <div class="meta-row">
                      <span>Invoice type</span>
                      <span>{{ (inv.invoice_type ?? 'Ad hoc') | titlecase }}</span>
                    </div>
                    @if (inv.paid_at) {
                      <div class="meta-row">
                        <span>Paid on</span>
                        <span>{{ inv.paid_at | date:'d MMM yyyy' }}</span>
                      </div>
                    }
                    @if (inv.payment_method) {
                      <div class="meta-row">
                        <span>Payment method</span>
                        <span>{{ inv.payment_method | titlecase }}</span>
                      </div>
                    }
                  </div>
                </div>
              }
            </div>
          }
        </div>
      }
    </div>
  `,
  styles: [`
    .page { padding: 16px 16px 24px; background: #F5F7FA; min-height: 100%; }

    /* ── Summary bar ── */
    .summary-bar {
      display: flex; align-items: center;
      background: #fff; border-radius: 16px; border: 1px solid #EAECF0;
      box-shadow: 0 1px 6px rgba(0,0,0,.05); margin-bottom: 16px; padding: 16px;
    }
    .sb-item { flex: 1; text-align: center; }
    .sb-divider { width: 1px; height: 40px; background: #EAECF0; }
    .sb-val { font-size: 18px; font-weight: 800; color: #1D2939; }
    .sb-val.paid { color: #059669; }
    .sb-val.overdue { color: #DC2626; }
    .sb-lbl { font-size: 10px; font-weight: 600; color: #98A2B3; margin-top: 3px; text-transform: uppercase; letter-spacing: .04em; }

    /* ── Section title ── */
    .section-title { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .06em; color: #98A2B3; margin-bottom: 10px; }

    /* ── Invoice cards ── */
    .invoices { display: flex; flex-direction: column; gap: 10px; }
    .invoice-card {
      background: #fff; border: 1px solid #EAECF0; border-radius: 16px;
      padding: 14px; cursor: pointer; transition: box-shadow .15s;
      box-shadow: 0 1px 4px rgba(0,0,0,.04);
      &:active { box-shadow: 0 2px 10px rgba(0,0,0,.08); }
      &.overdue { border-color: #FECACA; }
    }

    .inv-top { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; }
    .inv-left { display: flex; align-items: center; gap: 12px; }
    .inv-icon {
      width: 38px; height: 38px; border-radius: 10px; flex-shrink: 0;
      display: flex; align-items: center; justify-content: center; font-size: 18px;
    }
    .inv-icon-success { background: #ECFDF5; color: #059669; }
    .inv-icon-warning { background: #FFFBEB; color: #D97706; }
    .inv-icon-danger  { background: #FEF2F2; color: #DC2626; }
    .inv-icon-neutral { background: #F9FAFB; color: #6B7280; }

    .inv-no { font-size: 14px; font-weight: 700; color: #1D2939; }
    .inv-period { font-size: 11px; color: #98A2B3; margin-top: 2px; }

    .inv-right { display: flex; align-items: center; gap: 8px; }
    .expand-icon { font-size: 16px; color: #D0D5DD; transition: transform .2s; &.rotated { transform: rotate(180deg); } }

    .status-badge { font-size: 10px; font-weight: 700; padding: 4px 9px; border-radius: 20px; }
    .badge-success { background: #ECFDF5; color: #059669; }
    .badge-warning { background: #FFFBEB; color: #D97706; }
    .badge-danger  { background: #FEF2F2; color: #DC2626; }
    .badge-neutral { background: #F9FAFB; color: #6B7280; }

    .inv-amounts { display: flex; gap: 16px; flex-wrap: wrap; align-items: flex-end; }
    .amt-item { display: flex; flex-direction: column; gap: 2px; }
    .due-date-item { margin-left: auto; }
    .amt-label { font-size: 9.5px; font-weight: 600; color: #98A2B3; text-transform: uppercase; letter-spacing: .04em; }
    .amt-val { font-size: 15px; font-weight: 700; color: #1D2939; &.green { color: #059669; } &.red { color: #DC2626; } &.muted { font-size: 12px; color: #667085; } }

    /* ── Expanded detail ── */
    .inv-detail { margin-top: 14px; }
    .detail-divider { height: 1px; background: #F2F4F7; margin-bottom: 14px; }

    .breakdown-title { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: .05em; color: #98A2B3; margin-bottom: 8px; }
    .li-row { display: flex; justify-content: space-between; padding: 7px 0; border-bottom: 1px dashed #F2F4F7; &:last-child { border-bottom: none; } }
    .li-label { font-size: 13px; color: #667085; }
    .li-amount { font-size: 13px; font-weight: 700; color: #1D2939; }
    .li-row.discount .li-label, .li-row.discount .li-amount { color: #059669; }
    .li-total { display: flex; justify-content: space-between; padding: 10px 0 0; font-size: 14px; font-weight: 800; color: #1D2939; border-top: 2px solid #EAECF0; margin-top: 6px; }

    .meta-rows { margin-top: 12px; display: flex; flex-direction: column; gap: 0; }
    .meta-row { display: flex; justify-content: space-between; padding: 6px 0; font-size: 12px; border-bottom: 1px solid #F9FAFB; span:first-child { color: #98A2B3; } span:last-child { font-weight: 600; color: #344054; } }

    .loading { display: flex; justify-content: center; padding: 80px; }
    .empty-state { display: flex; flex-direction: column; align-items: center; gap: 10px; padding: 80px 24px; text-align: center; }
    .empty-icon { font-size: 48px; }
    .empty-title { font-size: 16px; font-weight: 700; color: #1D2939; }
    .empty-sub { font-size: 13px; color: #98A2B3; }
  `],
})
export class ParentFeesComponent implements OnInit {
  private api = inject(ApiService);
  state       = inject(ParentStateService);
  loading     = signal(true);
  invoices    = signal<any[]>([]);
  expanded    = signal<string | null>(null);

  totalDue    = computed(() => this.invoices().reduce((s, i) => s + Math.max(0, i.total - i.paid_amount), 0));
  totalPaid   = computed(() => this.invoices().reduce((s, i) => s + (i.paid_amount ?? 0), 0));
  overdueCount = computed(() => this.invoices().filter(i => i.status === 'overdue').length);

  ngOnInit() {
    const child = this.state.activeChild();
    if (!child) { this.loading.set(false); return; }
    this.api.get<any>(`/parent/students/${child.id}/fees`).subscribe({
      next: (res: any) => { this.invoices.set(res.data ?? []); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  toggle(id: string) { this.expanded.set(this.expanded() === id ? null : id); }

  statusVariant(s: string) {
    return s === 'paid' ? 'success' : s === 'overdue' ? 'danger' : s === 'waived' ? 'neutral' : 'warning';
  }
  statusIcon(s: string) {
    return s === 'paid' ? 'ti-circle-check' : s === 'overdue' ? 'ti-alert-circle' : s === 'waived' ? 'ti-ban' : 'ti-clock';
  }
}
