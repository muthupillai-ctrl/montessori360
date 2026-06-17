import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { DatePipe } from '@angular/common';
import { ApiService } from '../../core/services/api.service';

interface HomeworkTask {
  id: string;
  title: string;
  description?: string;
  subject?: string;
  class_id?: string;
  student_id?: string;
  due_date: string;
  assigned_by?: string;
  is_published: boolean;
  published_at?: string;
  created_at: string;
}

interface ClassItem { id: string; name: string; }

@Component({
  selector: 'app-homework-admin',
  standalone: true,
  imports: [MatIconModule, MatProgressSpinnerModule, DatePipe, FormsModule],
  template: `
    <div class="page">
      <div class="page-header">
        <div>
          <div class="page-title">Homework</div>
          <div class="page-sub">Manage and publish homework tasks</div>
        </div>
        <button class="btn-primary" (click)="openForm()">
          <mat-icon style="font-size:16px;width:16px;height:16px">add</mat-icon>
          New Task
        </button>
      </div>

      <!-- Filter tabs -->
      <div class="filter-tabs">
        <button class="ftab" [class.active]="filter() === 'all'"       (click)="filter.set('all')">All</button>
        <button class="ftab" [class.active]="filter() === 'published'" (click)="filter.set('published')">Published</button>
        <button class="ftab" [class.active]="filter() === 'draft'"     (click)="filter.set('draft')">Drafts</button>
      </div>

      @if (loading()) {
        <div class="loading"><mat-progress-spinner diameter="28" mode="indeterminate"/></div>
      } @else if (!filtered().length) {
        <div class="empty">
          <mat-icon style="font-size:40px;width:40px;height:40px;color:var(--text-4)">assignment</mat-icon>
          <p>No {{ filter() === 'all' ? '' : filter() + ' ' }}homework tasks yet.</p>
        </div>
      } @else {
        <div class="task-list">
          @for (task of filtered(); track task.id) {
            <div class="task-card" [class.published]="task.is_published">
              <div class="task-header">
                <div class="task-meta">
                  @if (task.subject) {
                    <span class="subject-badge">{{ task.subject }}</span>
                  }
                  <span class="status-badge" [class.pub]="task.is_published">
                    {{ task.is_published ? 'Published' : 'Draft' }}
                  </span>
                </div>
                <div class="task-actions">
                  @if (!task.is_published) {
                    <button class="action-btn publish" (click)="publish(task)" title="Publish">
                      <mat-icon style="font-size:16px;width:16px;height:16px">publish</mat-icon>
                    </button>
                  }
                  <button class="action-btn edit" (click)="openForm(task)" title="Edit">
                    <mat-icon style="font-size:16px;width:16px;height:16px">edit</mat-icon>
                  </button>
                  <button class="action-btn delete" (click)="deleteTask(task.id)" title="Delete">
                    <mat-icon style="font-size:16px;width:16px;height:16px">delete</mat-icon>
                  </button>
                </div>
              </div>
              <div class="task-title">{{ task.title }}</div>
              @if (task.description) {
                <p class="task-desc">{{ task.description }}</p>
              }
              <div class="task-footer">
                <span class="due">
                  <mat-icon style="font-size:13px;width:13px;height:13px">event</mat-icon>
                  Due {{ task.due_date | date:'d MMM yyyy' }}
                </span>
                @if (task.is_published && task.published_at) {
                  <span class="pub-time">Published {{ task.published_at | date:'d MMM, h:mm a' }}</span>
                }
              </div>
            </div>
          }
        </div>
      }
    </div>

    <!-- Slide-over form -->
    @if (showForm()) {
      <div class="overlay" (click)="closeForm()"></div>
      <div class="drawer">
        <div class="drawer-header">
          <span>{{ editingId() ? 'Edit Task' : 'New Homework Task' }}</span>
          <button class="close-btn" (click)="closeForm()">
            <mat-icon style="font-size:20px;width:20px;height:20px">close</mat-icon>
          </button>
        </div>

        <div class="form-body">
          <div class="form-group">
            <label>Title <span class="req">*</span></label>
            <input class="input" [(ngModel)]="form.title" placeholder="e.g. Count objects 1–10" />
          </div>

          <div class="form-group">
            <label>Subject</label>
            <input class="input" [(ngModel)]="form.subject" placeholder="e.g. Math, Language, Science" />
          </div>

          <div class="form-group">
            <label>Description</label>
            <textarea class="input textarea" [(ngModel)]="form.description" rows="3" placeholder="Instructions for the homework…"></textarea>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label>Due Date <span class="req">*</span></label>
              <input class="input" type="date" [(ngModel)]="form.due_date" />
            </div>
            <div class="form-group">
              <label>Class (optional)</label>
              <select class="input" [(ngModel)]="form.class_id">
                <option value="">All classes</option>
                @for (c of classes(); track c.id) {
                  <option [value]="c.id">{{ c.name }}</option>
                }
              </select>
            </div>
          </div>

          @if (formError()) {
            <div class="form-error">{{ formError() }}</div>
          }
        </div>

        <div class="drawer-footer">
          <button class="btn-ghost" (click)="closeForm()">Cancel</button>
          <button class="btn-secondary" [disabled]="saving()" (click)="save(false)">
            {{ saving() ? 'Saving…' : 'Save Draft' }}
          </button>
          <button class="btn-primary" [disabled]="saving()" (click)="save(true)">
            {{ saving() ? 'Saving…' : 'Save & Publish' }}
          </button>
        </div>
      </div>
    }
  `,
  styles: [`
    .page { padding: 24px; max-width: 860px; }
    .page-header { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 20px; }
    .page-title { font-size: 22px; font-weight: 700; color: var(--text); }
    .page-sub { font-size: 13px; color: var(--text-3); margin-top: 2px; }
    .btn-primary { display: flex; align-items: center; gap: 6px; background: var(--blue); color: #fff; border: none; border-radius: 8px; padding: 8px 16px; font-size: 13px; font-weight: 600; cursor: pointer; white-space: nowrap; &:disabled { opacity: .5; } }
    .btn-secondary { display: flex; align-items: center; gap: 6px; background: var(--bg); color: var(--text-2); border: 1px solid var(--border); border-radius: 8px; padding: 8px 16px; font-size: 13px; font-weight: 600; cursor: pointer; &:disabled { opacity: .5; } }
    .btn-ghost { background: transparent; border: none; color: var(--text-3); font-size: 13px; cursor: pointer; padding: 8px 12px; border-radius: 8px; &:hover { background: var(--bg); } }

    .filter-tabs { display: flex; gap: 8px; margin-bottom: 20px; }
    .ftab { padding: 6px 18px; border-radius: 20px; border: 1.5px solid var(--border); background: var(--surface); font-size: 12px; font-weight: 600; cursor: pointer; color: var(--text-3); &.active { background: var(--blue); border-color: var(--blue); color: #fff; } }

    .loading { display: flex; justify-content: center; padding: 80px; }
    .empty { text-align: center; color: var(--text-3); padding: 80px 20px; font-size: 14px; display: flex; flex-direction: column; align-items: center; gap: 10px; }

    .task-list { display: flex; flex-direction: column; gap: 12px; }
    .task-card { background: var(--surface); border: 1.5px solid var(--border); border-radius: 12px; padding: 16px; transition: border-color .2s; &.published { border-color: rgba(16,185,129,.3); } }
    .task-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; }
    .task-meta { display: flex; align-items: center; gap: 8px; }
    .subject-badge { font-size: 11px; font-weight: 700; color: var(--blue); background: rgba(37,99,235,.08); border-radius: 6px; padding: 2px 8px; }
    .status-badge { font-size: 11px; font-weight: 600; color: var(--text-4); background: var(--bg); border: 1px solid var(--border); border-radius: 6px; padding: 2px 8px; &.pub { color: #059669; background: rgba(16,185,129,.08); border-color: rgba(16,185,129,.3); } }

    .task-actions { display: flex; gap: 4px; }
    .action-btn { display: flex; align-items: center; padding: 6px; border-radius: 7px; border: none; cursor: pointer; background: var(--bg); color: var(--text-3); transition: background .1s, color .1s; &.publish:hover { background: rgba(16,185,129,.1); color: #059669; } &.edit:hover { background: var(--blue-light); color: var(--blue); } &.delete:hover { background: rgba(239,68,68,.1); color: #EF4444; } }

    .task-title { font-size: 15px; font-weight: 700; color: var(--text); margin-bottom: 6px; }
    .task-desc { font-size: 13px; color: var(--text-2); line-height: 1.5; margin: 0 0 10px; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
    .task-footer { display: flex; align-items: center; justify-content: space-between; }
    .due { display: flex; align-items: center; gap: 4px; font-size: 12px; font-weight: 600; color: var(--text-3); }
    .pub-time { font-size: 11px; color: var(--text-4); }

    /* Drawer */
    .overlay { position: fixed; inset: 0; background: rgba(0,0,0,.25); z-index: 100; }
    .drawer { position: fixed; top: 0; right: 0; bottom: 0; width: 440px; background: var(--surface); border-left: 1px solid var(--border); z-index: 101; display: flex; flex-direction: column; box-shadow: -8px 0 24px rgba(0,0,0,.08); }
    .drawer-header { display: flex; align-items: center; justify-content: space-between; padding: 20px 24px; border-bottom: 1px solid var(--border); font-size: 16px; font-weight: 700; color: var(--text); }
    .close-btn { background: none; border: none; cursor: pointer; color: var(--text-3); display: flex; align-items: center; padding: 4px; border-radius: 6px; &:hover { background: var(--bg); } }
    .form-body { flex: 1; overflow-y: auto; padding: 20px 24px; display: flex; flex-direction: column; gap: 16px; }
    .form-group { display: flex; flex-direction: column; gap: 6px; }
    .form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
    label { font-size: 12px; font-weight: 600; color: var(--text-2); }
    .req { color: var(--red); }
    .input { padding: 9px 12px; border: 1px solid var(--border); border-radius: 8px; font-size: 13px; background: var(--bg); color: var(--text); font-family: inherit; &:focus { outline: none; border-color: var(--blue); } }
    .textarea { resize: vertical; min-height: 80px; }
    .form-error { color: var(--red); font-size: 12px; font-weight: 500; }
    .drawer-footer { display: flex; gap: 8px; padding: 16px 24px; border-top: 1px solid var(--border); justify-content: flex-end; }
  `],
})
export class HomeworkAdminComponent implements OnInit {
  private api = inject(ApiService);

  loading   = signal(true);
  saving    = signal(false);
  showForm  = signal(false);
  editingId = signal<string | null>(null);
  formError = signal('');
  tasks     = signal<HomeworkTask[]>([]);
  classes   = signal<ClassItem[]>([]);
  filter    = signal<'all' | 'published' | 'draft'>('all');

  form = { title: '', subject: '', description: '', due_date: '', class_id: '' };

  filtered = computed(() => {
    const f = this.filter();
    return this.tasks().filter(t => {
      if (f === 'published') return t.is_published;
      if (f === 'draft')     return !t.is_published;
      return true;
    });
  });

  ngOnInit() {
    this.loadTasks();
    this.api.get<any>('/students/classes').subscribe({
      next: (res: any) => this.classes.set(res.data ?? []),
      error: () => {},
    });
  }

  loadTasks() {
    this.loading.set(true);
    this.api.get<any>('/homework').subscribe({
      next: (res: any) => { this.tasks.set(res.data ?? []); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  openForm(task?: HomeworkTask) {
    if (task) {
      this.editingId.set(task.id);
      this.form = {
        title: task.title,
        subject: task.subject ?? '',
        description: task.description ?? '',
        due_date: task.due_date?.slice(0, 10) ?? '',
        class_id: task.class_id ?? '',
      };
    } else {
      this.editingId.set(null);
      this.form = { title: '', subject: '', description: '', due_date: '', class_id: '' };
    }
    this.formError.set('');
    this.showForm.set(true);
  }

  closeForm() { this.showForm.set(false); }

  save(publishNow: boolean) {
    if (!this.form.title.trim()) { this.formError.set('Title is required.'); return; }
    if (!this.form.due_date)     { this.formError.set('Due date is required.'); return; }
    this.saving.set(true);
    this.formError.set('');

    const payload: any = {
      title: this.form.title.trim(),
      due_date: this.form.due_date,
    };
    if (this.form.subject.trim())     payload['subject'] = this.form.subject.trim();
    if (this.form.description.trim()) payload['description'] = this.form.description.trim();
    if (this.form.class_id)           payload['class_id'] = this.form.class_id;

    const id = this.editingId();
    const req = id
      ? this.api.patch<any>(`/homework/${id}`, payload)
      : this.api.post<any>('/homework', payload);

    req.subscribe({
      next: (res: any) => {
        const saved: HomeworkTask = res.data;
        if (publishNow && !saved.is_published) {
          this.api.patch<any>(`/homework/${saved.id}/publish`, {}).subscribe({
            next: (r: any) => {
              this.upsertTask(r.data);
              this.saving.set(false);
              this.closeForm();
            },
            error: () => { this.upsertTask(saved); this.saving.set(false); this.closeForm(); },
          });
        } else {
          this.upsertTask(saved);
          this.saving.set(false);
          this.closeForm();
        }
      },
      error: (err: any) => {
        this.formError.set(err?.error?.error ?? 'Failed to save task.');
        this.saving.set(false);
      },
    });
  }

  publish(task: HomeworkTask) {
    this.api.patch<any>(`/homework/${task.id}/publish`, {}).subscribe({
      next: (res: any) => this.upsertTask(res.data),
      error: () => {},
    });
  }

  deleteTask(id: string) {
    if (!confirm('Delete this homework task?')) return;
    this.api.delete<any>(`/homework/${id}`).subscribe({
      next: () => this.tasks.update(ts => ts.filter(t => t.id !== id)),
      error: () => {},
    });
  }

  private upsertTask(task: HomeworkTask) {
    this.tasks.update(ts => {
      const idx = ts.findIndex(t => t.id === task.id);
      if (idx >= 0) { const copy = [...ts]; copy[idx] = task; return copy; }
      return [task, ...ts];
    });
  }
}
