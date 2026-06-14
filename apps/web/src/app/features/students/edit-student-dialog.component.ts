import { Component, inject, signal, OnInit, computed } from '@angular/core';
import { FormBuilder, FormArray, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ApiService } from '../../core/services/api.service';
import type { Student } from '../../core/models';

interface SchoolClass { id: string; name: string; capacity: number; enrolled_count: number; }

const STEPS = [
  { key: 'basic',     label: 'Basic Info',         icon: '👤' },
  { key: 'medical',   label: 'Medical',            icon: '🏥' },
  { key: 'contacts',  label: 'Emergency Contacts', icon: '📞' },
  { key: 'transport', label: 'Transport',          icon: '🚌' },
];

@Component({
  selector: 'app-edit-student-dialog',
  standalone: true,
  imports: [ ReactiveFormsModule, MatDialogModule, MatIconModule, MatProgressSpinnerModule ],
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

      <!-- Step indicators -->
      <div class="step-bar">
        @for (s of steps; track s.key; let i = $index) {
          <div class="step" [class.active]="stepIndex() === i" [class.done]="stepIndex() > i"
               (click)="stepIndex.set(i)">
            <div class="step-circle">
              @if (stepIndex() > i) {
                <mat-icon style="font-size:14px;width:14px;height:14px">check</mat-icon>
              } @else {
                {{ i + 1 }}
              }
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
          <form [formGroup]="form">

            <!-- ── Step 1: Basic Info ─────────────────────── -->
            @if (stepIndex() === 0) {
              <div class="form-section">

                <div class="form-row">
                  <div class="field-group fill">
                    <label class="fl">First Name <span class="req">*</span></label>
                    <input class="fi" formControlName="first_name" placeholder="Arjun"
                           [class.err]="f['first_name'].invalid && f['first_name'].touched">
                    @if (f['first_name'].invalid && f['first_name'].touched) {
                      <div class="field-error">Required</div>
                    }
                  </div>
                  <div class="field-group fill">
                    <label class="fl">Last Name <span class="req">*</span></label>
                    <input class="fi" formControlName="last_name" placeholder="Sharma"
                           [class.err]="f['last_name'].invalid && f['last_name'].touched">
                    @if (f['last_name'].invalid && f['last_name'].touched) {
                      <div class="field-error">Required</div>
                    }
                  </div>
                </div>

                <div class="form-row">
                  <div class="field-group fill">
                    <label class="fl">Date of Birth <span class="req">*</span></label>
                    <input class="fi" type="date" formControlName="dob"
                           [class.err]="f['dob'].invalid && f['dob'].touched">
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
                      <option [value]="cls.id">
                        {{ cls.name }} ({{ cls.enrolled_count }}/{{ cls.capacity }})
                      </option>
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
                      @for (bg of bloodGroups; track bg) {
                        <option [value]="bg">{{ bg }}</option>
                      }
                    </select>
                  </div>
                </div>

                <div class="form-row">
                  <div class="field-group fill">
                    <label class="fl">Nationality</label>
                    <input class="fi" formControlName="nationality" placeholder="Indian">
                  </div>
                  <div class="field-group fill">
                    <label class="fl">Aadhar Number</label>
                    <input class="fi" formControlName="aadhar_no"
                           placeholder="XXXXXXXXXXXX" maxlength="12">
                  </div>
                </div>

                <div class="field-group">
                  <label class="fl">Previous School</label>
                  <input class="fi" formControlName="previous_school"
                         placeholder="Name of previous school (if any)">
                </div>

              </div>
            }

            <!-- ── Step 2: Medical ───────────────────────── -->
            @if (stepIndex() === 1) {
              <div class="form-section">

                <div class="field-group">
                  <label class="fl">Allergies</label>
                  <input class="fi" formControlName="allergies_text"
                         placeholder="e.g. Peanuts, Dairy, Gluten (comma separated)">
                </div>

                <div class="field-group">
                  <label class="fl">Dietary Notes</label>
                  <input class="fi" formControlName="dietary_notes"
                         placeholder="e.g. Vegetarian, No egg">
                </div>

                <div class="section-divider">Medical Conditions</div>

                <div class="field-group">
                  <label class="fl">Conditions</label>
                  <input class="fi" formControlName="conditions_text"
                         placeholder="e.g. Asthma, Diabetes (comma separated)">
                </div>

                <div class="field-group">
                  <label class="fl">Medications</label>
                  <input class="fi" formControlName="medications_text"
                         placeholder="e.g. Inhaler, Insulin (comma separated)">
                </div>

                <div class="section-divider">Doctor Details</div>

                <div class="form-row">
                  <div class="field-group fill">
                    <label class="fl">Doctor Name</label>
                    <input class="fi" formControlName="doctor_name" placeholder="Dr. Name">
                  </div>
                  <div class="field-group fill">
                    <label class="fl">Doctor Phone</label>
                    <input class="fi" formControlName="doctor_phone"
                           placeholder="+91 XXXXX XXXXX">
                  </div>
                </div>

              </div>
            }

            <!-- ── Step 3: Emergency Contacts ────────────── -->
            @if (stepIndex() === 2) {
              <div class="form-section">

                <div formArrayName="contacts">
                  @for (ctrl of contacts.controls; track $index) {
                    <div class="contact-card" [formGroupName]="$index">
                      <div class="contact-card-header">
                        <span class="contact-num">Contact {{ $index + 1 }}</span>
                        @if ($index === 0) {
                          <span class="primary-badge">Primary</span>
                        }
                        @if (contacts.length > 1) {
                          <button class="btn-remove" type="button" (click)="removeContact($index)">
                            <mat-icon style="font-size:14px;width:14px;height:14px">close</mat-icon>
                          </button>
                        }
                      </div>
                      <div class="contact-fields">
                        <div class="form-row">
                          <div class="field-group fill">
                            <label class="fl">Name <span class="req">*</span></label>
                            <input class="fi" formControlName="name" placeholder="Full name"
                                   [class.err]="ctrl.get('name')?.invalid && ctrl.get('name')?.touched">
                          </div>
                          <div class="field-group w160">
                            <label class="fl">Relation</label>
                            <select class="fi" formControlName="relation">
                              <option value="father">Father</option>
                              <option value="mother">Mother</option>
                              <option value="guardian">Guardian</option>
                              <option value="other">Other</option>
                            </select>
                          </div>
                        </div>
                        <div class="field-group">
                          <label class="fl">Phone <span class="req">*</span></label>
                          <div class="phone-wrap">
                            <span class="phone-prefix">+91</span>
                            <input class="fi phone-input" formControlName="phone"
                                   placeholder="9876543210" maxlength="10"
                                   [class.err]="ctrl.get('phone')?.invalid && ctrl.get('phone')?.touched">
                          </div>
                          @if (ctrl.get('phone')?.invalid && ctrl.get('phone')?.touched) {
                            <div class="field-error">Valid 10-digit number required</div>
                          }
                        </div>
                        <div class="field-group">
                          <label class="fl">
                            Email
                            <span style="font-size:10px;color:var(--text-4);font-weight:400">(for parent portal)</span>
                          </label>
                          <input class="fi" type="email" formControlName="email"
                                 placeholder="parent@email.com"
                                 [class.err]="ctrl.get('email')?.invalid && ctrl.get('email')?.touched">
                          @if (ctrl.get('email')?.invalid && ctrl.get('email')?.touched) {
                            <div class="field-error">Invalid email address</div>
                          }
                        </div>
                      </div>
                    </div>
                  }
                </div>

                @if (contacts.length < 3) {
                  <button type="button" class="btn-add-contact" (click)="addContact()">
                    <mat-icon style="font-size:15px;width:15px;height:15px">add</mat-icon>
                    Add Another Contact
                  </button>
                }

              </div>
            }

            <!-- ── Step 4: Transport ──────────────────────────────── -->
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

          </form>
        </div>

        @if (error()) {
          <div class="error-banner">
            <mat-icon style="font-size:14px;width:14px;height:14px;flex-shrink:0">error_outline</mat-icon>
            {{ error() }}
          </div>
        }

        <!-- Footer with Next/Back/Save -->
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
              <button class="btn-primary" type="button" (click)="submit()"
                      [disabled]="form.invalid || submitting()">
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
    .dialog-shell { width:100%; display:flex; flex-direction:column; max-height:90vh; }

    .dialog-header {
      display:flex; align-items:center; gap:12px;
      padding:16px 20px 12px; border-bottom:1px solid var(--border); flex-shrink:0;
    }
    .dh-icon {
      width:36px; height:36px; border-radius:9px; flex-shrink:0;
      background:var(--blue-light); color:var(--blue);
      display:flex; align-items:center; justify-content:center;
    }
    .dh-title { font-size:15px; font-weight:600; color:var(--text); }
    .dh-sub   { font-size:11px; color:var(--text-3); }
    .dh-close {
      margin-left:auto; background:none; border:none; cursor:pointer;
      color:var(--text-3); width:28px; height:28px; border-radius:6px;
      display:flex; align-items:center; justify-content:center;
      &:hover { background:var(--bg); }
    }

    /* Step bar */
    .step-bar {
      display:flex; align-items:center; padding:14px 20px;
      background:var(--bg); border-bottom:1px solid var(--border); flex-shrink:0;
    }
    .step {
      display:flex; align-items:center; gap:7px; cursor:pointer;
      &:hover .step-circle { border-color:var(--blue); }
    }
    .step-circle {
      width:26px; height:26px; border-radius:50%;
      border:2px solid var(--border); background:var(--surface);
      display:flex; align-items:center; justify-content:center;
      font-size:11px; font-weight:600; color:var(--text-3);
      transition:all .15s;
    }
    .step.active .step-circle { border-color:var(--blue); background:var(--blue); color:#fff; }
    .step.done  .step-circle { border-color:var(--green); background:var(--green); color:#fff; }
    .step-label { font-size:12px; font-weight:500; color:var(--text-3); white-space:nowrap; }
    .step.active .step-label { color:var(--blue); font-weight:600; }
    .step.done  .step-label  { color:var(--green); }
    .step-line { flex:1; height:2px; background:var(--border); margin:0 10px; min-width:20px; transition:background .15s; &.done { background:var(--green); } }

    .loading-state {
      display:flex; align-items:center; justify-content:center; gap:12px;
      padding:48px; color:var(--text-3); font-size:13px; flex:1;
    }

    .dialog-body { flex:1; overflow-y:auto; padding:16px 20px; background:var(--bg); }
    .form-section { display:flex; flex-direction:column; gap:12px; }
    .form-row  { display:flex; gap:10px; }
    .fill  { flex:1; min-width:0; }
    .w160  { width:160px; flex-shrink:0; }
    .field-group { display:flex; flex-direction:column; gap:4px; }
    .fl { font-size:12px; font-weight:500; color:var(--text-2); .req { color:var(--red); } }
    .fi {
      height:34px; padding:0 10px; width:100%;
      background:var(--surface); border:1px solid var(--border);
      border-radius:7px; font-size:13px; color:var(--text);
      outline:none; font-family:inherit;
      &:focus { border-color:var(--blue); }
      &.err   { border-color:var(--red);  }
    }
    select.fi { cursor:pointer; }
    .field-error { font-size:11px; color:var(--red); }
    .section-divider {
      font-size:10px; font-weight:700; text-transform:uppercase;
      letter-spacing:.5px; color:var(--text-4);
      padding-top:4px; border-top:1px solid var(--border-light);
    }

    /* Contacts */
    .contact-card { background:var(--surface); border:1px solid var(--border); border-radius:9px; overflow:hidden; margin-bottom:10px; }
    .contact-card-header { display:flex; align-items:center; gap:8px; padding:8px 12px; background:var(--bg); border-bottom:1px solid var(--border-light); }
    .contact-num   { font-size:12px; font-weight:600; color:var(--text); }
    .primary-badge { font-size:10px; font-weight:600; padding:1px 7px; border-radius:10px; background:var(--blue-light); color:var(--blue); }
    .btn-remove { margin-left:auto; background:none; border:none; cursor:pointer; color:var(--text-3); width:24px; height:24px; border-radius:5px; display:flex; align-items:center; justify-content:center; &:hover { background:var(--red-light); color:var(--red); } }
    .contact-fields { padding:10px 12px; display:flex; flex-direction:column; gap:10px; }
    .transport-hint { display:flex; align-items:center; gap:7px; background:var(--blue-light); border:1px solid var(--border); border-radius:8px; padding:10px 12px; font-size:12px; color:var(--text-2); }
    .transport-current { display:flex; align-items:center; gap:6px; font-size:12.5px; color:var(--text-2); }
    .phone-wrap { display:flex; align-items:center; }
    .phone-prefix { height:34px; padding:0 10px; background:var(--bg); border:1px solid var(--border); border-right:none; border-radius:7px 0 0 7px; font-size:13px; color:var(--text-3); display:flex; align-items:center; }
    .phone-input { border-radius:0 7px 7px 0; }
    .btn-add-contact { display:flex; align-items:center; gap:6px; background:var(--surface); border:1px dashed var(--border); border-radius:8px; padding:10px 14px; width:100%; font-size:12.5px; color:var(--blue); cursor:pointer; font-family:inherit; &:hover { background:var(--blue-light); border-color:var(--blue); } }

    .error-banner { display:flex; align-items:center; gap:8px; flex-shrink:0; background:var(--red-light); padding:10px 20px; font-size:12.5px; color:#991B1B; }

    .dialog-footer { display:flex; justify-content:space-between; align-items:center; gap:8px; padding:12px 20px; border-top:1px solid var(--border); background:var(--surface); flex-shrink:0; }
    .nav-btns { display:flex; gap:8px; }
    .btn-ghost { background:none; border:none; cursor:pointer; font-size:13px; color:var(--text-3); padding:0 10px; height:34px; border-radius:7px; &:hover { background:var(--border-light); } }
    .btn-back  { display:flex; align-items:center; gap:4px; background:var(--surface); border:1px solid var(--border); border-radius:8px; height:34px; padding:0 14px; font-size:13px; color:var(--text-2); cursor:pointer; &:hover { background:var(--bg); } }
    .btn-next  { display:flex; align-items:center; gap:4px; background:var(--blue); color:#fff; border:none; border-radius:8px; height:34px; padding:0 16px; font-size:13px; font-weight:500; cursor:pointer; &:hover { background:#1D4ED8; } }
    .btn-primary { display:flex; align-items:center; gap:5px; background:var(--green); color:#fff; border:none; border-radius:8px; height:34px; padding:0 16px; font-size:13px; font-weight:500; cursor:pointer; &:hover:not(:disabled) { background:#047857; } &:disabled { opacity:.6; cursor:not-allowed; } }
  `],
})
export class EditStudentDialogComponent implements OnInit {
  private fb        = inject(FormBuilder);
  private api       = inject(ApiService);
  private dialogRef = inject(MatDialogRef<EditStudentDialogComponent>);
  student: Student  = inject(MAT_DIALOG_DATA);

  submitting  = signal(false);
  dataLoading = signal(true);
  error       = signal('');
  stepIndex   = signal(0);
  classes     = signal<SchoolClass[]>([]);
  routes      = signal<any[]>([]);
  routeStops  = signal<any[]>([]);
  currentTransport = signal<any | null>(null);

  steps      = STEPS;
  bloodGroups = ['A+','A-','B+','B-','AB+','AB-','O+','O-'];

  // Initialise with empty — will be patched after full data load
  form = this.fb.group({
    first_name:       ['', Validators.required],
    last_name:        ['', Validators.required],
    dob:              ['', Validators.required],
    gender:           [''],
    class_id:         [''],
    admission_date:   [''],
    blood_group:      [''],
    nationality:      ['Indian'],
    aadhar_no:        [''],
    previous_school:  [''],
    allergies_text:   [''],
    dietary_notes:    [''],
    conditions_text:  [''],
    medications_text: [''],
    doctor_name:      [''],
    doctor_phone:     [''],
    contacts: this.fb.array([this.newContactGroup()]),
  });

  transportForm = this.fb.group({
    route_id:       [''],
    pickup_stop_id: [''],
    drop_stop_id:   [''],
  });

  get f()        { return this.form.controls; }
  get contacts() { return this.form.get('contacts') as FormArray; }

  ngOnInit() {
    // Load classes
    this.api.get<any>('/transport/routes').subscribe({
      next: (res: any) => this.routes.set(res.data ?? []),
      error: () => {},
    });
    this.api.get<any>('/transport/students/' + this.student.id).subscribe({
      next: (res: any) => {
        this.currentTransport.set(res.data);
        if (res.data) {
          this.transportForm.patchValue({
            route_id:       res.data.route_id ?? '',
            pickup_stop_id: res.data.pickup_stop_id ?? '',
            drop_stop_id:   res.data.drop_stop_id ?? '',

          });
          if (res.data.route_id) this.loadRouteStops(res.data.route_id);
        }
      },
      error: () => {},
    });
    this.api.get<any>('/students/classes').subscribe({
      next: (res: any) => this.classes.set(res.data ?? []),
      error: () => {},
    });

    // Fetch full student record to ensure all fields including emergency_contacts
    this.api.get<any>('/students/' + this.student.id).subscribe({
      next: (res: any) => {
        const s = res.data;
        this.patchForm(s);
        this.dataLoading.set(false);
      },
      error: () => {
        // Fallback to passed data
        this.patchForm(this.student);
        this.dataLoading.set(false);
      },
    });
  }

  private patchForm(s: any) {
    // Patch scalar fields
    this.form.patchValue({
      first_name:       s.first_name      ?? '',
      last_name:        s.last_name       ?? '',
      dob:              s.dob ? new Date(s.dob).toISOString().slice(0,10) : '',
      gender:           s.gender          ?? '',
      class_id:         s.class_id        ?? '',
      admission_date:   s.admission_date  ? new Date(s.admission_date).toISOString().slice(0,10) : '',
      blood_group:      s.blood_group     ?? '',
      nationality:      s.nationality     ?? 'Indian',
      aadhar_no:        s.aadhar_no       ?? '',
      previous_school:  s.previous_school ?? '',
      allergies_text:   (s.allergies              ?? []).join(', '),
      dietary_notes:    s.dietary_notes           ?? '',
      conditions_text:  (s.medical_notes?.conditions  ?? []).join(', '),
      medications_text: (s.medical_notes?.medications ?? []).join(', '),
      doctor_name:      s.medical_notes?.doctor_name  ?? '',
      doctor_phone:     s.medical_notes?.doctor_phone ?? '',
    });

    // Patch contacts FormArray
    const ec: any[] = s.emergency_contacts ?? [];
    const contactsArray = this.form.get('contacts') as FormArray;
    contactsArray.clear();
    const list = ec.length ? ec : [{ name: '', relation: 'father', phone: '' }];
    list.forEach(c => {
      contactsArray.push(this.fb.group({
        name:     [c.name     ?? '', Validators.required],
        relation: [c.relation ?? 'father'],
        phone:    [(c.phone ?? '').replace('+91','').replace(/\s/g,''),
                   [Validators.required, Validators.pattern(/^[0-9]{10}$/)]],
        email:    [c.email    ?? '', [Validators.email]],
      }));
    });
  }

  loadRouteStops(routeId: string) {
    this.api.get<any>('/transport/routes/' + routeId).subscribe({
      next: (res: any) => this.routeStops.set(res.data?.stops ?? []),
      error: () => {},
    });
  }

  onRouteChange(e: Event) {
    const routeId = (e.target as HTMLSelectElement).value;
    this.transportForm.patchValue({ pickup_stop_id: '', drop_stop_id: '' });
    if (routeId) this.loadRouteStops(routeId);
    else this.routeStops.set([]);
  }

  newContactGroup() {
    return this.fb.group({
      name:     ['', Validators.required],
      relation: ['father'],
      phone:    ['', [Validators.required, Validators.pattern(/^[0-9]{10}$/)]],
      email:    ['', [Validators.email]],
    });
  }

  addContact()             { if (this.contacts.length < 3) this.contacts.push(this.newContactGroup()); }
  removeContact(i: number) { if (this.contacts.length > 1) this.contacts.removeAt(i); }

  next() {
    // Mark current step fields as touched to show errors
    if (this.stepIndex() === 0) {
      ['first_name','last_name','dob'].forEach(k => this.form.get(k)?.markAsTouched());
      if (this.f['first_name'].invalid || this.f['last_name'].invalid || this.f['dob'].invalid) return;
    }
    this.stepIndex.update(i => i + 1);
  }

  private split(s: string) {
    return s ? s.split(',').map(x => x.trim()).filter(Boolean) : [];
  }

  submit() {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    this.submitting.set(true);
    this.error.set('');

    const v = this.form.value;

    const emergency_contacts = (v.contacts ?? []).map((c: any, i: number) => ({
      name:       c.name,
      relation:   c.relation,
      phone:      '+91' + c.phone,
      email:      c.email?.trim() || undefined,
      is_primary: i === 0,
    }));

    const payload: Record<string, unknown> = {
      first_name:        v.first_name,
      last_name:         v.last_name,
      dob:               v.dob,
      emergency_contacts,
    };

    if (v.gender)                  payload['gender']          = v.gender;
    if (v.class_id)                payload['class_id']        = v.class_id;
    if (v.admission_date)          payload['admission_date']  = v.admission_date;
    if (v.blood_group)             payload['blood_group']     = v.blood_group;
    if (v.nationality)             payload['nationality']     = v.nationality;
    if (v.aadhar_no?.trim())       payload['aadhar_no']       = v.aadhar_no!.trim();
    if (v.previous_school?.trim()) payload['previous_school'] = v.previous_school!.trim();
    if (v.dietary_notes?.trim())   payload['dietary_notes']   = v.dietary_notes!.trim();
    payload['allergies']     = this.split(v.allergies_text   ?? '');
    payload['medical_notes'] = {
      conditions:   this.split(v.conditions_text  ?? ''),
      medications:  this.split(v.medications_text ?? ''),
      ...(v.doctor_name?.trim()  ? { doctor_name:  v.doctor_name!.trim()  } : {}),
      ...(v.doctor_phone?.trim() ? { doctor_phone: v.doctor_phone!.trim() } : {}),
    };

    this.api.put<any>('/students/' + this.student.id, payload).subscribe({
      next: (res: any) => {
        // Save transport assignment if changed
        const t = this.transportForm.value;
        if (t.route_id) {
          this.api.post<any>('/transport/students/assign', {
            student_id:     this.student.id,
            route_id:       t.route_id,
            stop_no:        1,
            pickup_stop_id: t.pickup_stop_id || undefined,
            drop_stop_id:   t.drop_stop_id   || undefined,

          }).subscribe({ next: () => {}, error: () => {} });
        } else if (this.currentTransport()) {
          // Remove from route if cleared
          this.api.delete<any>('/transport/students/' + this.student.id)
            .subscribe({ next: () => {}, error: () => {} });
        }
        this.submitting.set(false);
        this.dialogRef.close(res.data);
      },
      error: (err: any) => {
        this.submitting.set(false);
        this.error.set(err.error?.error?.message ?? 'Failed to save changes');
      },
    });
  }
}
