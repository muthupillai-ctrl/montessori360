import { Component, inject, signal, Input, OnChanges } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { DatePipe, TitleCasePipe, DecimalPipe } from '@angular/common';
import { ApiService } from '../../core/services/api.service';
import { AuthService } from '../../core/services/auth.service';
import type { Student, ApiResponse } from '../../core/models';
import { ParentFormDialogComponent } from './parent-form-dialog.component';
import type { ParentRecord } from './parent-form-dialog.component';

@Component({
  selector: 'app-student-profile',
  standalone: true,
  imports: [ MatIconModule, MatButtonModule, MatProgressSpinnerModule, MatDialogModule, DatePipe, TitleCasePipe, DecimalPipe ],
  template: `
    <!-- Backdrop -->
    @if (visible()) {
      <div class="backdrop" (click)="close()"></div>
    }

    <!-- Slide-over panel -->
    <div class="panel" [class.open]="visible()">

      @if (loading()) {
        <div class="panel-loading">
          <mat-progress-spinner mode="indeterminate" diameter="32" />
        </div>
      }

      @if (student(); as s) {

        <!-- Header -->
        <div class="panel-header">
          <div class="ph-av" [style.background]="avatarColor(s.first_name)">
            {{ s.first_name[0] }}{{ s.last_name[0] }}
          </div>
          <div class="ph-info">
            <div class="ph-name">{{ s.first_name }} {{ s.last_name }}</div>
            <div class="ph-meta">
              <span class="mono-chip">{{ s.admission_no }}</span>
              @if (s.class_name) {
                <span class="class-chip">{{ s.class_name }}</span>
              }
              <span [class]="'badge badge-' + (s.is_active ? 'active' : 'inactive')">
                {{ s.is_active ? 'Active' : 'Inactive' }}
              </span>
            </div>
          </div>
          <button class="close-btn" (click)="close()">
            <mat-icon>close</mat-icon>
          </button>
        </div>

        <!-- Body -->
        <div class="panel-body">

          <!-- Basic info -->
          <div class="section">
            <div class="section-title">
              <mat-icon>person</mat-icon> Basic Information
            </div>
            <div class="info-grid">
              <div class="info-item">
                <div class="ii-label">Date of Birth</div>
                <div class="ii-value">{{ s.dob | date:'d MMMM yyyy' }}</div>
              </div>
              <div class="info-item">
                <div class="ii-label">Gender</div>
                <div class="ii-value">{{ (s.gender | titlecase) || '—' }}</div>
              </div>
              <div class="info-item">
                <div class="ii-label">Blood Group</div>
                <div class="ii-value">{{ s.blood_group || '—' }}</div>
              </div>
              <div class="info-item">
                <div class="ii-label">Nationality</div>
                <div class="ii-value">
                  {{ s.nationality || '—' }}@if (s.mother_tongue) {<span class="lang-sep">, </span>{{ s.mother_tongue }}}
                </div>
              </div>
              <div class="info-item">
                <div class="ii-label">Admission Date</div>
                <div class="ii-value">{{ s.admission_date | date:'d MMM yyyy' }}</div>
              </div>
              <div class="info-item">
                <div class="ii-label">Class</div>
                <div class="ii-value">{{ s.class_name || 'Unassigned' }}</div>
              </div>
            </div>
          </div>

          <!-- Medical -->
          @if ((s.allergies && s.allergies.length > 0) || s.dietary_notes) {
            <div class="section">
              <div class="section-title">
                <mat-icon>health_and_safety</mat-icon> Health & Dietary
              </div>
              @if (s.allergies && s.allergies.length) {
                <div class="info-item full">
                  <div class="ii-label">Allergies</div>
                  <div class="ii-value tags">
                    @for (a of s.allergies; track a) {
                      <span class="tag red">{{ a }}</span>
                    }
                  </div>
                </div>
              }
              @if (s.dietary_notes) {
                <div class="info-item full" style="margin-top:8px">
                  <div class="ii-label">Dietary Notes</div>
                  <div class="ii-value">{{ s.dietary_notes }}</div>
                </div>
              }
            </div>
          }

          <!-- Parents -->
          <div class="section">
            <div class="section-title">
              <mat-icon>family_restroom</mat-icon> Parents
              @if (isAdmin() && parents().length < 3) {
                <button class="add-parent-btn" (click)="openParentForm(null)">
                  <mat-icon style="font-size:14px;width:14px;height:14px">add</mat-icon>
                  Add
                </button>
              }
            </div>
            @if (parentsLoading()) {
              <div style="padding:12px;color:var(--text-3);font-size:12px">Loading…</div>
            } @else if (!parents().length) {
              <div class="no-parents">
                No parent records yet.
                @if (isAdmin()) {
                  <button class="add-parent-btn" (click)="openParentForm(null)">Add parent</button>
                }
              </div>
            } @else {
              <div class="parents-list">
                @for (p of parents(); track p.id) {
                  <div class="parent-card">
                    <div class="pc-header">
                      <div class="pc-av" [style.background]="getColor(p.first_name)">
                        {{ p.first_name[0] }}{{ p.last_name[0] }}
                      </div>
                      <div class="pc-info">
                        <div class="pc-name">
                          {{ p.first_name }} {{ p.last_name }}
                          @if (p.is_primary) { <span class="primary-tag">Primary</span> }
                          @if (p.can_pickup) { <span class="pickup-tag">Pickup</span> }
                        </div>
                        <div class="pc-relation">{{ p.relation | titlecase }}</div>
                      </div>
                      @if (isAdmin()) {
                        <div class="pc-actions">
                          @if (p.email) {
                            <button class="pc-btn invite" (click)="inviteToPortal(p)" title="Invite to parent portal">
                              <mat-icon style="font-size:14px;width:14px;height:14px">mail</mat-icon>
                            </button>
                          }
                          <button class="pc-btn" (click)="openParentForm(p)">
                            <mat-icon style="font-size:14px;width:14px;height:14px">edit</mat-icon>
                          </button>
                          <button class="pc-btn danger" (click)="deleteParent(p)">
                            <mat-icon style="font-size:14px;width:14px;height:14px">delete</mat-icon>
                          </button>
                        </div>
                      }
                    </div>
                    <div class="pc-details">
                      @if (p.mobile) {
                        <div class="pc-row">
                          <mat-icon class="pc-icon">phone</mat-icon>
                          <a [href]="'tel:' + p.mobile" class="pc-val">{{ p.mobile }}</a>
                          @if (p.mobile_alt) { <span class="pc-val text-muted">· {{ p.mobile_alt }}</span> }
                        </div>
                      }
                      @if (p.email) {
                        <div class="pc-row">
                          <mat-icon class="pc-icon">email</mat-icon>
                          <span class="pc-val" style="color:var(--blue)">{{ p.email }}</span>
                        </div>
                      }
                      @if (p.profession) {
                        <div class="pc-row">
                          <mat-icon class="pc-icon">work</mat-icon>
                          <span class="pc-val">{{ p.profession }}
                            @if (p.employer) { · {{ p.employer }} }
                          </span>
                        </div>
                      }
                      @if (p.annual_income) {
                        <div class="pc-row">
                          <mat-icon class="pc-icon">payments</mat-icon>
                          <span class="pc-val">₹{{ p.annual_income | number:'1.0-0' }} / year</span>
                        </div>
                      }
                      @if (p.education) {
                        <div class="pc-row">
                          <mat-icon class="pc-icon">school</mat-icon>
                          <span class="pc-val">{{ p.education }}</span>
                        </div>
                      }
                    </div>
                  </div>
                }
              </div>
            }
          </div>

          <!-- Transport -->
          <div class="section">
            <div class="section-title">
              <mat-icon>directions_bus</mat-icon> Transport
            </div>
            @if (transportLoading()) {
              <div style="font-size:12px;color:var(--text-3);padding:8px 0">Loading…</div>
            } @else if (!transport()) {
              <div style="font-size:12px;color:var(--text-3);font-style:italic">Not enrolled in any transport route</div>
            } @else {
              <div class="transport-card">
                <div class="tc-row">
                  <mat-icon class="tc-icon" style="color:var(--purple)">route</mat-icon>
                  <div class="tc-info">
                    <div class="tc-label">Route</div>
                    <div class="tc-val">{{ transport()!.route_name }}
                      @if (transport()!.route_code) { <span class="tc-badge">{{ transport()!.route_code }}</span> }
                    </div>
                  </div>
                </div>
                @if (transport()!.vehicle_reg) {
                  <div class="tc-row">
                    <mat-icon class="tc-icon" style="color:var(--blue)">directions_bus</mat-icon>
                    <div class="tc-info">
                      <div class="tc-label">Vehicle</div>
                      <div class="tc-val">{{ transport()!.vehicle_reg }}</div>
                    </div>
                  </div>
                }
                @if (transport()!.driver_name) {
                  <div class="tc-row">
                    <mat-icon class="tc-icon" style="color:var(--text-3)">person</mat-icon>
                    <div class="tc-info">
                      <div class="tc-label">Driver</div>
                      <div class="tc-val">{{ transport()!.driver_name }}
                        @if (transport()!.driver_phone) { · {{ transport()!.driver_phone }} }
                      </div>
                    </div>
                  </div>
                }
                @if (transport()!.pickup_stop_name) {
                  <div class="tc-row">
                    <mat-icon class="tc-icon" style="color:var(--green)">login</mat-icon>
                    <div class="tc-info">
                      <div class="tc-label">Pickup Stop</div>
                      <div class="tc-val">{{ transport()!.pickup_stop_name }}
                        @if (transport()!.morning_eta) { <span class="tc-time">🌅 {{ transport()!.morning_eta }}</span> }
                      </div>
                    </div>
                  </div>
                }
                @if (transport()!.drop_stop_name) {
                  <div class="tc-row">
                    <mat-icon class="tc-icon" style="color:var(--red)">logout</mat-icon>
                    <div class="tc-info">
                      <div class="tc-label">Drop Stop</div>
                      <div class="tc-val">{{ transport()!.drop_stop_name }}
                        @if (transport()!.evening_eta) { <span class="tc-time">🌆 {{ transport()!.evening_eta }}</span> }
                      </div>
                    </div>
                  </div>
                }
                @if (transport()!.monthly_fee) {
                  <div class="tc-row">
                    <mat-icon class="tc-icon" style="color:var(--amber)">payments</mat-icon>
                    <div class="tc-info">
                      <div class="tc-label">Monthly Fee</div>
                      <div class="tc-val" style="font-weight:600;color:var(--green)">₹{{ transport()!.monthly_fee | number:'1.0-0' }}</div>
                    </div>
                  </div>
                }
              </div>
            }
          </div>


        </div>
      }
    </div>

    <!-- Invite link dialog -->
    @if (inviteLink()) {
      <div class="invite-overlay" (click)="inviteLink.set(null)">
        <div class="invite-dialog" (click)="$event.stopPropagation()">
          <div class="invite-icon">
            <mat-icon style="font-size:28px;width:28px;height:28px;color:#059669">check_circle</mat-icon>
          </div>
          <div class="invite-title">Invite link generated</div>
          <div class="invite-sub">Share this link with <strong>{{ inviteParentName() }}</strong>. It expires in 72 hours.</div>
          <div class="invite-link-box">
            <span class="invite-link-text">{{ inviteLink() }}</span>
          </div>
          <div class="invite-actions">
            <button class="invite-btn copy" (click)="copyInviteLink()">
              <mat-icon style="font-size:16px;width:16px;height:16px">content_copy</mat-icon>
              Copy Link
            </button>
            <button class="invite-btn close" (click)="inviteLink.set(null)">Done</button>
          </div>
        </div>
      </div>
    }
  `,
  styles: [`
    .backdrop {
      position: fixed; inset: 0; background: rgba(0,0,0,.3);
      z-index: 900; animation: fadeIn .2s ease;
    }
    @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }

    .panel {
      position: fixed; top: 0; right: 0; bottom: 0;
      width: 420px; background: #fff;
      box-shadow: -4px 0 24px rgba(0,0,0,.12);
      z-index: 901; display: flex; flex-direction: column;
      transform: translateX(100%);
      transition: transform .25s cubic-bezier(.4,0,.2,1);
      &.open { transform: translateX(0); }
    }

    .panel-loading {
      display: flex; align-items: center; justify-content: center;
      flex: 1;
    }

    /* Header */
    .panel-header {
      display: flex; align-items: center; gap: 12px;
      padding: 20px; border-bottom: 1px solid var(--border);
      flex-shrink: 0;
    }
    .ph-av {
      width: 48px; height: 48px; border-radius: 12px;
      color: #fff; font-size: 16px; font-weight: 700;
      display: flex; align-items: center; justify-content: center; flex-shrink: 0;
    }
    .ph-name { font-size: 16px; font-weight: 600; color: var(--text); }
    .ph-meta { display: flex; align-items: center; gap: 6px; margin-top: 5px; flex-wrap: wrap; }

    .close-btn {
      margin-left: auto; background: none; border: none;
      width: 32px; height: 32px; border-radius: 8px;
      cursor: pointer; color: var(--text-3);
      display: flex; align-items: center; justify-content: center; flex-shrink: 0;
      &:hover { background: var(--bg); }
      mat-icon { font-size: 20px; width: 20px; height: 20px; }
    }

    /* Body */
    .panel-body { flex: 1; overflow-y: auto; padding: 16px 20px; }

    .section {
      margin-bottom: 20px;
      &:last-child { margin-bottom: 0; }
    }
    .section-title {
      display: flex; align-items: center; gap: 6px;
      font-size: 11px; font-weight: 600; text-transform: uppercase;
      letter-spacing: .4px; color: var(--text-3);
      margin-bottom: 10px;
      mat-icon { font-size: 14px; width: 14px; height: 14px; }
    }

    .info-grid {
      display: grid; grid-template-columns: 1fr 1fr; gap: 1px;
      background: var(--border); border-radius: 9px; overflow: hidden;
    }
    .info-item {
      background: var(--surface); padding: 10px 12px;
      &.full { grid-column: span 2; }
    }
    .ii-label { font-size: 10px; color: var(--text-4); text-transform: uppercase; letter-spacing: .3px; margin-bottom: 3px; }
    .ii-value { font-size: 13px; font-weight: 500; color: var(--text); }
    .lang-sep { color: var(--text-4); }

    .tags { display: flex; gap: 5px; flex-wrap: wrap; margin-top: 2px; }
    .tag { font-size: 11px; font-weight: 500; padding: 2px 8px; border-radius: 5px; }
    .tag.red { background: var(--red-light); color: #991B1B; }

    /* Contacts */
    /* Parents */
    .add-parent-btn {
      margin-left: auto; display: inline-flex; align-items: center; gap: 4px;
      background: var(--blue-light); color: var(--blue); border: none;
      border-radius: 6px; padding: 3px 10px; font-size: 12px; cursor: pointer;
      &:hover { background: var(--blue-mid); }
    }
    .no-parents { font-size: 12px; color: var(--text-3); padding: 8px 0; display: flex; align-items: center; gap: 8px; }
    .parents-list { display: flex; flex-direction: column; gap: 10px; }
    .parent-card { background: var(--bg); border: 1px solid var(--border); border-radius: 9px; overflow: hidden; }
    .pc-header { display: flex; align-items: center; gap: 10px; padding: 10px 12px; background: var(--surface); border-bottom: 1px solid var(--border-light); }
    .pc-av { width: 32px; height: 32px; border-radius: 8px; color: #fff; font-size: 11px; font-weight: 700; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
    .pc-info { flex: 1; }
    .pc-name { font-size: 13px; font-weight: 600; color: var(--text); display: flex; align-items: center; gap: 5px; flex-wrap: wrap; }
    .pc-relation { font-size: 11px; color: var(--text-3); text-transform: capitalize; margin-top: 2px; }
    .pickup-tag { font-size: 9px; font-weight: 600; padding: 1px 6px; border-radius: 10px; background: var(--green-light); color: #065F46; }
    .pc-actions { display: flex; gap: 4px; }
    .pc-btn { width: 26px; height: 26px; border-radius: 5px; border: none; cursor: pointer; background: var(--border-light); color: var(--text-3); display: flex; align-items: center; justify-content: center; &:hover { background: var(--blue-light); color: var(--blue); } &.danger:hover { background: var(--red-light); color: var(--red); } &.invite:hover { background: var(--green-light); color: #065F46; } }
    .pc-details { padding: 8px 12px; display: flex; flex-direction: column; gap: 5px; }
    .pc-row { display: flex; align-items: center; gap: 7px; }
    .pc-icon { font-size: 14px; width: 14px; height: 14px; color: var(--text-3); flex-shrink: 0; }
    .pc-val { font-size: 12px; color: var(--text-2); }
    .text-muted { color: var(--text-3); }

    /* Transport card */
    .transport-card { display: flex; flex-direction: column; gap: 0; background: var(--bg); border: 1px solid var(--border); border-radius: 9px; overflow: hidden; }
    .tc-row { display: flex; align-items: flex-start; gap: 10px; padding: 9px 12px; border-bottom: 1px solid var(--border-light); &:last-child { border-bottom: none; } }
    .tc-icon { font-size: 16px; width: 16px; height: 16px; flex-shrink: 0; margin-top: 1px; }
    .tc-label { font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: .3px; color: var(--text-4); margin-bottom: 2px; }
    .tc-val   { font-size: 13px; color: var(--text); display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
    .tc-badge { font-size: 10px; font-weight: 600; padding: 1px 6px; border-radius: 4px; background: var(--purple-light); color: var(--purple); }
    .tc-time  { font-size: 11px; color: var(--text-3); }

    .contacts-list { display: flex; flex-direction: column; gap: 8px; }
    .contact-row {
      display: flex; align-items: center; gap: 10px;
      background: var(--bg); border-radius: 9px; padding: 10px 12px;
    }
    .cr-av {
      width: 32px; height: 32px; border-radius: 8px;
      background: var(--blue); color: #fff;
      display: flex; align-items: center; justify-content: center;
      font-size: 13px; font-weight: 600; flex-shrink: 0;
    }
    .cr-info { flex: 1; min-width: 0; }
    .cr-name {
      font-size: 13px; font-weight: 500; color: var(--text);
      display: flex; align-items: center; gap: 6px;
    }
    .cr-detail { font-size: 11px; color: var(--text-3); margin-top: 2px; }
    .primary-tag {
      font-size: 10px; font-weight: 600;
      background: var(--amber-light); color: #92400E;
      padding: 1px 6px; border-radius: 4px;
    }
    .call-btn {
      width: 30px; height: 30px; border-radius: 8px;
      background: var(--green-light); color: var(--green);
      display: flex; align-items: center; justify-content: center;
      text-decoration: none; flex-shrink: 0;
      &:hover { background: #BBF7D0; }
    }

    .mono-chip {
      font-family: 'SF Mono', monospace; font-size: 11px;
      background: var(--bg); color: var(--blue);
      padding: 2px 7px; border-radius: 4px;
    }
    .class-chip {
      background: var(--purple-light); color: var(--purple);
      font-size: 11px; font-weight: 500; padding: 2px 7px; border-radius: 4px;
    }

    /* Invite link dialog */
    .invite-overlay {
      position: fixed; inset: 0; background: rgba(0,0,0,.4);
      z-index: 1000; display: flex; align-items: center; justify-content: center;
    }
    .invite-dialog {
      background: #fff; border-radius: 16px; padding: 28px 24px;
      width: 420px; max-width: 90vw; box-shadow: 0 20px 60px rgba(0,0,0,.2);
      display: flex; flex-direction: column; align-items: center; gap: 10px;
    }
    .invite-icon { margin-bottom: 4px; }
    .invite-title { font-size: 17px; font-weight: 700; color: var(--text); }
    .invite-sub { font-size: 13px; color: var(--text-3); text-align: center; line-height: 1.5; }
    .invite-link-box {
      width: 100%; background: var(--bg); border: 1px solid var(--border);
      border-radius: 8px; padding: 10px 12px; margin-top: 6px;
      word-break: break-all;
    }
    .invite-link-text { font-size: 11px; color: var(--text-2); font-family: monospace; }
    .invite-actions { display: flex; gap: 10px; margin-top: 8px; width: 100%; }
    .invite-btn {
      flex: 1; padding: 10px; border-radius: 8px; border: none;
      font-size: 13px; font-weight: 600; cursor: pointer;
      display: flex; align-items: center; justify-content: center; gap: 6px;
      &.copy { background: #059669; color: #fff; }
      &.close { background: var(--bg); color: var(--text-2); border: 1px solid var(--border); }
    }
  `],
})
export class StudentProfileComponent implements OnChanges {
  private api    = inject(ApiService);
  private dialog = inject(MatDialog);
  private snack  = inject(MatSnackBar);
  private auth   = inject(AuthService);

  parents         = signal<ParentRecord[]>([]);
  transport       = signal<any | null>(null);
  transportLoading = signal(false);
  parentsLoading = signal(false);

  isAdmin = () => ['owner','principal'].includes(this.auth.user()?.role ?? '');

  @Input() studentId: string | null = null;
  @Input() schema: string = '';

  visible = signal(false);
  loading = signal(false);
  student = signal<Student | null>(null);

  ngOnChanges() {
    if (this.studentId) {
      this.visible.set(true);
      this.loading.set(true);
      this.api.get<ApiResponse<Student>>('/students/' + this.studentId).subscribe({
        next: res => {
          this.student.set(res.data);
          this.loading.set(false);
          this.loadParents(res.data.id);
        },
        error: () => this.loading.set(false),
      });
    } else {
      this.visible.set(false);
      this.student.set(null);
    }
  }

  close() {
    this.visible.set(false);
    this.student.set(null);
  }

  avatarColor(name: string): string {
    const colors = ['#2563EB','#7C3AED','#DB2777','#D97706','#059669','#0891B2'];
    return colors[name.charCodeAt(0) % colors.length];
  }

  loadTransport(studentId: string) {
    this.transportLoading.set(true);
    this.api.get<any>('/transport/students/' + studentId).subscribe({
      next: (res: any) => { this.transport.set(res.data); this.transportLoading.set(false); },
      error: () => this.transportLoading.set(false),
    });
  }

  loadParents(studentId: string) {
    this.parentsLoading.set(true);
    this.api.get<any>('/students/' + studentId + '/parents').subscribe({
      next: (res: any) => { this.parents.set(res.data ?? []); this.parentsLoading.set(false); },
      error: () => this.parentsLoading.set(false),
    });
  }

  openParentForm(parent: ParentRecord | null) {
    const s = this.student();
    if (!s) return;
    const ref = this.dialog.open(ParentFormDialogComponent, {
      width: '95vw', maxWidth: '560px', maxHeight: '90vh', disableClose: true,
      data: { studentId: s.id, studentName: s.first_name + ' ' + s.last_name, parent },
    });
    ref.afterClosed().subscribe((result: any) => {
      if (result) {
        this.snack.open(parent ? 'Parent updated' : 'Parent added', 'OK', { duration: 2500 });
        this.loadParents(s.id);
      }
    });
  }

  deleteParent(p: ParentRecord) {
    if (!confirm('Remove ' + p.first_name + ' ' + p.last_name + ' from this student?')) return;
    this.api.delete<any>('/students/' + p.student_id + '/parents/' + p.id).subscribe({
      next: () => {
        this.snack.open('Parent removed', 'OK', { duration: 2000 });
        this.loadParents(p.student_id);
      },
      error: (err: any) => this.snack.open(err.error?.error?.message ?? 'Error', 'OK', { duration: 3000 }),
    });
  }

  inviteLink = signal<string | null>(null);
  inviteParentName = signal('');

  inviteToPortal(p: ParentRecord) {
    this.api.post<any>(`/students/${p.student_id}/parents/invite`, {
      email:      p.email,
      first_name: p.first_name,
      last_name:  p.last_name,
      phone:      p.mobile ?? '',
      relation:   p.relation,
    }).subscribe({
      next: (res: any) => {
        const token = res.data?.inviteToken;
        const link  = `${window.location.origin}/parent/set-password?token=${token}`;
        this.inviteLink.set(link);
        this.inviteParentName.set(`${p.first_name} ${p.last_name}`);
      },
      error: (err: any) => this.snack.open(err.error?.error?.message ?? 'Invite failed', 'OK', { duration: 3000 }),
    });
  }

  copyInviteLink() {
    const link = this.inviteLink();
    if (!link) return;
    navigator.clipboard.writeText(link).then(() =>
      this.snack.open('Link copied to clipboard!', 'OK', { duration: 2000 })
    );
  }

  getColor(name: string): string {
    const colors = ['#2563EB','#7C3AED','#DB2777','#D97706','#059669','#0891B2'];
    return colors[(name?.charCodeAt(0) || 0) % colors.length];
  }
}
