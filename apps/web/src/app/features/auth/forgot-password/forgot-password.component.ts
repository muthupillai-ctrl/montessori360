import { Component, signal, inject } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ApiService } from '../../../core/services/api.service';

@Component({
  selector: 'app-forgot-password',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, MatIconModule, MatProgressSpinnerModule],
  template: `
    <div class="auth-page">
      <div class="card">

        <div class="brand">
          <div class="logo">M</div>
          <div class="brand-name">Montessori360</div>
        </div>

        @if (!sent()) {
          <h1 class="title">Forgot password?</h1>
          <p class="sub">Enter your email and school code. We'll send a reset link if the account exists.</p>

          <form [formGroup]="form" (ngSubmit)="submit()">
            <div class="field">
              <label>Email</label>
              <div class="input-wrap" [class.error]="form.get('email')?.invalid && form.get('email')?.touched">
                <mat-icon class="ico">mail_outline</mat-icon>
                <input formControlName="email" type="email" placeholder="you@school.com" autocomplete="email" />
              </div>
              @if (form.get('email')?.hasError('required') && form.get('email')?.touched) {
                <span class="err">Email is required</span>
              }
              @if (form.get('email')?.hasError('email') && form.get('email')?.touched) {
                <span class="err">Enter a valid email</span>
              }
            </div>

            <div class="field">
              <label>School code</label>
              <div class="input-wrap" [class.error]="form.get('tenantCode')?.invalid && form.get('tenantCode')?.touched">
                <mat-icon class="ico">business</mat-icon>
                <input formControlName="tenantCode" type="text" placeholder="e.g. springdale" autocomplete="off" />
              </div>
              @if (form.get('tenantCode')?.invalid && form.get('tenantCode')?.touched) {
                <span class="err">School code is required</span>
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
                <mat-progress-spinner diameter="18" mode="indeterminate"
                  style="--mdc-circular-progress-active-indicator-color:#fff" />
              } @else {
                Send reset link
              }
            </button>
          </form>
        } @else {
          <div class="success-state">
            <div class="success-icon">
              <mat-icon>mark_email_read</mat-icon>
            </div>
            <h1 class="title">Check your inbox</h1>
            <p class="sub">
              If an account exists for <strong>{{ form.get('email')?.value }}</strong>,
              a reset link has been sent. It expires in 1 hour.
            </p>
          </div>
        }

        <a routerLink="/login" class="back-link">
          <mat-icon style="font-size:16px;width:16px;height:16px">arrow_back</mat-icon>
          Back to sign in
        </a>
      </div>
    </div>
  `,
  styles: [`
    .auth-page {
      min-height: 100vh; display: flex; align-items: center; justify-content: center;
      background: #f8fafc; padding: 24px;
    }
    .card {
      width: 100%; max-width: 420px; background: #fff; border-radius: 16px;
      padding: 36px 32px; box-shadow: 0 4px 24px rgba(0,0,0,.08);
    }
    .brand { display: flex; align-items: center; gap: 10px; margin-bottom: 28px; }
    .logo {
      width: 36px; height: 36px; border-radius: 10px; background: #2563EB; color: #fff;
      font-size: 18px; font-weight: 800; display: flex; align-items: center; justify-content: center;
    }
    .brand-name { font-size: 17px; font-weight: 800; color: #1e293b; }
    .title { font-size: 22px; font-weight: 800; color: #1e293b; margin: 0 0 8px; }
    .sub   { font-size: 14px; color: #64748b; line-height: 1.6; margin: 0 0 24px; }
    .field { display: flex; flex-direction: column; gap: 6px; margin-bottom: 16px; }
    label  { font-size: 13px; font-weight: 600; color: #374151; }
    .input-wrap {
      display: flex; align-items: center; gap: 8px;
      border: 1.5px solid #e2e8f0; border-radius: 10px; padding: 0 12px;
      background: #f8fafc; transition: border-color .15s;
      &:focus-within { border-color: #2563EB; background: #fff; }
      &.error { border-color: #ef4444; }
    }
    .ico { font-size: 18px; width: 18px; height: 18px; color: #94a3b8; flex-shrink: 0; }
    input {
      flex: 1; border: none; background: transparent; padding: 12px 0;
      font-size: 14px; color: #1e293b; outline: none;
      &::placeholder { color: #94a3b8; }
    }
    .err { font-size: 12px; color: #ef4444; }
    .error-banner {
      display: flex; align-items: center; gap: 8px; background: #fef2f2;
      border: 1px solid #fecaca; border-radius: 8px; padding: 10px 12px;
      margin-bottom: 16px; font-size: 13px; color: #dc2626;
    }
    .submit-btn {
      width: 100%; padding: 13px; border: none; border-radius: 10px;
      background: #2563EB; color: #fff; font-size: 15px; font-weight: 700;
      cursor: pointer; display: flex; align-items: center; justify-content: center;
      gap: 8px; transition: background .15s; margin-bottom: 20px;
      &:hover:not(:disabled) { background: #1d4ed8; }
      &:disabled { opacity: .6; cursor: not-allowed; }
    }
    .success-state { text-align: center; padding: 8px 0 20px; }
    .success-icon {
      width: 64px; height: 64px; border-radius: 50%; background: #dcfce7;
      display: flex; align-items: center; justify-content: center; margin: 0 auto 20px;
      mat-icon { font-size: 32px; width: 32px; height: 32px; color: #16a34a; }
    }
    .back-link {
      display: flex; align-items: center; justify-content: center; gap: 4px;
      font-size: 13px; font-weight: 600; color: #2563EB; text-decoration: none;
      &:hover { text-decoration: underline; }
    }
  `],
})
export class ForgotPasswordComponent {
  private fb  = inject(FormBuilder);
  private api = inject(ApiService);

  form = this.fb.group({
    email:      ['', [Validators.required, Validators.email]],
    tenantCode: ['', Validators.required],
  });

  loading = signal(false);
  error   = signal('');
  sent    = signal(false);

  submit() {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    this.loading.set(true);
    this.error.set('');
    this.api.post<any>('/auth/forgot-password', this.form.value).subscribe({
      next: () => { this.loading.set(false); this.sent.set(true); },
      error: (err: any) => {
        this.loading.set(false);
        this.error.set(err?.error?.error?.message ?? 'Something went wrong. Try again.');
      },
    });
  }
}
