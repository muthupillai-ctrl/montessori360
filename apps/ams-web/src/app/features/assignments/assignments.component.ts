import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { ApiService } from '../../core/services/api.service';

type ContentType = 'worksheet' | 'lesson_plan' | 'question_paper' | 'curriculum_area';
type ClassLevel  = 'montessori' | 'primary' | 'high_school';

interface AssignmentRow {
  id: string;
  content_type: ContentType;
  content_id: string;
  content_title: string;
  class_id: string | null;
  class_name: string | null;
  student_id: string | null;
  student_name: string | null;
  due_date: string | null;
  assigned_at: string;
}

interface ContentOption { id: string; label: string; grade_level?: string | null; level?: string | null; }
interface ClassOption   { id: string; name: string; level?: ClassLevel | null; }

const CONTENT_CARDS = [
  { value: 'worksheet'       as ContentType, label: 'Worksheet',       description: 'Assign practice worksheets to a class', icon: '📄', bg: '#ede9fe', iconBg: '#7c3aed', textColor: '#5b21b6' },
  { value: 'lesson_plan'     as ContentType, label: 'Lesson Plan',     description: 'Schedule lesson plans for your class',   icon: '📋', bg: '#d1fae5', iconBg: '#059669', textColor: '#065f46' },
  { value: 'question_paper'  as ContentType, label: 'Question Paper',  description: 'Assign assessments and tests',           icon: '📝', bg: '#fef3c7', iconBg: '#d97706', textColor: '#92400e' },
  { value: 'curriculum_area' as ContentType, label: 'Curriculum Area', description: 'Map curriculum areas to your class',     icon: '🗂️', bg: '#dbeafe', iconBg: '#2563eb', textColor: '#1e40af' },
];

const TYPE_BADGE: Record<ContentType, { bg: string; color: string }> = {
  worksheet:       { bg: '#ede9fe', color: '#5b21b6' },
  lesson_plan:     { bg: '#d1fae5', color: '#065f46' },
  question_paper:  { bg: '#fef3c7', color: '#92400e' },
  curriculum_area: { bg: '#dbeafe', color: '#1e40af' },
};

const LEVEL_LABEL: Record<ClassLevel, string> = {
  montessori:  'Montessori',
  primary:     'Primary',
  high_school: 'High School',
};

@Component({
  selector: 'ams-assignments',
  standalone: true,
  imports: [ReactiveFormsModule, MatSnackBarModule],
  template: `
    <!-- ── Part 1: Creation ── -->
    <div class="hero">
      <div class="hero-text">
        <h1 class="hero-title">What would you like to assign today?</h1>
        <p class="hero-sub">Pick a content type to get started</p>
      </div>
      @if (assignments().length) {
        <span class="count-pill">{{ assignments().length }} total assignment{{ assignments().length !== 1 ? 's' : '' }}</span>
      }
    </div>

    <div class="cards-grid">
      @for (card of cards; track card.value) {
        <button class="content-card" [style.background]="card.bg" (click)="openPanel(card.value)">
          <div class="card-icon" [style.background]="card.iconBg">{{ card.icon }}</div>
          <div class="card-body">
            <div class="card-title" [style.color]="card.textColor">{{ card.label }}</div>
            <div class="card-desc">{{ card.description }}</div>
          </div>
          <div class="card-arrow" [style.color]="card.textColor">→</div>
        </button>
      }
    </div>

    <!-- ── Part 2: Existing assignments ── -->
    <div class="section-header">
      <div class="section-title-row">
        <h2 class="section-title">Recent Assignments</h2>
        @if (filtered().length !== assignments().length) {
          <span class="filter-chip">{{ filtered().length }} of {{ assignments().length }}</span>
        }
      </div>
      <div class="filter-bar">
        <select class="filter-select" [value]="filterType()"
                (change)="filterType.set($any($event.target).value)">
          <option value="">All types</option>
          @for (c of cards; track c.value) {
            <option [value]="c.value">{{ c.icon }} {{ c.label }}</option>
          }
        </select>
        <div class="search-wrap">
          <span class="search-icon">🔍</span>
          <input class="search-input" placeholder="Search title or class…"
                 [value]="search()" (input)="search.set($any($event.target).value)" />
        </div>
      </div>
    </div>

    <div class="section-card">
      @if (loading()) {
        <div class="empty-state"><div class="spinner"></div><span>Loading…</span></div>
      } @else if (!filtered().length) {
        <div class="empty-state">
          <span class="empty-icon">📌</span>
          <span class="empty-label">No assignments yet</span>
          @if (assignments().length) {
            <button class="btn-link" (click)="clearFilters()">Clear filters</button>
          } @else {
            <span class="empty-hint">Choose a content type above to assign</span>
          }
        </div>
      } @else {
        <table class="data-table">
          <thead>
            <tr><th>Type</th><th>Content</th><th>Assigned To</th><th>Due Date</th><th>Assigned On</th><th></th></tr>
          </thead>
          <tbody>
            @for (a of filtered(); track a.id) {
              <tr>
                <td>
                  <span class="type-badge"
                        [style.background]="typeBadge(a.content_type).bg"
                        [style.color]="typeBadge(a.content_type).color">
                    {{ typeLabel(a.content_type) }}
                  </span>
                </td>
                <td class="content-title">{{ a.content_title }}</td>
                <td class="cell-muted">{{ a.class_name ?? a.student_name ?? '—' }}</td>
                <td class="cell-muted">{{ a.due_date ? fmtDate(a.due_date) : '—' }}</td>
                <td class="cell-muted">{{ fmtDate(a.assigned_at) }}</td>
                <td class="row-actions">
                  @if (a.content_type === 'worksheet') {
                    <button class="icon-btn" (click)="printWorksheet(a.content_id)" title="Print"
                            [disabled]="printing() === a.content_id">
                      {{ printing() === a.content_id ? '⏳' : '🖨️' }}
                    </button>
                  }
                  <button class="icon-btn danger" (click)="remove(a)" title="Remove">🗑</button>
                </td>
              </tr>
            }
          </tbody>
        </table>
      }
    </div>

    <!-- ── Assign panel ── -->
    @if (panelOpen()) {
      <div class="panel-backdrop" (click)="closePanel()"></div>
      <aside class="side-panel">

        @if (activeCard()) {
          <div class="panel-hero" [style.background]="activeCard()!.bg">
            <div class="panel-hero-icon" [style.background]="activeCard()!.iconBg">{{ activeCard()!.icon }}</div>
            <div>
              <div class="panel-hero-title" [style.color]="activeCard()!.textColor">Assign {{ activeCard()!.label }}</div>
              <div class="panel-hero-sub">{{ activeCard()!.description }}</div>
            </div>
            <button class="panel-close" (click)="closePanel()">✕</button>
          </div>
        }

        <form [formGroup]="form" (ngSubmit)="save()" class="panel-body">

          <!-- Step 1: Class (always first) -->
          <div class="field-group">
            <label class="field-label">Class <span class="required">*</span></label>
            @if (classesLoading()) {
              <div class="loading-row"><div class="spinner-sm"></div> Loading classes…</div>
            } @else if (classOptions().length) {
              <select class="field-input" formControlName="class_id"
                      (change)="onClassSelect($any($event.target).value)">
                <option value="">Select class…</option>
                @for (c of classOptions(); track c.id) {
                  <option [value]="c.id">
                    {{ c.name }}{{ c.level ? ' · ' + levelLabel(c.level) : '' }}
                  </option>
                }
              </select>
            } @else {
              <input class="field-input" formControlName="class_id" placeholder="Enter class name or ID…" />
            }
            @if (form.get('class_id')?.invalid && form.get('class_id')?.touched) {
              <div class="field-error">Class is required</div>
            }
          </div>

          <!-- Step 2: Content (appears after class selected) -->
          @if (form.get('class_id')?.value) {
            <div class="field-group">
              <div class="content-header-row">
                <label class="field-label">{{ activeCard()?.label }} <span class="required">*</span></label>
                @if (selectedType() === 'worksheet' && selectedClassLevel()) {
                  <span class="level-filter-chip">
                    {{ levelLabel(selectedClassLevel()!) }} only
                    @if (showAll()) { · <button type="button" class="btn-link-sm" (click)="showAll.set(false)">reset</button> }
                  </span>
                }
              </div>

              @if (contentLoading()) {
                <div class="loading-row"><div class="spinner-sm"></div> Loading…</div>
              } @else if (!contentOptions().length && selectedType() === 'worksheet' && !showAll()) {
                <div class="no-results-box">
                  <span>No {{ levelLabel(selectedClassLevel()!) }} worksheets found.</span>
                  <button type="button" class="btn-link-sm" (click)="showAllWorksheets()">Show all worksheets →</button>
                </div>
              } @else {
                <select class="field-input" formControlName="content_id"
                        (change)="onContentSelect($any($event.target).value)">
                  <option value="">Select {{ activeCard()?.label?.toLowerCase() }}…</option>
                  @for (c of contentOptions(); track c.id) {
                    <option [value]="c.id">
                      {{ c.label }}{{ c.grade_level ? ' (' + c.grade_level + ')' : '' }}
                    </option>
                  }
                </select>
                @if (form.get('content_id')?.invalid && form.get('content_id')?.touched) {
                  <div class="field-error">Please select a {{ activeCard()?.label?.toLowerCase() }}</div>
                }
              }
            </div>
          }

          <!-- Step 3: Due date -->
          @if (form.get('class_id')?.value) {
            <div class="field-group">
              <label class="field-label">Due Date</label>
              <input class="field-input" type="date" formControlName="due_date" />
            </div>
          }

          <div class="panel-footer">
            <button type="button" class="btn btn-ghost" (click)="closePanel()">Cancel</button>
            <button type="submit" class="btn btn-primary" [disabled]="form.invalid || saving()">
              {{ saving() ? 'Assigning…' : 'Assign' }}
            </button>
          </div>

        </form>
      </aside>
    }
  `,
  styles: [`
    /* ── Hero ── */
    .hero { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 20px; flex-wrap: wrap; gap: 12px; }
    .hero-title { font-size: 20px; font-weight: 700; color: var(--text); margin: 0 0 4px; }
    .hero-sub   { font-size: 13px; color: var(--text-3); margin: 0; }
    .count-pill {
      display: inline-block; padding: 4px 12px; border-radius: 20px;
      background: var(--bg); border: 1px solid var(--border); font-size: 12px; color: var(--text-3);
    }

    /* ── Cards ── */
    .cards-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 28px; }
    .content-card {
      display: flex; align-items: center; gap: 14px; padding: 16px 18px;
      border-radius: 16px; border: none; cursor: pointer; font-family: inherit; text-align: left;
      transition: transform .15s, box-shadow .15s;
      &:hover { transform: translateY(-2px); box-shadow: 0 6px 20px rgba(0,0,0,.10); }
    }
    .card-icon  { width: 44px; height: 44px; border-radius: 12px; flex-shrink: 0; display: flex; align-items: center; justify-content: center; font-size: 20px; color: #fff; }
    .card-body  { flex: 1; min-width: 0; }
    .card-title { font-size: 14px; font-weight: 600; margin-bottom: 2px; }
    .card-desc  { font-size: 11.5px; color: var(--text-3); line-height: 1.4; }
    .card-arrow { font-size: 16px; flex-shrink: 0; opacity: .6; }

    /* ── Section header ── */
    .section-header { margin-bottom: 12px; }
    .section-title-row { display: flex; align-items: center; gap: 10px; margin-bottom: 10px; }
    .section-title { font-size: 15px; font-weight: 600; color: var(--text); margin: 0; }
    .filter-chip { font-size: 11px; color: var(--text-4); background: var(--bg); border: 1px solid var(--border); border-radius: 10px; padding: 2px 8px; }
    .filter-bar  { display: flex; gap: 10px; flex-wrap: wrap; }
    .search-wrap {
      display: flex; align-items: center; gap: 7px; background: #fff; border: 1px solid var(--border);
      border-radius: var(--radius-md); padding: 0 12px; height: 34px; flex: 1; min-width: 180px;
      &:focus-within { border-color: var(--purple); }
    }
    .search-icon  { font-size: 13px; opacity: .5; }
    .search-input { flex: 1; border: none; outline: none; font-size: 13px; color: var(--text); background: transparent; &::placeholder { color: var(--text-4); } }
    .filter-select {
      height: 34px; padding: 0 10px; border-radius: var(--radius-md);
      border: 1px solid var(--border); background: #fff; font-size: 12px;
      color: var(--text-2); font-family: inherit; cursor: pointer;
      &:focus { border-color: var(--purple); outline: none; }
    }

    /* ── Table ── */
    .data-table { width: 100%; border-collapse: collapse; }
    .data-table thead tr { background: var(--bg); }
    .data-table th { padding: 9px 14px; font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: .4px; color: var(--text-4); text-align: left; border-bottom: 1px solid var(--border); }
    .data-table td { padding: 11px 14px; font-size: 12.5px; color: var(--text-2); border-bottom: 1px solid var(--border-light); vertical-align: middle; }
    .data-table tbody tr:last-child td { border-bottom: none; }
    .data-table tbody tr:hover td { background: #fafafa; }
    .content-title { font-weight: 500; color: var(--text); font-size: 13px; }
    .cell-muted  { color: var(--text-3); }
    .row-actions { display: flex; justify-content: flex-end; gap: 4px; }
    .type-badge  { display: inline-block; padding: 3px 9px; border-radius: 10px; font-size: 11px; font-weight: 500; white-space: nowrap; }

    /* ── Empty ── */
    .empty-state  { display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 48px 24px; color: var(--text-3); font-size: 13px; }
    .empty-icon   { font-size: 32px; }
    .empty-label  { font-weight: 500; color: var(--text-2); }
    .empty-hint   { font-size: 12px; }
    .btn-link     { border: none; background: none; color: var(--purple); font-size: 12px; cursor: pointer; font-family: inherit; &:hover { text-decoration: underline; } }
    .btn-link-sm  { border: none; background: none; color: var(--purple); font-size: 11px; cursor: pointer; font-family: inherit; padding: 0; &:hover { text-decoration: underline; } }

    /* ── No results box ── */
    .no-results-box {
      border: 1px dashed var(--border); border-radius: var(--radius-md);
      padding: 14px 16px; font-size: 12px; color: var(--text-3);
      display: flex; flex-direction: column; gap: 6px; align-items: flex-start;
    }

    /* ── Spinner ── */
    .spinner    { width: 24px; height: 24px; border: 2px solid var(--border); border-top-color: var(--purple); border-radius: 50%; animation: spin .7s linear infinite; }
    .spinner-sm { width: 14px; height: 14px; border: 2px solid var(--border); border-top-color: var(--purple); border-radius: 50%; animation: spin .7s linear infinite; flex-shrink: 0; }
    .loading-row { display: flex; align-items: center; gap: 8px; font-size: 12px; color: var(--text-3); }
    @keyframes spin { to { transform: rotate(360deg); } }

    /* ── Buttons ── */
    .btn { height: 34px; padding: 0 16px; border-radius: var(--radius-md); font-size: 12px; font-weight: 500; font-family: inherit; cursor: pointer; border: none; transition: opacity .15s; &:disabled { opacity: .55; cursor: not-allowed; } }
    .btn-primary { background: var(--purple); color: #fff; &:hover:not(:disabled) { opacity: .88; } }
    .btn-ghost   { background: transparent; color: var(--text-2); border: 1px solid var(--border); &:hover { background: var(--bg); } }
    .icon-btn    { border: none; background: transparent; cursor: pointer; padding: 4px 6px; border-radius: 6px; font-size: 14px; opacity: .55; transition: opacity .1s, background .1s; &:hover { opacity: 1; } &:disabled { opacity: .3; cursor: not-allowed; } &.danger:hover { background: var(--red-light); } }

    /* ── Side panel ── */
    .panel-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,.25); z-index: 100; }
    .side-panel     { position: fixed; top: 0; right: 0; bottom: 0; width: 420px; background: #fff; box-shadow: -4px 0 24px rgba(0,0,0,.12); z-index: 101; display: flex; flex-direction: column; }
    .panel-hero     { display: flex; align-items: center; gap: 14px; padding: 20px; flex-shrink: 0; position: relative; border-bottom: 1px solid rgba(0,0,0,.06); }
    .panel-hero-icon  { width: 48px; height: 48px; border-radius: 14px; flex-shrink: 0; display: flex; align-items: center; justify-content: center; font-size: 22px; color: #fff; }
    .panel-hero-title { font-size: 15px; font-weight: 700; margin-bottom: 2px; }
    .panel-hero-sub   { font-size: 12px; color: var(--text-3); }
    .panel-close { position: absolute; top: 14px; right: 14px; border: none; background: rgba(0,0,0,.06); font-size: 14px; cursor: pointer; color: var(--text-3); padding: 4px 7px; border-radius: 8px; &:hover { background: rgba(0,0,0,.1); color: var(--text); } }
    .panel-body  { flex: 1; overflow-y: auto; padding: 20px; display: flex; flex-direction: column; gap: 16px; }
    .panel-footer { display: flex; justify-content: flex-end; gap: 8px; padding-top: 8px; margin-top: auto; }

    /* ── Form ── */
    .field-group { display: flex; flex-direction: column; gap: 5px; }
    .field-label { font-size: 12px; font-weight: 500; color: var(--text-2); }
    .required { color: var(--red); }
    .field-input {
      width: 100%; border: 1px solid var(--border); border-radius: var(--radius-md);
      padding: 7px 10px; font-size: 13px; color: var(--text);
      font-family: inherit; background: #fff; outline: none; transition: border-color .15s;
      &:focus { border-color: var(--purple); box-shadow: 0 0 0 3px rgba(124,58,237,.08); }
    }
    select.field-input { cursor: pointer; }
    .field-error { font-size: 11px; color: var(--red); }
    .content-header-row { display: flex; align-items: center; justify-content: space-between; }
    .level-filter-chip  { font-size: 11px; color: var(--purple); background: #f5f3ff; border: 1px solid #ddd6fe; border-radius: 10px; padding: 2px 8px; display: flex; align-items: center; gap: 4px; }
  `],
})
export class AssignmentsComponent implements OnInit {
  private api   = inject(ApiService);
  private snack = inject(MatSnackBar);
  private fb    = inject(FormBuilder);

  assignments       = signal<AssignmentRow[]>([]);
  loading           = signal(true);
  saving            = signal(false);
  printing          = signal<string | null>(null);
  panelOpen         = signal(false);
  contentOptions    = signal<ContentOption[]>([]);
  contentLoading    = signal(false);
  classOptions      = signal<ClassOption[]>([]);
  classesLoading    = signal(false);
  selectedType      = signal<ContentType | null>(null);
  selectedClassLevel = signal<ClassLevel | null>(null);
  showAll           = signal(false);
  search            = signal('');
  filterType        = signal('');

  cards = CONTENT_CARDS;

  form = this.fb.group({
    content_type:  ['', Validators.required],
    content_id:    ['', Validators.required],
    content_title: ['', Validators.required],
    class_id:      ['', Validators.required],
    class_name:    [''],
    due_date:      [''],
  });

  filtered = computed(() => {
    let list = this.assignments();
    const q = this.search().toLowerCase();
    const t = this.filterType();
    if (t) list = list.filter(a => a.content_type === t);
    if (q) list = list.filter(a =>
      a.content_title.toLowerCase().includes(q) ||
      (a.class_name ?? '').toLowerCase().includes(q) ||
      (a.student_name ?? '').toLowerCase().includes(q)
    );
    return list;
  });

  activeCard = computed(() => CONTENT_CARDS.find(c => c.value === this.selectedType()) ?? null);

  ngOnInit() { this.load(); this.loadClasses(); }

  load() {
    this.loading.set(true);
    this.api.get<{ data: AssignmentRow[] }>('/assignments').subscribe({
      next: res => { this.assignments.set(res.data); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  loadClasses() {
    this.classesLoading.set(true);
    this.api.get<any>('/sis/classes').subscribe({
      next: res => {
        const raw: any[] = Array.isArray(res) ? res : res?.data ?? res?.classes ?? [];
        this.classOptions.set(
          raw.map((c: any) => ({
            id:    c.id ?? c.class_id ?? '',
            name:  c.name ?? c.class_name ?? c.className ?? '',
            level: c.level ?? null,
          })).filter(c => c.id)
        );
        this.classesLoading.set(false);
      },
      error: () => this.classesLoading.set(false),
    });
  }

  openPanel(type: ContentType) {
    this.selectedType.set(type);
    this.selectedClassLevel.set(null);
    this.showAll.set(false);
    this.form.reset({ content_type: type });
    this.contentOptions.set([]);
    this.panelOpen.set(true);
  }

  closePanel() { this.panelOpen.set(false); this.selectedType.set(null); }

  clearFilters() { this.search.set(''); this.filterType.set(''); }

  onClassSelect(id: string) {
    const cls = this.classOptions().find(c => c.id === id);
    this.selectedClassLevel.set(cls?.level ?? null);
    this.showAll.set(false);
    this.form.patchValue({ class_name: cls?.name ?? '', content_id: '', content_title: '' });
    const type = this.selectedType();
    if (type) this.loadContent(type, cls?.level ?? null, false);
  }

  loadContent(type: ContentType, classLevel: ClassLevel | null, ignoreLevel: boolean) {
    this.contentLoading.set(true);
    this.contentOptions.set([]);

    const path   = type === 'curriculum_area' ? '/curriculum/areas'
                 : type === 'lesson_plan'     ? '/lesson-plans'
                 : type === 'question_paper'  ? '/question-papers'
                 :                              '/worksheets';
    const params: Record<string, string> = {};
    if (type === 'worksheet' && classLevel && !ignoreLevel) {
      params['level'] = classLevel;
    }

    this.api.get<{ data: any[] }>(path, params).subscribe({
      next: res => {
        this.contentOptions.set((res.data ?? []).map((x: any) => ({
          id:          x.id,
          label:       x.title ?? x.name ?? x.id,
          grade_level: x.grade_level ?? null,
          level:       x.level ?? null,
        })));
        this.contentLoading.set(false);
      },
      error: () => this.contentLoading.set(false),
    });
  }

  showAllWorksheets() {
    this.showAll.set(true);
    const level = this.selectedClassLevel();
    const type  = this.selectedType();
    if (type) this.loadContent(type, level, true);
  }

  onContentSelect(id: string) {
    const opt = this.contentOptions().find(c => c.id === id);
    this.form.patchValue({ content_title: opt?.label ?? '' });
  }

  save() {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    const v = this.form.value;
    const dto: Record<string, unknown> = {
      content_type:  v.content_type,
      content_id:    v.content_id,
      content_title: v.content_title,
      class_id:      v.class_id  || undefined,
      class_name:    v.class_name || undefined,
    };
    if (v.due_date) dto['due_date'] = v.due_date;

    this.saving.set(true);
    this.api.post<{ data: AssignmentRow }>('/assignments', dto).subscribe({
      next: res => {
        this.assignments.update(list => [res.data, ...list]);
        this.saving.set(false);
        this.panelOpen.set(false);
        this.snack.open('Assigned successfully', '', { duration: 2500 });
      },
      error: () => {
        this.saving.set(false);
        this.snack.open('Failed to assign. Please try again.', '', { duration: 3000 });
      },
    });
  }

  remove(a: AssignmentRow) {
    if (!confirm(`Remove assignment of "${a.content_title}"?`)) return;
    this.api.delete(`/assignments/${a.id}`).subscribe({
      next: () => {
        this.assignments.update(list => list.filter(x => x.id !== a.id));
        this.snack.open('Assignment removed', '', { duration: 2500 });
      },
      error: () => this.snack.open('Failed to remove', '', { duration: 3000 }),
    });
  }

  printWorksheet(contentId: string) {
    this.printing.set(contentId);
    this.api.get<{ data: { title: string; content_html: string | null } }>(`/worksheets/${contentId}`).subscribe({
      next: res => {
        this.printing.set(null);
        const { title, content_html } = res.data;
        if (!content_html) {
          this.snack.open('No printable content for this worksheet', '', { duration: 3000 });
          return;
        }
        const win = window.open('', '_blank');
        if (!win) { this.snack.open('Allow pop-ups to print', '', { duration: 3000 }); return; }
        win.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${title}</title>
          <style>
            * { box-sizing: border-box; }
            body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 24px; color: #1f2937; }
            @media print { body { padding: 0; } @page { margin: 1.5cm; } }
          </style></head><body>${content_html}</body></html>`);
        win.document.close();
        win.focus();
        win.print();
      },
      error: () => { this.printing.set(null); this.snack.open('Failed to load worksheet', '', { duration: 3000 }); },
    });
  }

  typeLabel(type: ContentType): string { return CONTENT_CARDS.find(c => c.value === type)?.label ?? type; }
  typeBadge(type: ContentType) { return TYPE_BADGE[type] ?? { bg: '#f3f4f6', color: '#374151' }; }
  levelLabel(level: ClassLevel): string { return LEVEL_LABEL[level] ?? level; }

  fmtDate(iso: string): string {
    return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  }
}
