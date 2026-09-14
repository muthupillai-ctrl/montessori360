import { Injectable, signal, computed, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { tap, catchError, throwError } from 'rxjs';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: string;
  tenantId: string;
  tenantSchema: string;
  tenantName?: string;
}

interface LoginResponse {
  accessToken: string;
  user: AuthUser;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private http   = inject(HttpClient);
  private router = inject(Router);

  private _user  = signal<AuthUser | null>(this.loadUser());
  private _token = signal<string | null>(localStorage.getItem('ams_access_token'));

  readonly user       = this._user.asReadonly();
  readonly token      = this._token.asReadonly();
  readonly isLoggedIn = computed(() => !!this._token());

  login(credentials: { email: string; password: string; tenantCode: string }) {
    // Clear stale token so the interceptor doesn't attach it to the login request
    this._token.set(null);
    localStorage.removeItem('ams_access_token');

    return this.http.post<LoginResponse>('/api/v1/auth/login', credentials, {
      withCredentials: true,
    }).pipe(
      tap(res => {
        this._token.set(res.accessToken);
        this._user.set(res.user);
        localStorage.setItem('ams_access_token', res.accessToken);
        localStorage.setItem('ams_auth_user', JSON.stringify(res.user));
        this.router.navigate(['/']);
      }),
      catchError(err => throwError(() => err))
    );
  }

  logout() {
    this.http.post('/api/v1/auth/logout', {}, { withCredentials: true })
      .subscribe({ error: () => {} });
    this._token.set(null);
    this._user.set(null);
    localStorage.removeItem('ams_access_token');
    localStorage.removeItem('ams_auth_user');
    this.router.navigate(['/login']);
  }

  refreshToken() {
    return this.http.post<{ accessToken: string }>(
      '/api/v1/auth/refresh', {}, { withCredentials: true }
    ).pipe(
      tap(res => {
        this._token.set(res.accessToken);
        localStorage.setItem('ams_access_token', res.accessToken);
      })
    );
  }

  private loadUser(): AuthUser | null {
    const raw = localStorage.getItem('ams_auth_user');
    return raw ? JSON.parse(raw) : null;
  }
}
