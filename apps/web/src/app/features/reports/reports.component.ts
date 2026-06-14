import { Component, inject, signal, OnInit, computed } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTabsModule } from '@angular/material/tabs';
import { MatMenuModule } from '@angular/material/menu';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { FormsModule } from '@angular/forms';
import { DatePipe, DecimalPipe } from '@angular/common';
import { ApiService } from '../../core/services/api.service';
import { TemplateDialogComponent } from './template-dialog.component';
import type { SchoolClass } from '../../core/models';

export interface ReportTemplate {
  id:               string;
  name:             string;
  description:      string | null;
  primary_colour:   string;
  secondary_colour: string;
  accent_colour:    string;
  font:             string;
  sections:         { key: string; enabled: boolean; order: number; label?: string }[];
  is_default:       boolean;
  is_active:        boolean;
}

@Component({
  selector: 'app-reports',
  standalone: true,
  imports: [
    MatIconModule, MatProgressSpinnerModule,
    MatTabsModule, MatMenuModule, MatDialogModule, FormsModule, DatePipe, DecimalPipe,
  ],
  template: `
    <mat-tab-group class="reports-page-tabs">

      <!-- ── Generate Reports ────────────────────────────────── -->
      <mat-tab label="📄  Generate">
        <div class="tab-body">

          <div class="page-header">
            <div>
              <h1>Progress Reports</h1>
              <div class="subtitle">Generate PDF progress cards for students</div>
            </div>
          </div>

          <!-- Filters -->
          <div class="gen-panel">
            <div class="gp-section">
              <div class="gp-label">Select Students</div>
              <div class="filter-row">
                <select class="field-input" [value]="genClass()"
                        (change)="onGenClassChange($any($event.target).value)">
                  <option value="">All Classes</option>
                  @for (cls of classes(); track cls.id) {
                    <option [value]="cls.id">{{ cls.name }}</option>
                  }
                </select>
                <select class="field-input w-300" [value]="genStudentId()"
                        (change)="genStudentId.set($any($event.target).value)">
                  <option value="">All students in class</option>
                  @for (s of genStudents(); track s.id) {
                    <option [value]="s.id">{{ s.first_name }} {{ s.last_name }} · {{ s.admission_no }}</option>
                  }
                </select>
              </div>
            </div>

            <div class="gp-section">
              <div class="gp-label">Report Period</div>
              <div class="filter-row">
                <div class="field-group">
                  <label class="field-label">Term / Label</label>
                  <input class="field-input w-200" [(ngModel)]="genTerm" placeholder="e.g. Term 1 2025-2026">
                </div>
                <div class="field-group">
                  <label class="field-label">From</label>
                  <input class="field-input" type="date" [(ngModel)]="genFrom">
                </div>
                <div class="field-group">
                  <label class="field-label">To</label>
                  <input class="field-input" type="date" [(ngModel)]="genTo">
                </div>
              </div>
            </div>

            <div class="gp-section">
              <div class="gp-label">Template</div>
              <div class="template-cards">
                @for (t of templates(); track t.id) {
                  <div class="template-card" [class.selected]="genTemplateId() === t.id"
                       (click)="genTemplateId.set(t.id)">
                    <div class="tc-swatch">
                      <div class="tc-primary" [style.background]="t.primary_colour"></div>
                      <div class="tc-accent"  [style.background]="t.accent_colour"></div>
                    </div>
                    <div class="tc-info">
                      <div class="tc-name">{{ t.name }}</div>
                      @if (t.is_default) {
                        <span class="default-tag">Default</span>
                      }
                    </div>
                    @if (genTemplateId() === t.id) {
                      <mat-icon class="tc-check">check_circle</mat-icon>
                    }
                  </div>
                }
                @if (!templates().length) {
                  <div class="no-templates">No templates. Create one in the Templates tab.</div>
                }
              </div>
            </div>

            <!-- Generate button -->
            <div class="gen-actions">
              @if (generating()) {
                <div class="gen-progress">
                  <mat-progress-spinner diameter="20" mode="indeterminate" />
                  <span>Generating PDF…</span>
                </div>
              } @else {
                <button class="btn-primary-custom" (click)="generate()"
                        [disabled]="!canGenerate()">
                  <mat-icon style="font-size:16px;width:16px;height:16px">picture_as_pdf</mat-icon>
                  Generate {{ genStudentId() ? '1 Report' : 'Reports for Class' }}
                </button>
              }
            </div>

          </div>

          <!-- How it works -->
          <div class="how-it-works">
            <div class="hiw-title">What's included in the Progress Card</div>
            <div class="hiw-sections">
              @for (s of sectionInfo; track s.key) {
                <div class="hiw-item">
                  <div class="hiw-icon">{{ s.emoji }}</div>
                  <div>
                    <div class="hiw-label">{{ s.label }}</div>
                    <div class="hiw-desc">{{ s.desc }}</div>
                  </div>
                </div>
              }
            </div>
          </div>

        </div>
      </mat-tab>

      <!-- ── Templates tab ────────────────────────────────────── -->
      <mat-tab label="🎨  Templates">
        <div class="tab-body">

          <div class="page-header">
            <div>
              <div style="font-size:15px;font-weight:600;color:var(--text)">Report Templates</div>
              <div class="subtitle">Customise the design and sections of progress cards</div>
            </div>
            <button class="btn-primary-custom" (click)="openTemplateDialog()">
              <mat-icon style="font-size:16px;width:16px;height:16px">add</mat-icon>
              New Template
            </button>
          </div>

          @if (templatesLoading()) {
            <div class="loading-row"><mat-progress-spinner diameter="28" mode="indeterminate" /></div>
          } @else if (!templates().length) {
            <div class="empty-state">
              <div class="empty-icon">🎨</div>
              <div class="empty-title">No templates yet</div>
              <div class="empty-sub">Create your first template to customise how progress cards look.</div>
              <button class="btn-primary-custom" (click)="openTemplateDialog()">
                <mat-icon style="font-size:16px;width:16px;height:16px">add</mat-icon>
                Create Template
              </button>
            </div>
          } @else {
            <div class="templates-grid">
              @for (t of templates(); track t.id) {
                <div class="template-detail-card">

                  <!-- Preview strip -->
                  <div class="tdc-preview" [style.background]="t.primary_colour">
                    <div class="tdcp-accent" [style.background]="t.accent_colour"></div>
                    <div class="tdcp-name" [style.color]="t.accent_colour">{{ t.name }}</div>
                    <div class="tdcp-sub" [style.color]="t.accent_colour + 'CC'">Progress Report</div>
                  </div>

                  <div class="tdc-body">
                    <div class="tdc-top">
                      <div>
                        <div class="tdc-name">{{ t.name }}</div>
                        @if (t.description) {
                          <div class="tdc-desc">{{ t.description }}</div>
                        }
                      </div>
                      <div class="tdc-badges">
                        @if (t.is_default) {
                          <span class="default-tag">Default</span>
                        }
                      </div>
                    </div>

                    <!-- Sections -->
                    <div class="tdc-sections">
                      @for (s of getEnabledSections(t); track s.key) {
                        <span class="section-chip">{{ getSectionEmoji(s.key) }} {{ s.label ?? getSectionLabel(s.key) }}</span>
                      }
                    </div>

                    <!-- Colours -->
                    <div class="tdc-colours">
                      <div class="colour-dot" [style.background]="t.primary_colour" [title]="'Primary: ' + t.primary_colour"></div>
                      <div class="colour-dot" [style.background]="t.secondary_colour" [title]="'Secondary: ' + t.secondary_colour"></div>
                      <div class="colour-dot" [style.background]="t.accent_colour" [title]="'Accent: ' + t.accent_colour"></div>
                      <span class="font-tag">{{ t.font }}</span>
                    </div>

                    <div class="tdc-actions">
                      <button class="btn-outline-sm" (click)="openTemplateDialog(t)">
                        <mat-icon style="font-size:14px;width:14px;height:14px">edit</mat-icon> Edit
                      </button>
                      @if (!t.is_default) {
                        <button class="btn-outline-sm" (click)="setDefault(t)">
                          <mat-icon style="font-size:14px;width:14px;height:14px">star</mat-icon> Set Default
                        </button>
                        <button class="btn-outline-sm danger" (click)="deleteTemplate(t)">
                          <mat-icon style="font-size:14px;width:14px;height:14px">delete</mat-icon> Delete
                        </button>
                      }
                    </div>
                  </div>
                </div>
              }
            </div>
          }
        </div>
      </mat-tab>

      <!-- ── Class Assignment tab ─────────────────────────────── -->
      <mat-tab label="🏫  Class Assignment">
        <div class="tab-body">
          <div class="page-header">
            <div>
              <div style="font-size:15px;font-weight:600;color:var(--text)">Template Assignment</div>
              <div class="subtitle">Assign specific templates to classes (overrides school default)</div>
            </div>
          </div>

          <div class="assignment-list">
            @for (cls of classes(); track cls.id) {
              <div class="assign-row">
                <div class="ar-class">
                  <div class="ar-av" [style.background]="getClassColor(cls.name)">{{ cls.name[0] }}</div>
                  <div>
                    <div class="ar-name">{{ cls.name }}</div>
                    <div class="ar-count">{{ cls.enrolled_count }} students</div>
                  </div>
                </div>
                <div class="ar-template">
                  <select class="field-input w-260"
                          [value]="getClassTemplate(cls.id)"
                          (change)="assignTemplate(cls.id, $any($event.target).value)">
                    <option value="">Use school default template</option>
                    @for (t of templates(); track t.id) {
                      <option [value]="t.id">{{ t.name }}</option>
                    }
                  </select>
                </div>
              </div>
            }
          </div>
        </div>
      </mat-tab>


      <!-- ── Transport Reports tab ──────────────────────────── -->
      <mat-tab label="🚌  Transport">
        <div class="tab-body">

          <!-- Sub tabs -->
          <div class="tr-tabs">
            <button class="tr-tab" [class.active]="transportTab() === 'trips'"
                    (click)="transportTab.set('trips')">Trip Reports</button>
            <button class="tr-tab" [class.active]="transportTab() === 'students'"
                    (click)="loadStudentTransportReport(); transportTab.set('students')">Student Enrollment</button>
          </div>

          <!-- ── Trip Reports ── -->
          @if (transportTab() === 'trips') {
            <div class="tr-section">
              <div class="tr-filters">
                <div class="tf-group">
                  <label class="tf-label">From Date</label>
                  <input class="tf-input" type="date" [(ngModel)]="tripFromDate">
                </div>
                <div class="tf-group">
                  <label class="tf-label">To Date</label>
                  <input class="tf-input" type="date" [(ngModel)]="tripToDate">
                </div>
                <div class="tf-group">
                  <label class="tf-label">Route</label>
                  <select class="tf-input" [(ngModel)]="tripRouteId">
                    <option value="">All Routes</option>
                    @for (r of transportRoutes(); track r.id) {
                      <option [value]="r.id">{{ r.name }}</option>
                    }
                  </select>
                </div>
                <div class="tf-group">
                  <label class="tf-label">Direction</label>
                  <select class="tf-input" [(ngModel)]="tripType">
                    <option value="">All</option>
                    <option value="morning">🏫 Pickup</option>
                    <option value="evening">🏠 Drop</option>
                  </select>
                </div>
                <button class="tf-btn" (click)="loadTripReport()" [disabled]="tripReportLoading()">
                  <mat-icon style="font-size:15px;width:15px;height:15px">search</mat-icon>
                  Generate
                </button>
                @if (tripReport()) {
                  <button class="tf-btn outline" (click)="exportTripCSV()">
                    <mat-icon style="font-size:15px;width:15px;height:15px">download</mat-icon>
                    Export CSV
                  </button>
                }
              </div>

              @if (tripReportLoading()) {
                <div class="tr-loading"><mat-progress-spinner diameter="24" mode="indeterminate"/></div>
              } @else if (tripReport()) {
                <!-- Summary cards -->
                <div class="tr-summary">
                  <div class="ts-card"><div class="ts-val">{{ tripReport()!.summary.total_trips }}</div><div class="ts-lbl">Total Trips</div></div>
                  <div class="ts-card"><div class="ts-val">{{ tripReport()!.summary.completed_trips }}</div><div class="ts-lbl">Completed</div></div>
                  <div class="ts-card"><div class="ts-val">{{ tripReport()!.summary.total_boarded }}</div><div class="ts-lbl">Total Boarded</div></div>
                  <div class="ts-card red"><div class="ts-val">{{ tripReport()!.summary.total_absent }}</div><div class="ts-lbl">Total Absent</div></div>
                </div>

                <!-- Trip table -->
                <div class="tr-table-wrap">
                  <table class="tr-table">
                    <thead>
                      <tr>
                        <th>Date</th><th>Route</th><th>Direction</th><th>Driver</th>
                        <th>Vehicle</th><th>Status</th><th class="tc">Students</th>
                        <th class="tc">Boarded</th><th class="tc">Absent</th><th>Duration</th>
                      </tr>
                    </thead>
                    <tbody>
                      @for (t of tripReport()!.trips; track t.id) {
                        <tr>
                          <td class="fw">{{ t.trip_date | date:'d MMM yyyy' }}</td>
                          <td>{{ t.route_name }}{{ t.route_code ? ' (' + t.route_code + ')' : '' }}</td>
                          <td>
                            <span class="dir-pill" [class.pickup]="t.trip_type==='morning'" [class.dropoff]="t.trip_type==='evening'">
                              {{ t.trip_type === 'morning' ? '🏫 Pickup' : t.trip_type === 'evening' ? '🏠 Drop' : '⭐ Special' }}
                            </span>
                          </td>
                          <td>{{ t.driver_name ?? '—' }}</td>
                          <td>{{ t.vehicle_reg ?? '—' }}</td>
                          <td><span class="status-pill" [class.done]="t.status==='completed'" [class.live]="t.status==='in_progress'">{{ t.status }}</span></td>
                          <td class="tc">{{ t.total_students }}</td>
                          <td class="tc green">{{ t.boarded_count }}</td>
                          <td class="tc red">{{ t.absent_count }}</td>
                          <td>{{ t.duration_mins ? (t.duration_mins | number:'1.0-0') + ' min' : '—' }}</td>
                        </tr>
                      }
                    </tbody>
                  </table>
                </div>
              } @else {
                <div class="tr-empty">Select date range and click Generate</div>
              }
            </div>
          }

          <!-- ── Student Enrollment Report ── -->
          @if (transportTab() === 'students') {
            <div class="tr-section">
              @if (studentTransportLoading()) {
                <div class="tr-loading"><mat-progress-spinner diameter="24" mode="indeterminate"/></div>
              } @else if (studentTransportReport()) {
                <!-- Summary -->
                <div class="tr-summary">
                  <div class="ts-card"><div class="ts-val">{{ studentTransportReport()!.summary.total_enrolled }}</div><div class="ts-lbl">Students Enrolled</div></div>
                  <div class="ts-card"><div class="ts-val">{{ studentTransportReport()!.summary.routes_used }}</div><div class="ts-lbl">Routes</div></div>
                  <div class="ts-card green"><div class="ts-val">₹{{ studentTransportReport()!.summary.monthly_revenue | number:'1.0-0' }}</div><div class="ts-lbl">Monthly Revenue</div></div>
                  <button class="tf-btn outline" style="align-self:center" (click)="exportStudentCSV()">
                    <mat-icon style="font-size:15px;width:15px;height:15px">download</mat-icon>
                    Export CSV
                  </button>
                </div>

                <!-- Student table -->
                <div class="tr-table-wrap">
                  <table class="tr-table">
                    <thead>
                      <tr>
                        <th>Adm No</th><th>Student</th><th>Class</th>
                        <th>Route</th><th>Pickup Stop</th><th>Morning ETA</th>
                        <th>Drop Stop</th><th>Evening ETA</th>
                        <th>Vehicle</th><th>Driver</th>
                        <th class="tc">Fee/Month</th>
                      </tr>
                    </thead>
                    <tbody>
                      @for (s of studentTransportReport()!.students; track s.admission_no) {
                        <tr>
                          <td class="mono">{{ s.admission_no }}</td>
                          <td class="fw">{{ s.first_name }} {{ s.last_name }}</td>
                          <td>{{ s.class_name ?? '—' }}</td>
                          <td>{{ s.route_name }}{{ s.route_code ? ' (' + s.route_code + ')' : '' }}</td>
                          <td>{{ s.pickup_stop ?? '—' }}</td>
                          <td>{{ s.morning_eta ?? '—' }}</td>
                          <td>{{ s.drop_stop ?? '—' }}</td>
                          <td>{{ s.evening_eta ?? '—' }}</td>
                          <td>{{ s.vehicle_reg }}</td>
                          <td>{{ s.driver_name ?? '—' }}</td>
                          <td class="tc green fw">₹{{ (s.monthly_fee || 0) | number:'1.0-0' }}</td>
                        </tr>
                      }
                    </tbody>
                  </table>
                </div>
              }
            </div>
          }

        </div>
      </mat-tab>

    </mat-tab-group>
  `,
  styles: [`
    ::ng-deep .reports-page-tabs .mat-mdc-tab-body-wrapper { padding: 0; }
    /* Transport report styles */
    .tr-tabs { display: flex; gap: 4px; padding: 16px 0 0; border-bottom: 1px solid var(--border); margin-bottom: 16px; }
    .tr-tab { padding: 7px 16px; border: none; background: none; font-size: 13px; font-weight: 500; color: var(--text-3); cursor: pointer; border-radius: 7px 7px 0 0; border-bottom: 2px solid transparent; margin-bottom: -1px; &:hover { background: var(--bg); } &.active { color: var(--blue); border-bottom-color: var(--blue); background: var(--blue-light); } }
    .tr-section { display: flex; flex-direction: column; gap: 14px; }
    .tr-filters { display: flex; gap: 10px; align-items: flex-end; flex-wrap: wrap; background: var(--surface); border: 1px solid var(--border); border-radius: 10px; padding: 14px; }
    .tf-group { display: flex; flex-direction: column; gap: 4px; }
    .tf-label { font-size: 11px; font-weight: 600; color: var(--text-3); text-transform: uppercase; letter-spacing: .3px; }
    .tf-input { height: 34px; padding: 0 10px; background: var(--bg); border: 1px solid var(--border); border-radius: 7px; font-size: 13px; color: var(--text); outline: none; font-family: inherit; min-width: 140px; &:focus { border-color: var(--blue); } }
    .tf-btn { display: flex; align-items: center; gap: 5px; height: 34px; padding: 0 14px; border-radius: 7px; border: none; background: var(--blue); color: #fff; font-size: 13px; font-weight: 500; cursor: pointer; &:hover:not(:disabled) { background: #1D4ED8; } &:disabled { opacity: .6; cursor: not-allowed; } &.outline { background: var(--surface); border: 1px solid var(--border); color: var(--text-2); &:hover { background: var(--bg); } } }
    .tr-summary { display: grid; grid-template-columns: repeat(auto-fill,minmax(140px,1fr)); gap: 10px; }
    .ts-card { background: var(--surface); border: 1px solid var(--border); border-radius: 10px; padding: 12px 16px; text-align: center; &.red { border-color: var(--red); background: var(--red-light); } &.green { border-color: var(--green); background: var(--green-light); } }
    .ts-val { font-size: 22px; font-weight: 700; color: var(--text); }
    .ts-lbl { font-size: 11px; color: var(--text-3); margin-top: 2px; }
    .tr-table-wrap { background: var(--surface); border: 1px solid var(--border); border-radius: 10px; overflow: auto; }
    .tr-table { width: 100%; border-collapse: collapse; font-size: 12.5px; }
    .tr-table thead th { padding: 8px 12px; text-align: left; font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: .4px; color: var(--text-4); background: var(--bg); border-bottom: 1px solid var(--border); white-space: nowrap; }
    .tr-table tbody tr { border-bottom: 1px solid var(--border-light); &:last-child { border-bottom: none; } &:hover { background: var(--bg); } }
    .tr-table td { padding: 8px 12px; color: var(--text-2); white-space: nowrap; }
    .fw   { font-weight: 600; color: var(--text) !important; }
    .tc   { text-align: center; }
    .mono { font-family: monospace; font-size: 11.5px; }
    .green { color: var(--green) !important; }
    .red   { color: var(--red) !important; }
    .dir-pill { font-size: 10.5px; font-weight: 600; padding: 2px 7px; border-radius: 5px; background: var(--bg); color: var(--text-2); &.pickup { background: var(--blue-light); color: var(--blue); } &.dropoff { background: var(--amber-light); color: #92400E; } }
    .status-pill { font-size: 10.5px; font-weight: 600; padding: 2px 7px; border-radius: 10px; background: var(--bg); color: var(--text-3); &.done { background: var(--green-light); color: #065F46; } &.live { background: var(--red-light); color: var(--red); } }
    .tr-loading { display: flex; justify-content: center; padding: 40px; }
    .tr-empty   { text-align: center; padding: 40px; color: var(--text-3); font-size: 13px; }
    .tab-body { padding-top: 16px; }

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
      &.danger { color: var(--red); &:hover { background: var(--red-light); border-color: var(--red); } }
    }

    /* Generate panel */
    .gen-panel {
      background: var(--surface); border: 1px solid var(--border);
      border-radius: 10px; overflow: hidden; margin-bottom: 16px;
    }
    .gp-section {
      padding: 16px 18px; border-bottom: 1px solid var(--border-light);
      &:last-child { border-bottom: none; }
    }
    .gp-label {
      font-size: 11px; font-weight: 600; text-transform: uppercase;
      letter-spacing: .4px; color: var(--text-4); margin-bottom: 10px;
    }
    .filter-row  { display: flex; gap: 10px; align-items: flex-end; flex-wrap: wrap; }
    .field-group { display: flex; flex-direction: column; gap: 4px; }
    .field-label { font-size: 11px; font-weight: 500; color: var(--text-3); }
    .field-input {
      height: 36px; padding: 0 10px;
      background: var(--bg); border: 1px solid var(--border);
      border-radius: 7px; font-size: 13px; color: var(--text);
      outline: none; font-family: inherit;
      &:focus { border-color: var(--blue); background: #fff; }
    }
    select.field-input { cursor: pointer; }
    .w-200 { width: 200px; }
    .w-260 { width: 260px; }
    .w-300 { width: 300px; }

    /* Template selector cards */
    .template-cards {
      display: flex; gap: 10px; flex-wrap: wrap;
    }
    .template-card {
      display: flex; align-items: center; gap: 10px;
      border: 2px solid var(--border); border-radius: 9px;
      padding: 10px 14px; cursor: pointer; transition: all .12s; background: #fff;
      &:hover    { border-color: var(--blue); }
      &.selected { border-color: var(--blue); background: var(--blue-light); }
    }
    .tc-swatch { display: flex; gap: 3px; }
    .tc-primary { width: 14px; height: 28px; border-radius: 4px; }
    .tc-accent  { width: 14px; height: 28px; border-radius: 4px; }
    .tc-name { font-size: 13px; font-weight: 500; color: var(--text); }
    .tc-check { color: var(--blue); font-size: 18px; width: 18px; height: 18px; margin-left: 4px; }
    .no-templates { font-size: 12px; color: var(--text-3); padding: 8px; }

    .gen-actions { padding: 14px 18px; }
    .gen-progress { display: flex; align-items: center; gap: 10px; color: var(--text-3); font-size: 13px; }

    /* How it works */
    .how-it-works {
      background: var(--surface); border: 1px solid var(--border);
      border-radius: 10px; padding: 16px 18px;
    }
    .hiw-title   { font-size: 12px; font-weight: 600; color: var(--text-2); margin-bottom: 12px; }
    .hiw-sections { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 10px; }
    .hiw-item    { display: flex; align-items: flex-start; gap: 10px; }
    .hiw-icon    { font-size: 20px; flex-shrink: 0; }
    .hiw-label   { font-size: 12.5px; font-weight: 500; color: var(--text); }
    .hiw-desc    { font-size: 11px; color: var(--text-3); margin-top: 2px; line-height: 1.4; }

    /* Templates grid */
    .templates-grid {
      display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 14px;
    }
    .template-detail-card {
      background: var(--surface); border: 1px solid var(--border);
      border-radius: 10px; overflow: hidden;
    }
    .tdc-preview {
      height: 80px; position: relative; overflow: hidden; padding: 14px 16px;
    }
    .tdcp-accent { position: absolute; top: 0; right: 0; width: 4px; height: 100%; }
    .tdcp-name   { font-size: 16px; font-weight: 700; }
    .tdcp-sub    { font-size: 11px; margin-top: 3px; opacity: .8; }

    .tdc-body    { padding: 14px; display: flex; flex-direction: column; gap: 10px; }
    .tdc-top     { display: flex; justify-content: space-between; align-items: flex-start; }
    .tdc-name    { font-size: 13px; font-weight: 600; color: var(--text); }
    .tdc-desc    { font-size: 11px; color: var(--text-3); margin-top: 2px; }
    .tdc-badges  { display: flex; gap: 4px; }

    .default-tag {
      background: var(--amber-light); color: #92400E;
      font-size: 10px; font-weight: 600; padding: 2px 7px; border-radius: 10px;
    }

    .tdc-sections { display: flex; gap: 5px; flex-wrap: wrap; }
    .section-chip {
      font-size: 10px; background: var(--bg); color: var(--text-2);
      padding: 2px 7px; border-radius: 4px;
    }

    .tdc-colours { display: flex; align-items: center; gap: 6px; }
    .colour-dot  { width: 16px; height: 16px; border-radius: 50%; border: 1px solid rgba(0,0,0,.1); }
    .font-tag    { font-size: 11px; color: var(--text-3); margin-left: 4px; }

    .tdc-actions { display: flex; gap: 6px; }

    /* Loading / empty */
    .loading-row { display: flex; justify-content: center; padding: 48px; }
    .empty-state {
      display: flex; flex-direction: column; align-items: center; gap: 10px;
      padding: 80px; color: var(--text-3);
      .empty-icon  { font-size: 48px; }
      .empty-title { font-size: 16px; font-weight: 600; color: var(--text-2); }
      .empty-sub   { font-size: 13px; text-align: center; max-width: 360px; }
    }

    /* Class assignment */
    .assignment-list { display: flex; flex-direction: column; gap: 0; }
    .assign-row {
      display: flex; align-items: center; justify-content: space-between; gap: 16px;
      padding: 12px 16px; background: var(--surface); border: 1px solid var(--border);
      border-radius: 0; margin-bottom: -1px;
      &:first-child { border-radius: 10px 10px 0 0; }
      &:last-child  { border-radius: 0 0 10px 10px; margin-bottom: 0; }
      &:only-child  { border-radius: 10px; }
      &:hover { background: #FAFAFA; z-index: 1; position: relative; }
    }
    .ar-class { display: flex; align-items: center; gap: 10px; }
    .ar-av {
      width: 34px; height: 34px; border-radius: 9px; color: #fff;
      font-size: 14px; font-weight: 700; display: flex; align-items: center; justify-content: center;
    }
    .ar-name  { font-size: 13px; font-weight: 500; color: var(--text); }
    .ar-count { font-size: 11px; color: var(--text-3); }
    .ar-template { display: flex; align-items: center; }
  `],
})
export class ReportsComponent implements OnInit {
  private api    = inject(ApiService);

  // Transport report state
  transportTab          = signal<'trips'|'students'>('trips');
  transportRoutes       = signal<any[]>([]);
  tripReport            = signal<any | null>(null);
  studentTransportReport = signal<any | null>(null);
  tripReportLoading     = signal(false);
  studentTransportLoading = signal(false);
  tripFromDate  = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0,10);
  tripToDate    = new Date().toISOString().slice(0,10);
  tripRouteId   = '';
  tripType      = '';
  private dialog = inject(MatDialog);
  private snack  = inject(MatSnackBar);

  classes          = signal<SchoolClass[]>([]);
  templates        = signal<ReportTemplate[]>([]);
  templatesLoading = signal(false);
  genStudents      = signal<any[]>([]);
  classTemplates   = signal<Record<string, string>>({});

  // Generate state
  genClass      = signal('');
  genStudentId  = signal('');
  genTemplateId = signal('');
  genTerm       = 'Term 1 2025-2026';
  genFrom       = new Date(new Date().getFullYear(), 5, 1).toISOString().slice(0, 10);
  genTo         = new Date().toISOString().slice(0, 10);
  generating    = signal(false);

  sectionInfo = [
    { key: 'cover',           emoji: '📄', label: 'Cover Page',        desc: 'School name, student photo placeholder, term' },
    { key: 'attendance',      emoji: '✅', label: 'Attendance',        desc: 'Present, absent, late count for the period' },
    { key: 'mood',            emoji: '😊', label: 'Mood & Wellbeing',  desc: 'Mood trend from daily journals' },
    { key: 'domain_progress', emoji: '🎯', label: 'Domain Progress',   desc: 'Milestone mastery across all 5 domains' },
    { key: 'teacher_note',    emoji: '📝', label: "Teacher's Note",    desc: 'Consolidated teacher observations' },
    { key: 'homework_summary',emoji: '📚', label: 'Homework',          desc: 'Homework completion summary' },
  ];

  canGenerate = computed(() => !!this.genTemplateId() && (!!this.genClass() || !!this.genStudentId()));

  loadTripReport() {
    this.tripReportLoading.set(true);
    this.tripReport.set(null);
    const params: Record<string,string> = {
      from_date: this.tripFromDate,
      to_date:   this.tripToDate,
    };
    if (this.tripRouteId) params['route_id'] = this.tripRouteId;
    if (this.tripType)    params['trip_type'] = this.tripType;
    this.api.get<any>('/transport/reports/trips', params).subscribe({
      next: (res: any) => { this.tripReport.set(res.data); this.tripReportLoading.set(false); },
      error: () => this.tripReportLoading.set(false),
    });
  }

  loadStudentTransportReport() {
    if (this.studentTransportReport()) return;
    this.studentTransportLoading.set(true);
    this.api.get<any>('/transport/reports/students').subscribe({
      next: (res: any) => { this.studentTransportReport.set(res.data); this.studentTransportLoading.set(false); },
      error: () => this.studentTransportLoading.set(false),
    });
  }

  exportTripCSV() {
    const trips = this.tripReport()?.trips ?? [];
    const headers = ['Date','Route','Direction','Driver','Vehicle','Status','Students','Boarded','Absent','Duration(min)'];
    const rows = trips.map((t: any) => [
      t.trip_date, t.route_name, t.trip_type === 'morning' ? 'Pickup' : 'Drop',
      t.driver_name ?? '', t.vehicle_reg ?? '', t.status,
      t.total_students, t.boarded_count, t.absent_count,
      t.duration_mins ? Math.round(t.duration_mins) : '',
    ]);
    this.downloadCSV('trip_report.csv', headers, rows);
  }

  exportStudentCSV() {
    const students = this.studentTransportReport()?.students ?? [];
    const headers = ['Adm No','First Name','Last Name','Class','Route','Pickup Stop','Morning ETA','Drop Stop','Evening ETA','Vehicle','Driver','Monthly Fee'];
    const rows = students.map((s: any) => [
      s.admission_no, s.first_name, s.last_name, s.class_name ?? '',
      s.route_name, s.pickup_stop ?? '', s.morning_eta ?? '',
      s.drop_stop ?? '', s.evening_eta ?? '',
      s.vehicle_reg, s.driver_name ?? '', s.monthly_fee ?? 0,
    ]);
    this.downloadCSV('student_transport_report.csv', headers, rows);
  }

  private downloadCSV(filename: string, headers: string[], rows: any[][]) {
    const lines = [headers, ...rows].map(r =>
      r.map((v: any) => '"' + String(v ?? '').replace(/"/g, '""') + '"').join(',')
    );
    const csv = lines.join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
  }

  ngOnInit() {
    this.api.get<any>('/transport/routes').subscribe({
      next: (res: any) => this.transportRoutes.set(res.data ?? []),
      error: () => {},
    });
    this.api.get<any>('/students/classes').subscribe({
      next: (res: any) => this.classes.set(res.data ?? []),
    });
    this.loadTemplates();
  }

  loadTemplates() {
    this.templatesLoading.set(true);
    this.api.get<any>('/reports/templates').subscribe({
      next: (res: any) => {
        this.templates.set(res.data ?? []);
        this.templatesLoading.set(false);
        // Auto-select default
        const def = res.data?.find((t: ReportTemplate) => t.is_default);
        if (def && !this.genTemplateId()) this.genTemplateId.set(def.id);
      },
      error: () => this.templatesLoading.set(false),
    });
  }

  onGenClassChange(classId: string) {
    this.genClass.set(classId);
    this.genStudentId.set('');
    if (classId) {
      this.api.get<any>('/students', { limit: '500', page: '1', is_active: 'true', class_id: classId }).subscribe({
        next: (res: any) => this.genStudents.set(res.data ?? []),
      });
    } else {
      this.genStudents.set([]);
    }
  }

  generate() {
    if (!this.canGenerate()) return;
    this.generating.set(true);

    const studentId = this.genStudentId();
    const classId   = this.genClass();

    const params = new URLSearchParams({
      term:        this.genTerm,
      from:        this.genFrom,
      to:          this.genTo,
      template_id: this.genTemplateId(),
    });

    // If single student — download directly
    if (studentId) {
      const url = '/api/v1/reports/progress-card/' + studentId + '?' + params.toString();
      this.downloadPdf(url, 'progress-card.pdf');
    } else if (classId) {
      // Bulk — generate for each student in the class
      this.api.get<any>('/students', { limit: '500', page: '1', is_active: 'true', class_id: classId }).subscribe({
        next: (res: any) => {
          const students = res.data ?? [];
          if (!students.length) {
            this.snack.open('No students in this class', 'OK', { duration: 3000 });
            this.generating.set(false);
            return;
          }
          this.generateBulk(students, params);
        },
      });
    }
  }

  async generateBulk(students: any[], params: URLSearchParams) {
    let count = 0;
    for (const s of students) {
      const url = '/api/v1/reports/progress-card/' + s.id + '?' + params.toString();
      await this.downloadPdfAsync(url, s.first_name + '-' + s.last_name + '-progress.pdf');
      count++;
    }
    this.generating.set(false);
    this.snack.open(count + ' report(s) downloaded', 'OK', { duration: 4000 });
  }

  downloadPdf(url: string, filename: string) {
    const token = localStorage.getItem('access_token');
    fetch(url, { headers: { Authorization: 'Bearer ' + token } })
      .then(r => r.blob())
      .then(blob => {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = filename;
        a.click();
        URL.revokeObjectURL(a.href);
        this.generating.set(false);
        this.snack.open('Report downloaded', 'OK', { duration: 3000 });
      })
      .catch(() => { this.generating.set(false); this.snack.open('Failed to generate report', 'OK', { duration: 3000 }); });
  }

  downloadPdfAsync(url: string, filename: string): Promise<void> {
    const token = localStorage.getItem('access_token');
    return fetch(url, { headers: { Authorization: 'Bearer ' + token } })
      .then(r => r.blob())
      .then(blob => {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = filename;
        a.click();
        URL.revokeObjectURL(a.href);
      });
  }

  openTemplateDialog(template?: ReportTemplate) {
    const ref = this.dialog.open(TemplateDialogComponent, {
      width: '640px', maxHeight: '90vh', disableClose: true,
      data: template ?? null,
    });
    ref.afterClosed().subscribe((result: any) => {
      if (result) {
        this.snack.open(template ? 'Template updated' : 'Template created', 'OK', { duration: 3000 });
        this.loadTemplates();
      }
    });
  }

  setDefault(t: ReportTemplate) {
    this.api.put<any>('/reports/templates/' + t.id, { is_default: true }).subscribe({
      next: () => { this.snack.open(t.name + ' set as default', 'OK', { duration: 3000 }); this.loadTemplates(); },
      error: (err: any) => this.snack.open(err.error?.error?.message ?? 'Error', 'OK', { duration: 3000 }),
    });
  }

  deleteTemplate(t: ReportTemplate) {
    if (!confirm('Delete "' + t.name + '"?')) return;
    this.api.delete<any>('/reports/templates/' + t.id).subscribe({
      next: () => { this.snack.open('Template deleted', 'OK', { duration: 3000 }); this.loadTemplates(); },
      error: (err: any) => this.snack.open(err.error?.error?.message ?? 'Error', 'OK', { duration: 3000 }),
    });
  }

  assignTemplate(classId: string, templateId: string) {
    if (!templateId) {
      this.api.delete<any>('/reports/templates/assign/class/' + classId).subscribe({
        next: () => {
          this.classTemplates.update(m => { const n = {...m}; delete n[classId]; return n; });
          this.snack.open('Using school default', 'OK', { duration: 2000 });
        },
      });
    } else {
      this.api.post<any>('/reports/templates/assign/class/' + classId, { template_id: templateId }).subscribe({
        next: () => {
          this.classTemplates.update(m => ({ ...m, [classId]: templateId }));
          this.snack.open('Template assigned', 'OK', { duration: 2000 });
        },
      });
    }
  }

  getClassTemplate(classId: string): string { return this.classTemplates()[classId] ?? ''; }

  getEnabledSections(t: ReportTemplate) {
    return (t.sections ?? []).filter(s => s.enabled).sort((a, b) => a.order - b.order);
  }

  getSectionLabel(key: string): string {
    const labels: Record<string, string> = {
      cover: 'Cover', attendance: 'Attendance', mood: 'Mood',
      domain_progress: 'Progress', teacher_note: "Teacher's Note",
      homework_summary: 'Homework', photo_collage: 'Photos',
    };
    return labels[key] ?? key;
  }

  getSectionEmoji(key: string): string {
    const emojis: Record<string, string> = {
      cover: '📄', attendance: '✅', mood: '😊',
      domain_progress: '🎯', teacher_note: '📝',
      homework_summary: '📚', photo_collage: '📷',
    };
    return emojis[key] ?? '•';
  }

  getClassColor(name: string): string {
    const colors = ['#2563EB','#7C3AED','#DB2777','#D97706','#059669','#0891B2'];
    return colors[name.charCodeAt(0) % colors.length];
  }
}
