import { Injectable, signal, computed, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { tap } from 'rxjs';
import { environment } from '../../../environments/environment';

interface PlatformAdmin {
  id: string;
  email: string;
  name: string;
}

@Injectable({ providedIn: 'root' })
export class PlatformAuthService {
  private http   = inject(HttpClient);
  private router = inject(Router);

  private _admin  = signal<PlatformAdmin | null>(this.load());
  private _token  = signal<string | null>(localStorage.getItem('platform_token'));

  readonly admin      = this._admin.asReadonly();
  readonly token      = this._token.asReadonly();
  readonly isLoggedIn = computed(() => !!this._token());

  login(email: string, password: string) {
    return this.http.post<{ data: { accessToken: string; admin: PlatformAdmin } }>(
      `${environment.apiUrl}/platform/auth/login`, { email, password }
    ).pipe(
      tap(res => {
        this._token.set(res.data.accessToken);
        this._admin.set(res.data.admin);
        localStorage.setItem('platform_token', res.data.accessToken);
        localStorage.setItem('platform_admin', JSON.stringify(res.data.admin));
      })
    );
  }

  logout() {
    this._token.set(null);
    this._admin.set(null);
    localStorage.removeItem('platform_token');
    localStorage.removeItem('platform_admin');
    this.router.navigate(['/platform/login']);
  }

  private load(): PlatformAdmin | null {
    const raw = localStorage.getItem('platform_admin');
    return raw ? JSON.parse(raw) : null;
  }
}
