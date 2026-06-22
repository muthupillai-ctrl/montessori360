import { Component, inject, signal, computed, OnInit, OnDestroy } from '@angular/core';
import { Subject, debounceTime, distinctUntilChanged, takeUntil } from 'rxjs';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatTabsModule } from '@angular/material/tabs';
import { MatDividerModule } from '@angular/material/divider';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatMenuModule } from '@angular/material/menu';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { FormsModule } from '@angular/forms';
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
    MatSelectModule, MatFormFieldModule, MatInputModule, FormsModule,
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
                      <td>
                        <div class="font-semibold">₹{{ inv.total | number }}</div>
                        @if (inv.discount > 0) {
                          <div class="discount-chip" [title]="inv.discount_note ?? ('Discount: ₹' + inv.discount)">
                            −₹{{ inv.discount | number }}
                            @if (inv.discount_note) { · {{ inv.discount_note }} }
                          </div>
                        }
                      </td>
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
                        @if (fs.allow_multiple) {
                          <span class="repeatable-tag">Repeatable</span>
                        }
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

      <!-- ── Concessions ──────────────────────────────────────── -->
      <mat-tab label="Concessions">
        <div class="tab-body">

          <!-- Sub-tabs: Types | Assignments | Sibling Wizard -->
          <div class="con-subtab-row">
            <button [class]="'con-stab' + (concSubTab()===0?' active':'')" (click)="onConcSubTabChange(0)">
              <i class="ti ti-tag"></i> Concession Types
            </button>
            <button [class]="'con-stab' + (concSubTab()===1?' active':'')" (click)="onConcSubTabChange(1)">
              <i class="ti ti-users"></i> Student Assignments
            </button>
            <button [class]="'con-stab' + (concSubTab()===2?' active':'')" (click)="onConcSubTabChange(2)">
              <i class="ti ti-git-branch"></i> Sibling Wizard
            </button>
          </div>

          <!-- ── Concession Types ── -->
          @if (concSubTab() === 0) {
            <div class="con-toolbar">
              <div class="con-info">
                <div class="con-title">Concession Types</div>
                <div class="con-sub">Define discount rules — Sibling, Scholarship, Staff Ward, etc.</div>
              </div>
              <button class="btn-primary-custom" (click)="openConcessionForm()">
                <mat-icon style="font-size:16px;width:16px;height:16px">add</mat-icon>
                New Type
              </button>
            </div>

            @if (concLoading()) {
              <div class="table-loading"><mat-progress-spinner mode="indeterminate" diameter="32"/></div>
            } @else if (!concessions().length) {
              <div class="table-empty">
                <div class="empty-icon">🏷️</div>
                <div class="empty-title">No concessions yet</div>
                <div class="empty-sub">Create discount types like Sibling (10%), Scholarship (25%), etc.</div>
                <button class="btn-primary-custom" (click)="openConcessionForm()">
                  <mat-icon style="font-size:16px;width:16px;height:16px">add</mat-icon> Create First
                </button>
              </div>
            } @else {
              <div class="con-grid">
                @for (c of concessions(); track c.id) {
                  <div class="con-card" [class.inactive]="!c.is_active">
                    <div class="con-card-header">
                      <div>
                        <span class="cat-pill cat-{{ c.category }}">{{ categoryLabel(c.category) }}</span>
                        <div class="con-card-name">{{ c.name }}</div>
                      </div>
                      <div class="con-value-badge">
                        {{ c.discount_type === 'percentage' ? c.discount_value + '%' : '₹' + c.discount_value }}
                      </div>
                    </div>
                    @if (c.description) {
                      <div class="con-desc">{{ c.description }}</div>
                    }
                    <div class="con-card-footer">
                      <span class="status-dot" [class.active]="c.is_active">
                        {{ c.is_active ? 'Active' : 'Inactive' }}
                      </span>
                      <div class="con-card-actions">
                        <button class="icon-btn" (click)="editConcession(c)" title="Edit">
                          <mat-icon style="font-size:16px;width:16px;height:16px">edit</mat-icon>
                        </button>
                        <button class="icon-btn danger" (click)="removeConcession(c)" title="Delete">
                          <mat-icon style="font-size:16px;width:16px;height:16px">delete</mat-icon>
                        </button>
                      </div>
                    </div>
                  </div>
                }
              </div>
            }
          }

          <!-- ── Student Assignments ── -->
          @if (concSubTab() === 1) {
            <div class="con-toolbar">
              <div class="con-info">
                <div class="con-title">Student Assignments</div>
                <div class="con-sub">Assign concessions to individual students</div>
              </div>
              <button class="btn-primary-custom" (click)="openAssignForm()">
                <mat-icon style="font-size:16px;width:16px;height:16px">add</mat-icon>
                Assign
              </button>
            </div>

            @if (assignLoading()) {
              <div class="table-loading"><mat-progress-spinner mode="indeterminate" diameter="32"/></div>
            } @else if (!assignments().length) {
              <div class="table-empty">
                <div class="empty-icon">👤</div>
                <div class="empty-title">No assignments yet</div>
                <div class="empty-sub">Assign a concession type to a student to apply discounts on their invoices.</div>
              </div>
            } @else {
              <div class="table-container">
                <table class="data-table">
                  <thead>
                    <tr>
                      <th>Student</th>
                      <th>Class</th>
                      <th>Concession</th>
                      <th>Discount</th>
                      <th>Academic Year</th>
                      <th>Notes</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (a of assignments(); track a.id) {
                      <tr class="data-row">
                        <td>
                          <div class="student-cell">
                            <div class="student-av" [style.background]="getAvatarColor(a.student_name ?? '')">
                              {{ (a.student_name ?? '?')[0] }}
                            </div>
                            <div class="cell-primary">{{ a.student_name }}</div>
                          </div>
                        </td>
                        <td class="text-sm">{{ a.class_name ?? '—' }}</td>
                        <td>
                          <span class="cat-pill cat-{{ a.category ?? 'custom' }}">
                            {{ a.concession_name }}
                          </span>
                        </td>
                        <td class="font-semibold" style="color:var(--green)">
                          {{ a.discount_type === 'percentage' ? a.discount_value + '%' : '₹' + a.discount_value }}
                        </td>
                        <td class="text-sm">{{ a.academic_year ?? 'All years' }}</td>
                        <td class="text-sm" style="color:var(--text-3)">{{ a.notes ?? '—' }}</td>
                        <td>
                          <button class="icon-btn danger" (click)="deleteAssignment(a)" title="Remove">
                            <mat-icon style="font-size:16px;width:16px;height:16px">delete</mat-icon>
                          </button>
                        </td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
            }
          }

          <!-- ── Sibling Wizard ── -->
          @if (concSubTab() === 2) {
            <div class="wiz-shell">

              <!-- Left panel: configuration steps -->
              <div class="wiz-left">

                <!-- Step 1 -->
                <div class="wiz-card" [class.wiz-card-done]="!!bulkConcessionId">
                  <div class="wiz-step-head">
                    <div class="wiz-badge" [class.done]="!!bulkConcessionId">
                      @if (bulkConcessionId) { <mat-icon class="wiz-check">check</mat-icon> } @else { 1 }
                    </div>
                    <div>
                      <div class="wiz-step-title">Select Concession</div>
                      <div class="wiz-step-sub">Choose which discount to apply to the sibling group</div>
                    </div>
                  </div>
                  <div class="wiz-fields">
                    <div class="wiz-field-group">
                      <label class="wiz-label">Concession type *</label>
                      <select class="wiz-select" [(ngModel)]="bulkConcessionId">
                        <option value="">— Choose concession —</option>
                        @for (c of activeConcessions(); track c.id) {
                          <option [value]="c.id">
                            {{ c.name }} &nbsp;·&nbsp; {{ c.discount_type === 'percentage' ? c.discount_value + '%' : '₹' + c.discount_value }}
                          </option>
                        }
                      </select>
                    </div>
                    <div class="wiz-field-group">
                      <label class="wiz-label">Academic year <span class="wiz-optional">(optional)</span></label>
                      <input class="wiz-input" placeholder="e.g. 2025-26" [(ngModel)]="bulkAcademicYear" />
                    </div>
                  </div>
                </div>

                <!-- Step 2 -->
                <div class="wiz-card">
                  <div class="wiz-step-head">
                    <div class="wiz-badge" [class.done]="wizardGroup().length >= 2">
                      @if (wizardGroup().length >= 2) { <mat-icon class="wiz-check">check</mat-icon> } @else { 2 }
                    </div>
                    <div>
                      <div class="wiz-step-title">Build Sibling Group</div>
                      <div class="wiz-step-sub">Search and add all siblings who share this concession</div>
                    </div>
                  </div>
                  <div class="wiz-search-block">
                    <div class="wiz-search-wrap">
                      <mat-icon class="wiz-search-icon">search</mat-icon>
                      <input class="wiz-search-input"
                             placeholder="Search by name or admission number…"
                             [value]="wizardSearchQuery()"
                             (input)="onWizardSearch($event)"
                             autocomplete="off" />
                      @if (wizardSearching()) {
                        <mat-progress-spinner class="wiz-spin" mode="indeterminate" diameter="16"/>
                      }
                    </div>
                    @if (wizardResults().length) {
                      <div class="wiz-results">
                        @for (s of wizardResults(); track s.id) {
                          <div class="wiz-result-row" [class.wiz-result-added]="isInGroup(s.id)" (click)="addToGroup(s)">
                            <div class="wiz-av" [style.background]="getAvatarColor(s.first_name)">{{ s.first_name[0] }}</div>
                            <div class="wiz-result-info">
                              <div class="wiz-result-name">{{ s.first_name }} {{ s.last_name }}</div>
                              <div class="wiz-result-meta">{{ s.admission_no }}@if (s.class_name) { &nbsp;·&nbsp; {{ s.class_name }} }</div>
                            </div>
                            @if (isInGroup(s.id)) {
                              <span class="wiz-added-badge"><mat-icon style="font-size:12px;width:12px;height:12px;vertical-align:middle">check</mat-icon> Added</span>
                            } @else {
                              <span class="wiz-add-hint">+ Add</span>
                            }
                          </div>
                        }
                      </div>
                    }
                  </div>
                </div>

                <!-- Step 3: Apply -->
                <div class="wiz-card wiz-apply-card">
                  <div class="wiz-step-head">
                    <div class="wiz-badge">3</div>
                    <div>
                      <div class="wiz-step-title">Apply Discount</div>
                      <div class="wiz-step-sub">Assigns the concession to every student in the group</div>
                    </div>
                  </div>
                  @if (!bulkConcessionId || wizardGroup().length < 2) {
                    <div class="wiz-checklist">
                      <div class="wiz-check-row" [class.ok]="!!bulkConcessionId">
                        <mat-icon>{{ bulkConcessionId ? 'check_circle' : 'radio_button_unchecked' }}</mat-icon>
                        Concession selected
                      </div>
                      <div class="wiz-check-row" [class.ok]="wizardGroup().length >= 2">
                        <mat-icon>{{ wizardGroup().length >= 2 ? 'check_circle' : 'radio_button_unchecked' }}</mat-icon>
                        At least 2 siblings added
                      </div>
                    </div>
                  }
                  <button class="wiz-apply-btn"
                          [disabled]="!bulkConcessionId || wizardGroup().length < 2 || bulkApplying()"
                          (click)="applyWizardDiscount()">
                    @if (bulkApplying()) {
                      <mat-progress-spinner mode="indeterminate" diameter="16"/>
                      Applying…
                    } @else {
                      <mat-icon>bolt</mat-icon>
                      Apply to {{ wizardGroup().length || 0 }} Student{{ wizardGroup().length !== 1 ? 's' : '' }}
                    }
                  </button>
                </div>

              </div>

              <!-- Right panel: live group roster -->
              <div class="wiz-right">
                <div class="wiz-roster-card">
                  <div class="wiz-roster-head">
                    <div>
                      <div class="wiz-roster-title">Sibling Group</div>
                      <div class="wiz-roster-sub">{{ wizardGroup().length }} student{{ wizardGroup().length !== 1 ? 's' : '' }} added</div>
                    </div>
                    @if (wizardGroup().length) {
                      <button class="wiz-clear-btn" (click)="clearWizardGroup()" title="Clear group">
                        <mat-icon style="font-size:16px;width:16px;height:16px">delete_sweep</mat-icon>
                        Clear all
                      </button>
                    }
                  </div>

                  @if (!wizardGroup().length) {
                    <div class="wiz-empty-roster">
                      <mat-icon class="wiz-empty-icon">group_add</mat-icon>
                      <div class="wiz-empty-text">No students added yet</div>
                      <div class="wiz-empty-hint">Search students on the left and click to add them</div>
                    </div>
                  } @else {
                    <div class="wiz-roster-list">
                      @for (s of wizardGroup(); track s.id; let i = $index) {
                        <div class="wiz-roster-row">
                          <span class="wiz-roster-num">{{ i + 1 }}</span>
                          <div class="wiz-av" [style.background]="getAvatarColor(s.first_name)">{{ s.first_name[0] }}</div>
                          <div class="wiz-roster-info">
                            <div class="wiz-roster-name">{{ s.first_name }} {{ s.last_name }}</div>
                            <div class="wiz-roster-adm">{{ s.admission_no }}</div>
                          </div>
                          <button class="wiz-remove-btn" (click)="removeFromGroup(s.id)" title="Remove">
                            <mat-icon style="font-size:16px;width:16px;height:16px">close</mat-icon>
                          </button>
                        </div>
                      }
                    </div>

                    @if (bulkConcessionId) {
                      <div class="wiz-roster-summary">
                        <mat-icon style="font-size:14px;width:14px;height:14px;color:#7C3AED">local_offer</mat-icon>
                        {{ selectedConcessionLabel() }}
                        will be applied to {{ wizardGroup().length }} student{{ wizardGroup().length !== 1 ? 's' : '' }}
                      </div>
                    }
                  }
                </div>
              </div>

            </div>
          }

          <!-- ── Inline concession form ── -->
          @if (showConcessionForm()) {
            <div class="modal-overlay" (click)="closeConcessionForm()">
              <div class="modal-card" (click)="$event.stopPropagation()">
                <div class="modal-header">
                  <div class="modal-title">{{ editingConcession() ? 'Edit' : 'New' }} Concession</div>
                  <button class="modal-close" (click)="closeConcessionForm()">
                    <mat-icon>close</mat-icon>
                  </button>
                </div>
                <div class="modal-body">
                  <label class="field-label">Name *</label>
                  <input class="field-input" [(ngModel)]="conForm.name" placeholder="e.g. Sibling Discount" />

                  <label class="field-label">Category *</label>
                  <select class="field-select" [(ngModel)]="conForm.category">
                    <option value="sibling">Sibling</option>
                    <option value="scholarship">Scholarship</option>
                    <option value="staff_ward">Staff Ward</option>
                    <option value="need_based">Need Based</option>
                    <option value="custom">Custom</option>
                  </select>

                  <label class="field-label">Discount Type *</label>
                  <select class="field-select" [(ngModel)]="conForm.discount_type">
                    <option value="percentage">Percentage (%)</option>
                    <option value="fixed">Fixed Amount (₹)</option>
                  </select>

                  <label class="field-label">
                    {{ conForm.discount_type === 'percentage' ? 'Discount %' : 'Discount Amount (₹)' }} *
                  </label>
                  <input class="field-input" type="number" min="0"
                         [(ngModel)]="conForm.discount_value" placeholder="e.g. 10" />

                  <label class="field-label">Description (optional)</label>
                  <textarea class="field-textarea" [(ngModel)]="conForm.description"
                            placeholder="Brief description…" rows="2"></textarea>

                  @if (editingConcession()) {
                    <label class="field-label">Status</label>
                    <select class="field-select" [(ngModel)]="conForm.is_active">
                      <option [ngValue]="true">Active</option>
                      <option [ngValue]="false">Inactive</option>
                    </select>
                  }
                </div>
                <div class="modal-footer">
                  <button class="btn-outline-custom" (click)="closeConcessionForm()">Cancel</button>
                  <button class="btn-primary-custom" [disabled]="concSaving()" (click)="saveConcession()">
                    {{ concSaving() ? 'Saving…' : 'Save' }}
                  </button>
                </div>
              </div>
            </div>
          }

          <!-- ── Inline assign form ── -->
          @if (showAssignForm()) {
            <div class="modal-overlay" (click)="closeAssignForm()">
              <div class="modal-card" (click)="$event.stopPropagation()">
                <div class="modal-header">
                  <div class="modal-title">Assign Concession to Student</div>
                  <button class="modal-close" (click)="closeAssignForm()">
                    <mat-icon>close</mat-icon>
                  </button>
                </div>
                <div class="modal-body">

                  <!-- Student search -->
                  <label class="field-label">Search Student *</label>
                  <div class="student-search-wrap">
                    <input class="field-input"
                           [value]="studentSearchQuery()"
                           (input)="onStudentSearchInput($event)"
                           placeholder="Name or admission number…"
                           autocomplete="off" />
                    @if (studentSearching()) {
                      <mat-progress-spinner mode="indeterminate" diameter="16" class="search-spin"/>
                    }
                    @if (studentSearchResults().length && !resolvedStudent()) {
                      <div class="student-dropdown">
                        @for (s of studentSearchResults(); track s.id) {
                          <div class="student-drop-item" (click)="selectStudent(s)">
                            <div class="sd-av" [style.background]="getAvatarColor(s.first_name)">
                              {{ s.first_name[0] }}
                            </div>
                            <div>
                              <div class="sd-name">{{ s.first_name }} {{ s.last_name }}</div>
                              <div class="sd-adm">{{ s.admission_no }} · {{ s.class_name ?? 'No class' }}</div>
                            </div>
                          </div>
                        }
                      </div>
                    }
                  </div>

                  <!-- Resolved student card -->
                  @if (resolvedStudent()) {
                    <div class="resolved-card">
                      <div class="rc-av" [style.background]="getAvatarColor(resolvedStudent().first_name)">
                        {{ resolvedStudent().first_name[0] }}
                      </div>
                      <div class="rc-info">
                        <div class="rc-name">{{ resolvedStudent().first_name }} {{ resolvedStudent().last_name }}</div>
                        <div class="rc-meta">{{ resolvedStudent().admission_no }} · {{ resolvedStudent().class_name ?? 'No class' }}</div>
                      </div>
                      <button class="rc-clear" (click)="clearResolvedStudent()" title="Change student">
                        <mat-icon style="font-size:16px;width:16px;height:16px">close</mat-icon>
                      </button>
                    </div>
                  }

                  <label class="field-label">Concession *</label>
                  <select class="field-select" [(ngModel)]="assignForm.concession_id">
                    <option value="">— Choose —</option>
                    @for (c of activeConcessions(); track c.id) {
                      <option [value]="c.id">{{ c.name }}</option>
                    }
                  </select>

                  <label class="field-label">Academic Year (optional)</label>
                  <input class="field-input" [(ngModel)]="assignForm.academic_year"
                         placeholder="e.g. 2025-26" />

                  <label class="field-label">Notes (optional)</label>
                  <input class="field-input" [(ngModel)]="assignForm.notes"
                         placeholder="e.g. Second child enrolled" />
                </div>
                <div class="modal-footer">
                  <button class="btn-outline-custom" (click)="closeAssignForm()">Cancel</button>
                  <button class="btn-primary-custom"
                          [disabled]="assignSaving() || !resolvedStudent() || !assignForm.concession_id"
                          (click)="saveAssignment()">
                    {{ assignSaving() ? 'Saving…' : 'Assign' }}
                  </button>
                </div>
              </div>
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

    .discount-chip {
      display: inline-flex; align-items: center; gap: 3px;
      font-size: 10px; font-weight: 600; color: #059669;
      background: #DCFCE7; border-radius: 4px; padding: 1px 5px; margin-top: 3px;
      max-width: 180px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
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
    .repeatable-tag {
      background: #FFF7ED; color: #C2410C;
      font-size: 10px; font-weight: 700; padding: 2px 7px; border-radius: 4px;
      border: 1px solid #FED7AA;
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

    /* ── Concessions ─────────────────────────── */
    .con-subtab-row {
      display: flex; gap: 6px; margin-bottom: 16px;
    }
    .con-stab {
      display: inline-flex; align-items: center; gap: 6px;
      padding: 6px 14px; border-radius: 8px; font-size: 13px; font-weight: 500;
      border: 1px solid var(--border); background: #fff; color: var(--text-2); cursor: pointer;
      &.active { background: var(--blue); color: #fff; border-color: var(--blue); }
      i { font-size: 15px; }
    }
    .con-toolbar {
      display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 16px;
    }
    .con-title { font-size: 15px; font-weight: 600; color: var(--text); }
    .con-sub   { font-size: 12px; color: var(--text-3); margin-top: 2px; }
    .con-grid  {
      display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 12px;
    }
    .con-card {
      background: var(--surface); border: 1px solid var(--border);
      border-radius: 10px; padding: 14px; display: flex; flex-direction: column; gap: 8px;
      &.inactive { opacity: .65; }
    }
    .con-card-header {
      display: flex; align-items: flex-start; justify-content: space-between;
    }
    .con-card-name {
      font-size: 13px; font-weight: 600; color: var(--text); margin-top: 5px;
    }
    .con-value-badge {
      font-size: 18px; font-weight: 700; color: var(--green); white-space: nowrap;
    }
    .con-desc { font-size: 12px; color: var(--text-3); }
    .con-card-footer {
      display: flex; align-items: center; justify-content: space-between; margin-top: 4px;
    }
    .status-dot {
      font-size: 11px; font-weight: 600; padding: 2px 8px; border-radius: 4px;
      background: var(--red-light); color: var(--red);
      &.active { background: var(--green-light, #DCFCE7); color: var(--green); }
    }
    .con-card-actions { display: flex; gap: 4px; }
    .icon-btn {
      width: 28px; height: 28px; display: inline-flex; align-items: center; justify-content: center;
      border: 1px solid var(--border); border-radius: 6px; background: #fff; cursor: pointer;
      color: var(--text-3);
      &:hover { background: var(--bg); }
      &.danger:hover { background: var(--red-light); color: var(--red); border-color: var(--red); }
    }
    /* category pills */
    .cat-pill {
      font-size: 10px; font-weight: 700; padding: 2px 8px; border-radius: 4px;
      text-transform: uppercase; letter-spacing: .5px;
    }
    .cat-sibling    { background: #EDE9FE; color: #7C3AED; }
    .cat-scholarship{ background: #FEF3C7; color: #D97706; }
    .cat-staff_ward { background: #DBEAFE; color: #2563EB; }
    .cat-need_based { background: #DCFCE7; color: #059669; }
    .cat-custom     { background: var(--bg); color: var(--text-3); }
    /* ── Sibling wizard (two-panel redesign) ────────────────────────────── */
    .wiz-shell {
      display: grid; grid-template-columns: 1fr 340px; gap: 20px; align-items: start;
    }
    .wiz-left  { display: flex; flex-direction: column; gap: 14px; }
    .wiz-card {
      background: var(--surface); border: 1px solid var(--border); border-radius: 12px;
      padding: 20px; transition: border-color .2s;
    }
    .wiz-card-done { border-color: #A78BFA; }
    .wiz-step-head { display: flex; gap: 14px; align-items: flex-start; margin-bottom: 16px; }
    .wiz-badge {
      min-width: 28px; height: 28px; border-radius: 50%;
      background: #E5E7EB; color: #6B7280; font-size: 12px; font-weight: 700;
      display: flex; align-items: center; justify-content: center; flex-shrink: 0;
      transition: background .2s, color .2s;
    }
    .wiz-badge.done { background: #7C3AED; color: #fff; }
    .wiz-check { font-size: 14px !important; width: 14px !important; height: 14px !important; }
    .wiz-step-title { font-size: 14px; font-weight: 600; color: var(--text); }
    .wiz-step-sub   { font-size: 12px; color: var(--text-3); margin-top: 2px; }
    .wiz-fields { display: flex; flex-direction: column; gap: 12px; }
    .wiz-field-group { display: flex; flex-direction: column; gap: 5px; }
    .wiz-label { font-size: 12px; font-weight: 600; color: var(--text-2); }
    .wiz-optional { font-weight: 400; color: var(--text-3); }
    .wiz-select, .wiz-input {
      height: 38px; border: 1px solid var(--border); border-radius: 8px; padding: 0 12px;
      font-size: 13px; color: var(--text); width: 100%; box-sizing: border-box;
      background: var(--bg);
      &:focus { outline: none; border-color: #7C3AED; box-shadow: 0 0 0 3px rgba(124,58,237,.1); }
    }
    .wiz-select { cursor: pointer; }
    /* Search block */
    .wiz-search-block { position: relative; }
    .wiz-search-wrap {
      display: flex; align-items: center; gap: 8px;
      border: 1px solid var(--border); border-radius: 8px; padding: 0 12px;
      background: var(--bg); height: 42px;
      &:focus-within { border-color: #7C3AED; box-shadow: 0 0 0 3px rgba(124,58,237,.1); }
    }
    .wiz-search-icon { font-size: 18px; width: 18px; height: 18px; color: var(--text-3); flex-shrink: 0; }
    .wiz-search-input {
      flex: 1; border: none; background: transparent; font-size: 13px; color: var(--text);
      &:focus { outline: none; }
      &::placeholder { color: var(--text-3); }
    }
    .wiz-spin { flex-shrink: 0; }
    .wiz-results {
      position: absolute; top: calc(100% + 4px); left: 0; right: 0; z-index: 20;
      background: #fff; border: 1px solid var(--border); border-radius: 10px;
      box-shadow: 0 8px 30px rgba(0,0,0,.12); overflow: hidden;
    }
    .wiz-result-row {
      display: flex; align-items: center; gap: 10px; padding: 10px 14px; cursor: pointer;
      transition: background .15s;
      &:not(:last-child) { border-bottom: 1px solid var(--border); }
      &:hover:not(.wiz-result-added) { background: #F5F3FF; }
    }
    .wiz-result-added { opacity: .55; cursor: default; }
    .wiz-av {
      width: 34px; height: 34px; border-radius: 50%; flex-shrink: 0;
      display: flex; align-items: center; justify-content: center;
      color: #fff; font-size: 13px; font-weight: 700;
    }
    .wiz-result-info { flex: 1; min-width: 0; }
    .wiz-result-name { font-size: 13px; font-weight: 600; color: var(--text); }
    .wiz-result-meta { font-size: 11px; color: var(--text-3); }
    .wiz-added-badge {
      font-size: 11px; font-weight: 600; color: #7C3AED;
      background: #EDE9FE; padding: 2px 8px; border-radius: 20px; white-space: nowrap;
      display: flex; align-items: center; gap: 2px;
    }
    .wiz-add-hint { font-size: 12px; color: #7C3AED; font-weight: 500; white-space: nowrap; }
    /* Step 3 — apply */
    .wiz-apply-card { }
    .wiz-checklist { display: flex; flex-direction: column; gap: 6px; margin-bottom: 14px; }
    .wiz-check-row {
      display: flex; align-items: center; gap: 6px; font-size: 13px; color: var(--text-3);
      mat-icon { font-size: 16px; width: 16px; height: 16px; }
      &.ok { color: #059669; }
    }
    .wiz-apply-btn {
      display: flex; align-items: center; gap: 8px; width: 100%; justify-content: center;
      height: 44px; border-radius: 10px; border: none; cursor: pointer; font-size: 14px; font-weight: 600;
      background: #7C3AED; color: #fff; transition: background .2s, opacity .2s;
      mat-icon { font-size: 18px; width: 18px; height: 18px; }
      &:hover:not(:disabled) { background: #6D28D9; }
      &:disabled { opacity: .4; cursor: not-allowed; }
    }
    /* Right panel — roster */
    .wiz-right { position: sticky; top: 80px; }
    .wiz-roster-card {
      background: var(--surface); border: 1px solid var(--border); border-radius: 12px;
      overflow: hidden;
    }
    .wiz-roster-head {
      display: flex; align-items: center; justify-content: space-between;
      padding: 14px 16px; border-bottom: 1px solid var(--border); background: #FAFAFF;
    }
    .wiz-roster-title { font-size: 13px; font-weight: 700; color: var(--text); }
    .wiz-roster-sub   { font-size: 11px; color: var(--text-3); margin-top: 1px; }
    .wiz-clear-btn {
      display: flex; align-items: center; gap: 4px; border: 1px solid #FCA5A5; border-radius: 6px;
      background: #FEF2F2; color: #DC2626; font-size: 11px; font-weight: 600;
      padding: 4px 8px; cursor: pointer; white-space: nowrap;
      &:hover { background: #FEE2E2; }
    }
    .wiz-empty-roster {
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      padding: 40px 20px; text-align: center;
    }
    .wiz-empty-icon { font-size: 40px; width: 40px; height: 40px; color: #D1D5DB; }
    .wiz-empty-text  { font-size: 13px; font-weight: 600; color: var(--text-2); margin-top: 10px; }
    .wiz-empty-hint  { font-size: 11px; color: var(--text-3); margin-top: 4px; }
    .wiz-roster-list { max-height: 420px; overflow-y: auto; }
    .wiz-roster-row {
      display: flex; align-items: center; gap: 10px; padding: 10px 14px;
      &:not(:last-child) { border-bottom: 1px solid var(--border); }
      &:hover { background: var(--bg); }
    }
    .wiz-roster-num {
      font-size: 11px; font-weight: 700; color: var(--text-3); width: 16px; text-align: center; flex-shrink: 0;
    }
    .wiz-roster-info { flex: 1; min-width: 0; }
    .wiz-roster-name { font-size: 13px; font-weight: 600; color: var(--text); }
    .wiz-roster-adm  { font-size: 11px; color: var(--text-3); }
    .wiz-remove-btn {
      width: 26px; height: 26px; border: none; background: none; cursor: pointer; border-radius: 6px;
      color: var(--text-3); display: flex; align-items: center; justify-content: center;
      flex-shrink: 0;
      &:hover { background: #FEE2E2; color: #DC2626; }
    }
    .wiz-roster-summary {
      display: flex; align-items: center; gap: 6px;
      padding: 10px 14px; border-top: 1px solid var(--border); background: #F5F3FF;
      font-size: 12px; color: #5B21B6; font-weight: 500;
    }
    /* Legacy sg-* kept for non-wizard uses */
    .sg-members { display: flex; flex-direction: column; gap: 8px; }
    .sg-member  { display: flex; align-items: center; gap: 10px; }
    .sg-av {
      width: 32px; height: 32px; border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
      color: #fff; font-size: 13px; font-weight: 600; flex-shrink: 0;
    }
    .sg-name { font-size: 13px; font-weight: 600; color: var(--text); }
    .sg-adm  { font-size: 11px; color: var(--text-3); }
    .year-input {
      height: 36px; border: 1px solid var(--border); border-radius: 8px; padding: 0 10px;
      font-size: 13px; color: var(--text); width: 180px;
      &:focus { outline: none; border-color: var(--blue); }
    }
    /* Modal overlay */
    .modal-overlay {
      position: fixed; inset: 0; background: rgba(0,0,0,.45);
      display: flex; align-items: center; justify-content: center; z-index: 1000;
    }
    .modal-card {
      background: #fff; border-radius: 12px; width: 480px; max-height: 90vh;
      display: flex; flex-direction: column; overflow: hidden;
      box-shadow: 0 20px 60px rgba(0,0,0,.2);
    }
    .modal-header {
      display: flex; align-items: center; justify-content: space-between;
      padding: 16px 20px; border-bottom: 1px solid var(--border);
    }
    .modal-title { font-size: 15px; font-weight: 600; color: var(--text); }
    .modal-close {
      width: 32px; height: 32px; display: flex; align-items: center; justify-content: center;
      border: none; background: none; cursor: pointer; border-radius: 6px; color: var(--text-3);
      &:hover { background: var(--bg); }
    }
    .modal-body {
      padding: 16px 20px; overflow-y: auto; display: flex; flex-direction: column; gap: 10px;
    }
    .modal-footer {
      display: flex; gap: 8px; justify-content: flex-end;
      padding: 14px 20px; border-top: 1px solid var(--border);
    }
    .field-label { font-size: 12px; font-weight: 600; color: var(--text-2); }
    .field-input, .field-select, .field-textarea {
      width: 100%; height: 36px; border: 1px solid var(--border); border-radius: 8px;
      padding: 0 10px; font-size: 13px; color: var(--text); box-sizing: border-box;
      &:focus { outline: none; border-color: var(--blue); }
    }
    .field-select { cursor: pointer; }
    .field-textarea { height: auto; padding: 8px 10px; resize: vertical; }
    /* Student search in assign form */
    .student-search-wrap { position: relative; }
    .search-spin { position: absolute; right: 10px; top: 10px; }
    .student-dropdown {
      position: absolute; top: 100%; left: 0; right: 0; z-index: 10;
      background: #fff; border: 1px solid var(--border); border-radius: 8px;
      box-shadow: 0 4px 20px rgba(0,0,0,.1); max-height: 200px; overflow-y: auto;
    }
    .student-drop-item {
      display: flex; align-items: center; gap: 10px; padding: 10px 12px; cursor: pointer;
      &:hover { background: var(--bg); }
    }
    .sd-av {
      width: 32px; height: 32px; border-radius: 50%; flex-shrink: 0;
      display: flex; align-items: center; justify-content: center;
      color: #fff; font-size: 13px; font-weight: 600;
    }
    .sd-name { font-size: 13px; font-weight: 600; color: var(--text); }
    .sd-adm  { font-size: 11px; color: var(--text-3); }
    .resolved-card {
      display: flex; align-items: center; gap: 10px; padding: 10px 12px;
      background: #EEF2FF; border: 1px solid #C7D2FE; border-radius: 8px;
    }
    .rc-av {
      width: 36px; height: 36px; border-radius: 50%; flex-shrink: 0;
      display: flex; align-items: center; justify-content: center;
      color: #fff; font-size: 14px; font-weight: 700;
    }
    .rc-info { flex: 1; }
    .rc-name { font-size: 13px; font-weight: 600; color: #3730A3; }
    .rc-meta { font-size: 11px; color: #6366F1; }
    .rc-clear {
      width: 28px; height: 28px; display: flex; align-items: center; justify-content: center;
      border: none; background: rgba(99,102,241,.1); border-radius: 6px; cursor: pointer;
      color: #6366F1;
      &:hover { background: rgba(99,102,241,.2); }
    }
  `],
})
export class FeesComponent implements OnInit, OnDestroy {
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

  // ── Concessions ───────────────────────────────────────────────────────────
  concSubTab       = signal(0);
  concessions      = signal<any[]>([]);
  assignments      = signal<any[]>([]);
  siblingGroups    = signal<any[]>([]);
  concLoading      = signal(false);
  assignLoading    = signal(false);
  siblingLoading   = signal(false);
  concSaving       = signal(false);
  assignSaving     = signal(false);
  bulkApplying     = signal(false);
  showConcessionForm = signal(false);
  showAssignForm   = signal(false);
  editingConcession = signal<any>(null);
  bulkConcessionId  = '';
  bulkAcademicYear  = '';

  // Sibling wizard — manual group builder
  wizardGroup       = signal<any[]>([]);
  wizardSearchQuery = signal('');
  wizardResults     = signal<any[]>([]);
  wizardSearching   = signal(false);
  private wizardSearch$ = new Subject<string>();

  activeConcessions = computed(() => this.concessions().filter(c => c.is_active));
  selectedConcessionLabel = computed(() => {
    const c = this.activeConcessions().find(x => x.id === this.bulkConcessionId);
    return c ? c.name : '';
  });
  siblingConcessions = computed(() => this.concessions().filter(c => c.is_active && c.category === 'sibling'));

  private destroy$ = new Subject<void>();

  conForm: any = {
    name: '', category: 'sibling', discount_type: 'percentage', discount_value: 0, description: '', is_active: true,
  };
  assignForm: any = { student_id: '', concession_id: '', academic_year: '', notes: '' };

  // Student search in assign form
  studentSearchQuery  = signal('');
  studentSearchResults = signal<any[]>([]);
  studentSearching    = signal(false);
  resolvedStudent     = signal<any>(null);
  private studentSearch$ = new Subject<string>();

  ngOnInit() {
    this.loadSummary();
    this.loadInvoices();
    this.studentSearch$.pipe(
      debounceTime(300), distinctUntilChanged(), takeUntil(this.destroy$),
    ).subscribe(q => this.runStudentSearch(q));
    this.wizardSearch$.pipe(
      debounceTime(300), distinctUntilChanged(), takeUntil(this.destroy$),
    ).subscribe(q => this.runWizardSearch(q));
  }

  ngOnDestroy() { this.destroy$.next(); this.destroy$.complete(); }

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
    if (idx === 4) this.loadConcessions();
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
      width: '700px', minWidth: '640px', disableClose: true, maxHeight: '92vh',
      panelClass: 'no-pad-dialog',
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

  // ── Concessions ───────────────────────────────────────────────────────────

  loadConcessions() {
    this.concLoading.set(true);
    this.api.get<any>('/fees/concessions').subscribe({
      next: (res: any) => { this.concessions.set(res.data ?? []); this.concLoading.set(false); },
      error: () => this.concLoading.set(false),
    });
  }

  loadAssignments() {
    this.assignLoading.set(true);
    this.api.get<any>('/fees/concessions/assignments').subscribe({
      next: (res: any) => { this.assignments.set(res.data ?? []); this.assignLoading.set(false); },
      error: () => this.assignLoading.set(false),
    });
  }

  loadSiblingGroups() {
    this.siblingLoading.set(true);
    this.api.get<any>('/fees/concessions/siblings').subscribe({
      next: (res: any) => { this.siblingGroups.set(res.data ?? []); this.siblingLoading.set(false); },
      error: () => this.siblingLoading.set(false),
    });
  }

  categoryLabel(cat: string): string {
    const map: Record<string, string> = {
      sibling: 'Sibling', scholarship: 'Scholarship',
      staff_ward: 'Staff Ward', need_based: 'Need Based', custom: 'Custom',
    };
    return map[cat] ?? cat;
  }

  openConcessionForm() {
    this.editingConcession.set(null);
    this.conForm = { name: '', category: 'sibling', discount_type: 'percentage', discount_value: 0, description: '', is_active: true };
    this.showConcessionForm.set(true);
  }

  editConcession(c: any) {
    this.editingConcession.set(c);
    this.conForm = { ...c };
    this.showConcessionForm.set(true);
  }

  closeConcessionForm() { this.showConcessionForm.set(false); this.editingConcession.set(null); }

  saveConcession() {
    if (!this.conForm.name || !this.conForm.discount_value) {
      this.snack.open('Name and discount value are required', 'OK', { duration: 3000 });
      return;
    }
    this.concSaving.set(true);
    const editing = this.editingConcession();
    const req$ = editing
      ? this.api.put<any>('/fees/concessions/' + editing.id, this.conForm)
      : this.api.post<any>('/fees/concessions', this.conForm);
    req$.subscribe({
      next: () => {
        this.snack.open(editing ? 'Concession updated' : 'Concession created', 'OK', { duration: 3000 });
        this.closeConcessionForm();
        this.concSaving.set(false);
        this.loadConcessions();
      },
      error: (err: any) => {
        this.snack.open(err.error?.error?.message ?? 'Error saving concession', 'OK', { duration: 3000 });
        this.concSaving.set(false);
      },
    });
  }

  removeConcession(c: any) {
    if (!confirm('Delete "' + c.name + '"? Students currently assigned to it will lose the concession.')) return;
    this.api.delete<any>('/fees/concessions/' + c.id).subscribe({
      next: () => { this.snack.open('Concession deleted', 'OK', { duration: 3000 }); this.loadConcessions(); },
      error: (err: any) => this.snack.open(err.error?.error?.message ?? 'Error', 'OK', { duration: 3000 }),
    });
  }

  openAssignForm() {
    if (!this.concessions().length) this.loadConcessions();
    this.assignForm = { student_id: '', concession_id: '', academic_year: '', notes: '' };
    this.studentSearchQuery.set('');
    this.studentSearchResults.set([]);
    this.resolvedStudent.set(null);
    this.showAssignForm.set(true);
  }

  closeAssignForm() { this.showAssignForm.set(false); }

  onStudentSearchInput(e: Event) {
    const q = (e.target as HTMLInputElement).value;
    this.studentSearchQuery.set(q);
    this.resolvedStudent.set(null);
    this.assignForm.student_id = '';
    this.studentSearchResults.set([]);
    if (q.trim().length >= 2) this.studentSearch$.next(q.trim());
  }

  private runStudentSearch(q: string) {
    this.studentSearching.set(true);
    this.api.get<any>('/students', { search: q, limit: 6, is_active: 'true' }).subscribe({
      next: (res: any) => {
        this.studentSearchResults.set(res.data ?? []);
        this.studentSearching.set(false);
      },
      error: () => this.studentSearching.set(false),
    });
  }

  selectStudent(s: any) {
    this.resolvedStudent.set(s);
    this.assignForm.student_id = s.id;
    this.studentSearchQuery.set(s.first_name + ' ' + s.last_name);
    this.studentSearchResults.set([]);
  }

  clearResolvedStudent() {
    this.resolvedStudent.set(null);
    this.assignForm.student_id = '';
    this.studentSearchQuery.set('');
    this.studentSearchResults.set([]);
  }

  saveAssignment() {
    if (!this.resolvedStudent() || !this.assignForm.concession_id) {
      this.snack.open('Select a student and a concession', 'OK', { duration: 3000 });
      return;
    }
    this.assignSaving.set(true);
    this.api.post<any>('/fees/concessions/assignments', this.assignForm).subscribe({
      next: () => {
        this.snack.open('Concession assigned successfully', 'OK', { duration: 3000 });
        this.closeAssignForm();
        this.assignSaving.set(false);
        this.loadAssignments();
      },
      error: (err: any) => {
        this.snack.open(err.error?.error?.message ?? 'Error assigning concession', 'OK', { duration: 3000 });
        this.assignSaving.set(false);
      },
    });
  }

  deleteAssignment(a: any) {
    if (!confirm('Remove concession from ' + a.student_name + '?')) return;
    this.api.delete<any>('/fees/concessions/assignments/' + a.id).subscribe({
      next: () => { this.snack.open('Assignment removed', 'OK', { duration: 3000 }); this.loadAssignments(); },
      error: (err: any) => this.snack.open(err.error?.error?.message ?? 'Error', 'OK', { duration: 3000 }),
    });
  }

  applyBulkSiblingDiscount() {
    if (!this.bulkConcessionId) return;
    if (!confirm('Apply sibling discount to all ' + this.siblingGroups().length + ' group(s)? Existing assignments will be updated.')) return;
    this.bulkApplying.set(true);
    this.api.post<any>('/fees/concessions/siblings/bulk-assign', {
      concession_id: this.bulkConcessionId,
      academic_year: this.bulkAcademicYear || undefined,
    }).subscribe({
      next: (res: any) => {
        this.snack.open(res.message, 'OK', { duration: 5000 });
        this.bulkApplying.set(false);
        this.loadAssignments();
      },
      error: (err: any) => {
        this.snack.open(err.error?.error?.message ?? 'Error', 'OK', { duration: 3000 });
        this.bulkApplying.set(false);
      },
    });
  }

  // Load concessions when switching to sibling wizard sub-tab
  onConcSubTabChange(idx: number) {
    this.concSubTab.set(idx);
    if (idx === 1 && !this.assignments().length) this.loadAssignments();
    if (idx === 2 && !this.concessions().length) this.loadConcessions();
  }

  // ── Sibling wizard ────────────────────────────────────────────────────────

  onWizardSearch(e: Event) {
    const q = (e.target as HTMLInputElement).value;
    this.wizardSearchQuery.set(q);
    this.wizardResults.set([]);
    if (q.trim().length >= 2) this.wizardSearch$.next(q.trim());
  }

  private runWizardSearch(q: string) {
    this.wizardSearching.set(true);
    this.api.get<any>('/students', { search: q, limit: 8, is_active: 'true' }).subscribe({
      next: (res: any) => { this.wizardResults.set(res.data ?? []); this.wizardSearching.set(false); },
      error: () => this.wizardSearching.set(false),
    });
  }

  isInGroup(id: string): boolean {
    return this.wizardGroup().some(s => s.id === id);
  }

  addToGroup(s: any) {
    if (this.isInGroup(s.id)) return;
    this.wizardGroup.update(g => [...g, s]);
    this.wizardSearchQuery.set('');
    this.wizardResults.set([]);
  }

  removeFromGroup(id: string) {
    this.wizardGroup.update(g => g.filter(s => s.id !== id));
  }

  clearWizardGroup() {
    this.wizardGroup.set([]);
    this.wizardSearchQuery.set('');
    this.wizardResults.set([]);
  }

  applyWizardDiscount() {
    if (!this.bulkConcessionId || this.wizardGroup().length < 2) return;
    if (!confirm(`Apply concession to all ${this.wizardGroup().length} students?`)) return;
    this.bulkApplying.set(true);
    const group = this.wizardGroup();
    let done = 0;
    let errors = 0;
    group.forEach(s => {
      this.api.post<any>('/fees/concessions/assignments', {
        student_id: s.id,
        concession_id: this.bulkConcessionId,
        academic_year: this.bulkAcademicYear || undefined,
        notes: 'Assigned via Sibling Wizard',
      }).subscribe({
        next: () => {
          done++;
          if (done + errors === group.length) this.finishWizardApply(done, errors);
        },
        error: () => {
          errors++;
          if (done + errors === group.length) this.finishWizardApply(done, errors);
        },
      });
    });
  }

  private finishWizardApply(done: number, errors: number) {
    this.bulkApplying.set(false);
    this.snack.open(`${done} student(s) assigned. ${errors > 0 ? errors + ' skipped (already assigned).' : ''}`, 'OK', { duration: 4000 });
    this.clearWizardGroup();
    this.bulkConcessionId = '';
    this.loadAssignments();
  }
}
