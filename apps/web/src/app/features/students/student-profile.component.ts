import { Component, inject, signal, Input, OnChanges } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { DatePipe, TitleCasePipe } from '@angular/common';
import { ApiService } from '../../core/services/api.service';
import type { Student, ApiResponse } from '../../core/models';

@Component({
  selector: 'app-student-profile',
  standalone: true,
  imports: [ MatIconModule, MatButtonModule, MatProgressSpinnerModule, DatePipe, TitleCasePipe ],
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
                <div class="ii-value">{{ s.nationality || '—' }}</div>
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

          <!-- Emergency contacts -->
          @if (s.emergency_contacts && s.emergency_contacts.length) {
            <div class="section">
              <div class="section-title">
                <mat-icon>contacts</mat-icon> Emergency Contacts
              </div>
              <div class="contacts-list">
                @for (c of s.emergency_contacts; track c.phone) {
                  <div class="contact-row">
                    <div class="cr-av">{{ c.name[0] }}</div>
                    <div class="cr-info">
                      <div class="cr-name">
                        {{ c.name }}
                        @if (c.is_primary) {
                          <span class="primary-tag">Primary</span>
                        }
                      </div>
                      <div class="cr-detail">{{ c.relation | titlecase }} · {{ c.phone }}</div>
                    </div>
                    <a [href]="'tel:' + c.phone" class="call-btn">
                      <mat-icon style="font-size:16px;width:16px;height:16px">call</mat-icon>
                    </a>
                  </div>
                }
              </div>
            </div>
          }

        </div>
      }
    </div>
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

    .tags { display: flex; gap: 5px; flex-wrap: wrap; margin-top: 2px; }
    .tag { font-size: 11px; font-weight: 500; padding: 2px 8px; border-radius: 5px; }
    .tag.red { background: var(--red-light); color: #991B1B; }

    /* Contacts */
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
  `],
})
export class StudentProfileComponent implements OnChanges {
  private api = inject(ApiService);

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
        next: res => { this.student.set(res.data); this.loading.set(false); },
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
}
