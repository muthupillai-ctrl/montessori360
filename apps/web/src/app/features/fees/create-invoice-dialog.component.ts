import { Component, inject, signal, OnInit, OnDestroy } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators, FormArray } from '@angular/forms';
import { Subject, takeUntil } from 'rxjs';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { DecimalPipe } from '@angular/common';
import { ApiService } from '../../core/services/api.service';
import type { Student, SchoolClass, FeeStructure } from '../../core/models';

interface InvoiceLineItem { name: string; amount: number; source: 'structure'|'transport'|'manual'; index?: number; }

@Component({
  selector: 'app-create-invoice-dialog',
  standalone: true,
  imports: [ReactiveFormsModule, MatDialogModule, MatButtonModule, MatIconModule, MatProgressSpinnerModule, DecimalPipe],
  template: `
<div class="shell">

  <!-- Header -->
  <div class="header">
    <div class="h-icon"><mat-icon>receipt_long</mat-icon></div>
    <div>
      <div class="h-title">Create Invoice</div>
      <div class="h-sub">{{ tabDefs[activeTab()].label }} · Step {{ activeTab() + 1 }} of 5</div>
    </div>
    <button class="h-close" mat-dialog-close><mat-icon>close</mat-icon></button>
  </div>

  <!-- Step bar -->
  <div class="stepbar">
    @for (t of tabDefs; track t.id; let i = $index) {
      <button class="step" [class.active]="activeTab() === i" [class.done]="activeTab() > i"
              [disabled]="!canGoToTab(i)" (click)="goToTab(i)">
        <div class="step-circle">
          @if (activeTab() > i) { <mat-icon style="font-size:11px;width:11px;height:11px">check</mat-icon> }
          @else { {{ i + 1 }} }
        </div>
        <span class="step-label">{{ t.label }}</span>
      </button>
      @if (i < 4) { <div class="step-line" [class.done]="activeTab() > i"></div> }
    }
  </div>

  <!-- Body (wraps all tabs as one reactive form) -->
  <form [formGroup]="form" class="body">

    <!-- ── Tab 1: Student & Date ─────────────────────────────── -->
    @if (activeTab() === 0) {
      <div class="section">
        <div class="sec-title"><mat-icon>person</mat-icon> Student</div>
        <div class="row">
          <div class="fg" style="width:155px;flex-shrink:0">
            <label class="lbl">Filter by Class</label>
            <select class="inp" [value]="selectedClass()" (change)="onClassChange($any($event.target).value)">
              <option value="">All Classes</option>
              @for (c of classes(); track c.id) { <option [value]="c.id">{{ c.name }}</option> }
            </select>
          </div>
          <div class="fg flex1">
            <label class="lbl">Student <span class="req">*</span></label>
            @if (studentsLoading()) {
              <div class="inp loading-inp"><mat-progress-spinner diameter="14" mode="indeterminate"/>Loading…</div>
            } @else {
              <select class="inp" formControlName="student_id" (change)="onStudentChange($any($event.target).value)">
                <option value="">— Select student ({{ students().length }}) —</option>
                @for (s of students(); track s.id) {
                  <option [value]="s.id">{{ s.first_name }} {{ s.last_name }} · {{ s.admission_no }}{{ s.class_name ? ' (' + s.class_name + ')' : '' }}</option>
                }
              </select>
            }
          </div>
        </div>
      </div>

      <div class="section">
        <div class="sec-title"><mat-icon>calendar_today</mat-icon> Billing Period &amp; Due Date</div>
        <div class="row">
          <div class="fg flex1">
            <label class="lbl">Billing Period <span class="req">*</span></label>
            <div class="bp-wrap">
              <select class="inp bp-type" [value]="billingType()" (change)="onBillingTypeChange($any($event.target).value)">
                <option value="monthly">Monthly</option>
                <option value="quarterly">Quarterly</option>
                <option value="half_yearly">Half-Yearly</option>
                <option value="annually">Annual</option>
                <option value="custom">Custom</option>
              </select>
              @if (billingType() === 'monthly') {
                <select class="inp bp-val" formControlName="billing_period">
                  @for (m of months; track m.value) { <option [value]="m.value">{{ m.label }}</option> }
                </select>
              } @else if (billingType() === 'quarterly') {
                <select class="inp bp-val" formControlName="billing_period">
                  @for (q of quarters; track q.value) { <option [value]="q.value">{{ q.label }}</option> }
                </select>
              } @else if (billingType() === 'half_yearly') {
                <select class="inp bp-val" formControlName="billing_period">
                  @for (h of halfYears; track h.value) { <option [value]="h.value">{{ h.label }}</option> }
                </select>
              } @else if (billingType() === 'annually') {
                <select class="inp bp-val" formControlName="billing_period">
                  <option value="2024-2025">2024–2025</option>
                  <option value="2025-2026">2025–2026</option>
                  <option value="2026-2027">2026–2027</option>
                </select>
              } @else {
                <input class="inp bp-val" formControlName="billing_period" placeholder="e.g. Special Fee June 2026">
              }
            </div>
          </div>
          <div class="fg" style="width:155px;flex-shrink:0">
            <label class="lbl">Due Date <span class="req">*</span></label>
            <input class="inp" type="date" formControlName="due_date">
          </div>
        </div>
      </div>
    }

    <!-- ── Tab 2: Extras ──────────────────────────────────────── -->
    @else if (activeTab() === 1) {

      <div class="section">
        <div class="sec-title"><mat-icon>directions_bus</mat-icon> Transport Fee</div>
        @if (!form.value.student_id) {
          <div class="info-notice"><mat-icon>info</mat-icon> Select a student in Step 1 first</div>
        } @else if (transportLoading()) {
          <div class="info-notice"><mat-progress-spinner diameter="16" mode="indeterminate"/>Checking transport enrollment…</div>
        } @else if (!transportRoute()) {
          <div class="none-notice"><mat-icon>directions_bus</mat-icon> No transport enrolled for this student</div>
        } @else if (transportAlreadyBilled()) {
          <div class="warn-notice">
            <mat-icon>check_circle</mat-icon>
            <div>
              <div class="nn-title">{{ transportRoute()!.route_name }}</div>
              <div class="nn-sub">Already invoiced for {{ form.value.billing_period }} — excluded automatically</div>
            </div>
          </div>
        } @else {
          <div class="extra-card" [class.on]="transportIncluded()">
            <div class="ec-left">
              <mat-icon style="color:var(--blue);flex-shrink:0">directions_bus</mat-icon>
              <div>
                <div class="ec-name">{{ transportRoute()!.route_name }}
                  @if (transportRoute()!.route_code) { <span class="ec-badge">{{ transportRoute()!.route_code }}</span> }
                </div>
                <div class="ec-amt">₹{{ transportRoute()!.monthly_fee | number:'1.0-0' }} / month</div>
              </div>
            </div>
            <button type="button" class="toggle" [class.on]="transportIncluded()"
                    (click)="transportIncluded.set(!transportIncluded())">
              <mat-icon style="font-size:14px;width:14px;height:14px">{{ transportIncluded() ? 'check_circle' : 'radio_button_unchecked' }}</mat-icon>
              {{ transportIncluded() ? 'Include' : 'Exclude' }}
            </button>
          </div>
        }
      </div>

      <div class="section">
        <div class="sec-title"><mat-icon>local_offer</mat-icon> Concession / Discount</div>
        @if (!form.value.student_id) {
          <div class="info-notice"><mat-icon>info</mat-icon> Select a student in Step 1 first</div>
        } @else if (concessionLoading()) {
          <div class="info-notice"><mat-progress-spinner diameter="16" mode="indeterminate"/>Checking concessions…</div>
        } @else if (!studentConcession()) {
          <div class="none-notice"><mat-icon>local_offer</mat-icon> No concession assigned to this student</div>
        } @else {
          <div class="extra-card" [class.on]="concessionIncluded()">
            <div class="ec-left">
              <mat-icon style="color:#7C3AED;flex-shrink:0">local_offer</mat-icon>
              <div>
                <div class="ec-name">{{ studentConcession().concession_name }}
                  <span class="ec-badge purple">{{ concessionLabel(studentConcession()) }}</span>
                </div>
                <div class="ec-amt">
                  {{ studentConcession().discount_type === 'percentage'
                    ? 'Percentage discount — calculated on final subtotal'
                    : 'Fixed discount of ₹' + studentConcession().discount_value }}
                </div>
              </div>
            </div>
            <button type="button" class="toggle" [class.on]="concessionIncluded()"
                    (click)="concessionIncluded.set(!concessionIncluded())">
              <mat-icon style="font-size:14px;width:14px;height:14px">{{ concessionIncluded() ? 'check_circle' : 'radio_button_unchecked' }}</mat-icon>
              {{ concessionIncluded() ? 'Include' : 'Exclude' }}
            </button>
          </div>
        }
      </div>

    }

    <!-- ── Tab 3: Fee Structure ───────────────────────────────── -->
    @else if (activeTab() === 2) {
      <div class="section">
        <div class="sec-title">
          <mat-icon>account_tree</mat-icon> Fee Structure
          <span class="opt-tag">optional</span>
        </div>

        @if (!feeStructures().length) {
          <div class="none-notice"><mat-icon>info</mat-icon> No fee structures defined yet</div>
        } @else {
          <select class="inp" style="width:100%" [value]="selectedStructure()"
                  (change)="onStructureChange($any($event.target).value)">
            <option value="">— Choose a structure to pre-fill items —</option>
            @for (fs of feeStructures(); track fs.id) {
              <option [value]="fs.id">{{ fs.name }} · {{ fs.billing_cycle }}{{ fs.allow_multiple ? ' · Repeatable' : '' }}</option>
            }
          </select>
        }

        @if (structureArr.length) {
          <div class="items-table">
            <div class="it-hdr">
              <span class="it-name">Item Name</span>
              <span class="it-amt">Amount (₹)</span>
              <span class="it-del"></span>
            </div>
            <div formArrayName="structure_items">
              @for (ctrl of structureArr.controls; track $index) {
                <div [formGroupName]="$index" class="it-row">
                  <input class="inp it-name" formControlName="name" placeholder="Item name">
                  <div class="amt-wrap it-amt">
                    <span class="amt-pfx">₹</span>
                    <input class="inp amt-inp" type="number" formControlName="amount" min="0">
                  </div>
                  <button type="button" class="del-btn it-del" (click)="structureArr.removeAt($index)">
                    <mat-icon style="font-size:15px;width:15px;height:15px">delete</mat-icon>
                  </button>
                </div>
              }
            </div>
          </div>
          <button type="button" class="add-row-btn" (click)="structureArr.push(newItem())">
            <mat-icon style="font-size:15px;width:15px;height:15px">add_circle_outline</mat-icon>
            Add Item
          </button>
        }
      </div>
    }

    <!-- ── Tab 4: Extra Items ─────────────────────────────────── -->
    @else if (activeTab() === 3) {
      <div class="section">
        <div class="sec-title"><mat-icon>edit_note</mat-icon> Additional Fee Items <span class="opt-tag">optional</span></div>
        <p class="sec-hint">Add any items not covered by the fee structure — activity fees, late charges, materials, etc.</p>

        <div class="items-table">
          <div class="it-hdr">
            <span class="it-name">Item Name</span>
            <span class="it-amt">Amount (₹)</span>
            <span class="it-del"></span>
          </div>
          <div formArrayName="extra_items">
            @for (ctrl of extraArr.controls; track $index) {
              <div [formGroupName]="$index" class="it-row">
                <input class="inp it-name" formControlName="name" placeholder="e.g. Activity Fee">
                <div class="amt-wrap it-amt">
                  <span class="amt-pfx">₹</span>
                  <input class="inp amt-inp" type="number" formControlName="amount" min="0" placeholder="0">
                </div>
                <button type="button" class="del-btn it-del" (click)="extraArr.removeAt($index)"
                        [disabled]="extraArr.length === 1">
                  <mat-icon style="font-size:15px;width:15px;height:15px">delete</mat-icon>
                </button>
              </div>
            }
          </div>
        </div>
        <button type="button" class="add-row-btn" (click)="extraArr.push(newItem())">
          <mat-icon style="font-size:15px;width:15px;height:15px">add_circle_outline</mat-icon>
          Add Row
        </button>
      </div>
    }

    <!-- ── Tab 5: Summary ─────────────────────────────────────── -->
    @else {
      <div class="section">
        <div class="sec-title"><mat-icon>fact_check</mat-icon> Invoice Summary</div>

        @if (!allLineItems.length) {
          <div class="empty-summary">
            <mat-icon style="font-size:32px;width:32px;height:32px;color:var(--text-4)">receipt_long</mat-icon>
            <div>No fee items added yet.</div>
            <div style="font-size:11px;color:var(--text-4)">Go back to add items from a fee structure or enter them manually.</div>
          </div>
        } @else {
          <div class="summary-table">
            <div class="st-hdr">
              <span class="st-src"></span>
              <span class="st-name">Item</span>
              <span class="st-amt">Amount</span>
              <span class="st-del"></span>
            </div>
            @for (item of allLineItems; track $index) {
              <div class="st-row">
                <span class="st-src">
                  @if (item.source === 'transport') { <mat-icon style="font-size:13px;width:13px;height:13px;color:var(--blue)">directions_bus</mat-icon> }
                  @else if (item.source === 'structure') { <mat-icon style="font-size:13px;width:13px;height:13px;color:var(--text-3)">account_tree</mat-icon> }
                  @else { <mat-icon style="font-size:13px;width:13px;height:13px;color:var(--text-3)">edit_note</mat-icon> }
                </span>
                <span class="st-name">{{ item.name }}</span>
                <span class="st-amt">₹{{ item.amount | number:'1.0-2' }}</span>
                <button type="button" class="del-btn st-del" (click)="deleteItem(item)">
                  <mat-icon style="font-size:14px;width:14px;height:14px">delete</mat-icon>
                </button>
              </div>
            }
          </div>
        }

        <!-- Concession notice in summary -->
        @if (studentConcession() && concessionIncluded()) {
          <div class="conc-bar">
            <mat-icon style="font-size:14px;width:14px;height:14px;color:#7C3AED">local_offer</mat-icon>
            <span>{{ studentConcession().concession_name }} — {{ concessionLabel(studentConcession()) }} applied as discount</span>
            <button type="button" class="conc-remove" (click)="removeDiscount()">
              <mat-icon style="font-size:12px;width:12px;height:12px">close</mat-icon> Remove
            </button>
          </div>
        } @else if (studentConcession() && !concessionIncluded()) {
          <div class="conc-bar removed">
            <mat-icon style="font-size:14px;width:14px;height:14px;color:#DC2626">local_offer</mat-icon>
            <span>{{ studentConcession().concession_name }} — not applied</span>
            <button type="button" class="conc-restore" (click)="restoreDiscount()">
              <mat-icon style="font-size:12px;width:12px;height:12px">undo</mat-icon> Restore
            </button>
          </div>
        }

        <!-- Totals & adjustments -->
        <div class="totals">
          <div class="tot-row">
            <span>Subtotal</span>
            <span>₹{{ subtotal | number:'1.0-2' }}</span>
          </div>

          <div class="tot-adj">
            <div class="adj-row">
              <label class="lbl" style="margin:0;width:90px">Discount (₹)</label>
              <div class="amt-wrap" style="flex:1">
                <span class="amt-pfx">₹</span>
                <input class="inp amt-inp" type="number" formControlName="discount" min="0" placeholder="0">
              </div>
            </div>
            <div class="adj-row">
              <label class="lbl" style="margin:0;width:90px">Tax (₹)</label>
              <div class="amt-wrap" style="flex:1">
                <span class="amt-pfx">₹</span>
                <input class="inp amt-inp" type="number" formControlName="tax" min="0" placeholder="0">
              </div>
            </div>
          </div>

          @if (concessionIncluded() && (form.get('discount')?.value ?? 0) > 0) {
            <div class="tot-row discount">
              <span>Discount</span>
              <span>−₹{{ form.get('discount')?.value | number:'1.0-2' }}</span>
            </div>
          }
          @if ((form.get('tax')?.value ?? 0) > 0) {
            <div class="tot-row">
              <span>Tax</span>
              <span>+₹{{ form.get('tax')?.value | number:'1.0-2' }}</span>
            </div>
          }
          <div class="tot-divider"></div>
          <div class="tot-row grand">
            <span>Total Payable</span>
            <span>₹{{ grandTotal | number:'1.0-2' }}</span>
          </div>
        </div>
      </div>
    }

  </form><!-- end reactive form -->

  <!-- Error -->
  @if (error()) {
    <div class="err-bar">
      <mat-icon style="font-size:14px;width:14px;height:14px;flex-shrink:0">error_outline</mat-icon>
      {{ error() }}
    </div>
  }

  <!-- Footer -->
  <div class="footer">
    @if (activeTab() === 0) {
      <button class="btn-ghost" mat-dialog-close>Cancel</button>
    } @else {
      <button class="btn-back" type="button" (click)="prevTab()">
        <mat-icon style="font-size:16px;width:16px;height:16px">arrow_back</mat-icon>
        Back
      </button>
    }
    <div style="flex:1"></div>
    @if (activeTab() < 4) {
      <button class="btn-next" type="button" (click)="nextTab()" [disabled]="!canProceed()">
        {{ nextLabel() }}
        <mat-icon style="font-size:16px;width:16px;height:16px">arrow_forward</mat-icon>
      </button>
    } @else {
      <button class="btn-create" type="button" (click)="submit()"
              [disabled]="!canSubmit() || submitting() || submitted()">
        @if (submitting()) {
          <mat-progress-spinner diameter="16" mode="indeterminate"
            style="--mdc-circular-progress-active-indicator-color:#fff"/>
        } @else {
          <mat-icon style="font-size:16px;width:16px;height:16px">receipt_long</mat-icon>
          Create Invoice
        }
      </button>
    }
  </div>

</div>
  `,
  styles: [`
    :host { display: block; }
    .shell { width: 100%; height: 640px; max-height: 92vh; display: flex; flex-direction: column; background: #fff; border-radius: 12px; overflow: hidden; }

    /* Header */
    .header {
      display: flex; align-items: center; gap: 12px;
      padding: 18px 22px 14px; border-bottom: 1px solid var(--border); flex-shrink: 0;
    }
    .h-icon {
      width: 34px; height: 34px; border-radius: 8px;
      background: var(--amber-light); color: var(--amber);
      display: flex; align-items: center; justify-content: center; flex-shrink: 0;
      mat-icon { font-size: 17px; width: 17px; height: 17px; }
    }
    .h-title { font-size: 14px; font-weight: 600; color: var(--text); }
    .h-sub   { font-size: 11px; color: var(--text-3); margin-top: 1px; }
    .h-close {
      margin-left: auto; background: none; border: none; cursor: pointer;
      width: 28px; height: 28px; border-radius: 6px; color: var(--text-3);
      display: flex; align-items: center; justify-content: center;
      &:hover { background: var(--bg); }
      mat-icon { font-size: 17px; width: 17px; height: 17px; }
    }

    /* Step bar */
    .stepbar {
      display: flex; align-items: center; padding: 12px 18px;
      background: var(--bg); border-bottom: 1px solid var(--border); flex-shrink: 0;
    }
    .step {
      display: flex; flex-direction: column; align-items: center; gap: 3px;
      background: none; border: none; cursor: pointer; padding: 0;
      &:disabled { cursor: default; }
    }
    .step-circle {
      width: 22px; height: 22px; border-radius: 50%;
      border: 1.5px solid var(--border); background: #fff;
      font-size: 10px; font-weight: 700; color: var(--text-4);
      display: flex; align-items: center; justify-content: center; flex-shrink: 0;
    }
    .step-label { font-size: 10px; font-weight: 500; color: var(--text-4); white-space: nowrap; }
    .step.active .step-circle { border-color: var(--blue); color: var(--blue); }
    .step.active .step-label  { color: var(--blue); }
    .step.done  .step-circle  { background: var(--blue); border-color: var(--blue); color: #fff; }
    .step.done  .step-label   { color: var(--text-2); }
    .step-line { flex: 1; height: 1.5px; background: var(--border); margin: 0 4px; margin-bottom: 14px; &.done { background: var(--blue); } }

    /* Body */
    .body { flex: 1; overflow-y: auto; padding: 18px 22px; display: flex; flex-direction: column; gap: 14px; }

    /* Sections */
    .section {
      background: var(--bg); border-radius: 10px; padding: 14px;
      display: flex; flex-direction: column; gap: 10px;
    }
    .sec-title {
      display: flex; align-items: center; gap: 6px;
      font-size: 12px; font-weight: 600; color: var(--text-2);
      mat-icon { font-size: 15px; width: 15px; height: 15px; color: var(--blue); }
    }
    .opt-tag {
      font-size: 10px; font-weight: 400; color: var(--text-4);
      background: var(--border-light); padding: 1px 7px; border-radius: 4px; margin-left: 4px;
    }
    .sec-hint { font-size: 11.5px; color: var(--text-3); margin: 0; }

    /* Form elements */
    .row    { display: flex; gap: 10px; }
    .flex1  { flex: 1; min-width: 0; }
    .fg     { display: flex; flex-direction: column; gap: 4px; }
    .lbl    { font-size: 11px; font-weight: 500; color: var(--text-3); .req { color: var(--red); } }
    .inp {
      height: 34px; padding: 0 9px;
      background: #fff; border: 1px solid var(--border);
      border-radius: 7px; font-size: 13px; color: var(--text);
      outline: none; font-family: inherit; width: 100%; box-sizing: border-box;
      &::placeholder { color: var(--text-4); }
      &:focus { border-color: var(--blue); box-shadow: 0 0 0 2px rgba(37,99,235,.1); }
    }
    select.inp { cursor: pointer; }
    .loading-inp { display: flex; align-items: center; gap: 8px; color: var(--text-3); font-size: 12px; background: var(--bg); border: 1px solid var(--border); border-radius: 7px; height: 34px; padding: 0 9px; }
    .bp-wrap { display: flex; gap: 6px; }
    .bp-type { width: 120px; flex-shrink: 0; }
    .bp-val  { flex: 1; }

    /* Notices */
    .info-notice, .none-notice, .warn-notice {
      display: flex; align-items: center; gap: 8px;
      padding: 10px 12px; border-radius: 8px; font-size: 12.5px;
      mat-icon { flex-shrink: 0; font-size: 16px; width: 16px; height: 16px; }
    }
    .info-notice { background: var(--blue-light); color: var(--blue); border: 1px solid var(--blue-mid); }
    .none-notice { background: var(--bg); color: var(--text-3); border: 1px solid var(--border); mat-icon { color: var(--text-4); } }
    .warn-notice { background: var(--amber-light); border: 1px solid var(--amber); color: var(--text-2); flex-direction: row; align-items: flex-start; }
    .nn-title { font-weight: 600; font-size: 12.5px; color: var(--text); }
    .nn-sub   { font-size: 11.5px; color: var(--text-3); margin-top: 2px; }

    /* Extra cards (transport / concession toggles) */
    .extra-card {
      display: flex; align-items: center; justify-content: space-between;
      padding: 12px 14px; border-radius: 9px; border: 1.5px solid var(--border);
      background: #fff; gap: 10px; transition: border-color .15s, background .15s;
      &.on { border-color: var(--blue); background: var(--blue-light); }
    }
    .ec-left { display: flex; align-items: center; gap: 10px; flex: 1; min-width: 0; }
    .ec-name { font-size: 13px; font-weight: 500; color: var(--text); display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
    .ec-amt  { font-size: 11.5px; color: var(--text-3); margin-top: 2px; }
    .ec-badge {
      font-size: 10px; font-weight: 700; padding: 2px 7px; border-radius: 5px;
      background: var(--blue); color: #fff;
      &.purple { background: #7C3AED; }
    }
    .toggle {
      display: flex; align-items: center; gap: 5px;
      padding: 6px 12px; border-radius: 7px; font-size: 12px; font-weight: 600;
      border: 1.5px solid var(--border); background: #fff; cursor: pointer; color: var(--text-3);
      white-space: nowrap; flex-shrink: 0;
      &.on { border-color: var(--blue); color: var(--blue); background: #fff; }
      &:hover { background: var(--bg); }
    }

    /* Items table (shared by structure + extra tabs) */
    .items-table { display: flex; flex-direction: column; gap: 5px; }
    .it-hdr {
      display: flex; gap: 8px; padding: 0 2px;
      font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: .3px; color: var(--text-4);
    }
    .it-row  { display: flex; gap: 8px; align-items: center; }
    .it-name { flex: 1; min-width: 0; }
    .it-amt  { width: 130px; flex-shrink: 0; }
    .it-del  { width: 30px; flex-shrink: 0; }
    .amt-wrap { display: flex; align-items: center; }
    .amt-pfx {
      height: 34px; padding: 0 8px; background: var(--bg);
      border: 1px solid var(--border); border-right: none;
      border-radius: 7px 0 0 7px; font-size: 13px; color: var(--text-3);
      display: flex; align-items: center; flex-shrink: 0;
    }
    .amt-inp { border-radius: 0 7px 7px 0 !important; text-align: right; }
    .del-btn {
      width: 30px; height: 34px; border-radius: 7px;
      background: none; border: 1px solid var(--border);
      cursor: pointer; color: var(--red);
      display: flex; align-items: center; justify-content: center;
      &:hover:not(:disabled) { background: var(--red-light); }
      &:disabled { opacity: .35; cursor: not-allowed; }
    }
    .add-row-btn {
      display: flex; align-items: center; gap: 6px; justify-content: center;
      background: none; border: 1.5px dashed #D1D5DB;
      border-radius: 8px; width: 100%; padding: 8px;
      font-size: 12.5px; color: var(--blue); cursor: pointer; font-weight: 500;
      &:hover { background: var(--blue-light); border-color: var(--blue-mid); }
    }

    /* Summary */
    .empty-summary {
      display: flex; flex-direction: column; align-items: center; gap: 8px;
      padding: 30px; color: var(--text-3); font-size: 13px; text-align: center;
    }
    .summary-table { display: flex; flex-direction: column; gap: 0; }
    .st-hdr {
      display: flex; gap: 8px; padding: 6px 6px;
      font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: .3px; color: var(--text-4);
      border-bottom: 1px solid var(--border);
    }
    .st-row {
      display: flex; gap: 8px; align-items: center;
      padding: 9px 6px; border-bottom: 1px solid var(--border-light);
      &:last-child { border-bottom: none; }
      &:hover { background: var(--bg); border-radius: 6px; }
    }
    .st-src  { width: 18px; flex-shrink: 0; display: flex; align-items: center; }
    .st-name { flex: 1; font-size: 13px; color: var(--text); }
    .st-amt  { width: 100px; flex-shrink: 0; font-size: 13px; font-weight: 500; color: var(--text); text-align: right; }
    .st-del  { width: 28px; flex-shrink: 0; }

    .conc-bar {
      display: flex; align-items: center; gap: 8px; flex-wrap: wrap;
      padding: 8px 12px; border-radius: 8px; font-size: 12px;
      background: #F5F3FF; border: 1px solid #DDD6FE; color: #5B21B6;
      &.removed { background: #FFF5F5; border-color: #FECACA; color: #991B1B; }
    }
    .conc-remove {
      margin-left: auto; display: inline-flex; align-items: center; gap: 3px;
      padding: 3px 9px; border: 1px solid #FECACA; border-radius: 6px;
      background: #FEF2F2; color: #DC2626; font-size: 11px; font-weight: 600; cursor: pointer;
      &:hover { background: #FEE2E2; }
    }
    .conc-restore {
      margin-left: auto; display: inline-flex; align-items: center; gap: 3px;
      padding: 3px 9px; border: 1px solid #C4B5FD; border-radius: 6px;
      background: #EDE9FE; color: #7C3AED; font-size: 11px; font-weight: 600; cursor: pointer;
      &:hover { background: #DDD6FE; }
    }

    .totals { display: flex; flex-direction: column; gap: 6px; border-top: 1px solid var(--border); padding-top: 12px; }
    .tot-row {
      display: flex; justify-content: space-between; font-size: 13px; color: var(--text-2);
      &.discount { color: var(--green); }
      &.grand { font-size: 15px; font-weight: 700; color: var(--text); span:last-child { color: var(--blue); } }
    }
    .tot-adj { display: flex; gap: 10px; }
    .adj-row { display: flex; align-items: center; gap: 8px; flex: 1; }
    .tot-divider { height: 1px; background: var(--border); margin: 4px 0; }

    /* Error bar */
    .err-bar {
      display: flex; align-items: center; gap: 8px;
      padding: 10px 20px; background: var(--red-light);
      border-top: 1px solid var(--red); font-size: 12.5px; color: #991B1B; flex-shrink: 0;
      mat-icon { color: var(--red); }
    }

    /* Footer */
    .footer {
      display: flex; align-items: center; gap: 8px;
      padding: 12px 22px; border-top: 1px solid var(--border);
      background: var(--bg); flex-shrink: 0;
    }
    .btn-ghost {
      background: none; border: none; cursor: pointer;
      font-size: 13px; color: var(--text-3); padding: 0 12px; height: 36px; border-radius: 7px;
      &:hover { background: var(--border-light); }
    }
    .btn-back {
      display: flex; align-items: center; gap: 4px;
      background: none; border: 1.5px solid var(--border); cursor: pointer;
      font-size: 13px; color: var(--text-2); padding: 0 14px; height: 36px; border-radius: 8px;
      &:hover { background: var(--border-light); }
    }
    .btn-next {
      display: flex; align-items: center; gap: 5px;
      background: var(--blue); color: #fff; border: none; border-radius: 8px;
      height: 36px; padding: 0 18px; font-size: 13px; font-weight: 500; cursor: pointer;
      &:hover:not(:disabled) { background: #1D4ED8; }
      &:disabled { opacity: .55; cursor: not-allowed; }
    }
    .btn-create {
      display: flex; align-items: center; gap: 6px;
      background: #16A34A; color: #fff; border: none; border-radius: 8px;
      height: 36px; padding: 0 20px; font-size: 13px; font-weight: 600; cursor: pointer;
      &:hover:not(:disabled) { background: #15803D; }
      &:disabled { opacity: .55; cursor: not-allowed; }
    }
  `],
})
export class CreateInvoiceDialogComponent implements OnInit, OnDestroy {
  private fb        = inject(FormBuilder);
  private api       = inject(ApiService);
  private dialogRef = inject(MatDialogRef<CreateInvoiceDialogComponent>);
  private destroy$  = new Subject<void>();

  // ─── Tab ──────────────────────────────────────────────────────
  activeTab = signal(0);
  readonly tabDefs = [
    { id: 0, label: 'Student'   },
    { id: 1, label: 'Extras'    },
    { id: 2, label: 'Structure' },
    { id: 3, label: 'Items'     },
    { id: 4, label: 'Summary'   },
  ];

  // ─── Lookup ───────────────────────────────────────────────────
  classes        = signal<SchoolClass[]>([]);
  students       = signal<Student[]>([]);
  feeStructures  = signal<FeeStructure[]>([]);
  studentsLoading = signal(false);
  selectedClass  = signal('');

  // ─── Transport ────────────────────────────────────────────────
  transportRoute         = signal<any|null>(null);
  transportLoading       = signal(false);
  transportIncluded      = signal(true);
  transportAlreadyBilled = signal(false);

  // ─── Concession ───────────────────────────────────────────────
  studentConcession  = signal<any|null>(null);
  concessionLoading  = signal(false);
  concessionIncluded = signal(true);

  // ─── Structure ────────────────────────────────────────────────
  selectedStructure = signal('');

  // ─── Misc ─────────────────────────────────────────────────────
  billingType = signal('monthly');
  submitting  = signal(false);
  submitted   = signal(false);
  error       = signal('');

  // ─── Form ─────────────────────────────────────────────────────
  form = this.fb.group({
    student_id:      ['', Validators.required],
    billing_period:  [this.defaultBillingPeriod(), Validators.required],
    due_date:        [this.defaultDueDate(), Validators.required],
    discount:        [0],
    tax:             [0],
    structure_items: this.fb.array([]),
    extra_items:     this.fb.array([this.newItem()]),
  });

  get structureArr(): FormArray { return this.form.get('structure_items') as FormArray; }
  get extraArr():     FormArray { return this.form.get('extra_items')     as FormArray; }

  newItem(name = '', amount = 0) {
    return this.fb.group({ name: [name], amount: [amount, Validators.min(0)] });
  }

  // ─── Computed ─────────────────────────────────────────────────
  get allLineItems(): InvoiceLineItem[] {
    const out: InvoiceLineItem[] = [];
    this.structureArr.controls.forEach((c, i) => {
      const v = c.value;
      if (v.name?.trim() && +v.amount > 0)
        out.push({ name: v.name.trim(), amount: +v.amount, source: 'structure', index: i });
    });
    const rt = this.transportRoute();
    if (rt?.monthly_fee && !this.transportAlreadyBilled() && this.transportIncluded())
      out.push({ name: 'Transport Fee', amount: +rt.monthly_fee, source: 'transport' });
    this.extraArr.controls.forEach((c, i) => {
      const v = c.value;
      if (v.name?.trim() && +v.amount > 0)
        out.push({ name: v.name.trim(), amount: +v.amount, source: 'manual', index: i });
    });
    return out;
  }

  get subtotal():   number { return this.allLineItems.reduce((s, i) => s + i.amount, 0); }
  get grandTotal(): number {
    const discount = this.concessionIncluded()
      ? +(this.form.get('discount')?.value ?? 0)
      : 0;
    return this.subtotal - discount + (+(this.form.get('tax')?.value ?? 0));
  }

  // ─── Navigation ───────────────────────────────────────────────
  canGoToTab(tab: number): boolean {
    if (tab === 0) return true;
    const f = this.form.value;
    return !!f.student_id && !!f.billing_period && !!f.due_date;
  }

  canProceed(): boolean { return this.canGoToTab(this.activeTab() + 1); }

  goToTab(tab: number) {
    if (!this.canGoToTab(tab)) return;
    if (tab === 4) this.prepareSummary();
    this.activeTab.set(tab);
  }

  nextTab() {
    const n = this.activeTab() + 1;
    if (n === 4) this.prepareSummary();
    this.activeTab.set(n);
  }

  prevTab() { this.activeTab.set(this.activeTab() - 1); }

  private prepareSummary() {
    if (this.concessionIncluded()) {
      const conc = this.studentConcession();
      if (conc) this.applyConcesssionDiscount(conc);
    } else {
      this.form.patchValue({ discount: 0 }, { emitEvent: false });
    }
  }

  nextLabel(): string {
    const labels: Record<number, string> = { 0: 'Extras', 1: 'Structure', 2: 'Items', 3: 'Summary' };
    return 'Next: ' + (labels[this.activeTab()] ?? '');
  }

  canSubmit(): boolean { return this.allLineItems.length > 0 && this.grandTotal > 0; }

  // ─── Init ─────────────────────────────────────────────────────
  ngOnInit() {
    this.api.get<any>('/students/classes').subscribe({ next: (r: any) => this.classes.set(r.data ?? []) });
    this.loadStudents('');
    this.api.get<any>('/fees/structures').subscribe({ next: (r: any) => this.feeStructures.set(r.data ?? []), error: () => {} });

    this.form.get('billing_period')?.valueChanges.pipe(takeUntil(this.destroy$)).subscribe(() => {
      const sid = this.form.value.student_id;
      const per = this.form.value.billing_period;
      if (sid && per && this.transportRoute()) this.checkTransportBilled(sid, per);
    });
  }

  ngOnDestroy() { this.destroy$.next(); this.destroy$.complete(); }

  // ─── Student ──────────────────────────────────────────────────
  loadStudents(classId: string) {
    this.studentsLoading.set(true);
    const p: Record<string, string> = { limit: '500', page: '1', is_active: 'true' };
    if (classId) p['class_id'] = classId;
    this.api.get<any>('/students', p).subscribe({
      next: (r: any) => { this.students.set(r.data ?? []); this.studentsLoading.set(false); },
      error: () => this.studentsLoading.set(false),
    });
  }

  onClassChange(classId: string) {
    this.selectedClass.set(classId);
    this.form.patchValue({ student_id: '' });
    this.loadStudents(classId);
  }

  onStudentChange(studentId: string) {
    this.transportRoute.set(null);
    this.transportAlreadyBilled.set(false);
    this.transportIncluded.set(true);
    this.studentConcession.set(null);
    this.concessionIncluded.set(true);
    while (this.structureArr.length) this.structureArr.removeAt(0);
    this.selectedStructure.set('');
    this.form.patchValue({ discount: 0 }, { emitEvent: false });
    if (!studentId) return;

    this.transportLoading.set(true);
    this.api.get<any>('/transport/students/' + studentId).subscribe({
      next: (r: any) => {
        this.transportRoute.set(r.data);
        this.transportLoading.set(false);
        if (r.data?.monthly_fee && this.form.value.billing_period)
          this.checkTransportBilled(studentId, this.form.value.billing_period);
      },
      error: () => this.transportLoading.set(false),
    });

    this.concessionLoading.set(true);
    this.api.get<any>('/fees/concessions/assignments', { student_id: studentId }).subscribe({
      next: (r: any) => {
        const active = (r.data ?? []).find((a: any) => a.discount_value);
        this.studentConcession.set(active ?? null);
        this.concessionLoading.set(false);
      },
      error: () => this.concessionLoading.set(false),
    });
  }

  checkTransportBilled(studentId: string, billingPeriod: string) {
    this.api.get<any>('/fees/invoices', { student_id: studentId, billing_period: billingPeriod, limit: '50' }).subscribe({
      next: (r: any) => {
        const invoices: any[] = r.data?.items ?? r.data ?? [];
        const billed = invoices.some((inv: any) => {
          if (inv.invoice_type === 'transport') return true;
          try {
            const li = typeof inv.line_items === 'string' ? JSON.parse(inv.line_items) : (inv.line_items ?? []);
            return Array.isArray(li) && li.some((x: any) => x.name === 'Transport Fee');
          } catch { return false; }
        });
        this.transportAlreadyBilled.set(billed);
        this.transportIncluded.set(!billed);
      },
      error: () => {},
    });
  }

  // ─── Concession ───────────────────────────────────────────────
  applyConcesssionDiscount(concession: any) {
    const sub = this.subtotal;
    const disc = concession.discount_type === 'percentage'
      ? Math.round(sub * +concession.discount_value) / 100
      : Math.min(+concession.discount_value, sub);
    this.form.patchValue({ discount: disc }, { emitEvent: false });
  }

  removeDiscount() {
    this.concessionIncluded.set(false);
    this.form.patchValue({ discount: 0 }, { emitEvent: false });
  }

  restoreDiscount() {
    this.concessionIncluded.set(true);
    const conc = this.studentConcession();
    if (conc) this.applyConcesssionDiscount(conc);
  }

  concessionLabel(c: any): string {
    return c.discount_type === 'percentage' ? c.discount_value + '% off' : '₹' + c.discount_value + ' off';
  }

  // ─── Structure ────────────────────────────────────────────────
  onStructureChange(structureId: string) {
    this.selectedStructure.set(structureId);
    while (this.structureArr.length) this.structureArr.removeAt(0);
    if (!structureId) return;
    const s = this.feeStructures().find(f => f.id === structureId);
    if (!s) return;
    (s.heads ?? []).forEach((h: any) => this.structureArr.push(this.newItem(h.name, +h.amount)));
  }

  // ─── Summary delete ───────────────────────────────────────────
  deleteItem(item: InvoiceLineItem) {
    if (item.source === 'transport')  this.transportIncluded.set(false);
    else if (item.source === 'structure') this.structureArr.removeAt(item.index!);
    else this.extraArr.removeAt(item.index!);
  }

  // ─── Submit ───────────────────────────────────────────────────
  submit() {
    const items = this.allLineItems;
    if (!items.length) { this.error.set('Add at least one fee item'); return; }
    if (this.grandTotal <= 0) { this.error.set('Grand total must be greater than zero'); return; }
    this.submitting.set(true);
    this.error.set('');
    const v    = this.form.value;
    const conc = this.studentConcession();
    // When concession is excluded, force discount to 0 regardless of what the form control holds
    const discount = this.concessionIncluded() ? +(v.discount ?? 0) : 0;
    const payload: any = {
      student_id:       v.student_id,
      billing_period:   v.billing_period,
      due_date:         v.due_date,
      discount,
      tax:              +(v.tax ?? 0),
      invoice_type:     this.selectedStructure() ? 'fee_structure' : 'adhoc',
      fee_structure_id: this.selectedStructure() || undefined,
      line_items:       items.map(i => ({ name: i.name, amount: i.amount })),
      skip_concession:  !this.concessionIncluded(),
    };
    if (this.concessionIncluded() && conc) {
      payload.concession_id = conc.concession_id;
      payload.discount_note = `${conc.concession_name} (${conc.discount_type === 'percentage' ? conc.discount_value + '%' : '₹' + conc.discount_value})`;
    }
    this.api.post<any>('/fees/invoices', payload).subscribe({
      next: (r: any) => { this.submitting.set(false); this.submitted.set(true); this.dialogRef.close(r.data); },
      error: (err: any) => {
        this.submitting.set(false);
        this.error.set(err.error?.error?.message ?? 'Failed to create invoice. Please try again.');
      },
    });
  }

  // ─── Billing period helpers ───────────────────────────────────
  onBillingTypeChange(type: string) {
    this.billingType.set(type);
    if      (type === 'monthly')     this.form.patchValue({ billing_period: this.defaultBillingPeriod() });
    else if (type === 'quarterly')   this.form.patchValue({ billing_period: this.quarters[0].value });
    else if (type === 'half_yearly') this.form.patchValue({ billing_period: this.halfYears[0].value });
    else if (type === 'annually')    this.form.patchValue({ billing_period: '2025-2026' });
    else                             this.form.patchValue({ billing_period: '' });
  }

  defaultBillingPeriod(): string {
    const n = new Date();
    return n.toLocaleString('en-US', { month: 'long' }) + ' ' + n.getFullYear();
  }
  defaultDueDate(): string {
    const d = new Date(); d.setDate(d.getDate() + 15);
    return d.toISOString().slice(0, 10);
  }

  months = (() => {
    const yr = new Date().getFullYear();
    const names = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    const r = [];
    for (const y of [yr-1, yr, yr+1]) for (let m = 0; m < 12; m++) r.push({ value: `${names[m]} ${y}`, label: `${names[m]} ${y}` });
    return r;
  })();

  quarters = (() => {
    const yr = new Date().getFullYear(); const r = [];
    for (const y of [yr-1, yr, yr+1]) r.push(
      { value: `Q1 ${y} (Jan–Mar)`, label: `Q1 ${y} — Jan–Mar` },
      { value: `Q2 ${y} (Apr–Jun)`, label: `Q2 ${y} — Apr–Jun` },
      { value: `Q3 ${y} (Jul–Sep)`, label: `Q3 ${y} — Jul–Sep` },
      { value: `Q4 ${y} (Oct–Dec)`, label: `Q4 ${y} — Oct–Dec` },
    );
    return r;
  })();

  halfYears = (() => {
    const yr = new Date().getFullYear(); const r = [];
    for (const y of [yr-1, yr, yr+1]) r.push(
      { value: `H1 ${y} (Jan–Jun)`, label: `H1 ${y} — Jan–Jun` },
      { value: `H2 ${y} (Jul–Dec)`, label: `H2 ${y} — Jul–Dec` },
    );
    return r;
  })();
}
