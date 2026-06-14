import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { DatePipe } from '@angular/common';
import { environment } from '../../../../environments/environment';
import { PlatformAuthService } from '../../../core/services/platform-auth.service';

interface School {
  id: string;
  code: string;
  name: string;
  city: string | null;
  state: string | null;
  is_active: boolean;
  plan_name: string | null;
  student_count: number;
  staff_count: number;
  created_at: string;
}

interface Plan {
  id: string;
  name: string;
  max_students: number;
  max_staff: number;
}

@Component({
  selector: 'app-platform-schools',
  standalone: true,
  imports: [ReactiveFormsModule, MatIconModule, MatProgressSpinnerModule, DatePipe],
  template: `
    <div class="pg">

      <!-- Header -->
      <div class="pg-header">
        <div>
          <h1 class="pg-title">Schools</h1>
          <p class="pg-sub">{{ schools().length }} school{{ schools().length !== 1 ? 's' : '' }} registered</p>
        </div>
        <button class="btn-primary" (click)="openCreate()">
          <mat-icon>add</mat-icon> New School
        </button>
      </div>

      <!-- Error banner -->
      @if (error()) {
        <div class="err-banner">
          <mat-icon>error_outline</mat-icon> {{ error() }}
        </div>
      }

      <!-- Table -->
      <div class="card">
        @if (loading()) {
          <div class="spinner-wrap"><mat-spinner diameter="36" /></div>
        } @else if (schools().length === 0) {
          <div class="empty">
            <mat-icon>school</mat-icon>
            <p>No schools yet. Create the first one.</p>
          </div>
        } @else {
          <table class="tbl">
            <thead>
              <tr>
                <th>School</th>
                <th>Code</th>
                <th>Plan</th>
                <th>Students</th>
                <th>Staff</th>
                <th>Location</th>
                <th>Joined</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              @for (s of schools(); track s.id) {
                <tr>
                  <td class="name-cell">{{ s.name }}</td>
                  <td><code class="code-chip">{{ s.code }}</code></td>
                  <td>{{ s.plan_name ?? '—' }}</td>
                  <td>{{ s.student_count }}</td>
                  <td>{{ s.staff_count }}</td>
                  <td>{{ s.city && s.state ? s.city + ', ' + s.state : (s.city ?? s.state ?? '—') }}</td>
                  <td>{{ s.created_at | date:'d MMM y' }}</td>
                  <td>
                    <span class="badge" [class.active]="s.is_active" [class.inactive]="!s.is_active">
                      {{ s.is_active ? 'Active' : 'Suspended' }}
                    </span>
                  </td>
                  <td class="actions">
                    <button class="icon-btn" title="{{ s.is_active ? 'Suspend' : 'Activate' }}"
                            (click)="toggleActive(s)"
                            [class.danger]="s.is_active">
                      <mat-icon>{{ s.is_active ? 'block' : 'check_circle' }}</mat-icon>
                    </button>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        }
      </div>

    </div>

    <!-- Create school drawer / dialog -->
    @if (showCreate()) {
      <div class="overlay" (click)="closeCreate()"></div>
      <div class="drawer">
        <div class="drawer-header">
          <h2>New School</h2>
          <button class="icon-btn" (click)="closeCreate()"><mat-icon>close</mat-icon></button>
        </div>

        @if (createError()) {
          <div class="err-banner sm">
            <mat-icon>error_outline</mat-icon> {{ createError() }}
          </div>
        }

        <form [formGroup]="form" (ngSubmit)="submit()" class="drawer-form">

          <div class="section-label">School Details</div>

          <div class="row-2">
            <div class="field">
              <label>School Name <span class="req">*</span></label>
              <input formControlName="name" placeholder="Green Valley Montessori" />
            </div>
            <div class="field">
              <label>Code <span class="req">*</span></label>
              <input formControlName="code" placeholder="GVM" maxlength="20" />
              <span class="hint">3-20 alphanumeric chars, unique</span>
            </div>
          </div>

          <div class="row-2">
            <div class="field">
              <label>City</label>
              <input formControlName="city" placeholder="Chennai" />
            </div>
            <div class="field">
              <label>State</label>
              <input formControlName="state" placeholder="Tamil Nadu" />
            </div>
          </div>

          <div class="field">
            <label>Subscription Plan <span class="req">*</span></label>
            <select formControlName="plan_id">
              <option value="">Select a plan…</option>
              @for (p of plans(); track p.id) {
                <option [value]="p.id">{{ p.name }} (up to {{ p.max_students }} students)</option>
              }
            </select>
          </div>

          <div class="section-label" style="margin-top:20px">Owner Account</div>

          <div class="field">
            <label>Owner Name <span class="req">*</span></label>
            <input formControlName="owner_name" placeholder="Priya Sharma" />
          </div>
          <div class="field">
            <label>Owner Email <span class="req">*</span></label>
            <input formControlName="owner_email" type="email" placeholder="priya@school.com" />
          </div>
          <div class="field">
            <label>Owner Password <span class="req">*</span></label>
            <div class="pw-wrap">
              <input formControlName="owner_password" [type]="showPw() ? 'text' : 'password'" placeholder="Min 8 characters" />
              <button type="button" class="pw-toggle" (click)="showPw.set(!showPw())">
                <mat-icon>{{ showPw() ? 'visibility_off' : 'visibility' }}</mat-icon>
              </button>
            </div>
          </div>

          <div class="drawer-footer">
            <button type="button" class="btn-ghost" (click)="closeCreate()">Cancel</button>
            <button type="submit" class="btn-primary" [disabled]="form.invalid || saving()">
              @if (saving()) { <mat-spinner diameter="14" /> }
              Create School
            </button>
          </div>

        </form>
      </div>
    }

    <!-- Success toast -->
    @if (successMsg()) {
      <div class="toast">
        <mat-icon>check_circle</mat-icon> {{ successMsg() }}
      </div>
    }
  `,
  styles: [`
    .pg { padding: 32px; max-width: 1200px; }
    .pg-header { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 24px; }
    .pg-title { font-size: 22px; font-weight: 700; color: #0F172A; margin: 0 0 4px; }
    .pg-sub   { font-size: 13px; color: #64748B; margin: 0; }

    .btn-primary {
      display: flex; align-items: center; gap: 6px;
      background: #3B82F6; color: #fff; border: none; border-radius: 8px;
      padding: 9px 16px; font-size: 13px; font-weight: 600; cursor: pointer;
      mat-icon { font-size: 16px; }
      &:disabled { opacity: .5; cursor: not-allowed; }
      &:not(:disabled):hover { background: #2563EB; }
    }
    .btn-ghost {
      background: none; border: 1px solid #E2E8F0; border-radius: 8px;
      padding: 9px 16px; font-size: 13px; color: #64748B; cursor: pointer;
      &:hover { background: #F8FAFC; }
    }

    .err-banner {
      display: flex; align-items: center; gap: 8px;
      background: #FEF2F2; border: 1px solid #FECACA; color: #B91C1C;
      font-size: 13px; padding: 10px 14px; border-radius: 8px; margin-bottom: 16px;
      mat-icon { font-size: 16px; width: 16px; height: 16px; }
      &.sm { margin: 0 20px 16px; }
    }

    .card { background: #fff; border: 1px solid #E2E8F0; border-radius: 12px; overflow: hidden; }
    .spinner-wrap { display: flex; justify-content: center; padding: 48px; }
    .empty { display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 48px; color: #94A3B8;
      mat-icon { font-size: 36px; }
      p { margin: 0; font-size: 14px; }
    }

    .tbl { width: 100%; border-collapse: collapse; font-size: 13px; }
    .tbl th {
      background: #F8FAFC; color: #64748B; font-weight: 600; font-size: 11px; text-transform: uppercase;
      letter-spacing: .04em; padding: 10px 14px; text-align: left; white-space: nowrap;
      border-bottom: 1px solid #E2E8F0;
    }
    .tbl td { padding: 12px 14px; border-bottom: 1px solid #F1F5F9; color: #1E293B; vertical-align: middle; }
    .tbl tr:last-child td { border-bottom: none; }
    .tbl tr:hover td { background: #F8FAFC; }

    .name-cell { font-weight: 500; color: #0F172A; }
    .code-chip {
      background: #EFF6FF; color: #1D4ED8; padding: 2px 8px; border-radius: 4px;
      font-family: monospace; font-size: 12px;
    }
    .badge {
      padding: 3px 10px; border-radius: 20px; font-size: 11px; font-weight: 600;
      &.active   { background: #D1FAE5; color: #065F46; }
      &.inactive { background: #FEE2E2; color: #991B1B; }
    }
    .actions { text-align: right; }
    .icon-btn {
      background: none; border: none; cursor: pointer; color: #64748B; padding: 4px; border-radius: 6px;
      display: inline-flex; mat-icon { font-size: 18px; }
      &:hover { background: #F1F5F9; color: #0F172A; }
      &.danger:hover { background: #FEE2E2; color: #B91C1C; }
    }

    /* Drawer */
    .overlay {
      position: fixed; inset: 0; background: rgba(0,0,0,.4); z-index: 100;
    }
    .drawer {
      position: fixed; top: 0; right: 0; bottom: 0; width: 480px;
      background: #fff; z-index: 101; overflow-y: auto; display: flex; flex-direction: column;
      box-shadow: -4px 0 24px rgba(0,0,0,.12);
    }
    .drawer-header {
      display: flex; align-items: center; justify-content: space-between;
      padding: 20px 24px; border-bottom: 1px solid #E2E8F0; position: sticky; top: 0; background: #fff; z-index: 1;
      h2 { margin: 0; font-size: 17px; font-weight: 700; color: #0F172A; }
    }
    .drawer-form { padding: 24px; display: flex; flex-direction: column; gap: 14px; flex: 1; }
    .drawer-footer {
      display: flex; justify-content: flex-end; gap: 10px;
      padding: 16px 24px; border-top: 1px solid #E2E8F0;
      position: sticky; bottom: 0; background: #fff;
    }
    .section-label { font-size: 11px; font-weight: 700; color: #94A3B8; text-transform: uppercase; letter-spacing: .06em; }
    .row-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    .field { display: flex; flex-direction: column; gap: 5px; }
    .field label { font-size: 12px; font-weight: 500; color: #475569; }
    .field input, .field select {
      border: 1px solid #E2E8F0; border-radius: 8px; padding: 9px 12px; font-size: 13px;
      color: #0F172A; background: #fff;
      &:focus { outline: none; border-color: #3B82F6; box-shadow: 0 0 0 3px rgba(59,130,246,.1); }
    }
    .hint { font-size: 11px; color: #94A3B8; }
    .req  { color: #EF4444; }
    .pw-wrap { position: relative; }
    .pw-wrap input { padding-right: 40px; width: 100%; box-sizing: border-box; }
    .pw-toggle {
      position: absolute; right: 10px; top: 50%; transform: translateY(-50%);
      background: none; border: none; cursor: pointer; color: #94A3B8; display: flex;
      mat-icon { font-size: 18px; }
    }

    /* Toast */
    .toast {
      position: fixed; bottom: 24px; right: 24px; z-index: 200;
      background: #064E3B; color: #A7F3D0; border: 1px solid #065F46;
      padding: 12px 20px; border-radius: 10px; font-size: 13px; font-weight: 500;
      display: flex; align-items: center; gap: 8px; box-shadow: 0 4px 12px rgba(0,0,0,.15);
      mat-icon { font-size: 16px; }
    }
  `],
})
export class PlatformSchoolsComponent implements OnInit {
  private http = inject(HttpClient);
  private auth = inject(PlatformAuthService);
  private fb   = inject(FormBuilder);

  schools   = signal<School[]>([]);
  plans     = signal<Plan[]>([]);
  loading   = signal(true);
  error     = signal('');
  saving    = signal(false);
  showCreate = signal(false);
  createError = signal('');
  successMsg  = signal('');
  showPw     = signal(false);

  form = this.fb.group({
    name:           ['', Validators.required],
    code:           ['', [Validators.required, Validators.minLength(3), Validators.maxLength(20), Validators.pattern(/^[A-Za-z0-9]+$/)]],
    city:           [''],
    state:          [''],
    plan_id:        ['', Validators.required],
    owner_name:     ['', Validators.required],
    owner_email:    ['', [Validators.required, Validators.email]],
    owner_password: ['', [Validators.required, Validators.minLength(8)]],
  });

  private headers() {
    return new HttpHeaders({ Authorization: `Bearer ${this.auth.token()}` });
  }

  ngOnInit() {
    this.loadAll();
  }

  private loadAll() {
    this.loading.set(true);
    const headers = this.headers();
    this.http.get<{ data: School[] }>(`${environment.apiUrl}/platform/tenants`, { headers }).subscribe({
      next: res => {
        this.schools.set(res.data);
        this.loading.set(false);
      },
      error: e => {
        this.error.set(e?.error?.error?.message ?? 'Failed to load schools');
        this.loading.set(false);
      },
    });
    this.http.get<{ data: Plan[] }>(`${environment.apiUrl}/platform/plans`).subscribe({
      next: res => this.plans.set(res.data),
    });
  }

  openCreate() {
    this.form.reset();
    this.createError.set('');
    this.showCreate.set(true);
  }

  closeCreate() {
    this.showCreate.set(false);
  }

  submit() {
    if (this.form.invalid) return;
    this.saving.set(true);
    this.createError.set('');
    const dto = this.form.value;
    this.http.post<{ data: School }>(
      `${environment.apiUrl}/platform/tenants`, dto, { headers: this.headers() }
    ).subscribe({
      next: res => {
        this.schools.update(list => [res.data, ...list]);
        this.saving.set(false);
        this.closeCreate();
        this.showToast(`School "${res.data.name}" created successfully`);
      },
      error: e => {
        this.createError.set(e?.error?.error?.message ?? 'Failed to create school');
        this.saving.set(false);
      },
    });
  }

  toggleActive(school: School) {
    const action = school.is_active ? 'Suspend' : 'Activate';
    if (!confirm(`${action} "${school.name}"?`)) return;
    this.http.patch<{ data: School }>(
      `${environment.apiUrl}/platform/tenants/${school.id}/toggle-active`,
      {}, { headers: this.headers() }
    ).subscribe({
      next: res => {
        this.schools.update(list => list.map(s => s.id === school.id ? res.data : s));
        this.showToast(`${school.name} ${res.data.is_active ? 'activated' : 'suspended'}`);
      },
      error: e => this.error.set(e?.error?.error?.message ?? 'Failed to update school'),
    });
  }

  private showToast(msg: string) {
    this.successMsg.set(msg);
    setTimeout(() => this.successMsg.set(''), 3500);
  }
}
