import { Component, inject, signal, OnInit } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatTabsModule } from '@angular/material/tabs';
import { MatDividerModule } from '@angular/material/divider';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatMenuModule } from '@angular/material/menu';
import { DecimalPipe, DatePipe, TitleCasePipe } from '@angular/common';
import { ApiService } from '../../core/services/api.service';
import { RecordPaymentDialogComponent } from './record-payment-dialog.component';
import { CreateInvoiceDialogComponent } from './create-invoice-dialog.component';
import { FeeStructureDialogComponent } from './fee-structure-dialog.component';
import { BulkInvoiceDialogComponent } from './bulk-invoice-dialog.component';
import { FeeReceiptDialogComponent } from './fee-receipt-dialog.component';
import type { FeeStructure } from '../../core/models';
import type { FeeInvoice, PaginatedResponse } from '../../core/models';

@Component({
  selector: 'app-fees',
  standalone: true,
  imports: [
    MatIconModule, MatProgressSpinnerModule, MatPaginatorModule,
    MatTabsModule, MatDividerModule, MatMenuModule, MatDialogModule,
    DecimalPipe, DatePipe, TitleCasePipe,
  ],
  template: `
    <!-- Page header -->
    <div class="page-header">
      <div>
        <h1>Fee Management</h1>
        <div class="subtitle">{{ totalInvoices() }} invoices · ₹{{ totalOutstanding() | number }} outstanding</div>
      </div>
      <div class="actions">
        <button class="btn-outline-custom" (click)="downloadCsv()">
          <mat-icon style="font-size:16px;width:16px;height:16px">download</mat-icon>
          Export CSV
        </button>
        <button class="btn-outline-custom" style="color:var(--purple);border-color:var(--purple)" (click)="openBulkInvoice()">
          <mat-icon style="font-size:16px;width:16px;height:16px">auto_awesome</mat-icon>
          Bulk Generate
        </button>
        <button class="btn-primary-custom" (click)="createInvoice()">
          <mat-icon style="font-size:16px;width:16px;height:16px">add</mat-icon>
          New Invoice
        </button>
      </div>
    </div>

    <!-- Metric cards -->
    <div class="metrics-grid">
      <div class="metric-card blue">
        <div class="mc-icon"><mat-icon>payments</mat-icon></div>
        <div class="mc-label">Total Billed</div>
        <div class="mc-value">₹{{ summary().billed | number }}</div>
        <div class="mc-sub">This month</div>
      </div>
      <div class="metric-card green">
        <div class="mc-icon"><mat-icon>check_circle</mat-icon></div>
        <div class="mc-label">Collected</div>
        <div class="mc-value">₹{{ summary().collected | number }}</div>
        <div class="mc-sub up">{{ summary().collection_pct }}% collection rate</div>
      </div>
      <div class="metric-card amber">
        <div class="mc-icon"><mat-icon>pending</mat-icon></div>
        <div class="mc-label">Outstanding</div>
        <div class="mc-value">₹{{ summary().outstanding | number }}</div>
        <div class="mc-sub warn">Pending + Partial + Overdue</div>
      </div>
      <div class="metric-card red">
        <div class="mc-icon"><mat-icon>warning</mat-icon></div>
        <div class="mc-label">Defaulters</div>
        <div class="mc-value">{{ defaultersCount() }}</div>
        <div class="mc-sub danger">Students with unpaid invoices</div>
      </div>
    </div>

    <!-- Tabs -->
    <mat-tab-group class="fees-tabs" [selectedIndex]="selectedTab()" (selectedTabChange)="onTabChange($event.index)">

      <!-- ── Invoices ────────────────────────────────────────────── -->
      <mat-tab label="Invoices">
        <div class="tab-body">

          <!-- Filter bar -->
          <div class="filter-bar">
            <div class="search-box">
              <mat-icon class="sb-icon">search</mat-icon>
              <input placeholder="Search by student name or invoice no…"
                     [value]="searchTerm()"
                     (input)="onSearch($event)" />
              @if (searchTerm()) {
                <button class="sb-clear" (click)="clearSearch()">
                  <mat-icon style="font-size:14px;width:14px;height:14px">close</mat-icon>
                </button>
              }
            </div>
            <div class="filter-selects">
              <select class="filter-select" [value]="statusFilter()"
                      (change)="onStatusFilter($any($event.target).value)">
                <option value="">All Status</option>
                <option value="pending">Pending</option>
                <option value="paid">Paid</option>
                <option value="partial">Partial</option>
                <option value="overdue">Overdue</option>
                <option value="waived">Waived</option>
              </select>
            </div>
          </div>

          <!-- Table -->
          <div class="table-container">
            @if (loading()) {
              <div class="table-loading">
                <mat-progress-spinner mode="indeterminate" diameter="32" />
                <span>Loading invoices…</span>
              </div>
            } @else if (!invoices().length) {
              <div class="table-empty">
                <div class="empty-icon">🧾</div>
                <div class="empty-title">No invoices found</div>
                <div class="empty-sub">Try adjusting your filters or create a new invoice.</div>
              </div>
            } @else {
              <table class="data-table">
                <thead>
                  <tr>
                    <th>Invoice No</th>
                    <th>Student</th>
                    <th>Period</th>
                    <th>Total</th>
                    <th>Paid</th>
                    <th>Balance</th>
                    <th>Due Date</th>
                    <th>Status</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  @for (inv of invoices(); track inv.id) {
                    <tr class="data-row">
                      <td><span class="mono-chip invoice-link" (click)="printReceipt(inv)">{{ inv.invoice_no }}</span></td>
                      <td>
                        <div class="student-cell">
                          <div class="student-av" [style.background]="getAvatarColor(inv.student_name ?? '')">
                            {{ (inv.student_name ?? '?')[0] }}
                          </div>
                          <div>
                            <div class="cell-primary">{{ inv.student_name }}</div>
                            <div class="cell-secondary">{{ inv.class_name }}</div>
                          </div>
                        </div>
                      </td>
                      <td class="text-sm">{{ inv.billing_period }}</td>
                      <td class="font-semibold">₹{{ inv.total | number }}</td>
                      <td class="text-sm" style="color:var(--green)">₹{{ inv.paid_amount | number }}</td>
                      <td class="text-sm" [style.color]="getBalance(inv) > 0 ? 'var(--red)' : 'var(--green)'">
                        ₹{{ getBalance(inv) | number }}
                      </td>
                      <td class="text-sm">{{ inv.due_date | date:'d MMM yyyy' }}</td>
                      <td>
                        <span [class]="'badge badge-' + inv.status">
                          {{ inv.status | titlecase }}
                        </span>
                      </td>
                      <td>
                        <div class="row-actions">
                          @if (inv.status !== 'paid' && inv.status !== 'waived') {
                            <button class="pay-btn" (click)="recordPayment(inv)">
                              <mat-icon style="font-size:14px;width:14px;height:14px">payment</mat-icon>
                              Pay
                            </button>
                          }
                          <button class="row-menu-btn" [matMenuTriggerFor]="menu">
                            <mat-icon style="font-size:18px;width:18px;height:18px">more_horiz</mat-icon>
                          </button>
                          <mat-menu #menu="matMenu">
                            <button mat-menu-item (click)="recordPayment(inv)"
                                    [disabled]="inv.status === 'paid' || inv.status === 'waived'">
                              <mat-icon>payment</mat-icon> Record Payment
                            </button>
                            <button mat-menu-item (click)="waiveInvoice(inv)">
                              <mat-icon>money_off</mat-icon> Waive Invoice
                            </button>
                            <mat-divider />
                            <button mat-menu-item (click)="printReceipt(inv)">
                              <mat-icon>print</mat-icon> Print Receipt
                            </button>
                            <mat-divider />
                            <button mat-menu-item (click)="deleteInvoice(inv)" style="color:#EF4444">
                              <mat-icon style="color:#EF4444">delete</mat-icon> Delete Invoice
                            </button>
                          </mat-menu>
                        </div>
                      </td>
                    </tr>
                  }
                </tbody>
              </table>

              <!-- Pagination -->
              <div class="table-footer">
                <div class="tf-info">
                  Showing {{ (page()-1)*pageSize + 1 }}–{{ min(page()*pageSize, totalInvoices()) }} of {{ totalInvoices() }}
                </div>
                <mat-paginator
                  [length]="totalInvoices()"
                  [pageSize]="pageSize"
                  [pageSizeOptions]="[10,20,50]"
                  [pageIndex]="page()-1"
                  (page)="onPage($event)"
                  showFirstLastButtons />
              </div>
            }
          </div>
        </div>
      </mat-tab>

      <!-- ── Defaulters ─────────────────────────────────────────── -->
      <mat-tab label="Outstanding">
        <div class="tab-body">
          @if (defaultersLoading()) {
            <div class="table-loading">
              <mat-progress-spinner mode="indeterminate" diameter="32" />
            </div>
          } @else if (!defaulters().length) {
            <div class="table-empty">
              <div class="empty-icon">✅</div>
              <div class="empty-title" style="color:var(--green)">All fees collected!</div>
              <div class="empty-sub">No outstanding or unpaid invoices.</div>
            </div>
          } @else {
            <div class="table-container">
              <table class="data-table">
                <thead>
                  <tr>
                    <th>Student</th>
                    <th>Class</th>
                    <th>Invoices</th>
                    <th>Total Outstanding</th>
                    <th>Overdue Since</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  @for (d of defaulters(); track d.student_id) {
                    <tr class="data-row">
                      <td>
                        <div class="student-cell">
                          <div class="student-av" [style.background]="getAvatarColor(d.student_name ?? '')">
                            {{ (d.student_name ?? '?')[0] }}
                          </div>
                          <div class="cell-primary">{{ d.student_name }}</div>
                        </div>
                      </td>
                      <td class="text-sm">{{ d.class_name ?? '—' }}</td>
                      <td>
                        <span class="count-chip">{{ d.invoice_count }}</span>
                      </td>
                      <td class="font-semibold" style="color:var(--red)">
                        ₹{{ d.total_outstanding | number }}
                      </td>
                      <td class="text-sm">{{ d.max_overdue_days }} days ago</td>
                      <td>
                        <button class="btn-outline-sm" (click)="viewStudentInvoices(d.student_id)">
                          View Invoices
                        </button>
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          }
        </div>
      </mat-tab>

      <!-- ── Summary ────────────────────────────────────────────── -->
      <mat-tab label="Summary">
        <div class="tab-body">
          <div class="summary-grid-2">

            <!-- Status breakdown -->
            <div class="section-card">
              <div class="sc-header">
                <div class="sc-title">Invoice Status Breakdown</div>
              </div>
              <div class="sc-body">
                <div class="status-breakdown">
                  @for (item of statusBreakdown(); track item.label) {
                    <div class="sb-row">
                      <div class="sbr-left">
                        <div class="sbr-dot" [style.background]="item.color"></div>
                        <div class="sbr-label">{{ item.label }}</div>
                      </div>
                      <div class="sbr-right">
                        <div class="sbr-bar-track">
                          <div class="sbr-bar" [style.width.%]="item.pct"
                               [style.background]="item.color"></div>
                        </div>
                        <div class="sbr-count">{{ item.count }}</div>
                      </div>
                    </div>
                  }
                </div>
              </div>
            </div>

            <!-- Collection summary -->
            <div class="section-card">
              <div class="sc-header">
                <div class="sc-title">Collection Summary</div>
              </div>
              <div class="sc-body">
                <div class="collection-stats">
                  <div class="cs-item">
                    <div class="csi-label">Total Billed (This Month)</div>
                    <div class="csi-value">₹{{ summary().billed | number }}</div>
                  </div>
                  <div class="cs-item">
                    <div class="csi-label">Total Collected</div>
                    <div class="csi-value green">₹{{ summary().collected | number }}</div>
                  </div>
                  <div class="cs-divider"></div>
                  <div class="cs-item">
                    <div class="csi-label">Balance Outstanding</div>
                    <div class="csi-value red">₹{{ summary().outstanding | number }}</div>
                  </div>
                  <div class="cs-progress">
                    <div class="csp-label">
                      <span>Collection Rate</span>
                      <span class="csp-pct">{{ summary().collection_pct }}%</span>
                    </div>
                    <div class="csp-track">
                      <div class="csp-fill" [style.width.%]="summary().collection_pct"></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>
      </mat-tab>


      <!-- ── Fee Structures ──────────────────────────────────────── -->
      <mat-tab label="Fee Structures">
        <div class="tab-body">

          <div class="fs-toolbar">
            <div>
              <div class="fs-title">Fee Structures</div>
              <div class="fs-sub">Define reusable fee templates to quickly generate invoices</div>
            </div>
            <button class="btn-primary-custom" (click)="openFeeStructureDialog()">
              <mat-icon style="font-size:16px;width:16px;height:16px">add</mat-icon>
              New Structure
            </button>
          </div>

          @if (structuresLoading()) {
            <div class="table-loading">
              <mat-progress-spinner mode="indeterminate" diameter="32" />
            </div>
          } @else if (!feeStructures().length) {
            <div class="table-empty">
              <div class="empty-icon">💰</div>
              <div class="empty-title">No fee structures yet</div>
              <div class="empty-sub">Create a fee structure to quickly generate invoices for students.</div>
              <button class="btn-primary-custom" (click)="openFeeStructureDialog()">
                <mat-icon style="font-size:16px;width:16px;height:16px">add</mat-icon>
                Create First Structure
              </button>
            </div>
          } @else {
            <div class="structures-grid">
              @for (fs of feeStructures(); track fs.id) {
                <div class="fs-card">
                  <div class="fsc-header">
                    <div>
                      <div class="fsc-name">{{ fs.name }}</div>
                      <div class="fsc-meta">
                        <span class="cycle-tag">{{ fs.billing_cycle | titlecase }}</span>
                        <span class="year-tag">{{ fs.academic_year }}</span>
                      </div>
                    </div>
                    <button class="row-menu-btn" [matMenuTriggerFor]="fsMenu">
                      <mat-icon style="font-size:18px;width:18px;height:18px">more_horiz</mat-icon>
                    </button>
                    <mat-menu #fsMenu="matMenu">
                      <button mat-menu-item (click)="editFeeStructure(fs)">
                        <mat-icon>edit</mat-icon> Edit
                      </button>
                      <button mat-menu-item style="color:#EF4444" (click)="deleteFeeStructure(fs)">
                        <mat-icon style="color:#EF4444">delete</mat-icon> Delete
                      </button>
                    </mat-menu>
                  </div>

                  <div class="fsc-heads">
                    @for (head of fs.heads; track head.name) {
                      <div class="fsc-head-row">
                        <span class="fsh-name">{{ head.name }}</span>
                        @if (head.is_optional) {
                          <span class="optional-dot">optional</span>
                        }
                        <span class="fsh-amt">₹{{ head.amount | number }}</span>
                      </div>
                    }
                  </div>

                  <div class="fsc-total">
                    <span>Total</span>
                    <span>₹{{ getStructureTotal(fs) | number }}</span>
                  </div>
                </div>
              }
            </div>
          }
        </div>
      </mat-tab>

    </mat-tab-group>
  `,
  styles: [`
    /* Buttons */
    .btn-primary-custom {
      display: inline-flex; align-items: center; gap: 6px;
      background: var(--blue); color: #fff;
      border: none; border-radius: 8px; padding: 0 16px; height: 36px;
      font-size: 13px; font-weight: 500; cursor: pointer;
      transition: background .15s;
      &:hover { background: #1D4ED8; }
    }
    .btn-outline-custom {
      display: inline-flex; align-items: center; gap: 6px;
      background: #fff; color: var(--text-2);
      border: 1px solid var(--border); border-radius: 8px; padding: 0 14px; height: 36px;
      font-size: 13px; font-weight: 500; cursor: pointer;
      &:hover { background: var(--bg); }
    }
    .btn-outline-sm {
      display: inline-flex; align-items: center;
      background: #fff; color: var(--blue);
      border: 1px solid var(--blue-mid); border-radius: 6px;
      padding: 0 10px; height: 28px; font-size: 12px; font-weight: 500; cursor: pointer;
      &:hover { background: var(--blue-light); }
    }

    /* Tabs */
    .fees-tabs { margin-top: 16px; }
    ::ng-deep .fees-tabs .mat-mdc-tab-body-wrapper { padding-top: 16px; }
    .tab-body { display: flex; flex-direction: column; gap: 12px; }

    /* Metrics */
    .metrics-grid {
      display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 0;
    }
    .metric-card.red::before { background: var(--red); }
    .metric-card.red .mc-icon { background: var(--red-light); color: var(--red); }

    /* Filter bar */
    .filter-bar {
      display: flex; gap: 10px; align-items: center; flex-wrap: wrap;
    }
    .search-box {
      display: flex; align-items: center; gap: 8px;
      background: var(--surface); border: 1px solid var(--border);
      border-radius: 8px; padding: 0 12px; height: 36px;
      flex: 1; min-width: 240px;
      &:focus-within { border-color: var(--blue); box-shadow: 0 0 0 3px rgba(37,99,235,.1); }
      .sb-icon { font-size: 16px; width: 16px; height: 16px; color: var(--text-4); flex-shrink: 0; }
      input {
        flex: 1; border: none; background: transparent; outline: none;
        font-size: 13px; color: var(--text);
        &::placeholder { color: var(--text-4); }
      }
      .sb-clear {
        background: none; border: none; cursor: pointer; color: var(--text-4);
        display: flex; align-items: center; padding: 0;
        &:hover { color: var(--text-2); }
      }
    }
    .filter-selects { display: flex; gap: 8px; }
    .filter-select {
      height: 36px; padding: 0 10px;
      background: var(--surface); border: 1px solid var(--border);
      border-radius: 8px; font-size: 13px; color: var(--text-2);
      outline: none; cursor: pointer;
      &:focus { border-color: var(--blue); }
    }

    /* Table */
    .table-container {
      background: var(--surface); border: 1px solid var(--border);
      border-radius: 10px; overflow: hidden;
    }
    .table-loading, .table-empty {
      display: flex; flex-direction: column; align-items: center;
      justify-content: center; gap: 10px;
      padding: 60px; color: var(--text-3); font-size: 13px;
    }
    .empty-icon  { font-size: 40px; line-height: 1; }
    .empty-title { font-size: 15px; font-weight: 600; color: var(--text-2); }
    .empty-sub   { font-size: 13px; color: var(--text-3); text-align: center; }

    .data-table {
      width: 100%; border-collapse: collapse;
      th {
        text-align: left; padding: 11px 14px;
        font-size: 10px; font-weight: 600;
        text-transform: uppercase; letter-spacing: .4px;
        color: var(--text-4); background: var(--bg);
        border-bottom: 1px solid var(--border);
      }
      td { padding: 11px 14px; border-bottom: 1px solid var(--border-light); vertical-align: middle; }
    }
    .data-row {
      transition: background .1s;
      &:hover { background: #FAFAFA; }
      &:last-child td { border-bottom: none; }
    }

    .student-cell { display: flex; align-items: center; gap: 10px; }
    .student-av {
      width: 30px; height: 30px; border-radius: 8px; flex-shrink: 0;
      color: #fff; font-size: 12px; font-weight: 600;
      display: flex; align-items: center; justify-content: center;
    }
    .cell-primary   { font-size: 13px; font-weight: 500; color: var(--text); }
    .cell-secondary { font-size: 11px; color: var(--text-3); margin-top: 1px; }

    .mono-chip {
      font-family: 'SF Mono', 'Fira Code', monospace;
      font-size: 11.5px; background: var(--bg); color: var(--blue);
      padding: 2px 8px; border-radius: 5px; font-weight: 500; white-space: nowrap;
    }
    .invoice-link {
      cursor: pointer; text-decoration: underline; text-underline-offset: 2px;
      &:hover { opacity: 0.75; }
    }
    .count-chip {
      background: var(--amber-light); color: #92400E;
      font-size: 12px; font-weight: 600; padding: 2px 8px; border-radius: 5px;
    }

    .row-actions { display: flex; align-items: center; gap: 4px; }
    .pay-btn {
      display: inline-flex; align-items: center; gap: 4px;
      background: var(--blue); color: #fff;
      border: none; border-radius: 6px; padding: 0 10px; height: 28px;
      font-size: 12px; font-weight: 500; cursor: pointer;
      &:hover { background: #1D4ED8; }
    }
    .row-menu-btn {
      background: none; border: none; cursor: pointer;
      width: 28px; height: 28px; border-radius: 6px;
      display: flex; align-items: center; justify-content: center; color: var(--text-3);
      &:hover { background: var(--bg); color: var(--text-2); }
    }

    .table-footer {
      display: flex; align-items: center; justify-content: space-between;
      padding: 8px 14px; border-top: 1px solid var(--border-light);
      background: var(--bg);
    }
    .tf-info { font-size: 12px; color: var(--text-3); }

    /* Summary tab */
    .summary-grid-2 {
      display: grid; grid-template-columns: 1fr 1fr; gap: 12px;
    }
    .section-card {
      background: var(--surface); border: 1px solid var(--border); border-radius: 10px; overflow: hidden;
      .sc-header { padding: 14px 16px; border-bottom: 1px solid var(--border-light); }
      .sc-title   { font-size: 13px; font-weight: 600; color: var(--text); }
      .sc-body    { padding: 14px 16px; }
    }

    .status-breakdown { display: flex; flex-direction: column; gap: 12px; }
    .sb-row { display: flex; align-items: center; gap: 10px; }
    .sbr-left { display: flex; align-items: center; gap: 7px; width: 100px; flex-shrink: 0; }
    .sbr-dot  { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
    .sbr-label { font-size: 12px; color: var(--text-2); }
    .sbr-right { display: flex; align-items: center; gap: 8px; flex: 1; }
    .sbr-bar-track { flex: 1; height: 6px; background: var(--border); border-radius: 3px; overflow: hidden; }
    .sbr-bar  { height: 100%; border-radius: 3px; transition: width .3s; }
    .sbr-count { font-size: 12px; font-weight: 600; color: var(--text); width: 28px; text-align: right; }

    .collection-stats { display: flex; flex-direction: column; gap: 12px; }
    .cs-item  { display: flex; justify-content: space-between; align-items: center; }
    .csi-label { font-size: 12px; color: var(--text-3); }
    .csi-value { font-size: 15px; font-weight: 600; color: var(--text);
      &.green { color: var(--green); } &.red { color: var(--red); }
    }
    .cs-divider { height: 1px; background: var(--border-light); }
    .csp-label { display: flex; justify-content: space-between; font-size: 12px; color: var(--text-3); margin-bottom: 6px; }
    .csp-pct   { font-weight: 600; color: var(--blue); }
    .csp-track { height: 8px; background: var(--border); border-radius: 4px; overflow: hidden; }
    .csp-fill  { height: 100%; background: var(--blue); border-radius: 4px; transition: width .3s; }

    /* Fee structures */
    .fs-toolbar {
      display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 16px;
      .fs-title { font-size: 15px; font-weight: 600; color: var(--text); }
      .fs-sub   { font-size: 12px; color: var(--text-3); margin-top: 2px; }
    }
    .structures-grid {
      display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 12px;
    }
    .fs-card {
      background: var(--surface); border: 1px solid var(--border);
      border-radius: 10px; overflow: hidden;
    }
    .fsc-header {
      display: flex; align-items: flex-start; justify-content: space-between;
      padding: 14px 14px 10px; border-bottom: 1px solid var(--border-light);
    }
    .fsc-name { font-size: 13px; font-weight: 600; color: var(--text); margin-bottom: 5px; }
    .fsc-meta { display: flex; gap: 5px; }
    .cycle-tag {
      background: var(--blue-light); color: var(--blue);
      font-size: 10px; font-weight: 600; padding: 2px 7px; border-radius: 4px;
    }
    .year-tag {
      background: var(--bg); color: var(--text-3);
      font-size: 10px; font-weight: 500; padding: 2px 7px; border-radius: 4px;
    }
    .fsc-heads { padding: 8px 14px; display: flex; flex-direction: column; gap: 5px; }
    .fsc-head-row {
      display: flex; align-items: center; gap: 6px;
      font-size: 12px; color: var(--text-2);
    }
    .fsh-name   { flex: 1; }
    .fsh-amt    { font-weight: 600; color: var(--text); }
    .optional-dot {
      font-size: 9px; color: var(--text-4);
      background: var(--bg); padding: 1px 5px; border-radius: 3px;
    }
    .fsc-total {
      display: flex; justify-content: space-between; align-items: center;
      padding: 10px 14px; background: var(--bg); border-top: 1px solid var(--border-light);
      font-size: 12px; color: var(--text-3);
      span:last-child { font-size: 15px; font-weight: 700; color: var(--blue); }
    }
  `],
})
export class FeesComponent implements OnInit {
  private api    = inject(ApiService);
  private snack  = inject(MatSnackBar);
  private dialog = inject(MatDialog);

  invoices          = signal<FeeInvoice[]>([]);
  defaulters        = signal<any[]>([]);
  loading           = signal(true);
  defaultersLoading = signal(false);
  totalInvoices     = signal(0);
  totalOutstanding  = signal(0);
  defaultersCount   = signal(0);
  statusFilter      = signal('');
  searchTerm        = signal('');
  studentIdFilter   = signal('');
  page              = signal(1);
  selectedTab       = signal(0);
  pageSize          = 20;

  summary        = signal({ billed: 0, collected: 0, outstanding: 0, collection_pct: 0 });
  feeStructures  = signal<FeeStructure[]>([]);
  structuresLoading = signal(false);

  statusBreakdown = signal<{ label: string; count: number; pct: number; color: string }[]>([]);

  ngOnInit() {
    this.loadSummary();
    this.loadInvoices();
  }

  loadSummary() {
    this.api.get<{ data: any }>('/fees/collection-summary').subscribe({
      next: (res: any) => {
        const d = res.data;
        // Build summary for metric cards
        const billed      = +d.total_billed      || 0;
        const collected   = +d.total_collected   || 0;
        const outstanding = +d.total_outstanding || 0;
        const collPct     = billed > 0 ? Math.round((collected / billed) * 100) : 0;
        this.summary.set({ billed, collected, outstanding, collection_pct: collPct });
        this.totalOutstanding.set(outstanding);

        // Build status breakdown from the same response
        const total = +d.total_invoices || 0;
        const pct   = (n: number) => total > 0 ? Math.round((n / total) * 100) : 0;
        this.statusBreakdown.set([
          { label: 'Paid',    count: +d.paid    || 0, pct: pct(+d.paid    || 0), color: 'var(--green)' },
          { label: 'Pending', count: +d.pending || 0, pct: pct(+d.pending || 0), color: 'var(--blue)'  },
          { label: 'Partial', count: +d.partial || 0, pct: pct(+d.partial || 0), color: 'var(--amber)' },
          { label: 'Overdue', count: +d.overdue || 0, pct: pct(+d.overdue || 0), color: 'var(--red)'   },
          { label: 'Waived',  count: +d.waived  || 0, pct: pct(+d.waived  || 0), color: 'var(--text-4)'},
        ]);
        this.defaultersCount.set((+d.pending || 0) + (+d.partial || 0) + (+d.overdue || 0));
      },
    });
  }

  loadInvoices() {
    this.loading.set(true);
    const params: Record<string, unknown> = { page: this.page(), limit: this.pageSize };
    if (this.statusFilter())    params['status']     = this.statusFilter();
    if (this.searchTerm())      params['search']     = this.searchTerm();
    if (this.studentIdFilter()) params['student_id'] = this.studentIdFilter();

    this.api.get<PaginatedResponse<FeeInvoice>>('/fees/invoices', params).subscribe({
      next: (res: any) => {
        this.invoices.set(res.data);
        this.totalInvoices.set(res.meta.total);
        // Calc outstanding from invoices
        const out = res.data.reduce((s: number, i: FeeInvoice) =>
          ['pending','partial','overdue'].includes(i.status) ? s + (Number(i.total) - Number(i.paid_amount)) : s, 0);
        this.totalOutstanding.set(out);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  loadDefaulters() {
    this.defaultersLoading.set(true);
    this.api.get<{ data: any[] }>('/fees/defaulters', { overdue_days: '0' }).subscribe({
      next: (res: any) => { this.defaulters.set(res.data); this.defaultersLoading.set(false); },
      error: () => this.defaultersLoading.set(false),
    });
  }

  onTabChange(idx: number) {
    this.selectedTab.set(idx);
    if (idx === 1) this.loadDefaulters();
    if (idx === 2) this.loadSummary();
    if (idx === 3) this.loadFeeStructures();
  }

  loadFeeStructures() {
    this.structuresLoading.set(true);
    this.api.get<any>('/fees/structures').subscribe({
      next: (res: any) => { this.feeStructures.set(res.data ?? []); this.structuresLoading.set(false); },
      error: () => this.structuresLoading.set(false),
    });
  }

  openFeeStructureDialog(existing: FeeStructure | null = null) {
    const ref = this.dialog.open(FeeStructureDialogComponent, {
      data: existing, width: '580px', disableClose: true, maxHeight: '90vh',
    });
    ref.afterClosed().subscribe((result: any) => {
      if (result) {
        this.snack.open(
          existing ? 'Fee structure updated' : 'Fee structure created',
          'OK', { duration: 3000 }
        );
        this.loadFeeStructures();
      }
    });
  }

  editFeeStructure(fs: FeeStructure) { this.openFeeStructureDialog(fs); }

  deleteFeeStructure(fs: FeeStructure) {
    if (!confirm('Delete "' + fs.name + '"? This cannot be undone.')) return;
    this.api.delete<any>('/fees/structures/' + fs.id).subscribe({
      next: () => { this.snack.open('Fee structure deleted', 'OK', { duration: 3000 }); this.loadFeeStructures(); },
      error: (err: any) => this.snack.open(err.error?.error?.message ?? 'Error', 'OK', { duration: 3000 }),
    });
  }

  getStructureTotal(fs: FeeStructure): number {
    return (fs.heads ?? []).reduce((s: number, h: any) => s + (+h.amount || 0), 0);
  }
  onStatusFilter(val: string) { this.studentIdFilter.set(''); this.statusFilter.set(val); this.page.set(1); this.loadInvoices(); }
  onSearch(e: Event) { this.studentIdFilter.set(''); this.searchTerm.set((e.target as HTMLInputElement).value); this.page.set(1); this.loadInvoices(); }
  clearSearch() { this.studentIdFilter.set(''); this.searchTerm.set(''); this.page.set(1); this.loadInvoices(); }
  onPage(e: PageEvent) { this.page.set(e.pageIndex + 1); this.pageSize = e.pageSize; this.loadInvoices(); }

  min(a: number, b: number) { return Math.min(a, b); }

  getBalance(inv: FeeInvoice): number {
    return Number(inv.total) - Number(inv.paid_amount);
  }

  getAvatarColor(name: string): string {
    const colors = ['#2563EB','#7C3AED','#DB2777','#D97706','#059669','#0891B2'];
    return colors[(name.charCodeAt(0) || 0) % colors.length];
  }

  recordPayment(inv: FeeInvoice) {
    if (inv.status === 'paid' || inv.status === 'waived') {
      this.snack.open('Invoice is already ' + inv.status, 'OK', { duration: 2000 });
      return;
    }
    const ref = this.dialog.open(RecordPaymentDialogComponent, {
      data: inv, disableClose: true, width: '480px',
    });
    ref.afterClosed().subscribe((updated: any) => {
      if (updated) {
        this.snack.open('Payment recorded successfully', 'OK', { duration: 3000 });
        this.loadInvoices();
        this.loadSummary();
      }
    });
  }

  deleteInvoice(inv: FeeInvoice) {
    if (inv.status === 'paid') {
      this.snack.open('Paid invoices cannot be deleted. Use Waive instead.', 'OK', { duration: 3000 });
      return;
    }
    if (!confirm('Delete invoice ' + inv.invoice_no + '? This cannot be undone.')) return;
    this.api.delete<any>('/fees/invoices/' + inv.id).subscribe({
      next: () => {
        this.snack.open('Invoice deleted', 'OK', { duration: 3000 });
        this.loadInvoices();
        this.loadSummary();
      },
      error: (err: any) => this.snack.open(err.error?.error?.message ?? 'Delete failed', 'OK', { duration: 3000 }),
    });
  }

  printReceipt(inv: FeeInvoice) {
    this.dialog.open(FeeReceiptDialogComponent, {
      data: inv, width: '560px', maxHeight: '90vh',
    });
  }

  waiveInvoice(inv: FeeInvoice) {
    if (!confirm('Waive invoice ' + inv.invoice_no + '? This cannot be undone.')) return;
    this.api.post<any>('/fees/invoices/' + inv.id + '/waive', { reason: 'Waived by admin' }).subscribe({
      next: () => { this.snack.open('Invoice waived', 'OK', { duration: 3000 }); this.loadInvoices(); this.loadSummary(); },
      error: (err: any) => this.snack.open(err.error?.error?.message ?? 'Error', 'OK', { duration: 3000 }),
    });
  }

  createInvoice() {
    const ref = this.dialog.open(CreateInvoiceDialogComponent, {
      width: '580px', disableClose: true, maxHeight: '90vh',
    });
    ref.afterClosed().subscribe((invoice: any) => {
      if (invoice) {
        this.snack.open('Invoice created — No: ' + invoice.invoice_no, 'OK', { duration: 4000 });
        this.loadInvoices();
        this.loadSummary();
      }
    });
  }

  openBulkInvoice() {
    const ref = this.dialog.open(BulkInvoiceDialogComponent, {
      width: '540px', disableClose: true, maxHeight: '90vh',
    });
    ref.afterClosed().subscribe((result: any) => {
      if (result) {
        this.snack.open(
          result.count + ' invoice(s) generated. Existing invoices were skipped.',
          'OK', { duration: 5000 }
        );
        this.loadInvoices();
        this.loadSummary();
      }
    });
  }

  downloadCsv()   { this.snack.open('Export — coming soon', 'OK', { duration: 2000 }); }
  viewStudentInvoices(studentId: string) {
    this.studentIdFilter.set(studentId);
    this.statusFilter.set('');
    this.searchTerm.set('');
    this.page.set(1);
    this.selectedTab.set(0);
    this.loadInvoices();
  }
}
