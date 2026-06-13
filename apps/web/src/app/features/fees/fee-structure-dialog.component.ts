import { Component, inject, signal, OnInit } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators, FormArray } from '@angular/forms';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { DecimalPipe } from '@angular/common';
import { ApiService } from '../../core/services/api.service';
import type { FeeStructure, SchoolClass, ApiResponse } from '../../core/models';

@Component({
  selector: 'app-fee-structure-dialog',
  standalone: true,
  imports: [
    ReactiveFormsModule, MatDialogModule,
    MatButtonModule, MatIconModule,
    MatProgressSpinnerModule, DecimalPipe,
  ],
  template: `
    <div class="dialog-shell">

      <div class="dialog-header">
        <div class="dh-icon"><mat-icon>account_balance_wallet</mat-icon></div>
        <div>
          <div class="dh-title">{{ isEdit ? 'Edit Fee Structure' : 'New Fee Structure' }}</div>
          <div class="dh-sub">Define fee heads that can be applied to invoices</div>
        </div>
        <button class="dh-close" mat-dialog-close><mat-icon>close</mat-icon></button>
      </div>

      <div class="dialog-body">
        <form [formGroup]="form" class="fs-form">

          <div class="form-row">
            <div class="field-group flex-1">
              <label class="field-label">Structure Name <span class="req">*</span></label>
              <input class="field-input" formControlName="name" placeholder="e.g. Standard Monthly 2025-2026"
                     [class.err]="form.get('name')?.invalid && form.get('name')?.touched">
            </div>
            <div class="field-group" style="width:160px;flex-shrink:0">
              <label class="field-label">Billing Cycle <span class="req">*</span></label>
              <select class="field-input" formControlName="billing_cycle">
                <option value="monthly">Monthly</option>
                <option value="quarterly">Quarterly</option>
                <option value="half_yearly">Half-Yearly</option>
                <option value="annually">Annually</option>
                <option value="one_time">One Time</option>
              </select>
            </div>
          </div>

          <div class="form-row">
            <div class="field-group flex-1">
              <label class="field-label">Academic Year <span class="req">*</span></label>
              <select class="field-input" formControlName="academic_year">
                <option value="2024-2025">2024-2025</option>
                <option value="2025-2026">2025-2026</option>
                <option value="2026-2027">2026-2027</option>
              </select>
            </div>
            <div class="field-group flex-1">
              <label class="field-label">Applies To</label>
              <select class="field-input" formControlName="applies_to">
                <option value="all">All Students</option>
                <option value="class">Specific Class</option>
              </select>
            </div>
          </div>

          @if (form.value.applies_to === 'class') {
            <div class="field-group">
              <label class="field-label">Select Class <span class="req">*</span></label>
              @if (classes().length) {
                <select class="field-input" formControlName="class_id">
                  <option value="">— Choose a class —</option>
                  @for (cls of classes(); track cls.id) {
                    <option [value]="cls.id">{{ cls.name }} ({{ cls.enrolled_count }} students)</option>
                  }
                </select>
              } @else {
                <div class="loading-hint">Loading classes…</div>
              }
            </div>
          }

          <!-- Fee heads -->
          <div class="section-block">
            <div class="sb-title">
              <mat-icon>list</mat-icon> Fee Heads <span class="req">*</span>
              <span class="total-badge">Total: ₹{{ totalAmount() | number }}</span>
            </div>

            <div formArrayName="heads" class="heads-list">
              <div class="heads-header">
                <span class="h-name">Fee Head Name</span>
                <span class="h-amt">Amount (₹)</span>
                <span class="h-opt">Optional</span>
                <span class="h-del"></span>
              </div>
              @for (head of heads.controls; track $index) {
                <div [formGroupName]="$index" class="head-row">
                  <input class="field-input h-name" formControlName="name"
                         placeholder="e.g. Tuition Fee">
                  <div class="amt-wrap h-amt">
                    <span class="amt-prefix">₹</span>
                    <input class="field-input amt-input" type="number"
                           formControlName="amount" placeholder="0" min="0">
                  </div>
                  <div class="h-opt toggle-wrap">
                    <label class="toggle">
                      <input type="checkbox" formControlName="is_optional">
                      <span class="toggle-track"></span>
                    </label>
                  </div>
                  <button type="button" class="del-btn h-del" (click)="removeHead($index)"
                          [disabled]="heads.length === 1">
                    <mat-icon style="font-size:15px;width:15px;height:15px">delete</mat-icon>
                  </button>
                </div>
              }
            </div>

            <button type="button" class="add-head-btn" (click)="addHead()">
              <mat-icon style="font-size:16px;width:16px;height:16px">add_circle_outline</mat-icon>
              Add Fee Head
            </button>
          </div>

          @if (error()) {
            <div class="error-banner">
              <mat-icon style="font-size:15px;width:15px;height:15px;flex-shrink:0">error_outline</mat-icon>
              {{ error() }}
            </div>
          }
        </form>
      </div>

      <div class="dialog-footer">
        <button class="btn-ghost" mat-dialog-close>Cancel</button>
        <button class="btn-primary" (click)="submit()" [disabled]="form.invalid || submitting()">
          @if (submitting()) {
            <mat-progress-spinner diameter="16" mode="indeterminate"
              style="--mdc-circular-progress-active-indicator-color:#fff" />
          } @else {
            <ng-container>
              <mat-icon style="font-size:15px;width:15px;height:15px">check</mat-icon>
              {{ isEdit ? 'Save Changes' : 'Create Structure' }}
            </ng-container>
          }
        </button>
      </div>
    </div>
  `,
  styles: [`
    .dialog-shell { width: 560px; display: flex; flex-direction: column; max-height: 90vh; }

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
      margin-left: auto; background: none; border: none; width: 28px; height: 28px;
      border-radius: 6px; cursor: pointer; color: var(--text-3);
      display: flex; align-items: center; justify-content: center;
      &:hover { background: var(--bg); }
      mat-icon { font-size: 18px; width: 18px; height: 18px; }
    }

    .dialog-body { flex: 1; overflow-y: auto; padding: 18px 24px; }
    .fs-form { display: flex; flex-direction: column; gap: 14px; }
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

    /* Fee heads section */
    .section-block {
      background: var(--bg); border-radius: 9px; padding: 14px;
      display: flex; flex-direction: column; gap: 10px;
    }
    .sb-title {
      display: flex; align-items: center; gap: 6px;
      font-size: 12px; font-weight: 600; color: var(--text-2);
      mat-icon { font-size: 15px; width: 15px; height: 15px; color: var(--blue); }
    }
    .total-badge {
      margin-left: auto;
      background: var(--green-light); color: var(--green);
      font-size: 11px; font-weight: 600; padding: 2px 8px; border-radius: 5px;
    }

    .heads-list  { display: flex; flex-direction: column; gap: 6px; }
    .heads-header {
      display: flex; gap: 8px; align-items: center;
      font-size: 10px; font-weight: 600; text-transform: uppercase;
      letter-spacing: .3px; color: var(--text-4); padding: 0 2px;
    }
    .head-row { display: flex; gap: 8px; align-items: center; }

    .h-name { flex: 1; min-width: 0; }
    .h-amt  { width: 130px; flex-shrink: 0; }
    .h-opt  { width: 60px; flex-shrink: 0; text-align: center; }
    .h-del  { width: 30px; flex-shrink: 0; }

    .amt-wrap   { display: flex; align-items: center; }
    .amt-prefix {
      height: 34px; padding: 0 8px;
      background: var(--bg); border: 1px solid var(--border); border-right: none;
      border-radius: 7px 0 0 7px; font-size: 13px; color: var(--text-3);
      display: flex; align-items: center; flex-shrink: 0;
    }
    .amt-input { border-radius: 0 7px 7px 0 !important; text-align: right; }

    /* Toggle */
    .toggle-wrap { display: flex; align-items: center; justify-content: center; }
    .toggle { position: relative; display: inline-block; width: 32px; height: 18px; cursor: pointer; }
    .toggle input { opacity: 0; width: 0; height: 0; }
    .toggle-track {
      position: absolute; inset: 0; background: var(--border);
      border-radius: 18px; transition: background .2s;
      &::before {
        content: ''; position: absolute;
        width: 12px; height: 12px; border-radius: 50%; background: #fff;
        top: 3px; left: 3px; transition: transform .2s;
      }
    }
    .toggle input:checked + .toggle-track {
      background: var(--blue);
      &::before { transform: translateX(14px); }
    }

    .del-btn {
      width: 30px; height: 34px; border-radius: 7px;
      background: none; border: 1px solid var(--border);
      cursor: pointer; color: var(--red);
      display: flex; align-items: center; justify-content: center;
      &:hover:not(:disabled) { background: var(--red-light); }
      &:disabled { opacity: .4; cursor: not-allowed; }
    }
    .add-head-btn {
      display: flex; align-items: center; gap: 6px;
      background: none; border: 1px dashed #D1D5DB;
      border-radius: 8px; width: 100%; padding: 8px;
      font-size: 12.5px; color: var(--blue); cursor: pointer;
      justify-content: center; font-weight: 500;
      &:hover { background: var(--blue-light); border-color: var(--blue-mid); }
    }

    .loading-hint { font-size: 12px; color: var(--text-3); padding: 8px 10px; }
    .error-banner {
      display: flex; align-items: center; gap: 8px;
      background: var(--red-light); border: 1px solid #FECACA;
      color: #991B1B; padding: 10px 12px; border-radius: 8px; font-size: 12.5px;
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
export class FeeStructureDialogComponent implements OnInit {
  private fb        = inject(FormBuilder);
  private api       = inject(ApiService);
  private dialogRef = inject(MatDialogRef<FeeStructureDialogComponent>);

  existing: FeeStructure | null = inject(MAT_DIALOG_DATA);
  isEdit    = !!this.existing;
  submitting = signal(false);
  error      = signal('');
  classes    = signal<SchoolClass[]>([]);

  form = this.fb.group({
    name:          [this.existing?.name ?? '', Validators.required],
    billing_cycle: [this.existing?.billing_cycle ?? 'monthly', Validators.required],
    academic_year: [this.existing?.academic_year ?? '2025-2026', Validators.required],
    applies_to:    ['all'],
    class_id:      [''],
    heads:         this.fb.array(
      (this.existing?.heads ?? [{ name: '', amount: 0, is_optional: false }])
        .map((h: any) => this.fb.group({
          name:        [h.name, Validators.required],
          amount:      [h.amount, [Validators.required, Validators.min(0)]],
          is_optional: [h.is_optional ?? false],
        }))
    ),
  });

  ngOnInit() {
    this.api.get<any>('/students/classes').subscribe({
      next: (res: any) => this.classes.set(res.data ?? []),
    });
  }

  get heads(): FormArray { return this.form.get('heads') as FormArray; }

  totalAmount(): number {
    return this.heads.controls.reduce((s, c) => s + (+c.value.amount || 0), 0);
  }

  addHead() {
    this.heads.push(this.fb.group({
      name:        ['', Validators.required],
      amount:      [0, [Validators.required, Validators.min(0)]],
      is_optional: [false],
    }));
  }

  removeHead(i: number) { this.heads.removeAt(i); }

  submit() {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    this.submitting.set(true);
    this.error.set('');

    const val = this.form.value;
    const payload = {
      name:          val.name,
      billing_cycle: val.billing_cycle,
      academic_year: val.academic_year,
      applies_to:    val.applies_to,
      class_ids:     val.applies_to === 'class' && val.class_id ? [val.class_id] : [],
      heads:         (val.heads ?? []).map((h: any) => ({
        name:        h.name,
        amount:      +h.amount,
        is_optional: !!h.is_optional,
      })),
    };

    const req = this.isEdit
      ? this.api.put<any>('/fees/structures/' + this.existing!.id, payload)
      : this.api.post<any>('/fees/structures', payload);

    req.subscribe({
      next: (res: any) => { this.submitting.set(false); this.dialogRef.close(res.data); },
      error: (err: any) => {
        this.submitting.set(false);
        this.error.set(err.error?.error?.message ?? 'Failed to save. Please try again.');
      },
    });
  }
}
