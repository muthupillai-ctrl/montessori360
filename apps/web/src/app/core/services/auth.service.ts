import { Injectable, signal, computed, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { tap, catchError, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import type { LoginRequest, LoginResponse, AuthUser } from '../models';

// Role → default landing route (keeps auth.service free of RoleService to avoid circular dep)
const ROLE_HOME: Record<string, string> = {
  owner:            '/dashboard',
  principal:        '/dashboard',
  teacher:          '/dashboard',
  assistant_teacher:'/dashboard',
  accountant:       '/dashboard',
  admission_staff:  '/dashboard',
  support:          '/dashboard',
  driver:           '/driver',
  parent:           '/parent/dashboard',
};

@Injectable({ providedIn: 'root' })
export class AuthService {
  private http   = inject(HttpClient);
  private router = inject(Router);

  private _user   = signal<AuthUser | null>(this.loadUser());
  private _token  = signal<string | null>(localStorage.getItem('access_token'));

  readonly user         = this._user.asReadonly();
  readonly token        = this._token.asReadonly();
  readonly isLoggedIn   = computed(() => !!this._token());
  readonly isAdmin      = computed(() => ['owner','principal'].includes(this._user()?.role ?? ''));
  readonly userRole     = computed(() => this._user()?.role ?? '');

  login(req: LoginRequest) {
    return this.http.post<LoginResponse>(`${environment.apiUrl}/auth/login`, req, {
      withCredentials: true,
    }).pipe(
      tap(res => {
        this._token.set(res.accessToken);
        this._user.set(res.user);
        localStorage.setItem('access_token', res.accessToken);
        localStorage.setItem('auth_user', JSON.stringify(res.user));
        const home = ROLE_HOME[res.user.role] ?? '/dashboard';
        this.router.navigate([home]);
      }),
      catchError(err => throwError(() => err))
    );
  }

  logout() {
    this.http.post(`${environment.apiUrl}/auth/logout`, {}, {
      withCredentials: true,
    }).subscribe({ error: () => {} });

    this._token.set(null);
    this._user.set(null);
    localStorage.removeItem('access_token');
    localStorage.removeItem('auth_user');
    this.router.navigate(['/login']);
  }

  refreshToken() {
    return this.http.post<{ accessToken: string }>(
      `${environment.apiUrl}/auth/refresh`, {}, { withCredentials: true }
    ).pipe(
      tap(res => {
        this._token.set(res.accessToken);
        localStorage.setItem('access_token', res.accessToken);
      })
    );
  }

  private loadUser(): AuthUser | null {
    const raw = localStorage.getItem('auth_user');
    return raw ? JSON.parse(raw) : null;
  }
}
