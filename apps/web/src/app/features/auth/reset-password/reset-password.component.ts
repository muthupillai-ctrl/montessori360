import { Component, signal, inject, OnInit } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators, AbstractControl, ValidationErrors } from '@angular/forms';
import { RouterLink, ActivatedRoute, Router } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ApiService } from '../../../core/services/api.service';

function passwordsMatch(control: AbstractControl): ValidationErrors | null {
  const pw  = control.get('password')?.value;
  const pw2 = control.get('confirmPassword')?.value;
  return pw && pw2 && pw !== pw2 ? { mismatch: true } : null;
}

@Component({
  selector: 'app-reset-password',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, MatIconModule, MatProgressSpinnerModule],
  template: `
    <div class="auth-page">
      <div class="card">

        <div class="brand">
          <div class="logo">M</div>
          <div class="brand-name">Montessori360</div>
        </div>

        @if (!token()) {
          <div class="invalid-state">
            <mat-icon class="invalid-icon">link_off</mat-icon>
            <h1 class="title">Invalid link</h1>
            <p class="sub">This reset link is missing or malformed.</p>
            <a routerLink="/forgot-password" class="submit-btn" style="text-decoration:none;display:flex;align-items:center;justify-content:center">
              Request a new link
            </a>
          </div>
        } @else if (!done()) {
          <h1 class="title">Set new password</h1>
          <p class="sub">Choose a strong password for your account.</p>

          <form [formGroup]="form" (ngSubmit)="submit()">
            <div class="field">
              <label>New password</label>
              <div class="input-wrap" [class.error]="form.get('password')?.invalid && form.get('password')?.touched">
                <mat-icon class="ico">lock_outline</mat-icon>
                <input formControlName="password"
                       [type]="showPw() ? 'text' : 'password'"
                       placeholder="At least 8 characters" />
                <button type="button" class="eye-btn" (click)="showPw.set(!showPw())">
                  <mat-icon style="font-size:16px;width:16px;height:16px">
                    {{ showPw() ? 'visibility_off' : 'visibility' }}
                  </mat-icon>
                </button>
              </div>
              @if (form.get('password')?.hasError('required') && form.get('password')?.touched) {
                <span class="err">Password is required</span>
              }
              @if (form.get('password')?.hasError('minlength') && form.get('password')?.touched) {
                <span class="err">Minimum 8 characters</span>
              }
            </div>

            <div class="field">
              <label>Confirm password</label>
              <div class="input-wrap" [class.error]="(form.get('confirmPassword')?.touched && form.hasError('mismatch'))">
                <mat-icon class="ico">lock_outline</mat-icon>
                <input formControlName="confirmPassword"
                       [type]="showPw() ? 'text' : 'password'"
                       placeholder="Repeat your password" />
              </div>
              @if (form.get('confirmPassword')?.touched && form.hasError('mismatch')) {
                <span class="err">Passwords do not match</span>
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
                Reset password
              }
            </button>
          </form>
        } @else {
          <div class="success-state">
            <div class="success-icon">
              <mat-icon>check_circle</mat-icon>
            </div>
            <h1 class="title">Password updated!</h1>
            <p class="sub">Your password has been reset. You can now sign in with your new password.</p>
            <a routerLink="/login" class="submit-btn" style="text-decoration:none;display:flex;align-items:center;justify-content:center">
              Go to sign in
            </a>
          </div>
        }

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
    .eye-btn {
      background: none; border: none; cursor: pointer; padding: 0;
      color: #94a3b8; display: flex; align-items: center;
      &:hover { color: #475569; }
    }
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
      gap: 8px; transition: background .15s; margin-bottom: 4px; box-sizing: border-box;
      &:hover:not(:disabled) { background: #1d4ed8; }
      &:disabled { opacity: .6; cursor: not-allowed; }
    }
    .invalid-state, .success-state { text-align: center; }
    .invalid-icon { font-size: 48px; width: 48px; height: 48px; color: #94a3b8; margin-bottom: 12px; }
    .success-icon {
      width: 64px; height: 64px; border-radius: 50%; background: #dcfce7;
      display: flex; align-items: center; justify-content: center; margin: 0 auto 20px;
      mat-icon { font-size: 32px; width: 32px; height: 32px; color: #16a34a; }
    }
  `],
})
export class ResetPasswordComponent implements OnInit {
  private fb    = inject(FormBuilder);
  private api   = inject(ApiService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  token = signal('');
  showPw = signal(false);
  loading = signal(false);
  error   = signal('');
  done    = signal(false);

  form = this.fb.group({
    password:        ['', [Validators.required, Validators.minLength(8)]],
    confirmPassword: ['', Validators.required],
  }, { validators: passwordsMatch });

  ngOnInit() {
    const t = this.route.snapshot.queryParamMap.get('token') ?? '';
    this.token.set(t);
  }

  submit() {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    this.loading.set(true);
    this.error.set('');
    this.api.post<any>('/auth/reset-password', {
      token:       this.token(),
      newPassword: this.form.get('password')!.value,
    }).subscribe({
      next: () => { this.loading.set(false); this.done.set(true); },
      error: (err: any) => {
        this.loading.set(false);
        this.error.set(err?.error?.error?.message ?? 'Link expired or invalid. Request a new one.');
      },
    });
  }
}
