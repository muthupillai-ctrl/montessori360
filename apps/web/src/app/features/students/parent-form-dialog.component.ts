import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ApiService } from '../../core/services/api.service';

export interface ParentRecord {
  id:            string;
  student_id:    string;
  relation:      string;
  first_name:    string;
  last_name:     string;
  email:         string | null;
  mobile:        string | null;
  mobile_alt:    string | null;
  profession:    string | null;
  employer:      string | null;
  annual_income: number | null;
  education:     string | null;
  is_primary:    boolean;
  can_pickup:    boolean;
  notes:         string | null;
}

interface SuccessInfo {
  parentName:   string;
  studentName:  string;
  email:        string | null;
  inviteLink:   string | null;
  emailSent:    boolean;
}

const RELATIONS = [
  { value: 'father',      label: 'Father'       },
  { value: 'mother',      label: 'Mother'       },
  { value: 'guardian',    label: 'Guardian'     },
  { value: 'step_father', label: 'Step Father'  },
  { value: 'step_mother', label: 'Step Mother'  },
  { value: 'other',       label: 'Other'        },
];

const EDUCATION = [
  'Below 10th', '10th / SSLC', '12th / HSC', 'Diploma',
  'Graduate', 'Post-Graduate', 'Doctorate', 'Other',
];

@Component({
  selector: 'app-parent-form-dialog',
  standalone: true,
  imports: [ ReactiveFormsModule, MatDialogModule, MatIconModule, MatProgressSpinnerModule ],
  template: `
    <div class="dialog-shell">

      <div class="dialog-header">
        <div class="dh-icon" [style.background]="step() === 'success' ? '#D1FAE5' : null"
                             [style.color]="step() === 'success' ? '#059669' : null">
          <mat-icon style="font-size:18px;width:18px;height:18px">
            {{ step() === 'success' ? 'check_circle' : 'family_restroom' }}
          </mat-icon>
        </div>
        <div>
          <div class="dh-title">
            {{ step() === 'success' ? 'Parent Added Successfully' : (data.parent ? 'Edit Parent' : 'Add Parent') }}
          </div>
          <div class="dh-sub">{{ data.studentName }}</div>
        </div>
        @if (step() === 'form') {
          <button class="dh-close" mat-dialog-close>
            <mat-icon style="font-size:18px;width:18px;height:18px">close</mat-icon>
          </button>
        }
      </div>

      <!-- ── Step 1: Form ──────────────────────────────────────── -->
      @if (step() === 'form') {
        <div class="dialog-body">
          <form [formGroup]="form" class="parent-form">

            <div class="form-row">
              <div class="field-group w-200">
                <label class="fl">Relation <span class="req">*</span></label>
                <select class="fi" formControlName="relation">
                  @for (r of relations; track r.value) {
                    <option [value]="r.value">{{ r.label }}</option>
                  }
                </select>
              </div>
              <div class="check-group">
                <label class="check-label">
                  <input type="checkbox" formControlName="is_primary">
                  Primary Contact
                </label>
                <label class="check-label">
                  <input type="checkbox" formControlName="can_pickup">
                  Authorised Pickup
                </label>
              </div>
            </div>

            <div class="form-row">
              <div class="field-group fill">
                <label class="fl">First Name <span class="req">*</span></label>
                <input class="fi" formControlName="first_name" placeholder="First name">
              </div>
              <div class="field-group fill">
                <label class="fl">Last Name <span class="req">*</span></label>
                <input class="fi" formControlName="last_name" placeholder="Last name">
              </div>
            </div>

            <div class="section-divider">Contact</div>

            <div class="form-row">
              <div class="field-group fill">
                <label class="fl">Mobile</label>
                <input class="fi" formControlName="mobile" placeholder="+91 XXXXX XXXXX">
              </div>
              <div class="field-group fill">
                <label class="fl">Alternate Mobile</label>
                <input class="fi" formControlName="mobile_alt" placeholder="+91 XXXXX XXXXX">
              </div>
            </div>
            <div class="field-group">
              <label class="fl">
                Email
                <span class="field-hint">Used as username for parent portal login</span>
              </label>
              <input class="fi" type="email" formControlName="email"
                     placeholder="parent@email.com">
            </div>

            <div class="section-divider">Professional</div>

            <div class="form-row">
              <div class="field-group fill">
                <label class="fl">Profession</label>
                <input class="fi" formControlName="profession" placeholder="e.g. Engineer, Doctor">
              </div>
              <div class="field-group fill">
                <label class="fl">Employer / Company</label>
                <input class="fi" formControlName="employer" placeholder="Company name">
              </div>
            </div>
            <div class="form-row">
              <div class="field-group fill">
                <label class="fl">Annual Income (₹)</label>
                <input class="fi" type="number" formControlName="annual_income" placeholder="e.g. 600000">
              </div>
              <div class="field-group fill">
                <label class="fl">Education</label>
                <select class="fi" formControlName="education">
                  <option value="">Select…</option>
                  @for (e of educationLevels; track e) {
                    <option [value]="e">{{ e }}</option>
                  }
                </select>
              </div>
            </div>

            <div class="field-group">
              <label class="fl">Notes</label>
              <textarea class="fi ta" formControlName="notes" rows="2"
                        placeholder="Any additional notes…"></textarea>
            </div>

          </form>
        </div>

        @if (error()) {
          <div class="error-banner">
            <mat-icon style="font-size:14px;width:14px;height:14px;flex-shrink:0">error_outline</mat-icon>
            {{ error() }}
          </div>
        }

        <div class="dialog-footer">
          <button class="btn-ghost" mat-dialog-close>Cancel</button>
          <button class="btn-primary" (click)="save()" [disabled]="form.invalid || saving()">
            @if (saving()) {
              <mat-progress-spinner diameter="16" mode="indeterminate"
                style="--mdc-circular-progress-active-indicator-color:#fff"/>
            } @else {
              <mat-icon style="font-size:14px;width:14px;height:14px">save</mat-icon>
            }
            {{ data.parent ? 'Save Changes' : 'Add Parent' }}
          </button>
        </div>
      }

      <!-- ── Step 2: Success summary ────────────────────────────── -->
      @if (step() === 'success' && successInfo()) {
        <div class="dialog-body">

          <!-- Parent + student -->
          <div class="success-row">
            <div class="success-avatar">{{ successInfo()!.parentName[0] }}</div>
            <div>
              <div class="success-name">{{ successInfo()!.parentName }}</div>
              <div class="success-meta">
                Added as parent of <strong>{{ successInfo()!.studentName }}</strong>
              </div>
            </div>
          </div>

          @if (successInfo()!.email) {

            <!-- Email sent confirmation -->
            <div class="info-card">
              <div class="info-card-header">
                <mat-icon class="ic-icon green">mark_email_read</mat-icon>
                <span class="ic-title">
                  {{ successInfo()!.emailSent ? 'Invite email sent' : 'Email invite ready' }}
                </span>
              </div>
              <div class="info-card-body">
                An invitation email has been sent to
                <strong>{{ successInfo()!.email }}</strong> with a link to set up their password.
              </div>
            </div>

            <!-- Login credentials -->
            <div class="info-card">
              <div class="info-card-header">
                <mat-icon class="ic-icon blue">person</mat-icon>
                <span class="ic-title">Parent portal login credentials</span>
              </div>
              <div class="cred-grid">
                <div class="cred-row">
                  <span class="cred-label">Username / Email</span>
                  <span class="cred-value">{{ successInfo()!.email }}</span>
                </div>
                <div class="cred-row">
                  <span class="cred-label">Password</span>
                  <span class="cred-value italic">Set by parent via invite link</span>
                </div>
                <div class="cred-row">
                  <span class="cred-label">Portal URL</span>
                  <span class="cred-value">{{ portalUrl }}</span>
                </div>
              </div>
            </div>

            <!-- Invite link -->
            @if (successInfo()!.inviteLink) {
              <div class="info-card">
                <div class="info-card-header">
                  <mat-icon class="ic-icon amber">link</mat-icon>
                  <span class="ic-title">Setup link <span class="expires-note">(expires in 72 hours)</span></span>
                </div>
                <div class="link-box">
                  <span class="link-text">{{ successInfo()!.inviteLink }}</span>
                  <button class="copy-btn" (click)="copyLink()" title="Copy link">
                    <mat-icon style="font-size:15px;width:15px;height:15px">
                      {{ copied() ? 'check' : 'content_copy' }}
                    </mat-icon>
                    {{ copied() ? 'Copied!' : 'Copy' }}
                  </button>
                </div>
                <div class="link-note">
                  Share this link if the email doesn't arrive. The parent uses it to create their password.
                </div>
              </div>
            }

          } @else {
            <!-- No email -->
            <div class="info-card warn">
              <div class="info-card-header">
                <mat-icon class="ic-icon amber">warning</mat-icon>
                <span class="ic-title">No email address on record</span>
              </div>
              <div class="info-card-body">
                No portal invite was sent because this parent has no email address.
                You can edit the parent record later to add an email and send an invite from the Directory.
              </div>
            </div>
          }

        </div>

        <div class="dialog-footer">
          <button class="btn-primary" (click)="close()">
            <mat-icon style="font-size:14px;width:14px;height:14px">done</mat-icon>
            Done
          </button>
        </div>
      }

    </div>
  `,
  styles: [`
    .dialog-shell { width: 100%; display: flex; flex-direction: column; max-height: 90vh; }
    .dialog-header {
      display: flex; align-items: center; gap: 12px;
      padding: 16px 20px 12px; border-bottom: 1px solid var(--border); flex-shrink: 0;
    }
    .dh-icon {
      width: 36px; height: 36px; border-radius: 9px; flex-shrink: 0;
      background: var(--blue-light); color: var(--blue);
      display: flex; align-items: center; justify-content: center;
      transition: background .2s, color .2s;
    }
    .dh-title { font-size: 15px; font-weight: 600; color: var(--text); }
    .dh-sub   { font-size: 11px; color: var(--text-3); }
    .dh-close {
      margin-left: auto; background: none; border: none; cursor: pointer;
      color: var(--text-3); width: 28px; height: 28px; border-radius: 6px;
      display: flex; align-items: center; justify-content: center;
      &:hover { background: var(--bg); }
    }

    /* form */
    .dialog-body { flex: 1; overflow-y: auto; padding: 16px 20px; background: var(--bg); }
    .parent-form { display: flex; flex-direction: column; gap: 12px; }
    .form-row  { display: flex; gap: 10px; align-items: flex-start; flex-wrap: wrap; }
    .fill  { flex: 1; min-width: 140px; }
    .w-200 { width: 200px; flex-shrink: 0; }
    .field-group { display: flex; flex-direction: column; gap: 4px; }
    .fl { font-size: 12px; font-weight: 500; color: var(--text-2); display: flex; align-items: center; gap: 6px; .req { color: var(--red); } }
    .field-hint { font-size: 10px; color: var(--text-4); font-weight: 400; }
    .fi {
      height: 34px; padding: 0 10px; width: 100%;
      background: var(--surface); border: 1px solid var(--border);
      border-radius: 7px; font-size: 13px; color: var(--text);
      outline: none; font-family: inherit;
      &:focus { border-color: var(--blue); }
    }
    select.fi { cursor: pointer; }
    .ta { height: auto; padding: 8px 10px; resize: vertical; }
    .check-group { display: flex; flex-direction: column; gap: 8px; justify-content: center; padding-top: 18px; }
    .check-label { display: flex; align-items: center; gap: 6px; font-size: 12.5px; color: var(--text-2); cursor: pointer; }
    .section-divider {
      font-size: 10px; font-weight: 700; text-transform: uppercase;
      letter-spacing: .5px; color: var(--text-4);
      padding-top: 4px; border-top: 1px solid var(--border-light);
    }

    /* success step */
    .success-row {
      display: flex; align-items: center; gap: 12px;
      background: var(--surface); border: 1px solid var(--border);
      border-radius: 10px; padding: 14px 16px; margin-bottom: 14px;
    }
    .success-avatar {
      width: 40px; height: 40px; border-radius: 50%; flex-shrink: 0;
      background: #059669; color: #fff;
      display: flex; align-items: center; justify-content: center;
      font-size: 16px; font-weight: 700; text-transform: uppercase;
    }
    .success-name { font-size: 15px; font-weight: 700; color: var(--text-1); }
    .success-meta { font-size: 12px; color: var(--text-2); margin-top: 2px; }

    .info-card {
      background: var(--surface); border: 1px solid var(--border);
      border-radius: 10px; padding: 14px 16px; margin-bottom: 12px;
    }
    .info-card.warn { border-color: #FDE68A; background: #FFFBEB; }
    .info-card-header {
      display: flex; align-items: center; gap: 8px; margin-bottom: 10px;
    }
    .ic-icon { font-size: 17px; width: 17px; height: 17px; }
    .ic-icon.green { color: #059669; }
    .ic-icon.blue  { color: #2563EB; }
    .ic-icon.amber { color: #D97706; }
    .ic-title { font-size: 13px; font-weight: 600; color: var(--text-1); }
    .expires-note { font-size: 11px; font-weight: 400; color: var(--text-2); }
    .info-card-body { font-size: 12.5px; color: var(--text-2); line-height: 1.6; }

    .cred-grid { display: flex; flex-direction: column; gap: 8px; }
    .cred-row  { display: flex; align-items: baseline; gap: 12px; }
    .cred-label { font-size: 11px; font-weight: 600; color: var(--text-2); text-transform: uppercase; letter-spacing: .04em; min-width: 130px; flex-shrink: 0; }
    .cred-value { font-size: 13px; color: var(--text-1); font-family: 'SF Mono','Fira Code',monospace; }
    .italic { font-style: italic; font-family: inherit !important; color: var(--text-2) !important; }

    .link-box {
      display: flex; align-items: center; gap: 8px;
      background: var(--bg); border: 1px solid var(--border);
      border-radius: 7px; padding: 8px 10px; margin-bottom: 8px;
    }
    .link-text {
      flex: 1; font-size: 11px; color: var(--blue);
      font-family: 'SF Mono','Fira Code',monospace;
      word-break: break-all; line-height: 1.5;
    }
    .copy-btn {
      display: flex; align-items: center; gap: 4px; flex-shrink: 0;
      background: var(--surface); border: 1px solid var(--border); border-radius: 6px;
      padding: 4px 10px; font-size: 12px; cursor: pointer; color: var(--text-2);
      &:hover { background: var(--bg-2); }
    }
    .link-note { font-size: 11px; color: var(--text-2); line-height: 1.5; }

    .error-banner {
      display: flex; align-items: center; gap: 8px; flex-shrink: 0;
      background: var(--red-light); padding: 10px 20px; font-size: 12.5px; color: #991B1B;
    }
    .dialog-footer {
      display: flex; justify-content: flex-end; gap: 8px;
      padding: 12px 20px; border-top: 1px solid var(--border);
      background: var(--surface); flex-shrink: 0;
    }
    .btn-ghost { background: none; border: none; cursor: pointer; font-size: 13px; color: var(--text-3); padding: 0 10px; height: 34px; border-radius: 7px; &:hover { background: var(--border-light); } }
    .btn-primary { display: flex; align-items: center; gap: 5px; background: var(--blue); color: #fff; border: none; border-radius: 8px; height: 34px; padding: 0 16px; font-size: 13px; font-weight: 500; cursor: pointer; &:hover:not(:disabled) { background: #1D4ED8; } &:disabled { opacity: .6; cursor: not-allowed; } }
  `],
})
export class ParentFormDialogComponent {
  private api       = inject(ApiService);
  private dialogRef = inject(MatDialogRef<ParentFormDialogComponent>);
  data: { studentId: string; studentName: string; parent: ParentRecord | null } = inject(MAT_DIALOG_DATA);

  step        = signal<'form' | 'success'>('form');
  saving      = signal(false);
  error       = signal('');
  copied      = signal(false);
  successInfo = signal<SuccessInfo | null>(null);

  readonly portalUrl = window.location.origin + '/parent/dashboard';

  relations       = RELATIONS;
  educationLevels = EDUCATION;

  private fb = inject(FormBuilder);
  form = this.fb.group({
    relation:      [this.data.parent?.relation      ?? 'father',  Validators.required],
    first_name:    [this.data.parent?.first_name    ?? '',        Validators.required],
    last_name:     [this.data.parent?.last_name     ?? '',        Validators.required],
    mobile:        [this.data.parent?.mobile        ?? ''],
    mobile_alt:    [this.data.parent?.mobile_alt    ?? ''],
    email:         [this.data.parent?.email         ?? '',        Validators.email],
    profession:    [this.data.parent?.profession    ?? ''],
    employer:      [this.data.parent?.employer      ?? ''],
    annual_income: [this.data.parent?.annual_income ?? null],
    education:     [this.data.parent?.education     ?? ''],
    is_primary:    [this.data.parent?.is_primary    ?? false],
    can_pickup:    [this.data.parent?.can_pickup    ?? true],
    notes:         [this.data.parent?.notes         ?? ''],
  });

  save() {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    this.saving.set(true); this.error.set('');

    const v = this.form.value;
    const payload: Record<string, unknown> = {
      relation:   v.relation,
      first_name: v.first_name,
      last_name:  v.last_name,
      is_primary: v.is_primary,
      can_pickup: v.can_pickup,
    };
    if (v.mobile?.trim())     payload['mobile']        = v.mobile.trim();
    if (v.mobile_alt?.trim()) payload['mobile_alt']    = v.mobile_alt.trim();
    if (v.email?.trim())      payload['email']         = v.email.trim();
    if (v.profession?.trim()) payload['profession']    = v.profession.trim();
    if (v.employer?.trim())   payload['employer']      = v.employer.trim();
    if (v.annual_income)      payload['annual_income'] = +v.annual_income;
    if (v.education)          payload['education']     = v.education;
    if (v.notes?.trim())      payload['notes']         = v.notes.trim();

    const url = `/students/${this.data.studentId}/parents` +
                (this.data.parent ? `/${this.data.parent.id}` : '');
    const req = this.data.parent
      ? this.api.put<any>(url, payload)
      : this.api.post<any>(url, payload);

    req.subscribe({
      next: (res: any) => {
        const saved = res.data;
        // For edits, just close with saved data (no invite step needed)
        if (this.data.parent) {
          this.saving.set(false);
          this.dialogRef.close(saved);
          return;
        }
        // For new parent: send invite if email provided, then show success step
        if (saved.email) {
          this.api.post<any>(`/students/all-parents/${saved.id}/invite`, {}).subscribe({
            next: (inv: any) => {
              this.saving.set(false);
              this.successInfo.set({
                parentName:  `${saved.first_name} ${saved.last_name}`,
                studentName: this.data.studentName,
                email:       saved.email,
                inviteLink:  inv.data?.inviteLink ?? null,
                emailSent:   inv.data?.emailSent ?? false,
              });
              this.step.set('success');
            },
            error: () => {
              // Invite failed but parent was saved — still show success without link
              this.saving.set(false);
              this.successInfo.set({
                parentName:  `${saved.first_name} ${saved.last_name}`,
                studentName: this.data.studentName,
                email:       saved.email,
                inviteLink:  null,
                emailSent:   false,
              });
              this.step.set('success');
            },
          });
        } else {
          this.saving.set(false);
          this.successInfo.set({
            parentName:  `${saved.first_name} ${saved.last_name}`,
            studentName: this.data.studentName,
            email:       null,
            inviteLink:  null,
            emailSent:   false,
          });
          this.step.set('success');
        }
      },
      error: (err: any) => {
        this.saving.set(false);
        this.error.set(err.error?.error?.message ?? 'Failed to save');
      },
    });
  }

  copyLink(): void {
    const link = this.successInfo()?.inviteLink;
    if (!link) return;
    navigator.clipboard.writeText(link).then(() => {
      this.copied.set(true);
      setTimeout(() => this.copied.set(false), 2000);
    });
  }

  close(): void {
    this.dialogRef.close(this.successInfo());
  }
}
