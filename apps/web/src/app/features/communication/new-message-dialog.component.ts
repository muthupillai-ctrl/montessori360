import { Component, inject, signal, OnInit } from '@angular/core';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { FormsModule } from '@angular/forms';
import { TitleCasePipe } from '@angular/common';
import { ApiService } from '../../core/services/api.service';

type RecipientMode = 'staff' | 'parent';

interface StaffContact { id: string; name: string; role?: string; email?: string; type: 'staff'; }
interface ClassItem    { id: string; name: string; section?: string; }
interface StudentItem  { id: string; first_name: string; last_name: string; }
interface ParentItem   { id: string; name: string; relation?: string; type: 'parent'; }

@Component({
  selector: 'app-new-message-dialog',
  standalone: true,
  imports: [FormsModule, MatDialogModule, MatIconModule, MatProgressSpinnerModule, TitleCasePipe],
  template: `
    <div class="dialog-shell">

      <div class="dialog-header">
        <div class="dh-icon"><mat-icon>edit</mat-icon></div>
        <div>
          <div class="dh-title">New Message</div>
          <div class="dh-sub">{{ mode() === 'staff' ? 'Message a staff member' : 'Message via student' }}</div>
        </div>
        <button class="dh-close" mat-dialog-close><mat-icon>close</mat-icon></button>
      </div>

      <div class="dialog-body">

        <!-- Mode selector -->
        <div class="mode-selector">
          <button class="mode-btn" [class.active]="mode() === 'staff'" (click)="setMode('staff')">
            <mat-icon style="font-size:18px;width:18px;height:18px">badge</mat-icon>
            Staff Member
          </button>
          <button class="mode-btn" [class.active]="mode() === 'parent'" (click)="setMode('parent')">
            <mat-icon style="font-size:18px;width:18px;height:18px">family_restroom</mat-icon>
            Student's Parent
          </button>
        </div>

        <!-- ── STAFF flow ── -->
        @if (mode() === 'staff') {
          <div class="field-group">
            <label class="field-label">Search Staff</label>
            <div class="search-wrap">
              <mat-icon class="search-icon">search</mat-icon>
              <input class="search-input" [(ngModel)]="staffQuery" (input)="filterStaff()"
                     placeholder="Type a name or role…">
            </div>

            @if (selectedStaff()) {
              <div class="selected-chip">
                <div class="chip-av" [style.background]="color(selectedStaff()!.name)">{{ selectedStaff()!.name[0] }}</div>
                <div class="chip-info">
                  <div class="chip-name">{{ selectedStaff()!.name }}</div>
                  <div class="chip-sub">{{ selectedStaff()!.role | titlecase }}</div>
                </div>
                <button class="chip-rm" (click)="selectedStaff.set(null)">
                  <mat-icon style="font-size:16px;width:16px;height:16px">close</mat-icon>
                </button>
              </div>
            } @else if (staffQuery && filteredStaff().length) {
              <div class="dropdown">
                @for (s of filteredStaff(); track s.id) {
                  <div class="dd-item" (click)="selectedStaff.set(s); staffQuery=''">
                    <div class="dd-av" [style.background]="color(s.name)">{{ s.name[0] }}</div>
                    <div>
                      <div class="dd-name">{{ s.name }}</div>
                      <div class="dd-sub">{{ s.role | titlecase }}</div>
                    </div>
                  </div>
                }
              </div>
            } @else if (staffQuery) {
              <div class="no-results">No staff found</div>
            }
          </div>
        }

        <!-- ── PARENT flow ── -->
        @if (mode() === 'parent') {
          <!-- Step 1: Class -->
          <div class="field-group">
            <label class="field-label">
              <span class="step-num">1</span> Select Class
            </label>
            @if (classesLoading()) {
              <div class="loading-inline"><mat-progress-spinner diameter="18" mode="indeterminate"/></div>
            } @else {
              <select class="select-input" [(ngModel)]="selectedClassId" (ngModelChange)="onClassChange()">
                <option value="">— Choose a class —</option>
                @for (c of classes(); track c.id) {
                  <option [value]="c.id">{{ c.name }}{{ c.section ? ' ' + c.section : '' }}</option>
                }
              </select>
            }
          </div>

          <!-- Step 2: Student -->
          @if (selectedClassId) {
            <div class="field-group">
              <label class="field-label">
                <span class="step-num">2</span> Select Student
              </label>
              @if (studentsLoading()) {
                <div class="loading-inline"><mat-progress-spinner diameter="18" mode="indeterminate"/></div>
              } @else if (!students().length) {
                <div class="no-results">No students in this class</div>
              } @else {
                <select class="select-input" [(ngModel)]="selectedStudentId" (ngModelChange)="onStudentChange()">
                  <option value="">— Choose a student —</option>
                  @for (s of students(); track s.id) {
                    <option [value]="s.id">{{ s.first_name }} {{ s.last_name }}</option>
                  }
                </select>
              }
            </div>
          }

          <!-- Step 3: Parent -->
          @if (selectedStudentId) {
            <div class="field-group">
              <label class="field-label">
                <span class="step-num">3</span> Select Parent
              </label>
              @if (parentsLoading()) {
                <div class="loading-inline"><mat-progress-spinner diameter="18" mode="indeterminate"/></div>
              } @else if (!studentParents().length) {
                <div class="no-portal">
                  <mat-icon style="font-size:18px;width:18px;height:18px;color:var(--amber)">warning</mat-icon>
                  No parent has portal access for this student yet. Invite them first from the student profile.
                </div>
              } @else {
                <div class="parent-list">
                  @for (p of studentParents(); track p.id) {
                    <div class="parent-item" [class.selected]="selectedParent()?.id === p.id"
                         (click)="selectedParent.set(p)">
                      <div class="p-av" [style.background]="color(p.name)">{{ p.name[0] }}</div>
                      <div class="p-info">
                        <div class="p-name">{{ p.name }}</div>
                        <div class="p-rel">{{ p.relation | titlecase }}</div>
                      </div>
                      @if (selectedParent()?.id === p.id) {
                        <mat-icon style="font-size:18px;width:18px;height:18px;color:var(--primary)">check_circle</mat-icon>
                      }
                    </div>
                  }
                </div>
              }
            </div>
          }
        }

        <!-- Message body (shown once recipient is chosen) -->
        @if (recipient()) {
          <div class="field-group">
            <label class="field-label">Message</label>
            <textarea class="msg-input" [(ngModel)]="messageText" rows="4"
                      placeholder="Type your message…"></textarea>
          </div>
        }

        @if (error()) {
          <div class="error-banner">
            <mat-icon style="font-size:15px;width:15px;height:15px;flex-shrink:0">error_outline</mat-icon>
            {{ error() }}
          </div>
        }
      </div>

      <div class="dialog-footer">
        <button class="btn-ghost" mat-dialog-close>Cancel</button>
        <button class="btn-primary" (click)="send()"
                [disabled]="!recipient() || !messageText.trim() || sending()">
          @if (sending()) {
            <mat-progress-spinner diameter="16" mode="indeterminate"
              style="--mdc-circular-progress-active-indicator-color:#fff"/>
          } @else {
            <mat-icon style="font-size:15px;width:15px;height:15px">send</mat-icon>
          }
          Send
        </button>
      </div>
    </div>
  `,
  styles: [`
    .dialog-shell { width: 460px; display: flex; flex-direction: column; max-height: 90vh; }

    .dialog-header {
      display: flex; align-items: center; gap: 12px;
      padding: 16px 20px 12px; border-bottom: 1px solid var(--border); flex-shrink: 0;
    }
    .dh-icon {
      width: 34px; height: 34px; border-radius: 9px;
      background: var(--blue-light); color: var(--blue); flex-shrink: 0;
      display: flex; align-items: center; justify-content: center;
      mat-icon { font-size: 18px; width: 18px; height: 18px; }
    }
    .dh-title { font-size: 15px; font-weight: 600; color: var(--text); }
    .dh-sub   { font-size: 11px; color: var(--text-3); }
    .dh-close {
      margin-left: auto; background: none; border: none;
      width: 28px; height: 28px; border-radius: 6px; cursor: pointer; color: var(--text-3);
      display: flex; align-items: center; justify-content: center;
      &:hover { background: var(--bg); }
      mat-icon { font-size: 18px; width: 18px; height: 18px; }
    }

    .dialog-body { padding: 16px 20px; display: flex; flex-direction: column; gap: 14px; overflow-y: auto; flex: 1; }

    /* Mode selector */
    .mode-selector { display: flex; gap: 8px; }
    .mode-btn {
      flex: 1; display: flex; align-items: center; justify-content: center; gap: 7px;
      padding: 10px; border: 1.5px solid var(--border); border-radius: 10px;
      background: var(--bg); color: var(--text-2); font-size: 13px; font-weight: 500;
      cursor: pointer; transition: all .15s;
      &:hover  { border-color: var(--blue); color: var(--blue); }
      &.active { border-color: var(--blue); background: var(--blue-light); color: var(--blue); font-weight: 600; }
    }

    .field-group { display: flex; flex-direction: column; gap: 6px; }
    .field-label {
      font-size: 12px; font-weight: 500; color: var(--text-2);
      display: flex; align-items: center; gap: 6px;
    }
    .step-num {
      width: 18px; height: 18px; border-radius: 50%; background: var(--blue);
      color: #fff; font-size: 10px; font-weight: 700;
      display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0;
    }

    /* Staff search */
    .search-wrap {
      display: flex; align-items: center; gap: 8px;
      border: 1px solid var(--border); border-radius: 8px; padding: 0 10px; height: 36px;
      &:focus-within { border-color: var(--blue); }
    }
    .search-icon { font-size: 16px; width: 16px; height: 16px; color: var(--text-3); }
    .search-input { flex: 1; border: none; outline: none; font-size: 13px; background: none; font-family: inherit; }

    /* Selected chip */
    .selected-chip {
      display: flex; align-items: center; gap: 10px;
      background: var(--blue-light); border: 1px solid var(--blue-mid); border-radius: 8px; padding: 8px 12px;
    }
    .chip-av { width: 28px; height: 28px; border-radius: 50%; color: #fff; font-size: 11px; font-weight: 700; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
    .chip-name { font-size: 13px; font-weight: 600; color: var(--text); }
    .chip-sub  { font-size: 11px; color: var(--text-3); text-transform: capitalize; }
    .chip-info { flex: 1; }
    .chip-rm   { background: none; border: none; cursor: pointer; color: var(--text-3); width: 24px; height: 24px; border-radius: 4px; display: flex; align-items: center; justify-content: center; &:hover { background: rgba(0,0,0,.06); } }

    /* Dropdown */
    .dropdown { background: #fff; border: 1px solid var(--border); border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,.1); max-height: 180px; overflow-y: auto; }
    .dd-item { display: flex; align-items: center; gap: 10px; padding: 8px 12px; cursor: pointer; border-bottom: 1px solid var(--border-light); &:last-child { border-bottom: none; } &:hover { background: var(--bg); } }
    .dd-av   { width: 26px; height: 26px; border-radius: 50%; color: #fff; font-size: 10px; font-weight: 700; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
    .dd-name { font-size: 13px; font-weight: 500; color: var(--text); }
    .dd-sub  { font-size: 11px; color: var(--text-3); text-transform: capitalize; }
    .no-results { font-size: 12px; color: var(--text-3); padding: 4px 2px; }

    /* Select dropdowns for parent flow */
    .select-input {
      height: 38px; padding: 0 10px; width: 100%;
      border: 1px solid var(--border); border-radius: 8px;
      background: var(--bg); font-size: 13px; color: var(--text); outline: none; cursor: pointer;
      &:focus { border-color: var(--blue); }
    }

    .loading-inline { display: flex; align-items: center; gap: 8px; padding: 4px 0; }

    /* Parent list */
    .parent-list { display: flex; flex-direction: column; gap: 6px; }
    .parent-item {
      display: flex; align-items: center; gap: 10px; padding: 10px 12px;
      border: 1.5px solid var(--border); border-radius: 10px; cursor: pointer; transition: all .15s;
      &:hover   { border-color: var(--blue-mid); background: var(--blue-light); }
      &.selected { border-color: var(--blue); background: var(--blue-light); }
    }
    .p-av   { width: 34px; height: 34px; border-radius: 50%; color: #fff; font-size: 13px; font-weight: 700; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
    .p-name { font-size: 13px; font-weight: 600; color: var(--text); }
    .p-rel  { font-size: 11px; color: var(--text-3); text-transform: capitalize; }
    .p-info { flex: 1; }

    .no-portal { display: flex; align-items: flex-start; gap: 8px; font-size: 12px; color: var(--text-2); line-height: 1.5; background: #FFFBEB; border: 1px solid #FCD34D; border-radius: 8px; padding: 10px 12px; }

    /* Message textarea */
    .msg-input {
      width: 100%; padding: 8px 10px; border: 1px solid var(--border); border-radius: 8px;
      font-size: 13px; color: var(--text); outline: none; resize: vertical;
      font-family: inherit; min-height: 80px;
      &:focus { border-color: var(--blue); }
      &::placeholder { color: var(--text-4); }
    }

    .error-banner {
      display: flex; align-items: center; gap: 8px;
      background: var(--red-light); border: 1px solid #FECACA;
      color: #991B1B; padding: 10px 12px; border-radius: 8px; font-size: 12px;
    }

    .dialog-footer {
      display: flex; justify-content: flex-end; gap: 8px;
      padding: 12px 20px; border-top: 1px solid var(--border); background: var(--bg); flex-shrink: 0;
    }
    .btn-ghost    { background: none; border: none; cursor: pointer; font-size: 13px; color: var(--text-3); padding: 0 10px; height: 36px; border-radius: 7px; &:hover { background: var(--border-light); } }
    .btn-primary  {
      display: flex; align-items: center; gap: 6px;
      background: var(--blue); color: #fff; border: none; border-radius: 8px;
      height: 36px; padding: 0 18px; font-size: 13px; font-weight: 500; cursor: pointer;
      &:hover:not(:disabled) { background: #1D4ED8; }
      &:disabled { opacity: .6; cursor: not-allowed; }
    }
  `],
})
export class NewMessageDialogComponent implements OnInit {
  private api       = inject(ApiService);
  private dialogRef = inject(MatDialogRef<NewMessageDialogComponent>);

  mode            = signal<RecipientMode>('staff');
  staffContacts   = signal<StaffContact[]>([]);
  filteredStaff   = signal<StaffContact[]>([]);
  selectedStaff   = signal<StaffContact | null>(null);
  staffQuery      = '';

  classes         = signal<ClassItem[]>([]);
  classesLoading  = signal(false);
  selectedClassId = '';

  students        = signal<StudentItem[]>([]);
  studentsLoading = signal(false);
  selectedStudentId = '';

  studentParents  = signal<ParentItem[]>([]);
  parentsLoading  = signal(false);
  selectedParent  = signal<ParentItem | null>(null);

  messageText = '';
  sending     = signal(false);
  error       = signal('');

  // The actual recipient to send to (staff OR parent)
  recipient() {
    if (this.mode() === 'staff') return this.selectedStaff();
    return this.selectedParent();
  }

  ngOnInit() {
    this.loadStaffContacts();
  }

  setMode(m: RecipientMode) {
    this.mode.set(m);
    this.error.set('');
    if (m === 'parent' && !this.classes().length) this.loadClasses();
  }

  loadStaffContacts() {
    this.api.get<any>('/communication/messages/contacts').subscribe({
      next: (res: any) => this.staffContacts.set(res.data ?? []),
      error: () => {},
    });
  }

  filterStaff() {
    const q = this.staffQuery.toLowerCase();
    if (!q) { this.filteredStaff.set([]); return; }
    this.filteredStaff.set(
      this.staffContacts().filter(c =>
        c.name.toLowerCase().includes(q) || (c.role ?? '').toLowerCase().includes(q)
      ).slice(0, 8)
    );
  }

  loadClasses() {
    this.classesLoading.set(true);
    this.api.get<any>('/students/classes').subscribe({
      next: (res: any) => { this.classes.set(res.data ?? []); this.classesLoading.set(false); },
      error: () => this.classesLoading.set(false),
    });
  }

  onClassChange() {
    this.selectedStudentId = '';
    this.students.set([]);
    this.selectedParent.set(null);
    this.studentParents.set([]);
    if (!this.selectedClassId) return;
    this.studentsLoading.set(true);
    this.api.get<any>('/students', { class_id: this.selectedClassId, limit: '200' }).subscribe({
      next: (res: any) => {
        this.students.set(res.data ?? []);
        this.studentsLoading.set(false);
      },
      error: () => this.studentsLoading.set(false),
    });
  }

  onStudentChange() {
    this.selectedParent.set(null);
    this.studentParents.set([]);
    this.error.set('');
    if (!this.selectedStudentId) return;
    this.parentsLoading.set(true);
    this.api.get<any>(`/communication/messages/student-parents/${this.selectedStudentId}`).subscribe({
      next: (res: any) => { this.studentParents.set(res.data ?? []); this.parentsLoading.set(false); },
      error: (err: any) => {
        this.parentsLoading.set(false);
        this.error.set(err?.error?.error?.message ?? err?.message ?? 'Could not load parents. Check console for details.');
        console.error('[NewMsg] student-parents error', err);
      },
    });
  }

  color(name: string): string {
    const colors = ['#2563EB','#7C3AED','#DB2777','#D97706','#059669','#0891B2'];
    return colors[(name?.charCodeAt(0) || 0) % colors.length];
  }

  send() {
    const r = this.recipient();
    if (!r || !this.messageText.trim()) return;
    this.sending.set(true);
    this.error.set('');

    this.api.post<any>('/communication/messages', {
      recipient_id:   r.id,
      recipient_type: r.type,
      body:           this.messageText.trim(),
    }).subscribe({
      next: (res: any) => {
        this.sending.set(false);
        this.dialogRef.close({ contact: r, message: res.data });
      },
      error: (err: any) => {
        this.sending.set(false);
        this.error.set(err.error?.error?.message ?? 'Failed to send message.');
      },
    });
  }
}
