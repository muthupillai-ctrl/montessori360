import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () => import('./features/auth/login.component').then(m => m.LoginComponent),
  },
  {
    path: 'sso',
    loadComponent: () => import('./features/sso/sso.component').then(m => m.SsoComponent),
  },
  {
    path: '',
    loadComponent: () => import('./shared/shell/shell.component').then(m => m.ShellComponent),
    canActivate: [authGuard],
    children: [
      { path: '', redirectTo: 'worksheets', pathMatch: 'full' },
      {
        path: 'worksheets',
        loadComponent: () => import('./features/worksheets/worksheets.component').then(m => m.WorksheetsComponent),
      },
      {
        path: 'lesson-plans',
        loadComponent: () => import('./features/lesson-plans/lesson-plans.component').then(m => m.LessonPlansComponent),
      },
      {
        path: 'question-papers',
        loadComponent: () => import('./features/question-papers/question-papers.component').then(m => m.QuestionPapersComponent),
      },
      {
        path: 'curriculum',
        loadComponent: () => import('./features/curriculum/curriculum.component').then(m => m.CurriculumComponent),
      },
      {
        path: 'assignments',
        loadComponent: () => import('./features/assignments/assignments.component').then(m => m.AssignmentsComponent),
      },
      {
        path: 'progress',
        loadComponent: () => import('./features/progress/progress.component').then(m => m.ProgressComponent),
      },
      {
        path: 'ai-insights',
        loadComponent: () => import('./features/ai-insights/ai-insights.component').then(m => m.AiInsightsComponent),
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
