import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class ApiService {
  private http = inject(HttpClient);
  private base = '/api/v1';

  get<T>(path: string, params?: Record<string, unknown>): Observable<T> {
    let httpParams = new HttpParams();
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined && v !== null && v !== '') {
          httpParams = httpParams.set(k, String(v));
        }
      });
    }
    return this.http.get<T>(`${this.base}${path}`, { params: httpParams });
  }

  post<T>(path: string, body?: unknown): Observable<T> {
    return this.http.post<T>(`${this.base}${path}`, body);
  }

  patch<T>(path: string, body?: unknown): Observable<T> {
    return this.http.patch<T>(`${this.base}${path}`, body);
  }

  put<T>(path: string, body?: unknown): Observable<T> {
    return this.http.put<T>(`${this.base}${path}`, body);
  }

  postForm<T>(path: string, formData: FormData): Observable<T> {
    return this.http.post<T>(`${this.base}${path}`, formData);
  }

  delete<T>(path: string): Observable<T> {
    return this.http.delete<T>(`${this.base}${path}`);
  }
}
