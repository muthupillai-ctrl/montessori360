import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { platformAuthGuard } from './core/guards/platform-auth.guard';

export const routes: Routes = [
  {
    path: 'driver',
    loadComponent: () => import('./features/driver/driver.component').then(m => m.DriverComponent),
    canActivate: [authGuard],
  },
  {
    path: 'login',
    loadComponent: () => import('./features/auth/login/login.component').then(m => m.LoginComponent),
  },
  {
    path: '',
    loadComponent: () => import('./shared/components/shell/shell.component').then(m => m.ShellComponent),
    canActivate: [authGuard],
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      {
        path: 'dashboard',
        loadComponent: () => import('./features/dashboard/dashboard.component').then(m => m.DashboardComponent),
      },
      {
        path: 'students',
        loadComponent: () => import('./features/students/students.component').then(m => m.StudentsComponent),
      },
      {
        path: 'attendance',
        loadComponent: () => import('./features/attendance/attendance.component').then(m => m.AttendanceComponent),
      },
      {
        path: 'fees',
        loadComponent: () => import('./features/fees/fees.component').then(m => m.FeesComponent),
      },
      {
        path: 'classes',
        loadComponent: () => import('./features/classes/classes.component').then(m => m.ClassesComponent),
      },
      {
        path: 'journal',
        loadComponent: () => import('./features/journal/journal.component').then(m => m.JournalComponent),
      },
      {
        path: 'observations',
        loadComponent: () => import('./features/observations/observations.component').then(m => m.ObservationsComponent),
      },
      {
        path: 'reports',
        loadComponent: () => import('./features/reports/reports.component').then(m => m.ReportsComponent),
      },
      {
        path: 'calendar',
        loadComponent: () => import('./features/calendar/calendar.component').then(m => m.CalendarComponent),
      },
      {
        path: 'staff',
        loadComponent: () => import('./features/staff/staff.component').then(m => m.StaffComponent),
      },
      {
        path: 'timetable',
        loadComponent: () => import('./features/timetable/timetable.component').then(m => m.TimetableComponent),
      },
      {
        path: 'transport',
        loadComponent: () => import('./features/transport/transport.component').then(m => m.TransportComponent),
      },
      {
        path: 'communication',
        loadComponent: () => import('./features/communication/communication.component').then(m => m.CommunicationComponent),
      },
      {
        path: 'academic-years',
        loadComponent: () => import('./features/academic-years/academic-years.component').then(m => m.AcademicYearsComponent),
      },
    ],
  },
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
