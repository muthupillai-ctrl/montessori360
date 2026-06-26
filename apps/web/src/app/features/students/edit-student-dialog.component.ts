import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators, FormGroup } from '@angular/forms';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { TitleCasePipe } from '@angular/common';
import { ApiService } from '../../core/services/api.service';
import type { Student } from '../../core/models';

interface SchoolClass { id: string; name: string; capacity: number; enrolled_count: number; }
interface ParentRecord {
  id: string;
  relation: string;
  first_name: string;
  last_name: string;
  mobile: string;
  email?: string | null;
  mobile_alt?: string | null;
  is_primary: boolean;
  is_emergency_contact: boolean;
  can_pickup?: boolean;
  address_line1?: string | null;
  address_line2?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  pincode?: string | null;
  profession?: string | null;
  employer?: string | null;
  annual_income?: number | null;
  education?: string | null;
  notes?: string | null;
}

const STEPS = [
  { key: 'basic',     label: 'Basic Info' },
  { key: 'medical',   label: 'Medical'    },
  { key: 'parents',   label: 'Parents'    },
  { key: 'transport', label: 'Transport'  },
];

@Component({
  selector: 'app-edit-student-dialog',
  standalone: true,
  imports: [ ReactiveFormsModule, MatDialogModule, MatIconModule, MatProgressSpinnerModule, TitleCasePipe ],
  template: `
    <div class="dialog-shell">

      <!-- Header -->
      <div class="dialog-header">
        <div class="dh-icon">
          <mat-icon style="font-size:18px;width:18px;height:18px">edit</mat-icon>
        </div>
        <div>
          <div class="dh-title">Edit Student</div>
          <div class="dh-sub">{{ student.first_name }} {{ student.last_name }} · {{ student.admission_no }}</div>
        </div>
        <button class="dh-close" mat-dialog-close>
          <mat-icon style="font-size:18px;width:18px;height:18px">close</mat-icon>
        </button>
      </div>

      <!-- Step bar -->
      <div class="step-bar">
        @for (s of steps; track s.key; let i = $index) {
          <div class="step" [class.active]="stepIndex() === i" [class.done]="stepIndex() > i"
               (click)="stepIndex.set(i)">
            <div class="step-circle">
              @if (stepIndex() > i) {
                <mat-icon style="font-size:14px;width:14px;height:14px">check</mat-icon>
              } @else { {{ i + 1 }} }
            </div>
            <span class="step-label">{{ s.label }}</span>
          </div>
          @if (i < steps.length - 1) {
            <div class="step-line" [class.done]="stepIndex() > i"></div>
          }
        }
      </div>

      <!-- Body -->
      @if (dataLoading()) {
        <div class="loading-state">
          <mat-progress-spinner diameter="28" mode="indeterminate"/>
          <span>Loading student data…</span>
        </div>
      } @else {
        <div class="dialog-body">

          <!-- ── Step 1: Basic Info ─────────────────────────────── -->
          @if (stepIndex() === 0) {
            <form [formGroup]="basicForm" class="form-section">
              <div class="form-row">
                <div class="field-group fill">
                  <label class="fl">First Name <span class="req">*</span></label>
                  <input class="fi" formControlName="first_name" placeholder="Arjun"
                         [class.err]="basicForm.get('first_name')?.invalid && basicForm.get('first_name')?.touched">
                  @if (basicForm.get('first_name')?.invalid && basicForm.get('first_name')?.touched) {
                    <div class="field-error">Required</div>
                  }
                </div>
                <div class="field-group fill">
                  <label class="fl">Last Name</label>
                  <input class="fi" formControlName="last_name" placeholder="Sharma">
                </div>
              </div>
              <div class="form-row">
                <div class="field-group fill">
                  <label class="fl">Date of Birth <span class="req">*</span></label>
                  <input class="fi" type="date" formControlName="dob"
                         [class.err]="basicForm.get('dob')?.invalid && basicForm.get('dob')?.touched">
                </div>
                <div class="field-group fill">
                  <label class="fl">Gender</label>
                  <select class="fi" formControlName="gender">
                    <option value="">Select…</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="other">Other</option>
                  </select>
                </div>
              </div>
              <div class="field-group">
                <label class="fl">Class</label>
                <select class="fi" formControlName="class_id">
                  <option value="">Unassigned</option>
                  @for (cls of classes(); track cls.id) {
                    <option [value]="cls.id">{{ cls.name }} ({{ cls.enrolled_count }}/{{ cls.capacity }})</option>
                  }
                </select>
              </div>
              <div class="form-row">
                <div class="field-group fill">
                  <label class="fl">Admission Date</label>
                  <input class="fi" type="date" formControlName="admission_date">
                </div>
                <div class="field-group fill">
                  <label class="fl">Blood Group</label>
                  <select class="fi" formControlName="blood_group">
                    <option value="">Unknown</option>
                    @for (bg of bloodGroups; track bg) { <option [value]="bg">{{ bg }}</option> }
                  </select>
                </div>
              </div>
              <div class="form-row">
                <div class="field-group fill">
                  <label class="fl">Nationality</label>
                  <input class="fi" formControlName="nationality" placeholder="Indian">
                </div>
                <div class="field-group fill">
                  <label class="fl">Mother Tongue</label>
                  <input class="fi" formControlName="mother_tongue" placeholder="e.g. Tamil, Hindi">
                </div>
                <div class="field-group fill">
                  <label class="fl">Aadhar Number</label>
                  <input class="fi" formControlName="aadhar_no" placeholder="XXXXXXXXXXXX" maxlength="12">
                </div>
              </div>
              <div class="field-group">
                <label class="fl">Previous School</label>
                <input class="fi" formControlName="previous_school" placeholder="Name of previous school (if any)">
              </div>
            </form>
          }

          <!-- ── Step 2: Medical ───────────────────────────────── -->
          @if (stepIndex() === 1) {
            <form [formGroup]="medicalForm" class="form-section">
              <div class="field-group">
                <label class="fl">Allergies <span class="hint">(comma separated)</span></label>
                <input class="fi" formControlName="allergies_text" placeholder="e.g. Peanuts, Dairy">
              </div>
              <div class="field-group">
                <label class="fl">Dietary Notes</label>
                <input class="fi" formControlName="dietary_notes" placeholder="e.g. Vegetarian, No egg">
              </div>
              <div class="section-divider">Medical Conditions</div>
              <div class="field-group">
                <label class="fl">Conditions</label>
                <input class="fi" formControlName="conditions_text" placeholder="e.g. Asthma, Diabetes">
              </div>
              <div class="field-group">
                <label class="fl">Medications</label>
                <input class="fi" formControlName="medications_text" placeholder="e.g. Inhaler, Insulin">
              </div>
              <div class="section-divider">Doctor Details</div>
              <div class="form-row">
                <div class="field-group fill">
                  <label class="fl">Doctor Name</label>
                  <input class="fi" formControlName="doctor_name" placeholder="Dr. Name">
                </div>
                <div class="field-group fill">
                  <label class="fl">Doctor Phone</label>
                  <input class="fi" formControlName="doctor_phone" placeholder="+91 XXXXX XXXXX">
                </div>
              </div>
            </form>
          }

          <!-- ── Step 3: Parents ───────────────────────────────── -->
          @if (stepIndex() === 2) {
            <div class="form-section">

              <!-- Parent 1 -->
              <div class="parent-card">
                <div class="pc-head">
                  <div class="pc-title">
                    <mat-icon style="font-size:15px;width:15px;height:15px;color:var(--blue)">person</mat-icon>
                    Parent 1 <span class="req-tag">Required</span>
                  </div>
                </div>
                <form [formGroup]="parent1Form" class="parent-fields">
                  <div class="form-row">
                    <div class="field-group" style="width:130px">
                      <label class="fl">Relation</label>
                      <select class="fi" formControlName="relation">
                        <option value="father">Father</option>
                        <option value="mother">Mother</option>
                        <option value="guardian">Guardian</option>
                        <option value="step_father">Step Father</option>
                        <option value="step_mother">Step Mother</option>
                        <option value="other">Other</option>
                      </select>
                    </div>
                    <div class="field-group fill">
                      <label class="fl">First Name <span class="req">*</span></label>
                      <input class="fi" formControlName="first_name" placeholder="Raj"
                             [class.err]="parent1Form.get('first_name')?.invalid && parent1Form.get('first_name')?.touched">
                    </div>
                    <div class="field-group fill">
                      <label class="fl">Last Name <span class="req">*</span></label>
                      <input class="fi" formControlName="last_name" placeholder="Sharma"
                             [class.err]="parent1Form.get('last_name')?.invalid && parent1Form.get('last_name')?.touched">
                    </div>
                  </div>
                  <div class="form-row">
                    <div class="field-group fill">
                      <label class="fl">Mobile <span class="req">*</span></label>
                      <input class="fi" formControlName="mobile" placeholder="+91 9876543210"
                             [class.err]="parent1Form.get('mobile')?.invalid && parent1Form.get('mobile')?.touched">
                    </div>
                    <div class="field-group fill">
                      <label class="fl">Email</label>
                      <input class="fi" type="email" formControlName="email" placeholder="parent@email.com">
                    </div>
                  </div>
                  <div class="section-divider">Address</div>
                  <div class="form-row">
                    <div class="field-group fill">
                      <label class="fl">Address Line 1</label>
                      <input class="fi" formControlName="address_line1" placeholder="House No, Street">
                    </div>
                    <div class="field-group fill">
                      <label class="fl">Address Line 2</label>
                      <input class="fi" formControlName="address_line2" placeholder="Area, Landmark">
                    </div>
                  </div>
                  <div class="form-row">
                    <div class="field-group fill">
                      <label class="fl">City</label>
                      <input class="fi" formControlName="city" placeholder="Chennai">
                    </div>
                    <div class="field-group fill">
                      <label class="fl">State</label>
                      <input class="fi" formControlName="state" placeholder="Tamil Nadu">
                    </div>
                    <div class="field-group" style="width:100px">
                      <label class="fl">Pincode</label>
                      <input class="fi" formControlName="pincode" placeholder="600001">
                    </div>
                  </div>
                  <div class="section-divider">Professional</div>
                  <div class="form-row">
                    <div class="field-group fill">
                      <label class="fl">Alternate Mobile</label>
                      <input class="fi" formControlName="mobile_alt" placeholder="+91 XXXXX XXXXX">
                    </div>
                    <div class="field-group fill">
                      <label class="fl">Profession</label>
                      <input class="fi" formControlName="profession" placeholder="e.g. Engineer, Doctor">
                    </div>
                  </div>
                  <div class="form-row">
                    <div class="field-group fill">
                      <label class="fl">Employer / Company</label>
                      <input class="fi" formControlName="employer" placeholder="Company name">
                    </div>
                    <div class="field-group fill">
                      <label class="fl">Education</label>
                      <select class="fi" formControlName="education">
                        <option value="">Select…</option>
                        <option>Below 10th</option>
                        <option>10th / SSLC</option>
                        <option>12th / HSC</option>
                        <option>Diploma</option>
                        <option>Graduate</option>
                        <option>Post-Graduate</option>
                        <option>Doctorate</option>
                        <option>Other</option>
                      </select>
                    </div>
                    <div class="field-group" style="width:140px">
                      <label class="fl">Annual Income (₹)</label>
                      <input class="fi" type="number" formControlName="annual_income" placeholder="e.g. 600000">
                    </div>
                  </div>
                  <div class="form-row" style="align-items:center">
                    <label class="check-label">
                      <input type="checkbox" formControlName="can_pickup"> Authorised for Pickup
                    </label>
                  </div>
                  <div class="field-group">
                    <label class="fl">Notes</label>
                    <textarea class="fi ta" formControlName="notes" rows="2"
                              placeholder="Any notes about this parent…"></textarea>
                  </div>
                </form>
              </div>

              <!-- Parent 2 toggle -->
              @if (!showParent2()) {
                <button type="button" class="add-parent-btn" (click)="showParent2.set(true)">
                  <mat-icon style="font-size:15px;width:15px;height:15px">add_circle_outline</mat-icon>
                  Add Second Parent
                </button>
              } @else {
                <div class="parent-card">
                  <div class="pc-head">
                    <div class="pc-title">
                      <mat-icon style="font-size:15px;width:15px;height:15px;color:var(--purple)">person</mat-icon>
                      Parent 2 <span class="opt-tag">Optional</span>
                    </div>
                    <button type="button" class="remove-parent-btn" (click)="removeParent2()">
                      <mat-icon style="font-size:13px;width:13px;height:13px">close</mat-icon>
                      Remove
                    </button>
                  </div>
                  <form [formGroup]="parent2Form" class="parent-fields">
                    <div class="form-row">
                      <div class="field-group" style="width:130px">
                        <label class="fl">Relation</label>
                        <select class="fi" formControlName="relation">
                          <option value="father">Father</option>
                          <option value="mother">Mother</option>
                          <option value="guardian">Guardian</option>
                          <option value="step_father">Step Father</option>
                          <option value="step_mother">Step Mother</option>
                          <option value="other">Other</option>
                        </select>
                      </div>
                      <div class="field-group fill">
                        <label class="fl">First Name <span class="req">*</span></label>
                        <input class="fi" formControlName="first_name" placeholder="Priya"
                               [class.err]="parent2Form.get('first_name')?.invalid && parent2Form.get('first_name')?.touched">
                      </div>
                      <div class="field-group fill">
                        <label class="fl">Last Name <span class="req">*</span></label>
                        <input class="fi" formControlName="last_name" placeholder="Sharma"
                               [class.err]="parent2Form.get('last_name')?.invalid && parent2Form.get('last_name')?.touched">
                      </div>
                    </div>
                    <div class="form-row">
                      <div class="field-group fill">
                        <label class="fl">Mobile <span class="req">*</span></label>
                        <input class="fi" formControlName="mobile" placeholder="+91 9876543210"
                               [class.err]="parent2Form.get('mobile')?.invalid && parent2Form.get('mobile')?.touched">
                      </div>
                      <div class="field-group fill">
                        <label class="fl">Email</label>
                        <input class="fi" type="email" formControlName="email" placeholder="parent@email.com">
                      </div>
                    </div>
                    <div class="section-divider">Address</div>
                    <div class="form-row">
                      <div class="field-group fill">
                        <label class="fl">Address Line 1</label>
                        <input class="fi" formControlName="address_line1" placeholder="House No, Street">
                      </div>
                      <div class="field-group fill">
                        <label class="fl">Address Line 2</label>
                        <input class="fi" formControlName="address_line2" placeholder="Area, Landmark">
                      </div>
                    </div>
                    <div class="form-row">
                      <div class="field-group fill">
                        <label class="fl">City</label>
                        <input class="fi" formControlName="city" placeholder="Chennai">
                      </div>
                      <div class="field-group fill">
                        <label class="fl">State</label>
                        <input class="fi" formControlName="state" placeholder="Tamil Nadu">
                      </div>
                      <div class="field-group" style="width:100px">
                        <label class="fl">Pincode</label>
                        <input class="fi" formControlName="pincode" placeholder="600001">
                      </div>
                    </div>
                    <div class="section-divider">Professional</div>
                    <div class="form-row">
                      <div class="field-group fill">
                        <label class="fl">Alternate Mobile</label>
                        <input class="fi" formControlName="mobile_alt" placeholder="+91 XXXXX XXXXX">
                      </div>
                      <div class="field-group fill">
                        <label class="fl">Profession</label>
                        <input class="fi" formControlName="profession" placeholder="e.g. Engineer, Doctor">
                      </div>
                    </div>
                    <div class="form-row">
                      <div class="field-group fill">
                        <label class="fl">Employer / Company</label>
                        <input class="fi" formControlName="employer" placeholder="Company name">
                      </div>
                      <div class="field-group fill">
                        <label class="fl">Education</label>
                        <select class="fi" formControlName="education">
                          <option value="">Select…</option>
                          <option>Below 10th</option>
                          <option>10th / SSLC</option>
                          <option>12th / HSC</option>
                          <option>Diploma</option>
                          <option>Graduate</option>
                          <option>Post-Graduate</option>
                          <option>Doctorate</option>
                          <option>Other</option>
                        </select>
                      </div>
                      <div class="field-group" style="width:140px">
                        <label class="fl">Annual Income (₹)</label>
                        <input class="fi" type="number" formControlName="annual_income" placeholder="e.g. 600000">
                      </div>
                    </div>
                    <div class="form-row" style="align-items:center">
                      <label class="check-label">
                        <input type="checkbox" formControlName="can_pickup"> Authorised for Pickup
                      </label>
                    </div>
                    <div class="field-group">
                      <label class="fl">Notes</label>
                      <textarea class="fi ta" formControlName="notes" rows="2"
                                placeholder="Any notes about this parent…"></textarea>
                    </div>
                  </form>
                </div>
              }

              <!-- Emergency contact radio -->
              <div class="emergency-section">
                <div class="es-title">
                  <mat-icon style="font-size:14px;width:14px;height:14px;color:var(--red)">emergency</mat-icon>
                  Emergency Contact
                </div>
                <div class="es-options">
                  <label class="radio-option" [class.selected]="emergencyContact() === 'parent1'"
                         (click)="emergencyContact.set('parent1')">
                    <div class="ro-radio" [class.checked]="emergencyContact() === 'parent1'"></div>
                    <div class="ro-label">
                      <div class="ro-name">
                        {{ parent1Name() || 'Parent 1' }}
                        <span class="ro-rel">({{ parent1Form.value.relation | titlecase }})</span>
                      </div>
                      <div class="ro-phone">{{ parent1Form.value.mobile || '—' }}</div>
                    </div>
                  </label>
                  @if (showParent2()) {
                    <label class="radio-option" [class.selected]="emergencyContact() === 'parent2'"
                           (click)="emergencyContact.set('parent2')">
                      <div class="ro-radio" [class.checked]="emergencyContact() === 'parent2'"></div>
                      <div class="ro-label">
                        <div class="ro-name">
                          {{ parent2Name() || 'Parent 2' }}
                          <span class="ro-rel">({{ parent2Form.value.relation | titlecase }})</span>
                        </div>
                        <div class="ro-phone">{{ parent2Form.value.mobile || '—' }}</div>
                      </div>
                    </label>
                  }
                </div>
              </div>

            </div>
          }

          <!-- ── Step 4: Transport ─────────────────────────────── -->
          @if (stepIndex() === 3) {
            <div class="form-section">
              <div class="transport-hint">
                <mat-icon style="font-size:14px;width:14px;height:14px;color:var(--blue);flex-shrink:0">info</mat-icon>
                Optional — leave blank if not using school transport.
              </div>
              @if (currentTransport()) {
                <div class="transport-current">
                  <mat-icon style="font-size:14px;width:14px;height:14px;color:var(--green)">check_circle</mat-icon>
                  Currently on: <strong>{{ currentTransport()!.route_name }}</strong>
                </div>
              }
              <form [formGroup]="transportForm">
                <div class="field-group">
                  <label class="fl">Route</label>
                  <select class="fi" formControlName="route_id" (change)="onRouteChange($event)">
                    <option value="">— No transport —</option>
                    @for (r of routes(); track r.id) {
                      <option [value]="r.id">{{ r.name }}{{ r.route_code ? ' (' + r.route_code + ')' : '' }}</option>
                    }
                  </select>
                </div>
                @if (transportForm.value.route_id) {
                  <div class="form-row" style="margin-top:10px">
                    <div class="field-group fill">
                      <label class="fl">Pickup Stop</label>
                      <select class="fi" formControlName="pickup_stop_id">
                        <option value="">— Select stop —</option>
                        @for (s of routeStops(); track s.id) {
                          <option [value]="s.id">{{ s.stop_order }}. {{ s.name }}{{ s.morning_eta ? ' (' + s.morning_eta + ')' : '' }}</option>
                        }
                      </select>
                    </div>
                    <div class="field-group fill">
                      <label class="fl">Drop Stop</label>
                      <select class="fi" formControlName="drop_stop_id">
                        <option value="">— Same as pickup —</option>
                        @for (s of routeStops(); track s.id) {
                          <option [value]="s.id">{{ s.stop_order }}. {{ s.name }}{{ s.evening_eta ? ' (' + s.evening_eta + ')' : '' }}</option>
                        }
                      </select>
                    </div>
                  </div>
                }
              </form>
            </div>
          }

        </div>

        @if (error()) {
          <div class="error-banner">
            <mat-icon style="font-size:14px;width:14px;height:14px;flex-shrink:0">error_outline</mat-icon>
            {{ error() }}
          </div>
        }

        <!-- Footer -->
        <div class="dialog-footer">
          <button class="btn-ghost" mat-dialog-close>Cancel</button>
          <div class="nav-btns">
            @if (stepIndex() > 0) {
              <button class="btn-back" type="button" (click)="stepIndex.update(i => i - 1)">
                <mat-icon style="font-size:16px;width:16px;height:16px">chevron_left</mat-icon>
                Back
              </button>
            }
            @if (stepIndex() < steps.length - 1) {
              <button class="btn-next" type="button" (click)="next()">
                Next
                <mat-icon style="font-size:16px;width:16px;height:16px">chevron_right</mat-icon>
              </button>
            } @else {
              <button class="btn-primary" type="button" (click)="submit()" [disabled]="submitting()">
                @if (submitting()) {
                  <mat-progress-spinner diameter="16" mode="indeterminate"
                    style="--mdc-circular-progress-active-indicator-color:#fff"/>
                } @else {
                  <mat-icon style="font-size:14px;width:14px;height:14px">save</mat-icon>
                }
                Save Changes
              </button>
            }
          </div>
        </div>
      }

    </div>
  `,
  styles: [`
    .dialog-shell { width:560px; max-width:100%; display:flex; flex-direction:column; height:86vh; max-height:90vh; }

    .dialog-header { display:flex; align-items:center; gap:12px; padding:16px 20px 12px; border-bottom:1px solid var(--border); flex-shrink:0; }
    .dh-icon { width:36px; height:36px; border-radius:9px; flex-shrink:0; background:var(--blue-light); color:var(--blue); display:flex; align-items:center; justify-content:center; }
    .dh-title { font-size:15px; font-weight:600; color:var(--text); }
    .dh-sub   { font-size:11px; color:var(--text-3); }
    .dh-close { margin-left:auto; background:none; border:none; cursor:pointer; color:var(--text-3); width:28px; height:28px; border-radius:6px; display:flex; align-items:center; justify-content:center; &:hover { background:var(--bg); } }

    .step-bar { display:flex; align-items:center; padding:12px 20px; background:var(--bg); border-bottom:1px solid var(--border); flex-shrink:0; }
    .step { display:flex; align-items:center; gap:7px; cursor:pointer; &:hover .step-circle { border-color:var(--blue); } }
    .step-circle { width:24px; height:24px; border-radius:50%; border:2px solid var(--border); background:var(--surface); display:flex; align-items:center; justify-content:center; font-size:11px; font-weight:600; color:var(--text-3); transition:all .15s; }
    .step.active .step-circle { border-color:var(--blue); background:var(--blue); color:#fff; }
    .step.done  .step-circle  { border-color:var(--green); background:var(--green); color:#fff; }
    .step-label { font-size:11.5px; font-weight:500; color:var(--text-3); white-space:nowrap; }
    .step.active .step-label  { color:var(--blue); font-weight:600; }
    .step.done  .step-label   { color:var(--green); }
    .step-line { flex:1; height:2px; background:var(--border); margin:0 8px; min-width:16px; transition:background .15s; &.done { background:var(--green); } }

    .loading-state { display:flex; align-items:center; justify-content:center; gap:12px; padding:48px; color:var(--text-3); font-size:13px; flex:1; }

    .dialog-body { flex:1; overflow-y:auto; padding:16px 20px; background:var(--bg); }
    .form-section { display:flex; flex-direction:column; gap:12px; }
    .form-row     { display:flex; gap:10px; }
    .fill         { flex:1; min-width:0; }
    .field-group  { display:flex; flex-direction:column; gap:4px; }
    .fl  { font-size:12px; font-weight:500; color:var(--text-2); .req { color:var(--red); } .hint { font-size:10px; color:var(--text-4); font-weight:400; } }
    .fi  { height:34px; padding:0 10px; width:100%; background:var(--surface); border:1px solid var(--border); border-radius:7px; font-size:13px; color:var(--text); outline:none; font-family:inherit; &:focus { border-color:var(--blue); } &.err { border-color:var(--red); } }
    select.fi { cursor:pointer; }
    .field-error { font-size:11px; color:var(--red); }
    .section-divider { font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:.5px; color:var(--text-4); padding-top:4px; border-top:1px solid var(--border-light); }

    /* Parents */
    .parent-card { border:1px solid var(--border); border-radius:10px; overflow:hidden; }
    .pc-head { display:flex; justify-content:space-between; align-items:center; padding:10px 14px; background:var(--bg); border-bottom:1px solid var(--border); }
    .pc-title { display:flex; align-items:center; gap:6px; font-size:13px; font-weight:600; color:var(--text); }
    .req-tag { font-size:10px; font-weight:600; background:var(--blue-light); color:var(--blue); padding:1px 6px; border-radius:4px; }
    .opt-tag { font-size:10px; font-weight:600; background:var(--purple-light); color:var(--purple); padding:1px 6px; border-radius:4px; }
    .parent-fields { padding:12px 14px; display:flex; flex-direction:column; gap:10px; }
    .remove-parent-btn { display:flex; align-items:center; gap:4px; background:none; border:none; cursor:pointer; color:var(--red); font-size:12px; padding:4px 8px; border-radius:5px; &:hover { background:var(--red-light); } }
    .add-parent-btn { display:flex; align-items:center; justify-content:center; gap:6px; background:none; border:1.5px dashed #D1D5DB; border-radius:8px; width:100%; padding:10px; font-size:12.5px; color:var(--blue); cursor:pointer; font-weight:500; &:hover { background:var(--blue-light); border-color:var(--blue); } }
    .fi.ta { height:auto; padding:8px 10px; resize:vertical; }
    .check-label { display:flex; align-items:center; gap:6px; font-size:12.5px; color:var(--text-2); cursor:pointer; }

    .emergency-section { border:1px solid #FCA5A5; border-radius:10px; overflow:hidden; }
    .es-title { display:flex; align-items:center; gap:6px; padding:9px 14px; background:#FFF5F5; border-bottom:1px solid #FCA5A5; font-size:12px; font-weight:600; color:#991B1B; }
    .es-options { padding:8px; display:flex; flex-direction:column; gap:6px; }
    .radio-option { display:flex; align-items:center; gap:10px; padding:9px 12px; border-radius:8px; border:1.5px solid var(--border); cursor:pointer; transition:all .15s; &:hover { border-color:var(--blue); background:var(--blue-light); } &.selected { border-color:var(--blue); background:var(--blue-light); } }
    .ro-radio { width:16px; height:16px; border-radius:50%; border:2px solid var(--border); flex-shrink:0; transition:all .15s; &.checked { border-color:var(--blue); border-width:5px; } }
    .ro-label { flex:1; }
    .ro-name  { font-size:13px; font-weight:500; color:var(--text); }
    .ro-rel   { font-size:11px; color:var(--text-3); font-weight:400; }
    .ro-phone { font-size:12px; color:var(--text-3); margin-top:1px; }

    .transport-hint { display:flex; align-items:center; gap:7px; background:var(--blue-light); border:1px solid var(--border); border-radius:8px; padding:10px 12px; font-size:12px; color:var(--text-2); }
    .transport-current { display:flex; align-items:center; gap:6px; font-size:12.5px; color:var(--text-2); }

    .error-banner { display:flex; align-items:center; gap:8px; flex-shrink:0; background:var(--red-light); border:1px solid #FECACA; color:#991B1B; padding:10px 20px; font-size:12.5px; }

    .dialog-footer { display:flex; justify-content:space-between; align-items:center; padding:12px 20px; border-top:1px solid var(--border); background:var(--surface); flex-shrink:0; }
    .nav-btns { display:flex; gap:8px; }
    .btn-ghost   { background:none; border:none; cursor:pointer; font-size:13px; color:var(--text-3); padding:0 10px; height:34px; border-radius:7px; &:hover { background:var(--border-light); } }
    .btn-back    { display:flex; align-items:center; gap:4px; background:var(--surface); border:1px solid var(--border); border-radius:8px; height:34px; padding:0 14px; font-size:13px; color:var(--text-2); cursor:pointer; &:hover { background:var(--bg); } }
    .btn-next    { display:flex; align-items:center; gap:4px; background:var(--blue); color:#fff; border:none; border-radius:8px; height:34px; padding:0 16px; font-size:13px; font-weight:500; cursor:pointer; &:hover { background:#1D4ED8; } }
    .btn-primary { display:flex; align-items:center; gap:5px; background:var(--green); color:#fff; border:none; border-radius:8px; height:34px; padding:0 16px; font-size:13px; font-weight:500; cursor:pointer; &:hover:not(:disabled) { background:#047857; } &:disabled { opacity:.6; cursor:not-allowed; } }
  `],
})
export class EditStudentDialogComponent implements OnInit {
  private fb        = inject(FormBuilder);
  private api       = inject(ApiService);
  private dialogRef = inject(MatDialogRef<EditStudentDialogComponent>);
  student: Student  = inject(MAT_DIALOG_DATA);

  submitting       = signal(false);
  dataLoading      = signal(true);
  error            = signal('');
  stepIndex        = signal(0);
  classes          = signal<SchoolClass[]>([]);
  routes           = signal<any[]>([]);
  routeStops       = signal<any[]>([]);
  currentTransport = signal<any | null>(null);
  showParent2      = signal(false);
  emergencyContact = signal<'parent1' | 'parent2'>('parent1');

  // IDs of existing parent records (null = new)
  private parent1Id = signal<string | null>(null);
  private parent2Id = signal<string | null>(null);

  steps       = STEPS;
  bloodGroups = ['A+','A-','B+','B-','AB+','AB-','O+','O-'];

  basicForm = this.fb.group({
    first_name:      ['', Validators.required],
    last_name:       [''],
    dob:             ['', Validators.required],
    gender:          [''],
    class_id:        [''],
    admission_date:  [''],
    blood_group:     [''],
    nationality:     ['Indian'],
    mother_tongue:   [''],
    aadhar_no:       [''],
    previous_school: [''],
  });

  medicalForm = this.fb.group({
    allergies_text:   [''],
    dietary_notes:    [''],
    conditions_text:  [''],
    medications_text: [''],
    doctor_name:      [''],
    doctor_phone:     [''],
  });

  parent1Form = this.newParentForm('father');
  parent2Form = this.newParentForm('mother');

  transportForm = this.fb.group({
    route_id:       [''],
    pickup_stop_id: [''],
    drop_stop_id:   [''],
  });

  parent1Name() { const v = this.parent1Form.value; return [v.first_name, v.last_name].filter(Boolean).join(' '); }
  parent2Name() { const v = this.parent2Form.value; return [v.first_name, v.last_name].filter(Boolean).join(' '); }

  ngOnInit() {
    this.api.get<any>('/transport/routes').subscribe({ next: r => this.routes.set(r.data ?? []), error: () => {} });
    this.api.get<any>('/students/classes').subscribe({ next: r => this.classes.set(r.data ?? []), error: () => {} });

    this.api.get<any>('/transport/students/' + this.student.id).subscribe({
      next: (res: any) => {
        this.currentTransport.set(res.data);
        if (res.data) {
          this.transportForm.patchValue({ route_id: res.data.route_id ?? '', pickup_stop_id: res.data.pickup_stop_id ?? '', drop_stop_id: res.data.drop_stop_id ?? '' });
          if (res.data.route_id) this.loadRouteStops(res.data.route_id);
        }
      },
      error: () => {},
    });

    // Load full student + parents in parallel
    this.api.get<any>('/students/' + this.student.id).subscribe({
      next: (res: any) => {
        const s = res.data;
        this.basicForm.patchValue({
          first_name:      s.first_name      ?? '',
          last_name:       s.last_name       ?? '',
          dob:             s.dob ? new Date(s.dob).toISOString().slice(0, 10) : '',
          gender:          s.gender          ?? '',
          class_id:        s.class_id        ?? '',
          admission_date:  s.admission_date  ? new Date(s.admission_date).toISOString().slice(0, 10) : '',
          blood_group:     s.blood_group     ?? '',
          nationality:     s.nationality     ?? 'Indian',
          mother_tongue:   s.mother_tongue   ?? '',
          aadhar_no:       s.aadhar_no       ?? '',
          previous_school: s.previous_school ?? '',
        });
        this.medicalForm.patchValue({
          allergies_text:   (s.allergies                 ?? []).join(', '),
          dietary_notes:    s.dietary_notes              ?? '',
          conditions_text:  (s.medical_notes?.conditions  ?? []).join(', '),
          medications_text: (s.medical_notes?.medications ?? []).join(', '),
          doctor_name:      s.medical_notes?.doctor_name  ?? '',
          doctor_phone:     s.medical_notes?.doctor_phone ?? '',
        });

        // Load parents
        this.api.get<any>('/students/' + this.student.id + '/parents').subscribe({
          next: (pr: any) => {
            const parents: ParentRecord[] = pr.data ?? [];
            const primary   = parents.find(p => p.is_primary) ?? parents[0];
            const secondary = parents.find(p => p.id !== primary?.id);

            if (primary) {
              this.parent1Id.set(primary.id);
              this.patchParentForm(this.parent1Form, primary);
              if (primary.is_emergency_contact) this.emergencyContact.set('parent1');
            }

            if (secondary) {
              this.parent2Id.set(secondary.id);
              this.patchParentForm(this.parent2Form, secondary);
              this.showParent2.set(true);
              if (secondary.is_emergency_contact) this.emergencyContact.set('parent2');
            }
            this.dataLoading.set(false);
          },
          error: () => this.dataLoading.set(false),
        });
      },
      error: () => {
        this.patchFromStudent(this.student);
        this.dataLoading.set(false);
      },
    });
  }

  private patchFromStudent(s: any) {
    this.basicForm.patchValue({
      first_name: s.first_name ?? '', last_name: s.last_name ?? '',
      dob: s.dob ? new Date(s.dob).toISOString().slice(0, 10) : '',
      gender: s.gender ?? '', class_id: s.class_id ?? '',
      blood_group: s.blood_group ?? '', nationality: s.nationality ?? 'Indian',
      mother_tongue: s.mother_tongue ?? '',
    });
  }

  private patchParentForm(form: FormGroup, p: ParentRecord) {
    form.patchValue({
      relation:      p.relation      ?? 'father',
      first_name:    p.first_name    ?? '',
      last_name:     p.last_name     ?? '',
      mobile:        p.mobile        ?? '',
      mobile_alt:    p.mobile_alt    ?? '',
      email:         p.email         ?? '',
      address_line1: p.address_line1 ?? '',
      address_line2: p.address_line2 ?? '',
      city:          p.city          ?? '',
      state:         p.state         ?? '',
      country:       p.country       ?? 'India',
      pincode:       p.pincode       ?? '',
      profession:    p.profession    ?? '',
      employer:      p.employer      ?? '',
      annual_income: p.annual_income ?? null,
      education:     p.education     ?? '',
      can_pickup:    p.can_pickup    ?? true,
      notes:         p.notes         ?? '',
    });
  }


  private newParentForm(defaultRelation: string): FormGroup {
    return this.fb.group({
      relation:      [defaultRelation],
      first_name:    ['', Validators.required],
      last_name:     ['', Validators.required],
      mobile:        ['', Validators.required],
      mobile_alt:    [''],
      email:         ['', Validators.email],
      address_line1: [''],
      address_line2: [''],
      city:          [''],
      state:         [''],
      country:       ['India'],
      pincode:       [''],
      profession:    [''],
      employer:      [''],
      annual_income: [null as number | null],
      education:     [''],
      can_pickup:    [true],
      notes:         [''],
    });
  }

  removeParent2() {
    this.showParent2.set(false);
    this.parent2Form.reset({ relation: 'mother', country: 'India' });
    if (this.emergencyContact() === 'parent2') this.emergencyContact.set('parent1');
  }

  loadRouteStops(routeId: string) {
    this.api.get<any>('/transport/routes/' + routeId).subscribe({
      next: r => this.routeStops.set(r.data?.stops ?? []),
      error: () => {},
    });
  }

  onRouteChange(e: Event) {
    const routeId = (e.target as HTMLSelectElement).value;
    this.transportForm.patchValue({ pickup_stop_id: '', drop_stop_id: '' });
    if (routeId) this.loadRouteStops(routeId);
    else this.routeStops.set([]);
  }

  next() {
    if (this.stepIndex() === 0) {
      this.basicForm.markAllAsTouched();
      if (this.basicForm.invalid) return;
    }
    if (this.stepIndex() === 2) {
      this.parent1Form.markAllAsTouched();
      if (this.showParent2()) this.parent2Form.markAllAsTouched();
      if (this.parent1Form.invalid || (this.showParent2() && this.parent2Form.invalid)) return;
    }
    this.stepIndex.update(i => i + 1);
  }

  private split(s: string) { return s ? s.split(',').map(x => x.trim()).filter(Boolean) : []; }

  private buildParentPayload(form: FormGroup, isPrimary: boolean, isEmergency: boolean) {
    const v = form.value;
    const p: Record<string, unknown> = {
      relation: v.relation, first_name: v.first_name, last_name: v.last_name,
      mobile: v.mobile, is_primary: isPrimary, is_emergency_contact: isEmergency,
      can_pickup: v.can_pickup ?? true,
    };
    if (v.email?.trim())         p['email']         = v.email.trim();
    if (v.mobile_alt?.trim())    p['mobile_alt']    = v.mobile_alt.trim();
    if (v.address_line1?.trim()) p['address_line1'] = v.address_line1.trim();
    if (v.address_line2?.trim()) p['address_line2'] = v.address_line2.trim();
    if (v.city?.trim())          p['city']          = v.city.trim();
    if (v.state?.trim())         p['state']         = v.state.trim();
    if (v.country?.trim())       p['country']       = v.country.trim();
    if (v.pincode?.trim())       p['pincode']       = v.pincode.trim();
    if (v.profession?.trim())    p['profession']    = v.profession.trim();
    if (v.employer?.trim())      p['employer']      = v.employer.trim();
    if (v.annual_income)         p['annual_income'] = +v.annual_income;
    if (v.education)             p['education']     = v.education;
    if (v.notes?.trim())         p['notes']         = v.notes.trim();
    return p;
  }

  submit() {
    this.basicForm.markAllAsTouched();
    if (this.basicForm.invalid) { this.stepIndex.set(0); return; }
    this.parent1Form.markAllAsTouched();
    if (this.parent1Form.invalid) { this.stepIndex.set(2); return; }

    this.submitting.set(true);
    this.error.set('');

    const bv = this.basicForm.value;
    const mv = this.medicalForm.value;

    const studentPayload: Record<string, unknown> = {
      first_name: bv.first_name, last_name: bv.last_name, dob: bv.dob,
      medical_notes: {
        conditions:  this.split(mv.conditions_text  ?? ''),
        medications: this.split(mv.medications_text ?? ''),
        ...(mv.doctor_name?.trim()  ? { doctor_name:  mv.doctor_name!.trim()  } : {}),
        ...(mv.doctor_phone?.trim() ? { doctor_phone: mv.doctor_phone!.trim() } : {}),
      },
      allergies: this.split(mv.allergies_text ?? ''),
    };
    if (bv.gender)                  studentPayload['gender']          = bv.gender;
    if (bv.class_id)                studentPayload['class_id']        = bv.class_id;
    if (bv.admission_date)          studentPayload['admission_date']  = bv.admission_date;
    if (bv.blood_group)             studentPayload['blood_group']     = bv.blood_group;
    if (bv.nationality)             studentPayload['nationality']     = bv.nationality;
    if (bv.mother_tongue)           studentPayload['mother_tongue']   = bv.mother_tongue;
    if (bv.aadhar_no?.trim())       studentPayload['aadhar_no']       = bv.aadhar_no!.trim();
    if (bv.previous_school?.trim()) studentPayload['previous_school'] = bv.previous_school!.trim();
    if (mv.dietary_notes?.trim())   studentPayload['dietary_notes']   = mv.dietary_notes!.trim();

    // Save student first, then parents
    this.api.put<any>('/students/' + this.student.id, studentPayload).subscribe({
      next: (res: any) => {
        this.saveParents(res.data);
      },
      error: (err: any) => {
        this.submitting.set(false);
        this.error.set(err.error?.error?.message ?? 'Failed to save student details');
      },
    });
  }

  private saveParents(updatedStudent: any) {
    const sid = this.student.id;
    const ec  = this.emergencyContact();

    const p1Payload = this.buildParentPayload(this.parent1Form, true, ec === 'parent1');
    const p1Id      = this.parent1Id();
    const p1Req$    = p1Id
      ? this.api.put<any>(`/students/${sid}/parents/${p1Id}`,  p1Payload)
      : this.api.post<any>(`/students/${sid}/parents`,          p1Payload);

    p1Req$.subscribe({
      next: () => {
        if (!this.showParent2()) {
          // Delete parent 2 if it existed and was removed
          const p2Id = this.parent2Id();
          if (p2Id) {
            this.api.delete<any>(`/students/${sid}/parents/${p2Id}`).subscribe({ next: () => {}, error: () => {} });
          }
          this.finishTransport(updatedStudent);
          return;
        }

        const p2Payload = this.buildParentPayload(this.parent2Form, false, ec === 'parent2');
        const p2Id      = this.parent2Id();
        const p2Req$    = p2Id
          ? this.api.put<any>(`/students/${sid}/parents/${p2Id}`,  p2Payload)
          : this.api.post<any>(`/students/${sid}/parents`,          p2Payload);

        p2Req$.subscribe({
          next: () => this.finishTransport(updatedStudent),
          error: (err: any) => {
            this.submitting.set(false);
            this.error.set(err.error?.error?.message ?? 'Failed to save Parent 2');
          },
        });
      },
      error: (err: any) => {
        this.submitting.set(false);
        this.error.set(err.error?.error?.message ?? 'Failed to save Parent 1');
      },
    });
  }

  private finishTransport(updatedStudent: any) {
    const t = this.transportForm.value;
    if (t.route_id) {
      this.api.post<any>('/transport/students/assign', {
        student_id: this.student.id, route_id: t.route_id, stop_no: 1,
        pickup_stop_id: t.pickup_stop_id || undefined,
        drop_stop_id:   t.drop_stop_id   || undefined,
      }).subscribe({ next: () => {}, error: () => {} });
    } else if (this.currentTransport()) {
      this.api.delete<any>('/transport/students/' + this.student.id).subscribe({ next: () => {}, error: () => {} });
    }
    this.submitting.set(false);
    this.dialogRef.close(updatedStudent);
  }
}
