import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { ApiService } from '../../core/services/api.service';

interface QuestionPaperRow {
  id: string;
  title: string;
  subject: string | null;
  grade_level: string | null;
  topic: string | null;
  total_marks: number | null;
  duration_minutes: number | null;
  source: 'manual' | 'generated';
  is_published: boolean;
  created_at: string;
}

const QUESTION_TYPES = ['Multiple Choice', 'Short Answer', 'Long Answer', 'Fill in the Blank', 'Match the Following', 'True/False', 'Diagram'];

@Component({
  selector: 'ams-question-papers',
  standalone: true,
  imports: [ReactiveFormsModule, MatSnackBarModule],
  template: `
    <div class="page-header">
      <div>
        <h1>Question Papers</h1>
        <div class="subtitle">{{ filtered().length }} of {{ papers().length }} question paper{{ papers().length !== 1 ? 's' : '' }}</div>
      </div>
      <div class="actions">
        <button class="btn btn-ai" (click)="openGenerate()">✨ Generate with AI</button>
        <button class="btn btn-primary" (click)="openCreate()">+ New Paper</button>
      </div>
    </div>

    <!-- Filters -->
    <div class="filter-bar">
      <div class="search-wrap">
        <span class="search-icon">🔍</span>
        <input class="search-input" placeholder="Search title or topic…"
               [value]="search()" (input)="search.set($any($event.target).value)" />
      </div>
      <select class="filter-select" [value]="filterSubject()"
              (change)="filterSubject.set($any($event.target).value)">
        <option value="">All subjects</option>
        @for (s of subjects; track s) { <option [value]="s">{{ s }}</option> }
      </select>
      <select class="filter-select" [value]="filterSource()"
              (change)="filterSource.set($any($event.target).value)">
        <option value="">All sources</option>
        <option value="generated">AI Generated</option>
        <option value="manual">Manual</option>
      </select>
    </div>

    <!-- List -->
    <div class="section-card">
      @if (loading()) {
        <div class="empty-state">
          <div class="spinner"></div>
          <span>Loading…</span>
        </div>
      } @else if (!filtered().length) {
        <div class="empty-state">
          <span style="font-size:32px">📝</span>
          <span>No question papers found</span>
          @if (papers().length) {
            <button class="btn-link" (click)="clearFilters()">Clear filters</button>
          } @else {
            <button class="btn btn-ai" (click)="openGenerate()">✨ Generate your first paper</button>
          }
        </div>
      } @else {
        <table class="data-table">
          <thead>
            <tr>
              <th>Title / Topic</th>
              <th>Subject</th>
              <th>Grade</th>
              <th>Marks</th>
              <th>Duration</th>
              <th>Source</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            @for (p of filtered(); track p.id) {
              <tr>
                <td>
                  <div class="item-title">{{ p.title }}</div>
                  @if (p.topic) { <div class="item-sub">{{ p.topic }}</div> }
                </td>
                <td>{{ p.subject ?? '—' }}</td>
                <td>{{ p.grade_level ?? '—' }}</td>
                <td>{{ p.total_marks ?? '—' }}</td>
                <td>{{ p.duration_minutes ? p.duration_minutes + ' min' : '—' }}</td>
                <td>
                  <span class="badge" [class.badge-ai]="p.source === 'generated'">
                    {{ p.source === 'generated' ? '✨ AI' : 'Manual' }}
                  </span>
                </td>
                <td>
                  <span class="badge" [class.badge-published]="p.is_published" [class.badge-draft]="!p.is_published">
                    {{ p.is_published ? 'Published' : 'Draft' }}
                  </span>
                </td>
                <td class="row-actions">
                  <button class="icon-btn" (click)="openEdit(p)" title="Edit">✏️</button>
                  <button class="icon-btn danger" (click)="remove(p)" title="Delete">🗑</button>
                </td>
              </tr>
            }
          </tbody>
        </table>
      }
    </div>

    <!-- Side panel -->
    @if (panelOpen()) {
      <div class="panel-backdrop" (click)="closePanel()"></div>
      <aside class="side-panel">
        <div class="panel-header">
          <span class="panel-title">
            {{ mode() === 'generate' ? '✨ Generate Question Paper' : (editing() ? 'Edit Paper' : 'New Paper') }}
          </span>
          <button class="panel-close" (click)="closePanel()">✕</button>
        </div>

        @if (mode() === 'generate') {
          <form [formGroup]="genForm" (ngSubmit)="generate()" class="panel-body">
            <div class="ai-banner">
              <span>✨</span>
              <span>Describe what you need and Claude will create a complete question paper with answer key.</span>
            </div>

            <div class="field-group">
              <label class="field-label">Subject <span class="required">*</span></label>
              <select class="field-input" formControlName="subject">
                <option value="">Select subject</option>
                @for (s of subjects; track s) { <option [value]="s">{{ s }}</option> }
              </select>
            </div>

            <div class="field-row">
              <div class="field-group">
                <label class="field-label">Grade Level <span class="required">*</span></label>
                <input class="field-input" formControlName="grade_level" placeholder="e.g. Grade 4" />
              </div>
              <div class="field-group">
                <label class="field-label">Total Marks</label>
                <input class="field-input" type="number" formControlName="total_marks" placeholder="50" />
              </div>
            </div>

            <div class="field-row">
              <div class="field-group">
                <label class="field-label">Topic <span class="required">*</span></label>
                <input class="field-input" formControlName="topic" placeholder="e.g. Fractions" />
              </div>
              <div class="field-group">
                <label class="field-label">Duration (min)</label>
                <input class="field-input" type="number" formControlName="duration_minutes" placeholder="60" />
              </div>
            </div>

            <div class="field-group">
              <label class="field-label">Question Types</label>
              <div class="checkbox-list">
                @for (qt of questionTypes; track qt) {
                  <label class="checkbox-item">
                    <input type="checkbox" [value]="qt" (change)="toggleQType(qt, $event)" />
                    <span>{{ qt }}</span>
                  </label>
                }
              </div>
            </div>

            <div class="field-group">
              <label class="field-label">Difficulty Distribution</label>
              <input class="field-input" formControlName="difficulty_distribution"
                     placeholder="e.g. 40% easy, 40% medium, 20% hard" />
            </div>

            <div class="panel-footer">
              <button type="button" class="btn btn-ghost" (click)="closePanel()">Cancel</button>
              <button type="submit" class="btn btn-ai" [disabled]="genForm.invalid || saving()">
                {{ saving() ? '✨ Generating…' : '✨ Generate' }}
              </button>
            </div>
          </form>
        } @else {
          <form [formGroup]="form" (ngSubmit)="save()" class="panel-body">

            <div class="field-group">
              <label class="field-label">Title <span class="required">*</span></label>
              <input class="field-input" formControlName="title" placeholder="e.g. Maths Unit Test" />
            </div>

            <div class="field-row">
              <div class="field-group">
                <label class="field-label">Subject</label>
                <select class="field-input" formControlName="subject">
                  <option value="">Select subject</option>
                  @for (s of subjects; track s) { <option [value]="s">{{ s }}</option> }
                </select>
              </div>
              <div class="field-group">
                <label class="field-label">Grade Level</label>
                <input class="field-input" formControlName="grade_level" placeholder="e.g. Grade 4" />
              </div>
            </div>

            <div class="field-row">
              <div class="field-group">
                <label class="field-label">Topic</label>
                <input class="field-input" formControlName="topic" placeholder="e.g. Fractions" />
              </div>
              <div class="field-group">
                <label class="field-label">Total Marks</label>
                <input class="field-input" type="number" formControlName="total_marks" />
              </div>
            </div>

            <div class="field-group">
              <label class="toggle-row">
                <div>
                  <div class="field-label" style="margin-bottom:2px">Published</div>
                  <div class="field-sub">Visible to all teachers</div>
                </div>
                <label class="toggle">
                  <input type="checkbox" formControlName="is_published" />
                  <span class="toggle-track"></span>
                </label>
              </label>
            </div>

            <div class="panel-footer">
              <button type="button" class="btn btn-ghost" (click)="closePanel()">Cancel</button>
              <button type="submit" class="btn btn-primary" [disabled]="form.invalid || saving()">
                {{ saving() ? 'Saving…' : (editing() ? 'Save Changes' : 'Create') }}
              </button>
            </div>
          </form>
        }
      </aside>
    }
  `,
  styles: [`
    .filter-bar { display: flex; gap: 10px; margin-bottom: 16px; flex-wrap: wrap; }
    .search-wrap {
      display: flex; align-items: center; gap: 7px;
      background: #fff; border: 1px solid var(--border); border-radius: var(--radius-md);
      padding: 0 12px; height: 34px; flex: 1; min-width: 200px;
      &:focus-within { border-color: var(--purple); }
    }
    .search-icon { font-size: 13px; opacity: .5; }
    .search-input {
      flex: 1; border: none; outline: none; font-size: 13px; color: var(--text); background: transparent;
      &::placeholder { color: var(--text-4); }
    }
    .filter-select {
      height: 34px; padding: 0 10px; border-radius: var(--radius-md);
      border: 1px solid var(--border); background: #fff;
      font-size: 12px; color: var(--text-2); font-family: inherit; cursor: pointer; outline: none;
      &:focus { border-color: var(--purple); }
    }

    .data-table { width: 100%; border-collapse: collapse; }
    .data-table thead tr { background: var(--bg); }
    .data-table th {
      padding: 9px 14px; font-size: 10px; font-weight: 600;
      text-transform: uppercase; letter-spacing: .4px; color: var(--text-4); text-align: left;
      border-bottom: 1px solid var(--border);
    }
    .data-table td {
      padding: 10px 14px; font-size: 12.5px; color: var(--text-2);
      border-bottom: 1px solid var(--border-light); vertical-align: middle;
    }
    .data-table tbody tr:last-child td { border-bottom: none; }
    .data-table tbody tr:hover td { background: #fafafa; }

    .item-title { font-weight: 500; color: var(--text); font-size: 13px; }
    .item-sub { font-size: 11px; color: var(--text-4); margin-top: 2px; }
    .row-actions { display: flex; gap: 4px; justify-content: flex-end; }
    .icon-btn {
      border: none; background: transparent; cursor: pointer; padding: 4px 6px;
      border-radius: 6px; font-size: 14px; opacity: .6; transition: opacity .1s, background .1s;
      &:hover { opacity: 1; background: var(--bg); }
      &.danger:hover { background: var(--red-light); }
    }

    .badge {
      display: inline-block; padding: 2px 8px; border-radius: 99px;
      font-size: 11px; font-weight: 500; background: var(--bg); color: var(--text-3);
    }
    .badge-published { background: #dcfce7; color: #16a34a; }
    .badge-draft     { background: var(--bg); color: var(--text-4); }
    .badge-ai        { background: #ede9fe; color: #7C3AED; }

    .empty-state {
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      gap: 10px; padding: 56px 24px; color: var(--text-3); font-size: 13px;
    }
    .spinner {
      width: 24px; height: 24px; border: 2px solid var(--border);
      border-top-color: var(--purple); border-radius: 50%; animation: spin .7s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
    .btn-link {
      border: none; background: none; color: var(--purple);
      font-size: 12px; cursor: pointer; font-family: inherit;
      &:hover { text-decoration: underline; }
    }

    .actions { display: flex; gap: 8px; }
    .btn {
      height: 34px; padding: 0 14px; border-radius: var(--radius-md);
      font-size: 12px; font-weight: 500; font-family: inherit; cursor: pointer; border: none;
      transition: opacity .15s;
      &:disabled { opacity: .55; cursor: not-allowed; }
    }
    .btn-primary { background: var(--purple); color: #fff; &:hover:not(:disabled) { opacity: .88; } }
    .btn-ghost   { background: transparent; color: var(--text-2); border: 1px solid var(--border); &:hover { background: var(--bg); } }
    .btn-ai      { background: #7C3AED; color: #fff; &:hover:not(:disabled) { opacity: .88; } }

    .panel-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,.25); z-index: 100; }
    .side-panel {
      position: fixed; top: 0; right: 0; bottom: 0; width: 440px;
      background: #fff; box-shadow: -4px 0 24px rgba(0,0,0,.12);
      z-index: 101; display: flex; flex-direction: column;
    }
    .panel-header {
      display: flex; align-items: center; justify-content: space-between;
      padding: 16px 20px; border-bottom: 1px solid var(--border); flex-shrink: 0;
    }
    .panel-title { font-size: 14px; font-weight: 600; color: var(--text); }
    .panel-close {
      border: none; background: none; font-size: 16px; cursor: pointer;
      color: var(--text-4); padding: 4px; border-radius: 6px;
      &:hover { background: var(--bg); }
    }
    .panel-body { flex: 1; overflow-y: auto; padding: 20px; display: flex; flex-direction: column; gap: 16px; }
    .panel-footer { display: flex; justify-content: flex-end; gap: 8px; padding-top: 8px; margin-top: auto; }

    .ai-banner {
      display: flex; align-items: flex-start; gap: 10px;
      background: #ede9fe; border-radius: 8px; padding: 12px 14px;
      font-size: 12px; color: #5B21B6; line-height: 1.5;
    }

    .field-group { display: flex; flex-direction: column; gap: 5px; }
    .field-row { display: flex; gap: 12px; > * { flex: 1; } }
    .field-label { font-size: 12px; font-weight: 500; color: var(--text-2); }
    .field-sub { font-size: 11px; color: var(--text-4); }
    .required { color: var(--red); }
    .field-input {
      width: 100%; border: 1px solid var(--border); border-radius: var(--radius-md);
      padding: 7px 10px; font-size: 13px; color: var(--text);
      font-family: inherit; background: #fff; outline: none;
      &:focus { border-color: var(--purple); box-shadow: 0 0 0 3px rgba(124,58,237,.08); }
      &::placeholder { color: var(--text-4); }
    }
    select.field-input { cursor: pointer; }

    .checkbox-list { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 4px; }
    .checkbox-item {
      display: flex; align-items: center; gap: 6px;
      font-size: 12px; color: var(--text-2); cursor: pointer;
      input[type=checkbox] { width: 14px; height: 14px; cursor: pointer; accent-color: var(--purple); }
    }

    .toggle-row { display: flex; align-items: center; justify-content: space-between; cursor: pointer; }
    .toggle { position: relative; display: inline-block; flex-shrink: 0; }
    .toggle input { opacity: 0; width: 0; height: 0; position: absolute; }
    .toggle-track {
      display: block; width: 36px; height: 20px; border-radius: 10px;
      background: var(--border); transition: background .2s; cursor: pointer;
      &::after {
        content: ''; position: absolute; left: 3px; top: 3px;
        width: 14px; height: 14px; border-radius: 50%; background: #fff; transition: transform .2s;
      }
    }
    .toggle input:checked ~ .toggle-track { background: var(--purple); }
    .toggle input:checked ~ .toggle-track::after { transform: translateX(16px); }
  `],
})
export class QuestionPapersComponent implements OnInit {
  private api   = inject(ApiService);
  private snack = inject(MatSnackBar);
  private fb    = inject(FormBuilder);

  papers        = signal<QuestionPaperRow[]>([]);
  loading       = signal(true);
  saving        = signal(false);
  panelOpen     = signal(false);
  mode          = signal<'create' | 'edit' | 'generate'>('create');
  editing       = signal<QuestionPaperRow | null>(null);
  search        = signal('');
  filterSubject = signal('');
  filterSource  = signal('');
  subjects: string[] = [];
  questionTypes = QUESTION_TYPES;
  selectedQTypes: string[] = [];

  form = this.fb.group({
    title:        ['', Validators.required],
    subject:      [''],
    grade_level:  [''],
    topic:        [''],
    total_marks:  [null as number | null],
    is_published: [false],
  });

  genForm = this.fb.group({
    subject:                 ['', Validators.required],
    grade_level:             ['', Validators.required],
    topic:                   ['', Validators.required],
    total_marks:             [50],
    duration_minutes:        [60],
    difficulty_distribution: ['40% easy, 40% medium, 20% hard'],
  });

  filtered = computed(() => {
    let list = this.papers();
    const q   = this.search().toLowerCase();
    const s   = this.filterSubject();
    const src = this.filterSource();
    if (q)   list = list.filter(p => p.title.toLowerCase().includes(q) || (p.topic ?? '').toLowerCase().includes(q));
    if (s)   list = list.filter(p => p.subject === s);
    if (src) list = list.filter(p => p.source === src);
    return list;
  });

  ngOnInit() {
    this.api.get<{ data: { name: string }[] }>('/sis/subjects').subscribe({
      next: res => { this.subjects = res.data.map(s => s.name); },
      error: () => {},
    });
    this.load();
  }

  load() {
    this.loading.set(true);
    this.api.get<{ data: QuestionPaperRow[] }>('/question-papers').subscribe({
      next: res => { this.papers.set(res.data); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  clearFilters() { this.search.set(''); this.filterSubject.set(''); this.filterSource.set(''); }

  openCreate() {
    this.mode.set('create');
    this.editing.set(null);
    this.form.reset({ is_published: false });
    this.panelOpen.set(true);
  }

  openEdit(p: QuestionPaperRow) {
    this.mode.set('edit');
    this.editing.set(p);
    this.form.patchValue({ title: p.title, subject: p.subject ?? '', grade_level: p.grade_level ?? '',
      topic: p.topic ?? '', total_marks: p.total_marks, is_published: p.is_published });
    this.panelOpen.set(true);
  }

  openGenerate() {
    this.mode.set('generate');
    this.selectedQTypes = [];
    this.genForm.reset({ total_marks: 50, duration_minutes: 60, difficulty_distribution: '40% easy, 40% medium, 20% hard' });
    this.panelOpen.set(true);
  }

  closePanel() { this.panelOpen.set(false); }

  toggleQType(qt: string, event: Event) {
    const checked = (event.target as HTMLInputElement).checked;
    if (checked) this.selectedQTypes = [...this.selectedQTypes, qt];
    else         this.selectedQTypes = this.selectedQTypes.filter(x => x !== qt);
  }

  save() {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    const v = this.form.value;
    const dto = {
      title:        v.title!,
      subject:      v.subject      || undefined,
      grade_level:  v.grade_level  || undefined,
      topic:        v.topic        || undefined,
      total_marks:  v.total_marks  || undefined,
      is_published: v.is_published ?? false,
    };
    this.saving.set(true);
    const e = this.editing();
    const req$ = e
      ? this.api.patch<{ data: QuestionPaperRow }>(`/question-papers/${e.id}`, dto)
      : this.api.post<{ data: QuestionPaperRow }>('/question-papers', dto);

    req$.subscribe({
      next: res => {
        if (e) this.papers.update(list => list.map(p => p.id === e.id ? res.data : p));
        else   this.papers.update(list => [res.data, ...list]);
        this.saving.set(false);
        this.panelOpen.set(false);
        this.snack.open(e ? 'Paper updated' : 'Paper created', '', { duration: 2500 });
      },
      error: () => { this.saving.set(false); this.snack.open('Save failed', '', { duration: 3000 }); },
    });
  }

  generate() {
    if (this.genForm.invalid) { this.genForm.markAllAsTouched(); return; }
    const v = this.genForm.value;
    this.saving.set(true);
    this.api.post<{ data: QuestionPaperRow }>('/question-papers/generate', {
      subject:                 v.subject,
      grade_level:             v.grade_level,
      topic:                   v.topic,
      total_marks:             v.total_marks || undefined,
      duration_minutes:        v.duration_minutes || undefined,
      difficulty_distribution: v.difficulty_distribution || undefined,
      question_types:          this.selectedQTypes.length ? this.selectedQTypes : undefined,
    }).subscribe({
      next: res => {
        this.papers.update(list => [res.data, ...list]);
        this.saving.set(false);
        this.panelOpen.set(false);
        this.snack.open('Question paper generated!', '', { duration: 3000 });
      },
      error: () => { this.saving.set(false); this.snack.open('Generation failed', '', { duration: 3000 }); },
    });
  }

  remove(p: QuestionPaperRow) {
    if (!confirm(`Delete "${p.title}"?`)) return;
    this.api.delete(`/question-papers/${p.id}`).subscribe({
      next: () => {
        this.papers.update(list => list.filter(x => x.id !== p.id));
        this.snack.open('Paper deleted', '', { duration: 2500 });
      },
      error: () => this.snack.open('Delete failed', '', { duration: 3000 }),
    });
  }
}
