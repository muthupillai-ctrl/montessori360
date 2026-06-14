import { Component, inject, signal, Input, OnChanges, SimpleChanges, computed } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';
import { DatePipe, DecimalPipe, TitleCasePipe } from '@angular/common';
import { ApiService } from '../../core/services/api.service';
import { AuthService } from '../../core/services/auth.service';

const ROLE_CONFIG: Record<string, { label: string; color: string; bg: string; banner: string }> = {
  owner:             { label: 'Owner',           color: '#1D4ED8', bg: '#EFF6FF', banner: '#1E3A8A' },
  principal:         { label: 'Principal',       color: '#5B21B6', bg: '#F5F3FF', banner: '#4C1D95' },
  teacher:           { label: 'Teacher',         color: '#065F46', bg: '#ECFDF5', banner: '#064E3B' },
  assistant_teacher: { label: 'Asst. Teacher',   color: '#065F46', bg: '#ECFDF5', banner: '#064E3B' },
  accountant:        { label: 'Accountant',      color: '#92400E', bg: '#FFFBEB', banner: '#78350F' },
  admission_staff:   { label: 'Admission Staff', color: '#0891B2', bg: '#ECFEFF', banner: '#0C4A6E' },
  driver:            { label: 'Driver',          color: '#B45309', bg: '#FFF7ED', banner: '#92400E' },
  support:           { label: 'Support',         color: '#374151', bg: '#F9FAFB', banner: '#1F2937' },
};

@Component({
  selector: 'app-staff-profile',
  standalone: true,
  imports: [ MatIconModule, MatProgressSpinnerModule, DatePipe, DecimalPipe, TitleCasePipe ],
  template: `
    <!-- Backdrop -->
    @if (visible()) {
      <div class="backdrop" (click)="close()"></div>
    }

    <!-- Slide-over panel -->
    <div class="panel" [class.open]="visible()">

      @if (loading()) {
        <div class="panel-loading">
          <mat-progress-spinner mode="indeterminate" diameter="32"/>
        </div>
      } @else if (staff()) {

        <!-- Banner header -->
        <div class="panel-banner" [style.background]="roleCfg().banner">
          <button class="close-btn" (click)="close()">
            <mat-icon>close</mat-icon>
          </button>
          <div class="pb-av" [style.background]="getColor(staff()!.first_name)">
            {{ staff()!.first_name[0] }}{{ staff()!.last_name[0] }}
          </div>
          <div class="pb-name">{{ staff()!.first_name }} {{ staff()!.last_name }}</div>
          <div class="pb-badges">
            <span class="role-pill" [style.background]="roleCfg().bg" [style.color]="roleCfg().color">
              {{ roleCfg().label }}
            </span>
            @if (staff()!.designation) {
              <span class="desig-pill">{{ staff()!.designation }}</span>
            }
            <span class="status-pill" [class.active]="staff()!.is_active">
              {{ staff()!.is_active ? 'Active' : 'Inactive' }}
            </span>
          </div>
          @if (staff()!.employee_no) {
            <div class="pb-empno">{{ staff()!.employee_no }}</div>
          }
        </div>

        <!-- Panel body -->
        <div class="panel-body">

          <!-- Contact -->
          <div class="section">
            <div class="section-title">
              <mat-icon>contacts</mat-icon> Contact
            </div>
            <div class="info-rows">
              <div class="ir">
                <mat-icon class="ir-icon" style="color:var(--blue)">email</mat-icon>
                <div class="ir-info">
                  <div class="ir-label">Email</div>
                  <div class="ir-val">{{ staff()!.email }}</div>
                </div>
              </div>
              @if (staff()!.phone) {
                <div class="ir">
                  <mat-icon class="ir-icon" style="color:var(--green)">phone</mat-icon>
                  <div class="ir-info">
                    <div class="ir-label">Phone</div>
                    <div class="ir-val">{{ staff()!.phone }}</div>
                  </div>
                </div>
              }
              @if (staff()!.address) {
                <div class="ir">
                  <mat-icon class="ir-icon" style="color:var(--text-3)">home</mat-icon>
                  <div class="ir-info">
                    <div class="ir-label">Address</div>
                    <div class="ir-val">{{ staff()!.address }}</div>
                  </div>
                </div>
              }
              @if (staff()!.dob && isAdmin()) {
                <div class="ir">
                  <mat-icon class="ir-icon" style="color:var(--amber)">cake</mat-icon>
                  <div class="ir-info">
                    <div class="ir-label">Date of Birth</div>
                    <div class="ir-val">{{ staff()!.dob | date:'d MMMM yyyy' }}</div>
                  </div>
                </div>
              }
            </div>
          </div>

          <!-- Employment -->
          <div class="section">
            <div class="section-title">
              <mat-icon>work</mat-icon> Employment
            </div>
            <div class="info-rows">
              @if (staff()!.department) {
                <div class="ir">
                  <mat-icon class="ir-icon" style="color:var(--purple)">business</mat-icon>
                  <div class="ir-info">
                    <div class="ir-label">Department</div>
                    <div class="ir-val">{{ staff()!.department }}</div>
                  </div>
                </div>
              }
              @if (staff()!.joining_date) {
                <div class="ir">
                  <mat-icon class="ir-icon" style="color:var(--blue)">calendar_today</mat-icon>
                  <div class="ir-info">
                    <div class="ir-label">Joined</div>
                    <div class="ir-val">{{ staff()!.joining_date | date:'d MMM yyyy' }}</div>
                  </div>
                </div>
              }
              @if (staff()!.salary && isAdmin()) {
                <div class="ir">
                  <mat-icon class="ir-icon" style="color:var(--green)">payments</mat-icon>
                  <div class="ir-info">
                    <div class="ir-label">Salary</div>
                    <div class="ir-val">₹{{ staff()!.salary | number:'1.0-0' }} / month</div>
                  </div>
                </div>
              }
              @if (staff()!.pay_frequency) {
                <div class="ir">
                  <mat-icon class="ir-icon" style="color:var(--text-3)">schedule</mat-icon>
                  <div class="ir-info">
                    <div class="ir-label">Pay Frequency</div>
                    <div class="ir-val">{{ staff()!.pay_frequency | titlecase }}</div>
                  </div>
                </div>
              }
            </div>
          </div>

          <!-- Banking (admin only) -->
          @if (isAdmin() && (staff()!.bank_account || staff()!.pan_no || staff()!.aadhar_no)) {
            <div class="section">
              <div class="section-title">
                <mat-icon>account_balance</mat-icon> Banking & ID
              </div>
              <div class="info-rows">
                @if (staff()!.bank_account) {
                  <div class="ir">
                    <mat-icon class="ir-icon" style="color:var(--blue)">credit_card</mat-icon>
                    <div class="ir-info">
                      <div class="ir-label">Bank Account</div>
                      <div class="ir-val mono">****{{ staff()!.bank_account.slice(-4) }}</div>
                    </div>
                  </div>
                }
                @if (staff()!.bank_ifsc) {
                  <div class="ir">
                    <mat-icon class="ir-icon" style="color:var(--text-3)">account_balance</mat-icon>
                    <div class="ir-info">
                      <div class="ir-label">IFSC</div>
                      <div class="ir-val mono">{{ staff()!.bank_ifsc }}</div>
                    </div>
                  </div>
                }
                @if (staff()!.pan_no) {
                  <div class="ir">
                    <mat-icon class="ir-icon" style="color:var(--amber)">badge</mat-icon>
                    <div class="ir-info">
                      <div class="ir-label">PAN</div>
                      <div class="ir-val mono">{{ staff()!.pan_no }}</div>
                    </div>
                  </div>
                }
                @if (staff()!.aadhar_no) {
                  <div class="ir">
                    <mat-icon class="ir-icon" style="color:var(--text-3)">fingerprint</mat-icon>
                    <div class="ir-info">
                      <div class="ir-label">Aadhar</div>
                      <div class="ir-val mono">****{{ staff()!.aadhar_no.slice(-4) }}</div>
                    </div>
                  </div>
                }
              </div>
            </div>
          }

          <!-- Emergency contact (admin only) -->
          @if (isAdmin() && staff()!.emergency_contact?.name) {
            <div class="section">
              <div class="section-title">
                <mat-icon>emergency</mat-icon> Emergency Contact
              </div>
              <div class="info-rows">
                <div class="ir">
                  <mat-icon class="ir-icon" style="color:var(--red)">person</mat-icon>
                  <div class="ir-info">
                    <div class="ir-label">Name</div>
                    <div class="ir-val">
                      {{ staff()!.emergency_contact.name }}
                      @if (staff()!.emergency_contact.relation) {
                        <span class="rel-tag">{{ staff()!.emergency_contact.relation }}</span>
                      }
                    </div>
                  </div>
                </div>
                @if (staff()!.emergency_contact.phone) {
                  <div class="ir">
                    <mat-icon class="ir-icon" style="color:var(--green)">phone</mat-icon>
                    <div class="ir-info">
                      <div class="ir-label">Phone</div>
                      <div class="ir-val">{{ staff()!.emergency_contact.phone }}</div>
                    </div>
                  </div>
                }
              </div>
            </div>
          }

          <!-- Qualifications -->
          @if (staff()!.qualifications?.length) {
            <div class="section">
              <div class="section-title">
                <mat-icon>school</mat-icon> Qualifications
              </div>
              <div class="qual-list">
                @for (q of staff()!.qualifications; track q.degree) {
                  <div class="qual-card">
                    <div class="qual-icon">🎓</div>
                    <div class="qual-info">
                      <div class="qual-degree">{{ q.degree }}</div>
                      <div class="qual-inst">{{ q.institution }}
                        @if (q.year) { · {{ q.year }} }
                      </div>
                    </div>
                  </div>
                }
              </div>
            </div>
          }

        </div>
      }
    </div>
  `,
  styles: [`
    /* Slide panel */
    .backdrop {
      position: fixed; inset: 0; background: rgba(0,0,0,.3);
      z-index: 900; backdrop-filter: blur(2px);
    }
    .panel {
      position: fixed; top: 0; right: 0; bottom: 0;
      width: 400px; max-width: 95vw;
      background: var(--bg); z-index: 901;
      display: flex; flex-direction: column;
      transform: translateX(100%);
      transition: transform .28s cubic-bezier(.4,0,.2,1);
      box-shadow: -8px 0 32px rgba(0,0,0,.12);
      &.open { transform: translateX(0); }
    }
    .panel-loading { display: flex; justify-content: center; padding: 60px; }

    /* Banner */
    .panel-banner {
      display: flex; flex-direction: column; align-items: center;
      padding: 12px 20px 20px; flex-shrink: 0; position: relative;
    }
    .close-btn {
      position: absolute; top: 10px; right: 10px;
      background: rgba(255,255,255,.2); border: none; cursor: pointer;
      color: #fff; width: 30px; height: 30px; border-radius: 7px;
      display: flex; align-items: center; justify-content: center;
      mat-icon { font-size: 18px; width: 18px; height: 18px; }
      &:hover { background: rgba(255,255,255,.3); }
    }
    .pb-av {
      width: 72px; height: 72px; border-radius: 18px;
      color: #fff; font-size: 24px; font-weight: 700;
      display: flex; align-items: center; justify-content: center;
      border: 3px solid rgba(255,255,255,.3);
      box-shadow: 0 8px 24px rgba(0,0,0,.15); margin-bottom: 10px;
    }
    .pb-name   { font-size: 20px; font-weight: 700; color: #fff; }
    .pb-badges { display: flex; gap: 6px; margin-top: 8px; flex-wrap: wrap; justify-content: center; }
    .role-pill  { font-size: 11px; font-weight: 700; padding: 3px 10px; border-radius: 20px; }
    .desig-pill { font-size: 11px; color: rgba(255,255,255,.8); background: rgba(255,255,255,.15); padding: 3px 10px; border-radius: 20px; }
    .status-pill { font-size: 11px; font-weight: 600; padding: 3px 10px; border-radius: 20px; background: rgba(255,255,255,.15); color: rgba(255,255,255,.7); &.active { background: #DCFCE7; color: #065F46; } }
    .pb-empno  { font-size: 11px; color: rgba(255,255,255,.6); margin-top: 6px; font-family: monospace; }

    /* Body */
    .panel-body { flex: 1; overflow-y: auto; padding: 12px 14px; display: flex; flex-direction: column; gap: 10px; }

    /* Sections */
    .section { background: var(--surface); border: 1px solid var(--border); border-radius: 10px; overflow: hidden; }
    .section-title {
      display: flex; align-items: center; gap: 7px;
      padding: 9px 14px; background: var(--bg);
      border-bottom: 1px solid var(--border-light);
      font-size: 12px; font-weight: 600; color: var(--text);
      mat-icon { font-size: 15px; width: 15px; height: 15px; color: var(--text-3); }
    }

    /* Info rows */
    .info-rows { padding: 4px 0; }
    .ir { display: flex; align-items: flex-start; gap: 12px; padding: 9px 14px; border-bottom: 1px solid var(--border-light); &:last-child { border-bottom: none; } }
    .ir-icon { font-size: 16px; width: 16px; height: 16px; flex-shrink: 0; margin-top: 2px; }
    .ir-label { font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: .3px; color: var(--text-4); margin-bottom: 2px; }
    .ir-val   { font-size: 13px; color: var(--text); display: flex; align-items: center; gap: 7px; flex-wrap: wrap; }
    .mono { font-family: monospace; letter-spacing: .5px; }
    .rel-tag { font-size: 10px; font-weight: 600; padding: 1px 6px; border-radius: 10px; background: var(--border-light); color: var(--text-3); }

    /* Qualifications */
    .qual-list { padding: 8px 14px; display: flex; flex-direction: column; gap: 8px; }
    .qual-card { display: flex; align-items: flex-start; gap: 10px; padding: 8px; background: var(--bg); border-radius: 8px; }
    .qual-icon   { font-size: 20px; flex-shrink: 0; }
    .qual-degree { font-size: 13px; font-weight: 600; color: var(--text); }
    .qual-inst   { font-size: 11px; color: var(--text-3); margin-top: 2px; }
  `],
})
export class StaffProfileDialogComponent implements OnChanges {
  private api  = inject(ApiService);
  private auth = inject(AuthService);

  @Input() staffId: string | null = null;

  visible = signal(false);
  loading = signal(false);
  staff   = signal<any | null>(null);

  isAdmin = () => ['owner', 'principal'].includes(this.auth.user()?.role ?? '');

  roleCfg = computed(() => {
    const r = this.staff()?.role ?? '';
    return ROLE_CONFIG[r] ?? { label: r, color: '#6B7280', bg: '#F9FAFB', banner: '#374151' };
  });

  ngOnChanges(changes: SimpleChanges) {
    if (changes['staffId'] && this.staffId) {
      this.open(this.staffId);
    }
  }

  open(id: string) {
    this.visible.set(true);
    this.loading.set(true);
    this.staff.set(null);
    this.api.get<any>('/staff/' + id).subscribe({
      next: (res: any) => { this.staff.set(res.data); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  close() { this.visible.set(false); }

  getColor(name: string): string {
    const colors = ['#1E3A8A','#4C1D95','#831843','#78350F','#064E3B','#0C4A6E'];
    return colors[(name?.charCodeAt(0) || 0) % colors.length];
  }
}
