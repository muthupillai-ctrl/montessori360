import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';
import { FormsModule, ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { ApiService } from '../../core/services/api.service';
import { AuthService } from '../../core/services/auth.service';

type Tab = 'timetables' | 'templates' | 'subjects' | 'assignments';
const DAYS = [
  { key: 'mon', label: 'Monday',    num: 1 },
  { key: 'tue', label: 'Tuesday',   num: 2 },
  { key: 'wed', label: 'Wednesday', num: 3 },
  { key: 'thu', label: 'Thursday',  num: 4 },
  { key: 'fri', label: 'Friday',    num: 5 },
  { key: 'sat', label: 'Saturday',  num: 6 },
];

const SLOT_TYPES = [
  { value: 'period',     label: 'Period',      color: '#2563EB' },
  { value: 'work_cycle', label: 'Work Cycle',  color: '#7C3AED' },
  { value: 'break',      label: 'Break',       color: '#6B7280' },
  { value: 'assembly',   label: 'Assembly',    color: '#F59E0B' },
  { value: 'free',       label: 'Free Period', color: '#10B981' },
  { value: 'other',      label: 'Other',       color: '#9CA3AF' },
];

const COLORS = ['#2563EB','#7C3AED','#DB2777','#D97706','#059669','#0891B2','#DC2626','#0F766E','#9333EA','#EA580C'];

@Component({
  selector: 'app-timetable',
  standalone: true,
  imports: [ MatIconModule, MatProgressSpinnerModule, FormsModule, ReactiveFormsModule ],
  template: `
  <div class="page-wrap">

    <!-- Page header -->
    <div class="page-header">
      <div>
        <div class="page-title">Timetable</div>
        <div class="page-sub">Manage class schedules, period templates and subjects</div>
      </div>
    </div>

    <!-- Tabs -->
    <div class="tab-bar">
      <button class="tab-btn" [class.active]="activeTab()==='timetables'" (click)="activeTab.set('timetables')">
        <mat-icon style="font-size:15px;width:15px;height:15px">calendar_view_week</mat-icon> Timetables
      </button>
      <button class="tab-btn" [class.active]="activeTab()==='templates'" (click)="activeTab.set('templates')">
        <mat-icon style="font-size:15px;width:15px;height:15px">schedule</mat-icon> Period Templates
      </button>
      <button class="tab-btn" [class.active]="activeTab()==='subjects'" (click)="activeTab.set('subjects')">
        <mat-icon style="font-size:15px;width:15px;height:15px">book</mat-icon> Subjects
      </button>
      <button class="tab-btn" [class.active]="activeTab()==='assignments'" (click)="activeTab.set('assignments')">
        <mat-icon style="font-size:15px;width:15px;height:15px">assignment_ind</mat-icon> Subject Assignments
      </button>
    </div>

    <!-- ── TIMETABLES TAB ─────────────────────────────────────── -->
    @if (activeTab() === 'timetables') {
      @if (!activeTimetable()) {
        <!-- Timetable list -->
        <div class="section-header">
          <div class="section-title">Class Timetables</div>
          @if (isAdmin()) {
            <button class="btn-primary" (click)="openCreateTimetable()">
              <mat-icon style="font-size:15px;width:15px;height:15px">add</mat-icon> New Timetable
            </button>
          }
        </div>
        @if (ttLoading()) {
          <div class="loading"><mat-progress-spinner diameter="28" mode="indeterminate"/></div>
        } @else if (!timetables().length) {
          <div class="empty-state">
            <mat-icon style="font-size:40px;width:40px;height:40px;color:var(--text-4)">calendar_view_week</mat-icon>
            <div>No timetables yet</div>
            <div class="empty-sub">Create a timetable for each class</div>
          </div>
        } @else {
          <div class="tt-grid">
            @for (tt of timetables(); track tt.id) {
              <div class="tt-card" (click)="openTimetable(tt)">
                <div class="tt-card-header">
                  <div class="tt-class">{{ tt.class_name }}</div>
                  <span class="tt-year">{{ tt.academic_year }}</span>
                </div>
                <div class="tt-days">
                  @for (d of days; track d.key) {
                    <div class="tt-day-pill"
                         [class.has-template]="tt[d.key+'_template']"
                         [title]="tt[d.key+'_template_name'] ?? 'No template'">
                      {{ d.label.slice(0,3) }}
                    </div>
                  }
                </div>
                <div class="tt-footer">
                  <mat-icon style="font-size:13px;width:13px;height:13px;color:var(--text-4)">touch_app</mat-icon>
                  Click to edit
                </div>
              </div>
            }
          </div>
        }
      } @else {
        <!-- Timetable editor -->
        <div class="editor-header">
          <button class="btn-back" (click)="activeTimetable.set(null)">
            <mat-icon style="font-size:18px;width:18px;height:18px">arrow_back</mat-icon>
          </button>
          <div>
            <div class="editor-title">{{ activeTimetable()!.class_name }}</div>
            <div class="editor-sub">{{ activeTimetable()!.academic_year }}</div>
          </div>
          @if (isAdmin()) {
            <button class="btn-sm ml-auto" (click)="openDayTemplates()">
              <mat-icon style="font-size:13px;width:13px;height:13px">tune</mat-icon>
              Day Templates
            </button>
          }
        </div>

        <!-- Day selector -->
        <div class="day-selector">
          @for (d of activeDays(); track d.key) {
            <button class="day-btn" [class.active]="activeDay()===d.num" (click)="activeDay.set(d.num)">
              {{ d.label.slice(0,3) }}
            </button>
          }
        </div>

        <!-- Period grid for selected day -->
        @if (activeTemplate()) {
          <div class="period-grid">
            @for (slot of activeTemplate()!.slots; track slot.id) {
              <div class="period-row">
                <!-- Time -->
                <div class="period-time">
                  <div class="pt-start">{{ slot.start_time }}</div>
                  <div class="pt-end">{{ slot.end_time }}</div>
                </div>
                <!-- Slot name -->
                <div class="period-name">
                  <div class="pn-name">{{ slot.name }}</div>
                  <div class="pn-type">{{ slot.slot_type }}</div>
                </div>
                <!-- Subject / assignment -->
                <div class="period-assign" [class]="'type-'+getSlotData(slot.id, activeDay())?.slot_type">
                  @if (getSlotData(slot.id, activeDay()); as sd) {
                    <div class="pa-filled">
                      @if (sd.subject_name) {
                        <span class="subject-pill" [style.background]="sd.subject_color + '20'"
                              [style.color]="sd.subject_color">
                          {{ sd.subject_name }}
                        </span>
                      } @else {
                        <span class="slot-type-label">{{ sd.slot_type }}</span>
                      }
                      @if (sd.teacher_name) {
                        <span class="teacher-label">{{ sd.teacher_name }}</span>
                      }
                    </div>
                  } @else {
                    <span class="pa-empty">—</span>
                  }
                </div>
                <!-- Edit button -->
                @if (isAdmin()) {
                  <button class="period-edit-btn" (click)="openSlotEditor(slot, activeDay())">
                    <mat-icon style="font-size:14px;width:14px;height:14px">edit</mat-icon>
                  </button>
                }
              </div>
            }
          </div>
        } @else {
          <div class="empty-state">
            <div>No template assigned for this day</div>
            @if (isAdmin()) {
              <button class="btn-primary" style="margin-top:12px" (click)="openDayTemplates()">Assign Template</button>
            }
          </div>
        }
      }
    }

    <!-- ── TEMPLATES TAB ──────────────────────────────────────── -->
    @if (activeTab() === 'templates') {
      <div class="section-header">
        <div class="section-title">Period Templates</div>
        @if (isAdmin()) {
          <button class="btn-primary" (click)="openCreateTemplate()">
            <mat-icon style="font-size:15px;width:15px;height:15px">add</mat-icon> New Template
          </button>
        }
      </div>
      @if (tplLoading()) {
        <div class="loading"><mat-progress-spinner diameter="28" mode="indeterminate"/></div>
      } @else if (!templates().length) {
        <div class="empty-state">
          <mat-icon style="font-size:40px;width:40px;height:40px;color:var(--text-4)">schedule</mat-icon>
          <div>No templates yet</div>
          <div class="empty-sub">Create a period template (e.g. Standard Day, Short Day)</div>
        </div>
      } @else {
        <div class="tpl-list">
          @for (t of templates(); track t.id) {
            <div class="tpl-card">
              <div class="tpl-header">
                <div class="tpl-name">{{ t.name }}
                  @if (t.is_default) { <span class="default-badge">Default</span> }
                </div>
                @if (isAdmin()) {
                  <button class="btn-sm" (click)="openEditTemplate(t)">Edit</button>
                }
              </div>
              <div class="tpl-slots">
                @for (s of t.slots; track s.id) {
                  <div class="tpl-slot" [class]="'stype-'+s.slot_type">
                    <span class="ts-time">{{ s.start_time }}–{{ s.end_time }}</span>
                    <span class="ts-name">{{ s.name }}</span>
                    <span class="ts-type">{{ s.slot_type }}</span>
                  </div>
                }
              </div>
            </div>
          }
        </div>
      }
    }

    <!-- ── SUBJECTS TAB ───────────────────────────────────────── -->
    @if (activeTab() === 'subjects') {
      <div class="section-header">
        <div class="section-title">Subjects</div>
        @if (isAdmin()) {
          <button class="btn-primary" (click)="openCreateSubject()">
            <mat-icon style="font-size:15px;width:15px;height:15px">add</mat-icon> New Subject
          </button>
        }
      </div>
      @if (subLoading()) {
        <div class="loading"><mat-progress-spinner diameter="28" mode="indeterminate"/></div>
      } @else {
        <div class="subject-grid">
          @for (s of subjects(); track s.id) {
            <div class="subject-card">
              <div class="sc-color" [style.background]="s.color"></div>
              <div class="sc-info">
                <div class="sc-name">{{ s.name }}</div>
                @if (s.code) { <div class="sc-code">{{ s.code }}</div> }
                @if (s.description) { <div class="sc-desc">{{ s.description }}</div> }
              </div>
              @if (isAdmin()) {
                <button class="icon-btn" (click)="openEditSubject(s)">
                  <mat-icon style="font-size:15px;width:15px;height:15px">edit</mat-icon>
                </button>
              }
            </div>
          }
        </div>
      }
    }

  </div>

    <!-- ── ASSIGNMENTS TAB ──────────────────────────────────────── -->
    @if (activeTab() === 'assignments') {
      <div class="assign-layout">

        <!-- Left: class list -->
        <div class="assign-sidebar">
          <div class="assign-sidebar-title">Classes</div>
          @for (tt of timetables(); track tt.id) {
            <button class="assign-class-btn"
                    [class.active]="selectedAssignmentClassId() === tt.class_id"
                    (click)="onAssignmentClassChange(tt.class_id)">
              <div class="acb-av" [style.background]="getClassColor(tt.class_name)">
                {{ tt.class_name[0] }}{{ tt.class_section ? tt.class_section[0] : tt.class_name[1] ?? '' }}
              </div>
              <div class="acb-info">
                <div class="acb-name">{{ tt.class_name }}</div>
                @if (tt.class_section) {
                  <div class="acb-section">Section {{ tt.class_section }}</div>
                }
              </div>
              @if (selectedAssignmentClassId() === tt.class_id) {
                <mat-icon style="font-size:16px;width:16px;height:16px;color:var(--blue);margin-left:auto">chevron_right</mat-icon>
              }
            </button>
          }
        </div>

        <!-- Right: subject assignments -->
        <div class="assign-content">
          @if (!selectedAssignmentClassId()) {
            <div class="assign-placeholder">
              <mat-icon style="font-size:48px;width:48px;height:48px;color:var(--border)">assignment_ind</mat-icon>
              <div class="ap-title">Select a class</div>
              <div class="ap-sub">Choose a class from the left to view and assign teachers to each subject</div>
            </div>
          } @else if (cstLoading()) {
            <div class="assign-placeholder">
              <mat-progress-spinner diameter="32" mode="indeterminate"/>
            </div>
          } @else {
            <!-- Header -->
            <div class="assign-content-header">
              <div>
                <div class="ach-class">
                  {{ selectedClassName() }}
                  @if (selectedClassSection()) {
                    <span class="ach-section">Section {{ selectedClassSection() }}</span>
                  }
                </div>
                <div class="ach-sub">{{ classSubjectTeachers().length }} subjects · assign a teacher to each</div>
              </div>
              <div class="ach-legend">
                <span class="legend-dot assigned"></span> Assigned
                <span class="legend-dot unassigned" style="margin-left:12px"></span> Not assigned
              </div>
            </div>

            @if (!classSubjectTeachers().length) {
              <div class="assign-placeholder" style="padding:40px">
                <div class="ap-title" style="font-size:14px">No subjects yet</div>
                <div class="ap-sub">Create subjects in the Subjects tab first</div>
              </div>
            } @else {
              <div class="cst-table">
                <div class="cst-header-row">
                  <div class="cst-h-subject">Subject</div>
                  <div class="cst-h-teacher">Assigned Teacher</div>
                  <div class="cst-h-status">Status</div>
                </div>
                @for (row of classSubjectTeachers(); track row.subject_id) {
                  <div class="cst-row" [class.is-assigned]="row.teacher_id">
                    <!-- Subject -->
                    <div class="cst-h-subject">
                      <div class="subject-color-bar" [style.background]="row.subject_color ?? '#2563EB'"></div>
                      <div class="cst-subject-info">
                        <div class="cst-subject-name">{{ row.subject_name }}</div>
                        @if (row.subject_code) { <div class="cst-subject-code">{{ row.subject_code }}</div> }
                      </div>
                    </div>
                    <!-- Teacher selector -->
                    <div class="cst-h-teacher">
                      <select class="fi cst-select"
                              [ngModel]="row.teacher_id ?? ''"
                              (ngModelChange)="row._pending = $event"
                              [ngModelOptions]="{standalone:true}"
                              [disabled]="!isAdmin()">
                        <option value="">— Not assigned —</option>
                        @for (t of teachers(); track t.id) {
                          <option [value]="t.id">{{ t.name ?? (t.first_name + ' ' + t.last_name) }}</option>
                        }
                      </select>
                    </div>
                    <!-- Status + Save -->
                    <div class="cst-h-status">
                      @if (row._pending !== undefined && row._pending !== (row.teacher_id ?? '')) {
                        <button class="btn-save-assign" (click)="onCstChange(row, row._pending)" [disabled]="row._saving">
                          {{ row._saving ? 'Saving…' : 'Save' }}
                        </button>
                      } @else if (row._saved) {
                        <span class="saved-tag">✓ Saved</span>
                      } @else if (row.teacher_id) {
                        <span class="assigned-tag">✓ Assigned</span>
                      } @else {
                        <span class="pending-tag">Not assigned</span>
                      }
                    </div>
                  </div>
                }
              </div>
            }
          }
        </div>
      </div>
    }

  <!-- ── MODALS ────────────────────────────────────────────────── -->

  <!-- Create Timetable -->
  @if (showCreateTimetable()) {
    <div class="modal-backdrop" (click)="showCreateTimetable.set(false)">
      <div class="modal" (click)="$event.stopPropagation()">
        <div class="modal-header">
          <div class="modal-title">New Timetable</div>
          <button class="icon-btn" (click)="showCreateTimetable.set(false)">
            <mat-icon style="font-size:16px;width:16px;height:16px">close</mat-icon>
          </button>
        </div>
        <div class="modal-body" [formGroup]="ttForm">
          <div class="field-group">
            <label class="fl">Class <span class="req">*</span></label>
            <select class="fi" formControlName="class_id">
              <option value="">Select class…</option>
              @for (c of classes(); track c.id) {
                <option [value]="c.id">{{ c.name }}</option>
              }
            </select>
          </div>
          <div class="field-group">
            <label class="fl">Academic Year <span class="req">*</span></label>
            <input class="fi" formControlName="academic_year" placeholder="e.g. 2026-2027">
          </div>
          <div class="field-group">
            <label class="fl">Timetable Name</label>
            <input class="fi" formControlName="name" placeholder="e.g. Term 1 Schedule">
          </div>
          <div class="field-group">
            <label class="fl">Default Template for All Days</label>
            <select class="fi" formControlName="default_template">
              <option value="">None</option>
              @for (t of templates(); track t.id) {
                <option [value]="t.id">{{ t.name }}</option>
              }
            </select>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn-outline" (click)="showCreateTimetable.set(false)">Cancel</button>
          <button class="btn-primary" (click)="createTimetable()" [disabled]="ttForm.invalid || saving()">
            {{ saving() ? 'Creating…' : 'Create' }}
          </button>
        </div>
      </div>
    </div>
  }

  <!-- Day Templates modal -->
  @if (showDayTemplates()) {
    <div class="modal-backdrop" (click)="showDayTemplates.set(false)">
      <div class="modal" (click)="$event.stopPropagation()">
        <div class="modal-header">
          <div class="modal-title">Assign Templates per Day</div>
          <button class="icon-btn" (click)="showDayTemplates.set(false)">
            <mat-icon style="font-size:16px;width:16px;height:16px">close</mat-icon>
          </button>
        </div>
        <div class="modal-body">
          @for (d of days; track d.key) {
            <div class="field-group">
              <label class="fl">{{ d.label }}</label>
              <select class="fi" [(ngModel)]="dayTemplateMap[d.key]">
                <option value="">No school / No template</option>
                @for (t of templates(); track t.id) {
                  <option [value]="t.id">{{ t.name }}</option>
                }
              </select>
            </div>
          }
        </div>
        <div class="modal-footer">
          <button class="btn-outline" (click)="showDayTemplates.set(false)">Cancel</button>
          <button class="btn-primary" (click)="saveDayTemplates()" [disabled]="saving()">
            {{ saving() ? 'Saving…' : 'Save' }}
          </button>
        </div>
      </div>
    </div>
  }

  <!-- Slot editor -->
  @if (editingSlot()) {
    <div class="modal-backdrop" (click)="editingSlot.set(null)">
      <div class="modal" (click)="$event.stopPropagation()">
        <div class="modal-header">
          <div class="modal-title">Edit Slot — {{ editingSlot()!.slot.name }}</div>
          <button class="icon-btn" (click)="editingSlot.set(null)">
            <mat-icon style="font-size:16px;width:16px;height:16px">close</mat-icon>
          </button>
        </div>
        <div class="modal-body">
          <div class="slot-info-row">
            <span>{{ editingSlot()!.slot.start_time }} – {{ editingSlot()!.slot.end_time }}</span>
            <span class="day-badge">{{ dayName(editingSlot()!.day) }}</span>
          </div>
          <div class="field-group">
            <label class="fl">Slot Type</label>
            <select class="fi" [(ngModel)]="slotForm.slot_type">
              @for (st of slotTypes; track st.value) {
                <option [value]="st.value">{{ st.label }}</option>
              }
            </select>
          </div>
          @if (slotForm.slot_type === 'period' || slotForm.slot_type === 'work_cycle') {
            <div class="field-group">
              <label class="fl">Subject</label>
              <select class="fi" [(ngModel)]="slotForm.subject_id" (ngModelChange)="onSlotSubjectChange($event)">
                <option value="">— No subject —</option>
                @for (s of subjects(); track s.id) {
                  <option [value]="s.id">{{ s.name }}</option>
                }
              </select>
            </div>
            <div class="field-group">
              <label class="fl">Teacher</label>
              <select class="fi" [(ngModel)]="slotForm.teacher_id">
                <option value="">— No teacher —</option>
                @for (t of teachers(); track t.id) {
                  <option [value]="t.id">{{ t.name ?? (t.first_name + ' ' + t.last_name) }}</option>
                }
              </select>
            </div>
          }
          <div class="field-group">
            <label class="fl">Notes</label>
            <input class="fi" [(ngModel)]="slotForm.notes" placeholder="Optional notes">
          </div>
          @if (conflictMsg()) {
            <div class="conflict-banner">
              <mat-icon style="font-size:15px;width:15px;height:15px">warning</mat-icon>
              {{ conflictMsg() }}
              @if (isAdmin()) {
                <button class="conflict-approve" (click)="saveSlot(true)">Approve & Override</button>
              }
            </div>
          }
        </div>
        <div class="modal-footer">
          <button class="btn-outline danger" (click)="clearSlot()" [disabled]="saving()">Clear</button>
          <button class="btn-outline" (click)="editingSlot.set(null)">Cancel</button>
          <button class="btn-primary" (click)="saveSlot(false)" [disabled]="saving()">
            {{ saving() ? 'Saving…' : 'Save' }}
          </button>
        </div>
      </div>
    </div>
  }

  <!-- Subject modal -->
  @if (showSubjectModal()) {
    <div class="modal-backdrop" (click)="showSubjectModal.set(false)">
      <div class="modal sm" (click)="$event.stopPropagation()">
        <div class="modal-header">
          <div class="modal-title">{{ editingSubject() ? 'Edit Subject' : 'New Subject' }}</div>
          <button class="icon-btn" (click)="showSubjectModal.set(false)">
            <mat-icon style="font-size:16px;width:16px;height:16px">close</mat-icon>
          </button>
        </div>
        <div class="modal-body" [formGroup]="subjectForm">
          <div class="field-group">
            <label class="fl">Name <span class="req">*</span></label>
            <input class="fi" formControlName="name" placeholder="e.g. Mathematics">
          </div>
          <div class="field-group">
            <label class="fl">Code</label>
            <input class="fi" formControlName="code" placeholder="e.g. MATH">
          </div>
          <div class="field-group">
            <label class="fl">Colour</label>
            <div class="color-row">
              @for (col of colorOptions; track col) {
                <button class="color-swatch" [style.background]="col"
                        [class.selected]="subjectForm.value.color === col"
                        (click)="subjectForm.patchValue({color: col})"></button>
              }
            </div>
          </div>
          <div class="field-group">
            <label class="fl">Description</label>
            <input class="fi" formControlName="description" placeholder="Optional">
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn-outline" (click)="showSubjectModal.set(false)">Cancel</button>
          <button class="btn-primary" (click)="saveSubject()" [disabled]="subjectForm.invalid || saving()">
            {{ saving() ? 'Saving…' : 'Save' }}
          </button>
        </div>
      </div>
    </div>
  }

  <!-- Template modal -->
  @if (showTemplateModal()) {
    <div class="modal-backdrop" (click)="showTemplateModal.set(false)">
      <div class="modal lg" (click)="$event.stopPropagation()">
        <div class="modal-header">
          <div class="modal-title">{{ editingTemplate() ? 'Edit Template' : 'New Period Template' }}</div>
          <button class="icon-btn" (click)="showTemplateModal.set(false)">
            <mat-icon style="font-size:16px;width:16px;height:16px">close</mat-icon>
          </button>
        </div>
        <div class="modal-body" [formGroup]="templateForm">
          <div class="form-row">
            <div class="field-group fill">
              <label class="fl">Template Name <span class="req">*</span></label>
              <input class="fi" formControlName="name" placeholder="e.g. Standard Day">
            </div>
            <div class="field-group" style="flex-direction:row;align-items:center;gap:8px;padding-top:20px">
              <input type="checkbox" formControlName="is_default" id="is_default">
              <label for="is_default" style="font-size:13px;color:var(--text-2);cursor:pointer">Set as default</label>
            </div>
          </div>
          <div class="field-group">
            <label class="fl">Description</label>
            <input class="fi" formControlName="description" placeholder="Optional">
          </div>

          <!-- Slots editor -->
          <div class="slots-editor">
            <div class="se-header">
              <span class="se-title">Periods / Slots</span>
              <button class="btn-sm" (click)="addTemplateSlot()">
                <mat-icon style="font-size:13px;width:13px;height:13px">add</mat-icon> Add Slot
              </button>
            </div>
            @for (s of templateSlots; track $index; let i = $index) {
              <div class="se-row">
                <input class="fi sm" [(ngModel)]="s.name" [ngModelOptions]="{standalone:true}" placeholder="Name">
                <select class="fi sm" [(ngModel)]="s.slot_type" [ngModelOptions]="{standalone:true}">
                  @for (st of slotTypes; track st.value) {
                    <option [value]="st.value">{{ st.label }}</option>
                  }
                </select>
                <input class="fi sm time" [(ngModel)]="s.start_time" [ngModelOptions]="{standalone:true}" type="time">
                <input class="fi sm time" [(ngModel)]="s.end_time"   [ngModelOptions]="{standalone:true}" type="time">
                <button class="icon-btn danger" (click)="removeTemplateSlot(i)">
                  <mat-icon style="font-size:14px;width:14px;height:14px">delete</mat-icon>
                </button>
              </div>
            }
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn-outline" (click)="showTemplateModal.set(false)">Cancel</button>
          <button class="btn-primary" (click)="saveTemplate()" [disabled]="templateForm.invalid || saving()">
            {{ saving() ? 'Saving…' : 'Save Template' }}
          </button>
        </div>
      </div>
    </div>
  }
  `,
  styles: [`
    .page-wrap { max-width: 1100px; margin: 0 auto; }
    .page-header { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 20px; }
    .page-title { font-size: 22px; font-weight: 700; color: var(--text); }
    .page-sub   { font-size: 13px; color: var(--text-3); margin-top: 2px; }

    /* Tabs */
    .tab-bar { display: flex; gap: 4px; border-bottom: 1.5px solid var(--border); margin-bottom: 20px; }
    .tab-btn { display: flex; align-items: center; gap: 6px; padding: 9px 16px; border: none; background: none; font-size: 13px; font-weight: 500; color: var(--text-3); cursor: pointer; border-bottom: 2px solid transparent; margin-bottom: -1.5px; border-radius: 6px 6px 0 0; &:hover { color: var(--text); background: var(--bg); } &.active { color: var(--blue); border-bottom-color: var(--blue); font-weight: 600; } }

    /* Section header */
    .section-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; }
    .section-title  { font-size: 15px; font-weight: 600; color: var(--text); }

    /* Timetable grid */
    .tt-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px,1fr)); gap: 14px; }
    .tt-card { background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 16px; cursor: pointer; transition: box-shadow .15s; &:hover { box-shadow: var(--shadow-md); border-color: var(--blue); } }
    .tt-card-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; }
    .tt-class { font-size: 16px; font-weight: 700; color: var(--text); }
    .tt-year  { font-size: 11px; color: var(--text-4); background: var(--bg); padding: 2px 8px; border-radius: 10px; }
    .tt-days  { display: flex; gap: 4px; margin-bottom: 12px; }
    .tt-day-pill { padding: 3px 7px; border-radius: 6px; font-size: 10.5px; font-weight: 600; background: var(--bg); color: var(--text-4); &.has-template { background: var(--blue-light); color: var(--blue); } }
    .tt-footer { font-size: 11px; color: var(--text-4); display: flex; align-items: center; gap: 4px; }

    /* Editor */
    .editor-header { display: flex; align-items: center; gap: 12px; margin-bottom: 16px; }
    .editor-title  { font-size: 18px; font-weight: 700; color: var(--text); }
    .editor-sub    { font-size: 12px; color: var(--text-3); }
    .ml-auto { margin-left: auto; }
    .btn-back { background: var(--surface); border: 1px solid var(--border); border-radius: 8px; width: 34px; height: 34px; display: flex; align-items: center; justify-content: center; cursor: pointer; color: var(--text-2); &:hover { background: var(--bg); } }

    /* Day selector */
    .day-selector { display: flex; gap: 6px; margin-bottom: 16px; overflow-x: auto; }
    .day-btn { padding: 7px 16px; border-radius: 8px; border: 1px solid var(--border); background: var(--surface); font-size: 13px; font-weight: 500; color: var(--text-2); cursor: pointer; white-space: nowrap; &:hover { background: var(--bg); } &.active { background: var(--blue); color: #fff; border-color: var(--blue); } }

    /* Period grid */
    .period-grid { display: flex; flex-direction: column; gap: 2px; }
    .period-row  { display: flex; align-items: center; gap: 10px; padding: 10px 14px; background: var(--surface); border: 1px solid var(--border); border-radius: 8px; }
    .period-time { width: 70px; flex-shrink: 0; }
    .pt-start { font-size: 13px; font-weight: 600; color: var(--text-2); }
    .pt-end   { font-size: 11px; color: var(--text-4); }
    .period-name { width: 130px; flex-shrink: 0; }
    .pn-name  { font-size: 13px; font-weight: 500; color: var(--text); }
    .pn-type  { font-size: 10.5px; color: var(--text-4); text-transform: capitalize; }
    .period-assign { flex: 1; }
    .pa-filled { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
    .pa-empty  { color: var(--text-4); font-size: 12px; }
    .subject-pill { font-size: 11.5px; font-weight: 600; padding: 3px 10px; border-radius: 10px; }
    .teacher-label { font-size: 11.5px; color: var(--text-3); }
    .slot-type-label { font-size: 12px; color: var(--text-3); text-transform: capitalize; }
    .period-edit-btn { background: none; border: none; cursor: pointer; color: var(--text-4); padding: 4px; border-radius: 6px; display: flex; align-items: center; &:hover { background: var(--bg); color: var(--blue); } }

    /* Templates */
    .tpl-list { display: flex; flex-direction: column; gap: 14px; }
    .tpl-card { background: var(--surface); border: 1px solid var(--border); border-radius: 12px; overflow: hidden; }
    .tpl-header { display: flex; align-items: center; justify-content: space-between; padding: 14px 16px; border-bottom: 1px solid var(--border); }
    .tpl-name   { font-size: 15px; font-weight: 600; color: var(--text); display: flex; align-items: center; gap: 8px; }
    .default-badge { font-size: 10px; font-weight: 700; padding: 2px 7px; border-radius: 10px; background: var(--blue-light); color: var(--blue); }
    .tpl-slots  { padding: 10px 16px; display: flex; flex-direction: column; gap: 4px; }
    .tpl-slot   { display: flex; align-items: center; gap: 12px; padding: 5px 0; border-bottom: 1px solid var(--border-light); &:last-child { border: none; } }
    .ts-time    { font-size: 11.5px; font-weight: 600; color: var(--text-2); width: 110px; flex-shrink: 0; }
    .ts-name    { font-size: 13px; color: var(--text); flex: 1; }
    .ts-type    { font-size: 10.5px; color: var(--text-4); text-transform: capitalize; padding: 2px 7px; background: var(--bg); border-radius: 8px; }
    .stype-break      .ts-type { background: #F3F4F6; color: #6B7280; }
    .stype-work_cycle .ts-type { background: var(--purple-light); color: var(--purple); }
    .stype-assembly   .ts-type { background: var(--amber-light); color: #92400E; }

    /* Subjects */
    .subject-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px,1fr)); gap: 10px; }
    .subject-card { background: var(--surface); border: 1px solid var(--border); border-radius: 10px; padding: 12px 14px; display: flex; align-items: center; gap: 12px; }
    .sc-color { width: 12px; height: 40px; border-radius: 4px; flex-shrink: 0; }
    .sc-info  { flex: 1; min-width: 0; }
    .sc-name  { font-size: 14px; font-weight: 600; color: var(--text); }
    .sc-code  { font-size: 10.5px; color: var(--text-4); font-family: monospace; }
    .sc-desc  { font-size: 11.5px; color: var(--text-3); margin-top: 2px; }

    /* Slots editor in modal */
    .slots-editor { margin-top: 12px; border: 1px solid var(--border); border-radius: 8px; overflow: hidden; }
    .se-header { display: flex; align-items: center; justify-content: space-between; padding: 8px 12px; background: var(--bg); border-bottom: 1px solid var(--border); }
    .se-title  { font-size: 12px; font-weight: 600; color: var(--text-2); }
    .se-row    { display: flex; align-items: center; gap: 8px; padding: 7px 10px; border-bottom: 1px solid var(--border-light); &:last-child { border: none; } flex-wrap: wrap; }
    .fi.sm     { height: 32px; font-size: 12px; padding: 0 8px; flex: 1; min-width: 80px; }
    .fi.time   { width: 130px; flex: none; }

    /* Slot info */
    .slot-info-row { display: flex; align-items: center; gap: 10px; margin-bottom: 14px; font-size: 13px; font-weight: 600; color: var(--text-2); }
    .day-badge { font-size: 11px; padding: 3px 10px; border-radius: 10px; background: var(--blue-light); color: var(--blue); font-weight: 600; }

    /* Conflict */
    .conflict-banner { display: flex; align-items: center; gap: 8px; padding: 10px 12px; background: var(--amber-light); border: 1px solid var(--amber); border-radius: 8px; font-size: 12.5px; color: #92400E; margin-top: 10px; flex-wrap: wrap; }
    .conflict-approve { margin-left: auto; padding: 4px 12px; border-radius: 6px; border: 1px solid #D97706; background: #D97706; color: #fff; font-size: 12px; font-weight: 600; cursor: pointer; }

    /* Subject Assignments */
    .assign-layout  { display: grid; grid-template-columns: 220px 1fr; gap: 16px; min-height: 500px; }
    .assign-sidebar { background: var(--surface); border: 1px solid var(--border); border-radius: 12px; overflow: hidden; }
    .assign-sidebar-title { padding: 12px 16px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .4px; color: var(--text-4); border-bottom: 1px solid var(--border); background: var(--bg); }
    .assign-class-btn { width: 100%; display: flex; align-items: center; gap: 10px; padding: 10px 14px; background: none; border: none; border-bottom: 1px solid var(--border-light); cursor: pointer; text-align: left; &:last-child { border-bottom: none; } &:hover { background: var(--bg); } &.active { background: var(--blue-light); } }
    .acb-av   { width: 34px; height: 34px; border-radius: 9px; color: #fff; font-size: 11px; font-weight: 700; display: flex; align-items: center; justify-content: center; flex-shrink: 0; text-transform: uppercase; }
    .acb-info { flex: 1; min-width: 0; }
    .acb-name { font-size: 13px; font-weight: 600; color: var(--text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .acb-section { font-size: 11px; color: var(--text-4); }

    .assign-content { background: var(--surface); border: 1px solid var(--border); border-radius: 12px; overflow: hidden; display: flex; flex-direction: column; }
    .assign-placeholder { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px; padding: 60px 20px; text-align: center; color: var(--text-3); }
    .ap-title { font-size: 16px; font-weight: 600; color: var(--text-2); }
    .ap-sub   { font-size: 13px; color: var(--text-4); line-height: 1.5; max-width: 260px; }
    .assign-content-header { padding: 16px 20px; border-bottom: 1px solid var(--border); display: flex; align-items: center; justify-content: space-between; background: var(--bg); }
    .ach-class   { font-size: 18px; font-weight: 700; color: var(--text); display: flex; align-items: center; gap: 8px; }
    .ach-section { font-size: 12px; font-weight: 600; padding: 2px 9px; border-radius: 10px; background: var(--blue-light); color: var(--blue); }
    .ach-sub     { font-size: 12px; color: var(--text-3); margin-top: 2px; }
    .ach-legend  { display: flex; align-items: center; font-size: 11px; color: var(--text-3); }
    .legend-dot  { width: 8px; height: 8px; border-radius: 50%; display: inline-block; margin-right: 5px; &.assigned { background: var(--green); } &.unassigned { background: var(--border); } }

    .cst-table       { flex: 1; }
    .cst-header-row  { display: flex; align-items: center; padding: 8px 20px; background: var(--bg); border-bottom: 1px solid var(--border); font-size: 10.5px; font-weight: 700; text-transform: uppercase; letter-spacing: .4px; color: var(--text-4); }
    .cst-row         { display: flex; align-items: center; padding: 12px 20px; border-bottom: 1px solid var(--border-light); transition: background .1s; &:last-child { border-bottom: none; } &:hover { background: var(--bg); } &.is-assigned { } }
    .cst-h-subject   { flex: 2; display: flex; align-items: center; gap: 12px; }
    .cst-h-teacher   { flex: 3; }
    .cst-h-status    { flex: 1; display: flex; justify-content: flex-end; align-items: center; }
    .subject-color-bar  { width: 4px; height: 36px; border-radius: 3px; flex-shrink: 0; }
    .cst-subject-info   { }
    .cst-subject-name   { font-size: 13px; font-weight: 600; color: var(--text); }
    .cst-subject-code   { font-size: 10.5px; color: var(--text-4); font-family: monospace; margin-top: 1px; }
    .cst-select         { height: 34px; font-size: 13px; width: 100%; max-width: 260px; }
    .btn-save-assign    { padding: 5px 14px; border-radius: 7px; border: none; background: var(--blue); color: #fff; font-size: 12px; font-weight: 600; cursor: pointer; &:hover { background: #1D4ED8; } &:disabled { opacity: .6; cursor: not-allowed; } }
    .saved-tag    { font-size: 12px; font-weight: 600; color: var(--green); }
    .assigned-tag { font-size: 11.5px; font-weight: 600; color: var(--green); background: var(--green-light); padding: 3px 9px; border-radius: 10px; }
    .pending-tag  { font-size: 11.5px; color: var(--text-4); background: var(--bg); padding: 3px 9px; border-radius: 10px; border: 1px solid var(--border); }
    .subject-dot { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; }
    .cst-subject-name { font-size: 13px; font-weight: 500; color: var(--text); }
    .cst-code   { font-size: 10px; color: var(--text-4); font-family: monospace; padding: 1px 5px; background: var(--bg); border-radius: 4px; }
    .cst-teacher-name { font-size: 13px; color: var(--text-2); &.unassigned { color: var(--text-4); font-style: italic; } }

    /* Color swatches */
    .color-row { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 4px; }
    .color-swatch { width: 28px; height: 28px; border-radius: 50%; border: 2px solid transparent; cursor: pointer; &.selected { border-color: var(--text); transform: scale(1.2); } }

    /* Modal */
    .modal-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,.4); z-index: 1000; display: flex; align-items: center; justify-content: center; padding: 20px; }
    .modal { background: var(--surface); border-radius: 14px; width: 100%; max-width: 480px; max-height: 90vh; display: flex; flex-direction: column; box-shadow: 0 20px 60px rgba(0,0,0,.15); &.sm { max-width: 380px; } &.lg { max-width: 640px; } }
    .modal-header { display: flex; align-items: center; justify-content: space-between; padding: 16px 20px; border-bottom: 1px solid var(--border); flex-shrink: 0; }
    .modal-title  { font-size: 16px; font-weight: 700; color: var(--text); }
    .modal-body   { padding: 20px; overflow-y: auto; display: flex; flex-direction: column; gap: 14px; }
    .modal-footer { display: flex; gap: 8px; justify-content: flex-end; padding: 14px 20px; border-top: 1px solid var(--border); flex-shrink: 0; }

    /* Form */
    .field-group { display: flex; flex-direction: column; gap: 5px; }
    .form-row { display: flex; gap: 14px; }
    .fill { flex: 1; }
    .fl   { font-size: 12px; font-weight: 600; color: var(--text-3); }
    .req  { color: var(--red); }
    .fi   { height: 36px; padding: 0 10px; border: 1px solid var(--border); border-radius: 8px; font-size: 13px; background: var(--bg); color: var(--text); outline: none; width: 100%; &:focus { border-color: var(--blue); } }

    /* Buttons */
    .btn-primary { display: flex; align-items: center; gap: 5px; padding: 7px 16px; border-radius: 8px; border: none; background: var(--blue); color: #fff; font-size: 13px; font-weight: 500; cursor: pointer; &:hover:not(:disabled) { background: #1D4ED8; } &:disabled { opacity: .6; cursor: not-allowed; } }
    .btn-outline  { padding: 7px 14px; border-radius: 8px; border: 1px solid var(--border); background: var(--surface); font-size: 13px; color: var(--text-2); cursor: pointer; &.danger { color: var(--red); border-color: var(--red); &:hover { background: var(--red-light); } } }
    .btn-sm { display: flex; align-items: center; gap: 4px; padding: 5px 12px; border-radius: 7px; border: 1px solid var(--border); background: var(--surface); font-size: 12px; color: var(--text-2); cursor: pointer; &:hover { background: var(--bg); } }
    .icon-btn { background: none; border: none; cursor: pointer; color: var(--text-3); padding: 4px; border-radius: 6px; display: flex; align-items: center; &:hover { background: var(--bg); color: var(--text); } &.danger:hover { color: var(--red); } }

    /* States */
    .loading { display: flex; justify-content: center; padding: 40px; }
    .empty-state { display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 60px 20px; color: var(--text-3); text-align: center; font-size: 14px; }
    .empty-sub { font-size: 12px; color: var(--text-4); }
  `],
})
export class TimetableComponent implements OnInit {
  private api   = inject(ApiService);
  private auth  = inject(AuthService);
  private fb    = inject(FormBuilder);
  private snack = inject(MatSnackBar);

  readonly days      = DAYS;
  readonly slotTypes = SLOT_TYPES;
  readonly colorOptions = COLORS;

  activeTab = signal<Tab>('timetables');
  isAdmin   = () => ['owner','principal'].includes(this.auth.user()?.role ?? '');

  // Data
  timetables = signal<any[]>([]);
  templates  = signal<any[]>([]);
  subjects   = signal<any[]>([]);
  teachers   = signal<any[]>([]);
  classes    = signal<any[]>([]);

  // Loading
  ttLoading  = signal(false);
  tplLoading = signal(false);
  subLoading = signal(false);
  saving     = signal(false);

  // Timetable editor
  activeTimetable = signal<any | null>(null);
  activeDay       = signal(1);

  activeDays = computed(() => {
    const tt = this.activeTimetable();
    if (!tt) return DAYS;
    return DAYS.filter(d => tt[d.key + '_template']);
  });

  activeTemplate = computed(() => {
    const tt = this.activeTimetable();
    const day = DAYS.find(d => d.num === this.activeDay());
    if (!tt || !day) return null;
    const tplId = tt[day.key + '_template'];
    return this.templates().find(t => t.id === tplId) ?? null;
  });

  getSlotData(templateSlotId: string, day: number) {
    return this.activeTimetable()?.slots?.find(
      (s: any) => s.template_slot_id === templateSlotId && s.day_of_week === day
    ) ?? null;
  }

  dayName(day: number) { return DAYS.find(d => d.num === day)?.label ?? ''; }

  // Modals
  showCreateTimetable = signal(false);
  showDayTemplates    = signal(false);
  editingSlot         = signal<{ slot: any; day: number } | null>(null);
  showSubjectModal    = signal(false);
  showTemplateModal   = signal(false);
  editingSubject      = signal<any | null>(null);
  editingTemplate     = signal<any | null>(null);
  conflictMsg         = signal('');

  dayTemplateMap: Record<string, string> = {};
  templateSlots: any[] = [];
  slotForm = { slot_type: 'period', subject_id: '', teacher_id: '', notes: '' };

  // Class subject teacher mapping
  classSubjectTeachers = signal<any[]>([]);
  cstLoading           = signal(false);
  cstSaving            = signal(false);

  // Forms
  ttForm = this.fb.group({
    class_id:         ['', Validators.required],
    academic_year:    [this.defaultYear(), Validators.required],
    name:             [''],
    default_template: [''],
  });

  subjectForm = this.fb.group({
    name:        ['', Validators.required],
    code:        [''],
    color:       ['#2563EB'],
    description: [''],
  });

  templateForm = this.fb.group({
    name:        ['', Validators.required],
    description: [''],
    is_default:  [false],
  });

  ngOnInit() {
    this.loadAll();
  }

  loadAll() {
    this.loadTimetables();
    this.loadTemplates();
    this.loadSubjects();
    this.loadTeachers();
    this.loadClasses();
  }

  loadTimetables() {
    this.ttLoading.set(true);
    this.api.get<any>('/timetable').subscribe({
      next: (r: any) => { this.timetables.set(r.data ?? []); this.ttLoading.set(false); },
      error: () => this.ttLoading.set(false),
    });
  }

  loadTemplates() {
    this.tplLoading.set(true);
    this.api.get<any>('/timetable/templates').subscribe({
      next: (r: any) => { this.templates.set(r.data ?? []); this.tplLoading.set(false); },
      error: () => this.tplLoading.set(false),
    });
  }

  loadSubjects() {
    this.subLoading.set(true);
    this.api.get<any>('/timetable/subjects').subscribe({
      next: (r: any) => { this.subjects.set(r.data ?? []); this.subLoading.set(false); },
      error: () => this.subLoading.set(false),
    });
  }

  loadTeachers() {
    this.api.get<any>('/communication/messages/contacts').subscribe({
      next: (r: any) => {
        const all: any[] = Array.isArray(r.data) ? r.data : [];
        // Get IDs of already-assigned teachers to always include them
        const assignedIds = new Set(
          this.classSubjectTeachers().map((row: any) => row.teacher_id).filter(Boolean)
        );
        // Also include current user (contacts excludes self)
        const currentUser = this.auth.user();
        const list = all.filter((s: any) =>
          ['teacher', 'assistant_teacher'].includes(s.role) || assignedIds.has(s.id)
        );
        // Add self if not already in list and is teaching role
        if (currentUser && !list.find((s: any) => s.id === currentUser.id)) {
          if (['teacher','assistant_teacher','principal','owner'].includes(currentUser.role ?? '')) {
            list.unshift({ id: currentUser.id, name: currentUser.name, role: currentUser.role });
          }
        }
        this.teachers.set(list);
      },
      error: () => {},
    });
  }

  loadClasses() {
    this.api.get<any>('/students/classes').subscribe({
      next: (r: any) => this.classes.set(r.data?.items ?? r.data ?? []),
      error: () => {},
    });
  }

  // ── Timetable ────────────────────────────────────────────────────────────────

  openTimetable(tt: any) {
    this.api.get<any>('/timetable/' + tt.id).subscribe({
      next: (r: any) => {
        this.activeTimetable.set(r.data);
        const firstActive = this.activeDays()[0];
        if (firstActive) this.activeDay.set(firstActive.num);
      },
      error: () => {},
    });
  }

  openCreateTimetable() {
    this.ttForm.reset({ academic_year: this.defaultYear() });
    this.showCreateTimetable.set(true);
  }

  createTimetable() {
    if (this.ttForm.invalid) return;
    this.saving.set(true);
    const v = this.ttForm.getRawValue();
    const tplId = v.default_template || null;
    const body: any = {
      class_id: v.class_id, academic_year: v.academic_year, name: v.name || null,
    };
    if (tplId) {
      DAYS.forEach(d => { body[d.key + '_template'] = tplId; });
    }
    this.api.post<any>('/timetable', body).subscribe({
      next: (r: any) => {
        this.saving.set(false);
        this.showCreateTimetable.set(false);
        this.timetables.update(list => [...list, r.data]);
        this.snack.open('Timetable created', 'OK', { duration: 2000 });
        this.openTimetable(r.data);
      },
      error: (err: any) => {
        this.saving.set(false);
        this.snack.open(err.error?.error?.message ?? 'Error', 'OK', { duration: 3000 });
      },
    });
  }

  openDayTemplates() {
    const tt = this.activeTimetable();
    if (!tt) return;
    DAYS.forEach(d => { this.dayTemplateMap[d.key] = tt[d.key + '_template'] ?? ''; });
    this.showDayTemplates.set(true);
  }

  saveDayTemplates() {
    const tt = this.activeTimetable();
    if (!tt) return;
    this.saving.set(true);
    const body: any = {};
    DAYS.forEach(d => { body[d.key + '_template'] = this.dayTemplateMap[d.key] || null; });
    this.api.put<any>('/timetable/' + tt.id, body).subscribe({
      next: (r: any) => {
        this.saving.set(false);
        this.showDayTemplates.set(false);
        this.activeTimetable.set(r.data);
        const firstActive = this.activeDays()[0];
        if (firstActive) this.activeDay.set(firstActive.num);
        this.snack.open('Templates saved', 'OK', { duration: 2000 });
      },
      error: () => { this.saving.set(false); },
    });
  }

  // ── Slot editor ──────────────────────────────────────────────────────────────

  openSlotEditor(slot: any, day: number) {
    const existing = this.getSlotData(slot.id, day);
    this.slotForm = {
      slot_type:  existing?.slot_type ?? slot.slot_type ?? 'period',
      subject_id: existing?.subject_id ?? '',
      teacher_id: existing?.teacher_id ?? '',
      notes:      existing?.notes ?? '',
    };
    this.conflictMsg.set('');
    this.editingSlot.set({ slot, day });
    // Reload teachers if not loaded yet
    if (!this.teachers().length) this.loadTeachers();
  }

  saveSlot(forceApprove: boolean) {
    const es = this.editingSlot();
    const tt = this.activeTimetable();
    if (!es || !tt) return;
    this.saving.set(true);
    this.conflictMsg.set('');
    const body = {
      template_slot_id: es.slot.id,
      day_of_week:      es.day,
      slot_type:        this.slotForm.slot_type,
      subject_id:       this.slotForm.subject_id || null,
      teacher_id:       this.slotForm.teacher_id || null,
      notes:            this.slotForm.notes || null,
      force_approve:    forceApprove,
    };
    this.api.post<any>('/timetable/' + tt.id + '/slots', body).subscribe({
      next: () => {
        this.saving.set(false);
        this.editingSlot.set(null);
        this.snack.open('Slot saved', 'OK', { duration: 2000 });
        this.openTimetable(tt);
      },
      error: (err: any) => {
        this.saving.set(false);
        const msg = err.error?.error?.message ?? 'Error saving slot';
        if (err.status === 409) {
          this.conflictMsg.set(msg);
        } else {
          this.snack.open(msg, 'OK', { duration: 3000 });
        }
      },
    });
  }

  clearSlot() {
    const es = this.editingSlot();
    const tt = this.activeTimetable();
    if (!es || !tt) return;
    this.saving.set(true);
    this.api.delete<any>('/timetable/' + tt.id + '/slots', {
      body: { template_slot_id: es.slot.id, day_of_week: es.day }
    } as any).subscribe({
      next: () => {
        this.saving.set(false);
        this.editingSlot.set(null);
        this.snack.open('Slot cleared', 'OK', { duration: 2000 });
        this.openTimetable(tt);
      },
      error: () => { this.saving.set(false); },
    });
  }

  // ── Subjects ─────────────────────────────────────────────────────────────────

  openCreateSubject() {
    this.editingSubject.set(null);
    this.subjectForm.reset({ color: '#2563EB' });
    this.showSubjectModal.set(true);
  }

  openEditSubject(s: any) {
    this.editingSubject.set(s);
    this.subjectForm.patchValue(s);
    this.showSubjectModal.set(true);
  }

  saveSubject() {
    if (this.subjectForm.invalid) return;
    this.saving.set(true);
    const v = this.subjectForm.getRawValue();
    const req = this.editingSubject()
      ? this.api.put<any>('/timetable/subjects/' + this.editingSubject()!.id, v)
      : this.api.post<any>('/timetable/subjects', v);
    req.subscribe({
      next: (r: any) => {
        this.saving.set(false);
        this.showSubjectModal.set(false);
        this.loadSubjects();
        this.snack.open('Subject saved', 'OK', { duration: 2000 });
      },
      error: (err: any) => {
        this.saving.set(false);
        this.snack.open(err.error?.error?.message ?? 'Error', 'OK', { duration: 3000 });
      },
    });
  }

  // ── Templates ────────────────────────────────────────────────────────────────

  openCreateTemplate() {
    this.editingTemplate.set(null);
    this.templateForm.reset({ is_default: false });
    this.templateSlots = [
      { name: 'Period 1', slot_type: 'period', start_time: '08:00', end_time: '08:45' },
      { name: 'Period 2', slot_type: 'period', start_time: '08:45', end_time: '09:30' },
      { name: 'Break',    slot_type: 'break',  start_time: '09:30', end_time: '10:00' },
    ];
    this.showTemplateModal.set(true);
  }

  openEditTemplate(t: any) {
    this.editingTemplate.set(t);
    this.templateForm.patchValue({ name: t.name, description: t.description, is_default: t.is_default });
    this.templateSlots = (t.slots ?? []).map((s: any) => ({ ...s }));
    this.showTemplateModal.set(true);
  }

  addTemplateSlot() {
    const last = this.templateSlots[this.templateSlots.length - 1];
    this.templateSlots.push({
      name: 'New Period', slot_type: 'period',
      start_time: last?.end_time ?? '08:00',
      end_time:   last?.end_time ?? '08:45',
    });
  }

  removeTemplateSlot(i: number) { this.templateSlots.splice(i, 1); }

  saveTemplate() {
    if (this.templateForm.invalid) return;
    this.saving.set(true);
    const body = { ...this.templateForm.getRawValue(), slots: this.templateSlots };
    const req = this.editingTemplate()
      ? this.api.put<any>('/timetable/templates/' + this.editingTemplate()!.id, body)
      : this.api.post<any>('/timetable/templates', body);
    req.subscribe({
      next: () => {
        this.saving.set(false);
        this.showTemplateModal.set(false);
        this.loadTemplates();
        this.snack.open('Template saved', 'OK', { duration: 2000 });
      },
      error: (err: any) => {
        this.saving.set(false);
        this.snack.open(err.error?.error?.message ?? 'Error', 'OK', { duration: 3000 });
      },
    });
  }

  selectedAssignmentClassId = signal('');
  selectedClassName    = () => this.timetables().find(t => t.class_id === this.selectedAssignmentClassId())?.class_name ?? '';
  selectedClassSection = () => this.timetables().find(t => t.class_id === this.selectedAssignmentClassId())?.class_section ?? '';
  editingCstRow             = signal<string | null>(null);
  cstEditTeacherMap: Record<string, string> = {};

  onAssignmentClassChange(classId: string) {
    this.selectedAssignmentClassId.set(classId);
    if (!classId) { this.classSubjectTeachers.set([]); return; }
    this.cstLoading.set(true);
    this.api.get<any>('/timetable/class/' + classId + '/subjects').subscribe({
      next: (r: any) => {
        this.classSubjectTeachers.set(r.data ?? []);
        this.cstLoading.set(false);
        // Reload teachers to include any already-assigned ones
        this.loadTeachers();
      },
      error: () => this.cstLoading.set(false),
    });
  }

  onSlotSubjectChange(subjectId: string) {
    if (!subjectId || !this.activeTimetable()) return;
    const classId = this.activeTimetable()!.class_id;
    // Auto-fill teacher from class-subject mapping
    this.api.get<any>('/timetable/subject-teacher-lookup', {
      class_id: classId, subject_id: subjectId
    }).subscribe({
      next: (r: any) => {
        if (r.data?.teacher_id && !this.slotForm.teacher_id) {
          this.slotForm.teacher_id = r.data.teacher_id;
        }
      },
      error: () => {},
    });
  }

  onCstChange(row: any, teacherId: string) {
    if (!row.subject_id) return; // guard against null subject_id
    row._saving = true;
    row._saved  = false;
    this.api.post<any>('/timetable/class/' + this.selectedAssignmentClassId() + '/subjects', {
      subject_id: row.subject_id,
      teacher_id: teacherId || null,
    }).subscribe({
      next: () => {
        row.teacher_id   = teacherId || null;
        row.teacher_name = teacherId
          ? (this.teachers().find((t: any) => t.id === teacherId)?.name ?? null)
          : null;
        row._saving = false;
        row._saved  = true;
        setTimeout(() => { row._saved = false; }, 2000);
      },
      error: () => { row._saving = false; },
    });
  }

  getClassColor(name: string): string {
    const colors = ['#2563EB','#7C3AED','#DB2777','#D97706','#059669','#0891B2','#DC2626','#0F766E'];
    return colors[(name?.charCodeAt(0) || 0) % colors.length];
  }

  defaultYear() {
    const y = new Date().getFullYear();
    return new Date().getMonth() >= 5 ? `${y}-${y+1}` : `${y-1}-${y}`;
  }
}
