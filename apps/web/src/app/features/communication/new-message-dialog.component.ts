import { Component, inject, signal, OnInit } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { FormsModule } from '@angular/forms';
import { TitleCasePipe } from '@angular/common';
import { ApiService } from '../../core/services/api.service';

interface Contact { id: string; name: string; type: 'staff' | 'parent'; role?: string; email?: string; }

@Component({
  selector: 'app-new-message-dialog',
  standalone: true,
  imports: [ ReactiveFormsModule, FormsModule, MatDialogModule, MatIconModule, MatProgressSpinnerModule, TitleCasePipe ],
  template: `
    <div class="dialog-shell">

      <div class="dialog-header">
        <div class="dh-icon"><mat-icon>edit</mat-icon></div>
        <div>
          <div class="dh-title">New Message</div>
          <div class="dh-sub">Start a conversation</div>
        </div>
        <button class="dh-close" mat-dialog-close><mat-icon>close</mat-icon></button>
      </div>

      <div class="dialog-body">

        <!-- Parent messaging info -->
        <div class="info-note">
          <mat-icon style="font-size:14px;width:14px;height:14px;color:var(--blue);flex-shrink:0">info</mat-icon>
          <span>Currently you can message <strong>staff members</strong> only. Parent messaging will be available when the parent portal is set up.</span>
        </div>

        <!-- Recipient search -->
        <div class="field-group">
          <label class="field-label">To <span class="req">*</span></label>
          <div class="recipient-search">
            <mat-icon style="font-size:16px;width:16px;height:16px;color:var(--text-3)">search</mat-icon>
            <input [(ngModel)]="searchQuery" placeholder="Search by name or role…"
                   class="rs-input" (input)="filterContacts()">
          </div>

          @if (selectedContact()) {
            <div class="selected-contact">
              <div class="sc-av" [style.background]="getColor(selectedContact()!.name)">
                {{ selectedContact()!.name[0] }}
              </div>
              <div class="sc-info">
                <div class="sc-name">{{ selectedContact()!.name }}</div>
                <div class="sc-role">{{ selectedContact()!.role ?? selectedContact()!.type }}</div>
              </div>
              <button class="sc-remove" (click)="clearContact()">
                <mat-icon style="font-size:16px;width:16px;height:16px">close</mat-icon>
              </button>
            </div>
          } @else if (searchQuery && filteredContacts().length) {
            <div class="contact-dropdown">
              @for (c of filteredContacts(); track c.id) {
                <div class="cd-item" (click)="selectContact(c)">
                  <div class="cd-av" [style.background]="getColor(c.name)">{{ c.name[0] }}</div>
                  <div class="cd-info">
                    <div class="cd-name">{{ c.name }}</div>
                    <div class="cd-role">{{ c.role | titlecase }} @if(c.email) { · {{ c.email }} }</div>
                  </div>
                </div>
              }
            </div>
          } @else if (searchQuery && !filteredContacts().length) {
            <div class="no-contacts">No contacts found</div>
          }
        </div>

        <!-- Message -->
        <div class="field-group">
          <label class="field-label">Message <span class="req">*</span></label>
          <textarea class="field-input field-textarea" [(ngModel)]="messageText" rows="5"
                    placeholder="Type your message…"></textarea>
        </div>

        @if (error()) {
          <div class="error-banner">
            <mat-icon style="font-size:15px;width:15px;height:15px;flex-shrink:0">error_outline</mat-icon>
            {{ error() }}
          </div>
        }
      </div>

      <div class="dialog-footer">
        <button class="btn-ghost" mat-dialog-close>Cancel</button>
        <button class="btn-primary" (click)="send()"
                [disabled]="!selectedContact() || !messageText.trim() || sending()">
          @if (sending()) {
            <mat-progress-spinner diameter="16" mode="indeterminate"
              style="--mdc-circular-progress-active-indicator-color:#fff"/>
          } @else {
            <mat-icon style="font-size:15px;width:15px;height:15px">send</mat-icon>
          }
          Send Message
        </button>
      </div>
    </div>
  `,
  styles: [`
    .dialog-shell { width: 480px; display: flex; flex-direction: column; }

    .dialog-header {
      display: flex; align-items: center; gap: 12px;
      padding: 18px 24px 14px; border-bottom: 1px solid var(--border); flex-shrink: 0;
    }
    .dh-icon {
      width: 34px; height: 34px; border-radius: 9px;
      background: var(--blue-light); color: var(--blue); flex-shrink: 0;
      display: flex; align-items: center; justify-content: center;
      mat-icon { font-size: 18px; width: 18px; height: 18px; }
    }
    .dh-title { font-size: 15px; font-weight: 600; color: var(--text); }
    .dh-sub   { font-size: 11px; color: var(--text-3); }
    .dh-close {
      margin-left: auto; background: none; border: none;
      width: 28px; height: 28px; border-radius: 6px; cursor: pointer; color: var(--text-3);
      display: flex; align-items: center; justify-content: center;
      &:hover { background: var(--bg); }
      mat-icon { font-size: 18px; width: 18px; height: 18px; }
    }

    .dialog-body { padding: 18px 24px; display: flex; flex-direction: column; gap: 14px; }
    .field-group { display: flex; flex-direction: column; gap: 6px; }
    .field-label {
      font-size: 12px; font-weight: 500; color: var(--text-2);
      .req { color: var(--red); }
    }

    .info-note {
      display: flex; align-items: flex-start; gap: 8px;
      background: var(--blue-light); border-radius: 8px; padding: 10px 12px;
      font-size: 12px; color: #1E40AF; line-height: 1.5;
    }

    /* Recipient search */
    .recipient-search {
      display: flex; align-items: center; gap: 8px;
      border: 1px solid var(--border); border-radius: 8px;
      padding: 0 10px; height: 36px; background: #fff;
      &:focus-within { border-color: var(--blue); }
    }
    .rs-input {
      flex: 1; border: none; outline: none;
      font-size: 13px; font-family: inherit; background: none;
      &::placeholder { color: var(--text-4); }
    }

    /* Selected contact */
    .selected-contact {
      display: flex; align-items: center; gap: 10px;
      background: var(--blue-light); border: 1px solid var(--blue-mid);
      border-radius: 8px; padding: 8px 12px;
    }
    .sc-av {
      width: 30px; height: 30px; border-radius: 50%; color: #fff;
      font-size: 12px; font-weight: 700; display: flex; align-items: center; justify-content: center; flex-shrink: 0;
    }
    .sc-name { font-size: 13px; font-weight: 600; color: var(--text); }
    .sc-role { font-size: 11px; color: var(--text-3); text-transform: capitalize; }
    .sc-info { flex: 1; }
    .sc-remove {
      background: none; border: none; cursor: pointer; color: var(--text-3);
      width: 24px; height: 24px; border-radius: 4px; display: flex; align-items: center; justify-content: center;
      &:hover { background: rgba(0,0,0,.06); }
    }

    /* Dropdown */
    .contact-dropdown {
      background: #fff; border: 1px solid var(--border); border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,.1); max-height: 200px; overflow-y: auto;
    }
    .cd-item {
      display: flex; align-items: center; gap: 10px;
      padding: 9px 12px; cursor: pointer; border-bottom: 1px solid var(--border-light);
      &:last-child { border-bottom: none; }
      &:hover { background: var(--bg); }
    }
    .cd-av {
      width: 28px; height: 28px; border-radius: 50%; color: #fff;
      font-size: 11px; font-weight: 700; display: flex; align-items: center; justify-content: center; flex-shrink: 0;
    }
    .cd-name { font-size: 13px; font-weight: 500; color: var(--text); }
    .cd-role { font-size: 11px; color: var(--text-3); text-transform: capitalize; }
    .no-contacts { font-size: 12px; color: var(--text-3); padding: 8px 2px; }

    /* Message textarea */
    .field-input {
      padding: 8px 10px; width: 100%;
      background: #fff; border: 1px solid var(--border);
      border-radius: 8px; font-size: 13px; color: var(--text);
      outline: none; font-family: inherit; resize: vertical;
      &:focus { border-color: var(--blue); }
      &::placeholder { color: var(--text-4); }
    }
    .field-textarea { min-height: 100px; }

    .error-banner {
      display: flex; align-items: center; gap: 8px;
      background: var(--red-light); border: 1px solid #FECACA;
      color: #991B1B; padding: 10px 12px; border-radius: 8px; font-size: 12.5px;
    }

    .dialog-footer {
      display: flex; justify-content: flex-end; gap: 8px;
      padding: 14px 24px; border-top: 1px solid var(--border); background: var(--bg);
    }
    .btn-ghost {
      background: none; border: none; cursor: pointer;
      font-size: 13px; color: var(--text-3); padding: 0 10px; height: 36px; border-radius: 7px;
      &:hover { background: var(--border-light); }
    }
    .btn-primary {
      display: flex; align-items: center; gap: 6px;
      background: var(--blue); color: #fff; border: none;
      border-radius: 8px; height: 36px; padding: 0 18px;
      font-size: 13px; font-weight: 500; cursor: pointer;
      &:hover:not(:disabled) { background: #1D4ED8; }
      &:disabled { opacity: .6; cursor: not-allowed; }
    }
  `],
})
export class NewMessageDialogComponent implements OnInit {
  private api       = inject(ApiService);
  private dialogRef = inject(MatDialogRef<NewMessageDialogComponent>);

  contacts         = signal<Contact[]>([]);
  filteredContacts = signal<Contact[]>([]);
  selectedContact  = signal<Contact | null>(null);
  sending          = signal(false);
  error            = signal('');
  searchQuery      = '';
  messageText      = '';

  ngOnInit() {
    this.api.get<any>('/communication/messages/contacts').subscribe({
      next: (res: any) => {
        console.log('[NewMessage] contacts loaded:', res.data?.length);
        this.contacts.set(res.data ?? []);
      },
      error: (err: any) => {
        console.error('[NewMessage] contacts error:', err);
        this.error.set('Could not load contacts: ' + (err.error?.error?.message ?? err.message ?? 'Unknown error'));
      },
    });
  }

  filterContacts() {
    const q = this.searchQuery.toLowerCase();
    if (!q) { this.filteredContacts.set([]); return; }
    this.filteredContacts.set(
      this.contacts().filter(c =>
        c.name.toLowerCase().includes(q) || (c.role ?? '').toLowerCase().includes(q)
      ).slice(0, 8)
    );
  }

  selectContact(c: Contact) {
    this.selectedContact.set(c);
    this.searchQuery = '';
    this.filteredContacts.set([]);
  }

  clearContact() { this.selectedContact.set(null); }

  getColor(name: string): string {
    const colors = ['#2563EB','#7C3AED','#DB2777','#D97706','#059669','#0891B2'];
    return colors[(name?.charCodeAt(0) || 0) % colors.length];
  }

  send() {
    const contact = this.selectedContact();
    if (!contact || !this.messageText.trim()) return;
    this.sending.set(true);
    this.error.set('');

    this.api.post<any>('/communication/messages', {
      recipient_id:   contact.id,
      recipient_type: contact.type,
      body:           this.messageText.trim(),
    }).subscribe({
      next: (res: any) => {
        this.sending.set(false);
        this.dialogRef.close({ contact, message: res.data });
      },
      error: (err: any) => {
        this.sending.set(false);
        this.error.set(err.error?.error?.message ?? 'Failed to send message.');
      },
    });
  }
}
