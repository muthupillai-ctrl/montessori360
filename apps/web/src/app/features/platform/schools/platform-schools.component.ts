import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { DatePipe, DecimalPipe } from '@angular/common';
import { Plan as FullPlan, planPriceLabel } from '../plans/platform-plans.component';
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
  subscription_plan_id: string | null;
  plan_status: 'trial' | 'active' | 'overdue' | 'cancelled';
  plan_started_on: string | null;
  renews_on: string | null;
  trial_ends_on: string | null;
  discount_pct: string;
  billing_notes: string | null;
  annual_estimate_inr: number | null;
  ai_generations_month: number;
  warnings: { code: string; severity: 'info' | 'warning' | 'critical'; message: string }[];
}

interface StaffAdmin {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  role: string;
}

interface Owner {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  is_active: boolean;
  is_primary: boolean;
}

type Plan = FullPlan;

@Component({
  selector: 'app-platform-schools',
  standalone: true,
  imports: [ReactiveFormsModule, MatIconModule, MatProgressSpinnerModule, DatePipe, DecimalPipe],
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
                <th>Est. / year</th>
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
                  <td>
                    <div class="plan-cell">{{ s.plan_name ?? '—' }}</div>
                    <span class="sub-status" [class]="'sub-status ' + s.plan_status">{{ s.plan_status }}</span>
                    @if (s.warnings.length) {
                      <span class="warn-dot" [class.critical]="hasCritical(s)" [title]="warningText(s)">
                        <mat-icon>{{ hasCritical(s) ? 'error' : 'warning' }}</mat-icon>
                      </span>
                    }
                  </td>
                  <td class="est">{{ s.annual_estimate_inr != null ? '₹' + (s.annual_estimate_inr | number) : '—' }}</td>
                  <td>{{ s.student_count }}</td>
                  <td>{{ s.staff_count }}</td>
                  <td>{{ s.city && s.state ? s.city + ', ' + s.state : (s.city ?? s.state ?? '—') }}</td>
                  <td class="nowrap">{{ s.created_at | date:'d MMM y' }}</td>
                  <td>
                    <span class="badge" [class.active]="s.is_active" [class.inactive]="!s.is_active">
                      {{ s.is_active ? 'Active' : 'Suspended' }}
                    </span>
                  </td>
                  <td class="actions">
                    <button class="icon-btn" title="Plan & billing"
                            (click)="openSubscription(s)">
                      <mat-icon>sell</mat-icon>
                    </button>
                    <button class="icon-btn" title="Owners"
                            (click)="openOwners(s)">
                      <mat-icon>manage_accounts</mat-icon>
                    </button>
                    <button class="icon-btn" title="Reset staff password"
                            (click)="openResetPassword(s)">
                      <mat-icon>key</mat-icon>
                    </button>
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
              <input formControlName="name" placeholder="Green Valley School" />
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
                <option [value]="p.id">{{ p.display_name ?? p.name }} — {{ priceLabel(p) }}</option>
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

    <!-- Reset Password drawer -->
    @if (showReset()) {
      <div class="overlay" (click)="closeReset()"></div>
      <div class="drawer">
        <div class="drawer-header">
          <div>
            <h2>Reset Staff Password</h2>
            <p class="drawer-sub">{{ resetSchool()?.name }}</p>
          </div>
          <button class="icon-btn" (click)="closeReset()"><mat-icon>close</mat-icon></button>
        </div>

        @if (resetError()) {
          <div class="err-banner sm"><mat-icon>error_outline</mat-icon> {{ resetError() }}</div>
        }

        <div class="drawer-form">
          @if (adminsLoading()) {
            <div class="spinner-wrap"><mat-spinner diameter="28" /></div>
          } @else if (schoolAdmins().length === 0) {
            <div class="empty">
              <mat-icon>person_off</mat-icon>
              <p>No owner or principal accounts found.</p>
            </div>
          } @else {
            <div class="field">
              <label>Select Staff Account <span class="req">*</span></label>
              <select [value]="selectedAdmin()" (change)="selectedAdmin.set($any($event.target).value)">
                <option value="">Choose an account…</option>
                @for (a of schoolAdmins(); track a.id) {
                  <option [value]="a.id">{{ a.first_name }} {{ a.last_name }} ({{ a.role }}) — {{ a.email }}</option>
                }
              </select>
            </div>

            <div class="field">
              <label>New Password <span class="req">*</span></label>
              <div class="pw-wrap">
                <input [type]="showResetPw() ? 'text' : 'password'" [value]="newPassword()"
                       (input)="newPassword.set($any($event.target).value)"
                       placeholder="Min 8 characters" />
                <button type="button" class="pw-toggle" (click)="showResetPw.set(!showResetPw())">
                  <mat-icon>{{ showResetPw() ? 'visibility_off' : 'visibility' }}</mat-icon>
                </button>
              </div>
            </div>
          }
        </div>

        <div class="drawer-footer">
          <button class="btn-ghost" (click)="closeReset()">Cancel</button>
          <button class="btn-primary"
                  [disabled]="!selectedAdmin() || newPassword().length < 8 || resetSaving()"
                  (click)="submitReset()">
            @if (resetSaving()) { <mat-spinner diameter="14" /> }
            Reset Password
          </button>
        </div>
      </div>
    }

    <!-- Plan & billing drawer -->
    @if (subSchool(); as sch) {
      <div class="overlay" (click)="closeSubscription()"></div>
      <div class="drawer">
        <div class="drawer-header">
          <div>
            <h2>Plan &amp; billing</h2>
            <p class="drawer-sub">{{ sch.name }} · {{ sch.student_count }} active students · {{ sch.ai_generations_month }} AI generations this month</p>
          </div>
          <button class="icon-btn" (click)="closeSubscription()"><mat-icon>close</mat-icon></button>
        </div>
        @if (subError()) {
          <div class="err-banner sm"><mat-icon>error_outline</mat-icon> {{ subError() }}</div>
        }
        <form [formGroup]="subForm" class="drawer-form">
          <div class="field">
            <label>Plan</label>
            <select formControlName="plan_id">
              @for (p of subPlanOptions(); track p.id) {
                <option [value]="p.id">{{ p.display_name ?? p.name }} — {{ priceLabel(p) }}{{ p.is_archived ? ' (archived)' : '' }}</option>
              }
            </select>
          </div>
          <div class="row-2">
            <div class="field">
              <label>Status</label>
              <select formControlName="plan_status">
                <option value="trial">Trial</option>
                <option value="active">Active</option>
                <option value="overdue">Overdue</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
            <div class="field">
              <label>Discount (%)</label>
              <input formControlName="discount_pct" type="number" min="0" max="100" />
            </div>
          </div>
          <div class="row-2">
            <div class="field"><label>Started on</label><input formControlName="plan_started_on" type="date" /></div>
            <div class="field"><label>Renews on</label><input formControlName="renews_on" type="date" /></div>
          </div>
          @if (subForm.value.plan_status === 'trial') {
            <div class="field"><label>Trial ends on</label><input formControlName="trial_ends_on" type="date" /></div>
          }
          <div class="field">
            <label>Billing notes</label>
            <textarea formControlName="billing_notes" rows="3" placeholder="Invoice no., payment mode, agreed terms…"></textarea>
          </div>
          <div class="estimate">
            <div class="est-label">Estimated annual charge</div>
            <div class="est-value">{{ subEstimate() != null ? '₹' + (subEstimate() | number) : '—' }}</div>
            <div class="est-hint">At {{ sch.student_count }} active students, after discount</div>
          </div>
          @if (sch.warnings.length) {
            <div class="warn-list">
              @for (w of sch.warnings; track w.code) {
                <div class="warn" [class]="'warn ' + w.severity"><mat-icon>{{ w.severity === 'info' ? 'info' : 'warning' }}</mat-icon>{{ w.message }}</div>
              }
            </div>
          }
        </form>
        <div class="drawer-footer">
          <button class="btn-ghost" (click)="closeSubscription()">Cancel</button>
          <button class="btn-primary" [disabled]="subForm.invalid || subSaving()" (click)="saveSubscription()">
            @if (subSaving()) { <mat-spinner diameter="14" /> }
            Save
          </button>
        </div>
      </div>
    }

    <!-- Owners drawer -->
    @if (showOwners()) {
      <div class="overlay" (click)="closeOwners()"></div>
      <div class="drawer">
        <div class="drawer-header">
          <div>
            <h2>Owners</h2>
            <p class="drawer-sub">{{ ownersSchool()?.name }}</p>
          </div>
          <button class="icon-btn" (click)="closeOwners()"><mat-icon>close</mat-icon></button>
        </div>

        @if (ownersError()) {
          <div class="err-banner sm"><mat-icon>error_outline</mat-icon> {{ ownersError() }}</div>
        }

        <div class="drawer-form">
          @if (ownerMode() === 'list') {
            @if (ownersLoading()) {
              <div class="spinner-wrap"><mat-spinner diameter="28" /></div>
            } @else if (owners().length === 0) {
              <div class="empty">
                <mat-icon>person_off</mat-icon>
                <p>No owner accounts yet.</p>
              </div>
            } @else {
              <div class="owner-list">
                @for (o of owners(); track o.id) {
                  <div class="owner" [class.off]="!o.is_active">
                    <div class="owner-main">
                      <div class="owner-name">
                        {{ o.first_name }} {{ o.last_name }}
                        @if (o.is_primary) { <span class="pill primary">Primary contact</span> }
                        @if (!o.is_active) { <span class="pill off">Inactive</span> }
                      </div>
                      <div class="owner-meta">{{ o.email }}@if (o.phone) { · {{ o.phone }} }</div>
                    </div>
                    <div class="owner-actions">
                      <button class="icon-btn" title="Edit" (click)="editOwner(o)"><mat-icon>edit</mat-icon></button>
                      <button class="icon-btn danger" title="Delete" (click)="deleteOwner(o)"><mat-icon>delete</mat-icon></button>
                    </div>
                  </div>
                }
              </div>
            }
          } @else {
            <form [formGroup]="ownerForm" class="owner-form" (ngSubmit)="saveOwner()">
              <div class="section-label">{{ ownerMode() === 'add' ? 'New owner' : 'Edit owner' }}</div>
              <div class="row-2">
                <div class="field">
                  <label>First name <span class="req">*</span></label>
                  <input formControlName="first_name" placeholder="Priya" />
                </div>
                <div class="field">
                  <label>Last name</label>
                  <input formControlName="last_name" placeholder="Sharma" />
                </div>
              </div>
              <div class="field">
                <label>Email (login) <span class="req">*</span></label>
                <input formControlName="email" type="email" placeholder="priya@school.com" />
              </div>
              <div class="field">
                <label>Phone</label>
                <input formControlName="phone" placeholder="+91 98765 43210" />
              </div>
              @if (ownerMode() === 'add') {
                <div class="field">
                  <label>Password <span class="req">*</span></label>
                  <div class="pw-wrap">
                    <input formControlName="password" [type]="showOwnerPw() ? 'text' : 'password'" placeholder="Min 8 characters" />
                    <button type="button" class="pw-toggle" (click)="showOwnerPw.set(!showOwnerPw())">
                      <mat-icon>{{ showOwnerPw() ? 'visibility_off' : 'visibility' }}</mat-icon>
                    </button>
                  </div>
                </div>
              } @else {
                <label class="check">
                  <input type="checkbox" formControlName="is_active" /> Active (can log in)
                </label>
                <span class="hint">To change the password, use the key button on the school row.</span>
              }
            </form>
          }
        </div>

        <div class="drawer-footer">
          @if (ownerMode() === 'list') {
            <button class="btn-ghost" (click)="closeOwners()">Close</button>
            <button class="btn-primary" (click)="addOwner()"><mat-icon>person_add</mat-icon> Add owner</button>
          } @else {
            <button class="btn-ghost" (click)="ownerMode.set('list')">Cancel</button>
            <button class="btn-primary" [disabled]="ownerForm.invalid || ownerSaving()" (click)="saveOwner()">
              @if (ownerSaving()) { <mat-spinner diameter="14" /> }
              {{ ownerMode() === 'add' ? 'Add owner' : 'Save changes' }}
            </button>
          }
        </div>
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
    .pg { padding: 32px; max-width: 1480px; }
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

    .card { background: #fff; border: 1px solid #E2E8F0; border-radius: 12px; overflow-x: auto; }
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
    .actions { text-align: right; white-space: nowrap; width: 1%; }
    .nowrap { white-space: nowrap; }
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
    .drawer-sub { margin: 2px 0 0; font-size: 12px; color: #64748B; }
    .drawer-form { padding: 24px; display: flex; flex-direction: column; gap: 14px; flex: 1; }
    .drawer-footer {
      display: flex; justify-content: flex-end; gap: 10px;
      padding: 16px 24px; border-top: 1px solid #E2E8F0;
      position: sticky; bottom: 0; background: #fff;
    }
    .section-label { font-size: 11px; font-weight: 700; color: #94A3B8; text-transform: uppercase; letter-spacing: .06em; }
    .row-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; align-items: start; }
    .field { display: flex; flex-direction: column; gap: 5px; }
    .field label { font-size: 12px; font-weight: 500; color: #475569; }
    .field input, .field select {
      box-sizing: border-box; width: 100%; height: 38px; border: 1px solid #E2E8F0; border-radius: 8px;
      padding: 0 12px; font: inherit; font-size: 13px; color: #0F172A; background-color: #fff;
      &:focus { outline: none; border-color: #3B82F6; box-shadow: 0 0 0 3px rgba(59,130,246,.1); }
    }
    .field select { appearance: none; -webkit-appearance: none; padding-right: 34px; cursor: pointer;
      background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20' fill='%2364748B'%3E%3Cpath d='M5.3 7.3a1 1 0 011.4 0L10 10.6l3.3-3.3a1 1 0 111.4 1.4l-4 4a1 1 0 01-1.4 0l-4-4a1 1 0 010-1.4z'/%3E%3C/svg%3E");
      background-repeat: no-repeat; background-position: right 10px center; background-size: 16px; }
    .field input[type=number] { -moz-appearance: textfield; }
    .field input[type=number]::-webkit-inner-spin-button,
    .field input[type=number]::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
    .hint { font-size: 11px; color: #94A3B8; }
    .req  { color: #EF4444; }
    .pw-wrap { position: relative; }
    .pw-wrap input { padding-right: 40px; width: 100%; box-sizing: border-box; }
    .pw-toggle {
      position: absolute; right: 10px; top: 50%; transform: translateY(-50%);
      background: none; border: none; cursor: pointer; color: #94A3B8; display: flex;
      mat-icon { font-size: 18px; }
    }

    /* Plan & billing */
    .plan-cell { font-weight: 500; white-space: nowrap; }
    .sub-status { display: inline-block; margin-top: 3px; font-size: 10px; font-weight: 700; text-transform: uppercase;
      letter-spacing: .04em; padding: 1px 7px; border-radius: 20px; background: #E2E8F0; color: #475569;
      &.active { background: #D1FAE5; color: #065F46; } &.trial { background: #DBEAFE; color: #1D4ED8; }
      &.overdue { background: #FEF3C7; color: #92400E; } &.cancelled { background: #FEE2E2; color: #991B1B; } }
    .warn-dot { display: inline-flex; vertical-align: middle; margin-left: 4px; color: #D97706; cursor: help;
      mat-icon { font-size: 16px; width: 16px; height: 16px; } &.critical { color: #DC2626; } }
    .est { white-space: nowrap; font-weight: 600; }
    textarea { border: 1px solid #E2E8F0; border-radius: 8px; padding: 9px 12px; font: inherit; font-size: 13px; resize: vertical; }
    .estimate { background: #EFF6FF; border-radius: 10px; padding: 14px 16px; }
    .est-label { font-size: 11px; font-weight: 700; color: #1D4ED8; text-transform: uppercase; letter-spacing: .05em; }
    .est-value { font-size: 24px; font-weight: 800; color: #0F172A; margin-top: 2px; }
    .est-hint { font-size: 12px; color: #64748B; }
    .warn-list { display: flex; flex-direction: column; gap: 6px; }
    .warn { display: flex; align-items: center; gap: 8px; font-size: 12.5px; padding: 8px 10px; border-radius: 8px;
      mat-icon { font-size: 16px; width: 16px; height: 16px; }
      &.info { background: #F1F5F9; color: #334155; } &.warning { background: #FFFBEB; color: #92400E; }
      &.critical { background: #FEF2F2; color: #B91C1C; } }

    /* Owners */
    .owner-list { display: flex; flex-direction: column; gap: 8px; }
    .owner {
      display: flex; align-items: center; justify-content: space-between; gap: 12px;
      border: 1px solid #E2E8F0; border-radius: 10px; padding: 12px 14px;
      &.off { background: #F8FAFC; .owner-name, .owner-meta { color: #94A3B8; } }
    }
    .owner-main { min-width: 0; }
    .owner-name { font-size: 14px; font-weight: 600; color: #0F172A; display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
    .owner-meta { font-size: 12px; color: #64748B; margin-top: 2px; overflow-wrap: anywhere; }
    .owner-actions { display: flex; gap: 2px; flex: none; }
    .pill { font-size: 10px; font-weight: 700; padding: 2px 8px; border-radius: 20px;
      &.primary { background: #DBEAFE; color: #1D4ED8; }
      &.off     { background: #E2E8F0; color: #475569; }
    }
    .owner-form { display: flex; flex-direction: column; gap: 14px; }
    .check { display: flex; align-items: center; gap: 8px; font-size: 13px; color: #334155; }

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

  // Reset password drawer
  showReset     = signal(false);
  resetSchool   = signal<School | null>(null);
  schoolAdmins  = signal<StaffAdmin[]>([]);
  adminsLoading = signal(false);
  selectedAdmin = signal('');
  newPassword   = signal('');
  showResetPw   = signal(false);
  resetSaving   = signal(false);
  resetError    = signal('');

  // Plan & billing drawer
  allPlans   = signal<Plan[]>([]);
  subSchool  = signal<School | null>(null);
  subSaving  = signal(false);
  subError   = signal('');
  subForm = this.fb.group({
    plan_id:         ['', Validators.required],
    plan_status:     ['active' as School['plan_status']],
    plan_started_on: [''],
    renews_on:       [''],
    trial_ends_on:   [''],
    discount_pct:    [0 as number | null, [Validators.min(0), Validators.max(100)]],
    billing_notes:   [''],
  });
  private subFormValue = signal(this.subForm.getRawValue());

  /** Offered plans, plus the school's current plan even if archived. */
  subPlanOptions = computed(() => {
    const current = this.subSchool()?.subscription_plan_id;
    return this.allPlans().filter(p => !p.is_archived || p.id === current);
  });

  subEstimate = computed(() => {
    const v = this.subFormValue();
    const school = this.subSchool();
    const plan = this.allPlans().find(p => p.id === v.plan_id);
    if (!school || !plan) return null;
    const periods = plan.billing_period === 'monthly' ? 12 : 1;
    const base = plan.pricing_model === 'per_student' ? Number(plan.price_inr) * school.student_count : Number(plan.price_inr);
    const perPeriod = Math.max(Number(plan.min_charge_inr), base);
    return Math.round(perPeriod * periods * (1 - Number(v.discount_pct ?? 0) / 100));
  });

  priceLabel = planPriceLabel;

  hasCritical(s: School) { return s.warnings.some(w => w.severity === 'critical'); }
  warningText(s: School) { return s.warnings.map(w => w.message).join('\n'); }

  // Owners drawer
  showOwners    = signal(false);
  ownersSchool  = signal<School | null>(null);
  owners        = signal<Owner[]>([]);
  ownersLoading = signal(false);
  ownersError   = signal('');
  ownerMode     = signal<'list' | 'add' | 'edit'>('list');
  editingOwner  = signal<Owner | null>(null);
  ownerSaving   = signal(false);
  showOwnerPw   = signal(false);

  ownerForm = this.fb.group({
    first_name: ['', [Validators.required, Validators.minLength(2)]],
    last_name:  [''],
    email:      ['', [Validators.required, Validators.email]],
    phone:      [''],
    password:   [''],
    is_active:  [true],
  });

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
    this.subForm.valueChanges.subscribe(() => this.subFormValue.set(this.subForm.getRawValue()));
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

  openResetPassword(school: School) {
    this.resetSchool.set(school);
    this.selectedAdmin.set('');
    this.newPassword.set('');
    this.showResetPw.set(false);
    this.resetError.set('');
    this.showReset.set(true);
    this.adminsLoading.set(true);
    this.http.get<{ data: StaffAdmin[] }>(
      `${environment.apiUrl}/platform/tenants/${school.id}/admins`,
      { headers: this.headers() }
    ).subscribe({
      next: res => { this.schoolAdmins.set(res.data); this.adminsLoading.set(false); },
      error: () => { this.resetError.set('Failed to load staff accounts'); this.adminsLoading.set(false); },
    });
  }

  closeReset() {
    this.showReset.set(false);
    this.resetSchool.set(null);
    this.schoolAdmins.set([]);
  }

  submitReset() {
    if (!this.selectedAdmin() || this.newPassword().length < 8) return;
    this.resetSaving.set(true);
    this.resetError.set('');
    const school = this.resetSchool()!;
    this.http.post(
      `${environment.apiUrl}/platform/tenants/${school.id}/staff/${this.selectedAdmin()}/reset-password`,
      { password: this.newPassword() },
      { headers: this.headers() }
    ).subscribe({
      next: () => {
        this.resetSaving.set(false);
        this.closeReset();
        this.showToast('Password reset successfully');
      },
      error: e => {
        this.resetError.set(e?.error?.error?.message ?? 'Failed to reset password');
        this.resetSaving.set(false);
      },
    });
  }

  openSubscription(school: School) {
    this.subError.set('');
    const d = (x: string | null) => (x ? String(x).slice(0, 10) : '');
    this.subForm.reset({
      plan_id: school.subscription_plan_id ?? '', plan_status: school.plan_status,
      plan_started_on: d(school.plan_started_on), renews_on: d(school.renews_on), trial_ends_on: d(school.trial_ends_on),
      discount_pct: Number(school.discount_pct ?? 0), billing_notes: school.billing_notes ?? '',
    });
    this.subFormValue.set(this.subForm.getRawValue());
    this.subSchool.set(school);
    if (!this.allPlans().length) {
      this.http.get<{ data: Plan[] }>(`${environment.apiUrl}/platform/plans/all`, { headers: this.headers() })
        .subscribe({ next: res => this.allPlans.set(res.data) });
    }
  }

  closeSubscription() { this.subSchool.set(null); }

  saveSubscription() {
    const school = this.subSchool();
    if (!school || this.subForm.invalid) return;
    const v = this.subForm.getRawValue();
    const body = {
      plan_id: v.plan_id, plan_status: v.plan_status,
      plan_started_on: v.plan_started_on || null, renews_on: v.renews_on || null,
      trial_ends_on: v.plan_status === 'trial' ? (v.trial_ends_on || null) : null,
      discount_pct: Number(v.discount_pct ?? 0), billing_notes: v.billing_notes || null,
    };
    this.subSaving.set(true);
    this.subError.set('');
    this.http.put<{ message: string }>(
      `${environment.apiUrl}/platform/tenants/${school.id}/subscription`, body, { headers: this.headers() }
    ).subscribe({
      next: res => { this.subSaving.set(false); this.closeSubscription(); this.loadAll(); this.showToast(res.message); },
      error: e => { this.subSaving.set(false); this.subError.set(e?.error?.error?.message ?? 'Failed to save'); },
    });
  }

  openOwners(school: School) {
    this.ownersSchool.set(school);
    this.ownersError.set('');
    this.ownerMode.set('list');
    this.showOwners.set(true);
    this.loadOwners();
  }

  closeOwners() {
    this.showOwners.set(false);
    this.ownersSchool.set(null);
    this.owners.set([]);
  }

  private ownersUrl(staffId?: string) {
    const base = `${environment.apiUrl}/platform/tenants/${this.ownersSchool()!.id}/owners`;
    return staffId ? `${base}/${staffId}` : base;
  }

  private loadOwners() {
    this.ownersLoading.set(true);
    this.http.get<{ data: Owner[] }>(this.ownersUrl(), { headers: this.headers() }).subscribe({
      next: res => { this.owners.set(res.data); this.ownersLoading.set(false); },
      error: e => { this.ownersError.set(e?.error?.error?.message ?? 'Failed to load owners'); this.ownersLoading.set(false); },
    });
  }

  addOwner() {
    this.editingOwner.set(null);
    this.ownerForm.reset({ first_name: '', last_name: '', email: '', phone: '', password: '', is_active: true });
    this.ownerForm.controls.password.setValidators([Validators.required, Validators.minLength(8)]);
    this.ownerForm.controls.password.updateValueAndValidity();
    this.showOwnerPw.set(false);
    this.ownersError.set('');
    this.ownerMode.set('add');
  }

  editOwner(o: Owner) {
    this.editingOwner.set(o);
    this.ownerForm.reset({
      first_name: o.first_name, last_name: o.last_name, email: o.email,
      phone: o.phone ?? '', password: '', is_active: o.is_active,
    });
    this.ownerForm.controls.password.clearValidators();
    this.ownerForm.controls.password.updateValueAndValidity();
    this.ownersError.set('');
    this.ownerMode.set('edit');
  }

  saveOwner() {
    if (this.ownerForm.invalid) return;
    const v = this.ownerForm.getRawValue();
    const adding = this.ownerMode() === 'add';
    const body = adding
      ? { first_name: v.first_name, last_name: v.last_name || undefined, email: v.email, phone: v.phone || undefined, password: v.password }
      : { first_name: v.first_name, last_name: v.last_name ?? '', email: v.email, phone: v.phone || null, is_active: !!v.is_active };
    const req = adding
      ? this.http.post<{ message: string }>(this.ownersUrl(), body, { headers: this.headers() })
      : this.http.put<{ message: string }>(this.ownersUrl(this.editingOwner()!.id), body, { headers: this.headers() });
    this.ownerSaving.set(true);
    this.ownersError.set('');
    req.subscribe({
      next: res => {
        this.ownerSaving.set(false);
        this.ownerMode.set('list');
        this.loadOwners();
        this.showToast(res.message);
      },
      error: e => {
        this.ownersError.set(e?.error?.error?.message ?? 'Failed to save owner');
        this.ownerSaving.set(false);
      },
    });
  }

  deleteOwner(o: Owner) {
    if (!confirm(`Delete owner ${o.first_name} ${o.last_name} (${o.email})?\n\nIf this owner has school records, the account is deactivated instead.`)) return;
    this.ownersError.set('');
    this.http.delete<{ message: string }>(this.ownersUrl(o.id), { headers: this.headers() }).subscribe({
      next: res => { this.loadOwners(); this.showToast(res.message); },
      error: e => this.ownersError.set(e?.error?.error?.message ?? 'Failed to delete owner'),
    });
  }

  private showToast(msg: string) {
    this.successMsg.set(msg);
    setTimeout(() => this.successMsg.set(''), 3500);
  }
}
