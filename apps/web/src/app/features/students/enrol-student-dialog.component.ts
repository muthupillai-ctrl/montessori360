import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators, FormGroup } from '@angular/forms';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { DatePipe, TitleCasePipe } from '@angular/common';
import { ApiService } from '../../core/services/api.service';
import type { SchoolClass, ApiResponse } from '../../core/models';

@Component({
  selector: 'app-enrol-student-dialog',
  standalone: true,
  imports: [
    ReactiveFormsModule, MatDialogModule,
    MatButtonModule, MatIconModule,
    MatProgressSpinnerModule,
    DatePipe, TitleCasePipe,
  ],
  template: `
    <div class="dialog-shell">

      <!-- Header -->
      <div class="dialog-header">
        <div class="dh-icon"><mat-icon>person_add</mat-icon></div>
        <div>
          <div class="dh-title">Enrol New Student</div>
          <div class="dh-sub">Step {{ currentStep() + 1 }} of 4 — {{ stepLabels[currentStep()] }}</div>
        </div>
        <button class="dh-close" mat-dialog-close><mat-icon>close</mat-icon></button>
      </div>

      <!-- Step indicator -->
      <div class="step-track">
        @for (label of stepLabels; track $index) {
          <div class="step-node" [class.active]="$index === currentStep()" [class.done]="$index < currentStep()">
            <div class="sn-circle">
              @if ($index < currentStep()) {
                <mat-icon style="font-size:13px;width:13px;height:13px">check</mat-icon>
              } @else { {{ $index + 1 }} }
            </div>
            <span class="sn-label">{{ label }}</span>
          </div>
          @if ($index < stepLabels.length - 1) {
            <div class="step-line" [class.done]="$index < currentStep()"></div>
          }
        }
      </div>

      <!-- Body -->
      <div class="dialog-body">

        <!-- ── Step 0: Basic Info ──────────────────────────────────── -->
        @if (currentStep() === 0) {
          <form [formGroup]="basicForm" class="step-form">
            <div class="form-row">
              <div class="field-group flex-1">
                <label class="field-label">First Name <span class="req">*</span></label>
                <input class="field-input" formControlName="first_name" placeholder="Arjun"
                       [class.err]="basicForm.get('first_name')?.invalid && basicForm.get('first_name')?.touched">
                @if (basicForm.get('first_name')?.invalid && basicForm.get('first_name')?.touched) {
                  <div class="field-error">Required</div>
                }
              </div>
              <div class="field-group flex-1">
                <label class="field-label">Last Name</label>
                <input class="field-input" formControlName="last_name" placeholder="Sharma">
              </div>
            </div>

            <div class="form-row">
              <div class="field-group flex-1">
                <label class="field-label">Date of Birth <span class="req">*</span></label>
                <input class="field-input" type="date" formControlName="dob"
                       [class.err]="basicForm.get('dob')?.invalid && basicForm.get('dob')?.touched">
                @if (basicForm.get('dob')?.invalid && basicForm.get('dob')?.touched) {
                  <div class="field-error">Required</div>
                }
              </div>
              <div class="field-group flex-1">
                <label class="field-label">Gender</label>
                <select class="field-input" formControlName="gender">
                  <option value="">Select gender</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                </select>
              </div>
            </div>

            <div class="form-row">
              <div class="field-group flex-1">
                <label class="field-label">Class</label>
                <select class="field-input" formControlName="class_id">
                  <option value="">— Unassigned —</option>
                  @for (cls of classes(); track cls.id) {
                    <option [value]="cls.id" [disabled]="cls.enrolled_count >= cls.capacity">
                      {{ cls.name }} ({{ cls.enrolled_count }}/{{ cls.capacity }})
                    </option>
                  }
                </select>
              </div>
              <div class="field-group flex-1">
                <label class="field-label">Admission Date</label>
                <input class="field-input" type="date" formControlName="admission_date">
              </div>
            </div>

            <div class="form-row">
              <div class="field-group flex-1">
                <label class="field-label">Blood Group</label>
                <select class="field-input" formControlName="blood_group">
                  <option value="">Unknown</option>
                  @for (bg of bloodGroups; track bg) { <option [value]="bg">{{ bg }}</option> }
                </select>
              </div>
              <div class="field-group flex-1">
                <label class="field-label">Nationality</label>
                <input class="field-input" formControlName="nationality" placeholder="Indian">
              </div>
              <div class="field-group flex-1">
                <label class="field-label">Mother Tongue</label>
                <input class="field-input" formControlName="mother_tongue" placeholder="e.g. Tamil, Hindi">
              </div>
            </div>
          </form>
        }

        <!-- ── Step 1: Medical ───────────────────────────────────── -->
        @if (currentStep() === 1) {
          <form [formGroup]="basicForm" class="step-form">
            <div class="field-group">
              <label class="field-label">Allergies <span class="hint">(comma separated)</span></label>
              <input class="field-input" formControlName="allergies_text" placeholder="e.g. Peanuts, Dairy">
            </div>
            <div class="field-group">
              <label class="field-label">Dietary Notes</label>
              <input class="field-input" formControlName="dietary_notes" placeholder="e.g. Vegetarian, No egg">
            </div>
            <div class="section-divider">Medical Conditions</div>
            <div class="field-group">
              <label class="field-label">Conditions</label>
              <input class="field-input" formControlName="conditions_text" placeholder="e.g. Asthma, Diabetes">
            </div>
            <div class="field-group">
              <label class="field-label">Medications</label>
              <input class="field-input" formControlName="medications_text" placeholder="e.g. Inhaler, Insulin">
            </div>
            <div class="section-divider">Doctor Details</div>
            <div class="form-row">
              <div class="field-group flex-1">
                <label class="field-label">Doctor Name</label>
                <input class="field-input" formControlName="doctor_name" placeholder="Dr. Name">
              </div>
              <div class="field-group flex-1">
                <label class="field-label">Doctor Phone</label>
                <input class="field-input" formControlName="doctor_phone" placeholder="+91 XXXXX XXXXX">
              </div>
            </div>
          </form>
        }

        <!-- ── Step 2: Parents ───────────────────────────────────── -->
        @if (currentStep() === 2) {
          <div class="step-form">

            <!-- Parent 1 -->
            <div class="parent-card">
              <div class="pc-head">
                <div class="pc-title">
                  <mat-icon style="font-size:16px;width:16px;height:16px;color:var(--blue)">person</mat-icon>
                  Parent 1 <span class="req-tag">Required</span>
                </div>
              </div>

              <form [formGroup]="parent1Form" class="parent-fields">
                <div class="form-row">
                  <div class="field-group" style="width:130px">
                    <label class="field-label">Relation <span class="req">*</span></label>
                    <select class="field-input" formControlName="relation">
                      <option value="father">Father</option>
                      <option value="mother">Mother</option>
                      <option value="guardian">Guardian</option>
                      <option value="step_father">Step Father</option>
                      <option value="step_mother">Step Mother</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                  <div class="field-group flex-1">
                    <label class="field-label">First Name <span class="req">*</span></label>
                    <input class="field-input" formControlName="first_name" placeholder="Raj"
                           [class.err]="parent1Form.get('first_name')?.invalid && parent1Form.get('first_name')?.touched">
                  </div>
                  <div class="field-group flex-1">
                    <label class="field-label">Last Name <span class="req">*</span></label>
                    <input class="field-input" formControlName="last_name" placeholder="Sharma"
                           [class.err]="parent1Form.get('last_name')?.invalid && parent1Form.get('last_name')?.touched">
                  </div>
                </div>

                <div class="form-row">
                  <div class="field-group flex-1">
                    <label class="field-label">Mobile <span class="req">*</span></label>
                    <input class="field-input" formControlName="mobile" placeholder="+91 9876543210"
                           [class.err]="parent1Form.get('mobile')?.invalid && parent1Form.get('mobile')?.touched">
                    @if (parent1Form.get('mobile')?.invalid && parent1Form.get('mobile')?.touched) {
                      <div class="field-error">Required</div>
                    }
                  </div>
                  <div class="field-group flex-1">
                    <label class="field-label">Email</label>
                    <input class="field-input" type="email" formControlName="email" placeholder="parent@email.com">
                  </div>
                </div>

                <div class="section-divider">Address</div>
                <div class="form-row">
                  <div class="field-group flex-1">
                    <label class="field-label">Address Line 1</label>
                    <input class="field-input" formControlName="address_line1" placeholder="House No, Street">
                  </div>
                  <div class="field-group flex-1">
                    <label class="field-label">Address Line 2</label>
                    <input class="field-input" formControlName="address_line2" placeholder="Area, Landmark">
                  </div>
                </div>
                <div class="form-row">
                  <div class="field-group flex-1">
                    <label class="field-label">City</label>
                    <input class="field-input" formControlName="city" placeholder="Chennai">
                  </div>
                  <div class="field-group flex-1">
                    <label class="field-label">State</label>
                    <input class="field-input" formControlName="state" placeholder="Tamil Nadu">
                  </div>
                  <div class="field-group" style="width:100px">
                    <label class="field-label">Pincode</label>
                    <input class="field-input" formControlName="pincode" placeholder="600001">
                  </div>
                </div>

                <div class="section-divider">Professional</div>
                <div class="form-row">
                  <div class="field-group flex-1">
                    <label class="field-label">Alternate Mobile</label>
                    <input class="field-input" formControlName="mobile_alt" placeholder="+91 XXXXX XXXXX">
                  </div>
                  <div class="field-group flex-1">
                    <label class="field-label">Profession</label>
                    <input class="field-input" formControlName="profession" placeholder="e.g. Engineer, Doctor">
                  </div>
                </div>
                <div class="form-row">
                  <div class="field-group flex-1">
                    <label class="field-label">Employer / Company</label>
                    <input class="field-input" formControlName="employer" placeholder="Company name">
                  </div>
                  <div class="field-group flex-1">
                    <label class="field-label">Education</label>
                    <select class="field-input" formControlName="education">
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
                    <label class="field-label">Annual Income (₹)</label>
                    <input class="field-input" type="number" formControlName="annual_income" placeholder="e.g. 600000">
                  </div>
                </div>
                <div class="form-row" style="align-items:center;gap:16px">
                  <label class="check-label">
                    <input type="checkbox" formControlName="can_pickup"> Authorised for Pickup
                  </label>
                </div>
                <div class="field-group">
                  <label class="field-label">Notes</label>
                  <textarea class="field-input ta" formControlName="notes" rows="2"
                            placeholder="Any notes about this parent…"></textarea>
                </div>
              </form>
            </div>

            <!-- Parent 2 toggle -->
            @if (!showParent2()) {
              <button type="button" class="add-parent-btn" (click)="showParent2.set(true)">
                <mat-icon style="font-size:16px;width:16px;height:16px">add_circle_outline</mat-icon>
                Add Second Parent
              </button>
            } @else {
              <div class="parent-card">
                <div class="pc-head">
                  <div class="pc-title">
                    <mat-icon style="font-size:16px;width:16px;height:16px;color:var(--purple)">person</mat-icon>
                    Parent 2 <span class="opt-tag">Optional</span>
                  </div>
                  <button type="button" class="remove-parent-btn" (click)="removeParent2()">
                    <mat-icon style="font-size:14px;width:14px;height:14px">close</mat-icon>
                    Remove
                  </button>
                </div>

                <form [formGroup]="parent2Form" class="parent-fields">
                  <div class="form-row">
                    <div class="field-group" style="width:130px">
                      <label class="field-label">Relation <span class="req">*</span></label>
                      <select class="field-input" formControlName="relation">
                        <option value="father">Father</option>
                        <option value="mother">Mother</option>
                        <option value="guardian">Guardian</option>
                        <option value="step_father">Step Father</option>
                        <option value="step_mother">Step Mother</option>
                        <option value="other">Other</option>
                      </select>
                    </div>
                    <div class="field-group flex-1">
                      <label class="field-label">First Name <span class="req">*</span></label>
                      <input class="field-input" formControlName="first_name" placeholder="Priya"
                             [class.err]="parent2Form.get('first_name')?.invalid && parent2Form.get('first_name')?.touched">
                    </div>
                    <div class="field-group flex-1">
                      <label class="field-label">Last Name <span class="req">*</span></label>
                      <input class="field-input" formControlName="last_name" placeholder="Sharma"
                             [class.err]="parent2Form.get('last_name')?.invalid && parent2Form.get('last_name')?.touched">
                    </div>
                  </div>

                  <div class="form-row">
                    <div class="field-group flex-1">
                      <label class="field-label">Mobile <span class="req">*</span></label>
                      <input class="field-input" formControlName="mobile" placeholder="+91 9876543210"
                             [class.err]="parent2Form.get('mobile')?.invalid && parent2Form.get('mobile')?.touched">
                    </div>
                    <div class="field-group flex-1">
                      <label class="field-label">Email</label>
                      <input class="field-input" type="email" formControlName="email" placeholder="parent@email.com">
                    </div>
                  </div>

                  <div class="section-divider">Address</div>
                  <div class="form-row">
                    <div class="field-group flex-1">
                      <label class="field-label">Address Line 1</label>
                      <input class="field-input" formControlName="address_line1" placeholder="House No, Street">
                    </div>
                    <div class="field-group flex-1">
                      <label class="field-label">Address Line 2</label>
                      <input class="field-input" formControlName="address_line2" placeholder="Area, Landmark">
                    </div>
                  </div>
                  <div class="form-row">
                    <div class="field-group flex-1">
                      <label class="field-label">City</label>
                      <input class="field-input" formControlName="city" placeholder="Chennai">
                    </div>
                    <div class="field-group flex-1">
                      <label class="field-label">State</label>
                      <input class="field-input" formControlName="state" placeholder="Tamil Nadu">
                    </div>
                    <div class="field-group" style="width:100px">
                      <label class="field-label">Pincode</label>
                      <input class="field-input" formControlName="pincode" placeholder="600001">
                    </div>
                  </div>

                  <div class="section-divider">Professional</div>
                  <div class="form-row">
                    <div class="field-group flex-1">
                      <label class="field-label">Alternate Mobile</label>
                      <input class="field-input" formControlName="mobile_alt" placeholder="+91 XXXXX XXXXX">
                    </div>
                    <div class="field-group flex-1">
                      <label class="field-label">Profession</label>
                      <input class="field-input" formControlName="profession" placeholder="e.g. Engineer, Doctor">
                    </div>
                  </div>
                  <div class="form-row">
                    <div class="field-group flex-1">
                      <label class="field-label">Employer / Company</label>
                      <input class="field-input" formControlName="employer" placeholder="Company name">
                    </div>
                    <div class="field-group flex-1">
                      <label class="field-label">Education</label>
                      <select class="field-input" formControlName="education">
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
                      <label class="field-label">Annual Income (₹)</label>
                      <input class="field-input" type="number" formControlName="annual_income" placeholder="e.g. 600000">
                    </div>
                  </div>
                  <div class="form-row" style="align-items:center;gap:16px">
                    <label class="check-label">
                      <input type="checkbox" formControlName="can_pickup"> Authorised for Pickup
                    </label>
                  </div>
                  <div class="field-group">
                    <label class="field-label">Notes</label>
                    <textarea class="field-input ta" formControlName="notes" rows="2"
                              placeholder="Any notes about this parent…"></textarea>
                  </div>
                </form>
              </div>
            }

            <!-- Emergency contact selection -->
            <div class="emergency-section">
              <div class="es-title">
                <mat-icon style="font-size:15px;width:15px;height:15px;color:var(--red)">emergency</mat-icon>
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

        <!-- ── Step 3: Review ────────────────────────────────────── -->
        @if (currentStep() === 3) {
          <div class="review-panel">

            <div class="review-section">
              <div class="rs-title">
                <mat-icon style="font-size:16px;width:16px;height:16px;color:var(--blue)">person</mat-icon>
                Student Details
              </div>
              <div class="rs-grid">
                <div class="rs-item"><div class="rs-label">Full Name</div>
                  <div class="rs-value">{{ basicForm.value.first_name }} {{ basicForm.value.last_name }}</div></div>
                <div class="rs-item"><div class="rs-label">Date of Birth</div>
                  <div class="rs-value">{{ basicForm.value.dob | date:'d MMM yyyy' }}</div></div>
                <div class="rs-item"><div class="rs-label">Gender</div>
                  <div class="rs-value">{{ (basicForm.value.gender | titlecase) || '—' }}</div></div>
                <div class="rs-item"><div class="rs-label">Class</div>
                  <div class="rs-value">{{ getClassName(basicForm.value.class_id) }}</div></div>
                <div class="rs-item"><div class="rs-label">Blood Group</div>
                  <div class="rs-value">{{ basicForm.value.blood_group || 'Unknown' }}</div></div>
                <div class="rs-item"><div class="rs-label">Nationality</div>
                  <div class="rs-value">{{ basicForm.value.nationality || '—' }}</div></div>
              </div>
            </div>

            <div class="review-section">
              <div class="rs-title">
                <mat-icon style="font-size:16px;width:16px;height:16px;color:var(--blue)">family_restroom</mat-icon>
                Parents
              </div>
              <div class="parents-review">
                <div class="pr-item">
                  <div class="pr-av blue">{{ parent1Form.value.first_name?.[0] ?? 'P' }}</div>
                  <div class="pr-info">
                    <div class="pr-name">{{ parent1Form.value.first_name }} {{ parent1Form.value.last_name }}</div>
                    <div class="pr-detail">{{ parent1Form.value.relation | titlecase }} · {{ parent1Form.value.mobile }}</div>
                    @if (parent1Form.value.email) { <div class="pr-email">{{ parent1Form.value.email }}</div> }
                    @if (parent1Form.value.city) { <div class="pr-detail">{{ parent1Form.value.city }}{{ parent1Form.value.state ? ', ' + parent1Form.value.state : '' }}</div> }
                  </div>
                  <div class="pr-badges">
                    <span class="badge primary">Primary</span>
                    @if (emergencyContact() === 'parent1') { <span class="badge emergency">Emergency</span> }
                  </div>
                </div>

                @if (showParent2()) {
                  <div class="pr-item">
                    <div class="pr-av purple">{{ parent2Form.value.first_name?.[0] ?? 'P' }}</div>
                    <div class="pr-info">
                      <div class="pr-name">{{ parent2Form.value.first_name }} {{ parent2Form.value.last_name }}</div>
                      <div class="pr-detail">{{ parent2Form.value.relation | titlecase }} · {{ parent2Form.value.mobile }}</div>
                      @if (parent2Form.value.email) { <div class="pr-email">{{ parent2Form.value.email }}</div> }
                      @if (parent2Form.value.city) { <div class="pr-detail">{{ parent2Form.value.city }}{{ parent2Form.value.state ? ', ' + parent2Form.value.state : '' }}</div> }
                    </div>
                    <div class="pr-badges">
                      @if (emergencyContact() === 'parent2') { <span class="badge emergency">Emergency</span> }
                    </div>
                  </div>
                }
              </div>
            </div>

            @if (error()) {
              <div class="error-banner">
                <mat-icon style="font-size:15px;width:15px;height:15px;flex-shrink:0">error_outline</mat-icon>
                {{ error() }}
              </div>
            }
          </div>
        }

      </div>

      <!-- Footer -->
      <div class="dialog-footer">
        <button class="btn-ghost" mat-dialog-close>Cancel</button>
        <div style="display:flex;gap:8px">
          @if (currentStep() > 0) {
            <button class="btn-outline" (click)="prevStep()">
              <mat-icon style="font-size:15px;width:15px;height:15px">arrow_back</mat-icon> Back
            </button>
          }
          @if (currentStep() < 3) {
            <button class="btn-primary" (click)="nextStep()" [disabled]="!canAdvance()">
              Continue <mat-icon style="font-size:15px;width:15px;height:15px">arrow_forward</mat-icon>
            </button>
          }
          @if (currentStep() === 3) {
            <button class="btn-primary" (click)="submit()" [disabled]="submitting()">
              @if (submitting()) {
                <mat-progress-spinner diameter="16" mode="indeterminate" style="--mdc-circular-progress-active-indicator-color:#fff" />
              } @else {
                <mat-icon style="font-size:15px;width:15px;height:15px">check</mat-icon> Enrol Student
              }
            </button>
          }
        </div>
      </div>

    </div>
  `,
  styles: [`
    .dialog-shell { width: 580px; max-width: 100%; display: flex; flex-direction: column; max-height: 90vh; }

    .dialog-header { display:flex; align-items:center; gap:12px; padding:20px 24px 16px; border-bottom:1px solid var(--border); flex-shrink:0; }
    .dh-icon { width:36px; height:36px; border-radius:9px; background:var(--blue-light); color:var(--blue); display:flex; align-items:center; justify-content:center; flex-shrink:0; mat-icon { font-size:18px; width:18px; height:18px; } }
    .dh-title { font-size:15px; font-weight:600; color:var(--text); }
    .dh-sub   { font-size:11px; color:var(--text-3); margin-top:2px; }
    .dh-close { margin-left:auto; background:none; border:none; width:28px; height:28px; border-radius:6px; cursor:pointer; color:var(--text-3); display:flex; align-items:center; justify-content:center; &:hover { background:var(--bg); } mat-icon { font-size:18px; width:18px; height:18px; } }

    .step-track { display:flex; align-items:center; padding:14px 24px; background:var(--bg); border-bottom:1px solid var(--border); flex-shrink:0; }
    .step-node { display:flex; align-items:center; gap:7px; .sn-circle { width:22px; height:22px; border-radius:50%; border:1.5px solid var(--border); background:#fff; color:var(--text-3); font-size:11px; font-weight:600; display:flex; align-items:center; justify-content:center; flex-shrink:0; transition:all .2s; } .sn-label { font-size:11px; color:var(--text-3); font-weight:500; white-space:nowrap; } &.active { .sn-circle { background:var(--blue); border-color:var(--blue); color:#fff; } .sn-label { color:var(--blue); font-weight:600; } } &.done { .sn-circle { background:var(--green); border-color:var(--green); color:#fff; } .sn-label { color:var(--text-2); } } }
    .step-line { flex:1; height:1.5px; background:var(--border); margin:0 8px; &.done { background:var(--green); } }

    .dialog-body { flex:1; overflow-y:auto; padding:20px 24px; }

    .step-form   { display:flex; flex-direction:column; gap:14px; }
    .form-row    { display:flex; gap:12px; }
    .flex-1      { flex:1; min-width:0; }
    .field-group { display:flex; flex-direction:column; gap:5px; }
    .field-label { font-size:12px; font-weight:500; color:var(--text-2); .req { color:var(--red); } .hint { font-size:11px; color:var(--text-4); font-weight:400; } }
    .field-input { width:100%; height:36px; padding:0 10px; background:#fff; border:1px solid var(--border); border-radius:7px; font-size:13px; color:var(--text); outline:none; font-family:inherit; &::placeholder { color:var(--text-4); } &:focus { border-color:var(--blue); box-shadow:0 0 0 3px rgba(37,99,235,.1); } &.err { border-color:var(--red); } }
    select.field-input { cursor:pointer; }
    .field-error { font-size:11px; color:var(--red); }
    .section-divider { font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:.5px; color:var(--text-4); padding-top:4px; border-top:1px solid var(--border-light); margin-top:4px; }

    /* Parents step */
    .parent-card { border:1px solid var(--border); border-radius:10px; overflow:hidden; }
    .pc-head { display:flex; justify-content:space-between; align-items:center; padding:12px 14px; background:var(--bg); border-bottom:1px solid var(--border); }
    .pc-title { display:flex; align-items:center; gap:6px; font-size:13px; font-weight:600; color:var(--text); }
    .req-tag  { font-size:10px; font-weight:600; background:var(--blue-light); color:var(--blue); padding:1px 6px; border-radius:4px; }
    .opt-tag  { font-size:10px; font-weight:600; background:var(--purple-light); color:var(--purple); padding:1px 6px; border-radius:4px; }
    .parent-fields { padding:14px; display:flex; flex-direction:column; gap:12px; }
    .remove-parent-btn { display:flex; align-items:center; gap:4px; background:none; border:none; cursor:pointer; color:var(--red); font-size:12px; padding:4px 8px; border-radius:5px; &:hover { background:var(--red-light); } }

    .add-parent-btn { display:flex; align-items:center; gap:6px; background:none; border:1.5px dashed #D1D5DB; border-radius:8px; width:100%; padding:10px; font-size:12.5px; color:var(--blue); cursor:pointer; justify-content:center; font-weight:500; &:hover { background:var(--blue-light); border-color:var(--blue); } }
    .field-input.ta { height:auto; padding:8px 10px; resize:vertical; }
    .check-label { display:flex; align-items:center; gap:6px; font-size:12.5px; color:var(--text-2); cursor:pointer; }

    /* Emergency section */
    .emergency-section { border:1px solid #FCA5A5; border-radius:10px; overflow:hidden; }
    .es-title { display:flex; align-items:center; gap:6px; padding:10px 14px; background:#FFF5F5; border-bottom:1px solid #FCA5A5; font-size:12px; font-weight:600; color:#991B1B; }
    .es-options { padding:10px; display:flex; flex-direction:column; gap:6px; }
    .radio-option { display:flex; align-items:center; gap:10px; padding:10px 12px; border-radius:8px; border:1.5px solid var(--border); cursor:pointer; transition:all .15s; &:hover { border-color:var(--blue); background:var(--blue-light); } &.selected { border-color:var(--blue); background:var(--blue-light); } }
    .ro-radio { width:16px; height:16px; border-radius:50%; border:2px solid var(--border); flex-shrink:0; transition:all .15s; &.checked { border-color:var(--blue); border-width:5px; } }
    .ro-label { flex:1; }
    .ro-name  { font-size:13px; font-weight:500; color:var(--text); }
    .ro-rel   { font-size:11px; color:var(--text-3); font-weight:400; }
    .ro-phone { font-size:12px; color:var(--text-3); margin-top:1px; }

    /* Review */
    .review-panel { display:flex; flex-direction:column; gap:16px; }
    .review-section { border:1px solid var(--border); border-radius:9px; overflow:hidden; }
    .rs-title { display:flex; align-items:center; gap:7px; padding:11px 14px; background:var(--bg); border-bottom:1px solid var(--border); font-size:12.5px; font-weight:600; color:var(--text-2); }
    .rs-grid { display:grid; grid-template-columns:repeat(3,1fr); }
    .rs-item { padding:10px 14px; border-right:1px solid var(--border-light); border-bottom:1px solid var(--border-light); &:nth-child(3n) { border-right:none; } &:nth-last-child(-n+3) { border-bottom:none; } }
    .rs-label { font-size:10px; text-transform:uppercase; letter-spacing:.3px; color:var(--text-4); font-weight:500; margin-bottom:3px; }
    .rs-value { font-size:13px; font-weight:500; color:var(--text); }

    .parents-review { padding:8px; display:flex; flex-direction:column; gap:6px; }
    .pr-item { display:flex; align-items:flex-start; gap:10px; padding:10px; border-radius:8px; background:var(--bg); }
    .pr-av { width:32px; height:32px; border-radius:8px; color:#fff; display:flex; align-items:center; justify-content:center; font-size:13px; font-weight:600; flex-shrink:0; &.blue { background:var(--blue); } &.purple { background:var(--purple); } }
    .pr-info { flex:1; }
    .pr-name   { font-size:13px; font-weight:500; color:var(--text); }
    .pr-detail { font-size:11px; color:var(--text-3); margin-top:2px; }
    .pr-email  { font-size:11px; color:var(--blue); margin-top:2px; }
    .pr-badges { display:flex; flex-direction:column; gap:4px; align-items:flex-end; }
    .badge { font-size:10px; font-weight:600; padding:2px 7px; border-radius:4px; white-space:nowrap; &.primary { background:var(--blue-light); color:var(--blue); } &.emergency { background:#FFF5F5; color:#991B1B; border:1px solid #FCA5A5; } }

    .error-banner { display:flex; align-items:center; gap:8px; background:var(--red-light); border:1px solid #FECACA; color:#991B1B; padding:10px 12px; border-radius:8px; font-size:12.5px; }

    .dialog-footer { display:flex; align-items:center; justify-content:space-between; padding:14px 24px; border-top:1px solid var(--border); flex-shrink:0; background:var(--bg); }
    .btn-ghost { background:none; border:none; cursor:pointer; font-size:13px; color:var(--text-3); padding:0 8px; height:36px; border-radius:7px; &:hover { background:var(--border-light); } }
    .btn-outline { display:flex; align-items:center; gap:5px; background:#fff; border:1px solid var(--border); color:var(--text-2); border-radius:8px; height:36px; padding:0 14px; font-size:13px; font-weight:500; cursor:pointer; &:hover { background:var(--bg); } }
    .btn-primary { display:flex; align-items:center; gap:6px; background:var(--blue); color:#fff; border:none; border-radius:8px; height:36px; padding:0 18px; font-size:13px; font-weight:500; cursor:pointer; &:hover:not(:disabled) { background:#1D4ED8; } &:disabled { opacity:.6; cursor:not-allowed; } }
  `],
})
export class EnrolStudentDialogComponent implements OnInit {
  private fb        = inject(FormBuilder);
  private api       = inject(ApiService);
  private dialogRef = inject(MatDialogRef<EnrolStudentDialogComponent>);

  classes      = signal<SchoolClass[]>([]);
  submitting   = signal(false);
  error        = signal('');
  currentStep  = signal(0);
  showParent2  = signal(false);
  emergencyContact = signal<'parent1' | 'parent2'>('parent1');

  stepLabels = ['Basic Info', 'Medical', 'Parents', 'Review & Confirm'];
  bloodGroups = ['A+','A-','B+','B-','AB+','AB-','O+','O-'];

  basicForm = this.fb.group({
    first_name:       ['', Validators.required],
    last_name:        [''],
    dob:              ['', Validators.required],
    gender:           [''],
    class_id:         [''],
    admission_date:   [new Date().toISOString().slice(0, 10)],
    blood_group:      [''],
    nationality:      ['Indian'],
    mother_tongue:    [''],
    allergies_text:   [''],
    dietary_notes:    [''],
    conditions_text:  [''],
    medications_text: [''],
    doctor_name:      [''],
    doctor_phone:     [''],
  });

  parent1Form = this.newParentForm('father');
  parent2Form = this.newParentForm('mother');

  private basicStatus   = toSignal(this.basicForm.statusChanges,    { initialValue: this.basicForm.status    });
  private parent1Status = toSignal(this.parent1Form.statusChanges,  { initialValue: this.parent1Form.status  });
  private parent2Status = toSignal(this.parent2Form.statusChanges,  { initialValue: this.parent2Form.status  });

  canAdvance = computed(() => {
    if (this.currentStep() === 0) return this.basicStatus() !== 'INVALID';
    if (this.currentStep() === 2) {
      if (this.parent1Status() === 'INVALID') return false;
      if (this.showParent2() && this.parent2Status() === 'INVALID') return false;
      return true;
    }
    return true;
  });

  ngOnInit() {
    this.api.get<ApiResponse<SchoolClass[]>>('/students/classes').subscribe({
      next: res => this.classes.set(res.data),
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

  parent1Name(): string {
    const v = this.parent1Form.value;
    return [v.first_name, v.last_name].filter(Boolean).join(' ');
  }

  parent2Name(): string {
    const v = this.parent2Form.value;
    return [v.first_name, v.last_name].filter(Boolean).join(' ');
  }

  removeParent2() {
    this.showParent2.set(false);
    this.parent2Form.reset({ relation: 'mother', country: 'India' });
    if (this.emergencyContact() === 'parent2') this.emergencyContact.set('parent1');
  }

  nextStep() {
    if (this.currentStep() === 0) { this.basicForm.markAllAsTouched(); if (!this.basicForm.valid) return; }
    if (this.currentStep() === 2) {
      this.parent1Form.markAllAsTouched();
      if (this.showParent2()) this.parent2Form.markAllAsTouched();
      if (!this.canAdvance()) return;
    }
    this.currentStep.update(s => s + 1);
  }

  prevStep() { this.currentStep.update(s => s - 1); }

  getClassName(id: string | null | undefined): string {
    if (!id) return 'Unassigned';
    return this.classes().find(c => c.id === id)?.name ?? 'Unassigned';
  }

  private buildParent(form: FormGroup, isPrimary: boolean, isEmergency: boolean) {
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
    this.submitting.set(true);
    this.error.set('');

    const basic = this.basicForm.value;
    const split = (s: string) => s ? s.split(',').map((x: string) => x.trim()).filter(Boolean) : [];

    const parents = [
      this.buildParent(this.parent1Form, true, this.emergencyContact() === 'parent1'),
    ];
    if (this.showParent2()) {
      parents.push(this.buildParent(this.parent2Form, false, this.emergencyContact() === 'parent2'));
    }

    const payload: Record<string, unknown> = {
      first_name: basic.first_name,
      ...(basic.last_name ? { last_name: basic.last_name } : {}),
      dob:        basic.dob,
      parents,
      medical_notes: {
        conditions:  split(basic.conditions_text  ?? ''),
        medications: split(basic.medications_text ?? ''),
        ...(basic.doctor_name?.trim()  ? { doctor_name:  basic.doctor_name.trim()  } : {}),
        ...(basic.doctor_phone?.trim() ? { doctor_phone: basic.doctor_phone.trim() } : {}),
      },
    };

    if (basic.admission_date) payload['admission_date'] = basic.admission_date;
    if (basic.gender)        payload['gender']        = basic.gender;
    if (basic.class_id)      payload['class_id']      = basic.class_id;
    if (basic.blood_group)   payload['blood_group']   = basic.blood_group;
    if (basic.nationality)   payload['nationality']   = basic.nationality;
    if (basic.mother_tongue) payload['mother_tongue'] = basic.mother_tongue;
    if (basic.dietary_notes) payload['dietary_notes'] = basic.dietary_notes;
    const allergies = split(basic.allergies_text ?? '');
    if (allergies.length)    payload['allergies']     = allergies;

    this.api.post('/students', payload).subscribe({
      next: (res: any) => {
        this.submitting.set(false);
        this.dialogRef.close(res.data);
      },
      error: (err: any) => {
        this.submitting.set(false);
        this.error.set(err.error?.error?.message ?? 'Enrolment failed. Please check the details.');
      },
    });
  }
}
