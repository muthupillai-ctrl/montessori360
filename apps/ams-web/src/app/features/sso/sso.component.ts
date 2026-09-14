import { Component, OnInit, inject } from '@angular/core';
import { Router } from '@angular/router';

@Component({
  selector: 'ams-sso',
  standalone: true,
  template: `
    <div style="display:flex;align-items:center;justify-content:center;height:100vh;
                font-family:sans-serif;color:#64748B;font-size:14px;gap:10px">
      <div style="width:20px;height:20px;border:2px solid #E2E8F0;border-top-color:#7C3AED;
                  border-radius:50%;animation:spin .7s linear infinite"></div>
      <span>Signing you in…</span>
      <style>@keyframes spin{to{transform:rotate(360deg)}}</style>
    </div>
  `,
})
export class SsoComponent implements OnInit {
  private router = inject(Router);

  ngOnInit() {
    const params  = new URLSearchParams(window.location.search);
    const token   = params.get('token');
    const userB64 = params.get('user');

    if (!token) {
      this.router.navigate(['/login'], { replaceUrl: true });
      return;
    }

    localStorage.setItem('ams_access_token', token);

    if (userB64) {
      try {
        const raw  = decodeURIComponent(escape(atob(userB64)));
        const user = JSON.parse(raw);
        localStorage.setItem('ams_auth_user', JSON.stringify(user));
      } catch {
        // proceed without user cache — API calls will still work
      }
    }

    // Remove token from URL before navigating so it never sits in browser history
    window.history.replaceState({}, '', '/sso');
    this.router.navigate(['/worksheets'], { replaceUrl: true });
  }
}
