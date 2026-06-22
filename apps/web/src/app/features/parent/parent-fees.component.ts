import { Component, inject, signal, computed, OnInit, effect } from '@angular/core';
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

      <!-- Summary bar -->
      @if (!loading() && allInvoices().length) {
        <div class="summary-bar">
          <div class="sb-item">
            <div class="sb-val" [class.danger]="totalOutstanding() > 0">₹{{ totalOutstanding() | number:'1.0-0' }}</div>
            <div class="sb-lbl">Outstanding</div>
          </div>
          <div class="sb-divider"></div>
          <div class="sb-item">
            <div class="sb-val paid">₹{{ totalPaid() | number:'1.0-0' }}</div>
            <div class="sb-lbl">Total Paid</div>
          </div>
          <div class="sb-divider"></div>
          <div class="sb-item">
            <div class="sb-val" [class.danger]="overdueCount() > 0">{{ overdueCount() }}</div>
            <div class="sb-lbl">Overdue</div>
          </div>
          <div class="sb-divider"></div>
          <div class="sb-item">
            <div class="sb-val">{{ allInvoices().length }}</div>
            <div class="sb-lbl">Total Invoices</div>
          </div>
        </div>
      }

      <!-- Tabs -->
      @if (!loading() && allInvoices().length) {
        <div class="tabs-row">
          <button class="tab-btn" [class.active]="activeTab() === 'pending'" (click)="activeTab.set('pending')">
            Pending & Overdue
            @if (pendingInvoices().length) {
              <span class="tab-badge" [class.danger]="overdueCount() > 0">{{ pendingInvoices().length }}</span>
            }
          </button>
          <button class="tab-btn" [class.active]="activeTab() === 'all'" (click)="activeTab.set('all')">
            All Invoices
          </button>
          <button class="tab-btn" [class.active]="activeTab() === 'paid'" (click)="activeTab.set('paid')">
            Paid
            @if (paidInvoices().length) {
              <span class="tab-badge success">{{ paidInvoices().length }}</span>
            }
          </button>
        </div>
      }

      @if (loading()) {
        <div class="loading"><mat-progress-spinner diameter="28" mode="indeterminate"/></div>
      } @else if (!allInvoices().length) {
        <div class="empty-state">
          <div class="empty-icon">🎉</div>
          <div class="empty-title">All Clear!</div>
          <div class="empty-sub">No fee invoices found for this student.</div>
        </div>
      } @else if (!visibleInvoices().length) {
        <div class="empty-state">
          <div class="empty-icon">{{ activeTab() === 'paid' ? '✅' : '🎉' }}</div>
          <div class="empty-title">{{ activeTab() === 'paid' ? 'No paid invoices yet' : 'No pending invoices!' }}</div>
          <div class="empty-sub">{{ activeTab() === 'paid' ? 'Payments will appear here once recorded.' : 'Great — no outstanding fees.' }}</div>
        </div>
      } @else {
        <div class="invoices">
          @for (inv of visibleInvoices(); track inv.id) {
            <div class="invoice-card" [class.is-overdue]="inv.status === 'overdue'" [class.is-paid]="inv.status === 'paid'" (click)="toggle(inv)">

              <div class="inv-top">
                <div class="inv-left">
                  <div class="inv-icon" [class]="'inv-icon-' + statusVariant(inv.status)">
                    <i class="ti {{ statusIcon(inv.status) }}"></i>
                  </div>
                  <div>
                    <div class="inv-no">{{ inv.invoice_no }}</div>
                    <div class="inv-meta">{{ inv.billing_period }}@if (inv.class_name) { · {{ inv.class_name }} }</div>
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
                @if (+inv.paid_amount > 0) {
                  <div class="amt-item">
                    <div class="amt-label">Paid</div>
                    <div class="amt-val green">₹{{ inv.paid_amount | number:'1.0-0' }}</div>
                  </div>
                }
                @if ((+inv.total - +inv.paid_amount) > 0 && inv.status !== 'paid' && inv.status !== 'waived') {
                  <div class="amt-item">
                    <div class="amt-label">Balance Due</div>
                    <div class="amt-val red">₹{{ (+inv.total - +inv.paid_amount) | number:'1.0-0' }}</div>
                  </div>
                }
                @if (inv.discount > 0) {
                  <div class="amt-item">
                    <div class="amt-label">Discount</div>
                    <div class="amt-val disc">−₹{{ inv.discount | number:'1.0-0' }}</div>
                  </div>
                }
                <div class="amt-item due-date-item">
                  <div class="amt-label">Due date</div>
                  <div class="amt-val muted">{{ inv.due_date | date:'d MMM yyyy' }}</div>
                </div>
              </div>

              <!-- Expanded detail -->
              @if (expanded() === inv.id) {
                <div class="inv-detail" (click)="$event.stopPropagation()">
                  <div class="detail-divider"></div>

                  <!-- Fee breakdown -->
                  @if (lineItems(inv).length) {
                    <div class="detail-section-title">Fee Breakdown</div>
                    @for (li of lineItems(inv); track $index) {
                      <div class="li-row">
                        <span class="li-label">{{ li.label ?? li.name ?? li.description }}</span>
                        <span class="li-amount">₹{{ li.amount | number:'1.0-0' }}</span>
                      </div>
                    }
                    @if (inv.discount > 0) {
                      <div class="li-row discount">
                        <span class="li-label">
                          Discount
                          @if (inv.discount_note) {
                            <span class="discount-tag">{{ inv.discount_note }}</span>
                          }
                        </span>
                        <span class="li-amount">−₹{{ inv.discount | number:'1.0-0' }}</span>
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

                  <!-- Invoice meta -->
                  <div class="meta-rows">
                    <div class="meta-row">
                      <span>Invoice number</span><span>{{ inv.invoice_no }}</span>
                    </div>
                    @if (inv.invoice_type) {
                      <div class="meta-row">
                        <span>Type</span><span>{{ inv.invoice_type | titlecase }}</span>
                      </div>
                    }
                    <div class="meta-row">
                      <span>Due date</span><span>{{ inv.due_date | date:'d MMM yyyy' }}</span>
                    </div>
                  </div>

                  <!-- Payment history -->
                  <div class="detail-section-title" style="margin-top:14px">
                    Payment History
                    @if (payHistoryLoading()) {
                      <mat-progress-spinner diameter="12" mode="indeterminate" style="display:inline-block;margin-left:8px;vertical-align:middle"/>
                    }
                  </div>

                  @if (!payHistoryLoading() && !paymentHistory().length) {
                    <div class="no-payments">No payments recorded yet.</div>
                  }

                  @if (paymentHistory().length) {
                    <div class="pay-timeline">
                      @for (p of paymentHistory(); track $index; let last = $last) {
                        <div class="pay-entry" [class.last]="last">
                          <div class="pay-dot"></div>
                          <div class="pay-body">
                            <div class="pay-top-row">
                              <span class="pay-amount">₹{{ p.amount | number:'1.0-0' }}</span>
                              <span class="pay-method">{{ p.method | titlecase }}</span>
                              <span class="pay-date">{{ p.paid_at | date:'d MMM yyyy, h:mm a' }}</span>
                            </div>
                            @if (p.reference_no) {
                              <div class="pay-ref">Ref: {{ p.reference_no }}</div>
                            }
                            @if (p.notes) {
                              <div class="pay-notes">{{ p.notes }}</div>
                            }
                          </div>
                        </div>
                      }
                    </div>

                    <div class="pay-summary">
                      <span>Total paid</span>
                      <span class="pay-summary-val">₹{{ inv.paid_amount | number:'1.0-0' }}</span>
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
    .page { padding: 16px 16px 32px; background: #F5F7FA; min-height: 100%; }

    /* Summary bar */
    .summary-bar {
      display: flex; align-items: center;
      background: #fff; border-radius: 16px; border: 1px solid #EAECF0;
      box-shadow: 0 1px 6px rgba(0,0,0,.05); margin-bottom: 14px; padding: 14px 16px;
    }
    .sb-item { flex: 1; text-align: center; }
    .sb-divider { width: 1px; height: 36px; background: #EAECF0; }
    .sb-val { font-size: 17px; font-weight: 800; color: #1D2939; &.paid { color: #059669; } &.danger { color: #DC2626; } }
    .sb-lbl { font-size: 9.5px; font-weight: 600; color: #98A2B3; margin-top: 3px; text-transform: uppercase; letter-spacing: .04em; }

    /* Tabs */
    .tabs-row { display: flex; gap: 6px; margin-bottom: 14px; overflow-x: auto; padding-bottom: 2px; }
    .tab-btn {
      display: flex; align-items: center; gap: 6px; white-space: nowrap;
      padding: 7px 14px; border-radius: 20px; border: 1.5px solid #EAECF0;
      background: #fff; font-size: 12px; font-weight: 600; color: #667085; cursor: pointer;
      transition: all .15s;
      &.active { background: #1D2939; border-color: #1D2939; color: #fff; }
    }
    .tab-badge {
      font-size: 10px; font-weight: 700; padding: 1px 6px; border-radius: 10px;
      background: #FEF2F2; color: #DC2626;
      &.success { background: #ECFDF5; color: #059669; }
      &.danger  { background: #FEF2F2; color: #DC2626; }
    }
    .tab-btn.active .tab-badge { background: rgba(255,255,255,.2); color: #fff; }

    /* Invoice cards */
    .invoices { display: flex; flex-direction: column; gap: 10px; }
    .invoice-card {
      background: #fff; border: 1.5px solid #EAECF0; border-radius: 16px;
      padding: 14px; cursor: pointer; transition: border-color .15s, box-shadow .15s;
      box-shadow: 0 1px 4px rgba(0,0,0,.04);
      &:active { box-shadow: 0 2px 10px rgba(0,0,0,.08); }
      &.is-overdue { border-color: #FECACA; background: #FFFAFA; }
      &.is-paid    { border-color: #D1FAE5; }
    }

    .inv-top { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; }
    .inv-left { display: flex; align-items: center; gap: 12px; }
    .inv-icon {
      width: 40px; height: 40px; border-radius: 12px; flex-shrink: 0;
      display: flex; align-items: center; justify-content: center; font-size: 20px;
    }
    .inv-icon-success { background: #ECFDF5; color: #059669; }
    .inv-icon-warning { background: #FFFBEB; color: #D97706; }
    .inv-icon-danger  { background: #FEF2F2; color: #DC2626; }
    .inv-icon-neutral { background: #F9FAFB; color: #6B7280; }

    .inv-no   { font-size: 14px; font-weight: 700; color: #1D2939; }
    .inv-meta { font-size: 11px; color: #98A2B3; margin-top: 2px; }

    .inv-right { display: flex; align-items: center; gap: 8px; }
    .expand-icon { font-size: 16px; color: #D0D5DD; transition: transform .2s; &.rotated { transform: rotate(180deg); } }

    .status-badge { font-size: 10px; font-weight: 700; padding: 4px 9px; border-radius: 20px; text-transform: uppercase; letter-spacing: .04em; }
    .badge-success { background: #ECFDF5; color: #059669; }
    .badge-warning { background: #FFFBEB; color: #D97706; }
    .badge-danger  { background: #FEF2F2; color: #DC2626; }
    .badge-neutral { background: #F9FAFB; color: #6B7280; }

    .inv-amounts { display: flex; gap: 16px; flex-wrap: wrap; align-items: flex-end; }
    .amt-item { display: flex; flex-direction: column; gap: 2px; }
    .due-date-item { margin-left: auto; }
    .amt-label { font-size: 9.5px; font-weight: 600; color: #98A2B3; text-transform: uppercase; letter-spacing: .04em; }
    .amt-val {
      font-size: 15px; font-weight: 700; color: #1D2939;
      &.green { color: #059669; } &.red { color: #DC2626; } &.disc { color: #7C3AED; }
      &.muted { font-size: 12px; color: #667085; font-weight: 500; }
    }

    /* Expanded detail */
    .inv-detail { margin-top: 14px; }
    .detail-divider { height: 1px; background: #F2F4F7; margin-bottom: 16px; }
    .detail-section-title { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: .06em; color: #98A2B3; margin-bottom: 8px; }

    .li-row { display: flex; justify-content: space-between; padding: 7px 0; border-bottom: 1px dashed #F2F4F7; }
    .li-label { font-size: 13px; color: #667085; display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
    .li-amount { font-size: 13px; font-weight: 700; color: #1D2939; }
    .li-row.discount .li-label, .li-row.discount .li-amount { color: #7C3AED; }
    .discount-tag { font-size: 10px; font-weight: 600; background: #EDE9FE; color: #7C3AED; padding: 2px 7px; border-radius: 10px; }
    .li-total { display: flex; justify-content: space-between; padding: 10px 0 0; font-size: 14px; font-weight: 800; color: #1D2939; border-top: 2px solid #EAECF0; margin-top: 6px; }

    .meta-rows { margin-top: 14px; display: flex; flex-direction: column; border: 1px solid #F2F4F7; border-radius: 10px; overflow: hidden; }
    .meta-row {
      display: flex; justify-content: space-between; padding: 8px 12px; font-size: 12px;
      &:not(:last-child) { border-bottom: 1px solid #F9FAFB; }
      span:first-child { color: #98A2B3; }
      span:last-child  { font-weight: 600; color: #344054; }
    }

    /* Payment history timeline */
    .no-payments { font-size: 12px; color: #98A2B3; padding: 8px 0; }
    .pay-timeline { display: flex; flex-direction: column; padding-left: 12px; border-left: 2px solid #E5E7EB; margin-left: 6px; gap: 0; }
    .pay-entry {
      position: relative; padding: 0 0 14px 16px;
      &.last { padding-bottom: 4px; }
    }
    .pay-dot {
      position: absolute; left: -7px; top: 3px;
      width: 12px; height: 12px; border-radius: 50%; background: #7C3AED; border: 2px solid #fff;
      box-shadow: 0 0 0 2px #EDE9FE;
    }
    .pay-body { }
    .pay-top-row { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
    .pay-amount { font-size: 14px; font-weight: 800; color: #059669; }
    .pay-method { font-size: 11px; font-weight: 600; background: #F3F4F6; color: #374151; padding: 2px 8px; border-radius: 10px; }
    .pay-date   { font-size: 11px; color: #98A2B3; margin-left: auto; }
    .pay-ref    { font-size: 11px; color: #667085; margin-top: 3px; }
    .pay-notes  { font-size: 11px; color: #98A2B3; margin-top: 2px; font-style: italic; }

    .pay-summary {
      display: flex; justify-content: space-between; align-items: center;
      margin-top: 10px; padding: 8px 12px; background: #ECFDF5; border-radius: 8px;
      font-size: 12px; font-weight: 600; color: #065F46;
    }
    .pay-summary-val { font-size: 14px; font-weight: 800; }

    .loading { display: flex; justify-content: center; padding: 80px; }
    .empty-state { display: flex; flex-direction: column; align-items: center; gap: 10px; padding: 60px 24px; text-align: center; }
    .empty-icon  { font-size: 44px; }
    .empty-title { font-size: 16px; font-weight: 700; color: #1D2939; }
    .empty-sub   { font-size: 13px; color: #98A2B3; }
  `],
})
export class ParentFeesComponent implements OnInit {
  private api = inject(ApiService);
  state       = inject(ParentStateService);

  loading          = signal(true);
  allInvoices      = signal<any[]>([]);
  expanded         = signal<string | null>(null);
  activeTab        = signal<'pending' | 'all' | 'paid'>('pending');
  paymentHistory   = signal<any[]>([]);
  payHistoryLoading = signal(false);

  pendingInvoices = computed(() => this.allInvoices().filter(i => i.status === 'pending' || i.status === 'overdue' || i.status === 'partial'));
  paidInvoices    = computed(() => this.allInvoices().filter(i => i.status === 'paid' || i.status === 'waived'));
  visibleInvoices = computed(() => {
    const tab = this.activeTab();
    if (tab === 'pending') return this.pendingInvoices();
    if (tab === 'paid')    return this.paidInvoices();
    return this.allInvoices();
  });

  totalOutstanding = computed(() => this.allInvoices().reduce((s, i) => s + Math.max(0, +i.total - +i.paid_amount), 0));
  totalPaid        = computed(() => this.allInvoices().reduce((s, i) => s + (+i.paid_amount || 0), 0));
  overdueCount     = computed(() => this.allInvoices().filter(i => i.status === 'overdue').length);

  constructor() {
    // Re-load whenever the selected child changes (handles race with shell loading children)
    effect(() => {
      const child = this.state.activeChild();
      if (child) this.loadInvoices(child.id);
    });
  }

  ngOnInit() {
    // effect() handles the initial load; nothing needed here
  }

  private loadInvoices(studentId: string) {
    this.loading.set(true);
    this.allInvoices.set([]);
    this.expanded.set(null);
    this.paymentHistory.set([]);
    this.api.get<any>(`/parent/students/${studentId}/fees`).subscribe({
      next: (res: any) => {
        const invoices = res.data ?? [];
        this.allInvoices.set(invoices);
        // Default to pending tab if there are pending invoices, otherwise show all
        this.activeTab.set(invoices.some((i: any) => i.status === 'pending' || i.status === 'overdue' || i.status === 'partial') ? 'pending' : 'all');
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  toggle(inv: any) {
    const next = this.expanded() === inv.id ? null : inv.id;
    this.expanded.set(next);
    if (next) this.loadPaymentHistory(inv);
  }

  private loadPaymentHistory(inv: any) {
    const child = this.state.activeChild();
    if (!child) return;
    this.paymentHistory.set([]);
    this.payHistoryLoading.set(true);
    this.api.get<any>(`/parent/students/${child.id}/fees/${inv.id}/payments`).subscribe({
      next: (res: any) => { this.paymentHistory.set(res.data ?? []); this.payHistoryLoading.set(false); },
      error: () => this.payHistoryLoading.set(false),
    });
  }

  lineItems(inv: any): any[] {
    if (!inv.line_items) return [];
    if (typeof inv.line_items === 'string') {
      try { return JSON.parse(inv.line_items); } catch { return []; }
    }
    return Array.isArray(inv.line_items) ? inv.line_items : [];
  }

  statusVariant(s: string) {
    return s === 'paid' ? 'success' : s === 'overdue' ? 'danger' : s === 'waived' ? 'neutral' : 'warning';
  }
  statusIcon(s: string) {
    return s === 'paid' ? 'ti-circle-check' : s === 'overdue' ? 'ti-alert-circle' : s === 'waived' ? 'ti-ban' : 'ti-clock';
  }
}
