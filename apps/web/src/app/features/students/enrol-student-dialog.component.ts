import { Component, inject, signal, OnInit } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators, FormArray } from '@angular/forms';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatStepperModule } from '@angular/material/stepper';
import { DatePipe, TitleCasePipe } from '@angular/common';
import { ApiService } from '../../core/services/api.service';
import type { SchoolClass, ApiResponse } from '../../core/models';

@Component({
  selector: 'app-enrol-student-dialog',
  standalone: true,
  imports: [
    ReactiveFormsModule, MatDialogModule,
    MatButtonModule, MatIconModule,
    MatProgressSpinnerModule, MatStepperModule,
    DatePipe, TitleCasePipe,
  ],
  template: `
    <div class="dialog-shell">

      <!-- Header -->
      <div class="dialog-header">
        <div class="dh-icon"><mat-icon>person_add</mat-icon></div>
        <div>
          <div class="dh-title">Enrol New Student</div>
          <div class="dh-sub">Step {{ currentStep() + 1 }} of 3 — {{ stepLabels[currentStep()] }}</div>
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
              } @else {
                {{ $index + 1 }}
              }
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
                <label class="field-label">Last Name <span class="req">*</span></label>
                <input class="field-input" formControlName="last_name" placeholder="Sharma"
                       [class.err]="basicForm.get('last_name')?.invalid && basicForm.get('last_name')?.touched">
                @if (basicForm.get('last_name')?.invalid && basicForm.get('last_name')?.touched) {
                  <div class="field-error">Required</div>
                }
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
                  @for (bg of bloodGroups; track bg) {
                    <option [value]="bg">{{ bg }}</option>
                  }
                </select>
              </div>
              <div class="field-group flex-1">
                <label class="field-label">Nationality</label>
                <input class="field-input" formControlName="nationality" placeholder="Indian">
              </div>
            </div>

            <div class="field-group">
              <label class="field-label">Allergies <span class="hint">(comma separated)</span></label>
              <input class="field-input" formControlName="allergies_text" placeholder="e.g. Peanuts, Dairy">
            </div>

            <div class="field-group">
              <label class="field-label">Dietary Notes</label>
              <input class="field-input" formControlName="dietary_notes" placeholder="e.g. Vegetarian, No egg">
            </div>

          </form>
        }

        <!-- ── Step 1: Emergency Contacts ────────────────────────── -->
        @if (currentStep() === 1) {
          <form [formGroup]="contactForm">
            <div class="step-intro">
              <mat-icon style="color:var(--blue)">info_outline</mat-icon>
              Add at least one emergency contact. The first contact will be set as primary.
            </div>

            <div formArrayName="contacts" class="contacts-list">
              @for (ctrl of contacts.controls; track $index) {
                <div [formGroupName]="$index" class="contact-card">
                  <div class="cc-head">
                    <div class="cc-num">
                      @if ($index === 0) {
                        <span class="primary-tag">Primary</span>
                      } @else {
                        <span class="contact-num">Contact {{ $index + 1 }}</span>
                      }
                    </div>
                    @if ($index > 0) {
                      <button type="button" class="remove-btn" (click)="removeContact($index)">
                        <mat-icon style="font-size:15px;width:15px;height:15px">delete</mat-icon>
                        Remove
                      </button>
                    }
                  </div>

                  <div class="form-row">
                    <div class="field-group flex-1">
                      <label class="field-label">Full Name <span class="req">*</span></label>
                      <input class="field-input" formControlName="name" placeholder="Raj Sharma"
                             [class.err]="ctrl.get('name')?.invalid && ctrl.get('name')?.touched">
                    </div>
                    <div class="field-group" style="width:140px">
                      <label class="field-label">Relation <span class="req">*</span></label>
                      <select class="field-input" formControlName="relation">
                        <option value="father">Father</option>
                        <option value="mother">Mother</option>
                        <option value="guardian">Guardian</option>
                        <option value="other">Other</option>
                      </select>
                    </div>
                  </div>

                  <div class="field-group">
                    <label class="field-label">Phone Number <span class="req">*</span></label>
                    <div class="phone-wrap">
                      <span class="phone-prefix">+91</span>
                      <input class="field-input phone-input" formControlName="phone"
                             placeholder="9876543210"
                             [class.err]="ctrl.get('phone')?.invalid && ctrl.get('phone')?.touched">
                    </div>
                    @if (ctrl.get('phone')?.invalid && ctrl.get('phone')?.touched) {
                      <div class="field-error">Valid phone required</div>
                    }
                  </div>
                </div>
              }
            </div>

            <button type="button" class="add-contact-btn" (click)="addContact()">
              <mat-icon style="font-size:16px;width:16px;height:16px">add_circle_outline</mat-icon>
              Add Another Contact
            </button>
          </form>
        }

        <!-- ── Step 2: Review ────────────────────────────────────── -->
        @if (currentStep() === 2) {
          <div class="review-panel">

            <div class="review-section">
              <div class="rs-title">
                <mat-icon style="font-size:16px;width:16px;height:16px;color:var(--blue)">person</mat-icon>
                Student Details
              </div>
              <div class="rs-grid">
                <div class="rs-item">
                  <div class="rs-label">Full Name</div>
                  <div class="rs-value">{{ basicForm.value.first_name }} {{ basicForm.value.last_name }}</div>
                </div>
                <div class="rs-item">
                  <div class="rs-label">Date of Birth</div>
                  <div class="rs-value">{{ basicForm.value.dob | date:'d MMM yyyy' }}</div>
                </div>
                <div class="rs-item">
                  <div class="rs-label">Gender</div>
                  <div class="rs-value">{{ (basicForm.value.gender | titlecase) || '—' }}</div>
                </div>
                <div class="rs-item">
                  <div class="rs-label">Class</div>
                  <div class="rs-value">{{ getClassName(basicForm.value.class_id) }}</div>
                </div>
                <div class="rs-item">
                  <div class="rs-label">Blood Group</div>
                  <div class="rs-value">{{ basicForm.value.blood_group || 'Unknown' }}</div>
                </div>
                <div class="rs-item">
                  <div class="rs-label">Nationality</div>
                  <div class="rs-value">{{ basicForm.value.nationality || '—' }}</div>
                </div>
              </div>
            </div>

            <div class="review-section">
              <div class="rs-title">
                <mat-icon style="font-size:16px;width:16px;height:16px;color:var(--blue)">contacts</mat-icon>
                Emergency Contacts
              </div>
              <div class="contacts-review">
                @for (c of contactForm.value.contacts; track $index) {
                  <div class="cr-item">
                    <div class="cr-av">{{ c.name?.[0] ?? '?' }}</div>
                    <div class="cr-info">
                      <div class="cr-name">{{ c.name }}</div>
                      <div class="cr-detail">{{ (c.relation | titlecase) }} · {{ c.phone }}</div>
                    </div>
                    @if ($index === 0) {
                      <span class="primary-tag">Primary</span>
                    }
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

      <!-- Footer actions -->
      <div class="dialog-footer">
        <button class="btn-ghost" mat-dialog-close>Cancel</button>
        <div style="display:flex;gap:8px">
          @if (currentStep() > 0) {
            <button class="btn-outline" (click)="prevStep()">
              <mat-icon style="font-size:15px;width:15px;height:15px">arrow_back</mat-icon>
              Back
            </button>
          }
          @if (currentStep() < 2) {
            <button class="btn-primary" (click)="nextStep()" [disabled]="!canAdvance()">
              Continue
              <mat-icon style="font-size:15px;width:15px;height:15px">arrow_forward</mat-icon>
            </button>
          }
          @if (currentStep() === 2) {
            <button class="btn-primary" (click)="submit()" [disabled]="submitting()">
              @if (submitting()) {
                <mat-progress-spinner diameter="16" mode="indeterminate" style="--mdc-circular-progress-active-indicator-color:#fff" />
              } @else {
                <ng-container>
                  <mat-icon style="font-size:15px;width:15px;height:15px">check</mat-icon>
                  Enrol Student
                </ng-container>
              }
            </button>
          }
        </div>
      </div>

    </div>
  `,
  styles: [`
    .dialog-shell {
      width: 560px;
      max-width: 100%;
      display: flex;
      flex-direction: column;
      max-height: 90vh;
    }

    /* Header */
    .dialog-header {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 20px 24px 16px;
      border-bottom: 1px solid var(--border);
      flex-shrink: 0;
    }
    .dh-icon {
      width: 36px; height: 36px;
      border-radius: 9px;
      background: var(--blue-light);
      color: var(--blue);
      display: flex; align-items: center; justify-content: center;
      flex-shrink: 0;
      mat-icon { font-size: 18px; width: 18px; height: 18px; }
    }
    .dh-title { font-size: 15px; font-weight: 600; color: var(--text); }
    .dh-sub   { font-size: 11px; color: var(--text-3); margin-top: 2px; }
    .dh-close {
      margin-left: auto;
      background: none; border: none;
      width: 28px; height: 28px;
      border-radius: 6px;
      cursor: pointer; color: var(--text-3);
      display: flex; align-items: center; justify-content: center;
      &:hover { background: var(--bg); color: var(--text-2); }
      mat-icon { font-size: 18px; width: 18px; height: 18px; }
    }

    /* Step track */
    .step-track {
      display: flex;
      align-items: center;
      padding: 14px 24px;
      background: var(--bg);
      border-bottom: 1px solid var(--border);
      flex-shrink: 0;
    }
    .step-node {
      display: flex; align-items: center; gap: 7px;
      .sn-circle {
        width: 22px; height: 22px;
        border-radius: 50%;
        border: 1.5px solid var(--border);
        background: #fff;
        color: var(--text-3);
        font-size: 11px; font-weight: 600;
        display: flex; align-items: center; justify-content: center;
        flex-shrink: 0;
        transition: all .2s;
      }
      .sn-label { font-size: 11px; color: var(--text-3); font-weight: 500; white-space: nowrap; }

      &.active {
        .sn-circle { background: var(--blue); border-color: var(--blue); color: #fff; }
        .sn-label  { color: var(--blue); font-weight: 600; }
      }
      &.done {
        .sn-circle { background: var(--green); border-color: var(--green); color: #fff; }
        .sn-label  { color: var(--text-2); }
      }
    }
    .step-line {
      flex: 1; height: 1.5px; background: var(--border); margin: 0 8px;
      &.done { background: var(--green); }
    }

    /* Body */
    .dialog-body { flex: 1; overflow-y: auto; padding: 20px 24px; }

    /* Form */
    .step-form   { display: flex; flex-direction: column; gap: 14px; }
    .form-row    { display: flex; gap: 12px; }
    .flex-1      { flex: 1; min-width: 0; }
    .field-group { display: flex; flex-direction: column; gap: 5px; }

    .field-label {
      font-size: 12px; font-weight: 500; color: var(--text-2);
      .req  { color: var(--red); }
      .hint { font-size: 11px; color: var(--text-4); font-weight: 400; }
    }

    .field-input {
      width: 100%;
      height: 36px;
      padding: 0 10px;
      background: #fff;
      border: 1px solid var(--border);
      border-radius: 7px;
      font-size: 13px;
      color: var(--text);
      outline: none;
      transition: border-color .15s, box-shadow .15s;
      font-family: inherit;

      &::placeholder { color: var(--text-4); }
      &:focus {
        border-color: var(--blue);
        box-shadow: 0 0 0 3px rgba(37,99,235,.1);
      }
      &.err { border-color: var(--red); }
    }
    select.field-input { cursor: pointer; }

    .field-error { font-size: 11px; color: var(--red); }
    .field-hint  { font-size: 11px; color: var(--text-3); margin-top: 3px; }

    /* Phone field */
    .phone-wrap { display: flex; align-items: center; gap: 0; }
    .phone-prefix {
      height: 36px; padding: 0 10px;
      background: var(--bg); border: 1px solid var(--border); border-right: none;
      border-radius: 7px 0 0 7px; font-size: 13px; color: var(--text-3);
      display: flex; align-items: center; flex-shrink: 0;
    }
    .phone-input { border-radius: 0 7px 7px 0 !important; }

    /* Contacts */
    .step-intro {
      display: flex; align-items: flex-start; gap: 8px;
      background: var(--blue-light); border-radius: 8px;
      padding: 10px 12px; font-size: 12.5px; color: #1E40AF;
      margin-bottom: 14px;
    }

    .contacts-list { display: flex; flex-direction: column; gap: 10px; margin-bottom: 10px; }
    .contact-card  {
      border: 1px solid var(--border); border-radius: 9px;
      padding: 14px; background: var(--bg);
    }
    .cc-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
    .primary-tag {
      background: var(--amber-light); color: #92400E;
      font-size: 10px; font-weight: 600; padding: 2px 8px; border-radius: 4px;
    }
    .contact-num { font-size: 12px; font-weight: 500; color: var(--text-3); }
    .remove-btn {
      display: flex; align-items: center; gap: 4px;
      background: none; border: none; cursor: pointer;
      color: var(--red); font-size: 12px;
      padding: 4px 8px; border-radius: 5px;
      &:hover { background: var(--red-light); }
    }

    .add-contact-btn {
      display: flex; align-items: center; gap: 6px;
      background: none; border: 1px dashed var(--border-light); /* was --border */
      border: 1px dashed #D1D5DB;
      border-radius: 8px; width: 100%; padding: 10px;
      font-size: 12.5px; color: var(--blue); cursor: pointer;
      justify-content: center; font-weight: 500;
      &:hover { background: var(--blue-light); border-color: var(--blue-mid); }
    }

    /* Review */
    .review-panel { display: flex; flex-direction: column; gap: 16px; }
    .review-section { border: 1px solid var(--border); border-radius: 9px; overflow: hidden; }
    .rs-title {
      display: flex; align-items: center; gap: 7px;
      padding: 11px 14px; background: var(--bg);
      border-bottom: 1px solid var(--border);
      font-size: 12.5px; font-weight: 600; color: var(--text-2);
    }
    .rs-grid { display: grid; grid-template-columns: repeat(3,1fr); gap: 0; }
    .rs-item {
      padding: 10px 14px;
      border-right: 1px solid var(--border-light);
      border-bottom: 1px solid var(--border-light);
      &:nth-child(3n) { border-right: none; }
      &:nth-last-child(-n+3) { border-bottom: none; }
    }
    .rs-label { font-size: 10px; text-transform: uppercase; letter-spacing: .3px; color: var(--text-4); font-weight: 500; margin-bottom: 3px; }
    .rs-value { font-size: 13px; font-weight: 500; color: var(--text); }

    .contacts-review { padding: 8px; display: flex; flex-direction: column; gap: 4px; }
    .cr-item { display: flex; align-items: center; gap: 10px; padding: 8px 6px; border-radius: 7px; background: var(--bg); }
    .cr-av { width: 28px; height: 28px; border-radius: 7px; background: var(--blue); color: #fff; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 600; flex-shrink: 0; }
    .cr-info { flex: 1; min-width: 0; }
    .cr-name   { font-size: 13px; font-weight: 500; color: var(--text); }
    .cr-detail { font-size: 11px; color: var(--text-3); margin-top: 1px; }

    .error-banner {
      display: flex; align-items: center; gap: 8px;
      background: var(--red-light); border: 1px solid #FECACA;
      color: #991B1B; padding: 10px 12px; border-radius: 8px; font-size: 12.5px;
    }

    /* Footer */
    .dialog-footer {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 14px 24px;
      border-top: 1px solid var(--border);
      flex-shrink: 0;
      background: var(--bg);
    }
    .btn-ghost {
      background: none; border: none; cursor: pointer;
      font-size: 13px; color: var(--text-3); padding: 0 8px; height: 36px; border-radius: 7px;
      &:hover { background: var(--border-light); color: var(--text-2); }
    }
    .btn-outline {
      display: flex; align-items: center; gap: 5px;
      background: #fff; border: 1px solid var(--border);
      color: var(--text-2); border-radius: 8px; height: 36px; padding: 0 14px;
      font-size: 13px; font-weight: 500; cursor: pointer;
      &:hover { background: var(--bg); }
    }
    .btn-primary {
      display: flex; align-items: center; gap: 6px;
      background: var(--blue); color: #fff;
      border: none; border-radius: 8px; height: 36px; padding: 0 18px;
      font-size: 13px; font-weight: 500; cursor: pointer;
      transition: background .15s;
      &:hover:not(:disabled) { background: #1D4ED8; }
      &:disabled { opacity: .6; cursor: not-allowed; }
    }
  `],
})
export class EnrolStudentDialogComponent implements OnInit {
  private fb        = inject(FormBuilder);
  private api       = inject(ApiService);
  private dialogRef = inject(MatDialogRef<EnrolStudentDialogComponent>);

  classes    = signal<SchoolClass[]>([]);
  submitting = signal(false);
  error      = signal('');
  currentStep = signal(0);

  stepLabels = ['Basic Info', 'Emergency Contact', 'Review & Confirm'];
  bloodGroups = ['A+','A-','B+','B-','AB+','AB-','O+','O-'];

  basicForm = this.fb.group({
    first_name:     ['', Validators.required],
    last_name:      ['', Validators.required],
    dob:            ['', Validators.required],
    gender:         [''],
    class_id:       [''],
    admission_date: [new Date().toISOString().slice(0, 10)],
    blood_group:    [''],
    nationality:    ['Indian'],
    allergies_text: [''],
    dietary_notes:  [''],
  });

  contactForm = this.fb.group({
    contacts: this.fb.array([this.newContact()]),
  });

  get contacts(): FormArray { return this.contactForm.get('contacts') as FormArray; }

  ngOnInit() {
    this.api.get<ApiResponse<SchoolClass[]>>('/students/classes').subscribe({
      next: res => this.classes.set(res.data),
    });
  }

  newContact() {
    return this.fb.group({
      name:     ['', Validators.required],
      relation: ['father'],
      phone:    ['', [Validators.required, Validators.pattern(/^[0-9]{10}$/)]],
    });
  }

  addContact()             { this.contacts.push(this.newContact()); }
  removeContact(i: number) { this.contacts.removeAt(i); }

  canAdvance(): boolean {
    if (this.currentStep() === 0) return this.basicForm.valid;
    if (this.currentStep() === 1) return this.contactForm.valid;
    return true;
  }

  nextStep() {
    if (this.currentStep() === 0) { this.basicForm.markAllAsTouched(); if (!this.basicForm.valid) return; }
    if (this.currentStep() === 1) { this.contactForm.markAllAsTouched(); if (!this.contactForm.valid) return; }
    this.currentStep.update(s => s + 1);
  }

  prevStep() { this.currentStep.update(s => s - 1); }

  getClassName(id: string | null | undefined): string {
    if (!id) return 'Unassigned';
    return this.classes().find(c => c.id === id)?.name ?? 'Unassigned';
  }

  submit() {
    this.submitting.set(true);
    this.error.set('');

    const basic    = this.basicForm.value;
    const contacts = this.contactForm.value.contacts!.map((c: any, i: number) => ({
      name: c.name, relation: c.relation, phone: '+91' + c.phone, is_primary: i === 0,
    }));

    const allergies = basic.allergies_text
      ? basic.allergies_text.split(',').map((s: string) => s.trim()).filter(Boolean)
      : [];

    const payload: Record<string, unknown> = {
      first_name: basic.first_name,
      last_name:  basic.last_name,
      dob:        basic.dob,
      admission_date: basic.admission_date,
      emergency_contacts: contacts,
    };

    if (basic.gender)        payload['gender']        = basic.gender;
    if (basic.class_id)      payload['class_id']      = basic.class_id;
    if (basic.blood_group)   payload['blood_group']   = basic.blood_group;
    if (basic.nationality)   payload['nationality']   = basic.nationality;
    if (allergies.length)    payload['allergies']     = allergies;
    if (basic.dietary_notes) payload['dietary_notes'] = basic.dietary_notes;

    this.api.post('/students', payload).subscribe({
      next: (res: any) => { this.submitting.set(false); this.dialogRef.close(res.data); },
      error: (err: any) => {
        this.submitting.set(false);
        this.error.set(err.error?.error?.message ?? 'Enrolment failed. Please check the details.');
      },
    });
  }
}
