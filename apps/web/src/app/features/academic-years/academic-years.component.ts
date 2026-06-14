import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatTabsModule } from '@angular/material/tabs';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';
import { DatePipe, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/services/api.service';
import { AuthService } from '../../core/services/auth.service';

interface AcademicYear {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  is_current: boolean;
  working_days: number[];
}

interface Term {
  id: string;
  academic_year_id: string;
  academic_year_name?: string;
  name: string;
  start_date: string;
  end_date: string;
  sort_order: number;
}

interface ClassItem {
  id: string;
  name: string;
  section: string | null;
  enrolled_count: number;
}

interface ClassMappingEntry {
  from_class_id: string;
  from_class_name: string;
  to_class_id: string | null;
  student_count?: number;
}

interface StudentPreview {
  id: string;
  admission_no: string;
  first_name: string;
  last_name: string;
  outstanding_fees: number;
  warnings: string[];
}

interface ClassPreview {
  from_class_id: string;
  from_class_name: string;
  to_class_id: string | null;
  to_class_name: string | null;
  student_count: number;
  warnings: string[];
  students: StudentPreview[];
}

interface PromotionPreview {
  from_year: string;
  to_year: string;
  total_students: number;
  classes: ClassPreview[];
  global_warnings: string[];
}

interface PromotionBatch {
  id: string;
  from_year_name: string;
  to_year_name: string;
  status: string;
  total_students: number;
  promoted_count: number;
  graduated_count: number;
  skipped_count: number;
  created_by_name: string | null;
  created_at: string;
  completed_at: string | null;
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

@Component({
  selector: 'app-academic-years',
  standalone: true,
  imports: [
    ReactiveFormsModule, FormsModule,
    MatTabsModule, MatIconModule, MatProgressSpinnerModule,
    DatePipe, DecimalPipe,
  ],
  template: `
<div class="ay-page">

  <mat-tab-group class="ay-tabs">

    <!-- ─── TAB 1: Academic Years ────────────────────────────────────────── -->
    <mat-tab label="Academic Years">
      <div class="tab-body">

        <div class="page-header">
          <div>
            <h1>Academic Years</h1>
            <p class="subtitle">Manage school years and terms</p>
          </div>
          @if (isAdmin()) {
            <button class="btn-primary" (click)="showYearForm.set(!showYearForm())">
              <mat-icon>add</mat-icon> New Year
            </button>
          }
        </div>

        <!-- Create Year Form -->
        @if (showYearForm()) {
          <div class="form-card">
            <div class="form-card-title">New Academic Year</div>
            <form [formGroup]="yearForm" (ngSubmit)="saveYear()" class="form-grid">
              <div class="form-field">
                <label>Year Name</label>
                <input formControlName="name" placeholder="e.g. 2026-2027" />
              </div>
              <div class="form-field">
                <label>Start Date</label>
                <input type="date" formControlName="start_date" min="2000-01-01" max="2100-12-31" />
              </div>
              <div class="form-field">
                <label>End Date</label>
                <input type="date" formControlName="end_date" min="2000-01-01" max="2100-12-31" />
              </div>
              <div class="form-field form-field-full">
                <label>Working Days</label>
                <div class="day-pills">
                  @for (d of dayOptions; track d.value) {
                    <button type="button"
                      class="day-pill"
                      [class.active]="workingDays().includes(d.value)"
                      (click)="toggleDay(d.value)">
                      {{ d.label }}
                    </button>
                  }
                </div>
              </div>
              <div class="form-field form-field-full">
                <label class="checkbox-label">
                  <input type="checkbox" formControlName="is_current" />
                  Set as current academic year
                </label>
              </div>
              <div class="form-actions">
                <button type="button" class="btn-ghost" (click)="showYearForm.set(false)">Cancel</button>
                <button type="submit" class="btn-primary" [disabled]="yearForm.invalid || saving()">
                  @if (saving()) { <mat-spinner diameter="14" /> } Create Year
                </button>
              </div>
            </form>
          </div>
        }

        <!-- Years List -->
        @if (loadingYears()) {
          <div class="loading"><mat-spinner diameter="28" /></div>
        } @else {
          <div class="years-list">
            @for (year of years(); track year.id) {
              <div class="year-card" [class.current]="year.is_current">
                <div class="year-card-head">
                  <div class="year-info">
                    <span class="year-name">{{ year.name }}</span>
                    @if (year.is_current) {
                      <span class="badge-current">Current</span>
                    }
                  </div>
                  <div class="year-meta">
                    {{ year.start_date | date:'d MMM yyyy' }} – {{ year.end_date | date:'d MMM yyyy' }}
                    &nbsp;·&nbsp;
                    {{ workingDayLabel(year.working_days) }}
                  </div>
                  <div class="year-actions">
                    @if (!year.is_current && isAdmin()) {
                      <button class="btn-sm" (click)="setCurrentYear(year)">
                        <mat-icon>check_circle</mat-icon> Set Current
                      </button>
                    }
                    @if (isAdmin()) {
                      <button class="btn-sm btn-ghost-sm" (click)="startEditYear(year)">
                        <mat-icon>edit</mat-icon>
                      </button>
                    }
                  </div>
                </div>

                <!-- Edit Year Inline -->
                @if (editingYear()?.id === year.id) {
                  <div class="inline-edit">
                    <form [formGroup]="editYearForm" (ngSubmit)="saveEditYear()" class="form-grid-sm">
                      <div class="form-field">
                        <label>Name</label>
                        <input formControlName="name" />
                      </div>
                      <div class="form-field">
                        <label>Start Date</label>
                        <input type="date" formControlName="start_date" min="2000-01-01" max="2100-12-31" />
                      </div>
                      <div class="form-field">
                        <label>End Date</label>
                        <input type="date" formControlName="end_date" min="2000-01-01" max="2100-12-31" />
                      </div>
                      <div class="form-actions">
                        <button type="button" class="btn-ghost" (click)="editingYear.set(null)">Cancel</button>
                        <button type="submit" class="btn-primary" [disabled]="saving()">Save</button>
                      </div>
                    </form>
                  </div>
                }

                <!-- Terms -->
                <div class="terms-section">
                  <div class="terms-header">
                    <span class="terms-label">Terms</span>
                    @if (isAdmin()) {
                      <button class="add-term-btn" (click)="toggleAddTerm(year.id)">
                        <mat-icon>add</mat-icon> Add Term
                      </button>
                    }
                  </div>

                  @if (addingTermForYear() === year.id) {
                    <div class="add-term-form">
                      <form [formGroup]="termForm" (ngSubmit)="saveTerm(year.id)" class="form-grid-sm">
                        <div class="form-field">
                          <label>Term Name</label>
                          <input formControlName="name" placeholder="e.g. Term 1" />
                        </div>
                        <div class="form-field">
                          <label>Start Date</label>
                          <input type="date" formControlName="start_date" min="2000-01-01" max="2100-12-31" />
                        </div>
                        <div class="form-field">
                          <label>End Date</label>
                          <input type="date" formControlName="end_date" min="2000-01-01" max="2100-12-31" />
                        </div>
                        <div class="form-actions">
                          <button type="button" class="btn-ghost" (click)="addingTermForYear.set(null)">Cancel</button>
                          <button type="submit" class="btn-primary" [disabled]="saving()">Add Term</button>
                        </div>
                      </form>
                    </div>
                  }

                  <div class="terms-list">
                    @for (term of termsFor(year.id); track term.id) {
                      <div class="term-row">
                        @if (editingTerm()?.id === term.id) {
                          <form [formGroup]="editTermForm" (ngSubmit)="saveEditTerm()" class="term-edit-form">
                            <input formControlName="name" class="term-name-input" />
                            <input type="date" formControlName="start_date" class="term-date-input" min="2000-01-01" max="2100-12-31" />
                            <input type="date" formControlName="end_date" class="term-date-input" min="2000-01-01" max="2100-12-31" />
                            <div class="term-edit-actions">
                              <button type="submit" class="btn-sm">Save</button>
                              <button type="button" class="btn-ghost-sm" (click)="editingTerm.set(null)">✕</button>
                            </div>
                          </form>
                        } @else {
                          <span class="term-name">{{ term.name }}</span>
                          <span class="term-dates">{{ term.start_date | date:'d MMM' }} – {{ term.end_date | date:'d MMM yyyy' }}</span>
                          @if (isAdmin()) {
                            <div class="term-actions">
                              <button class="icon-btn" (click)="startEditTerm(term)"><mat-icon>edit</mat-icon></button>
                              <button class="icon-btn danger" (click)="deleteTerm(term)"><mat-icon>delete</mat-icon></button>
                            </div>
                          }
                        }
                      </div>
                    }
                    @if (termsFor(year.id).length === 0) {
                      <div class="no-terms">No terms defined</div>
                    }
                  </div>
                </div>

              </div>
            }
            @if (years().length === 0) {
              <div class="empty-state">
                <mat-icon>event_note</mat-icon>
                <p>No academic years yet. Create your first one.</p>
              </div>
            }
          </div>
        }

      </div>
    </mat-tab>

    <!-- ─── TAB 2: Bulk Promotion ─────────────────────────────────────────── -->
    <mat-tab label="Bulk Promotion">
      <div class="tab-body">

        <div class="page-header">
          <div>
            <h1>Bulk Promotion</h1>
            <p class="subtitle">Promote students to the next academic year</p>
          </div>
        </div>

        <!-- Step indicator -->
        <div class="steps">
          @for (s of promotionSteps; track s.n) {
            <div class="step" [class.active]="promotionStep() === s.n" [class.done]="promotionStep() > s.n">
              <div class="step-circle">{{ promotionStep() > s.n ? '✓' : s.n }}</div>
              <span>{{ s.label }}</span>
            </div>
            @if (!$last) { <div class="step-line"></div> }
          }
        </div>

        <!-- Step 1: Select years -->
        @if (promotionStep() === 1) {
          <div class="wizard-card">
            <h3>Select Academic Years</h3>
            <div class="form-grid">
              <div class="form-field">
                <label>From Year (source)</label>
                <select [(ngModel)]="fromYearId">
                  <option value="">-- Select --</option>
                  @for (y of years(); track y.id) {
                    <option [value]="y.id">{{ y.name }} @if (y.is_current) { (Current) }</option>
                  }
                </select>
              </div>
              <div class="form-field">
                <label>To Year (target)</label>
                <select [(ngModel)]="toYearId">
                  <option value="">-- Select --</option>
                  @for (y of years(); track y.id) {
                    <option [value]="y.id" [disabled]="y.id === fromYearId">{{ y.name }}</option>
                  }
                </select>
              </div>
            </div>
            <div class="wizard-actions">
              <button class="btn-primary" [disabled]="!fromYearId || !toYearId" (click)="goToStep2()">
                Next: Map Classes <mat-icon>arrow_forward</mat-icon>
              </button>
            </div>
          </div>
        }

        <!-- Step 2: Class mapping -->
        @if (promotionStep() === 2) {
          <div class="wizard-card">
            <h3>Map Each Class to the Next Class</h3>
            <p class="wizard-hint">Choose where each class's students will be promoted to. Select "Graduate" to deactivate students.</p>

            @if (loadingClasses()) {
              <div class="loading"><mat-spinner diameter="24" /></div>
            } @else {
              <div class="mapping-table">
                <div class="mapping-header">
                  <span>Current Class</span>
                  <mat-icon style="color:var(--text-4)">arrow_forward</mat-icon>
                  <span>Promote To</span>
                </div>
                @for (m of classMapping; track m.from_class_id) {
                  <div class="mapping-row">
                    <div class="from-class">
                      <mat-icon style="font-size:16px;color:var(--blue)">class</mat-icon>
                      {{ m.from_class_name }}
                    </div>
                    <mat-icon style="color:var(--text-4)">arrow_forward</mat-icon>
                    <select [(ngModel)]="m.to_class_id" class="to-class-select">
                      <option [ngValue]="null">🎓 Graduate (deactivate)</option>
                      @for (c of classes(); track c.id) {
                        <option [value]="c.id" [disabled]="c.id === m.from_class_id">
                          {{ c.name }}{{ c.section ? ' (' + c.section + ')' : '' }}
                        </option>
                      }
                    </select>
                  </div>
                }
              </div>
            }

            <div class="wizard-actions">
              <button class="btn-ghost" (click)="promotionStep.set(1)">Back</button>
              <button class="btn-primary" [disabled]="saving()" (click)="runPrepare()">
                @if (saving()) { <mat-spinner diameter="14" /> }
                Preview Promotion <mat-icon>arrow_forward</mat-icon>
              </button>
            </div>
          </div>
        }

        <!-- Step 3: Preview -->
        @if (promotionStep() === 3) {
          <div class="wizard-card">
            <h3>Preview</h3>
            @if (promotionPreview()) {
              <div class="preview-summary">
                <div class="preview-stat">
                  <div class="ps-value">{{ promotionPreview()!.total_students }}</div>
                  <div class="ps-label">Total Students</div>
                </div>
                <div class="preview-stat">
                  <div class="ps-value">{{ promotionPreview()!.from_year }}</div>
                  <div class="ps-label">From Year</div>
                </div>
                <div class="preview-stat">
                  <div class="ps-value">{{ promotionPreview()!.to_year }}</div>
                  <div class="ps-label">To Year</div>
                </div>
              </div>

              @if (promotionPreview()!.global_warnings.length > 0) {
                <div class="warnings-box">
                  @for (w of promotionPreview()!.global_warnings; track w) {
                    <div class="warning-item"><mat-icon>warning</mat-icon> {{ w }}</div>
                  }
                </div>
              }

              <div class="preview-classes">
                @for (cls of promotionPreview()!.classes; track cls.from_class_id) {
                  <div class="preview-class">
                    <div class="preview-class-head">
                      <span class="pcl-name">{{ cls.from_class_name }}</span>
                      <mat-icon style="color:var(--text-4);font-size:16px">arrow_forward</mat-icon>
                      <span class="pcl-to">{{ cls.to_class_name ?? '🎓 Graduate' }}</span>
                      <span class="pcl-count">{{ cls.student_count }} students</span>
                      @for (w of cls.warnings; track w) {
                        <span class="pcl-warn"><mat-icon>warning</mat-icon>{{ w }}</span>
                      }
                    </div>
                    @if (cls.students.length > 0) {
                      <div class="preview-students">
                        @for (s of cls.students; track s.id) {
                          <div class="ps-row" [class.has-warning]="s.warnings.length > 0">
                            <span>{{ s.first_name }} {{ s.last_name }}</span>
                            <span class="ps-admission">{{ s.admission_no }}</span>
                            @if (s.outstanding_fees > 0) {
                              <span class="ps-fee-warn">₹{{ s.outstanding_fees | number }}</span>
                            }
                          </div>
                        }
                      </div>
                    }
                  </div>
                }
              </div>
            }

            <div class="wizard-actions">
              <button class="btn-ghost" (click)="promotionStep.set(2)">Back</button>
              <button class="btn-danger" [disabled]="saving()" (click)="executePromotion()">
                @if (saving()) { <mat-spinner diameter="14" /> }
                <mat-icon>bolt</mat-icon> Execute Promotion
              </button>
            </div>
          </div>
        }

        <!-- Step 4: Results -->
        @if (promotionStep() === 4 && promotionResult()) {
          <div class="wizard-card result-card">
            <div class="result-icon success">
              <mat-icon>check_circle</mat-icon>
            </div>
            <h3>Promotion Complete</h3>
            <div class="result-stats">
              <div class="result-stat">
                <div class="rs-value blue">{{ promotionResult()!.promoted_count }}</div>
                <div class="rs-label">Promoted</div>
              </div>
              <div class="result-stat">
                <div class="rs-value green">{{ promotionResult()!.graduated_count }}</div>
                <div class="rs-label">Graduated</div>
              </div>
              @if (promotionResult()!.skipped_count > 0) {
                <div class="result-stat">
                  <div class="rs-value red">{{ promotionResult()!.skipped_count }}</div>
                  <div class="rs-label">Skipped</div>
                </div>
              }
            </div>
            <p class="result-note">
              {{ promotionResult()!.to_year_name }} is now the active academic year.
            </p>
            <button class="btn-primary" (click)="resetPromotion()">
              Start New Promotion
            </button>
          </div>
        }

      </div>
    </mat-tab>

    <!-- ─── TAB 3: Promotion History ──────────────────────────────────────── -->
    <mat-tab label="Promotion History">
      <div class="tab-body">
        <div class="page-header">
          <div>
            <h1>Promotion History</h1>
            <p class="subtitle">Past year-end promotion batches</p>
          </div>
        </div>

        @if (loadingBatches()) {
          <div class="loading"><mat-spinner diameter="28" /></div>
        } @else if (batches().length === 0) {
          <div class="empty-state">
            <mat-icon>history</mat-icon>
            <p>No promotions have been run yet.</p>
          </div>
        } @else {
          <div class="batches-table">
            <div class="bt-header">
              <span>From Year</span><span>To Year</span><span>Status</span>
              <span>Promoted</span><span>Graduated</span><span>Run By</span><span>Date</span>
            </div>
            @for (b of batches(); track b.id) {
              <div class="bt-row">
                <span>{{ b.from_year_name }}</span>
                <span>{{ b.to_year_name }}</span>
                <span><span class="status-pill" [class]="b.status">{{ b.status }}</span></span>
                <span>{{ b.promoted_count }}</span>
                <span>{{ b.graduated_count }}</span>
                <span>{{ b.created_by_name ?? '—' }}</span>
                <span>{{ b.created_at | date:'d MMM yyyy' }}</span>
              </div>
            }
          </div>
        }
      </div>
    </mat-tab>

  </mat-tab-group>

</div>
  `,
  styles: [`
    .ay-page { height: 100%; display: flex; flex-direction: column; }
    .ay-tabs { flex: 1; }
    .tab-body { padding: 24px; max-width: 960px; }

    .page-header { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 20px; }
    .page-header h1 { font-size: 20px; font-weight: 600; color: var(--text); margin: 0 0 2px; }
    .subtitle { font-size: 13px; color: var(--text-3); margin: 0; }
    .loading { display: flex; justify-content: center; padding: 40px; }

    /* ── Buttons ── */
    .btn-primary {
      display: inline-flex; align-items: center; gap: 6px;
      background: var(--blue); color: #fff; border: none;
      padding: 8px 16px; border-radius: 8px; font-size: 13px; font-weight: 500;
      cursor: pointer;
      &:disabled { opacity: .5; cursor: not-allowed; }
      mat-icon { font-size: 16px; width: 16px; height: 16px; }
    }
    .btn-ghost {
      display: inline-flex; align-items: center; gap: 6px;
      background: transparent; color: var(--text-3); border: 1px solid var(--border);
      padding: 8px 16px; border-radius: 8px; font-size: 13px; font-weight: 500; cursor: pointer;
    }
    .btn-sm {
      display: inline-flex; align-items: center; gap: 4px;
      background: var(--surface-2); color: var(--text-2); border: 1px solid var(--border);
      padding: 4px 10px; border-radius: 6px; font-size: 12px; cursor: pointer;
      mat-icon { font-size: 14px; width: 14px; height: 14px; }
    }
    .btn-ghost-sm {
      background: transparent; color: var(--text-4); border: none;
      padding: 4px; border-radius: 6px; cursor: pointer; display: inline-flex;
      mat-icon { font-size: 16px; }
    }
    .btn-danger {
      display: inline-flex; align-items: center; gap: 6px;
      background: #EF4444; color: #fff; border: none;
      padding: 8px 16px; border-radius: 8px; font-size: 13px; font-weight: 500;
      cursor: pointer;
      &:disabled { opacity: .5; cursor: not-allowed; }
      mat-icon { font-size: 16px; width: 16px; height: 16px; }
    }
    .icon-btn {
      background: transparent; border: none; cursor: pointer; padding: 2px;
      color: var(--text-4); display: inline-flex; border-radius: 4px;
      mat-icon { font-size: 15px; width: 15px; height: 15px; }
      &:hover { background: var(--surface-2); }
      &.danger mat-icon { color: #EF4444; }
    }

    /* ── Form ── */
    .form-card {
      background: var(--surface); border: 1px solid var(--border);
      border-radius: 12px; padding: 20px; margin-bottom: 20px;
    }
    .form-card-title { font-size: 15px; font-weight: 600; color: var(--text); margin-bottom: 16px; }
    .form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    .form-grid-sm { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; align-items: end; }
    .form-field { display: flex; flex-direction: column; gap: 4px; }
    .form-field-full { grid-column: 1 / -1; }
    .form-field label { font-size: 12px; font-weight: 500; color: var(--text-3); }
    .form-field input, .form-field select {
      border: 1px solid var(--border); border-radius: 7px; padding: 8px 10px;
      font-size: 13px; color: var(--text); background: var(--surface);
      &:focus { outline: none; border-color: var(--blue); }
    }
    .form-actions { grid-column: 1 / -1; display: flex; gap: 8px; justify-content: flex-end; margin-top: 4px; }
    .checkbox-label { display: flex; align-items: center; gap: 8px; font-size: 13px; color: var(--text-2); cursor: pointer; }

    .day-pills { display: flex; gap: 6px; flex-wrap: wrap; }
    .day-pill {
      padding: 4px 10px; border-radius: 20px; border: 1px solid var(--border);
      font-size: 12px; font-weight: 500; background: var(--surface); color: var(--text-3);
      cursor: pointer;
      &.active { background: var(--blue); color: #fff; border-color: var(--blue); }
    }

    /* ── Year cards ── */
    .years-list { display: flex; flex-direction: column; gap: 12px; }
    .year-card {
      background: var(--surface); border: 1px solid var(--border);
      border-radius: 12px; overflow: hidden;
      &.current { border-color: var(--blue); }
    }
    .year-card-head {
      display: flex; align-items: center; gap: 12px; padding: 14px 16px;
      border-bottom: 1px solid var(--border-light); flex-wrap: wrap;
    }
    .year-info { display: flex; align-items: center; gap: 8px; flex: 1; }
    .year-name { font-size: 15px; font-weight: 600; color: var(--text); }
    .badge-current {
      background: #DBEAFE; color: #1E40AF; font-size: 11px; font-weight: 600;
      padding: 2px 8px; border-radius: 20px;
    }
    .year-meta { font-size: 12px; color: var(--text-4); }
    .year-actions { display: flex; gap: 6px; margin-left: auto; }

    .inline-edit { padding: 12px 16px; background: var(--surface-2); border-bottom: 1px solid var(--border-light); }

    /* ── Terms ── */
    .terms-section { padding: 12px 16px; }
    .terms-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; }
    .terms-label { font-size: 12px; font-weight: 600; color: var(--text-4); text-transform: uppercase; letter-spacing: .3px; }
    .add-term-btn {
      display: inline-flex; align-items: center; gap: 2px;
      background: transparent; border: none; color: var(--blue);
      font-size: 12px; cursor: pointer; padding: 2px 4px;
      mat-icon { font-size: 14px; width: 14px; height: 14px; }
    }
    .add-term-form { background: var(--surface-2); border-radius: 8px; padding: 12px; margin-bottom: 8px; }
    .terms-list { display: flex; flex-direction: column; gap: 4px; }
    .term-row {
      display: flex; align-items: center; gap: 10px; padding: 6px 8px;
      border-radius: 6px;
      &:hover { background: var(--surface-2); }
    }
    .term-name { font-size: 13px; font-weight: 500; color: var(--text-2); min-width: 80px; }
    .term-dates { font-size: 12px; color: var(--text-4); flex: 1; }
    .term-actions { display: flex; gap: 2px; margin-left: auto; }
    .term-edit-form { display: flex; align-items: center; gap: 8px; width: 100%; }
    .term-name-input { border: 1px solid var(--border); border-radius: 6px; padding: 4px 8px; font-size: 13px; width: 120px; }
    .term-date-input { border: 1px solid var(--border); border-radius: 6px; padding: 4px 8px; font-size: 12px; }
    .term-edit-actions { display: flex; gap: 4px; }
    .no-terms { font-size: 12px; color: var(--text-4); padding: 4px 0; }

    /* ── Wizard ── */
    .steps {
      display: flex; align-items: center; gap: 0; margin-bottom: 28px;
      background: var(--surface); border: 1px solid var(--border);
      border-radius: 12px; padding: 16px 20px;
    }
    .step { display: flex; align-items: center; gap: 8px; }
    .step-circle {
      width: 26px; height: 26px; border-radius: 50%;
      border: 2px solid var(--border); background: var(--surface);
      display: flex; align-items: center; justify-content: center;
      font-size: 12px; font-weight: 600; color: var(--text-4); flex-shrink: 0;
    }
    .step.active .step-circle { border-color: var(--blue); background: var(--blue); color: #fff; }
    .step.done .step-circle { border-color: #10B981; background: #10B981; color: #fff; }
    .step span { font-size: 12.5px; font-weight: 500; color: var(--text-3); white-space: nowrap; }
    .step.active span { color: var(--text); }
    .step-line { flex: 1; height: 1px; background: var(--border); margin: 0 8px; }

    .wizard-card {
      background: var(--surface); border: 1px solid var(--border);
      border-radius: 12px; padding: 24px;
    }
    .wizard-card h3 { font-size: 16px; font-weight: 600; color: var(--text); margin: 0 0 16px; }
    .wizard-hint { font-size: 13px; color: var(--text-3); margin: -8px 0 16px; }
    .wizard-actions { display: flex; gap: 8px; justify-content: flex-end; margin-top: 20px; padding-top: 16px; border-top: 1px solid var(--border-light); }

    /* ── Class mapping ── */
    .mapping-table { display: flex; flex-direction: column; gap: 8px; }
    .mapping-header {
      display: flex; align-items: center; gap: 16px; padding: 6px 8px;
      font-size: 11px; font-weight: 600; color: var(--text-4); text-transform: uppercase;
    }
    .mapping-header span { flex: 1; }
    .mapping-row {
      display: flex; align-items: center; gap: 16px; padding: 10px 12px;
      background: var(--surface-2); border-radius: 8px; border: 1px solid var(--border-light);
    }
    .from-class { display: flex; align-items: center; gap: 6px; flex: 1; font-size: 13px; font-weight: 500; color: var(--text); }
    .to-class-select {
      flex: 1; border: 1px solid var(--border); border-radius: 7px; padding: 7px 10px;
      font-size: 13px; color: var(--text); background: var(--surface);
      &:focus { outline: none; border-color: var(--blue); }
    }

    /* ── Preview ── */
    .preview-summary {
      display: flex; gap: 20px; padding: 16px; background: var(--surface-2);
      border-radius: 10px; margin-bottom: 16px;
    }
    .preview-stat { text-align: center; }
    .ps-value { font-size: 22px; font-weight: 700; color: var(--text); }
    .ps-label { font-size: 12px; color: var(--text-4); margin-top: 2px; }

    .warnings-box {
      background: #FFFBEB; border: 1px solid #FDE68A; border-radius: 8px;
      padding: 10px 14px; margin-bottom: 14px;
    }
    .warning-item { display: flex; align-items: center; gap: 6px; font-size: 12.5px; color: #92400E;
      mat-icon { font-size: 15px; color: #D97706; }
    }

    .preview-classes { display: flex; flex-direction: column; gap: 10px; }
    .preview-class { background: var(--surface-2); border-radius: 8px; overflow: hidden; }
    .preview-class-head {
      display: flex; align-items: center; gap: 10px; padding: 10px 14px;
      font-size: 13px; flex-wrap: wrap;
    }
    .pcl-name { font-weight: 600; color: var(--text); }
    .pcl-to { color: var(--blue); font-weight: 500; }
    .pcl-count { margin-left: auto; font-size: 12px; color: var(--text-4); }
    .pcl-warn { display: inline-flex; align-items: center; gap: 3px; font-size: 11px; color: #D97706;
      mat-icon { font-size: 13px; color: #D97706; }
    }
    .preview-students { border-top: 1px solid var(--border-light); }
    .ps-row {
      display: flex; align-items: center; gap: 10px; padding: 6px 14px;
      font-size: 12.5px; color: var(--text-2);
      border-bottom: 1px solid var(--border-light);
      &.has-warning { background: #FFFBEB; }
    }
    .ps-admission { color: var(--text-4); font-size: 11px; }
    .ps-fee-warn { margin-left: auto; color: #D97706; font-size: 12px; font-weight: 500; }

    /* ── Result ── */
    .result-card { text-align: center; padding: 40px; }
    .result-icon { font-size: 48px; margin-bottom: 12px;
      mat-icon { font-size: 52px; width: 52px; height: 52px; }
      &.success mat-icon { color: #10B981; }
    }
    .result-stats { display: flex; justify-content: center; gap: 32px; margin: 20px 0; }
    .result-stat { text-align: center; }
    .rs-value { font-size: 28px; font-weight: 700;
      &.blue { color: var(--blue); }
      &.green { color: #10B981; }
      &.red { color: #EF4444; }
    }
    .rs-label { font-size: 12px; color: var(--text-4); margin-top: 2px; }
    .result-note { font-size: 13px; color: var(--text-3); margin-bottom: 20px; }

    /* ── Batches table ── */
    .batches-table { background: var(--surface); border: 1px solid var(--border); border-radius: 12px; overflow: hidden; }
    .bt-header, .bt-row {
      display: grid; grid-template-columns: 1fr 1fr .8fr .7fr .7fr 1fr 1fr;
      gap: 8px; padding: 10px 16px; align-items: center;
    }
    .bt-header { background: var(--surface-2); font-size: 11px; font-weight: 600; color: var(--text-4); text-transform: uppercase; }
    .bt-row { font-size: 13px; color: var(--text-2); border-top: 1px solid var(--border-light); }
    .status-pill {
      padding: 2px 8px; border-radius: 20px; font-size: 11px; font-weight: 600;
      &.completed { background: #D1FAE5; color: #065F46; }
      &.in_progress { background: #DBEAFE; color: #1E40AF; }
      &.pending { background: #F3F4F6; color: #374151; }
      &.failed { background: #FEE2E2; color: #991B1B; }
    }

    /* ── Empty state ── */
    .empty-state {
      text-align: center; padding: 48px; color: var(--text-4);
      mat-icon { font-size: 40px; width: 40px; height: 40px; opacity: .4; display: block; margin: 0 auto 10px; }
      p { margin: 0; font-size: 14px; }
    }
  `],
})
export class AcademicYearsComponent implements OnInit {
  private api  = inject(ApiService);
  private snack = inject(MatSnackBar);
  private fb   = inject(FormBuilder);
  auth = inject(AuthService);

  years        = signal<AcademicYear[]>([]);
  terms        = signal<Term[]>([]);
  classes      = signal<ClassItem[]>([]);
  batches      = signal<PromotionBatch[]>([]);
  loadingYears  = signal(true);
  loadingClasses = signal(false);
  loadingBatches = signal(false);
  saving        = signal(false);
  showYearForm  = signal(false);
  editingYear   = signal<AcademicYear | null>(null);
  editingTerm   = signal<Term | null>(null);
  addingTermForYear = signal<string | null>(null);

  // Promotion wizard state
  promotionStep   = signal(1);
  fromYearId      = '';
  toYearId        = '';
  classMapping: ClassMappingEntry[] = [];
  promotionPreview = signal<PromotionPreview | null>(null);
  promotionResult  = signal<PromotionBatch | null>(null);

  promotionSteps = [
    { n: 1, label: 'Select Years' },
    { n: 2, label: 'Map Classes' },
    { n: 3, label: 'Preview' },
    { n: 4, label: 'Done' },
  ];

  dayOptions = DAYS.map((l, i) => ({ value: i, label: l })).filter(d => d.value > 0);
  workingDays = signal<number[]>([1, 2, 3, 4, 5]);

  yearForm = this.fb.group({
    name:       ['', Validators.required],
    start_date: ['', Validators.required],
    end_date:   ['', Validators.required],
    is_current: [false],
  });

  editYearForm = this.fb.group({
    name:       ['', Validators.required],
    start_date: ['', Validators.required],
    end_date:   ['', Validators.required],
  });

  termForm = this.fb.group({
    name:       ['', Validators.required],
    start_date: ['', Validators.required],
    end_date:   ['', Validators.required],
  });

  editTermForm = this.fb.group({
    name:       ['', Validators.required],
    start_date: ['', Validators.required],
    end_date:   ['', Validators.required],
  });

  isAdmin = computed(() => ['owner', 'principal'].includes(this.auth.userRole() ?? ''));

  ngOnInit() {
    this.loadAll();
  }

  private showError(err: any) {
    const msg = err?.error?.error?.message ?? err?.error?.message ?? 'An error occurred';
    this.snack.open(msg, 'Dismiss', { duration: 5000, panelClass: 'snack-error' });
  }

  private loadAll() {
    this.loadingYears.set(true);
    this.api.get<{ data: AcademicYear[] }>('/calendar/years').subscribe({
      next: r => { this.years.set(r.data); this.loadingYears.set(false); },
      error: (e) => { this.showError(e); this.loadingYears.set(false); },
    });
    this.api.get<{ data: Term[] }>('/calendar/terms').subscribe({
      next: r => this.terms.set(r.data),
    });
  }

  private loadBatches() {
    this.loadingBatches.set(true);
    this.api.get<{ data: PromotionBatch[] }>('/promotion/batches').subscribe({
      next: r => { this.batches.set(r.data); this.loadingBatches.set(false); },
      error: (e) => { this.showError(e); this.loadingBatches.set(false); },
    });
  }

  termsFor(yearId: string) {
    return this.terms().filter(t => t.academic_year_id === yearId).sort((a, b) => a.sort_order - b.sort_order);
  }

  workingDayLabel(days: number[]) {
    if (!days?.length) return '';
    const sorted = [...days].sort();
    if (JSON.stringify(sorted) === JSON.stringify([1,2,3,4,5])) return 'Mon–Fri';
    if (JSON.stringify(sorted) === JSON.stringify([1,2,3,4,5,6])) return 'Mon–Sat';
    return sorted.map(d => DAYS[d]).join(', ');
  }

  toggleDay(day: number) {
    const cur = this.workingDays();
    this.workingDays.set(cur.includes(day) ? cur.filter(d => d !== day) : [...cur, day]);
  }

  saveYear() {
    if (this.yearForm.invalid) return;
    this.saving.set(true);
    const payload = { ...this.yearForm.value, working_days: this.workingDays() };
    this.api.post<{ data: AcademicYear }>('/calendar/years', payload).subscribe({
      next: r => {
        this.years.update(y => [r.data, ...y]);
        this.showYearForm.set(false);
        this.yearForm.reset({ is_current: false });
        this.workingDays.set([1,2,3,4,5]);
        this.saving.set(false);
        this.snack.open('Academic year created', '', { duration: 3000 });
      },
      error: (e) => { this.saving.set(false); this.showError(e); },
    });
  }

  startEditYear(year: AcademicYear) {
    this.editingYear.set(year);
    this.editYearForm.patchValue({
      name: year.name,
      start_date: year.start_date?.slice(0, 10),
      end_date: year.end_date?.slice(0, 10),
    });
  }

  saveEditYear() {
    const year = this.editingYear();
    if (!year || this.editYearForm.invalid) return;
    this.saving.set(true);
    this.api.put<{ data: AcademicYear }>(`/calendar/years/${year.id}`, this.editYearForm.value).subscribe({
      next: r => {
        this.years.update(y => y.map(x => x.id === r.data.id ? r.data : x));
        this.editingYear.set(null);
        this.saving.set(false);
        this.snack.open('Year updated', '', { duration: 2500 });
      },
      error: (e) => { this.saving.set(false); this.showError(e); },
    });
  }

  setCurrentYear(year: AcademicYear) {
    this.api.patch<{ data: AcademicYear }>(`/calendar/years/${year.id}/set-current`).subscribe({
      next: () => {
        this.years.update(y => y.map(x => ({ ...x, is_current: x.id === year.id })));
        this.snack.open(`${year.name} is now the current year`, '', { duration: 3000 });
      },
    });
  }

  toggleAddTerm(yearId: string) {
    this.addingTermForYear.set(this.addingTermForYear() === yearId ? null : yearId);
    this.termForm.reset();
  }

  saveTerm(yearId: string) {
    if (this.termForm.invalid) return;
    this.saving.set(true);
    const payload = { ...this.termForm.value, academic_year_id: yearId, sort_order: this.termsFor(yearId).length + 1 };
    this.api.post<{ data: Term }>('/calendar/terms', payload).subscribe({
      next: r => {
        this.terms.update(t => [...t, r.data]);
        this.addingTermForYear.set(null);
        this.saving.set(false);
        this.snack.open('Term added', '', { duration: 2500 });
      },
      error: (e) => { this.saving.set(false); this.showError(e); },
    });
  }

  startEditTerm(term: Term) {
    this.editingTerm.set(term);
    this.editTermForm.patchValue({
      name: term.name,
      start_date: term.start_date?.slice(0, 10),
      end_date: term.end_date?.slice(0, 10),
    });
  }

  saveEditTerm() {
    const term = this.editingTerm();
    if (!term || this.editTermForm.invalid) return;
    this.api.put<{ data: Term }>(`/calendar/terms/${term.id}`, this.editTermForm.value).subscribe({
      next: r => {
        this.terms.update(t => t.map(x => x.id === r.data.id ? r.data : x));
        this.editingTerm.set(null);
        this.snack.open('Term updated', '', { duration: 2500 });
      },
    });
  }

  deleteTerm(term: Term) {
    if (!confirm(`Delete "${term.name}"?`)) return;
    this.api.delete(`/calendar/terms/${term.id}`).subscribe({
      next: () => {
        this.terms.update(t => t.filter(x => x.id !== term.id));
        this.snack.open('Term deleted', '', { duration: 2500 });
      },
    });
  }

  // ── Promotion wizard ────────────────────────────────────────────────────────

  goToStep2() {
    if (!this.fromYearId || !this.toYearId) return;
    this.loadingClasses.set(true);
    this.api.get<{ data: ClassItem[] }>('/students/classes').subscribe({
      next: r => {
        this.classes.set(r.data);
        this.classMapping = r.data.map(c => ({
          from_class_id: c.id,
          from_class_name: c.section ? `${c.name} (${c.section})` : c.name,
          to_class_id: null,
        }));
        this.loadingClasses.set(false);
        this.promotionStep.set(2);
      },
      error: () => this.loadingClasses.set(false),
    });
  }

  runPrepare() {
    this.saving.set(true);
    const payload = {
      from_academic_year_id: this.fromYearId,
      to_academic_year_id: this.toYearId,
      class_mapping: this.classMapping.map(m => ({ from_class_id: m.from_class_id, to_class_id: m.to_class_id ?? null })),
    };
    this.api.post<{ data: PromotionPreview }>('/promotion/prepare', payload).subscribe({
      next: r => {
        this.promotionPreview.set(r.data);
        this.saving.set(false);
        this.promotionStep.set(3);
      },
      error: (e) => { this.saving.set(false); this.showError(e); },
    });
  }

  executePromotion() {
    if (!confirm('This will move all students to their new classes and set the target year as current. Continue?')) return;
    this.saving.set(true);
    const payload = {
      from_academic_year_id: this.fromYearId,
      to_academic_year_id: this.toYearId,
      class_mapping: this.classMapping.map(m => ({ from_class_id: m.from_class_id, to_class_id: m.to_class_id ?? null })),
      confirmed: true as const,
    };
    this.api.post<{ data: PromotionBatch }>('/promotion/execute', payload).subscribe({
      next: r => {
        this.promotionResult.set(r.data);
        this.saving.set(false);
        this.promotionStep.set(4);
        this.loadAll();
        this.loadBatches();
        this.snack.open('Promotion complete!', '', { duration: 4000 });
      },
      error: (e) => { this.saving.set(false); this.showError(e); },
    });
  }

  resetPromotion() {
    this.promotionStep.set(1);
    this.fromYearId = '';
    this.toYearId = '';
    this.classMapping = [];
    this.promotionPreview.set(null);
    this.promotionResult.set(null);
  }
}
