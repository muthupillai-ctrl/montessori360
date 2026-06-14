import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, FormsModule, Validators } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { DatePipe, DecimalPipe, TitleCasePipe } from '@angular/common';
import { ApiService } from '../../core/services/api.service';
import { AuthService } from '../../core/services/auth.service';

type Tab = 'trips' | 'news' | 'messages' | 'me';

@Component({
  selector: 'app-driver',
  standalone: true,
  imports: [ MatIconModule, MatProgressSpinnerModule, DatePipe, DecimalPipe, TitleCasePipe, ReactiveFormsModule, FormsModule ],
  template: `
    <div class="driver-app">

      <!-- Top bar -->
      <div class="top-bar">
        <div>
          <div class="tb-name">{{ greeting() }}, {{ firstName() }}</div>
          <div class="tb-date">{{ today | date:'EEEE, d MMMM yyyy' }}</div>
        </div>
        <div class="tb-right">
          <div class="tb-badge">🚌 Driver</div>
          <button class="tb-logout" (click)="logout()">
            <mat-icon style="font-size:18px;width:18px;height:18px">logout</mat-icon>
          </button>
        </div>
      </div>

      <!-- Content area -->
      <div class="content">

        <!-- ── TRIPS TAB ── -->
        @if (activeTab() === 'trips') {
          @if (tripsLoading()) {
            <div class="full-loading">
              <mat-progress-spinner diameter="36" mode="indeterminate"
                style="--mdc-circular-progress-active-indicator-color:#10B981"/>
              <span>Loading your trips…</span>
            </div>
          } @else if (!trips().length) {
            <div class="no-trips">
              <div class="nt-icon">🚌</div>
              <div class="nt-title">No trips today</div>
              <div class="nt-sub">No trips assigned for today.<br>Check with your admin.</div>
            </div>
          } @else {
            <!-- Trip pills -->
            <div class="trip-pills">
              @for (t of trips(); track t.id; let i = $index) {
                <button class="trip-pill"
                        [class.active]="i === activeTripIdx()"
                        [class.done]="t.status === 'completed'"
                        (click)="selectTrip(i)">
                  {{ t.trip_type === 'morning' ? '🏫' : '🏠' }} {{ t.route_name }}
                  @if (t.status === 'in_progress') {
                    <span class="pill-live">LIVE</span>
                  }
                </button>
              }
            </div>

            <!-- Trip header -->
            <div class="trip-header" [class]="'status-' + activeTrip()!.status">
              <div class="th-dir">
                {{ activeTrip()!.trip_type === 'morning' ? '🏫 Pickup — Home → School' : '🏠 Drop — School → Home' }}
                @if (activeTrip()!.vehicle_reg) { · {{ activeTrip()!.vehicle_reg }} }
              </div>
              <div class="th-route">{{ activeTrip()!.route_name }}</div>
              <div class="th-meta">
                @if (activeTrip()!.start_time) {
                  <span class="th-m">🕐 {{ activeTrip()!.start_time | date:'h:mm a' }}</span>
                } @else {
                  <span class="th-m warning">⏳ Not started</span>
                }
                <span class="th-m">👥 {{ activeTrip()!.boardings?.length ?? 0 }} students</span>
              </div>

              @if (activeTrip()!.status !== 'scheduled') {
                <div class="th-stats">
                  <div class="th-stat">
                    <div class="th-sv green">{{ mainCount() }}</div>
                    <div class="th-sl">{{ isPickup() ? 'Boarded' : 'Dropped' }}</div>
                  </div>
                  <div class="th-sdiv"></div>
                  <div class="th-stat">
                    <div class="th-sv red">{{ pendingCount() }}</div>
                    <div class="th-sl">Pending</div>
                  </div>
                  <div class="th-sdiv"></div>
                  <div class="th-stat">
                    <div class="th-sv">{{ activeTrip()!.boardings?.length ?? 0 }}</div>
                    <div class="th-sl">Total</div>
                  </div>
                  <div class="th-sdiv"></div>
                  <div class="th-stat">
                    <div class="th-sv amber">{{ progressPct() }}%</div>
                    <div class="th-sl">Progress</div>
                  </div>
                </div>
                <div class="th-pbar">
                  <div class="th-pfill" [style.width.%]="progressPct()"></div>
                </div>
              }
            </div>

            @if (activeTrip()!.status === 'completed') {
              <div class="completed-banner">✓ Trip completed successfully</div>
            }

            <!-- Student list -->
            <div class="student-list">
              @for (stop of boardingsByStop(); track stop.name) {
                <div class="stop-header">
                  <div class="stop-num">{{ stop.order }}</div>
                  <div class="stop-name">{{ stop.name }}</div>
                  @if (stop.eta) { <div class="stop-eta">{{ stop.eta }}</div> }
                  <div class="stop-count">{{ stop.boardings.length }}</div>
                </div>
                @for (b of stop.boardings; track b.student_id) {
                  <div class="stu-row" [class.boarded]="b.boarded" [class.dropped]="b.dropped">
                    <div class="stu-av" [style.background]="getColor(b.student_name)">
                      {{ getInitials(b.student_name) }}
                    </div>
                    <div class="stu-info">
                      <div class="stu-name">{{ b.student_name }}</div>
                      <div class="stu-adm">{{ b.admission_no }}</div>
                    </div>
                    @if (activeTrip()!.status === 'in_progress') {
                      @if (isPickup()) {
                        <button class="act-btn" [class.board]="b.boarded" (click)="toggleBoard(b)">
                          {{ b.boarded ? '✓ On' : 'Board' }}
                        </button>
                      } @else {
                        <div class="act-pair">
                          <button class="act-btn sm" [class.board]="b.boarded" (click)="toggleBoard(b)">
                            {{ b.boarded ? '✓' : 'On' }}
                          </button>
                          <button class="act-btn sm" [class.drop]="b.dropped"
                                  [disabled]="!b.boarded" (click)="toggleDrop(b)">
                            {{ b.dropped ? '✓' : 'Off' }}
                          </button>
                        </div>
                      }
                    } @else if (activeTrip()!.status === 'completed') {
                      <span class="done-status" [class.ok]="isPickup() ? b.boarded : b.dropped">
                        {{ isPickup() ? (b.boarded ? '✓ Boarded' : '✗ Absent')
                                      : (b.dropped ? '✓ Dropped' : b.boarded ? 'On bus' : '✗') }}
                      </span>
                    }
                  </div>
                }
              }
            </div>

            <!-- Footer actions -->
            <div class="footer">
              @if (activeTrip()!.status === 'scheduled') {
                <button class="fb start" (click)="startTrip()" [disabled]="starting()">
                  @if (starting()) {
                    <mat-progress-spinner diameter="18" mode="indeterminate"
                      style="--mdc-circular-progress-active-indicator-color:#fff"/>
                  } @else { ▶ }
                  Start Trip
                </button>
              } @else if (activeTrip()!.status === 'in_progress') {
                @if (isPickup()) {
                  <button class="fb all" (click)="markAllBoard()">✓ All Boarded</button>
                } @else {
                  <button class="fb all" (click)="markAllBoard()">✓ All On</button>
                  <button class="fb all-drop" (click)="markAllDrop()">✓ All Off</button>
                }
                <button class="fb complete" (click)="completeTrip()">🏁 Complete</button>
              } @else {
                <button class="fb done" disabled>✓ Trip Completed</button>
              }
            </div>
          }
        }

        <!-- ── NEWS TAB ── -->
        @if (activeTab() === 'news') {
          <div class="tab-content">
            <div class="tc-title">Announcements</div>
            @if (newsLoading()) {
              <div class="inner-loading"><mat-progress-spinner diameter="24" mode="indeterminate" style="--mdc-circular-progress-active-indicator-color:#10B981"/></div>
            } @else if (!announcements().length) {
              <div class="inner-empty">No announcements yet</div>
            } @else {
              @for (a of announcements(); track a.id) {
                <div class="news-card">
                  <div class="nc-header">
                    <span class="nc-type" [class]="a.type">{{ a.type }}</span>
                    <span class="nc-date">{{ a.published_at | date:'d MMM yyyy' }}</span>
                  </div>
                  <div class="nc-title">{{ a.title }}</div>
                  @if (a.body) { <div class="nc-body">{{ a.body }}</div> }
                </div>
              }
            }
          </div>
        }

        <!-- ── MESSAGES TAB ── -->
        @if (activeTab() === 'messages') {

          <!-- VIEW 1: Conversation list -->
          @if (msgView() === 'list') {
            <div class="msg-page">
              <div class="msg-header">
                <span class="msg-title">Messages</span>
                <button class="compose-btn" (click)="msgView.set('compose')">
                  <mat-icon style="font-size:16px;width:16px;height:16px">edit</mat-icon>
                  Compose
                </button>
              </div>
              @if (msgLoading()) {
                <div class="inner-loading">
                  <mat-progress-spinner diameter="24" mode="indeterminate" style="--mdc-circular-progress-active-indicator-color:#10B981"/>
                </div>
              } @else if (!conversations().length) {
                <div class="no-conv">
                  <div style="font-size:40px">💬</div>
                  <div style="font-size:15px;font-weight:600;color:#CBD5E1;margin-top:8px">No messages yet</div>
                  <div style="font-size:13px;color:#64748B;margin-top:4px">Tap Compose to start a conversation</div>
                </div>
              } @else {
                <div class="conv-list">
                  @for (conv of conversations(); track conv.partner_id) {
                    <div class="conv-row" [class.unread]="conv.unread_count > 0"
                         (click)="openConv(conv)">
                      <div class="conv-av" [style.background]="getColor(conv.partner_name)">
                        {{ getInitials(conv.partner_name) }}
                      </div>
                      <div class="conv-info">
                        <div class="conv-name">{{ conv.partner_name }}</div>
                        <div class="conv-last">{{ conv.last_message }}</div>
                      </div>
                      <div class="conv-meta">
                        <div class="conv-time">{{ conv.last_at | date:'d MMM' }}</div>
                        @if (conv.unread_count > 0) {
                          <div class="conv-badge">{{ conv.unread_count }}</div>
                        }
                      </div>
                    </div>
                  }
                </div>
              }
            </div>
          }

          <!-- VIEW 2: Compose — pick contact -->
          @if (msgView() === 'compose') {
            <div class="msg-page">
              <div class="msg-header">
                <button class="chat-back" (click)="msgView.set('list')">
                  <mat-icon style="font-size:20px;width:20px;height:20px">arrow_back</mat-icon>
                </button>
                <span class="msg-title">New Message</span>
              </div>
              <div class="compose-hint">Select someone to message</div>
              <div class="conv-list">
                @if (!contacts().length) {
                  <div class="inner-empty">No contacts available</div>
                } @else {
                  @for (ct of contacts(); track ct.id) {
                    <div class="conv-row" (click)="openNewConv(ct)">
                      <div class="conv-av" [style.background]="getColor(ct.name)">
                        {{ getInitials(ct.name) }}
                      </div>
                      <div class="conv-info">
                        <div class="conv-name">{{ ct.name }}</div>
                        <div class="conv-last">{{ ct.role | titlecase }}</div>
                      </div>
                      <mat-icon style="font-size:18px;width:18px;height:18px;color:#334155;flex-shrink:0">chevron_right</mat-icon>
                    </div>
                  }
                }
              </div>
            </div>
          }

          <!-- VIEW 3: Chat -->
          @if (msgView() === 'chat') {
            <div class="chat-header">
              <button class="chat-back" (click)="msgView.set('list'); activeConv.set(null); convMessages.set([])">
                <mat-icon style="font-size:20px;width:20px;height:20px">arrow_back</mat-icon>
              </button>
              <div class="conv-av sm" [style.background]="getColor(activeConv()!.partner_name)">
                {{ getInitials(activeConv()!.partner_name) }}
              </div>
              <div class="chat-name">{{ activeConv()!.partner_name }}</div>
            </div>
            <div class="chat-messages">
              @if (convLoading()) {
                <div class="inner-loading">
                  <mat-progress-spinner diameter="24" mode="indeterminate" style="--mdc-circular-progress-active-indicator-color:#10B981"/>
                </div>
              } @else {
                @for (m of convMessages(); track m.id) {
                  <div class="msg-row" [class.mine]="m.sender_id === myId()">
                    <div class="msg-bubble" [class.mine]="m.sender_id === myId()">
                      <div class="msg-text">{{ m.body }}</div>
                      <div class="msg-time">{{ m.sent_at | date:'h:mm a' }}</div>
                    </div>
                  </div>
                }
              }
            </div>
            <div class="chat-input">
              <input class="chat-input-field" [(ngModel)]="msgText"
                     placeholder="Type a message…"
                     (keyup.enter)="sendMsg()"
                     [ngModelOptions]="{standalone: true}">
              <button class="chat-send" (click)="sendMsg()" [disabled]="!msgText.trim()">
                <mat-icon style="font-size:20px;width:20px;height:20px">send</mat-icon>
              </button>
            </div>
          }
        }

        <!-- ── ME TAB ── -->
        @if (activeTab() === 'me') {
          <div class="tab-content">

            <!-- Profile section -->
            @if (profile()) {
              <div class="me-banner" [style.background]="'#0F2744'">
                <div class="me-av" [style.background]="getColor(profile()!.first_name)">
                  {{ profile()!.first_name[0] }}{{ profile()!.last_name[0] }}
                </div>
                <div class="me-name">{{ profile()!.first_name }} {{ profile()!.last_name }}</div>
                <div class="me-role">{{ profile()!.designation ?? 'Driver' }}</div>
                @if (profile()!.employee_no) {
                  <div class="me-empno">{{ profile()!.employee_no }}</div>
                }
              </div>

              <!-- Contact info -->
              <div class="me-section">
                <div class="me-section-title">Contact</div>
                <div class="me-rows">
                  <div class="me-row">
                    <mat-icon class="me-icon">email</mat-icon>
                    <div><div class="me-label">Email</div><div class="me-val">{{ profile()!.email }}</div></div>
                  </div>
                  @if (profile()!.phone) {
                    <div class="me-row">
                      <mat-icon class="me-icon">phone</mat-icon>
                      <div><div class="me-label">Phone</div><div class="me-val">{{ profile()!.phone }}</div></div>
                    </div>
                  }
                  @if (profile()!.joining_date) {
                    <div class="me-row">
                      <mat-icon class="me-icon">calendar_today</mat-icon>
                      <div><div class="me-label">Joined</div><div class="me-val">{{ profile()!.joining_date | date:'d MMM yyyy' }}</div></div>
                    </div>
                  }
                </div>
              </div>
            }

            <!-- Leave balance -->
            <div class="me-section">
              <div class="me-section-title">Leave Balance</div>
              @if (leaveLoading()) {
                <div class="inner-loading"><mat-progress-spinner diameter="20" mode="indeterminate" style="--mdc-circular-progress-active-indicator-color:#10B981"/></div>
              } @else if (leaveBalance()) {
                @if (leaveBalance()!._not_initialised) {
                  <div class="inner-empty">Leave balance not set up yet.<br>Contact admin to initialise.</div>
                } @else {
                  <div class="leave-grid">
                    <div class="leave-card">
                      <div class="lc-val green">{{ leaveBalance()!.casual ?? 0 }}</div>
                      <div class="lc-lbl">Casual</div>
                    </div>
                    <div class="leave-card">
                      <div class="lc-val amber">{{ leaveBalance()!.sick ?? 0 }}</div>
                      <div class="lc-lbl">Sick</div>
                    </div>
                    <div class="leave-card">
                      <div class="lc-val blue">{{ leaveBalance()!.earned ?? 0 }}</div>
                      <div class="lc-lbl">Earned</div>
                    </div>
                  </div>
                }
              }
            </div>

            <!-- Salary slip -->
            <div class="me-section">
              <div class="me-section-title">Latest Salary Slip</div>
              @if (salaryLoading()) {
                <div class="inner-loading"><mat-progress-spinner diameter="20" mode="indeterminate" style="--mdc-circular-progress-active-indicator-color:#10B981"/></div>
              } @else if (salarySlip()) {
                <div class="salary-card">
                  <div class="sc-month">
                    {{ salarySlip()!.designation ?? salarySlip()!.role | titlecase }}
                    — {{ salarySlip()!.pay_frequency ?? 'Monthly' }}
                  </div>
                  <div class="sc-items">
                    @if (salarySlip()!.gross_salary) {
                      <div class="sc-row"><span>Gross Salary</span><span>₹{{ salarySlip()!.gross_salary | number:'1.0-0' }}</span></div>
                    }
                    @if (salarySlip()!.lwp_days > 0) {
                      <div class="sc-row deduction"><span>LWP Deduction ({{ salarySlip()!.lwp_days }} days)</span><span>-</span></div>
                    }
                    <div class="sc-row net"><span>Net Pay</span><span>₹{{ salarySlip()!.net_salary | number:'1.0-0' }}</span></div>
                  </div>
                </div>
              } @else {
                <div class="inner-empty">No salary slip available</div>
              }
            </div>

            <!-- Holidays -->
            <div class="me-section">
              <div class="me-section-title">Holidays {{ today.getFullYear() }}</div>
              @if (holidayLoading()) {
                <div class="inner-loading">
                  <mat-progress-spinner diameter="20" mode="indeterminate" style="--mdc-circular-progress-active-indicator-color:#10B981"/>
                </div>
              } @else if (!holidays().length) {
                <div class="inner-empty">No holidays found</div>
              } @else {
                <div class="holiday-list">
                  @for (h of holidays(); track h.id) {
                    <div class="holiday-row" [class.past]="isPast(h.start_date)">
                      <div class="hol-date">
                        <div class="hol-day">{{ h.start_date | date:'d' }}</div>
                        <div class="hol-mon">{{ h.start_date | date:'MMM' }}</div>
                      </div>
                      <div class="hol-info">
                        <div class="hol-name">{{ h.title }}</div>
                        @if (h.description) {
                          <div class="hol-desc">{{ h.description }}</div>
                        }
                      </div>
                      @if (!isPast(h.start_date)) {
                        <div class="hol-days-left">
                          {{ daysUntil(h.start_date) }}d
                        </div>
                      } @else {
                        <div class="hol-past-tag">Done</div>
                      }
                    </div>
                  }
                </div>
              }
            </div>
            <div style="height:16px"></div>

          </div>
        }

      </div>

      <!-- Bottom nav -->
      <div class="bottom-nav">
        <button class="bn-btn" [class.active]="activeTab() === 'trips'" (click)="setTab('trips')">
          <mat-icon style="font-size:22px;width:22px;height:22px">directions_bus</mat-icon>
          <span>Trips</span>
          @if (liveCount() > 0) { <span class="bn-badge">{{ liveCount() }}</span> }
        </button>
        <button class="bn-btn" [class.active]="activeTab() === 'news'" (click)="setTab('news')">
          <mat-icon style="font-size:22px;width:22px;height:22px">campaign</mat-icon>
          <span>News</span>
          @if (unreadCount() > 0) { <span class="bn-badge">{{ unreadCount() }}</span> }
        </button>
        <button class="bn-btn" [class.active]="activeTab() === 'messages'" (click)="setTab('messages')">
          <mat-icon style="font-size:22px;width:22px;height:22px">chat</mat-icon>
          <span>Messages</span>
          @if (unreadMsgCount() > 0) { <span class="bn-badge">{{ unreadMsgCount() }}</span> }
        </button>
        <button class="bn-btn" [class.active]="activeTab() === 'me'" (click)="setTab('me')">
          <mat-icon style="font-size:22px;width:22px;height:22px">person</mat-icon>
          <span>Me</span>
        </button>
      </div>

    </div>
  `,
  styles: [`
    :host { display: block; height: 100vh; overflow: hidden; }

    .driver-app {
      display: flex; flex-direction: column; height: 100vh;
      background: #0F172A; color: #E2E8F0;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    }

    /* Top bar */
    .top-bar { display: flex; align-items: center; justify-content: space-between; padding: 12px 16px; background: #1E293B; border-bottom: 1px solid #334155; flex-shrink: 0; }
    .tb-name  { font-size: 16px; font-weight: 700; color: #fff; }
    .tb-date  { font-size: 11px; color: #94A3B8; margin-top: 2px; }
    .tb-right { display: flex; align-items: center; gap: 10px; }
    .tb-badge { background: #0F766E; color: #99F6E4; font-size: 11px; font-weight: 700; padding: 5px 12px; border-radius: 20px; }
    .tb-logout { background: none; border: none; cursor: pointer; color: #64748B; width: 32px; height: 32px; border-radius: 8px; display: flex; align-items: center; justify-content: center; &:hover { background: #334155; color: #E2E8F0; } }

    /* Content */
    .content { flex: 1; overflow: hidden; display: flex; flex-direction: column; }

    /* Trip pills */
    .trip-pills { display: flex; gap: 8px; padding: 10px 16px; background: #1E293B; border-bottom: 1px solid #0F172A; flex-shrink: 0; overflow-x: auto; &::-webkit-scrollbar { display: none; } }
    .trip-pill { padding: 7px 14px; border-radius: 20px; border: 1.5px solid #334155; font-size: 12px; font-weight: 600; cursor: pointer; white-space: nowrap; color: #94A3B8; background: transparent; display: flex; align-items: center; gap: 6px;
      &.active { background: #0F766E; border-color: #0F766E; color: #fff; }
      &.done   { border-color: #1D4ED8; color: #93C5FD; }
    }
    .pill-live { font-size: 9px; font-weight: 800; background: #EF4444; color: #fff; padding: 2px 5px; border-radius: 6px; animation: pulse 1.5s infinite; }

    /* Trip header */
    .trip-header { padding: 14px 16px; flex-shrink: 0; background: #0F2744; &.status-scheduled { background: #1E293B; } &.status-completed { background: #0A1628; } }
    .th-dir   { font-size: 11.5px; font-weight: 600; color: #93C5FD; margin-bottom: 5px; }
    .th-route { font-size: 21px; font-weight: 800; color: #fff; line-height: 1.2; }
    .th-meta  { display: flex; gap: 14px; margin-top: 6px; }
    .th-m     { font-size: 11.5px; color: #94A3B8; &.warning { color: #F59E0B; } }
    .th-stats { display: grid; grid-template-columns: 1fr auto 1fr auto 1fr auto 1fr; margin-top: 12px; background: #0A1628; border-radius: 10px; overflow: hidden; border: 1px solid #1E3A5F; align-items: center; }
    .th-stat  { padding: 9px 6px; text-align: center; }
    .th-sv    { font-size: 21px; font-weight: 700; color: #fff; &.green { color: #10B981; } &.red { color: #EF4444; } &.amber { color: #F59E0B; } }
    .th-sl    { font-size: 9px; color: #64748B; text-transform: uppercase; letter-spacing: .3px; margin-top: 3px; }
    .th-sdiv  { width: 1px; height: 32px; background: #1E3A5F; }
    .th-pbar  { height: 4px; background: #0A1628; margin-top: 10px; border-radius: 2px; overflow: hidden; }
    .th-pfill { height: 100%; background: #10B981; border-radius: 2px; transition: width .4s; }
    .completed-banner { background: #065F46; padding: 8px 16px; text-align: center; font-size: 13px; font-weight: 600; color: #6EE7B7; flex-shrink: 0; }

    /* Student list */
    .student-list { flex: 1; overflow-y: auto; &::-webkit-scrollbar { width: 3px; } &::-webkit-scrollbar-thumb { background: #334155; border-radius: 2px; } }
    .stop-header { display: flex; align-items: center; gap: 8px; padding: 9px 16px; background: #1E293B; border-bottom: 1px solid #0F172A; position: sticky; top: 0; z-index: 1; }
    .stop-num  { width: 22px; height: 22px; border-radius: 50%; background: #2563EB; color: #fff; font-size: 10px; font-weight: 700; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
    .stop-name { font-size: 12.5px; font-weight: 600; color: #CBD5E1; flex: 1; }
    .stop-eta  { font-size: 10.5px; color: #64748B; }
    .stop-count { font-size: 10px; font-weight: 700; padding: 2px 7px; border-radius: 10px; background: #0F172A; color: #64748B; }
    .stu-row { display: flex; align-items: center; gap: 12px; padding: 12px 16px; border-bottom: 1px solid #1E293B; &.boarded { background: #0A1F12; } &.dropped { background: #1A1207; } }
    .stu-av  { width: 40px; height: 40px; border-radius: 10px; color: #fff; font-size: 12px; font-weight: 700; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
    .stu-info { flex: 1; min-width: 0; }
    .stu-name { font-size: 14px; font-weight: 600; color: #E2E8F0; }
    .stu-adm  { font-size: 11px; color: #64748B; }
    .act-btn { min-width: 64px; height: 40px; padding: 0 14px; border-radius: 9px; border: 1.5px solid #334155; background: #1E293B; font-size: 13px; font-weight: 700; cursor: pointer; color: #94A3B8; white-space: nowrap; flex-shrink: 0;
      &.sm    { min-width: 44px; padding: 0 8px; }
      &.board { background: #065F46; color: #6EE7B7; border-color: #065F46; }
      &.drop  { background: #78350F; color: #FCD34D; border-color: #78350F; }
      &:disabled { opacity: .35; cursor: not-allowed; }
    }
    .act-pair { display: flex; gap: 5px; flex-shrink: 0; }
    .done-status { font-size: 12px; font-weight: 600; flex-shrink: 0; color: #475569; &.ok { color: #10B981; } }

    /* Footer */
    .footer { display: flex; gap: 10px; padding: 12px 16px; background: #1E293B; border-top: 1px solid #334155; flex-shrink: 0; }
    .fb { flex: 1; height: 52px; border-radius: 12px; border: none; font-size: 15px; font-weight: 700; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 7px;
      &.start    { background: #0F766E; color: #CCFBF1; &:hover { background: #0D9488; } }
      &.all      { background: #1E3A5F; color: #93C5FD; }
      &.all-drop { background: #78350F; color: #FCD34D; }
      &.complete { background: #065F46; color: #6EE7B7; }
      &.done     { background: #1E293B; color: #475569; border: 1px solid #334155; }
      &:disabled { opacity: .6; cursor: not-allowed; }
    }

    /* News tab */
    .tab-content { flex: 1; overflow-y: auto; padding: 16px; &::-webkit-scrollbar { width: 3px; } }
    .tc-title { font-size: 18px; font-weight: 700; color: #fff; margin-bottom: 14px; }
    .news-card { background: #1E293B; border: 1px solid #334155; border-radius: 10px; padding: 14px; margin-bottom: 10px; }
    .nc-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px; }
    .nc-type { font-size: 10px; font-weight: 700; text-transform: uppercase; padding: 2px 8px; border-radius: 10px; background: #0F2744; color: #93C5FD; &.urgent { background: #450A0A; color: #FCA5A5; } &.general { background: #0F2744; color: #93C5FD; } }
    .nc-date  { font-size: 11px; color: #64748B; }
    .nc-title { font-size: 14px; font-weight: 600; color: #E2E8F0; margin-bottom: 4px; }
    .nc-body  { font-size: 13px; color: #94A3B8; line-height: 1.5; }

    /* Me tab */
    .me-banner { display: flex; flex-direction: column; align-items: center; padding: 20px; background: #0F2744; flex-shrink: 0; }
    .me-av   { width: 64px; height: 64px; border-radius: 16px; color: #fff; font-size: 22px; font-weight: 700; display: flex; align-items: center; justify-content: center; border: 3px solid rgba(255,255,255,.15); margin-bottom: 10px; }
    .me-name { font-size: 20px; font-weight: 700; color: #fff; }
    .me-role { font-size: 12px; color: #94A3B8; margin-top: 3px; }
    .me-empno { font-size: 11px; color: #64748B; font-family: monospace; margin-top: 4px; }
    .me-section { margin: 12px 16px 0; background: #1E293B; border: 1px solid #334155; border-radius: 10px; overflow: hidden; }
    .me-section-title { padding: 10px 14px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .4px; color: #64748B; background: #0F172A; border-bottom: 1px solid #334155; }
    .me-rows { padding: 4px 0; }
    .me-row  { display: flex; align-items: center; gap: 12px; padding: 10px 14px; border-bottom: 1px solid #1E293B; &:last-child { border-bottom: none; } }
    .me-icon { font-size: 16px; width: 16px; height: 16px; color: #475569; flex-shrink: 0; }
    .me-label { font-size: 10px; color: #64748B; text-transform: uppercase; letter-spacing: .3px; }
    .me-val   { font-size: 13px; color: #E2E8F0; margin-top: 1px; }

    /* Leave grid */
    .leave-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 0; }
    .leave-card { padding: 14px 8px; text-align: center; border-right: 1px solid #334155; &:last-child { border-right: none; } }
    .lc-val  { font-size: 26px; font-weight: 700; &.green { color: #10B981; } &.amber { color: #F59E0B; } &.blue { color: #60A5FA; } }
    .lc-lbl  { font-size: 10px; color: #64748B; margin-top: 3px; text-transform: uppercase; }

    /* Salary */
    .salary-card { padding: 14px; }
    .sc-month { font-size: 14px; font-weight: 600; color: #93C5FD; margin-bottom: 10px; }
    .sc-items { display: flex; flex-direction: column; gap: 6px; }
    .sc-row   { display: flex; justify-content: space-between; font-size: 13px; color: #94A3B8; &.deduction span:last-child { color: #FCA5A5; } &.net { font-size: 15px; font-weight: 700; color: #fff; border-top: 1px solid #334155; padding-top: 8px; margin-top: 4px; span:last-child { color: #10B981; } } }

    /* Bottom nav */
    .bottom-nav { display: flex; background: #1E293B; border-top: 1px solid #334155; flex-shrink: 0; }
    .bn-btn { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 3px; padding: 10px 4px; background: none; border: none; cursor: pointer; color: #64748B; font-size: 11px; position: relative;
      mat-icon { transition: color .15s; }
      &.active { color: #10B981; }
      &:hover  { color: #94A3B8; }
    }
    .bn-badge { position: absolute; top: 6px; right: calc(50% - 18px); background: #EF4444; color: #fff; font-size: 9px; font-weight: 700; width: 16px; height: 16px; border-radius: 50%; display: flex; align-items: center; justify-content: center; }

    /* States */
    .full-loading { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 16px; color: #64748B; font-size: 14px; }
    .no-trips { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; padding: 40px; text-align: center; }
    .nt-icon  { font-size: 56px; }
    .nt-title { font-size: 20px; font-weight: 700; color: #E2E8F0; }
    .nt-sub   { font-size: 14px; color: #64748B; line-height: 1.6; }
    .inner-loading { display: flex; justify-content: center; padding: 20px; }
    .inner-empty   { text-align: center; padding: 20px; color: #64748B; font-size: 13px; }

    /* Messaging */
    .conv-row { display: flex; align-items: center; gap: 12px; padding: 12px 16px; border-bottom: 1px solid #1E293B; cursor: pointer; &:hover { background: #1E293B; } &.unread .conv-name { color: #fff; font-weight: 700; } }
    .conv-av  { width: 40px; height: 40px; border-radius: 50%; color: #fff; font-size: 13px; font-weight: 700; display: flex; align-items: center; justify-content: center; flex-shrink: 0; &.sm { width: 32px; height: 32px; font-size: 11px; } }
    .conv-info { flex: 1; min-width: 0; }
    .conv-name { font-size: 14px; font-weight: 500; color: #CBD5E1; }
    .conv-last { font-size: 12px; color: #64748B; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-top: 2px; }
    .conv-meta { display: flex; flex-direction: column; align-items: flex-end; gap: 4px; }
    .conv-time { font-size: 10.5px; color: #64748B; }
    .conv-badge { background: #10B981; color: #fff; font-size: 10px; font-weight: 700; width: 18px; height: 18px; border-radius: 50%; display: flex; align-items: center; justify-content: center; }
    /* Messages redesign */
    .msg-page { display: flex; flex-direction: column; height: 100%; }
    .compose-page { display: flex; flex-direction: column; height: 100%; background: #0F172A; }
    .msg-header { display: flex; align-items: center; justify-content: space-between; padding: 14px 16px; border-bottom: 1px solid #1E293B; flex-shrink: 0; }
    .msg-title  { font-size: 18px; font-weight: 700; color: #fff; }
    .compose-btn { display: flex; align-items: center; gap: 6px; padding: 7px 14px; border-radius: 20px; background: #0F766E; border: none; color: #CCFBF1; font-size: 13px; font-weight: 600; cursor: pointer; &:hover { background: #0D9488; } }
    .conv-list { flex: 1; overflow-y: auto; }
    .no-conv      { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 40px; text-align: center; }
    .compose-hint { padding: 10px 16px 0; font-size: 12px; color: #64748B; }
    .contact-row { display: flex; align-items: center; gap: 10px; padding: 10px 16px; cursor: pointer; &:hover { background: #1E293B; } }

    /* Chat */
    .chat-header { display: flex; align-items: center; gap: 10px; padding: 10px 16px; background: #1E293B; border-bottom: 1px solid #334155; flex-shrink: 0; }
    .chat-back { background: none; border: none; cursor: pointer; color: #94A3B8; display: flex; align-items: center; &:hover { color: #E2E8F0; } }
    .chat-name { font-size: 15px; font-weight: 600; color: #E2E8F0; }
    .chat-messages { flex: 1; overflow-y: auto; padding: 12px 16px; display: flex; flex-direction: column; gap: 8px; }
    .msg-row { display: flex; &.mine { justify-content: flex-end; } }
    .msg-bubble { max-width: 75%; padding: 9px 13px; border-radius: 14px; background: #1E293B; border: 1px solid #334155;
      &.mine { background: #0F766E; border-color: #0F766E; }
    }
    .msg-text { font-size: 14px; color: #E2E8F0; line-height: 1.4; }
    .msg-time { font-size: 10px; color: #64748B; margin-top: 4px; text-align: right; }
    .chat-input { display: flex; gap: 8px; padding: 10px 16px; background: #1E293B; border-top: 1px solid #334155; flex-shrink: 0; }
    .chat-input-field { flex: 1; height: 42px; padding: 0 14px; background: #0F172A; border: 1px solid #334155; border-radius: 21px; font-size: 14px; color: #E2E8F0; outline: none; &:focus { border-color: #0F766E; } }
    .chat-send { width: 42px; height: 42px; border-radius: 50%; background: #0F766E; border: none; cursor: pointer; color: #fff; display: flex; align-items: center; justify-content: center; flex-shrink: 0; &:disabled { opacity: .4; cursor: not-allowed; } &:hover:not(:disabled) { background: #0D9488; } }

    /* Holidays */
    .holiday-list { padding: 4px 0; }
    .holiday-row { display: flex; align-items: center; gap: 12px; padding: 10px 14px; border-bottom: 1px solid #1E293B; &:last-child { border-bottom: none; } &.past { opacity: .5; } }
    .hol-date { width: 36px; text-align: center; flex-shrink: 0; }
    .hol-day  { font-size: 18px; font-weight: 700; color: #E2E8F0; line-height: 1; }
    .hol-mon  { font-size: 10px; color: #64748B; text-transform: uppercase; letter-spacing: .3px; }
    .hol-info { flex: 1; }
    .hol-name { font-size: 13px; font-weight: 600; color: #E2E8F0; }
    .hol-desc { font-size: 11px; color: #64748B; margin-top: 2px; }
    .hol-days-left { font-size: 11px; font-weight: 700; color: #10B981; background: #0A1F12; padding: 3px 8px; border-radius: 10px; white-space: nowrap; }
    .hol-past-tag  { font-size: 10px; color: #475569; }

    @keyframes pulse { 0%,100% { opacity:1; } 50% { opacity:.5; } }
  `],
})
export class DriverComponent implements OnInit {
  private api    = inject(ApiService);
  private auth   = inject(AuthService);
  private router = inject(Router);

  today        = new Date();
  activeTab    = signal<Tab>('trips');
  trips        = signal<any[]>([]);
  activeTripIdx = signal(0);
  tripsLoading = signal(true);
  starting     = signal(false);

  announcements = signal<any[]>([]);
  newsLoading   = signal(false);
  unreadCount   = signal(0);

  profile      = signal<any | null>(null);
  leaveBalance  = signal<any | null>(null);
  salarySlip    = signal<any | null>(null);
  holidays      = signal<any[]>([]);
  conversations  = signal<any[]>([]);
  activeConv     = signal<any | null>(null);
  convMessages   = signal<any[]>([]);
  contacts       = signal<any[]>([]);
  msgLoading     = signal(false);
  convLoading    = signal(false);
  msgText        = '';
  unreadMsgCount = signal(0);
  msgView        = signal<'list'|'compose'|'chat'>('list');
  leaveLoading  = signal(false);
  salaryLoading = signal(false);
  holidayLoading = signal(false);

  activeTrip   = () => this.trips()[this.activeTripIdx()] ?? null;
  isPickup     = () => this.activeTrip()?.trip_type === 'morning';
  firstName    = () => (this.auth.user()?.name ?? 'Driver').split(' ')[0];
  liveCount    = () => this.trips().filter(t => t.status === 'in_progress').length;

  greeting = () => {
    const h = new Date().getHours();
    return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
  };

  mainCount   = () => {
    if (!this.activeTrip()?.boardings) return 0;
    return this.isPickup()
      ? this.activeTrip()!.boardings.filter((b: any) => b.boarded).length
      : this.activeTrip()!.boardings.filter((b: any) => b.dropped).length;
  };
  pendingCount = () => (this.activeTrip()?.boardings?.length ?? 0) - this.mainCount();
  progressPct  = () => {
    const total = this.activeTrip()?.boardings?.length ?? 0;
    return total > 0 ? Math.round(this.mainCount() / total * 100) : 0;
  };

  boardingsByStop() {
    const boardings = this.activeTrip()?.boardings ?? [];
    const map = new Map<string, any>();
    boardings.forEach((b: any) => {
      const key = b.pickup_stop ?? 'Unassigned';
      if (!map.has(key)) map.set(key, { order: b.stop_order ?? 99, eta: b.morning_eta ?? b.evening_eta, boardings: [] });
      map.get(key).boardings.push(b);
    });
    return Array.from(map.entries())
      .sort((a, b) => a[1].order - b[1].order)
      .map(([name, data]) => ({ name, ...data }));
  }

  ngOnInit() {
    this.loadTrips();
    this.loadAnnouncements();
    this.loadProfile();
    this.loadUnreadMsgCount();
  }

  setTab(tab: Tab) {
    this.activeTab.set(tab);
    if (tab === 'me' && !this.leaveBalance()) this.loadLeaveAndSalary();
    if (tab === 'messages' && !this.conversations().length) this.loadConversations();
    if (tab !== 'messages') { this.msgView.set('list'); this.activeConv.set(null); }
    if (tab === 'me' && !this.holidays().length) this.loadHolidays();
  }

  // ── Trips ──────────────────────────────────────────────

  loadTrips() {
    this.tripsLoading.set(true);
    const today = new Date().toISOString().slice(0, 10);
    this.api.get<any>('/transport/driver/schedule', { date: today }).subscribe({
      next: (res: any) => {
        const trips = res.data ?? [];
        this.trips.set(trips);
        const liveIdx = trips.findIndex((t: any) => t.status === 'in_progress');
        const firstActive = liveIdx >= 0 ? liveIdx : trips.findIndex((t: any) => t.status !== 'completed');
        if (firstActive >= 0) this.activeTripIdx.set(firstActive);
        this.tripsLoading.set(false);
        if (liveIdx >= 0 && trips[liveIdx].is_real) this.loadBoardings(trips[liveIdx].id, liveIdx);
      },
      error: () => this.tripsLoading.set(false),
    });
  }

  loadBoardings(tripId: string, idx: number) {
    this.api.get<any>('/transport/trips/' + tripId).subscribe({
      next: (r: any) => {
        const updated = [...this.trips()];
        updated[idx] = { ...updated[idx], ...r.data };
        this.trips.set(updated);
      },
      error: () => {},
    });
  }

  selectTrip(idx: number) {
    this.activeTripIdx.set(idx);
    const t = this.trips()[idx];
    if (t.is_real && !t.boardings) this.loadBoardings(t.id, idx);
  }

  startTrip() {
    const t = this.activeTrip();
    if (!t || this.starting()) return;
    this.starting.set(true);
    this.api.post<any>('/transport/trips', {
      route_id:  t.route_id,
      trip_date: new Date().toISOString().slice(0, 10),
      trip_type: t.trip_type,
      driver_id: this.auth.user()?.id,
    }).subscribe({
      next: (res: any) => {
        this.starting.set(false);
        this.api.get<any>('/transport/trips/' + res.data.id).subscribe({
          next: (r: any) => {
            const updated = [...this.trips()];
            updated[this.activeTripIdx()] = { ...t, ...r.data, is_real: true };
            this.trips.set(updated);
          },
          error: () => this.loadTrips(),
        });
      },
      error: (err: any) => { this.starting.set(false); alert(err.error?.error?.message ?? 'Failed to start trip'); },
    });
  }

  toggleBoard(b: any) {
    const t = this.activeTrip();
    if (!t) return;
    const val = !b.boarded;
    if (!val) b.dropped = false;
    this.api.post<any>('/transport/trips/' + t.id + '/board', { student_id: b.student_id, boarded: val })
      .subscribe({ next: () => { b.boarded = val; }, error: () => {} });
  }

  toggleDrop(b: any) {
    const t = this.activeTrip();
    if (!t || !b.boarded) return;
    const val = !b.dropped;
    this.api.post<any>('/transport/trips/' + t.id + '/drop', { student_id: b.student_id, dropped: val })
      .subscribe({ next: () => { b.dropped = val; }, error: () => {} });
  }

  markAllBoard() {
    const t = this.activeTrip();
    if (!t) return;
    (t.boardings ?? []).filter((b: any) => !b.boarded).forEach((b: any) => {
      this.api.post<any>('/transport/trips/' + t.id + '/board', { student_id: b.student_id, boarded: true })
        .subscribe({ next: () => { b.boarded = true; }, error: () => {} });
    });
  }

  markAllDrop() {
    const t = this.activeTrip();
    if (!t) return;
    (t.boardings ?? []).filter((b: any) => b.boarded && !b.dropped).forEach((b: any) => {
      this.api.post<any>('/transport/trips/' + t.id + '/drop', { student_id: b.student_id, dropped: true })
        .subscribe({ next: () => { b.dropped = true; }, error: () => {} });
    });
  }

  completeTrip() {
    const t = this.activeTrip();
    if (!t || !confirm('Complete this trip?')) return;
    this.api.patch<any>('/transport/trips/' + t.id + '/complete', {}).subscribe({
      next: () => {
        const updated = [...this.trips()];
        updated[this.activeTripIdx()] = { ...t, status: 'completed' };
        this.trips.set(updated);
        const next = this.trips().findIndex((x, i) => i !== this.activeTripIdx() && x.status !== 'completed');
        if (next >= 0) this.activeTripIdx.set(next);
      },
      error: (err: any) => alert(err.error?.error?.message ?? 'Error'),
    });
  }

  // ── News ──────────────────────────────────────────────

  loadAnnouncements() {
    this.newsLoading.set(true);
    this.api.get<any>('/communication/announcements', { limit: '20', status: 'published' }).subscribe({
      next: (res: any) => {
        const items = res.data?.items ?? res.data ?? [];
        this.announcements.set(items);
        this.unreadCount.set(Math.min(items.length, 3));
        this.newsLoading.set(false);
      },
      error: () => this.newsLoading.set(false),
    });
  }

  // ── Me ──────────────────────────────────────────────

  loadProfile() {
    this.api.get<any>('/staff/me').subscribe({
      next: (res: any) => this.profile.set(res.data),
      error: () => {},
    });
  }

  loadLeaveAndSalary() {
    this.leaveLoading.set(true);
    this.api.get<any>('/staff/leave/balance/me').subscribe({
      next: (res: any) => {
        this.leaveBalance.set(res.data ?? { casual: 0, sick: 0, earned: 0, _not_initialised: false });
        this.leaveLoading.set(false);
      },
      error: (err: any) => {
        // 404 means balance not initialised for this academic year
        this.leaveBalance.set({ casual: 0, sick: 0, earned: 0, _not_initialised: true });
        this.leaveLoading.set(false);
      },
    });
    this.salaryLoading.set(true);
    this.api.get<any>('/staff/payroll/my-slip').subscribe({
      next: (res: any) => { this.salarySlip.set(res.data); this.salaryLoading.set(false); },
      error: () => this.salaryLoading.set(false),
    });
  }

  myId = () => this.auth.user()?.id ?? '';

  loadUnreadMsgCount() {
    this.api.get<any>('/communication/messages/unread-count').subscribe({
      next: (res: any) => this.unreadMsgCount.set(res.data?.unread_count ?? res.data?.count ?? 0),
      error: () => {},
    });
  }

  loadConversations() {
    this.msgLoading.set(true);
    this.api.get<any>('/communication/messages/conversations').subscribe({
      next: (res: any) => {
        this.conversations.set(res.data ?? []);
        this.msgLoading.set(false);
      },
      error: () => this.msgLoading.set(false),
    });
    // Load contacts (admin/principal to message)
    this.api.get<any>('/communication/messages/contacts').subscribe({
      next: (res: any) => {
        // Handle both array and paginated response
        const all: any[] = Array.isArray(res.data) ? res.data
                         : Array.isArray(res.data?.items) ? res.data.items
                         : [];
        // Prioritise admin roles, show all others if none found
        const admins = all.filter((x: any) =>
          ['owner','principal','accountant','admission_staff'].includes(x.role)
        );
        this.contacts.set(admins.length ? admins : all);
      },
      error: () => {},
    });
  }

  openConv(conv: any) {
    this.msgView.set('chat');
    this.activeConv.set(conv);
    this.convLoading.set(true);
    this.api.get<any>('/communication/messages/conversations/' + conv.partner_id).subscribe({
      next: (res: any) => {
        this.convMessages.set(res.data?.messages ?? res.data ?? []);
        this.convLoading.set(false);
        // Mark as read
        this.api.post<any>('/communication/messages/conversations/' + conv.partner_id + '/read', {}).subscribe();
        this.unreadMsgCount.update(n => Math.max(0, n - (conv.unread_count ?? 0)));
      },
      error: () => this.convLoading.set(false),
    });
  }

  openNewConv(contact: any) {
    this.msgView.set('chat');
    this.activeConv.set({ partner_id: contact.id, partner_name: contact.name, unread_count: 0 });
    this.convMessages.set([]);
  }

  sendMsg() {
    if (!this.msgText.trim() || !this.activeConv()) return;
    const body = this.msgText.trim();
    this.msgText = '';
    this.api.post<any>('/communication/messages', {
      recipient_id:   this.activeConv()!.partner_id,
      recipient_type: 'staff',
      body,
    }).subscribe({
      next: (res: any) => {
        this.convMessages.update(m => [...m, res.data]);
      },
      error: () => { this.msgText = body; },
    });
  }

  loadHolidays() {
    this.holidayLoading.set(true);
    const year = new Date().getFullYear();
    this.api.get<any>('/calendar/events', {
      event_type: 'holiday',
      from: `${year}-01-01`,
      to: `${year}-12-31`,
    }).subscribe({
      next: (res: any) => {
        const events = res.data?.items ?? res.data ?? [];
        this.holidays.set(events.sort((a: any, b: any) =>
          new Date(a.start_date).getTime() - new Date(b.start_date).getTime()
        ));
        this.holidayLoading.set(false);
      },
      error: () => this.holidayLoading.set(false),
    });
  }

  logout() { this.auth.logout(); this.router.navigate(['/login']); }

  getColor(name: string): string {
    const colors = ['#1D4ED8','#7C3AED','#DB2777','#D97706','#059669','#0891B2','#DC2626','#0F766E'];
    return colors[(name?.charCodeAt(0) || 0) % colors.length];
  }

  isPast(date: string): boolean {
    return new Date(date) < new Date(new Date().toDateString());
  }

  daysUntil(date: string): number {
    const diff = new Date(date).getTime() - new Date().getTime();
    return Math.ceil(diff / 86400000);
  }

  getInitials(name: string): string {
    if (!name) return '?';
    return name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase();
  }
}
