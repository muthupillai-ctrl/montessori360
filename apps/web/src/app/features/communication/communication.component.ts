import { Component, inject, signal, OnInit, computed } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTabsModule } from '@angular/material/tabs';
import { MatMenuModule } from '@angular/material/menu';
import { MatSnackBar } from '@angular/material/snack-bar';
import { DatePipe, TitleCasePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/services/api.service';
import { MatDialog } from '@angular/material/dialog';
import { NewMessageDialogComponent } from './new-message-dialog.component';
import { AuthService } from '../../core/services/auth.service';
import type { Announcement, Conversation } from '../../core/models';

@Component({
  selector: 'app-communication',
  standalone: true,
  imports: [
    ReactiveFormsModule, FormsModule, MatIconModule, MatProgressSpinnerModule,
    MatTabsModule, MatMenuModule, DatePipe, TitleCasePipe,
  ],
  template: `
    <mat-tab-group class="comm-page-tabs" [selectedIndex]="selectedTabIndex()" (selectedTabChange)="onTabChange($event.index)">

      <!-- ── Announcements ────────────────────────────────── -->
      <mat-tab label="📢  Announcements">
        <div class="tab-body">

          <div class="page-header">
            <div>
              <h1>Communication</h1>
              <div class="subtitle">
                {{ announcements().length }} announcements
                @if (unreadCount() > 0) { · {{ unreadCount() }} unread messages }
              </div>
            </div>
            <button class="btn-primary-custom" (click)="showCompose.set(!showCompose())">
              <mat-icon style="font-size:16px;width:16px;height:16px">campaign</mat-icon>
              New Announcement
            </button>
          </div>

          <!-- Compose panel -->
          @if (showCompose()) {
            <div class="compose-panel">
              <div class="cp-header">
                <div class="cp-title">
                  <mat-icon style="font-size:16px;width:16px;height:16px;color:var(--blue)">campaign</mat-icon>
                  New Announcement
                </div>
                <button class="cp-close" (click)="showCompose.set(false)">
                  <mat-icon style="font-size:18px;width:18px;height:18px">close</mat-icon>
                </button>
              </div>

              <form [formGroup]="annForm" class="cp-form">
                <div class="form-row">
                  <div class="field-group fill">
                    <label class="field-label">Title <span class="req">*</span></label>
                    <input class="field-input" formControlName="title" placeholder="e.g. School will be closed on Friday">
                  </div>
                  <div class="field-group w-200">
                    <label class="field-label">Audience</label>
                    <select class="field-input" formControlName="audience">
                      <option value="all">All (Staff + Parents)</option>
                      <option value="parents">Parents Only</option>
                      <option value="staff">Staff Only</option>
                    </select>
                  </div>
                </div>

                <div class="field-group">
                  <label class="field-label">Message <span class="req">*</span></label>
                  <textarea class="field-input field-textarea" formControlName="body" rows="4"
                            placeholder="Write your announcement…"></textarea>
                </div>

                <div class="cp-actions">
                  <button type="button" class="btn-ghost" (click)="showCompose.set(false)">Cancel</button>
                  <button type="button" class="btn-outline" (click)="saveDraft()" [disabled]="annForm.invalid || submitting()">
                    <mat-icon style="font-size:14px;width:14px;height:14px">save</mat-icon>
                    Save Draft
                  </button>
                  <button type="button" class="btn-primary" (click)="submitAnnouncement(true)" [disabled]="annForm.invalid || submitting()">
                    @if (submitting()) {
                      <mat-progress-spinner diameter="14" mode="indeterminate"
                        style="--mdc-circular-progress-active-indicator-color:#fff"/>
                    } @else {
                      <mat-icon style="font-size:14px;width:14px;height:14px">send</mat-icon>
                    }
                    Publish Now
                  </button>
                </div>
              </form>
            </div>
          }

          <!-- Filters -->
          <div class="filter-bar">
            @if (isAdmin()) {
              <select class="filter-select" [value]="annAudience()"
                      (change)="annAudience.set($any($event.target).value); loadAnnouncements()">
                <option value="">All Audiences</option>
                <option value="parents">Parents</option>
                <option value="staff">Staff</option>
                <option value="all">All (Staff + Parents)</option>
              </select>
            }
            <select class="filter-select" [value]="annStatus()"
                    (change)="annStatus.set($any($event.target).value); loadAnnouncements()">
              <option value="">All Status</option>
              <option value="published">Published</option>
              <option value="draft">Drafts</option>
            </select>
            <button class="icon-btn" (click)="loadAnnouncements()">
              <mat-icon style="font-size:18px;width:18px;height:18px">refresh</mat-icon>
            </button>
          </div>

          @if (annLoading()) {
            <div class="loading-state">
              <mat-progress-spinner mode="indeterminate" diameter="28" />
              <span>Loading…</span>
            </div>
          } @else if (!announcements().length) {
            <div class="empty-state">
              <div class="empty-icon">📢</div>
              <div class="empty-title">No announcements yet</div>
              <div class="empty-sub">Create your first announcement to communicate with parents and staff.</div>

            </div>
          } @else {
            <div class="ann-list">
              @for (ann of announcements(); track ann.id) {
                <div class="ann-card">
                  <div class="ac-left">
                    <div class="ac-icon" [class.published]="ann.published_at">
                      <mat-icon style="font-size:18px;width:18px;height:18px">
                        {{ ann.published_at ? 'campaign' : 'draft' }}
                      </mat-icon>
                    </div>
                  </div>
                  <div class="ac-body">
                    <div class="ac-top">
                      <div class="ac-title">{{ ann.title }}</div>
                      <div class="ac-badges">
                        <span [class]="ann.published_at ? 'status-badge published' : 'status-badge draft'">
                          {{ ann.published_at ? 'Published' : 'Draft' }}
                        </span>
                        <span class="audience-badge">{{ ann.audience | titlecase }}</span>
                      </div>
                    </div>
                    <div class="ac-message">{{ ann.body }}</div>
                    <div class="ac-meta">
                      <mat-icon style="font-size:12px;width:12px;height:12px">person</mat-icon>
                      {{ ann.author_name ?? 'Admin' }}
                      <span class="meta-dot">·</span>
                      <mat-icon style="font-size:12px;width:12px;height:12px">schedule</mat-icon>
                      {{ ann.created_at | date:'d MMM yyyy, h:mm a' }}
                      @if (ann.published_at) {
                        <span class="meta-dot">·</span>
                        <mat-icon style="font-size:12px;width:12px;height:12px">send</mat-icon>
                        Published {{ ann.published_at | date:'d MMM, h:mm a' }}
                      }
                    </div>
                  </div>
                  <div class="ac-actions">
                    @if (!ann.published_at) {
                      <button class="btn-outline-sm" (click)="publish(ann)">
                        <mat-icon style="font-size:13px;width:13px;height:13px">send</mat-icon>
                        Publish
                      </button>
                    }
                    <button class="ac-delete" (click)="deleteAnn(ann)" title="Delete">
                      <mat-icon style="font-size:16px;width:16px;height:16px">delete</mat-icon>
                    </button>
                  </div>
                </div>
              }
            </div>
          }
        </div>
      </mat-tab>

      <!-- ── Circulars ─────────────────────────────────────── -->
      <mat-tab label="📋  Circulars">
        <div class="tab-body">

          <div class="page-header">
            <div>
              <div style="font-size:15px;font-weight:600;color:var(--text)">Circulars</div>
              <div class="subtitle">Documents requiring acknowledgement from parents or staff</div>
            </div>
            <button class="btn-primary-custom" (click)="showCircularCompose.set(!showCircularCompose())">
              <mat-icon style="font-size:16px;width:16px;height:16px">post_add</mat-icon>
              New Circular
            </button>
          </div>

          <!-- Circular compose -->
          @if (showCircularCompose()) {
            <div class="compose-panel">
              <div class="cp-header">
                <div class="cp-title">
                  <mat-icon style="font-size:16px;width:16px;height:16px;color:var(--purple)">post_add</mat-icon>
                  New Circular
                </div>
                <button class="cp-close" (click)="showCircularCompose.set(false)">
                  <mat-icon style="font-size:18px;width:18px;height:18px">close</mat-icon>
                </button>
              </div>

              <form [formGroup]="circularForm" class="cp-form">
                <div class="form-row">
                  <div class="field-group fill">
                    <label class="field-label">Title <span class="req">*</span></label>
                    <input class="field-input" formControlName="title" placeholder="e.g. Fee Structure 2025-26">
                  </div>
                  <div class="field-group w-200">
                    <label class="field-label">Audience</label>
                    <select class="field-input" formControlName="audience">
                      <option value="all">All</option>
                      <option value="parents">Parents Only</option>
                      <option value="staff">Staff Only</option>
                    </select>
                  </div>
                </div>
                <div class="field-group">
                  <label class="field-label">Content <span class="req">*</span></label>
                  <textarea class="field-input field-textarea" formControlName="body" rows="4"
                            placeholder="Write the circular content…"></textarea>
                </div>
                <div class="requires-ack-row"
                     (click)="circularForm.patchValue({ requires_ack: !circularForm.value.requires_ack })">
                  <div class="toggle-track" [class.on]="circularForm.value.requires_ack">
                    <div class="toggle-thumb"></div>
                  </div>
                  <div>
                    <div class="rar-label">Requires Acknowledgement</div>
                    <div class="rar-desc">Recipients must confirm they have read this circular</div>
                  </div>
                </div>
                <div class="cp-actions">
                  <button type="button" class="btn-ghost" (click)="showCircularCompose.set(false)">Cancel</button>
                  <button type="button" class="btn-primary" (click)="submitCircular()" [disabled]="circularForm.invalid || circSubmitting()">
                    <mat-icon style="font-size:14px;width:14px;height:14px">send</mat-icon>
                    Publish Circular
                  </button>
                </div>
              </form>
            </div>
          }

          @if (circLoading()) {
            <div class="loading-state">
              <mat-progress-spinner mode="indeterminate" diameter="28" />
            </div>
          } @else if (!circulars().length) {
            <div class="empty-state">
              <div class="empty-icon">📋</div>
              <div class="empty-title">No circulars yet</div>
              <div class="empty-sub">Create circulars for documents that need parent or staff acknowledgement.</div>
            </div>
          } @else {
            <div class="ann-list">
              @for (c of circulars(); track c.id) {
                <div class="ann-card">
                  <div class="ac-left">
                    <div class="ac-icon circular" [class.published]="c.published_at">
                      <mat-icon style="font-size:18px;width:18px;height:18px">description</mat-icon>
                    </div>
                  </div>
                  <div class="ac-body">
                    <div class="ac-top">
                      <div class="ac-title">{{ c.title }}</div>
                      <div class="ac-badges">
                        <span [class]="c.published_at ? 'status-badge published' : 'status-badge draft'">
                          {{ c.published_at ? 'Published' : 'Draft' }}
                        </span>
                        @if (c.requires_ack) {
                          <span class="ack-badge">Requires Acknowledgement</span>
                        }
                        <span class="audience-badge">{{ c.audience | titlecase }}</span>
                      </div>
                    </div>
                    <div class="ac-message">{{ c.body }}</div>
                    @if (c.requires_ack) {
                      <div class="ack-progress">
                        <div class="ack-track">
                          <div class="ack-fill"
                               [style.width.%]="c.total_recipients ? (c.acknowledged_count / c.total_recipients * 100) : 0"></div>
                        </div>
                        <span class="ack-label">
                          @if (isAdmin()) {
                            {{ c.acknowledged_count ?? 0 }}/{{ c.total_recipients ?? '?' }} recipients acknowledged
                          } @else if (c.user_acknowledged) {
                            You acknowledged this
                          } @else {
                            Requires your acknowledgement
                          }
                        </span>
                      </div>
                    }
                    <div class="ac-meta">
                      <mat-icon style="font-size:12px;width:12px;height:12px">person</mat-icon>
                      {{ c.author_name ?? 'Admin' }}
                      <span class="meta-dot">·</span>
                      {{ c.created_at | date:'d MMM yyyy' }}
                    </div>
                  </div>
                  @if (c.requires_ack && c.published_at && !isAdmin()) {
                    <div class="ac-actions">
                      @if (c.user_acknowledged) {
                        <div class="ack-done">
                          <mat-icon style="font-size:14px;width:14px;height:14px">check_circle</mat-icon>
                          Acknowledged
                        </div>
                      } @else {
                        <button class="btn-ack" (click)="acknowledge(c)">
                          <mat-icon style="font-size:14px;width:14px;height:14px">check_circle_outline</mat-icon>
                          Acknowledge
                        </button>
                      }
                    </div>
                  }
                </div>
              }
            </div>
          }
        </div>
      </mat-tab>

      <!-- ── Messages ──────────────────────────────────────── -->
      <mat-tab label="💬  Messages">
        <div class="tab-body" style="padding-top:0">

          <div class="msg-layout">
            <!-- Conversation list -->
            <div class="conv-list">
              <div class="conv-list-header">
                <div class="conv-search">
                  <mat-icon style="font-size:15px;width:15px;height:15px;color:var(--text-3)">search</mat-icon>
                  <input class="conv-search-input" [(ngModel)]="msgSearch" placeholder="Search…">
                </div>
                <button class="new-msg-btn" (click)="openNewMessage()" title="New Message">
                  <mat-icon style="font-size:18px;width:18px;height:18px">edit</mat-icon>
                </button>
              </div>

              <div class="conv-list-body">
                @if (convLoading()) {
                  <div class="conv-empty">
                    <mat-progress-spinner mode="indeterminate" diameter="24" />
                  </div>
                } @else if (!filteredConversations().length) {
                  <div class="conv-empty">
                    <mat-icon style="font-size:32px;width:32px;height:32px;color:var(--border)">forum</mat-icon>
                    <span>No conversations yet</span>
                    <button class="start-btn" (click)="openNewMessage()">Start one</button>
                  </div>
                } @else {
                  @for (conv of filteredConversations(); track conv.partner_id) {
                    <div class="conv-item" [class.active]="activeConv()?.partner_id === conv.partner_id"
                         (click)="openConversation(conv)">
                      <div class="ci-av" [style.background]="getAvatarColor(conv.partner_name)">
                        {{ conv.partner_name[0] }}
                      </div>
                      <div class="ci-body">
                        <div class="ci-top">
                          <div class="ci-name">{{ conv.partner_name }}</div>
                          <div class="ci-time">{{ conv.last_message_at | date:'d MMM' }}</div>
                        </div>
                        <div class="ci-preview">{{ conv.last_message }}</div>
                      </div>
                      @if (conv.unread_count > 0) {
                        <div class="ci-unread">{{ conv.unread_count }}</div>
                      }
                    </div>
                  }
                }
              </div>
            </div>

            <!-- Message thread -->
            <div class="msg-thread">
              @if (!activeConv()) {
                <div class="thread-empty">
                  <mat-icon style="font-size:48px;width:48px;height:48px;color:var(--border)">chat</mat-icon>
                  <div class="te-title">Select a conversation</div>
                  <div class="te-sub">Choose from the list or start a new conversation</div>
                  <button class="btn-primary-custom" (click)="openNewMessage()">
                    <mat-icon style="font-size:15px;width:15px;height:15px">edit</mat-icon>
                    New Message
                  </button>
                </div>
              } @else {
                <!-- Thread header -->
                <div class="thread-header">
                  <div class="th-av" [style.background]="getAvatarColor(activeConv()!.partner_name)">
                    {{ activeConv()!.partner_name[0] }}
                  </div>
                  <div>
                    <div class="th-name">{{ activeConv()!.partner_name }}</div>
                    <div class="th-type">{{ activeConv()!.partner_type | titlecase }}</div>
                  </div>
                </div>

                <!-- Messages -->
                <div class="messages-scroll" #messagesScroll>
                  @if (msgsLoading()) {
                    <div class="loading-state"><mat-progress-spinner mode="indeterminate" diameter="24" /></div>
                  }
                  @for (msg of messages(); track msg.id) {
                    <div class="msg-bubble-wrap" [class.sent]="msg.sender_id === currentUserId()">
                      <div class="msg-bubble" [class.sent]="msg.sender_id === currentUserId()">
                        {{ msg.body }}
                        <div class="msg-time">{{ msg.created_at | date:'h:mm a' }}</div>
                      </div>
                    </div>
                  }
                </div>

                <!-- Reply box -->
                <div class="reply-box">
                  <textarea class="reply-input" [(ngModel)]="replyText" rows="2"
                            placeholder="Type a message…"
                            (keydown.enter)="$event.preventDefault(); sendMessage()"></textarea>
                  <button class="reply-send" [disabled]="!replyText.trim() || sending()"
                          (click)="sendMessage()">
                    @if (sending()) {
                      <mat-progress-spinner diameter="18" mode="indeterminate"
                        style="--mdc-circular-progress-active-indicator-color:#fff"/>
                    } @else {
                      <mat-icon style="font-size:20px;width:20px;height:20px">send</mat-icon>
                    }
                  </button>
                </div>
              }
            </div>
          </div>
        </div>
      </mat-tab>

    </mat-tab-group>
  `,
  styles: [`
    ::ng-deep .comm-page-tabs .mat-mdc-tab-body-wrapper { padding: 0; }
    .tab-body { padding-top: 16px; }

    /* Buttons */
    .btn-primary-custom {
      display: inline-flex; align-items: center; gap: 6px;
      background: var(--blue); color: #fff;
      border: none; border-radius: 8px; padding: 0 16px; height: 36px;
      font-size: 13px; font-weight: 500; cursor: pointer;
      &:hover:not(:disabled) { background: #1D4ED8; }
      &:disabled { opacity: .6; cursor: not-allowed; }
    }
    .btn-outline-sm {
      display: inline-flex; align-items: center; gap: 4px;
      background: #fff; color: var(--text-2); border: 1px solid var(--border);
      border-radius: 7px; padding: 0 10px; height: 30px; font-size: 12px; cursor: pointer;
      &:hover { background: var(--bg); }
    }
    .btn-ghost {
      background: none; border: none; cursor: pointer;
      font-size: 13px; color: var(--text-3); padding: 0 10px; height: 36px; border-radius: 7px;
      &:hover { background: var(--border-light); }
    }
    .btn-outline {
      display: inline-flex; align-items: center; gap: 5px;
      background: #fff; color: var(--text-2); border: 1px solid var(--border);
      border-radius: 8px; height: 36px; padding: 0 14px; font-size: 13px; cursor: pointer;
      &:hover:not(:disabled) { background: var(--bg); }
      &:disabled { opacity: .6; cursor: not-allowed; }
    }
    .btn-primary {
      display: inline-flex; align-items: center; gap: 6px;
      background: var(--blue); color: #fff; border: none;
      border-radius: 8px; height: 36px; padding: 0 18px;
      font-size: 13px; font-weight: 500; cursor: pointer;
      &:hover:not(:disabled) { background: #1D4ED8; }
      &:disabled { opacity: .6; cursor: not-allowed; }
    }

    /* Filters */
    .filter-bar { display: flex; gap: 8px; margin-bottom: 14px; }
    .filter-select {
      height: 34px; padding: 0 10px;
      background: var(--surface); border: 1px solid var(--border);
      border-radius: 8px; font-size: 13px; color: var(--text-2); outline: none; cursor: pointer;
    }
    .icon-btn {
      width: 34px; height: 34px; border-radius: 8px;
      background: var(--surface); border: 1px solid var(--border);
      display: flex; align-items: center; justify-content: center;
      cursor: pointer; color: var(--text-3);
      &:hover { background: var(--bg); }
    }

    /* Compose panel */
    .compose-panel {
      background: var(--surface); border: 1px solid var(--blue);
      border-radius: 10px; margin-bottom: 16px; overflow: hidden;
    }
    .cp-header {
      display: flex; align-items: center; justify-content: space-between;
      padding: 12px 16px; background: var(--blue-light); border-bottom: 1px solid var(--border);
    }
    .cp-title { display: flex; align-items: center; gap: 7px; font-size: 13px; font-weight: 600; color: var(--text); }
    .cp-close {
      background: none; border: none; cursor: pointer; color: var(--text-3);
      width: 26px; height: 26px; border-radius: 5px; display: flex; align-items: center; justify-content: center;
      &:hover { background: var(--border); }
    }
    .cp-form { padding: 14px 16px; display: flex; flex-direction: column; gap: 12px; }
    .form-row   { display: flex; gap: 10px; }
    .fill       { flex: 1; min-width: 0; }
    .w-200      { width: 200px; flex-shrink: 0; }
    .field-group { display: flex; flex-direction: column; gap: 4px; }
    .field-label {
      font-size: 12px; font-weight: 500; color: var(--text-2);
      .req { color: var(--red); }
    }
    .field-input {
      height: 36px; padding: 0 10px; width: 100%;
      background: var(--bg); border: 1px solid var(--border);
      border-radius: 7px; font-size: 13px; color: var(--text);
      outline: none; font-family: inherit;
      &:focus { border-color: var(--blue); background: #fff; }
    }
    select.field-input { cursor: pointer; }
    .field-textarea { height: auto; padding: 8px 10px; resize: vertical; }
    .cp-actions { display: flex; justify-content: flex-end; gap: 8px; padding-top: 4px; }

    /* Requires ack toggle */
    .requires-ack-row {
      display: flex; align-items: center; gap: 12px; cursor: pointer;
      padding: 10px; background: var(--bg); border-radius: 8px;
    }
    .rar-label { font-size: 13px; font-weight: 500; color: var(--text); }
    .rar-desc  { font-size: 11px; color: var(--text-3); }
    .toggle-track {
      width: 34px; height: 19px; border-radius: 10px; background: var(--border);
      position: relative; transition: background .2s; flex-shrink: 0;
      &.on { background: var(--green); }
    }
    .toggle-thumb {
      width: 15px; height: 15px; border-radius: 50%; background: #fff;
      position: absolute; top: 2px; left: 2px; transition: left .2s;
      box-shadow: 0 1px 3px rgba(0,0,0,.2);
      .toggle-track.on & { left: 17px; }
    }

    /* Loading / Empty */
    .loading-state {
      display: flex; align-items: center; gap: 10px; justify-content: center;
      padding: 48px; color: var(--text-3); font-size: 13px;
    }
    .empty-state {
      display: flex; flex-direction: column; align-items: center; gap: 10px;
      padding: 60px; color: var(--text-3);
      .empty-icon  { font-size: 40px; }
      .empty-title { font-size: 15px; font-weight: 600; color: var(--text-2); }
      .empty-sub   { font-size: 13px; text-align: center; max-width: 320px; }
    }

    /* Announcement cards */
    .ann-list { display: flex; flex-direction: column; gap: 10px; }
    .ann-card {
      display: flex; gap: 14px; align-items: flex-start;
      background: var(--surface); border: 1px solid var(--border);
      border-radius: 10px; padding: 14px 16px;
      transition: box-shadow .15s;
      &:hover { box-shadow: 0 2px 8px rgba(0,0,0,.06); }
    }
    .ac-icon {
      width: 38px; height: 38px; border-radius: 9px; flex-shrink: 0;
      background: var(--amber-light); color: var(--amber);
      display: flex; align-items: center; justify-content: center;
      &.published { background: var(--blue-light); color: var(--blue); }
      &.circular  { background: var(--purple-light); color: var(--purple); }
      &.circular.published { background: var(--green-light); color: var(--green); }
    }
    .ac-body   { flex: 1; min-width: 0; }
    .ac-top    { display: flex; justify-content: space-between; align-items: flex-start; gap: 8px; margin-bottom: 6px; }
    .ac-title  { font-size: 14px; font-weight: 600; color: var(--text); }
    .ac-badges { display: flex; gap: 5px; flex-shrink: 0; flex-wrap: wrap; }
    .status-badge {
      font-size: 10px; font-weight: 600; padding: 2px 8px; border-radius: 10px;
      &.published { background: var(--green-light);  color: #065F46; }
      &.draft     { background: var(--amber-light);  color: #92400E; }
    }
    .audience-badge {
      font-size: 10px; font-weight: 500; padding: 2px 8px; border-radius: 10px;
      background: var(--bg); color: var(--text-3);
    }
    .ack-badge {
      font-size: 10px; font-weight: 500; padding: 2px 8px; border-radius: 10px;
      background: var(--purple-light); color: var(--purple);
    }
    .ac-message { font-size: 13px; color: var(--text-2); line-height: 1.6; margin-bottom: 8px; }
    .ac-meta {
      display: flex; align-items: center; gap: 4px; font-size: 11px; color: var(--text-3);
    }
    .meta-dot { margin: 0 2px; }

    .ack-progress { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
    .ack-track { flex: 1; max-width: 160px; height: 5px; background: var(--border); border-radius: 3px; overflow: hidden; }
    .ack-fill  { height: 100%; background: var(--green); border-radius: 3px; transition: width .3s; }
    .ack-label { font-size: 11px; color: var(--text-3); }

    .ac-actions { display: flex; align-items: center; gap: 6px; flex-shrink: 0; }
    .btn-ack {
      display: inline-flex; align-items: center; gap: 5px;
      background: var(--green); color: #fff; border: none;
      border-radius: 7px; padding: 0 12px; height: 30px;
      font-size: 12px; font-weight: 500; cursor: pointer;
      &:hover { background: #059669; }
    }
    .ack-done {
      display: inline-flex; align-items: center; gap: 5px;
      background: var(--green-light); color: #065F46;
      border-radius: 7px; padding: 0 12px; height: 30px;
      font-size: 12px; font-weight: 600;
    }
    .ac-delete {
      background: none; border: none; cursor: pointer; color: var(--text-3);
      width: 30px; height: 30px; border-radius: 6px;
      display: flex; align-items: center; justify-content: center;
      &:hover { background: var(--red-light); color: var(--red); }
    }

    /* Messages layout */
    .msg-layout {
      display: grid; grid-template-columns: 280px 1fr;
      height: calc(100vh - 180px); min-height: 500px;
      background: var(--surface); border: 1px solid var(--border);
      border-radius: 10px; overflow: hidden;
    }

    /* Conversation list */
    .conv-list {
      border-right: 1px solid var(--border);
      display: flex; flex-direction: column; overflow: hidden;
    }
    .conv-list-header {
      display: flex; gap: 6px; padding: 10px;
      border-bottom: 1px solid var(--border); background: var(--bg); flex-shrink: 0;
    }
    .new-msg-btn {
      width: 34px; height: 34px; flex-shrink: 0; border-radius: 8px;
      background: var(--blue); color: #fff; border: none; cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      &:hover { background: #1D4ED8; }
    }
    .conv-search {
      display: flex; align-items: center; gap: 6px; flex: 1;
      background: #fff; border: 1px solid var(--border);
      border-radius: 7px; padding: 0 8px; height: 34px;
    }
    .conv-search-input {
      border: none; outline: none; background: none;
      font-size: 12.5px; color: var(--text); flex: 1; font-family: inherit;
      &::placeholder { color: var(--text-4); }
    }
    .conv-list-body { flex: 1; overflow-y: auto; }
    .conv-empty {
      display: flex; flex-direction: column; align-items: center;
      gap: 8px; padding: 40px 16px; color: var(--text-3); font-size: 13px; text-align: center;
    }
    .start-btn {
      background: var(--blue-light); color: var(--blue); border: none;
      border-radius: 6px; padding: 5px 12px; font-size: 12px; cursor: pointer; font-weight: 500;
      &:hover { background: var(--blue-mid); }
    }
    .conv-item {
      display: flex; align-items: center; gap: 10px;
      padding: 12px 14px; cursor: pointer; border-bottom: 1px solid var(--border-light);
      transition: background .1s;
      &:hover  { background: var(--bg); }
      &.active { background: var(--blue-light); }
    }
    .ci-av {
      width: 38px; height: 38px; border-radius: 50%; flex-shrink: 0;
      color: #fff; font-size: 14px; font-weight: 700;
      display: flex; align-items: center; justify-content: center;
    }
    .ci-body  { flex: 1; min-width: 0; }
    .ci-top   { display: flex; justify-content: space-between; align-items: baseline; }
    .ci-name  { font-size: 13px; font-weight: 600; color: var(--text); }
    .ci-time  { font-size: 10px; color: var(--text-3); white-space: nowrap; }
    .ci-preview { font-size: 12px; color: var(--text-3); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-top: 2px; }
    .ci-unread {
      width: 20px; height: 20px; border-radius: 50%;
      background: var(--blue); color: #fff;
      font-size: 10px; font-weight: 700; display: flex; align-items: center; justify-content: center; flex-shrink: 0;
    }

    /* Message thread */
    .msg-thread { display: flex; flex-direction: column; overflow: hidden; }
    .thread-empty {
      flex: 1; display: flex; flex-direction: column; align-items: center;
      justify-content: center; gap: 10px; color: var(--text-3);
    }
    .te-title { font-size: 15px; font-weight: 600; color: var(--text-2); }
    .te-sub   { font-size: 13px; }

    .thread-header {
      display: flex; align-items: center; gap: 10px;
      padding: 12px 16px; border-bottom: 1px solid var(--border); background: var(--bg); flex-shrink: 0;
    }
    .th-av   { width: 36px; height: 36px; border-radius: 50%; color: #fff; font-size: 13px; font-weight: 700; display: flex; align-items: center; justify-content: center; }
    .th-name { font-size: 14px; font-weight: 600; color: var(--text); }
    .th-type { font-size: 11px; color: var(--text-3); }

    .messages-scroll { flex: 1; overflow-y: auto; padding: 16px; display: flex; flex-direction: column; gap: 8px; }
    .msg-bubble-wrap { display: flex; &.sent { justify-content: flex-end; } }
    .msg-bubble {
      max-width: 72%; padding: 9px 13px; border-radius: 14px;
      background: var(--bg); color: var(--text); font-size: 13px; line-height: 1.5;
      &.sent { background: var(--blue); color: #fff; border-bottom-right-radius: 4px; }
      &:not(.sent) { border-bottom-left-radius: 4px; }
    }
    .msg-time { font-size: 10px; margin-top: 4px; opacity: .7; text-align: right; }

    .reply-box {
      display: flex; gap: 8px; padding: 12px 14px;
      border-top: 1px solid var(--border); background: var(--bg); flex-shrink: 0;
    }
    .reply-input {
      flex: 1; border: 1px solid var(--border); border-radius: 8px;
      padding: 8px 12px; font-size: 13px; font-family: inherit;
      resize: none; outline: none; background: #fff;
      &:focus { border-color: var(--blue); }
    }
    .reply-send {
      width: 40px; height: 40px; border-radius: 9px;
      background: var(--blue); color: #fff; border: none; cursor: pointer;
      display: flex; align-items: center; justify-content: center; flex-shrink: 0;
      &:hover:not(:disabled) { background: #1D4ED8; }
      &:disabled { opacity: .5; cursor: not-allowed; }
    }
  `],
})
export class CommunicationComponent implements OnInit {
  private api    = inject(ApiService);
  private dialog = inject(MatDialog);
  private snack = inject(MatSnackBar);
  private auth  = inject(AuthService);

  isAdmin = this.auth.isAdmin;
  private fb    = inject(FormBuilder);

  announcements = signal<Announcement[]>([]);
  circulars     = signal<any[]>([]);
  conversations = signal<Conversation[]>([]);
  messages      = signal<any[]>([]);
  activeConv    = signal<Conversation | null>(null);
  unreadCount   = signal(0);
  selectedTabIndex = signal(0);
  currentUserId = computed(() => this.auth.user()?.id ?? '');

  annLoading    = signal(true);
  circLoading   = signal(false);
  convLoading   = signal(false);
  msgsLoading   = signal(false);
  submitting    = signal(false);
  circSubmitting = signal(false);
  sending       = signal(false);

  showCompose         = signal(false);
  showCircularCompose = signal(false);

  annStatus   = signal('');
  annAudience = signal('');
  msgSearch   = '';
  replyText   = '';

  filteredConversations = computed(() => {
    const q = this.msgSearch.toLowerCase();
    if (!q) return this.conversations();
    return this.conversations().filter(c => c.partner_name.toLowerCase().includes(q));
  });

  annForm = this.fb.group({
    title:    ['', Validators.required],
    body:     ['', Validators.required],
    audience: ['all'],
  });

  circularForm = this.fb.group({
    title:        ['', Validators.required],
    body:         ['', Validators.required],
    audience:     ['parents'],
    requires_ack: [true],
  });

  ngOnInit() {
    this.loadAnnouncements();
    this.loadUnreadCount();
    // Store current user id for sent/received detection
  }

  loadUnreadCount() {
    this.api.get<any>('/communication/messages/unread-count').subscribe({
      next: (res: any) => {
        const count = res.data?.unread_count ?? res.data?.count ?? 0;
        this.unreadCount.set(count);
        // Auto-switch to Messages tab if there are unread messages
        if (count > 0 && this.selectedTabIndex() !== 2) {
          this.selectedTabIndex.set(2);
          this.loadConversations();
        }
      },
      error: () => {},
    });
  }

  loadAnnouncements() {
    this.annLoading.set(true);
    const params: Record<string, string> = {};
    if (this.annAudience()) params['audience'] = this.annAudience();
    if (this.annStatus() === 'published') params['published'] = 'true';
    if (this.annStatus() === 'draft')     params['published'] = 'false';
    this.api.get<any>('/communication/announcements', params).subscribe({
      next: (res: any) => { this.announcements.set(res.data ?? []); this.annLoading.set(false); },
      error: () => this.annLoading.set(false),
    });
  }

  loadCirculars() {
    this.circLoading.set(true);
    this.api.get<any>('/communication/circulars').subscribe({
      next: (res: any) => { this.circulars.set(res.data ?? []); this.circLoading.set(false); },
      error: () => this.circLoading.set(false),
    });
  }

  loadConversations() {
    this.convLoading.set(true);
    this.api.get<any>('/communication/messages/conversations').subscribe({
      next: (res: any) => {
        console.log('[Comm] conversations:', res.data?.length, res.data);
        this.conversations.set(res.data ?? []);
        this.convLoading.set(false);
      },
      error: (err: any) => {
        console.error('[Comm] conversations error:', err);
        this.convLoading.set(false);
      },
    });
  }

  openConversation(conv: Conversation) {
    this.activeConv.set(conv);
    this.msgsLoading.set(true);
    const url = '/communication/messages/conversations/' + conv.partner_id;
    console.log('[Comm] opening conversation:', url, 'partner_type:', conv.partner_type);
    this.api.get<any>(url, { partner_type: conv.partner_type }).subscribe({
      next: (res: any) => {
        console.log('[Comm] messages:', res.data?.length, res);
        this.messages.set(res.data ?? []);
        this.msgsLoading.set(false);
      },
      error: (err: any) => {
        console.error('[Comm] messages error:', err);
        this.msgsLoading.set(false);
      },
    });
    // Mark as read
    this.api.post<any>('/communication/messages/conversations/' + conv.partner_id + '/read', {}).subscribe();
  }

  sendMessage() {
    if (!this.replyText.trim() || !this.activeConv()) return;
    this.sending.set(true);
    const payload = {
      recipient_id:   this.activeConv()!.partner_id,
      recipient_type: this.activeConv()!.partner_type,
      body:           this.replyText.trim(),
    };
    console.log('[Comm] sending message:', payload);
    this.api.post<any>('/communication/messages', payload).subscribe({
      next: (res: any) => {
        console.log('[Comm] message sent:', res.data);
        this.messages.update(m => [...m, res.data]);
        this.replyText = '';
        this.sending.set(false);
        this.loadConversations();
      },
      error: (err: any) => {
        console.error('[Comm] send error:', err);
        this.sending.set(false);
        this.snack.open(err.error?.error?.message ?? 'Failed to send', 'OK', { duration: 3000 });
      },
    });
  }

  submitAnnouncement(publishNow: boolean) {
    if (this.annForm.invalid) return;
    this.submitting.set(true);
    this.api.post<any>('/communication/announcements', { ...this.annForm.value, publish_now: publishNow }).subscribe({
      next: () => {
        this.submitting.set(false);
        this.annForm.reset({ audience: 'all' });
        this.showCompose.set(false);
        this.snack.open(publishNow ? 'Announcement published!' : 'Saved as draft', 'OK', { duration: 3000 });
        this.loadAnnouncements();
      },
      error: (err: any) => { this.submitting.set(false); this.snack.open(err.error?.error?.message ?? 'Error', 'OK', { duration: 3000 }); },
    });
  }

  saveDraft() { this.submitAnnouncement(false); }

  publish(ann: Announcement) {
    this.api.patch<any>('/communication/announcements/' + ann.id + '/publish', {}).subscribe({
      next: () => { this.snack.open('Published!', 'OK', { duration: 2000 }); this.loadAnnouncements(); },
      error: (err: any) => this.snack.open(err.error?.error?.message ?? 'Error', 'OK', { duration: 3000 }),
    });
  }

  deleteAnn(ann: Announcement) {
    if (!confirm('Delete this announcement?')) return;
    this.api.delete<any>('/communication/announcements/' + ann.id).subscribe({
      next: () => { this.snack.open('Deleted', 'OK', { duration: 2000 }); this.loadAnnouncements(); },
    });
  }

  submitCircular() {
    if (this.circularForm.invalid) return;
    this.circSubmitting.set(true);
    this.api.post<any>('/communication/circulars', { ...this.circularForm.value, publish_now: true }).subscribe({
      next: () => {
        this.circSubmitting.set(false);
        this.circularForm.reset({ audience: 'parents', requires_ack: true });
        this.showCircularCompose.set(false);
        this.snack.open('Circular published!', 'OK', { duration: 3000 });
        this.loadCirculars();
      },
      error: (err: any) => { this.circSubmitting.set(false); this.snack.open(err.error?.error?.message ?? 'Error', 'OK', { duration: 3000 }); },
    });
  }

  acknowledge(circ: any) {
    this.api.post<any>('/communication/circulars/' + circ.id + '/acknowledge', {}).subscribe({
      next: () => {
        this.circulars.update(list => list.map(c =>
          c.id === circ.id ? { ...c, user_acknowledged: true, acknowledged_count: (c.acknowledged_count ?? 0) + 1 } : c
        ));
        this.snack.open('Circular acknowledged', 'OK', { duration: 2000 });
      },
      error: (err: any) => this.snack.open(err.error?.error?.message ?? 'Error', 'OK', { duration: 3000 }),
    });
  }

  openNewMessage() {
    const ref = this.dialog.open(NewMessageDialogComponent, {
      width: '500px', disableClose: true,
    });
    ref.afterClosed().subscribe((result: any) => {
      if (!result) return;
      this.snack.open('Message sent to ' + result.contact.name, 'OK', { duration: 3000 });

      // Build a synthetic conversation and open it immediately
      const fakeConv: Conversation = {
        partner_id:      result.contact.id,
        partner_name:    result.contact.name,
        partner_type:    result.contact.type,
        last_message:    result.message?.body ?? '',
        last_message_at: new Date().toISOString() as any,
        unread_count:    0,
      };
      // Prepend to conversations list
      this.conversations.update(list => {
        const filtered = list.filter(c => c.partner_id !== fakeConv.partner_id);
        return [fakeConv, ...filtered];
      });
      // Open it
      this.openConversation(fakeConv);
    });
  }

  onTabChange(idx: number) {
    if (idx === 1) this.loadCirculars();
    this.selectedTabIndex.set(idx);
    if (idx === 2) this.loadConversations();
  }

  getAvatarColor(name: string): string {
    const colors = ['#2563EB','#7C3AED','#DB2777','#D97706','#059669','#0891B2'];
    return colors[(name?.charCodeAt(0) || 0) % colors.length];
  }
}
