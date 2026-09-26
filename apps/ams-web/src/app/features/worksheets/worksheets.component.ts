import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatMenuModule } from '@angular/material/menu';
import { ApiService } from '../../core/services/api.service';

type WorksheetLevel = 'montessori' | 'primary' | 'high_school';

interface WorksheetRow {
  id: string;
  title: string;
  description: string | null;
  subject: string | null;
  grade_level: string | null;
  level: WorksheetLevel | null;
  file_url: string | null;
  source: 'upload' | 'generated';
  is_published: boolean;
  created_at: string;
}

const TOPICS: Record<string, Record<string, string[]>> = {
  'Mathematics': {
    montessori:  ['Number Recognition', 'Counting Objects', 'Sorting & Classifying', 'Simple Patterns', 'Introduction to Shapes', 'Comparing Numbers', 'Introduction to Addition', 'Introduction to Subtraction'],
    primary:     ['Addition & Subtraction', 'Multiplication Tables', 'Long Division', 'Fractions', 'Decimals', '2D Shapes', '3D Shapes', 'Measurement & Units', 'Time & Calendar', 'Word Problems', 'Place Value', 'Perimeter & Area', 'Data & Graphs'],
    high_school: ['Linear Equations', 'Quadratic Equations', 'Polynomials', 'Geometry Proofs', 'Trigonometry', 'Coordinate Geometry', 'Statistics & Probability', 'Number Theory', 'Matrices', 'Calculus – Derivatives', 'Calculus – Integrals', 'Arithmetic & Geometric Progressions'],
  },
  'Language': {
    montessori:  ['Letter Recognition', 'Phonics & Sounds', 'Sight Words', 'Picture-Word Matching', 'Rhyming Words', 'Story Sequencing', 'Vocabulary Building'],
    primary:     ['Reading Comprehension', 'Parts of Speech', 'Sentence Formation', 'Punctuation', 'Tenses', 'Spellings', 'Synonyms & Antonyms', 'Creative Writing', 'Paragraph Writing', 'Poetry', 'Editing Passages'],
    high_school: ['Essay Writing', 'Literature Analysis', 'Formal Letter Writing', 'Report Writing', 'Comprehension Passages', 'Idioms & Phrases', 'Advanced Grammar', 'Précis Writing', 'Speech & Debate'],
  },
  'Science': {
    montessori:  ['Plants & Seeds', 'Animals Around Us', 'Five Senses', 'Day & Night', 'Weather & Seasons', 'Sink or Float', 'Colours in Nature'],
    primary:     ['Plants & Photosynthesis', 'Animal Classification', 'Human Body Systems', 'Food & Nutrition', 'States of Matter', 'Force & Motion', 'Simple Machines', 'Water Cycle', 'Ecosystems', 'Light & Shadows', 'Electricity Basics', 'Soil & Rocks'],
    high_school: ['Cell Biology', 'Genetics & Heredity', 'Chemical Reactions', 'Periodic Table', "Newton's Laws", 'Electricity & Magnetism', 'Acids, Bases & Salts', 'Ecology & Environment', 'Human Reproduction', 'Optics', 'Organic Chemistry', 'Evolution'],
  },
  'Social Studies': {
    montessori:  ['My Family', 'My Community', 'Community Helpers', 'Festivals & Celebrations', 'Maps & Directions', 'Our Country'],
    primary:     ['Maps & Globes', 'Local Government', 'Indian History', 'World Continents', 'Natural Resources', 'Farming & Agriculture', 'Transport & Communication', 'Democracy & Citizenship', 'Cultural Diversity', 'Climate Zones'],
    high_school: ['Ancient Civilizations', 'World Wars', 'Indian Independence Movement', 'Economics Basics', 'Political Systems', 'Globalisation', 'Human Rights', 'Physical Geography', 'Environmental Issues', 'Trade & Commerce'],
  },
  'Art': {
    montessori:  ['Colours & Mixing', 'Basic Shapes in Art', 'Nature Drawing', 'Pattern Making', 'Clay Modelling'],
    primary:     ['Still Life Drawing', 'Perspective Drawing', 'Colour Theory', 'Portrait Sketching', 'Indian Folk Art', 'Poster Making', 'Paper Craft'],
    high_school: ['Advanced Perspective', 'Watercolour Techniques', 'Charcoal & Shading', 'Art History', 'Abstract Art', 'Printmaking'],
  },
  'Music': {
    montessori:  ['Rhythm & Beat', 'High & Low Sounds', 'Simple Rhymes', 'Identifying Instruments'],
    primary:     ['Notes & Scales', 'Basic Sheet Music', 'Indian Classical Basics', 'Folk Songs', 'Instrument Families', 'Rhythm Patterns'],
    high_school: ['Music Theory', 'Composition', 'World Music Genres', 'History of Music', 'Carnatic / Hindustani Basics'],
  },
  'Physical Education': {
    montessori:  ['Body Awareness', 'Gross Motor Skills', 'Simple Ball Games', 'Stretching & Balance'],
    primary:     ['Running & Jumping', 'Team Sports Rules', 'Yoga for Kids', 'Cricket Fundamentals', 'Football Fundamentals', 'Health & Hygiene'],
    high_school: ['Advanced Athletics', 'Sports Strategy & Tactics', 'Physical Fitness Tests', 'Nutrition for Athletes', 'First Aid Basics', 'Badminton Techniques'],
  },
};

const LEVEL_META: Record<WorksheetLevel, { label: string; bg: string; color: string }> = {
  montessori:  { label: 'Pre-primary', bg: '#ede9fe', color: '#5b21b6' },
  primary:     { label: 'Primary',    bg: '#d1fae5', color: '#065f46' },
  high_school: { label: 'High School', bg: '#fef3c7', color: '#92400e' },
};

@Component({
  selector: 'ams-worksheets',
  standalone: true,
  imports: [ReactiveFormsModule, MatSnackBarModule, MatMenuModule],
  template: `
    <div class="page-header">
      <div>
        <h1>Worksheets</h1>
        <div class="subtitle">{{ filtered().length }} of {{ worksheets().length }} worksheet{{ worksheets().length !== 1 ? 's' : '' }}</div>
      </div>
      <div class="actions">
        <button class="btn btn-ai" (click)="openGenerate()">✨ Generate with AI</button>
        <button class="btn btn-ghost" (click)="openUpload()">📎 Upload File</button>
        <button class="btn btn-primary" (click)="openCreate()">+ New Worksheet</button>
      </div>
    </div>

    <!-- Filters -->
    <div class="filter-bar">
      <div class="search-wrap">
        <span class="search-icon">🔍</span>
        <input class="search-input" placeholder="Search title or description…"
               [value]="search()" (input)="search.set($any($event.target).value)" />
      </div>

      <select class="filter-select" [value]="filterSubject()"
              (change)="filterSubject.set($any($event.target).value)">
        <option value="">All subjects</option>
        @for (s of subjects; track s) { <option [value]="s">{{ s }}</option> }
      </select>

      <select class="filter-select" [value]="filterStatus()"
              (change)="filterStatus.set($any($event.target).value)">
        <option value="">All status</option>
        <option value="published">Published</option>
        <option value="draft">Draft</option>
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
          <span style="font-size:32px">📄</span>
          <span>No worksheets found</span>
          @if (worksheets().length) {
            <button class="btn-link" (click)="clearFilters()">Clear filters</button>
          } @else {
            <button class="btn btn-primary" (click)="openCreate()">Create your first worksheet</button>
          }
        </div>
      } @else {
        <table class="data-table">
          <thead>
            <tr>
              <th>Title</th>
              <th>Level</th>
              <th>Subject</th>
              <th>Grade</th>
              <th>Status</th>
              <th>Created</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            @for (w of filtered(); track w.id) {
              <tr>
                <td>
                  <div class="ws-title">
                    {{ w.title }}
                    @if (w.file_url) {
                      <a class="file-link" [href]="w.file_url" target="_blank" title="View file">📄</a>
                    }
                  </div>
                  @if (w.description) {
                    <div class="ws-desc">{{ w.description }}</div>
                  }
                </td>
                <td>
                  @if (w.level) {
                    <span class="level-badge"
                          [style.background]="levelMeta(w.level).bg"
                          [style.color]="levelMeta(w.level).color">
                      {{ levelMeta(w.level).label }}
                    </span>
                  } @else {
                    <span class="text-muted">—</span>
                  }
                </td>
                <td>{{ w.subject ?? '—' }}</td>
                <td>{{ w.grade_level ?? '—' }}</td>
                <td>
                  <span class="badge" [class.badge-published]="w.is_published" [class.badge-draft]="!w.is_published">
                    {{ w.is_published ? 'Published' : 'Draft' }}
                  </span>
                </td>
                <td class="text-muted">{{ fmtDate(w.created_at) }}</td>
                <td class="row-actions">
                  <button class="icon-btn" (click)="openEdit(w)" title="Edit">✏️</button>
                  <button class="icon-btn danger" (click)="remove(w)" title="Delete">🗑</button>
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
          <span class="panel-title">{{ genMode() ? '✨ Generate with AI' : uploadMode() ? '📎 Upload Worksheet' : (editing() ? 'Edit Worksheet' : 'New Worksheet') }}</span>
          <button class="panel-close" (click)="closePanel()">✕</button>
        </div>

        @if (genMode()) {
          <form [formGroup]="genForm" (ngSubmit)="generate()" class="panel-body">

            <!-- Step 1: Subject + Level -->
            <div class="field-row">
              <div class="field-group">
                <label class="field-label">Subject <span class="required">*</span></label>
                <select class="field-input" formControlName="subject"
                        (change)="onGenSubjectChange($any($event.target).value)">
                  <option value="">Select subject</option>
                  @for (s of subjects; track s) { <option [value]="s">{{ s }}</option> }
                </select>
                @if (genForm.get('subject')?.invalid && genForm.get('subject')?.touched) {
                  <div class="field-error">Required</div>
                }
              </div>
              <div class="field-group">
                <label class="field-label">School Level <span class="required">*</span></label>
                <select class="field-input" formControlName="level"
                        (change)="onGenLevelChange($any($event.target).value)">
                  <option value="">Select level</option>
                  <option value="montessori">Pre-primary / Montessori</option>
                  <option value="primary">Primary (Gr 1–5)</option>
                  <option value="high_school">High School (Gr 6–12)</option>
                </select>
                @if (genForm.get('level')?.invalid && genForm.get('level')?.touched) {
                  <div class="field-error">Required</div>
                }
              </div>
            </div>

            <!-- Step 2: Grade + Topic chips -->
            <div class="field-group">
              <label class="field-label">Grade Level <span class="required">*</span></label>
              <input class="field-input" formControlName="grade_level" placeholder="e.g. Grade 3" />
              @if (genForm.get('grade_level')?.invalid && genForm.get('grade_level')?.touched) {
                <div class="field-error">Grade level is required</div>
              }
            </div>

            <div class="field-group">
              <label class="field-label">Topic <span class="required">*</span></label>
              @if (!genSubject() || !genLevel()) {
                <div class="topic-placeholder">
                  Select a subject and level above to see topic options
                </div>
              } @else {
                <div class="topic-grid">
                  @for (t of availableTopics(); track t) {
                    <button type="button" class="topic-chip"
                            [class.selected]="selectedTopic() === t"
                            (click)="selectTopic(t)">
                      {{ t }}
                    </button>
                  }
                  <button type="button" class="topic-chip topic-chip-other"
                          [class.selected]="isCustomTopic()"
                          (click)="selectTopic('__custom__')">
                    ✏️ Other…
                  </button>
                </div>
                @if (isCustomTopic()) {
                  <input class="field-input" style="margin-top:8px"
                         placeholder="Describe your topic…"
                         [value]="genForm.get('topic')?.value ?? ''"
                         (input)="onCustomTopicInput($any($event.target).value)" />
                }
                @if (genForm.get('topic')?.invalid && genForm.get('topic')?.touched) {
                  <div class="field-error">Please select a topic</div>
                }
              }
            </div>

            <!-- Step 3: Activity options -->
            <div class="field-row">
              <div class="field-group">
                <label class="field-label">Activity Type</label>
                <select class="field-input" formControlName="activity_type">
                  <option value="">Any</option>
                  <option value="fill in the blanks">Fill in the Blanks</option>
                  <option value="multiple choice">Multiple Choice</option>
                  <option value="match the following">Match the Following</option>
                  <option value="short answer">Short Answer</option>
                  <option value="true or false">True or False</option>
                  <option value="diagram labelling">Diagram Labelling</option>
                  <option value="word problems">Word Problems</option>
                </select>
              </div>
              <div class="field-group">
                <label class="field-label">Difficulty</label>
                <select class="field-input" formControlName="difficulty">
                  <option value="">Any</option>
                  <option value="easy">Easy</option>
                  <option value="medium">Medium</option>
                  <option value="hard">Hard</option>
                </select>
              </div>
            </div>

            <div class="field-group">
              <label class="field-label">Number of Questions</label>
              <input class="field-input" type="number" formControlName="num_questions"
                     placeholder="e.g. 10" min="1" max="30" />
            </div>

            <div class="field-group">
              <label class="toggle-row">
                <div>
                  <div class="field-label" style="margin-bottom:2px">Publish immediately</div>
                  <div class="field-sub">Visible to teachers and students</div>
                </div>
                <label class="toggle">
                  <input type="checkbox" formControlName="is_published" />
                  <span class="toggle-track"></span>
                </label>
              </label>
            </div>

            <div class="panel-footer">
              <button type="button" class="btn btn-ghost" (click)="closePanel()">Cancel</button>
              <button type="submit" class="btn btn-ai" [disabled]="genForm.invalid || generating()">
                {{ generating() ? 'Generating…' : '✨ Generate' }}
              </button>
            </div>
          </form>
        } @else if (uploadMode()) {
          <form (ngSubmit)="upload()" class="panel-body">

            <!-- File picker -->
            <div class="field-group">
              <label class="field-label">File <span class="required">*</span></label>
              <label class="file-drop" [class.has-file]="selectedFile()">
                <input type="file" accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                       style="display:none" (change)="onFileChange($event)" />
                @if (selectedFile()) {
                  <div class="file-selected">
                    <span class="file-icon">{{ fileIcon(selectedFile()!.name) }}</span>
                    <div>
                      <div class="file-name">{{ selectedFile()!.name }}</div>
                      <div class="file-size">{{ fileSize(selectedFile()!.size) }}</div>
                    </div>
                    <button type="button" class="file-clear" (click)="clearFile($event)">✕</button>
                  </div>
                } @else {
                  <div class="file-prompt">
                    <span style="font-size:28px">📄</span>
                    <span>Click to choose a file</span>
                    <span class="file-hint">PDF, DOC, DOCX, JPG, PNG · Max 20 MB</span>
                  </div>
                }
              </label>
            </div>

            <div class="field-group">
              <label class="field-label">Title</label>
              <input class="field-input" [value]="uploadTitle()"
                     (input)="uploadTitle.set($any($event.target).value)"
                     placeholder="Auto-filled from filename" />
            </div>

            <div class="field-row">
              <div class="field-group">
                <label class="field-label">Subject</label>
                <select class="field-input" [value]="uploadSubject()"
                        (change)="uploadSubject.set($any($event.target).value)">
                  <option value="">Select subject</option>
                  @for (s of subjects; track s) { <option [value]="s">{{ s }}</option> }
                </select>
              </div>
              <div class="field-group">
                <label class="field-label">Grade Level</label>
                <input class="field-input" [value]="uploadGrade()"
                       (input)="uploadGrade.set($any($event.target).value)"
                       placeholder="e.g. Grade 3" />
              </div>
            </div>

            <div class="field-group">
              <label class="field-label">School Level</label>
              <select class="field-input" [value]="uploadLevel()"
                      (change)="uploadLevel.set($any($event.target).value)">
                <option value="">Auto-detect from grade</option>
                <option value="montessori">Pre-primary / Montessori</option>
                <option value="primary">Primary (Grade 1–5)</option>
                <option value="high_school">High School (Grade 6–12)</option>
              </select>
            </div>

            <div class="field-group">
              <label class="toggle-row">
                <div>
                  <div class="field-label" style="margin-bottom:2px">Publish immediately</div>
                  <div class="field-sub">Visible to teachers and students</div>
                </div>
                <label class="toggle">
                  <input type="checkbox" [checked]="uploadPublish()"
                         (change)="uploadPublish.set($any($event.target).checked)" />
                  <span class="toggle-track"></span>
                </label>
              </label>
            </div>

            <div class="panel-footer">
              <button type="button" class="btn btn-ghost" (click)="closePanel()">Cancel</button>
              <button type="submit" class="btn btn-primary" [disabled]="!selectedFile() || uploading()">
                {{ uploading() ? 'Uploading…' : '📎 Upload' }}
              </button>
            </div>
          </form>

        } @else {
          <form [formGroup]="form" (ngSubmit)="save()" class="panel-body">

            <div class="field-group">
              <label class="field-label">Title <span class="required">*</span></label>
              <input class="field-input" formControlName="title" placeholder="e.g. Addition with regrouping" />
              @if (form.get('title')?.invalid && form.get('title')?.touched) {
                <div class="field-error">Title is required</div>
              }
            </div>

            <div class="field-group">
              <label class="field-label">Description</label>
              <textarea class="field-input" formControlName="description" rows="3"
                        placeholder="Brief description of the worksheet…"></textarea>
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
                <input class="field-input" formControlName="grade_level" placeholder="e.g. Grade 3" />
              </div>
            </div>

            <div class="field-group">
              <label class="field-label">School Level</label>
              <select class="field-input" formControlName="level">
                <option value="">Auto-detect from grade</option>
                <option value="montessori">Pre-primary / Montessori</option>
                <option value="primary">Primary (Grade 1–5)</option>
                <option value="high_school">High School (Grade 6–12)</option>
              </select>
            </div>

            <div class="field-group">
              <label class="toggle-row">
                <div>
                  <div class="field-label" style="margin-bottom:2px">Published</div>
                  <div class="field-sub">Visible to teachers and students</div>
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
    /* ── Filter bar ── */
    .filter-bar {
      display: flex; gap: 10px; margin-bottom: 16px; flex-wrap: wrap;
    }
    .search-wrap {
      display: flex; align-items: center; gap: 7px;
      background: #fff; border: 1px solid var(--border); border-radius: var(--radius-md);
      padding: 0 12px; height: 34px; flex: 1; min-width: 200px;
      transition: border-color .15s;
      &:focus-within { border-color: var(--purple); }
    }
    .search-icon { font-size: 13px; opacity: .5; }
    .search-input {
      flex: 1; border: none; outline: none; font-size: 13px;
      color: var(--text); background: transparent;
      &::placeholder { color: var(--text-4); }
    }
    .filter-select {
      height: 34px; padding: 0 10px; border-radius: var(--radius-md);
      border: 1px solid var(--border); background: #fff;
      font-size: 12px; color: var(--text-2); font-family: inherit;
      cursor: pointer; outline: none;
      &:focus { border-color: var(--purple); }
    }

    /* ── Table ── */
    .data-table {
      width: 100%; border-collapse: collapse;
    }
    .data-table thead tr {
      background: var(--bg);
    }
    .data-table th {
      padding: 9px 14px; font-size: 10px; font-weight: 600;
      text-transform: uppercase; letter-spacing: .4px;
      color: var(--text-4); text-align: left;
      border-bottom: 1px solid var(--border);
    }
    .data-table td {
      padding: 10px 14px; font-size: 12.5px; color: var(--text-2);
      border-bottom: 1px solid var(--border-light);
      vertical-align: middle;
    }
    .data-table tbody tr:last-child td { border-bottom: none; }
    .data-table tbody tr:hover td { background: #fafafa; }

    .ws-title { font-weight: 500; color: var(--text); font-size: 13px; }
    .ws-desc  { font-size: 11px; color: var(--text-4); margin-top: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 280px; }

    .row-actions { display: flex; gap: 4px; justify-content: flex-end; }
    .icon-btn {
      border: none; background: transparent; cursor: pointer;
      padding: 4px 6px; border-radius: 6px; font-size: 14px;
      opacity: .6; transition: opacity .1s, background .1s;
      &:hover { opacity: 1; background: var(--bg); }
      &.danger:hover { background: var(--red-light); }
    }

    /* ── Empty / loading ── */
    .empty-state {
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      gap: 10px; padding: 56px 24px; color: var(--text-3); font-size: 13px;
    }
    .spinner {
      width: 24px; height: 24px; border: 2px solid var(--border);
      border-top-color: var(--purple); border-radius: 50%;
      animation: spin .7s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
    .btn-link {
      border: none; background: none; color: var(--purple);
      font-size: 12px; cursor: pointer; font-family: inherit;
      &:hover { text-decoration: underline; }
    }

    /* ── Buttons ── */
    .btn {
      height: 34px; padding: 0 14px; border-radius: var(--radius-md);
      font-size: 12px; font-weight: 500; font-family: inherit;
      cursor: pointer; border: none; transition: opacity .15s;
      &:disabled { opacity: .55; cursor: not-allowed; }
    }
    .btn-primary { background: var(--purple); color: #fff; &:hover:not(:disabled) { opacity: .88; } }
    .btn-ghost   {
      background: transparent; color: var(--text-2);
      border: 1px solid var(--border);
      &:hover { background: var(--bg); }
    }
    .btn-ai {
      background: linear-gradient(135deg, #7c3aed, #a855f7);
      color: #fff;
      &:hover:not(:disabled) { opacity: .88; }
    }
    .ai-hint {
      font-size: 12px; color: var(--text-3); background: var(--bg);
      border: 1px solid var(--border); border-radius: var(--radius-md);
      padding: 10px 12px; line-height: 1.5;
    }

    /* ── Side panel ── */
    .panel-backdrop {
      position: fixed; inset: 0; background: rgba(0,0,0,.25); z-index: 100;
    }
    .side-panel {
      position: fixed; top: 0; right: 0; bottom: 0; width: 400px;
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
      &:hover { background: var(--bg); color: var(--text-2); }
    }
    .panel-body {
      flex: 1; overflow-y: auto; padding: 20px;
      display: flex; flex-direction: column; gap: 16px;
    }
    .panel-footer {
      display: flex; justify-content: flex-end; gap: 8px;
      padding-top: 8px; margin-top: auto;
    }

    /* ── Form fields ── */
    .field-group { display: flex; flex-direction: column; gap: 5px; }
    .field-row { display: flex; gap: 12px; > * { flex: 1; } }
    .field-label { font-size: 12px; font-weight: 500; color: var(--text-2); }
    .field-sub { font-size: 11px; color: var(--text-4); }
    .required { color: var(--red); }
    .field-input {
      width: 100%; border: 1px solid var(--border); border-radius: var(--radius-md);
      padding: 7px 10px; font-size: 13px; color: var(--text);
      font-family: inherit; background: #fff; outline: none;
      transition: border-color .15s;
      &:focus { border-color: var(--purple); box-shadow: 0 0 0 3px rgba(124,58,237,.08); }
      &::placeholder { color: var(--text-4); }
    }
    textarea.field-input { resize: vertical; min-height: 72px; }
    select.field-input { cursor: pointer; }
    .field-error { font-size: 11px; color: var(--red); margin-top: 2px; }

    /* ── Toggle ── */
    .toggle-row { display: flex; align-items: center; justify-content: space-between; cursor: pointer; }
    .toggle { position: relative; display: inline-block; flex-shrink: 0; }
    .toggle input { opacity: 0; width: 0; height: 0; position: absolute; }
    .toggle-track {
      display: block; width: 36px; height: 20px; border-radius: 10px;
      background: var(--border); transition: background .2s; cursor: pointer;
      &::after {
        content: ''; position: absolute; left: 3px; top: 3px;
        width: 14px; height: 14px; border-radius: 50%;
        background: #fff; transition: transform .2s;
      }
    }
    .toggle input:checked ~ .toggle-track { background: var(--purple); }
    .toggle input:checked ~ .toggle-track::after { transform: translateX(16px); }

    /* ── Level badge ── */
    .level-badge {
      display: inline-block; padding: 2px 8px; border-radius: 10px;
      font-size: 11px; font-weight: 500; white-space: nowrap;
    }
    .text-muted { color: var(--text-4); font-size: 12px; }

    /* ── File upload ── */
    .file-drop {
      display: flex; align-items: center; justify-content: center;
      border: 2px dashed var(--border); border-radius: var(--radius-md);
      padding: 20px; cursor: pointer; transition: border-color .15s, background .15s;
      &:hover, &.has-file { border-color: var(--purple); background: rgba(124,58,237,.03); }
    }
    .file-prompt {
      display: flex; flex-direction: column; align-items: center; gap: 4px;
      font-size: 12px; color: var(--text-4);
    }
    .file-hint { font-size: 11px; }
    .file-selected {
      display: flex; align-items: center; gap: 10px; width: 100%;
    }
    .file-icon { font-size: 24px; flex-shrink: 0; }
    .file-name { font-size: 12px; font-weight: 500; color: var(--text); word-break: break-all; }
    .file-size { font-size: 11px; color: var(--text-4); margin-top: 1px; }
    .file-clear {
      margin-left: auto; flex-shrink: 0; border: none; background: none;
      font-size: 13px; color: var(--text-4); cursor: pointer; padding: 4px;
      border-radius: 4px;
      &:hover { background: var(--bg); color: var(--text-2); }
    }
    .file-link {
      margin-left: 6px; font-size: 13px; text-decoration: none; opacity: .7;
      &:hover { opacity: 1; }
    }

    /* ── Topic chips ── */
    .topic-placeholder {
      font-size: 12px; color: var(--text-4); font-style: italic;
      padding: 10px 12px; border: 1px dashed var(--border);
      border-radius: var(--radius-md); background: var(--bg);
    }
    .topic-grid {
      display: flex; flex-wrap: wrap; gap: 6px;
    }
    .topic-chip {
      padding: 5px 12px; font-size: 12px; border-radius: 20px;
      border: 1px solid var(--border); background: #fff;
      color: var(--text-2); cursor: pointer; transition: all .15s;
      font-family: inherit;
      &:hover { border-color: var(--purple); color: var(--purple); background: rgba(124,58,237,.05); }
      &.selected { border-color: var(--purple); background: var(--purple); color: #fff; }
    }
    .topic-chip-other {
      border-style: dashed;
      &.selected { border-style: solid; }
    }
  `],
})
export class WorksheetsComponent implements OnInit {
  private api   = inject(ApiService);
  private snack = inject(MatSnackBar);
  private fb    = inject(FormBuilder);

  worksheets    = signal<WorksheetRow[]>([]);
  loading       = signal(true);
  saving        = signal(false);
  generating    = signal(false);
  panelOpen     = signal(false);
  genMode       = signal(false);
  editing       = signal<WorksheetRow | null>(null);
  search        = signal('');
  filterSubject = signal('');
  filterStatus  = signal('');
  subjects: string[] = [];

  form = this.fb.group({
    title:        ['', Validators.required],
    description:  [''],
    subject:      [''],
    grade_level:  [''],
    level:        [''],
    is_published: [false],
  });

  genForm = this.fb.group({
    topic:         ['', Validators.required],
    subject:       ['', Validators.required],
    grade_level:   ['', Validators.required],
    level:         ['', Validators.required],
    activity_type: [''],
    difficulty:    [''],
    num_questions: [null as number | null],
    is_published:  [false],
  });

  genSubject    = signal('');
  genLevel      = signal('');
  selectedTopic = signal('');

  availableTopics = computed(() => {
    const s = this.genSubject();
    const l = this.genLevel();
    if (!s || !l) return [];
    return TOPICS[s]?.[l] ?? [];
  });

  isCustomTopic = computed(() => this.selectedTopic() === '__custom__');

  // ── Upload mode ──
  uploadMode    = signal(false);
  uploading     = signal(false);
  selectedFile  = signal<File | null>(null);
  uploadTitle   = signal('');
  uploadSubject = signal('');
  uploadGrade   = signal('');
  uploadLevel   = signal('');
  uploadPublish = signal(false);

  filtered = computed(() => {
    let list = this.worksheets();
    const q = this.search().toLowerCase();
    const s = this.filterSubject();
    const st = this.filterStatus();
    if (q)  list = list.filter(w => w.title.toLowerCase().includes(q) || (w.description ?? '').toLowerCase().includes(q));
    if (s)  list = list.filter(w => w.subject === s);
    if (st) list = list.filter(w => st === 'published' ? w.is_published : !w.is_published);
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
    this.api.get<{ data: WorksheetRow[] }>('/worksheets').subscribe({
      next: res => { this.worksheets.set(res.data); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  clearFilters() { this.search.set(''); this.filterSubject.set(''); this.filterStatus.set(''); }

  openCreate() {
    this.editing.set(null);
    this.genMode.set(false);
    this.form.reset({ is_published: false });
    this.panelOpen.set(true);
  }

  openGenerate() {
    this.editing.set(null);
    this.genMode.set(true);
    this.genForm.reset({ is_published: false });
    this.genSubject.set('');
    this.genLevel.set('');
    this.selectedTopic.set('');
    this.panelOpen.set(true);
  }

  openUpload() {
    this.editing.set(null);
    this.genMode.set(false);
    this.uploadMode.set(true);
    this.selectedFile.set(null);
    this.uploadTitle.set('');
    this.uploadSubject.set('');
    this.uploadGrade.set('');
    this.uploadLevel.set('');
    this.uploadPublish.set(false);
    this.panelOpen.set(true);
  }

  onFileChange(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0] ?? null;
    this.selectedFile.set(file);
    if (file && !this.uploadTitle()) {
      this.uploadTitle.set(file.name.replace(/\.[^.]+$/, ''));
    }
  }

  clearFile(event: MouseEvent) {
    event.preventDefault();
    this.selectedFile.set(null);
  }

  upload() {
    const file = this.selectedFile();
    if (!file) return;
    const fd = new FormData();
    fd.append('file', file);
    if (this.uploadTitle())   fd.append('title',        this.uploadTitle());
    if (this.uploadSubject()) fd.append('subject',      this.uploadSubject());
    if (this.uploadGrade())   fd.append('grade_level',  this.uploadGrade());
    if (this.uploadLevel())   fd.append('level',        this.uploadLevel());
    fd.append('is_published', String(this.uploadPublish()));

    this.uploading.set(true);
    this.api.postForm<{ data: WorksheetRow }>('/worksheets/upload', fd).subscribe({
      next: res => {
        this.worksheets.update(list => [res.data, ...list]);
        this.uploading.set(false);
        this.panelOpen.set(false);
        this.snack.open('Worksheet uploaded', '', { duration: 2500 });
      },
      error: () => {
        this.uploading.set(false);
        this.snack.open('Upload failed. Check file type and size.', '', { duration: 3000 });
      },
    });
  }

  fileIcon(name: string): string {
    const ext = name.split('.').pop()?.toLowerCase() ?? '';
    if (ext === 'pdf')  return '📕';
    if (ext === 'doc' || ext === 'docx') return '📘';
    if (['jpg','jpeg','png'].includes(ext)) return '🖼️';
    return '📄';
  }

  fileSize(bytes: number): string {
    if (bytes < 1024)         return `${bytes} B`;
    if (bytes < 1024 * 1024)  return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  onGenSubjectChange(value: string) {
    this.genSubject.set(value);
    this.selectedTopic.set('');
    this.genForm.patchValue({ topic: '' });
  }

  onGenLevelChange(value: string) {
    this.genLevel.set(value);
    this.selectedTopic.set('');
    this.genForm.patchValue({ topic: '' });
  }

  selectTopic(topic: string) {
    this.selectedTopic.set(topic);
    if (topic !== '__custom__') {
      this.genForm.patchValue({ topic });
    } else {
      this.genForm.patchValue({ topic: '' });
    }
  }

  onCustomTopicInput(value: string) {
    this.genForm.patchValue({ topic: value });
  }

  generate() {
    if (this.genForm.invalid) { this.genForm.markAllAsTouched(); return; }
    const v = this.genForm.value;
    const dto: Record<string, unknown> = {
      topic:        v.topic!,
      subject:      v.subject!,
      grade_level:  v.grade_level!,
      is_published: v.is_published ?? false,
    };
    if (v.level)         dto['level']         = v.level;
    if (v.activity_type) dto['activity_type'] = v.activity_type;
    if (v.difficulty)    dto['difficulty']    = v.difficulty;
    if (v.num_questions) dto['num_questions'] = v.num_questions;

    this.generating.set(true);
    this.api.post<{ data: WorksheetRow }>('/worksheets/generate', dto).subscribe({
      next: res => {
        this.worksheets.update(list => [res.data, ...list]);
        this.generating.set(false);
        this.panelOpen.set(false);
        this.snack.open('Worksheet generated successfully', '', { duration: 3000 });
      },
      error: () => {
        this.generating.set(false);
        this.snack.open('Generation failed. Please try again.', '', { duration: 3000 });
      },
    });
  }

  openEdit(w: WorksheetRow) {
    this.editing.set(w);
    this.genMode.set(false);
    this.form.patchValue({
      title:        w.title,
      description:  w.description ?? '',
      subject:      w.subject ?? '',
      grade_level:  w.grade_level ?? '',
      level:        w.level ?? '',
      is_published: w.is_published,
    });
    this.panelOpen.set(true);
  }

  closePanel() { this.panelOpen.set(false); this.genMode.set(false); this.uploadMode.set(false); }

  save() {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    const v = this.form.value;
    const dto = {
      title:        v.title!,
      description:  v.description  || undefined,
      subject:      v.subject      || undefined,
      grade_level:  v.grade_level  || undefined,
      level:        (v.level       || undefined) as WorksheetLevel | undefined,
      is_published: v.is_published ?? false,
    };
    this.saving.set(true);
    const e = this.editing();
    const req$ = e
      ? this.api.patch<{ data: WorksheetRow }>(`/worksheets/${e.id}`, dto)
      : this.api.post<{ data: WorksheetRow }>('/worksheets', dto);

    req$.subscribe({
      next: res => {
        if (e) this.worksheets.update(list => list.map(w => w.id === e.id ? res.data : w));
        else   this.worksheets.update(list => [res.data, ...list]);
        this.saving.set(false);
        this.panelOpen.set(false);
        this.snack.open(e ? 'Worksheet updated' : 'Worksheet created', '', { duration: 2500 });
      },
      error: () => { this.saving.set(false); this.snack.open('Save failed', '', { duration: 3000 }); },
    });
  }

  remove(w: WorksheetRow) {
    if (!confirm(`Delete "${w.title}"?`)) return;
    this.api.delete(`/worksheets/${w.id}`).subscribe({
      next: () => {
        this.worksheets.update(list => list.filter(x => x.id !== w.id));
        this.snack.open('Worksheet deleted', '', { duration: 2500 });
      },
      error: () => this.snack.open('Delete failed', '', { duration: 3000 }),
    });
  }

  levelMeta(level: WorksheetLevel) {
    return LEVEL_META[level] ?? { label: level, bg: '#f3f4f6', color: '#374151' };
  }

  fmtDate(iso: string): string {
    return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  }
}
