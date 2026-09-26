import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { ApiService } from '../../core/services/api.service';

interface Area {
  id: string; name: string; description: string | null;
  icon: string; color: string; sequence: number; activity_count?: number;
}
interface Activity {
  id: string; area_id: string; name: string; description: string | null;
  material_name: string | null; sequence: number;
  level: 'casa' | 'lower_el' | 'upper_el'; prerequisite_id: string | null;
}

const LEVEL_LABELS: Record<string, string> = {
  casa: 'Casa (3–6)', lower_el: 'Lower El (6–9)', upper_el: 'Upper El (9–12)',
};

@Component({
  selector: 'ams-curriculum',
  standalone: true,
  imports: [FormsModule, MatSnackBarModule],
  template: `
<div class="page-header">
  <div>
    <h1>Curriculum</h1>
    <p class="page-sub">Manage curriculum areas and activities</p>
  </div>
  <div class="header-actions">
    @if (!seeded()) {
      <button class="btn btn-outline" (click)="seed()" [disabled]="seeding()">
        {{ seeding() ? 'Seeding…' : '✨ Load default curriculum' }}
      </button>
    }
    <button class="btn btn-primary" (click)="openAreaPanel(null)">+ Add area</button>
  </div>
</div>

@if (loading()) {
  <div class="empty-state"><div class="spinner"></div></div>
}

@for (area of areas(); track area.id) {
  <div class="area-card">
    <div class="area-header" (click)="toggleArea(area.id)">
      <div class="area-title">
        <span class="area-dot" [style.background]="area.color">{{ area.icon }}</span>
        <div>
          <div class="area-name">{{ area.name }}</div>
          <div class="area-meta">{{ area.activity_count ?? 0 }} activities</div>
        </div>
      </div>
      <div class="area-actions" (click)="$event.stopPropagation()">
        <button class="icon-btn" title="Add activity" (click)="openActivityPanel(area, null)">+</button>
        <button class="icon-btn" title="Edit area" (click)="openAreaPanel(area)">✏️</button>
        <button class="icon-btn icon-btn-danger" title="Delete area" (click)="deleteArea(area)">🗑</button>
      </div>
      <span class="area-chevron">{{ expandedAreas().has(area.id) ? '▾' : '▸' }}</span>
    </div>

    @if (expandedAreas().has(area.id)) {
      <div class="activity-table-wrap">
        @if (activityMap()[area.id] === undefined) {
          <div class="act-loading">Loading…</div>
        } @else if (!activityMap()[area.id]?.length) {
          <div class="act-empty">No activities yet. Click + to add one.</div>
        } @else {
          <table class="data-table">
            <thead>
              <tr>
                <th>#</th><th>Name</th><th>Material</th><th>Level</th><th></th>
              </tr>
            </thead>
            <tbody>
              @for (act of activityMap()[area.id]; track act.id) {
                <tr>
                  <td class="seq-cell">{{ act.sequence }}</td>
                  <td>{{ act.name }}
                    @if (act.description) {
                      <div class="act-desc">{{ act.description }}</div>
                    }
                  </td>
                  <td class="muted">{{ act.material_name ?? '—' }}</td>
                  <td><span class="level-badge level-{{ act.level }}">{{ levelLabel(act.level) }}</span></td>
                  <td class="row-actions">
                    <button class="icon-btn" (click)="openActivityPanel(area, act)">✏️</button>
                    <button class="icon-btn icon-btn-danger" (click)="deleteActivity(area, act)">🗑</button>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        }
      </div>
    }
  </div>
}

@if (!loading() && !areas().length) {
  <div class="empty-state">
    <div class="empty-icon">🗂️</div>
    <div class="empty-title">No curriculum yet</div>
    <div class="empty-sub">Click "Load default curriculum" to get started with the standard Montessori areas, or add your own.</div>
  </div>
}

<!-- ── Area slide-in panel ── -->
@if (areaPanel()) {
  <div class="backdrop" (click)="closePanel()"></div>
  <div class="panel">
    <div class="panel-header">
      <h3>{{ editingArea() ? 'Edit area' : 'New area' }}</h3>
      <button class="panel-close" (click)="closePanel()">✕</button>
    </div>
    <div class="panel-body">
      <label>Name *</label>
      <input [(ngModel)]="form.name" placeholder="e.g. Practical Life" />

      <label>Description</label>
      <textarea [(ngModel)]="form.description" rows="2" placeholder="Optional"></textarea>

      <div class="row-2">
        <div>
          <label>Icon</label>
          <input [(ngModel)]="form.icon" placeholder="🏠" maxlength="4" />
        </div>
        <div>
          <label>Colour</label>
          <input type="color" [(ngModel)]="form.color" style="height:34px;padding:2px 4px" />
        </div>
        <div>
          <label>Order</label>
          <input type="number" [(ngModel)]="form.sequence" min="1" />
        </div>
      </div>
    </div>
    <div class="panel-footer">
      <button class="btn btn-outline" (click)="closePanel()">Cancel</button>
      <button class="btn btn-primary" (click)="saveArea()" [disabled]="saving()">
        {{ saving() ? 'Saving…' : 'Save' }}
      </button>
    </div>
  </div>
}

<!-- ── Activity slide-in panel ── -->
@if (activityPanel()) {
  <div class="backdrop" (click)="closePanel()"></div>
  <div class="panel">
    <div class="panel-header">
      <h3>{{ editingActivity() ? 'Edit activity' : 'New activity' }}</h3>
      <button class="panel-close" (click)="closePanel()">✕</button>
    </div>
    <div class="panel-body">
      <label>Name *</label>
      <input [(ngModel)]="actForm.name" placeholder="e.g. Pink Tower" />

      <label>Description</label>
      <textarea [(ngModel)]="actForm.description" rows="2" placeholder="Optional"></textarea>

      <label>Material name</label>
      <input [(ngModel)]="actForm.material_name" placeholder="e.g. Pink Tower" />

      <div class="row-2">
        <div>
          <label>Level</label>
          <select [(ngModel)]="actForm.level">
            <option value="casa">Casa (3–6)</option>
            <option value="lower_el">Lower El (6–9)</option>
            <option value="upper_el">Upper El (9–12)</option>
          </select>
        </div>
        <div>
          <label>Order</label>
          <input type="number" [(ngModel)]="actForm.sequence" min="1" />
        </div>
      </div>
    </div>
    <div class="panel-footer">
      <button class="btn btn-outline" (click)="closePanel()">Cancel</button>
      <button class="btn btn-primary" (click)="saveActivity()" [disabled]="saving()">
        {{ saving() ? 'Saving…' : 'Save' }}
      </button>
    </div>
  </div>
}
  `,
  styles: [`
    :host { display: block; }

    .page-header {
      display: flex; align-items: flex-start; justify-content: space-between;
      margin-bottom: 18px; gap: 12px; flex-wrap: wrap;
    }
    h1 { font-size: 18px; font-weight: 600; margin: 0 0 2px; }
    .page-sub { font-size: 12px; color: var(--muted); margin: 0; }
    .header-actions { display: flex; gap: 8px; align-items: center; }

    /* ── Area card ── */
    .area-card {
      background: #fff; border: 1px solid var(--border); border-radius: 8px;
      margin-bottom: 8px; overflow: hidden;
    }
    .area-header {
      display: flex; align-items: center; gap: 12px;
      padding: 12px 14px; cursor: pointer;
      transition: background .1s;
      &:hover { background: var(--bg); }
    }
    .area-title { display: flex; align-items: center; gap: 10px; flex: 1; min-width: 0; }
    .area-dot {
      width: 34px; height: 34px; border-radius: 8px; flex-shrink: 0;
      display: flex; align-items: center; justify-content: center;
      font-size: 17px;
    }
    .area-name { font-size: 13px; font-weight: 500; }
    .area-meta { font-size: 11px; color: var(--muted); margin-top: 1px; }
    .area-actions { display: flex; gap: 4px; }
    .area-chevron { font-size: 13px; color: var(--muted); flex-shrink: 0; }

    /* ── Activities table ── */
    .activity-table-wrap { border-top: 1px solid var(--border); background: var(--bg); }
    .act-loading, .act-empty {
      padding: 14px 20px; font-size: 12px; color: var(--muted);
    }
    .seq-cell { width: 36px; color: var(--muted); text-align: center; }
    .act-desc { font-size: 11px; color: var(--muted); margin-top: 2px; }
    .level-badge {
      font-size: 10px; padding: 2px 8px; border-radius: 20px; white-space: nowrap;
      font-weight: 500;
    }
    .level-casa    { background: #ede9fe; color: #7c3aed; }
    .level-lower_el { background: #d1fae5; color: #065f46; }
    .level-upper_el { background: #dbeafe; color: #1e40af; }
    .muted { color: var(--muted); font-size: 12px; }

    /* ── Buttons ── */
    .icon-btn {
      background: none; border: none; cursor: pointer; padding: 4px 7px;
      border-radius: 5px; font-size: 13px; color: var(--muted);
      transition: background .1s;
      &:hover { background: var(--border); color: var(--text); }
    }
    .icon-btn-danger:hover { background: #fee2e2; color: #dc2626; }
    .row-actions { white-space: nowrap; }

    /* ── Empty state ── */
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

    /* ── data table ── */
    .data-table {
      width: 100%; border-collapse: collapse;
      th, td {
        padding: 8px 12px; font-size: 12px; text-align: left;
        border-bottom: 1px solid var(--border);
      }
      th { font-weight: 600; color: var(--muted); background: #fff; font-size: 11px; }
      tr:last-child td { border-bottom: none; }
    }

    /* ── Panel ── */
    .backdrop {
      position: fixed; inset: 0; background: rgba(0,0,0,.35); z-index: 100;
    }
    .panel {
      position: fixed; top: 0; right: 0; height: 100vh; width: 380px;
      background: #fff; z-index: 101; display: flex; flex-direction: column;
      box-shadow: -4px 0 24px rgba(0,0,0,.12);
    }
    .panel-header {
      display: flex; align-items: center; justify-content: space-between;
      padding: 16px 20px; border-bottom: 1px solid var(--border); flex-shrink: 0;
      h3 { margin: 0; font-size: 14px; font-weight: 600; }
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
      input, select, textarea {
        width: 100%; box-sizing: border-box;
        border: 1px solid var(--border); border-radius: 6px;
        padding: 7px 10px; font-size: 13px; color: var(--text);
        background: #fff;
        &:focus { outline: none; border-color: var(--purple); }
      }
      textarea { resize: vertical; }
    }
    .row-2 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; }
    .panel-footer {
      padding: 14px 20px; border-top: 1px solid var(--border);
      display: flex; justify-content: flex-end; gap: 8px; flex-shrink: 0;
    }
    .btn { padding: 7px 16px; border-radius: 6px; font-size: 13px; cursor: pointer; border: none; }
    .btn-primary { background: var(--purple); color: #fff; &:hover { opacity: .9; } &:disabled { opacity: .6; } }
    .btn-outline { background: #fff; border: 1px solid var(--border); color: var(--text); &:hover { background: var(--bg); } }
  `],
})
export class CurriculumComponent implements OnInit {
  private api  = inject(ApiService);
  private snack = inject(MatSnackBar);

  areas       = signal<Area[]>([]);
  activityMap = signal<Record<string, Activity[]>>({});
  expandedAreas = signal<Set<string>>(new Set());

  loading = signal(true);
  saving  = signal(false);
  seeding = signal(false);
  seeded  = computed(() => this.areas().length > 0);

  areaPanel     = signal(false);
  activityPanel = signal(false);
  editingArea     = signal<Area | null>(null);
  editingActivity = signal<Activity | null>(null);
  currentArea     = signal<Area | null>(null);

  form    = { name: '', description: '', icon: '📌', color: '#7C3AED', sequence: 0 };
  actForm: { name: string; description: string; material_name: string; level: 'casa' | 'lower_el' | 'upper_el'; sequence: number } =
    { name: '', description: '', material_name: '', level: 'casa', sequence: 0 };

  levelLabel(l: string) { return LEVEL_LABELS[l] ?? l; }

  ngOnInit() { this.loadAreas(); }

  loadAreas() {
    this.loading.set(true);
    this.api.get<Area[]>('/curriculum/areas').subscribe({
      next: rows => { this.areas.set(rows); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  toggleArea(id: string) {
    const set = new Set(this.expandedAreas());
    if (set.has(id)) { set.delete(id); this.expandedAreas.set(set); return; }
    set.add(id);
    this.expandedAreas.set(set);
    const map = this.activityMap();
    if (map[id] === undefined) {
      this.activityMap.update(m => ({ ...m, [id]: undefined as any }));
      this.api.get<Activity[]>(`/curriculum/areas/${id}/activities`).subscribe({
        next: acts => this.activityMap.update(m => ({ ...m, [id]: acts })),
      });
    }
  }

  // ── Area panel ──

  openAreaPanel(area: Area | null) {
    this.editingArea.set(area);
    if (area) {
      this.form = { name: area.name, description: area.description ?? '', icon: area.icon, color: area.color, sequence: area.sequence };
    } else {
      this.form = { name: '', description: '', icon: '📌', color: '#7C3AED', sequence: (this.areas().length + 1) };
    }
    this.areaPanel.set(true);
  }

  saveArea() {
    if (!this.form.name.trim()) return;
    this.saving.set(true);
    const dto = { name: this.form.name.trim(), description: this.form.description || null,
      icon: this.form.icon, color: this.form.color, sequence: this.form.sequence };
    const editing = this.editingArea();
    const req$ = editing
      ? this.api.patch<Area>(`/curriculum/areas/${editing.id}`, dto)
      : this.api.post<Area>('/curriculum/areas', dto);
    req$.subscribe({
      next: () => { this.snack.open('Area saved', '', { duration: 2000 }); this.closePanel(); this.loadAreas(); },
      error: () => { this.saving.set(false); this.snack.open('Save failed', '', { duration: 3000 }); },
    });
  }

  deleteArea(area: Area) {
    if (!confirm(`Delete "${area.name}" and all its activities?`)) return;
    this.api.delete(`/curriculum/areas/${area.id}`).subscribe({
      next: () => { this.snack.open('Area deleted', '', { duration: 2000 }); this.loadAreas(); },
    });
  }

  // ── Activity panel ──

  openActivityPanel(area: Area, act: Activity | null) {
    this.currentArea.set(area);
    this.editingActivity.set(act);
    if (act) {
      this.actForm = { name: act.name, description: act.description ?? '', material_name: act.material_name ?? '', level: act.level, sequence: act.sequence };
    } else {
      const existing = this.activityMap()[area.id] ?? [];
      this.actForm = { name: '', description: '', material_name: '', level: 'casa', sequence: existing.length + 1 };
    }
    this.activityPanel.set(true);
  }

  saveActivity() {
    if (!this.actForm.name.trim()) return;
    this.saving.set(true);
    const area = this.currentArea()!;
    const editing = this.editingActivity();
    const dto = { name: this.actForm.name.trim(), description: this.actForm.description || null,
      material_name: this.actForm.material_name || null, level: this.actForm.level, sequence: this.actForm.sequence };
    const req$ = editing
      ? this.api.patch<Activity>(`/curriculum/areas/${area.id}/activities/${editing.id}`, dto)
      : this.api.post<Activity>(`/curriculum/areas/${area.id}/activities`, dto);
    req$.subscribe({
      next: () => {
        this.snack.open('Activity saved', '', { duration: 2000 });
        this.closePanel();
        // reload activities for this area
        this.api.get<Activity[]>(`/curriculum/areas/${area.id}/activities`).subscribe({
          next: acts => this.activityMap.update(m => ({ ...m, [area.id]: acts })),
        });
        this.loadAreas();
      },
      error: () => { this.saving.set(false); this.snack.open('Save failed', '', { duration: 3000 }); },
    });
  }

  deleteActivity(area: Area, act: Activity) {
    if (!confirm(`Delete "${act.name}"?`)) return;
    this.api.delete(`/curriculum/areas/${area.id}/activities/${act.id}`).subscribe({
      next: () => {
        this.snack.open('Activity deleted', '', { duration: 2000 });
        this.api.get<Activity[]>(`/curriculum/areas/${area.id}/activities`).subscribe({
          next: acts => this.activityMap.update(m => ({ ...m, [area.id]: acts })),
        });
        this.loadAreas();
      },
    });
  }

  seed() {
    this.seeding.set(true);
    this.api.post<any>('/curriculum/seed').subscribe({
      next: r => {
        this.seeding.set(false);
        this.snack.open(r.message, '', { duration: 3000 });
        this.loadAreas();
      },
      error: () => { this.seeding.set(false); this.snack.open('Seed failed', '', { duration: 3000 }); },
    });
  }

  closePanel() {
    this.areaPanel.set(false);
    this.activityPanel.set(false);
    this.saving.set(false);
    this.editingArea.set(null);
    this.editingActivity.set(null);
    this.currentArea.set(null);
  }
}
