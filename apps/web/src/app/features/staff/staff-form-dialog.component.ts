import { Component, inject, signal, OnInit } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators, FormArray } from '@angular/forms';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ApiService } from '../../core/services/api.service';
import { AuthService } from '../../core/services/auth.service';
import type { StaffMember } from './staff.component';

@Component({
  selector: 'app-staff-form-dialog',
  standalone: true,
  imports: [ ReactiveFormsModule, MatDialogModule, MatIconModule, MatProgressSpinnerModule ],
  template: `
    <div class="dialog-shell">

      <div class="dialog-header">
        <div class="dh-icon"><mat-icon>{{ isEdit ? 'edit' : 'person_add' }}</mat-icon></div>
        <div>
          <div class="dh-title">{{ isEdit ? 'Edit Staff Member' : 'Add Staff Member' }}</div>
          <div class="dh-sub">{{ isEdit ? (staff?.first_name + ' ' + staff?.last_name) : 'Fill in the details below' }}</div>
        </div>
        <button class="dh-close" mat-dialog-close><mat-icon>close</mat-icon></button>
      </div>

      <!-- Step indicator -->
      <div class="step-bar">
        @for (tab of tabs; track tab.key; let i = $index) {
          <div class="step" [class.active]="activeTab() === tab.key" [class.done]="isStepDone(i)">
            <div class="step-num">{{ isStepDone(i) ? '✓' : (i + 1) }}</div>
            <div class="step-label">{{ tab.label }}</div>
          </div>
          @if (i < tabs.length - 1) { <div class="step-line" [class.done]="isStepDone(i)"></div> }
        }
      </div>

      <div class="dialog-body">
        <form [formGroup]="form">

          <!-- ── Personal ────────────────────────────────────── -->
          @if (activeTab() === 'personal') {
            <div class="form-section">
              <div class="form-row">
                <div class="field-group fill">
                  <label class="field-label">First Name <span class="req">*</span></label>
                  <input class="field-input" formControlName="first_name" placeholder="First name">
                </div>
                <div class="field-group fill">
                  <label class="field-label">Last Name <span class="req">*</span></label>
                  <input class="field-input" formControlName="last_name" placeholder="Last name">
                </div>
              </div>

              <div class="form-row">
                <div class="field-group fill">
                  <label class="field-label">Email <span class="req">*</span></label>
                  <input class="field-input" type="email" formControlName="email"
                         placeholder="email@school.in" [readonly]="isEdit">
                </div>
                <div class="field-group w-180">
                  <label class="field-label">Role <span class="req">*</span></label>
                  <select class="field-input" formControlName="role">
                    <option value="teacher">Teacher</option>
                    <option value="assistant_teacher">Asst. Teacher</option>
                    <option value="accountant">Accountant</option>
                    <option value="driver">Driver</option>
                    <option value="support">Support Staff</option>
                    <option value="admission_staff">Admission Staff</option>
                    @if (isOwner()) {
                      <option value="principal">Principal</option>
                    }
                  </select>
                </div>
              </div>

              @if (!isEdit) {
                <div class="field-group">
                  <label class="field-label">Password <span class="req">*</span></label>
                  <input class="field-input" type="password" formControlName="password"
                         placeholder="Minimum 8 characters">
                </div>
              }

              <div class="form-row">
                <div class="field-group fill">
                  <label class="field-label">Phone</label>
                  <input class="field-input" formControlName="phone" placeholder="+91 XXXXX XXXXX">
                </div>
                <div class="field-group fill">
                  <label class="field-label">Date of Birth</label>
                  <input class="field-input" type="date" formControlName="dob">
                </div>
              </div>

              <div class="field-group">
                <label class="field-label">Joining Date</label>
                <input class="field-input" type="date" formControlName="joining_date" style="width:200px">
              </div>
            </div>
          }

          <!-- ── Employment ──────────────────────────────────── -->
          @if (activeTab() === 'employment') {
            <div class="form-section">
              <div class="form-row">
                <div class="field-group fill">
                  <label class="field-label">Employee ID</label>
                  <input class="field-input" formControlName="employee_no"
                         [readonly]="isEdit"
                         [placeholder]="isEdit ? '' : 'Auto-generated (e.g. EMP-001)'"
                         [style.color]="isEdit ? 'var(--blue)' : ''"
                         [style.font-family]="isEdit ? 'monospace' : ''">
                  @if (!isEdit) {
                    <div style="font-size:11px;color:var(--text-3);margin-top:2px">
                      Leave blank to auto-generate
                    </div>
                  }
                </div>
                <div class="field-group fill">
                  <label class="field-label">Department</label>
                  <input class="field-input" formControlName="department" placeholder="e.g. Primary">
                </div>
              </div>

              <div class="field-group">
                <label class="field-label">Designation</label>
                <input class="field-input" formControlName="designation" placeholder="e.g. Senior Teacher">
              </div>

              <div class="form-row">
                <div class="field-group fill">
                  <label class="field-label">Salary (₹/month)</label>
                  <input class="field-input" type="number" formControlName="salary" placeholder="0">
                </div>
                <div class="field-group w-180">
                  <label class="field-label">Pay Frequency</label>
                  <select class="field-input" formControlName="pay_frequency">
                    <option value="monthly">Monthly</option>
                    <option value="weekly">Weekly</option>
                  </select>
                </div>
              </div>

              <div class="field-group">
                <label class="field-label">Address</label>
                <textarea class="field-input field-textarea" formControlName="address" rows="3"
                          placeholder="Full address"></textarea>
              </div>
            </div>
          }

          <!-- ── Bank & IDs ──────────────────────────────────── -->
          @if (activeTab() === 'banking') {
            <div class="form-section">
              <div class="form-row">
                <div class="field-group fill">
                  <label class="field-label">Bank Account No</label>
                  <input class="field-input" formControlName="bank_account" placeholder="Account number">
                </div>
                <div class="field-group fill">
                  <label class="field-label">IFSC Code</label>
                  <input class="field-input" formControlName="bank_ifsc" placeholder="IFSC code">
                </div>
              </div>
              <div class="form-row">
                <div class="field-group fill">
                  <label class="field-label">PAN Number</label>
                  <input class="field-input" formControlName="pan_no" placeholder="XXXXX0000X">
                </div>
                <div class="field-group fill">
                  <label class="field-label">Aadhar Number</label>
                  <input class="field-input" formControlName="aadhar_no" placeholder="XXXX XXXX XXXX">
                </div>
              </div>

              <!-- Emergency contact -->
              <div class="section-divider">Emergency Contact</div>
              <div formGroupName="emergency_contact" class="form-row">
                <div class="field-group fill">
                  <label class="field-label">Name</label>
                  <input class="field-input" formControlName="name" placeholder="Contact name">
                </div>
                <div class="field-group w-160">
                  <label class="field-label">Relation</label>
                  <input class="field-input" formControlName="relation" placeholder="e.g. Spouse">
                </div>
                <div class="field-group w-160">
                  <label class="field-label">Phone</label>
                  <input class="field-input" formControlName="phone" placeholder="Phone number">
                </div>
              </div>
            </div>
          }

        </form>
      </div>

      @if (error()) {
        <div class="error-banner">
          <mat-icon style="font-size:15px;width:15px;height:15px;flex-shrink:0">error_outline</mat-icon>
          {{ error() }}
        </div>
      }

      <div class="dialog-footer">
        <button class="btn-ghost" mat-dialog-close>Cancel</button>
        <div class="footer-actions">
          @if (activeTabIndex() > 0) {
            <button class="btn-outline" (click)="prevStep()">
              <mat-icon style="font-size:15px;width:15px;height:15px">arrow_back</mat-icon>
              Back
            </button>
          }
          @if (activeTabIndex() < tabs.length - 1) {
            <button class="btn-primary" (click)="nextStep()">
              Next
              <mat-icon style="font-size:15px;width:15px;height:15px">arrow_forward</mat-icon>
            </button>
          } @else {
            <button class="btn-primary" (click)="submit()" [disabled]="form.invalid || submitting()">
              @if (submitting()) {
                <mat-progress-spinner diameter="16" mode="indeterminate"
                  style="--mdc-circular-progress-active-indicator-color:#fff"/>
              } @else {
                <mat-icon style="font-size:15px;width:15px;height:15px">save</mat-icon>
              }
              {{ isEdit ? 'Save Changes' : 'Add Staff Member' }}
            </button>
          }
        </div>
      </div>
    </div>
  `,
  styles: [`
    .dialog-shell { width: 100%; display: flex; flex-direction: column; max-height: 90vh; }
    .dialog-header {
      display: flex; align-items: center; gap: 12px;
      padding: 18px 24px 14px; border-bottom: 1px solid var(--border); flex-shrink: 0;
    }
    .dh-icon {
      width: 36px; height: 36px; border-radius: 9px;
      background: var(--blue-light); color: var(--blue); flex-shrink: 0;
      display: flex; align-items: center; justify-content: center;
      mat-icon { font-size: 18px; width: 18px; height: 18px; }
    }
    .dh-title { font-size: 15px; font-weight: 600; color: var(--text); }
    .dh-sub   { font-size: 11px; color: var(--text-3); }
    .dh-close {
      margin-left: auto; background: none; border: none;
      width: 28px; height: 28px; border-radius: 6px; cursor: pointer; color: var(--text-3);
      display: flex; align-items: center; justify-content: center;
      &:hover { background: var(--bg); }
      mat-icon { font-size: 18px; width: 18px; height: 18px; }
    }
    .step-bar {
      display: flex; align-items: center; padding: 14px 24px;
      background: var(--bg); border-bottom: 1px solid var(--border); flex-shrink: 0;
    }
    .step {
      display: flex; align-items: center; gap: 7px;
    }
    .step-num {
      width: 24px; height: 24px; border-radius: 50%; flex-shrink: 0;
      background: var(--border); color: var(--text-3);
      font-size: 11px; font-weight: 700;
      display: flex; align-items: center; justify-content: center;
      .step.active & { background: var(--blue); color: #fff; }
      .step.done  & { background: var(--green); color: #fff; }
    }
    .step-label { font-size: 12px; font-weight: 500; color: var(--text-3);
      .step.active & { color: var(--blue); font-weight: 600; }
      .step.done  & { color: var(--green); }
    }
    .step-line {
      flex: 1; height: 2px; background: var(--border); margin: 0 10px;
      &.done { background: var(--green); }
    }
    .footer-actions { display: flex; gap: 8px; }
    .btn-outline {
      display: flex; align-items: center; gap: 5px;
      background: #fff; color: var(--text-2); border: 1px solid var(--border);
      border-radius: 8px; height: 36px; padding: 0 14px;
      font-size: 13px; font-weight: 500; cursor: pointer;
      &:hover { background: var(--bg); }
    }
    .dialog-body { flex: 1; overflow-y: auto; padding: 18px 24px; background: var(--bg); }
    .form-section { display: flex; flex-direction: column; gap: 14px; }
    .form-row { display: flex; gap: 10px; }
    .fill  { flex: 1; min-width: 0; }
    .w-180 { width: 180px; flex-shrink: 0; }
    .w-160 { width: 160px; flex-shrink: 0; }
    .field-group { display: flex; flex-direction: column; gap: 5px; }
    .field-label {
      font-size: 12px; font-weight: 500; color: var(--text-2);
      .req { color: var(--red); }
    }
    .field-input {
      height: 36px; padding: 0 10px; width: 100%;
      background: #fff; border: 1px solid var(--border);
      border-radius: 7px; font-size: 13px; color: var(--text);
      outline: none; font-family: inherit;
      &:focus { border-color: var(--blue); box-shadow: 0 0 0 2px rgba(37,99,235,.1); }
      &[readonly] { background: var(--bg); color: var(--text-3); }
    }
    select.field-input { cursor: pointer; }
    .field-textarea { height: auto; padding: 8px 10px; resize: vertical; }
    .section-divider {
      font-size: 11px; font-weight: 600; text-transform: uppercase;
      letter-spacing: .4px; color: var(--text-4); padding-top: 4px;
    }
    .error-banner {
      display: flex; align-items: center; gap: 8px; flex-shrink: 0;
      background: var(--red-light); border-top: 1px solid #FECACA;
      color: #991B1B; padding: 10px 24px; font-size: 12.5px;
    }
    .dialog-footer {
      display: flex; justify-content: flex-end; gap: 8px;
      padding: 14px 24px; border-top: 1px solid var(--border);
      background: var(--surface); flex-shrink: 0;
    }
    .btn-ghost {
      background: none; border: none; cursor: pointer;
      font-size: 13px; color: var(--text-3); padding: 0 10px; height: 36px; border-radius: 7px;
      &:hover { background: var(--border-light); }
    }
    .btn-primary {
      display: flex; align-items: center; gap: 6px;
      background: var(--blue); color: #fff; border: none;
      border-radius: 8px; height: 36px; padding: 0 18px;
      font-size: 13px; font-weight: 500; cursor: pointer;
      &:hover:not(:disabled) { background: #1D4ED8; }
      &:disabled { opacity: .6; cursor: not-allowed; }
    }
  `],
})
export class StaffFormDialogComponent {
  private fb        = inject(FormBuilder);
  private api       = inject(ApiService);
  private auth      = inject(AuthService);
  private dialogRef = inject(MatDialogRef<StaffFormDialogComponent>);

  staff: StaffMember | null = inject(MAT_DIALOG_DATA);
  isOwner = () => this.auth.user()?.role === 'owner';
  isEdit     = !!this.staff;
  submitting = signal(false);
  error      = signal('');
  activeTab  = signal('personal');

  activeTabIndex = () => this.tabs.findIndex(t => t.key === this.activeTab());
  isStepDone    = (i: number) => i < this.activeTabIndex();

  nextStep() {
    const idx = this.activeTabIndex();
    if (idx < this.tabs.length - 1) this.activeTab.set(this.tabs[idx + 1].key);
  }
  prevStep() {
    const idx = this.activeTabIndex();
    if (idx > 0) this.activeTab.set(this.tabs[idx - 1].key);
  }

  tabs = [
    { key: 'personal',   label: 'Personal' },
    { key: 'employment', label: 'Employment' },
    { key: 'banking',    label: 'Bank & IDs' },
  ];

  form = this.fb.group({
    first_name:    [this.staff?.first_name ?? '',    Validators.required],
    last_name:     [this.staff?.last_name  ?? '',    Validators.required],
    email:         [this.staff?.email      ?? '',    [Validators.required, Validators.email]],
    role:          [this.staff?.role       ?? 'teacher', Validators.required],
    password:      ['', this.isEdit ? [] : [Validators.required, Validators.minLength(8)]],
    phone:         [this.staff?.phone      ?? ''],
    dob:           [this.staff?.dob        ?? ''],
    joining_date:  [this.staff?.joining_date ?? ''],
    employee_no:   [this.staff?.employee_no  ?? ''],
    department:    [this.staff?.department   ?? ''],
    designation:   [this.staff?.designation  ?? ''],
    salary:        [this.staff?.salary       ?? null],
    pay_frequency: ['monthly'],
    address:       [(this.staff as any)?.address ?? ''],
    bank_account:  [(this.staff as any)?.bank_account ?? ''],
    bank_ifsc:     [(this.staff as any)?.bank_ifsc    ?? ''],
    pan_no:        [(this.staff as any)?.pan_no        ?? ''],
    aadhar_no:     [(this.staff as any)?.aadhar_no     ?? ''],
    emergency_contact: this.fb.group({
      name:     [(this.staff as any)?.emergency_contact?.name     ?? ''],
      relation: [(this.staff as any)?.emergency_contact?.relation ?? ''],
      phone:    [(this.staff as any)?.emergency_contact?.phone    ?? ''],
    }),
  });

  submit() {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    this.submitting.set(true);
    this.error.set('');

    const val = this.form.value;
    const payload: Record<string, unknown> = {};

    // Only include non-empty values — avoids sending empty strings that fail validation
    const str = (v: any) => (v && String(v).trim()) ? String(v).trim() : undefined;

    if (!this.isEdit) payload['email']    = str(val.email);
    if (!this.isEdit) payload['password'] = val.password;

    payload['first_name'] = str(val.first_name);
    payload['last_name']  = str(val.last_name);
    payload['role']       = val.role;

    if (str(val.phone))        payload['phone']        = str(val.phone);
    if (str(val.dob))          payload['dob']          = str(val.dob);
    if (str(val.joining_date)) payload['joining_date'] = str(val.joining_date);
    if (str(val.employee_no))  payload['employee_no']  = str(val.employee_no);
    if (str(val.department))   payload['department']   = str(val.department);
    if (str(val.designation))  payload['designation']  = str(val.designation);
    if (str(val.address))      payload['address']      = str(val.address);
    if (str(val.bank_account)) payload['bank_account'] = str(val.bank_account);
    if (str(val.bank_ifsc))    payload['bank_ifsc']    = str(val.bank_ifsc);

    // Numeric — coerce to number, only include if positive
    if (val.salary && +val.salary > 0) payload['salary'] = +val.salary;

    // PAN — only include if matches pattern
    const pan = str(val.pan_no)?.toUpperCase();
    if (pan && /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(pan)) payload['pan_no'] = pan;

    // Aadhar — only include if 12 digits
    const aadhar = str(val.aadhar_no)?.replace(/\s/g, '');
    if (aadhar && /^\d{12}$/.test(aadhar)) payload['aadhar_no'] = aadhar;

    // Emergency contact — only include if name is filled
    const ec = val.emergency_contact as any;
    if (str(ec?.name) && str(ec?.relation) && str(ec?.phone)) {
      payload['emergency_contact'] = {
        name:     str(ec.name),
        relation: str(ec.relation),
        phone:    str(ec.phone),
      };
    }

    const req = this.isEdit
      ? this.api.put<any>('/staff/' + this.staff!.id, payload)
      : this.api.post<any>('/staff', payload);

    req.subscribe({
      next: (res: any) => { this.submitting.set(false); this.dialogRef.close(res.data); },
      error: (err: any) => {
        this.submitting.set(false);
        const details = err.error?.error?.details;
        const msg = details
          ? Object.entries(details).map(([k, v]) => `${k}: ${(v as string[]).join(', ')}`).join(' | ')
          : (err.error?.error?.message ?? 'Failed to save. Please try again.');
        this.error.set(msg);
      },
    });
  }
}
