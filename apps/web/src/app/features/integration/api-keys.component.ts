import { Component, inject, signal, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { DatePipe } from '@angular/common';
import { ApiService } from '../../core/services/api.service';

interface ApiKeyRow {
  id: string;
  key_prefix: string;
  name: string;
  last_used_at: string | null;
  is_active: boolean;
  created_at: string;
}

@Component({
  selector: 'app-api-keys',
  standalone: true,
  imports: [FormsModule, MatIconModule, MatProgressSpinnerModule, DatePipe],
  template: `
<div class="pg">
  <div class="pg-header">
    <div>
      <h1 class="pg-title">Integration API Keys</h1>
      <p class="pg-sub">Keys allow external applications to read this school's data securely.</p>
    </div>
    <button class="btn-primary" (click)="openCreate()">
      <mat-icon>add</mat-icon> New API Key
    </button>
  </div>

  <!-- How it works -->
  <div class="info-card">
    <mat-icon class="info-icon">info_outline</mat-icon>
    <div>
      <div class="info-title">How external apps authenticate</div>
      <div class="info-body">
        Pass the key in the <code>X-Api-Key</code> request header.
        The key grants read access to this school's students, classes, staff and attendance via the SIS API.
        Keys never expire but can be revoked here at any time.
      </div>
    </div>
  </div>

  <!-- Key list -->
  @if (loading()) {
    <div class="spinner-wrap"><mat-spinner diameter="32" /></div>
  } @else if (keys().length === 0) {
    <div class="empty-card">
      <mat-icon>vpn_key</mat-icon>
      <p>No API keys yet. Create one to connect an external application.</p>
    </div>
  } @else {
    <div class="keys-card">
      @for (k of keys(); track k.id) {
        <div class="key-row" [class.revoked]="!k.is_active">
          <div class="key-left">
            <div class="key-prefix">{{ k.key_prefix }}…</div>
            <div class="key-name">{{ k.name }}</div>
          </div>
          <div class="key-meta">
            @if (k.last_used_at) {
              <span class="meta-item"><mat-icon>schedule</mat-icon> Last used {{ k.last_used_at | date:'d MMM y' }}</span>
            } @else {
              <span class="meta-item muted">Never used</span>
            }
            <span class="meta-item"><mat-icon>calendar_today</mat-icon> Created {{ k.created_at | date:'d MMM y' }}</span>
          </div>
          <div class="key-status">
            @if (k.is_active) {
              <span class="badge active">Active</span>
            } @else {
              <span class="badge revoked">Revoked</span>
            }
          </div>
          <div class="key-actions">
            @if (k.is_active) {
              <button class="icon-btn warn" (click)="revoke(k)" title="Revoke key">
                <mat-icon>block</mat-icon>
              </button>
            }
            <button class="icon-btn danger" (click)="remove(k)" title="Delete key">
              <mat-icon>delete</mat-icon>
            </button>
          </div>
        </div>
      }
    </div>
  }
</div>

<!-- Create key dialog -->
@if (showDialog()) {
  <div class="overlay" (click)="closeDialog()"></div>
  <div class="dialog">
    <div class="dialog-header">
      <h2>New API Key</h2>
      <button class="icon-btn" (click)="closeDialog()"><mat-icon>close</mat-icon></button>
    </div>

    @if (newKey()) {
      <!-- Show key ONCE after creation -->
      <div class="key-reveal">
        <div class="reveal-label">Copy this key now — it will not be shown again.</div>
        <div class="reveal-box">
          <code>{{ newKey() }}</code>
          <button class="copy-btn" (click)="copyKey()" title="Copy">
            <mat-icon>{{ copied() ? 'check' : 'content_copy' }}</mat-icon>
          </button>
        </div>
        <div class="reveal-hint">Add it to your external app's environment config as <code>M360_API_KEY</code>.</div>
      </div>
      <div class="dialog-footer">
        <button class="btn-primary" (click)="closeDialog()">Done</button>
      </div>
    } @else {
      <div class="dialog-body">
        <label class="field-label">Key Name <span class="req">*</span></label>
        <input class="field-input" [(ngModel)]="createName" placeholder="e.g. AMS App, Worksheet Generator"
               (keydown.enter)="submitCreate()" />
        <div class="field-hint">Helps you identify which app is using this key.</div>
        @if (dialogError()) {
          <div class="err">{{ dialogError() }}</div>
        }
      </div>
      <div class="dialog-footer">
        <button class="btn-ghost" (click)="closeDialog()">Cancel</button>
        <button class="btn-primary" [disabled]="!createName.trim() || saving()" (click)="submitCreate()">
          @if (saving()) { <mat-spinner diameter="14" /> } Generate Key
        </button>
      </div>
    }
  </div>
}

@if (toast()) {
  <div class="toast"><mat-icon>check_circle</mat-icon> {{ toast() }}</div>
}
  `,
  styles: [`
    .pg { padding: 28px 32px; max-width: 900px; }
    .pg-header { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 24px; }
    .pg-title { font-size: 22px; font-weight: 700; color: #0F172A; margin: 0 0 4px; }
    .pg-sub   { font-size: 13px; color: #64748B; margin: 0; }

    .btn-primary {
      display: flex; align-items: center; gap: 6px;
      background: #3B82F6; color: #fff; border: none; border-radius: 8px;
      padding: 9px 16px; font-size: 13px; font-weight: 600; cursor: pointer;
      mat-icon { font-size: 16px; }
      &:disabled { opacity: .5; cursor: not-allowed; }
      &:hover:not(:disabled) { background: #2563EB; }
    }
    .btn-ghost {
      background: none; border: 1px solid #E2E8F0; border-radius: 8px;
      padding: 9px 16px; font-size: 13px; color: #64748B; cursor: pointer;
      &:hover { background: #F8FAFC; }
    }

    /* Info card */
    .info-card {
      display: flex; gap: 12px; align-items: flex-start;
      background: #EFF6FF; border: 1px solid #BFDBFE; border-radius: 10px;
      padding: 14px 16px; margin-bottom: 24px;
    }
    .info-icon { color: #3B82F6; font-size: 20px; flex-shrink: 0; margin-top: 1px; }
    .info-title { font-size: 13px; font-weight: 600; color: #1E40AF; margin-bottom: 4px; }
    .info-body  { font-size: 12px; color: #3B82F6; line-height: 1.6; }
    code { background: #DBEAFE; color: #1E40AF; padding: 1px 5px; border-radius: 4px; font-size: 11px; }

    /* Spinner / empty */
    .spinner-wrap { display: flex; justify-content: center; padding: 48px; }
    .empty-card {
      display: flex; flex-direction: column; align-items: center; gap: 8px;
      background: #fff; border: 1px solid #E2E8F0; border-radius: 12px; padding: 48px;
      color: #94A3B8;
      mat-icon { font-size: 36px; }
      p { margin: 0; font-size: 14px; }
    }

    /* Keys list */
    .keys-card { background: #fff; border: 1px solid #E2E8F0; border-radius: 12px; overflow: hidden; }
    .key-row {
      display: flex; align-items: center; gap: 16px;
      padding: 14px 20px; border-bottom: 1px solid #F1F5F9;
      &:last-child { border-bottom: none; }
      &.revoked { opacity: .55; }
    }
    .key-left { flex: 1; min-width: 0; }
    .key-prefix { font-family: monospace; font-size: 13px; font-weight: 600; color: #0F172A; }
    .key-name   { font-size: 12px; color: #64748B; margin-top: 2px; }
    .key-meta { display: flex; gap: 16px; flex-shrink: 0; }
    .meta-item {
      display: flex; align-items: center; gap: 4px; font-size: 12px; color: #64748B;
      mat-icon { font-size: 13px; width: 13px; height: 13px; }
      &.muted { color: #CBD5E1; }
    }
    .key-status { flex-shrink: 0; }
    .badge {
      font-size: 11px; font-weight: 600; padding: 2px 8px; border-radius: 10px;
      &.active  { background: #D1FAE5; color: #065F46; }
      &.revoked { background: #FEE2E2; color: #991B1B; }
    }
    .key-actions { display: flex; gap: 4px; flex-shrink: 0; }
    .icon-btn {
      background: none; border: none; cursor: pointer; color: #94A3B8;
      padding: 6px; border-radius: 6px; display: inline-flex;
      mat-icon { font-size: 16px; }
      &:hover       { background: #F1F5F9; color: #0F172A; }
      &.warn:hover  { background: #FEF3C7; color: #92400E; }
      &.danger:hover{ background: #FEE2E2; color: #B91C1C; }
    }

    /* Dialog */
    .overlay { position: fixed; inset: 0; background: rgba(0,0,0,.45); z-index: 100; }
    .dialog {
      position: fixed; top: 50%; left: 50%; transform: translate(-50%,-50%);
      width: 440px; background: #fff; border-radius: 14px; z-index: 101;
      box-shadow: 0 20px 60px rgba(0,0,0,.18); overflow: hidden;
    }
    .dialog-header {
      display: flex; align-items: center; justify-content: space-between;
      padding: 20px 24px 16px; border-bottom: 1px solid #F1F5F9;
      h2 { margin: 0; font-size: 16px; font-weight: 700; color: #0F172A; }
    }
    .dialog-body { padding: 20px 24px; }
    .dialog-footer { display: flex; justify-content: flex-end; gap: 10px; padding: 16px 24px; border-top: 1px solid #F1F5F9; }
    .field-label { display: block; font-size: 12px; font-weight: 500; color: #475569; margin-bottom: 6px; }
    .req { color: #EF4444; }
    .field-input {
      width: 100%; box-sizing: border-box; border: 1px solid #E2E8F0; border-radius: 8px;
      padding: 9px 12px; font-size: 13px; color: #0F172A;
      &:focus { outline: none; border-color: #3B82F6; box-shadow: 0 0 0 3px rgba(59,130,246,.1); }
    }
    .field-hint { font-size: 11px; color: #94A3B8; margin-top: 6px; }
    .err { font-size: 12px; color: #B91C1C; margin-top: 8px; }

    /* Key reveal */
    .key-reveal { padding: 20px 24px; }
    .reveal-label { font-size: 13px; font-weight: 600; color: #0F172A; margin-bottom: 10px; }
    .reveal-box {
      display: flex; align-items: center; gap: 8px;
      background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 8px; padding: 10px 12px;
      margin-bottom: 10px;
      code { background: none; color: #0F172A; font-size: 12px; flex: 1; word-break: break-all; padding: 0; }
    }
    .copy-btn {
      background: none; border: none; cursor: pointer; color: #64748B; padding: 4px; border-radius: 6px;
      display: flex; flex-shrink: 0;
      mat-icon { font-size: 16px; }
      &:hover { background: #E2E8F0; color: #0F172A; }
    }
    .reveal-hint { font-size: 11px; color: #94A3B8; }

    .toast {
      position: fixed; bottom: 24px; right: 24px; z-index: 200;
      background: #064E3B; color: #A7F3D0; border: 1px solid #065F46;
      padding: 12px 20px; border-radius: 10px; font-size: 13px; font-weight: 500;
      display: flex; align-items: center; gap: 8px;
      mat-icon { font-size: 16px; }
    }
  `],
})
export class ApiKeysComponent implements OnInit {
  private api = inject(ApiService);

  keys       = signal<ApiKeyRow[]>([]);
  loading    = signal(false);
  saving     = signal(false);
  showDialog = signal(false);
  newKey     = signal('');
  copied     = signal(false);
  dialogError = signal('');
  toast       = signal('');
  createName  = '';

  ngOnInit() { this.load(); }

  private load() {
    this.loading.set(true);
    this.api.get<{ data: ApiKeyRow[] }>('/integration/api-keys').subscribe({
      next: r => { this.keys.set(r.data); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  openCreate() { this.createName = ''; this.newKey.set(''); this.dialogError.set(''); this.showDialog.set(true); }
  closeDialog() { this.showDialog.set(false); this.newKey.set(''); }

  submitCreate() {
    if (!this.createName.trim()) return;
    this.saving.set(true); this.dialogError.set('');
    this.api.post<{ data: ApiKeyRow & { key: string } }>('/integration/api-keys', { name: this.createName.trim() }).subscribe({
      next: r => { this.saving.set(false); this.newKey.set(r.data.key); this.load(); },
      error: (e: any) => { this.dialogError.set(e?.error?.error?.message ?? 'Failed to create key'); this.saving.set(false); },
    });
  }

  copyKey() {
    navigator.clipboard.writeText(this.newKey()).then(() => {
      this.copied.set(true);
      setTimeout(() => this.copied.set(false), 2000);
    });
  }

  revoke(k: ApiKeyRow) {
    if (!confirm(`Revoke key "${k.name}"? Any app using it will immediately lose access.`)) return;
    this.api.patch(`/integration/api-keys/${k.id}/revoke`, {}).subscribe({
      next: () => { this.load(); this.showToast('Key revoked'); },
    });
  }

  remove(k: ApiKeyRow) {
    if (!confirm(`Delete key "${k.name}"? This cannot be undone.`)) return;
    this.api.delete(`/integration/api-keys/${k.id}`).subscribe({
      next: () => { this.load(); this.showToast('Key deleted'); },
    });
  }

  private showToast(msg: string) {
    this.toast.set(msg);
    setTimeout(() => this.toast.set(''), 3000);
  }
}
