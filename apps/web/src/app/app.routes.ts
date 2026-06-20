import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { roleGuard } from './core/guards/role.guard';
import { platformAuthGuard } from './core/guards/platform-auth.guard';

// Role shorthand arrays (must match AppRole type in role.service.ts)
const ADMIN        = ['owner', 'principal'];
const FINANCE      = ['owner', 'principal', 'accountant'];
const ACADEMICS    = ['owner', 'principal', 'teacher', 'assistant_teacher'];
const VIEW_STUDENT = ['owner', 'principal', 'accountant', 'teacher', 'assistant_teacher', 'admission_staff'];
const HR           = ['owner', 'principal', 'accountant'];
const ALL_STAFF    = ['owner', 'principal', 'teacher', 'assistant_teacher', 'accountant', 'admission_staff', 'driver', 'support'];

export const routes: Routes = [

  // ── Public / special routes ─────────────────────────────────────────────────
  {
    path: 'login',
    loadComponent: () => import('./features/auth/login/login.component').then(m => m.LoginComponent),
  },
  {
    path: 'forgot-password',
    loadComponent: () => import('./features/auth/forgot-password/forgot-password.component').then(m => m.ForgotPasswordComponent),
  },
  {
    path: 'reset-password',
    loadComponent: () => import('./features/auth/reset-password/reset-password.component').then(m => m.ResetPasswordComponent),
  },
  {
    path: 'parent/set-password',
    loadComponent: () => import('./features/parent/parent-set-password.component').then(m => m.ParentSetPasswordComponent),
  },

  // ── Driver portal ────────────────────────────────────────────────────────────
  {
    path: 'driver',
    loadComponent: () => import('./features/driver/driver.component').then(m => m.DriverComponent),
    canActivate: [authGuard, roleGuard],
    data: { roles: ['driver'] },
  },

  // ── Parent portal ─────────────────────────────────────────────────────────────
  {
    path: 'parent',
    loadComponent: () => import('./features/parent/parent-shell.component').then(m => m.ParentShellComponent),
    canActivate: [authGuard, roleGuard],
    data: { roles: ['parent'] },
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      { path: 'dashboard',  loadComponent: () => import('./features/parent/parent-dashboard.component').then(m => m.ParentDashboardComponent) },
      { path: 'attendance', loadComponent: () => import('./features/parent/parent-attendance.component').then(m => m.ParentAttendanceComponent) },
      { path: 'fees',       loadComponent: () => import('./features/parent/parent-fees.component').then(m => m.ParentFeesComponent) },
      { path: 'journal',    loadComponent: () => import('./features/parent/parent-journal.component').then(m => m.ParentJournalComponent) },
      { path: 'progress',   loadComponent: () => import('./features/parent/parent-progress.component').then(m => m.ParentProgressComponent) },
      { path: 'transport',  loadComponent: () => import('./features/parent/parent-transport.component').then(m => m.ParentTransportComponent) },
      { path: 'homework',   loadComponent: () => import('./features/parent/parent-homework.component').then(m => m.ParentHomeworkComponent) },
      { path: 'messages',   loadComponent: () => import('./features/parent/parent-messages.component').then(m => m.ParentMessagesComponent) },
    ],
  },

  // ── Main shell (all staff roles) ─────────────────────────────────────────────
  {
    path: '',
    loadComponent: () => import('./shared/components/shell/shell.component').then(m => m.ShellComponent),
    canActivate: [authGuard],
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },

      // Dashboard — all authenticated staff
      {
        path: 'dashboard',
        loadComponent: () => import('./features/dashboard/dashboard.component').then(m => m.DashboardComponent),
        canActivate: [roleGuard],
        data: { roles: ALL_STAFF },
      },

      // Students — view: all staff roles; creation guarded inside component
      {
        path: 'students',
        loadComponent: () => import('./features/students/students.component').then(m => m.StudentsComponent),
        canActivate: [roleGuard],
        data: { roles: VIEW_STUDENT },
      },

      // Attendance — all academic staff
      {
        path: 'attendance',
        loadComponent: () => import('./features/attendance/attendance.component').then(m => m.AttendanceComponent),
        canActivate: [roleGuard],
        data: { roles: [...ACADEMICS, 'admission_staff'] },
      },

      // Fees — finance roles only
      {
        path: 'fees',
        loadComponent: () => import('./features/fees/fees.component').then(m => m.FeesComponent),
        canActivate: [roleGuard],
        data: { roles: FINANCE },
      },

      // Classes — admin only
      {
        path: 'classes',
        loadComponent: () => import('./features/classes/classes.component').then(m => m.ClassesComponent),
        canActivate: [roleGuard],
        data: { roles: [...ADMIN, 'admission_staff'] },
      },

      // Timetable — academic staff
      {
        path: 'timetable',
        loadComponent: () => import('./features/timetable/timetable.component').then(m => m.TimetableComponent),
        canActivate: [roleGuard],
        data: { roles: ACADEMICS },
      },

      // Journal — academic staff
      {
        path: 'journal',
        loadComponent: () => import('./features/journal/journal.component').then(m => m.JournalComponent),
        canActivate: [roleGuard],
        data: { roles: ACADEMICS },
      },

      // Homework — admin creates, teachers use
      {
        path: 'homework',
        loadComponent: () => import('./features/parent/homework-admin.component').then(m => m.HomeworkAdminComponent),
        canActivate: [roleGuard],
        data: { roles: ACADEMICS },
      },

      // Observations — academic staff
      {
        path: 'observations',
        loadComponent: () => import('./features/observations/observations.component').then(m => m.ObservationsComponent),
        canActivate: [roleGuard],
        data: { roles: ACADEMICS },
      },

      // Reports — academic staff
      {
        path: 'reports',
        loadComponent: () => import('./features/reports/reports.component').then(m => m.ReportsComponent),
        canActivate: [roleGuard],
        data: { roles: ACADEMICS },
      },

      // Calendar — all staff
      {
        path: 'calendar',
        loadComponent: () => import('./features/calendar/calendar.component').then(m => m.CalendarComponent),
        canActivate: [roleGuard],
        data: { roles: ALL_STAFF },
      },

      // Staff — HR roles manage; all staff can see themselves (handled inside component)
      {
        path: 'staff',
        loadComponent: () => import('./features/staff/staff.component').then(m => m.StaffComponent),
        canActivate: [roleGuard],
        data: { roles: ALL_STAFF },
      },

      // Transport — admin + drivers
      {
        path: 'transport',
        loadComponent: () => import('./features/transport/transport.component').then(m => m.TransportComponent),
        canActivate: [roleGuard],
        data: { roles: [...ADMIN, 'accountant'] },
      },

      // Communication — all staff
      {
        path: 'communication',
        loadComponent: () => import('./features/communication/communication.component').then(m => m.CommunicationComponent),
        canActivate: [roleGuard],
        data: { roles: ALL_STAFF },
      },

      // Parents — admin + admissions
      {
        path: 'parents',
        loadComponent: () => import('./features/parents/parents.component').then(m => m.ParentsComponent),
        canActivate: [roleGuard],
        data: { roles: [...ADMIN, 'admission_staff'] },
      },

      // Academic years — admin + admissions
      {
        path: 'academic-years',
        loadComponent: () => import('./features/academic-years/academic-years.component').then(m => m.AcademicYearsComponent),
        canActivate: [roleGuard],
        data: { roles: [...ADMIN, 'admission_staff'] },
      },
    ],
  },

  // ── Platform admin ───────────────────────────────────────────────────────────
  {
    path: 'platform/login',
    loadComponent: () => import('./features/platform/login/platform-login.component').then(m => m.PlatformLoginComponent),
  },
  {
    path: 'platform',
    loadComponent: () => import('./features/platform/shell/platform-shell.component').then(m => m.PlatformShellComponent),
    canActivate: [platformAuthGuard],
    children: [
      { path: '', redirectTo: 'schools', pathMatch: 'full' },
      {
        path: 'schools',
        loadComponent: () => import('./features/platform/schools/platform-schools.component').then(m => m.PlatformSchoolsComponent),
      },
    ],
  },

  { path: '**', redirectTo: '' },
];
