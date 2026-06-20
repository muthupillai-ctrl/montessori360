import {
  Component, inject, signal, OnInit, AfterViewChecked,
  ViewChild, ElementRef, ChangeDetectorRef,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { ApiService } from '../../core/services/api.service';

@Component({
  selector: 'app-parent-messages',
  standalone: true,
  imports: [FormsModule, DatePipe],
  template: `
    <!-- ══ THREAD VIEW ══════════════════════════════════════════════ -->
    @if (activeConv()) {
      <div class="thread-wrap">

        <!-- Header -->
        <div class="th-header">
          <button class="back-btn" (click)="closeConv()" aria-label="Back">
            <i class="ti ti-arrow-left"></i>
          </button>
          <div class="av" [style.background]="avatarColor(activeConv()!.partner_name)">
            {{ initials(activeConv()!.partner_name) }}
          </div>
          <div class="th-info">
            <div class="th-name">{{ activeConv()!.partner_name }}</div>
            <div class="th-role">{{ activeConv()!.partner_role ?? 'Staff' }}</div>
          </div>
        </div>

        <!-- Messages -->
        <div class="msg-area" #msgArea>
          @if (threadLoading()) {
            <div class="center-state">
              <div class="spinner"></div>
            </div>
          } @else if (!messages().length) {
            <div class="center-state muted">
              <i class="ti ti-messages" style="font-size:36px;margin-bottom:8px"></i>
              <span>No messages yet.<br>Say hello!</span>
            </div>
          } @else {
            <!-- Date-grouped messages -->
            @for (group of groupedMessages(); track group.date) {
              <div class="date-divider">
                <span>{{ group.label }}</span>
              </div>
              @for (m of group.messages; track m.id) {
                <div class="msg-row" [class.mine]="m.sender_type === 'parent'">
                  @if (m.sender_type !== 'parent') {
                    <div class="av sm" [style.background]="avatarColor(activeConv()!.partner_name)">
                      {{ initials(activeConv()!.partner_name) }}
                    </div>
                  }
                  <div class="bubble" [class.mine]="m.sender_type === 'parent'">
                    <div class="bubble-text">{{ m.body }}</div>
                    <div class="bubble-time">
                      {{ m.created_at | date:'h:mm a' }}
                      @if (m.sender_type === 'parent') {
                        <i class="ti ti-check{{ m.is_read ? 's' : '' }}" style="font-size:11px;margin-left:3px"></i>
                      }
                    </div>
                  </div>
                </div>
              }
            }
          }
        </div>

        <!-- Error toast -->
        @if (sendError()) {
          <div class="err-toast" (click)="sendError.set('')">
            <i class="ti ti-alert-circle"></i>
            {{ sendError() }}
          </div>
        }

        <!-- Reply bar -->
        <div class="reply-bar">
          <textarea #replyInput class="reply-input"
                    [(ngModel)]="replyBody"
                    placeholder="Message…"
                    rows="1"
                    (keydown.enter)="$event.preventDefault(); sendReply()"
                    (input)="autoGrow($event)"
                    (focus)="sendError.set('')">
          </textarea>
          <button class="send-btn"
                  [class.ready]="replyBody.trim()"
                  [disabled]="!replyBody.trim() || sending()"
                  (click)="sendReply()"
                  aria-label="Send">
            <i class="ti ti-send-2"></i>
          </button>
        </div>

      </div>
    }

    <!-- ══ LIST VIEW ════════════════════════════════════════════════ -->
    @if (!activeConv()) {
      <div class="list-wrap">

        <!-- Tabs -->
        <div class="tabs">
          <button class="tab" [class.active]="tab() === 'announcements'"
                  (click)="tab.set('announcements')">
            <i class="ti ti-speakerphone"></i>
            School notices
          </button>
          <button class="tab" [class.active]="tab() === 'messages'"
                  (click)="switchToMessages()">
            <i class="ti ti-messages"></i>
            Messages
            @if (unread() > 0) {
              <span class="tab-badge">{{ unread() }}</span>
            }
          </button>
        </div>

        <div class="list-body">

          <!-- ── Announcements ── -->
          @if (tab() === 'announcements') {
            @if (annLoading()) {
              <div class="center-state"><div class="spinner"></div></div>
            } @else if (!announcements().length) {
              <div class="center-state muted">
                <i class="ti ti-speakerphone" style="font-size:40px;margin-bottom:10px"></i>
                <span>No announcements yet</span>
              </div>
            } @else {
              <div class="ann-list">
                @for (a of announcements(); track a.id) {
                  <div class="ann-card" [class.unread]="!a.is_read">
                    <div class="ann-top">
                      <span class="ann-pill" [attr.data-aud]="a.audience">
                        {{ audienceLabel(a.audience) }}
                      </span>
                      <span class="ann-date">{{ a.published_at | date:'d MMM' }}</span>
                    </div>
                    <div class="ann-title">{{ a.title }}</div>
                    <div class="ann-body">{{ a.body }}</div>
                    @if (a.created_by_name) {
                      <div class="ann-author">
                        <i class="ti ti-user" style="font-size:11px"></i>
                        {{ a.created_by_name }}
                      </div>
                    }
                  </div>
                }
              </div>
            }
          }

          <!-- ── Messages ── -->
          @if (tab() === 'messages') {

            <!-- New message button -->
            <div class="action-bar">
              <button class="compose-btn" (click)="showCompose.set(!showCompose())">
                <i class="ti ti-edit"></i>
                New message
              </button>
            </div>

            <!-- Compose panel -->
            @if (showCompose()) {
              <div class="compose-panel">
                <div class="compose-title">
                  <i class="ti ti-send-2"></i>
                  New message
                </div>

                <label class="field-label">To</label>
                <div class="contact-list">
                  @if (!staffContacts().length) {
                    <div class="muted-sm">Loading contacts…</div>
                  }
                  @for (s of staffContacts(); track s.id) {
                    <button class="contact-row"
                            [class.selected]="newRecipientId === s.id"
                            (click)="newRecipientId = s.id">
                      <div class="av sm" [style.background]="avatarColor(s.name)">
                        {{ initials(s.name) }}
                      </div>
                      <div class="contact-info">
                        <div class="contact-name">{{ s.name }}</div>
                        <div class="contact-role">{{ s.role ?? 'Staff' }}</div>
                      </div>
                      @if (newRecipientId === s.id) {
                        <i class="ti ti-circle-check" style="color:#1D9E75;font-size:18px;margin-left:auto"></i>
                      }
                    </button>
                  }
                </div>

                <label class="field-label">Message</label>
                <textarea class="compose-area"
                          [(ngModel)]="newBody"
                          rows="3"
                          placeholder="Write your message…">
                </textarea>

                <div class="compose-actions">
                  <button class="btn-ghost" (click)="cancelCompose()">Cancel</button>
                  <button class="btn-send"
                          [disabled]="!newRecipientId || !newBody.trim() || sending()"
                          (click)="startConversation()">
                    @if (sending()) {
                      <div class="spinner sm"></div>
                    } @else {
                      <i class="ti ti-send-2"></i>
                    }
                    {{ sending() ? 'Sending…' : 'Send' }}
                  </button>
                </div>
              </div>
            }

            <!-- Conversation list -->
            @if (convLoading()) {
              <div class="center-state"><div class="spinner"></div></div>
            } @else if (!conversations().length) {
              <div class="center-state muted">
                <i class="ti ti-messages" style="font-size:40px;margin-bottom:10px"></i>
                <span>No messages yet</span>
                <span style="font-size:12px;margin-top:4px">Tap New message to reach a teacher</span>
              </div>
            } @else {
              <div class="conv-list">
                @for (c of conversations(); track c.partner_id) {
                  <button class="conv-row" (click)="openConv(c)">
                    <div class="av" [style.background]="avatarColor(c.partner_name)">
                      {{ initials(c.partner_name) }}
                    </div>
                    <div class="conv-body">
                      <div class="conv-top">
                        <span class="conv-name">{{ c.partner_name }}</span>
                        <span class="conv-time">{{ c.last_message_at | date:'d MMM' }}</span>
                      </div>
                      <div class="conv-preview" [class.bold]="c.unread_count > 0">
                        {{ c.last_message }}
                      </div>
                    </div>
                    @if (c.unread_count > 0) {
                      <span class="unread-dot">{{ c.unread_count }}</span>
                    }
                    <i class="ti ti-chevron-right conv-chev"></i>
                  </button>
                }
              </div>
            }

          }
        </div>
      </div>
    }
  `,
  styles: [`
    :host {
      display: flex; flex-direction: column;
      height: 100%; overflow: hidden;
      background: #F5F7FA;
      font-family: -apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', sans-serif;
    }

    /* ── Shared utils ── */
    .center-state {
      display: flex; flex-direction: column;
      align-items: center; justify-content: center;
      flex: 1; padding: 48px 24px;
      color: #98A2B3; font-size: 14px; text-align: center;
    }
    .muted { color: #98A2B3; }
    .muted-sm { font-size: 12px; color: #C0C8D4; padding: 8px 0; }

    .spinner {
      width: 24px; height: 24px; border-radius: 50%;
      border: 2px solid #EAECF0;
      border-top-color: #4F46E5;
      animation: spin .7s linear infinite;
    }
    .spinner.sm { width: 16px; height: 16px; border-width: 2px; }
    @keyframes spin { to { transform: rotate(360deg); } }

    .av {
      width: 42px; height: 42px; border-radius: 50%;
      color: #fff; font-size: 15px; font-weight: 700;
      display: flex; align-items: center; justify-content: center;
      flex-shrink: 0; letter-spacing: .5px;
    }
    .av.sm { width: 30px; height: 30px; font-size: 11px; }

    /* ── Tabs ── */
    .tabs {
      display: flex; flex-shrink: 0;
      background: #fff;
      border-bottom: 1px solid #EAECF0;
    }
    .tab {
      flex: 1; display: flex; align-items: center; justify-content: center;
      gap: 6px; padding: 13px 8px;
      border: none; background: none; cursor: pointer;
      font-size: 13px; font-weight: 600; color: #98A2B3;
      border-bottom: 2px solid transparent; margin-bottom: -1px;
      transition: color .15s, border-color .15s;
    }
    .tab i { font-size: 16px; }
    .tab.active { color: #4F46E5; border-bottom-color: #4F46E5; }
    .tab-badge {
      background: #EF4444; color: #fff;
      font-size: 10px; font-weight: 700;
      padding: 1px 6px; border-radius: 20px;
    }

    /* ══ LIST VIEW ══ */
    .list-wrap { display: flex; flex-direction: column; flex: 1; overflow: hidden; }
    .list-body { flex: 1; overflow-y: auto; }

    /* Announcements */
    .ann-list { padding: 12px 16px; display: flex; flex-direction: column; gap: 10px; }
    .ann-card {
      background: #fff;
      border: 1px solid #EAECF0;
      border-radius: 16px; padding: 14px 16px;
      box-shadow: 0 1px 4px rgba(0,0,0,.04);
      transition: border-color .15s;
    }
    .ann-card.unread { border-left: 3px solid #4F46E5; background: #FAFBFF; }

    .ann-top { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; }
    .ann-pill {
      font-size: 10px; font-weight: 700; padding: 3px 9px;
      border-radius: 20px; text-transform: uppercase; letter-spacing: .04em;
      background: #EEF2FF; color: #4338CA;
    }
    .ann-pill[data-aud="parents"] { background: #ECFDF5; color: #065F46; }
    .ann-pill[data-aud="class"]   { background: #FFFBEB; color: #92400E; }
    .ann-date  { font-size: 11px; color: #98A2B3; }
    .ann-title { font-size: 15px; font-weight: 700; color: #1D2939; margin-bottom: 5px; line-height: 1.3; }
    .ann-body  { font-size: 13px; color: #667085; line-height: 1.6; white-space: pre-wrap; }
    .ann-author {
      display: flex; align-items: center; gap: 4px;
      font-size: 11px; color: #98A2B3; margin-top: 8px;
    }

    /* Action bar */
    .action-bar {
      padding: 12px 16px 8px;
      display: flex; justify-content: flex-end;
    }
    .compose-btn {
      display: flex; align-items: center; gap: 6px;
      background: #4F46E5; color: #fff;
      border: none; border-radius: 22px;
      padding: 9px 18px; font-size: 13px; font-weight: 600;
      cursor: pointer; transition: opacity .15s;
      box-shadow: 0 2px 8px rgba(79,70,229,.3);
    }
    .compose-btn:hover { opacity: .9; }
    .compose-btn i { font-size: 15px; }

    /* Compose panel */
    .compose-panel {
      margin: 0 16px 12px;
      background: #fff;
      border: 1px solid #EAECF0;
      border-radius: 16px; padding: 16px;
      display: flex; flex-direction: column; gap: 10px;
      box-shadow: 0 2px 8px rgba(0,0,0,.06);
    }
    .compose-title {
      display: flex; align-items: center; gap: 7px;
      font-size: 14px; font-weight: 700; color: #1D2939;
      margin-bottom: 2px;
    }
    .compose-title i { color: #4F46E5; font-size: 16px; }

    .field-label {
      font-size: 11px; font-weight: 700; text-transform: uppercase;
      letter-spacing: .05em; color: #98A2B3;
    }

    .contact-list {
      display: flex; flex-direction: column;
      border: 1px solid #EAECF0; border-radius: 10px; overflow: hidden;
    }
    .contact-row {
      display: flex; align-items: center; gap: 10px;
      padding: 10px 12px; border: none; background: #fff;
      cursor: pointer; text-align: left; border-bottom: 1px solid #F9FAFB;
      transition: background .1s;
    }
    .contact-row:last-child { border-bottom: none; }
    .contact-row:hover { background: #F9FAFB; }
    .contact-row.selected { background: #EEF2FF; }
    .contact-name { font-size: 13px; font-weight: 600; color: #1D2939; }
    .contact-role { font-size: 11px; color: #98A2B3; margin-top: 1px; }

    .compose-area {
      width: 100%; border: 1.5px solid #EAECF0; border-radius: 10px;
      padding: 10px 12px; font-size: 13px; font-family: inherit;
      background: #F9FAFB; color: #1D2939;
      resize: none; outline: none; box-sizing: border-box;
      transition: border-color .15s;
    }
    .compose-area:focus { border-color: #4F46E5; background: #fff; }

    .compose-actions { display: flex; gap: 8px; justify-content: flex-end; }
    .btn-ghost {
      padding: 9px 16px; border-radius: 10px;
      border: 1px solid #EAECF0; background: transparent;
      font-size: 13px; font-weight: 600; cursor: pointer; color: #667085;
    }
    .btn-send {
      display: flex; align-items: center; gap: 6px;
      padding: 9px 18px; border-radius: 10px; border: none;
      background: #4F46E5; color: #fff;
      font-size: 13px; font-weight: 600; cursor: pointer;
      transition: opacity .15s;
    }
    .btn-send:disabled { opacity: .45; cursor: not-allowed; }
    .btn-send i { font-size: 15px; }

    /* Conversation list */
    .conv-list { display: flex; flex-direction: column; }
    .conv-row {
      display: flex; align-items: center; gap: 12px;
      padding: 13px 16px;
      border: none; background: transparent; cursor: pointer;
      text-align: left; border-bottom: 1px solid #F2F4F7;
      transition: background .1s; width: 100%;
    }
    .conv-row:hover { background: #fff; }
    .conv-body { flex: 1; min-width: 0; }
    .conv-top { display: flex; align-items: baseline; justify-content: space-between; gap: 8px; }
    .conv-name { font-size: 14px; font-weight: 700; color: #1D2939; }
    .conv-time { font-size: 11px; color: #98A2B3; white-space: nowrap; }
    .conv-preview {
      font-size: 12px; color: #98A2B3; margin-top: 2px;
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }
    .conv-preview.bold { font-weight: 600; color: #344054; }
    .unread-dot {
      background: #4F46E5; color: #fff;
      font-size: 10px; font-weight: 700;
      min-width: 20px; height: 20px; border-radius: 10px;
      display: flex; align-items: center; justify-content: center;
      padding: 0 5px; flex-shrink: 0;
    }
    .conv-chev { font-size: 16px; color: #D0D5DD; flex-shrink: 0; }

    /* ══ THREAD VIEW ══ */
    .thread-wrap { display: flex; flex-direction: column; flex: 1; overflow: hidden; }

    .th-header {
      display: flex; align-items: center; gap: 10px;
      padding: 12px 16px; flex-shrink: 0;
      background: #fff; border-bottom: 1px solid #EAECF0;
      box-shadow: 0 1px 4px rgba(0,0,0,.04);
    }
    .back-btn {
      background: #F5F7FA; border: 1px solid #EAECF0; cursor: pointer; padding: 6px 8px;
      color: #667085; display: flex; align-items: center;
      border-radius: 10px; transition: background .1s;
    }
    .back-btn:hover { background: #EEF2FF; color: #4F46E5; }
    .back-btn i { font-size: 20px; }
    .th-info { flex: 1; min-width: 0; }
    .th-name { font-size: 15px; font-weight: 700; color: #1D2939; }
    .th-role { font-size: 11px; color: #98A2B3; margin-top: 1px; }

    .msg-area {
      flex: 1; overflow-y: auto;
      padding: 16px 14px;
      display: flex; flex-direction: column; gap: 4px;
      background: #F5F7FA;
    }

    /* Date divider */
    .date-divider {
      display: flex; align-items: center; gap: 10px;
      margin: 10px 0 6px; font-size: 11px; font-weight: 600; color: #98A2B3;
    }
    .date-divider::before,
    .date-divider::after {
      content: ''; flex: 1;
      height: 1px; background: #EAECF0;
    }

    /* Message bubbles */
    .msg-row {
      display: flex; align-items: flex-end; gap: 8px;
      margin-bottom: 3px;
    }
    .msg-row.mine { flex-direction: row-reverse; }

    .bubble {
      max-width: 72%; padding: 10px 13px;
      border-radius: 18px; border-bottom-left-radius: 5px;
      background: #fff; border: 1px solid #EAECF0;
      box-shadow: 0 1px 3px rgba(0,0,0,.05);
    }
    .bubble.mine {
      background: #4F46E5; border-color: transparent;
      border-bottom-left-radius: 18px; border-bottom-right-radius: 5px;
    }
    .bubble-text {
      font-size: 14px; line-height: 1.45; color: #1D2939;
      white-space: pre-wrap; word-break: break-word;
    }
    .bubble.mine .bubble-text { color: #fff; }
    .bubble-time {
      font-size: 10px; color: #98A2B3;
      margin-top: 4px; text-align: right;
      display: flex; align-items: center; justify-content: flex-end; gap: 2px;
    }
    .bubble.mine .bubble-time { color: rgba(255,255,255,.6); }

    /* Error toast */
    .err-toast {
      flex-shrink: 0; display: flex; align-items: center; gap: 6px;
      padding: 10px 16px; font-size: 12px;
      color: #791F1F; background: #FCEBEB; border-top: 1px solid #F7C1C1;
      cursor: pointer;
    }
    .err-toast i { font-size: 14px; flex-shrink: 0; }

    /* Reply bar */
    .reply-bar {
      flex-shrink: 0; display: flex; align-items: flex-end; gap: 10px;
      padding: 10px 14px; background: #fff;
      border-top: 1px solid #EAECF0;
    }
    .reply-input {
      flex: 1; border: 1.5px solid #EAECF0; border-radius: 22px;
      padding: 10px 16px; font-size: 14px; font-family: inherit;
      background: #F5F7FA; color: #1D2939;
      outline: none; resize: none; max-height: 120px;
      line-height: 1.4; transition: border-color .15s;
      overflow-y: auto;
    }
    .reply-input:focus { border-color: #4F46E5; background: #fff; }

    .send-btn {
      width: 44px; height: 44px; border-radius: 50%; border: none;
      flex-shrink: 0; background: #EAECF0; color: #98A2B3;
      cursor: not-allowed; display: flex; align-items: center; justify-content: center;
      transition: background .2s, color .2s; font-size: 20px;
    }
    .send-btn.ready {
      background: #4F46E5; color: #fff; cursor: pointer;
      box-shadow: 0 2px 8px rgba(79,70,229,.35);
    }
    .send-btn:disabled:not(.ready) { opacity: .5; }
  `],
})
export class ParentMessagesComponent implements OnInit, AfterViewChecked {
  private api = inject(ApiService);
  private cdr = inject(ChangeDetectorRef);

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
  private shouldScrollBottom = false;

  // ── Lifecycle ──────────────────────────────────────────────────────────────

  ngOnInit() {
    this.loadAnnouncements();
    this.loadUnread();
  }

  ngAfterViewChecked() {
    if (this.shouldScrollBottom && this.msgArea) {
      const el = this.msgArea.nativeElement;
      el.scrollTop = el.scrollHeight;
      this.shouldScrollBottom = false;
    }
  }

  // ── Data loaders ───────────────────────────────────────────────────────────

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
    if (!this.staffContacts().length)  this.loadStaffContacts();
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
        this.shouldScrollBottom = true;
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

  // ── Actions ────────────────────────────────────────────────────────────────

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
        this.shouldScrollBottom = true;
      },
      error: (err: any) => {
        this.sending.set(false);
        this.replyBody = body;
        this.sendError.set(err?.error?.error?.message ?? 'Could not send — tap to dismiss');
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
      next: () => {
        this.cancelCompose();
        this.sending.set(false);
        this.loadConversations();
      },
      error: () => this.sending.set(false),
    });
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  groupedMessages(): { date: string; label: string; messages: any[] }[] {
    const msgs = this.messages();
    if (!msgs.length) return [];

    const groups: Record<string, any[]> = {};
    for (const m of msgs) {
      const d = m.created_at?.slice(0, 10) ?? 'unknown';
      if (!groups[d]) groups[d] = [];
      groups[d].push(m);
    }

    const today    = new Date().toISOString().slice(0, 10);
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);

    return Object.entries(groups).map(([date, messages]) => ({
      date,
      label: date === today ? 'Today' : date === yesterday ? 'Yesterday'
             : new Date(date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }),
      messages,
    }));
  }

  autoGrow(event: Event) {
    const el = event.target as HTMLTextAreaElement;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 120) + 'px';
  }

  audienceLabel(a: string) {
    return a === 'parents' ? 'Parents' : a === 'class' ? 'Class' : 'School';
  }

  initials(name: string) {
    return (name ?? '?').split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
  }

  avatarColor(name: string) {
    const palette = ['#185FA5','#534AB7','#993556','#854F0B','#0F6E56','#993C1D'];
    return palette[(name?.charCodeAt(0) ?? 0) % palette.length];
  }
}
