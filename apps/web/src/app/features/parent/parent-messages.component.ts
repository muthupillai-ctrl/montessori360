import { Component, inject, signal, OnInit, AfterViewChecked, ViewChild, ElementRef } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { DatePipe } from '@angular/common';
import { ApiService } from '../../core/services/api.service';

@Component({
  selector: 'app-parent-messages',
  standalone: true,
  imports: [MatIconModule, MatProgressSpinnerModule, DatePipe, FormsModule],
  template: `
    <!-- ══ THREAD VIEW ══ -->
    @if (activeConv()) {
      <div class="thread-header">
        <button class="back-btn" (click)="closeConv()">
          <mat-icon>arrow_back_ios</mat-icon>
        </button>
        <div class="av" [style.background]="color(activeConv()!.partner_name)">
          {{ activeConv()!.partner_name?.[0] ?? '?' }}
        </div>
        <span class="partner-name">{{ activeConv()!.partner_name }}</span>
      </div>

      <div class="msg-area" #msgArea>
        @if (threadLoading()) {
          <div class="spinner-row"><mat-progress-spinner diameter="24" mode="indeterminate"/></div>
        } @else {
          @for (m of messages(); track m.id) {
            <div class="brow" [class.mine]="m.sender_type === 'parent'">
              <div class="bubble" [class.mine]="m.sender_type === 'parent'">
                <div class="btext">{{ m.body }}</div>
                <div class="btime">{{ m.created_at | date:'h:mm a' }}</div>
              </div>
            </div>
          }
          @if (!messages().length) {
            <p class="no-msgs">No messages yet</p>
          }
        }
      </div>

      @if (sendError()) {
        <div class="send-err" (click)="sendError.set('')">
          {{ sendError() }}
        </div>
      }

      <div class="reply-bar">
        <input #replyInput class="reply-input" [(ngModel)]="replyBody"
               placeholder="Type a reply…"
               (keydown.enter)="sendReply()"
               (focus)="sendError.set('')">
        <button class="send-btn" (click)="sendReply()"
                [disabled]="!replyBody.trim() || sending()">
          <mat-icon>send</mat-icon>
        </button>
      </div>
    }

    <!-- ══ LIST VIEW ══ -->
    @if (!activeConv()) {
      <div class="tabs">
        <button class="tab" [class.active]="tab() === 'announcements'"
                (click)="tab.set('announcements')">
          <mat-icon>campaign</mat-icon>
          Announcements
        </button>
        <button class="tab" [class.active]="tab() === 'messages'"
                (click)="switchToMessages()">
          <mat-icon>forum</mat-icon>
          Messages
          @if (unread() > 0) { <span class="badge">{{ unread() }}</span> }
        </button>
      </div>

      <div class="scroll-body">

        @if (tab() === 'announcements') {
          @if (annLoading()) {
            <div class="spinner-row"><mat-progress-spinner diameter="28" mode="indeterminate"/></div>
          } @else if (!announcements().length) {
            <div class="empty">
              <mat-icon>campaign</mat-icon>
              <span>No announcements yet</span>
            </div>
          } @else {
            @for (a of announcements(); track a.id) {
              <div class="ann-card">
                <div class="ann-row">
                  <span class="ann-tag" [class]="a.audience">{{ audienceLabel(a.audience) }}</span>
                  <span class="ann-date">{{ a.published_at | date:'d MMM' }}</span>
                </div>
                <div class="ann-title">{{ a.title }}</div>
                <div class="ann-body">{{ a.body }}</div>
                @if (a.created_by_name) {
                  <div class="ann-by">— {{ a.created_by_name }}</div>
                }
              </div>
            }
          }
        }

        @if (tab() === 'messages') {
          <div class="new-row">
            <button class="btn-new" (click)="showCompose.set(!showCompose())">
              <mat-icon>edit</mat-icon> New Message
            </button>
          </div>

          @if (showCompose()) {
            <div class="compose-box">
              <select class="f-select" [(ngModel)]="newRecipientId">
                <option value="">Choose a staff member…</option>
                @for (s of staffContacts(); track s.id) {
                  <option [value]="s.id">{{ s.name }}{{ s.role ? ' — ' + s.role : '' }}</option>
                }
              </select>
              <textarea class="f-area" [(ngModel)]="newBody" rows="3"
                        placeholder="Write your message…"></textarea>
              <div class="compose-actions">
                <button class="btn-ghost" (click)="cancelCompose()">Cancel</button>
                <button class="btn-primary"
                        [disabled]="!newRecipientId || !newBody.trim() || sending()"
                        (click)="startConversation()">
                  {{ sending() ? 'Sending…' : 'Send' }}
                </button>
              </div>
            </div>
          }

          @if (convLoading()) {
            <div class="spinner-row"><mat-progress-spinner diameter="28" mode="indeterminate"/></div>
          } @else if (!conversations().length) {
            <div class="empty">
              <mat-icon>forum</mat-icon>
              <span>No messages yet — tap New Message to start</span>
            </div>
          } @else {
            @for (c of conversations(); track c.partner_id) {
              <div class="conv-row" (click)="openConv(c)">
                <div class="av" [style.background]="color(c.partner_name)">
                  {{ c.partner_name?.[0] ?? '?' }}
                </div>
                <div class="conv-meta">
                  <div class="conv-name">{{ c.partner_name }}</div>
                  <div class="conv-preview">{{ c.last_message }}</div>
                </div>
                @if (c.unread_count > 0) {
                  <span class="unread">{{ c.unread_count }}</span>
                }
                <mat-icon class="chev">chevron_right</mat-icon>
              </div>
            }
          }
        }

      </div>
    }
  `,
  styles: [`
    /*
     * :host is the flex column. It fills page-content completely.
     * Thread view  → header(shrink:0) + msg-area(flex:1,scroll) + reply-bar(shrink:0)
     * List view    → tabs(shrink:0) + scroll-body(flex:1,scroll)
     */
    :host {
      display: flex;
      flex-direction: column;
      height: 100%;
      overflow: hidden;
      background: var(--bg);
    }

    /* ── THREAD ── */
    .thread-header {
      display: flex; align-items: center; gap: 10px;
      padding: 10px 16px; flex-shrink: 0;
      background: var(--surface); border-bottom: 1px solid var(--border);
    }
    .back-btn {
      background: none; border: none; cursor: pointer; padding: 4px;
      color: var(--primary); display: flex; align-items: center;
      mat-icon { font-size: 20px; width: 20px; height: 20px; }
    }
    .partner-name { font-size: 15px; font-weight: 700; color: var(--text-1); }

    .msg-area {
      flex: 1; overflow-y: auto;
      padding: 12px 14px; display: flex; flex-direction: column; gap: 8px;
    }
    .no-msgs { text-align: center; color: var(--text-4); font-size: 13px; margin: 40px 0; }

    .brow { display: flex; &.mine { justify-content: flex-end; } }
    .bubble {
      max-width: 80%; padding: 9px 13px; border-radius: 18px;
      background: var(--surface); border: 1px solid var(--border);
      &.mine {
        background: var(--primary); border-color: var(--primary);
        border-bottom-right-radius: 4px;
        .btext { color: #fff; }
        .btime { color: rgba(255,255,255,.7); }
      }
      &:not(.mine) { border-bottom-left-radius: 4px; }
    }
    .btext { font-size: 14px; line-height: 1.45; color: var(--text-1); }
    .btime { font-size: 10px; color: var(--text-4); margin-top: 3px; text-align: right; }

    .send-err {
      flex-shrink: 0; padding: 8px 16px; font-size: 12px;
      color: #991B1B; background: #FEF2F2; border-top: 1px solid #FECACA;
      cursor: pointer; text-align: center;
    }

    .reply-bar {
      flex-shrink: 0; display: flex; align-items: center; gap: 10px;
      padding: 10px 14px; background: var(--surface);
      border-top: 1px solid var(--border);
    }
    .reply-input {
      flex: 1; border: 1.5px solid var(--border); border-radius: 24px;
      padding: 10px 16px; font-size: 14px; font-family: inherit;
      background: var(--bg); color: var(--text-1); outline: none;
      &:focus { border-color: var(--primary); }
    }
    .send-btn {
      width: 44px; height: 44px; border-radius: 50%; border: none; flex-shrink: 0;
      background: var(--primary); color: #fff; cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      mat-icon { font-size: 20px; width: 20px; height: 20px; }
      &:disabled { background: var(--border); cursor: not-allowed; }
    }

    /* ── LIST ── */
    .tabs {
      display: flex; flex-shrink: 0;
      border-bottom: 1px solid var(--border);
      background: var(--surface);
    }
    .tab {
      flex: 1; display: flex; align-items: center; justify-content: center; gap: 5px;
      padding: 12px 8px; border: none; background: none; cursor: pointer;
      font-size: 13px; font-weight: 600; color: var(--text-3);
      border-bottom: 2px solid transparent; margin-bottom: -1px;
      mat-icon { font-size: 16px; width: 16px; height: 16px; }
      &.active { color: var(--primary); border-bottom-color: var(--primary); }
    }
    .badge {
      background: #EF4444; color: #fff; font-size: 9px; font-weight: 700;
      padding: 1px 5px; border-radius: 8px;
    }

    .scroll-body { flex: 1; overflow-y: auto; }

    .spinner-row { display: flex; justify-content: center; padding: 48px; }
    .empty {
      display: flex; flex-direction: column; align-items: center; gap: 10px;
      padding: 60px 20px; color: var(--text-3); font-size: 13px; text-align: center;
      mat-icon { font-size: 40px; width: 40px; height: 40px; color: var(--text-4); }
    }

    /* Announcements */
    .ann-card {
      margin: 10px 14px 0; padding: 14px;
      background: var(--surface); border: 1px solid var(--border); border-radius: 12px;
      &:last-child { margin-bottom: 10px; }
    }
    .ann-row   { display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px; }
    .ann-tag   { font-size: 10px; font-weight: 700; padding: 2px 8px; border-radius: 6px; text-transform: uppercase; background: rgba(37,99,235,.1); color: #1D4ED8; &.parents { background: rgba(16,185,129,.1); color: #065F46; } &.class { background: rgba(245,158,11,.1); color: #92400E; } }
    .ann-date  { font-size: 11px; color: var(--text-4); }
    .ann-title { font-size: 14px; font-weight: 700; color: var(--text-1); margin-bottom: 5px; }
    .ann-body  { font-size: 13px; color: var(--text-2); line-height: 1.6; white-space: pre-wrap; }
    .ann-by    { font-size: 11px; color: var(--text-4); margin-top: 6px; }

    /* Conversations */
    .new-row { display: flex; justify-content: flex-end; padding: 12px 14px 6px; }
    .btn-new {
      display: flex; align-items: center; gap: 5px;
      background: var(--primary); color: #fff; border: none; border-radius: 20px;
      padding: 8px 18px; font-size: 13px; font-weight: 600; cursor: pointer;
      mat-icon { font-size: 16px; width: 16px; height: 16px; }
    }

    .compose-box {
      margin: 0 14px 10px; padding: 14px;
      background: var(--surface); border: 1px solid var(--border); border-radius: 12px;
      display: flex; flex-direction: column; gap: 10px;
    }
    .f-select {
      width: 100%; padding: 9px 10px; border: 1px solid var(--border); border-radius: 8px;
      font-size: 13px; background: var(--bg); color: var(--text-1);
    }
    .f-area {
      width: 100%; padding: 9px 10px; border: 1px solid var(--border); border-radius: 8px;
      font-size: 13px; font-family: inherit; resize: none;
      background: var(--bg); color: var(--text-1); box-sizing: border-box;
    }
    .compose-actions { display: flex; gap: 8px; justify-content: flex-end; }
    .btn-ghost {
      padding: 8px 14px; border-radius: 8px; border: 1px solid var(--border);
      background: transparent; font-size: 13px; cursor: pointer; color: var(--text-2);
    }
    .btn-primary {
      padding: 8px 18px; border-radius: 8px; border: none;
      background: var(--primary); color: #fff; font-size: 13px; font-weight: 600;
      cursor: pointer; &:disabled { opacity: .5; }
    }

    .conv-row {
      display: flex; align-items: center; gap: 12px;
      padding: 13px 14px; border-bottom: 1px solid var(--border); cursor: pointer;
      &:active { background: var(--bg); }
    }
    .av {
      width: 42px; height: 42px; border-radius: 50%; color: #fff; flex-shrink: 0;
      font-size: 16px; font-weight: 700; display: flex; align-items: center; justify-content: center;
    }
    .conv-meta  { flex: 1; min-width: 0; }
    .conv-name  { font-size: 14px; font-weight: 700; color: var(--text-1); }
    .conv-preview { font-size: 12px; color: var(--text-3); margin-top: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .unread {
      background: var(--primary); color: #fff; font-size: 10px; font-weight: 700;
      min-width: 20px; height: 20px; border-radius: 10px; flex-shrink: 0;
      display: flex; align-items: center; justify-content: center; padding: 0 5px;
    }
    .chev { font-size: 18px; width: 18px; height: 18px; color: var(--text-4); }
  `],
})
export class ParentMessagesComponent implements OnInit, AfterViewChecked {
  private api = inject(ApiService);

  @ViewChild('msgArea') msgArea?: ElementRef<HTMLElement>;

  tab           = signal<'announcements' | 'messages'>('announcements');
  annLoading    = signal(true);
  convLoading   = signal(false);
  threadLoading = signal(false);
  sending       = signal(false);
  showCompose   = signal(false);

  announcements = signal<any[]>([]);
  conversations = signal<any[]>([]);
  messages      = signal<any[]>([]);
  staffContacts = signal<any[]>([]);
  activeConv    = signal<any | null>(null);
  unread        = signal(0);
  sendError     = signal('');

  newRecipientId = '';
  newBody        = '';
  replyBody      = '';
  private scrollBottom = false;

  ngOnInit() {
    this.loadAnnouncements();
    this.loadUnread();
  }

  ngAfterViewChecked() {
    if (this.scrollBottom && this.msgArea) {
      const el = this.msgArea.nativeElement;
      el.scrollTop = el.scrollHeight;
      this.scrollBottom = false;
    }
  }

  loadAnnouncements() {
    this.annLoading.set(true);
    this.api.get<any>('/parent/announcements').subscribe({
      next: (r: any) => { this.announcements.set(r.data ?? []); this.annLoading.set(false); },
      error: () => this.annLoading.set(false),
    });
  }

  loadUnread() {
    this.api.get<any>('/parent/messages/unread-count').subscribe({
      next: (r: any) => this.unread.set(r.data?.unread_count ?? 0),
      error: () => {},
    });
  }

  switchToMessages() {
    this.tab.set('messages');
    if (!this.conversations().length) this.loadConversations();
    if (!this.staffContacts().length) this.loadStaffContacts();
  }

  loadConversations() {
    this.convLoading.set(true);
    this.api.get<any>('/parent/messages/conversations').subscribe({
      next: (r: any) => { this.conversations.set(r.data ?? []); this.convLoading.set(false); },
      error: () => this.convLoading.set(false),
    });
  }

  loadStaffContacts() {
    this.api.get<any>('/parent/messages/contacts').subscribe({
      next: (r: any) => this.staffContacts.set(r.data ?? []),
      error: () => {},
    });
  }

  openConv(c: any) {
    this.activeConv.set(c);
    this.replyBody = '';
    this.sendError.set('');
    this.threadLoading.set(true);
    this.api.get<any>(`/parent/messages/conversations/${c.partner_id}`).subscribe({
      next: (r: any) => {
        this.messages.set(r.data ?? []);
        this.threadLoading.set(false);
        this.scrollBottom = true;
        this.api.post<any>(`/parent/messages/conversations/${c.partner_id}/read`, {}).subscribe();
        this.loadUnread();
      },
      error: () => this.threadLoading.set(false),
    });
  }

  closeConv() {
    this.activeConv.set(null);
    this.loadConversations();
  }

  cancelCompose() {
    this.showCompose.set(false);
    this.newBody = '';
    this.newRecipientId = '';
  }

  sendReply() {
    const conv = this.activeConv();
    if (!this.replyBody.trim() || !conv || this.sending()) return;
    const body = this.replyBody.trim();
    this.replyBody = '';
    this.sending.set(true);
    this.sendError.set('');
    this.api.post<any>('/parent/messages', { recipient_id: conv.partner_id, body }).subscribe({
      next: (r: any) => {
        this.messages.update(m => [...m, r.data]);
        this.sending.set(false);
        this.scrollBottom = true;
      },
      error: (err: any) => {
        this.sending.set(false);
        this.replyBody = body;
        this.sendError.set(err?.error?.error?.message ?? 'Failed to send — tap here to dismiss');
      },
    });
  }

  startConversation() {
    if (!this.newRecipientId || !this.newBody.trim() || this.sending()) return;
    this.sending.set(true);
    this.api.post<any>('/parent/messages', {
      recipient_id: this.newRecipientId,
      body: this.newBody.trim(),
    }).subscribe({
      next: () => { this.cancelCompose(); this.sending.set(false); this.loadConversations(); },
      error: () => this.sending.set(false),
    });
  }

  audienceLabel(a: string) {
    return a === 'parents' ? 'Parents' : a === 'class' ? 'Class' : 'School';
  }

  color(name: string) {
    const c = ['#2563EB','#7C3AED','#DB2777','#D97706','#059669','#0891B2'];
    return c[(name?.charCodeAt(0) || 0) % c.length];
  }
}
