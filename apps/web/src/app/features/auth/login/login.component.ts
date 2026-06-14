import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    MatFormFieldModule, MatInputModule,
    MatButtonModule, MatIconModule, MatProgressSpinnerModule,
  ],
  template: `
    <div class="login-root">

      <!-- Left panel -->
      <div class="login-left">
        <div class="brand">
          <div class="brand-icon">M</div>
          <div class="brand-text">
            <div class="brand-name">Montessori360</div>
            <div class="brand-tagline">School Management Platform</div>
          </div>
        </div>

        <div class="hero-text">
          <h1>Manage your school<br>with confidence.</h1>
          <p>Everything you need to run a modern Montessori school — students, attendance, fees, staff, and more.</p>
        </div>

        <div class="feature-list">
          @for (f of features; track f.label) {
            <div class="feature-item">
              <div class="fi-icon">
                <mat-icon style="font-size:16px;width:16px;height:16px">{{ f.icon }}</mat-icon>
              </div>
              <span>{{ f.label }}</span>
            </div>
          }
        </div>

        <div class="left-footer">Powered by Ahamsys Consultancy Pvt Ltd</div>
      </div>

      <!-- Right panel -->
      <div class="login-right">
        <div class="login-card">

          <div class="card-header">
            <h2>Welcome back</h2>
            <p>Sign in to your admin portal</p>
          </div>

          <form [formGroup]="form" (ngSubmit)="submit()" class="login-form">

            <div class="field-group">
              <label class="field-label">School Code</label>
              <div class="input-wrap" [class.focused]="focused === 'school'" [class.error]="form.get('tenantCode')?.invalid && form.get('tenantCode')?.touched">
                <mat-icon class="input-icon">apartment</mat-icon>
                <input formControlName="tenantCode"
                       placeholder="e.g. testschool"
                       (focus)="focused = 'school'"
                       (blur)="focused = ''"
                       autocomplete="organization" />
              </div>
              @if (form.get('tenantCode')?.invalid && form.get('tenantCode')?.touched) {
                <div class="field-error">School code is required</div>
              }
            </div>

            <div class="field-group">
              <label class="field-label">Email Address</label>
              <div class="input-wrap" [class.focused]="focused === 'email'" [class.error]="form.get('email')?.invalid && form.get('email')?.touched">
                <mat-icon class="input-icon">mail_outline</mat-icon>
                <input formControlName="email"
                       type="email"
                       placeholder="admin@yourschool.in"
                       (focus)="focused = 'email'"
                       (blur)="focused = ''"
                       autocomplete="email" />
              </div>
              @if (form.get('email')?.hasError('required') && form.get('email')?.touched) {
                <div class="field-error">Email is required</div>
              }
              @if (form.get('email')?.hasError('email') && form.get('email')?.touched) {
                <div class="field-error">Enter a valid email address</div>
              }
            </div>

            <div class="field-group">
              <div style="display:flex;justify-content:space-between;align-items:center">
                <label class="field-label">Password</label>
                <a class="forgot-link">Forgot password?</a>
              </div>
              <div class="input-wrap" [class.focused]="focused === 'pw'" [class.error]="form.get('password')?.invalid && form.get('password')?.touched">
                <mat-icon class="input-icon">lock_outline</mat-icon>
                <input formControlName="password"
                       [type]="showPw() ? 'text' : 'password'"
                       placeholder="••••••••"
                       (focus)="focused = 'pw'"
                       (blur)="focused = ''"
                       autocomplete="current-password" />
                <button type="button" class="pw-toggle" (click)="showPw.set(!showPw())">
                  <mat-icon style="font-size:16px;width:16px;height:16px">{{ showPw() ? 'visibility_off' : 'visibility' }}</mat-icon>
                </button>
              </div>
              @if (form.get('password')?.invalid && form.get('password')?.touched) {
                <div class="field-error">Password is required</div>
              }
            </div>

            @if (error()) {
              <div class="error-banner">
                <mat-icon style="font-size:16px;width:16px;height:16px;flex-shrink:0">error_outline</mat-icon>
                {{ error() }}
              </div>
            }

            <button type="submit" class="submit-btn" [disabled]="loading()">
              @if (loading()) {
                <mat-progress-spinner diameter="18" mode="indeterminate" style="--mdc-circular-progress-active-indicator-color:#fff" />
              } @else {
                <ng-container>Sign in</ng-container>
              }
            </button>

          </form>

        </div>

        <div class="right-footer">© 2026 Montessori360. All rights reserved.</div>
      </div>

    </div>
  `,
  styles: [`
    .login-root {
      min-height: 100vh;
      display: flex;
      background: #F4F5F7;
    }

    /* ── Left panel ── */
    .login-left {
      width: 420px;
      background: #1E3A5F;
      padding: 40px 44px;
      display: flex;
      flex-direction: column;
      flex-shrink: 0;
      position: relative;
      overflow: hidden;

      &::after {
        content: '';
        position: absolute;
        bottom: -80px; right: -80px;
        width: 300px; height: 300px;
        border-radius: 50%;
        background: rgba(255,255,255,.04);
      }
    }

    .brand {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 56px;
    }
    .brand-icon {
      width: 40px; height: 40px;
      border-radius: 10px;
      background: #2563EB;
      color: #fff;
      font-size: 18px; font-weight: 700;
      display: flex; align-items: center; justify-content: center;
    }
    .brand-name    { font-size: 16px; font-weight: 600; color: #fff; }
    .brand-tagline { font-size: 11px; color: rgba(255,255,255,.5); margin-top: 2px; }

    .hero-text {
      margin-bottom: 36px;
      h1 {
        font-size: 28px;
        font-weight: 600;
        color: #fff;
        line-height: 1.25;
        letter-spacing: -.5px;
        margin: 0 0 14px;
      }
      p {
        font-size: 13px;
        color: rgba(255,255,255,.6);
        line-height: 1.7;
        margin: 0;
      }
    }

    .feature-list { display: flex; flex-direction: column; gap: 10px; flex: 1; }
    .feature-item {
      display: flex;
      align-items: center;
      gap: 10px;
      font-size: 13px;
      color: rgba(255,255,255,.8);
    }
    .fi-icon {
      width: 28px; height: 28px;
      border-radius: 7px;
      background: rgba(255,255,255,.1);
      display: flex; align-items: center; justify-content: center;
      color: rgba(255,255,255,.8);
      flex-shrink: 0;
    }

    .left-footer {
      font-size: 11px;
      color: rgba(255,255,255,.3);
      margin-top: 40px;
    }

    /* ── Right panel ── */
    .login-right {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 40px 24px;
      gap: 20px;
    }

    .login-card {
      width: 100%;
      max-width: 400px;
      background: #fff;
      border: 1px solid #E5E7EB;
      border-radius: 14px;
      padding: 32px;
    }

    .card-header {
      margin-bottom: 28px;
      h2 { font-size: 20px; font-weight: 600; color: #111827; margin: 0 0 6px; letter-spacing: -.3px; }
      p  { font-size: 13px; color: #6B7280; margin: 0; }
    }

    .login-form { display: flex; flex-direction: column; gap: 16px; }

    .field-group { display: flex; flex-direction: column; gap: 5px; }

    .field-label {
      font-size: 12px;
      font-weight: 500;
      color: #374151;
    }

    .input-wrap {
      display: flex;
      align-items: center;
      gap: 8px;
      background: #F9FAFB;
      border: 1px solid #E5E7EB;
      border-radius: 8px;
      padding: 0 12px;
      height: 40px;
      transition: border-color .15s, box-shadow .15s;

      &.focused {
        border-color: #2563EB;
        box-shadow: 0 0 0 3px rgba(37,99,235,.1);
        background: #fff;
      }
      &.error {
        border-color: #EF4444;
        box-shadow: 0 0 0 3px rgba(239,68,68,.1);
      }

      .input-icon { font-size: 16px; width: 16px; height: 16px; color: #9CA3AF; flex-shrink: 0; }

      input {
        flex: 1;
        border: none;
        background: transparent;
        outline: none;
        font-size: 13px;
        color: #111827;
        &::placeholder { color: #9CA3AF; }
      }
    }

    .pw-toggle {
      background: none;
      border: none;
      padding: 0;
      cursor: pointer;
      color: #9CA3AF;
      display: flex;
      align-items: center;
      &:hover { color: #6B7280; }
    }

    .forgot-link {
      font-size: 11px;
      color: #2563EB;
      cursor: pointer;
      font-weight: 500;
      &:hover { text-decoration: underline; }
    }

    .field-error {
      font-size: 11px;
      color: #EF4444;
      margin-top: 2px;
    }

    .error-banner {
      display: flex;
      align-items: center;
      gap: 8px;
      background: #FEF2F2;
      border: 1px solid #FECACA;
      color: #991B1B;
      padding: 10px 12px;
      border-radius: 8px;
      font-size: 12.5px;
    }

    .submit-btn {
      width: 100%;
      height: 40px;
      background: #2563EB;
      color: #fff;
      border: none;
      border-radius: 8px;
      font-size: 13px;
      font-weight: 500;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      margin-top: 4px;
      transition: background .15s;

      &:hover:not(:disabled) { background: #1D4ED8; }
      &:disabled { opacity: .6; cursor: not-allowed; }
    }

    .right-footer {
      font-size: 11px;
      color: #9CA3AF;
    }

    @media (max-width: 768px) {
      .login-left { display: none; }
    }
  `],
})
export class LoginComponent {
  private fb     = inject(FormBuilder);
  private auth   = inject(AuthService);
  private router = inject(Router);

  showPw  = signal(false);
  loading = signal(false);
  error   = signal('');
  focused = '';

  features = [
    { icon: 'people',       label: 'Student enrolment & attendance' },
    { icon: 'payments',     label: 'Fee management & collections' },
    { icon: 'psychology',   label: 'Child development observations' },
    { icon: 'directions_bus', label: 'Transport & GPS tracking' },
    { icon: 'analytics',    label: 'Real-time analytics dashboard' },
  ];

  form = this.fb.nonNullable.group({
    tenantCode: ['testschool', Validators.required],
    email:      ['', [Validators.required, Validators.email]],
    password:   ['', Validators.required],
  });

  submit() {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    this.loading.set(true);
    this.error.set('');

    this.auth.login(this.form.getRawValue()).subscribe({
      next:  () => {
        const role = this.auth.userRole();
        this.router.navigate([role === 'driver' ? '/driver' : '/dashboard']);
      },
      error: (err) => {
        this.loading.set(false);
        this.error.set(err.error?.error?.message ?? 'Invalid credentials. Please try again.');
      },
    });
  }
}
