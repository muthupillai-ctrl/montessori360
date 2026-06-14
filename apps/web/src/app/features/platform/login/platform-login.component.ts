import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { PlatformAuthService } from '../../../core/services/platform-auth.service';

@Component({
  selector: 'app-platform-login',
  standalone: true,
  imports: [ReactiveFormsModule, MatIconModule, MatProgressSpinnerModule],
  template: `
    <div class="pl-root">

      <div class="pl-card">
        <div class="pl-brand">
          <div class="pl-logo">M</div>
          <div>
            <div class="pl-brand-name">Montessori360</div>
            <div class="pl-brand-sub">Platform Administration</div>
          </div>
        </div>

        <h2 class="pl-title">Platform Admin Login</h2>
        <p class="pl-hint">This portal is for platform administrators only.</p>

        @if (error()) {
          <div class="pl-error">
            <mat-icon>error_outline</mat-icon> {{ error() }}
          </div>
        }

        <form [formGroup]="form" (ngSubmit)="submit()" class="pl-form">
          <div class="pl-field">
            <label>Email</label>
            <input formControlName="email" type="email" placeholder="admin@example.com" autocomplete="email" />
          </div>
          <div class="pl-field">
            <label>Password</label>
            <div class="pw-wrap">
              <input formControlName="password" [type]="showPw() ? 'text' : 'password'" placeholder="••••••••" autocomplete="current-password" />
              <button type="button" class="pw-toggle" (click)="showPw.set(!showPw())">
                <mat-icon>{{ showPw() ? 'visibility_off' : 'visibility' }}</mat-icon>
              </button>
            </div>
          </div>
          <button type="submit" class="pl-submit" [disabled]="form.invalid || loading()">
            @if (loading()) { <mat-spinner diameter="16" /> } Sign In
          </button>
        </form>

        <div class="pl-back">
          <a href="/login">← Back to school login</a>
        </div>
      </div>

    </div>
  `,
  styles: [`
    .pl-root {
      min-height: 100vh; display: flex; align-items: center; justify-content: center;
      background: #0F172A; padding: 24px;
    }
    .pl-card {
      background: #1E293B; border: 1px solid #334155;
      border-radius: 16px; padding: 40px; width: 100%; max-width: 420px;
    }
    .pl-brand { display: flex; align-items: center; gap: 12px; margin-bottom: 32px; }
    .pl-logo {
      width: 40px; height: 40px; border-radius: 10px;
      background: #3B82F6; color: #fff; font-size: 18px; font-weight: 700;
      display: flex; align-items: center; justify-content: center;
    }
    .pl-brand-name { font-size: 15px; font-weight: 700; color: #F1F5F9; }
    .pl-brand-sub  { font-size: 11px; color: #64748B; margin-top: 1px; }

    .pl-title { font-size: 20px; font-weight: 700; color: #F1F5F9; margin: 0 0 6px; }
    .pl-hint  { font-size: 13px; color: #64748B; margin: 0 0 24px; }

    .pl-error {
      display: flex; align-items: center; gap: 8px;
      background: rgba(239,68,68,.1); border: 1px solid rgba(239,68,68,.3);
      color: #FCA5A5; font-size: 13px; padding: 10px 14px; border-radius: 8px;
      margin-bottom: 16px;
      mat-icon { font-size: 16px; width: 16px; height: 16px; }
    }

    .pl-form { display: flex; flex-direction: column; gap: 16px; }
    .pl-field { display: flex; flex-direction: column; gap: 6px; }
    .pl-field label { font-size: 12px; font-weight: 500; color: #94A3B8; }
    .pl-field input {
      background: #0F172A; border: 1px solid #334155; border-radius: 8px;
      padding: 10px 12px; font-size: 14px; color: #F1F5F9; width: 100%;
      box-sizing: border-box;
      &:focus { outline: none; border-color: #3B82F6; }
    }
    .pw-wrap { position: relative; }
    .pw-wrap input { padding-right: 40px; }
    .pw-toggle {
      position: absolute; right: 10px; top: 50%; transform: translateY(-50%);
      background: none; border: none; cursor: pointer; color: #64748B; display: flex;
      mat-icon { font-size: 18px; }
    }

    .pl-submit {
      background: #3B82F6; color: #fff; border: none; border-radius: 8px;
      padding: 11px; font-size: 14px; font-weight: 600; cursor: pointer;
      display: flex; align-items: center; justify-content: center; gap: 8px;
      margin-top: 4px;
      &:disabled { opacity: .5; cursor: not-allowed; }
      &:not(:disabled):hover { background: #2563EB; }
    }

    .pl-back { text-align: center; margin-top: 20px;
      a { font-size: 12px; color: #64748B; text-decoration: none;
          &:hover { color: #94A3B8; }
      }
    }
  `],
})
export class PlatformLoginComponent {
  private fb   = inject(FormBuilder);
  private auth = inject(PlatformAuthService);
  private router = inject(Router);

  loading = signal(false);
  error   = signal('');
  showPw  = signal(false);

  form = this.fb.group({
    email:    ['', [Validators.required, Validators.email]],
    password: ['', Validators.required],
  });

  submit() {
    if (this.form.invalid) return;
    this.loading.set(true);
    this.error.set('');
    const { email, password } = this.form.value;
    this.auth.login(email!, password!).subscribe({
      next: () => this.router.navigate(['/platform/schools']),
      error: (e) => {
        this.error.set(e?.error?.error?.message ?? 'Invalid credentials');
        this.loading.set(false);
      },
    });
  }
}
