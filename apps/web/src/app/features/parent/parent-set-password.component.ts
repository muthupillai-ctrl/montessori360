import { Component, inject, signal, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ApiService } from '../../core/services/api.service';

@Component({
  selector: 'app-parent-set-password',
  standalone: true,
  imports: [FormsModule, MatIconModule, MatProgressSpinnerModule],
  template: `
    <div class="page">
      <div class="card">
        <div class="logo">M</div>
        <div class="title">Montessori360</div>
        <div class="subtitle">Parent Portal</div>

        @if (done()) {
          <div class="success-box">
            <mat-icon style="font-size:36px;width:36px;height:36px;color:#059669">check_circle</mat-icon>
            <p class="success-msg">Password set successfully!</p>
            <p class="success-sub">You can now log in with your email and password.</p>
            <button class="btn-primary" (click)="goToLogin()">Go to Login</button>
          </div>
        } @else if (tokenInvalid()) {
          <div class="error-box">
            <mat-icon style="font-size:36px;width:36px;height:36px;color:#EF4444">error_outline</mat-icon>
            <p class="error-msg">This invite link is invalid or has expired.</p>
            <p class="error-sub">Please ask the school to send a new invite.</p>
          </div>
        } @else {
          <p class="intro">Welcome! Set a password to access your child's portal.</p>

          <div class="form">
            <div class="field">
              <label>New Password</label>
              <div class="input-wrap">
                <input
                  [type]="showPw() ? 'text' : 'password'"
                  [(ngModel)]="password"
                  placeholder="At least 8 characters"
                  class="input"
                  (keydown.enter)="submit()"
                />
                <button class="eye-btn" type="button" (click)="showPw.set(!showPw())">
                  <mat-icon style="font-size:18px;width:18px;height:18px">
                    {{ showPw() ? 'visibility_off' : 'visibility' }}
                  </mat-icon>
                </button>
              </div>
            </div>

            <div class="field">
              <label>Confirm Password</label>
              <div class="input-wrap">
                <input
                  [type]="showPw() ? 'text' : 'password'"
                  [(ngModel)]="confirm"
                  placeholder="Re-enter password"
                  class="input"
                  (keydown.enter)="submit()"
                />
              </div>
            </div>

            @if (error()) {
              <div class="error-msg-inline">{{ error() }}</div>
            }

            <button class="btn-primary" [disabled]="submitting()" (click)="submit()">
              @if (submitting()) {
                <mat-progress-spinner diameter="18" mode="indeterminate" style="display:inline-block"/>
              } @else {
                Set Password & Log In
              }
            </button>
          </div>
        }
      </div>
    </div>
  `,
  styles: [`
    .page {
      min-height: 100vh; display: flex; align-items: center; justify-content: center;
      background: linear-gradient(135deg, #EFF6FF 0%, #F5F3FF 100%);
      padding: 20px;
    }
    .card {
      background: #fff; border-radius: 20px; padding: 40px 36px;
      width: 100%; max-width: 400px; box-shadow: 0 8px 40px rgba(0,0,0,.1);
      display: flex; flex-direction: column; align-items: center; gap: 6px;
    }
    .logo {
      width: 52px; height: 52px; border-radius: 14px; background: #2563EB;
      color: #fff; font-size: 22px; font-weight: 800;
      display: flex; align-items: center; justify-content: center; margin-bottom: 4px;
    }
    .title { font-size: 20px; font-weight: 800; color: #111; }
    .subtitle { font-size: 12px; color: #6B7280; margin-bottom: 8px; }
    .intro { font-size: 13px; color: #4B5563; text-align: center; line-height: 1.6; margin: 8px 0; }

    .form { width: 100%; display: flex; flex-direction: column; gap: 16px; margin-top: 8px; }
    .field { display: flex; flex-direction: column; gap: 6px; }
    label { font-size: 12px; font-weight: 600; color: #374151; }
    .input-wrap { position: relative; display: flex; align-items: center; }
    .input {
      width: 100%; padding: 11px 40px 11px 14px; border: 1.5px solid #E5E7EB;
      border-radius: 10px; font-size: 14px; color: #111; background: #F9FAFB;
      box-sizing: border-box;
      &:focus { outline: none; border-color: #2563EB; background: #fff; }
    }
    .eye-btn {
      position: absolute; right: 10px; background: none; border: none;
      cursor: pointer; color: #9CA3AF; display: flex; align-items: center; padding: 4px;
    }
    .btn-primary {
      width: 100%; padding: 12px; background: #2563EB; color: #fff;
      border: none; border-radius: 10px; font-size: 14px; font-weight: 700;
      cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px;
      margin-top: 4px;
      &:hover { background: #1D4ED8; }
      &:disabled { opacity: .6; cursor: default; }
    }
    .error-msg-inline { font-size: 12px; color: #EF4444; font-weight: 500; }

    .success-box, .error-box {
      display: flex; flex-direction: column; align-items: center; gap: 10px;
      text-align: center; margin-top: 8px; width: 100%;
    }
    .success-msg { font-size: 16px; font-weight: 700; color: #065F46; margin: 0; }
    .success-sub { font-size: 13px; color: #6B7280; margin: 0; }
    .error-msg   { font-size: 15px; font-weight: 700; color: #991B1B; margin: 0; }
    .error-sub   { font-size: 13px; color: #6B7280; margin: 0; }
  `],
})
export class ParentSetPasswordComponent implements OnInit {
  private api    = inject(ApiService);
  private router = inject(Router);
  private route  = inject(ActivatedRoute);

  token        = '';
  password     = '';
  confirm      = '';
  showPw       = signal(false);
  submitting   = signal(false);
  done         = signal(false);
  tokenInvalid = signal(false);
  error        = signal('');

  ngOnInit() {
    this.token = this.route.snapshot.queryParamMap.get('token') ?? '';
    if (!this.token) this.tokenInvalid.set(true);
  }

  submit() {
    this.error.set('');
    if (this.password.length < 8) { this.error.set('Password must be at least 8 characters.'); return; }
    if (this.password !== this.confirm) { this.error.set('Passwords do not match.'); return; }

    this.submitting.set(true);
    this.api.post<any>('/auth/parent/set-password', {
      token:       this.token,
      newPassword: this.password,
    }).subscribe({
      next: () => { this.submitting.set(false); this.done.set(true); },
      error: (err: any) => {
        this.submitting.set(false);
        const msg: string = err?.error?.error?.message ?? 'Something went wrong. Please try again.';
        if (msg.toLowerCase().includes('invalid') || msg.toLowerCase().includes('expired')) {
          this.tokenInvalid.set(true);
        } else {
          this.error.set(msg);
        }
      },
    });
  }

  goToLogin() { this.router.navigate(['/login']); }
}
