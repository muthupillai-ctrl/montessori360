import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { ApiService } from '../../core/services/api.service';

interface SisStudent { id: string; first_name: string; last_name: string; class_name?: string; }
interface ProgressRow {
  activity_id: string; activity_name: string; activity_sequence: number;
  area_id: string; area_name: string; area_icon: string; area_color: string; area_sequence: number;
  status: 'not_started' | 'introduced' | 'practicing' | 'mastered';
  notes?: string; introduced_at?: string; practiced_at?: string; mastered_at?: string;
}
interface AreaGroup { id: string; name: string; icon: string; color: string; sequence: number; activities: ProgressRow[]; }

const STATUS_CYCLE: Record<string, string> = {
  not_started: 'introduced',
  introduced:  'practicing',
  practicing:  'mastered',
  mastered:    'not_started',
};
const STATUS_LABEL: Record<string, string> = {
  not_started: '○', introduced: 'I', practicing: 'P', mastered: '✓',
};
const STATUS_TITLE: Record<string, string> = {
  not_started: 'Not started', introduced: 'Introduced', practicing: 'Practicing', mastered: 'Mastered',
};

@Component({
  selector: 'ams-progress',
  standalone: true,
  imports: [FormsModule, MatSnackBarModule],
  template: `
<div class="page-header">
  <div>
    <h1>Activity Progress</h1>
    <p class="page-sub">Track each child's Montessori curriculum progress</p>
  </div>
</div>

<!-- ── Student picker ── -->
<div class="student-bar">
  <div class="search-wrap">
    <span class="search-icon">🔍</span>
    <input class="search-input" [(ngModel)]="search" placeholder="Search student…" (input)="onSearch()" />
  </div>

  <div class="student-list">
    @for (s of filteredStudents(); track s.id) {
      <button class="student-chip" [class.active]="selectedId() === s.id" (click)="selectStudent(s)">
        <div class="chip-av">{{ initials(s) }}</div>
        <div class="chip-text">
          <div class="chip-name">{{ s.first_name }} {{ s.last_name }}</div>
          @if (s.class_name) { <div class="chip-class">{{ s.class_name }}</div> }
        </div>
      </button>
    }
    @if (!studentsLoading() && !filteredStudents().length) {
      <div class="no-students">No students found</div>
    }
    @if (studentsLoading()) {
      <div class="no-students">Loading…</div>
    }
  </div>
</div>

<!-- ── Progress grid ── -->
@if (!selectedId()) {
  <div class="empty-state">
    <div class="empty-icon">👶</div>
    <div class="empty-title">Select a student</div>
    <div class="empty-sub">Choose a child from the list above to view and update their curriculum progress.</div>
  </div>
}

@if (selectedId() && progressLoading()) {
  <div class="empty-state"><div class="spinner"></div></div>
}

@if (selectedId() && !progressLoading()) {
  <div class="progress-header">
    <div class="selected-name">
      <div class="sel-av">{{ initials(selectedStudent()!) }}</div>
      <div>
        <div class="sel-name">{{ selectedStudent()!.first_name }} {{ selectedStudent()!.last_name }}</div>
        @if (selectedStudent()!.class_name) {
          <div class="sel-class">{{ selectedStudent()!.class_name }}</div>
        }
      </div>
    </div>
    <div class="legend">
      <span class="dot dot-not_started"></span> Not started
      <span class="dot dot-introduced"></span> Introduced
      <span class="dot dot-practicing"></span> Practicing
      <span class="dot dot-mastered"></span> Mastered
    </div>
  </div>

  @for (group of areaGroups(); track group.id) {
    <div class="area-section">
      <div class="area-heading">
        <span class="area-icon" [style.background]="group.color">{{ group.icon }}</span>
        <span class="area-heading-name">{{ group.name }}</span>
        <div class="area-stats">
          <span class="stat-chip stat-mastered">{{ countByStatus(group, 'mastered') }} mastered</span>
          <span class="stat-chip stat-practicing">{{ countByStatus(group, 'practicing') }} practicing</span>
          <span class="stat-chip stat-introduced">{{ countByStatus(group, 'introduced') }} introduced</span>
        </div>
      </div>

      <div class="activity-grid">
        @for (act of group.activities; track act.activity_id) {
          <div class="act-tile" [class]="'act-' + act.status" (click)="cycleStatus(act)" [title]="act.activity_name + ' — ' + statusTitle(act.status) + ' (click to advance)'">
            <div class="act-status-dot" [class]="'dot-' + act.status">{{ statusLabel(act.status) }}</div>
            <div class="act-name">{{ act.activity_name }}</div>
          </div>
        }
      </div>
    </div>
  }

  @if (!areaGroups().length) {
    <div class="empty-state">
      <div class="empty-icon">🗂️</div>
      <div class="empty-title">No curriculum loaded</div>
      <div class="empty-sub">Go to the Curriculum page and load the default curriculum first.</div>
    </div>
  }
}

<!-- ── Notes panel ── -->
@if (notesPanel()) {
  <div class="backdrop" (click)="closeNotes()"></div>
  <div class="notes-panel">
    <div class="panel-header">
      <h3>{{ notesActivity()?.activity_name }}</h3>
      <button class="panel-close" (click)="closeNotes()">✕</button>
    </div>
    <div class="panel-body">
      <label>Status</label>
      <div class="status-tabs">
        @for (s of statusOptions; track s.value) {
          <button class="status-tab" [class.active]="notesStatus() === s.value" (click)="notesStatus.set(s.value)">
            {{ s.label }}
          </button>
        }
      </div>
      <label>Notes</label>
      <textarea [(ngModel)]="notesText" rows="4" placeholder="Observation notes…"></textarea>
    </div>
    <div class="panel-footer">
      <button class="btn btn-outline" (click)="closeNotes()">Cancel</button>
      <button class="btn btn-primary" (click)="saveNotes()" [disabled]="notesSaving()">
        {{ notesSaving() ? 'Saving…' : 'Save' }}
      </button>
    </div>
  </div>
}
  `,
  styles: [`
    :host { display: block; }

    .page-header { margin-bottom: 16px; }
    h1 { font-size: 18px; font-weight: 600; margin: 0 0 2px; }
    .page-sub { font-size: 12px; color: var(--muted); margin: 0; }

    /* ── Student bar ── */
    .student-bar {
      background: #fff; border: 1px solid var(--border);
      border-radius: 8px; padding: 12px 14px; margin-bottom: 16px;
    }
    .search-wrap {
      display: flex; align-items: center; gap: 8px;
      border: 1px solid var(--border); border-radius: 6px;
      padding: 6px 10px; margin-bottom: 10px;
    }
    .search-icon { font-size: 13px; }
    .search-input { border: none; outline: none; font-size: 13px; flex: 1; background: none; }

    .student-list { display: flex; flex-wrap: wrap; gap: 6px; }
    .student-chip {
      display: flex; align-items: center; gap: 7px;
      padding: 5px 10px 5px 5px; border-radius: 20px;
      border: 1px solid var(--border); background: #fff;
      cursor: pointer; transition: all .12s; font-size: 12px;
      &:hover { border-color: var(--purple); background: #f5f3ff; }
      &.active { border-color: var(--purple); background: #ede9fe; }
    }
    .chip-av {
      width: 26px; height: 26px; border-radius: 50%;
      background: var(--purple); color: #fff;
      font-size: 10px; font-weight: 600;
      display: flex; align-items: center; justify-content: center; flex-shrink: 0;
    }
    .chip-name { font-weight: 500; line-height: 1.2; }
    .chip-class { font-size: 10px; color: var(--muted); }
    .no-students { font-size: 12px; color: var(--muted); padding: 6px 0; }

    /* ── Progress header ── */
    .progress-header {
      display: flex; align-items: center; justify-content: space-between;
      flex-wrap: wrap; gap: 12px; margin-bottom: 14px;
      background: #fff; border: 1px solid var(--border);
      border-radius: 8px; padding: 12px 14px;
    }
    .selected-name { display: flex; align-items: center; gap: 10px; }
    .sel-av {
      width: 36px; height: 36px; border-radius: 9px;
      background: var(--purple); color: #fff; font-size: 13px; font-weight: 600;
      display: flex; align-items: center; justify-content: center; flex-shrink: 0;
    }
    .sel-name { font-size: 13px; font-weight: 600; }
    .sel-class { font-size: 11px; color: var(--muted); }
    .legend { display: flex; align-items: center; gap: 12px; font-size: 11px; color: var(--muted); flex-wrap: wrap; }

    /* ── Status dots ── */
    .dot {
      display: inline-block; width: 10px; height: 10px; border-radius: 50%;
    }
    .dot-not_started { background: #e5e7eb; border: 1.5px solid #d1d5db; }
    .dot-introduced  { background: #fde68a; border: 1.5px solid #f59e0b; }
    .dot-practicing  { background: #a5f3fc; border: 1.5px solid #0891b2; }
    .dot-mastered    { background: #86efac; border: 1.5px solid #16a34a; }

    /* ── Area section ── */
    .area-section { margin-bottom: 16px; }
    .area-heading {
      display: flex; align-items: center; gap: 10px;
      margin-bottom: 8px; flex-wrap: wrap;
    }
    .area-icon {
      width: 30px; height: 30px; border-radius: 7px; flex-shrink: 0;
      display: flex; align-items: center; justify-content: center; font-size: 15px;
    }
    .area-heading-name { font-size: 13px; font-weight: 600; flex: 1; }
    .area-stats { display: flex; gap: 6px; flex-wrap: wrap; }
    .stat-chip {
      font-size: 10px; padding: 2px 8px; border-radius: 20px; font-weight: 500;
    }
    .stat-mastered  { background: #dcfce7; color: #15803d; }
    .stat-practicing { background: #cffafe; color: #0e7490; }
    .stat-introduced { background: #fef9c3; color: #a16207; }

    /* ── Activity grid ── */
    .activity-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
      gap: 6px;
    }
    .act-tile {
      background: #fff; border: 1.5px solid var(--border);
      border-radius: 8px; padding: 9px 10px;
      cursor: pointer; transition: all .12s;
      display: flex; flex-direction: column; gap: 5px;
      &:hover { border-color: var(--purple); transform: translateY(-1px); }
    }
    .act-not_started { border-color: #e5e7eb; }
    .act-introduced  { border-color: #fbbf24; background: #fffbeb; }
    .act-practicing  { border-color: #22d3ee; background: #ecfeff; }
    .act-mastered    { border-color: #4ade80; background: #f0fdf4; }

    .act-status-dot {
      width: 22px; height: 22px; border-radius: 50%; flex-shrink: 0;
      display: flex; align-items: center; justify-content: center;
      font-size: 10px; font-weight: 700;
    }
    .act-name { font-size: 11px; line-height: 1.35; }

    /* ── Empty ── */
    .empty-state {
      text-align: center; padding: 60px 20px; color: var(--muted);
      .spinner {
        width: 28px; height: 28px; border: 3px solid var(--border);
        border-top-color: var(--purple); border-radius: 50%;
        animation: spin .7s linear infinite; margin: 0 auto;
      }
    }
    @keyframes spin { to { transform: rotate(360deg); } }
    .empty-icon { font-size: 36px; margin-bottom: 8px; }
    .empty-title { font-size: 14px; font-weight: 500; color: var(--text); margin-bottom: 4px; }
    .empty-sub { font-size: 12px; max-width: 340px; margin: 0 auto; }

    /* ── Notes panel ── */
    .backdrop {
      position: fixed; inset: 0; background: rgba(0,0,0,.35); z-index: 100;
    }
    .notes-panel {
      position: fixed; top: 0; right: 0; height: 100vh; width: 340px;
      background: #fff; z-index: 101; display: flex; flex-direction: column;
      box-shadow: -4px 0 24px rgba(0,0,0,.12);
    }
    .panel-header {
      display: flex; align-items: center; justify-content: space-between;
      padding: 16px 20px; border-bottom: 1px solid var(--border); flex-shrink: 0;
      h3 { margin: 0; font-size: 13px; font-weight: 600; }
    }
    .panel-close {
      background: none; border: none; cursor: pointer; font-size: 16px;
      color: var(--muted); padding: 4px 8px; border-radius: 5px;
      &:hover { background: var(--bg); }
    }
    .panel-body {
      flex: 1; overflow-y: auto; padding: 18px 20px;
      display: flex; flex-direction: column; gap: 10px;
      label { font-size: 11px; font-weight: 500; color: var(--muted); margin-bottom: 3px; display: block; }
      textarea {
        width: 100%; box-sizing: border-box;
        border: 1px solid var(--border); border-radius: 6px;
        padding: 7px 10px; font-size: 13px; color: var(--text);
        &:focus { outline: none; border-color: var(--purple); }
        resize: vertical;
      }
    }
    .status-tabs { display: flex; gap: 6px; flex-wrap: wrap; }
    .status-tab {
      padding: 5px 12px; border-radius: 20px; font-size: 12px;
      border: 1.5px solid var(--border); background: #fff; cursor: pointer;
      &.active { border-color: var(--purple); background: #ede9fe; color: var(--purple); font-weight: 500; }
    }
    .panel-footer {
      padding: 14px 20px; border-top: 1px solid var(--border);
      display: flex; justify-content: flex-end; gap: 8px;
    }
    .btn { padding: 7px 16px; border-radius: 6px; font-size: 13px; cursor: pointer; border: none; }
    .btn-primary { background: var(--purple); color: #fff; &:hover { opacity:.9; } &:disabled { opacity:.6; } }
    .btn-outline { background: #fff; border: 1px solid var(--border); color: var(--text); &:hover { background: var(--bg); } }
  `],
})
export class ProgressComponent implements OnInit {
  private api   = inject(ApiService);
  private snack = inject(MatSnackBar);

  students        = signal<SisStudent[]>([]);
  studentsLoading = signal(true);
  search          = '';

  selectedId      = signal<string | null>(null);
  selectedStudent = signal<SisStudent | null>(null);
  progress        = signal<ProgressRow[]>([]);
  progressLoading = signal(false);

  notesPanel    = signal(false);
  notesActivity = signal<ProgressRow | null>(null);
  notesStatus   = signal<string>('not_started');
  notesText     = '';
  notesSaving   = signal(false);

  statusOptions = [
    { value: 'not_started', label: 'Not started' },
    { value: 'introduced',  label: 'Introduced'  },
    { value: 'practicing',  label: 'Practicing'  },
    { value: 'mastered',    label: 'Mastered'    },
  ];

  filteredStudents = computed(() => {
    const q = this.search.toLowerCase().trim();
    if (!q) return this.students();
    return this.students().filter(s =>
      `${s.first_name} ${s.last_name}`.toLowerCase().includes(q));
  });

  areaGroups = computed<AreaGroup[]>(() => {
    const map: Record<string, AreaGroup> = {};
    for (const row of this.progress()) {
      if (!map[row.area_id]) {
        map[row.area_id] = { id: row.area_id, name: row.area_name, icon: row.area_icon, color: row.area_color, sequence: row.area_sequence, activities: [] };
      }
      map[row.area_id].activities.push(row);
    }
    return Object.values(map).sort((a, b) => a.sequence - b.sequence);
  });

  initials(s: SisStudent) {
    return `${s.first_name[0] ?? ''}${s.last_name[0] ?? ''}`.toUpperCase();
  }
  statusLabel(s: string) { return STATUS_LABEL[s] ?? '?'; }
  statusTitle(s: string) { return STATUS_TITLE[s] ?? s; }
  countByStatus(g: AreaGroup, status: string) {
    return g.activities.filter(a => a.status === status).length;
  }

  ngOnInit() {
    // Load students from SIS proxy endpoint
    this.api.get<SisStudent[]>('/sis/students').subscribe({
      next: rows => { this.students.set(rows); this.studentsLoading.set(false); },
      error: () => this.studentsLoading.set(false),
    });
  }

  onSearch() {}

  selectStudent(s: SisStudent) {
    this.selectedId.set(s.id);
    this.selectedStudent.set(s);
    this.loadProgress(s.id);
  }

  loadProgress(studentId: string) {
    this.progressLoading.set(true);
    this.api.get<ProgressRow[]>(`/curriculum/progress/${studentId}`).subscribe({
      next: rows => { this.progress.set(rows); this.progressLoading.set(false); },
      error: () => this.progressLoading.set(false),
    });
  }

  cycleStatus(act: ProgressRow) {
    const next = STATUS_CYCLE[act.status];
    const studentId = this.selectedId()!;
    // Optimistic update
    this.progress.update(rows =>
      rows.map(r => r.activity_id === act.activity_id ? { ...r, status: next as any } : r));
    this.api.put<ProgressRow>(`/curriculum/progress/${studentId}/${act.activity_id}`, { status: next }).subscribe({
      error: () => {
        // revert on failure
        this.progress.update(rows =>
          rows.map(r => r.activity_id === act.activity_id ? { ...r, status: act.status } : r));
        this.snack.open('Failed to update status', '', { duration: 3000 });
      },
    });
  }

  openNotes(act: ProgressRow) {
    this.notesActivity.set(act);
    this.notesStatus.set(act.status);
    this.notesText = act.notes ?? '';
    this.notesPanel.set(true);
  }

  saveNotes() {
    this.notesSaving.set(true);
    const act = this.notesActivity()!;
    const studentId = this.selectedId()!;
    this.api.put<ProgressRow>(`/curriculum/progress/${studentId}/${act.activity_id}`, {
      status: this.notesStatus(), notes: this.notesText || null,
    }).subscribe({
      next: updated => {
        this.progress.update(rows =>
          rows.map(r => r.activity_id === act.activity_id ? { ...r, ...updated } : r));
        this.snack.open('Progress saved', '', { duration: 2000 });
        this.closeNotes();
      },
      error: () => { this.notesSaving.set(false); this.snack.open('Save failed', '', { duration: 3000 }); },
    });
  }

  closeNotes() {
    this.notesPanel.set(false);
    this.notesSaving.set(false);
    this.notesActivity.set(null);
  }
}
