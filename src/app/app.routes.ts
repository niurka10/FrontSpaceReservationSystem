import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { ShellComponent } from './layout/shell/shell.component';

// Este archivo debería cambiar muy poco: solo cuando se agrega un
// FEATURE nuevo (una carpeta nueva bajo features/). Agregar una pantalla
// dentro de un feature existente se hace en el <feature>.routes.ts
// correspondiente, no aquí. Así Dev1 y Dev2 casi nunca chocan en este
// archivo al mergear.

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'dashboard' },

  // Públicas (fuera del Shell, sin sidebar) — Dev1
  {
    path: '',
    loadChildren: () => import('./features/auth/auth.routes').then((m) => m.AUTH_ROUTES),
  },

  // Protegidas (dentro del Shell, con sidebar navy)
  {
    path: '',
    component: ShellComponent,
    canActivate: [authGuard],
    children: [
      {
        path: 'dashboard',
        loadComponent: () =>
          import('./features/dashboard/dashboard.component').then((m) => m.DashboardComponent),
      },

      // Dev1
      {
        path: 'reservations',
        loadChildren: () =>
          import('./features/reservations/reservations.routes').then(
            (m) => m.RESERVATIONS_ROUTES
          ),
      },

      // Dev2 — cada quien reemplaza su placeholder dentro de su propio
      // <feature>.routes.ts, sin tocar este archivo.
      {
        path: 'faculties',
        loadChildren: () =>
          import('./features/faculties/faculties.routes').then((m) => m.FACULTIES_ROUTES),
      },
      {
        path: 'careers',
        loadChildren: () =>
          import('./features/careers/careers.routes').then((m) => m.CAREERS_ROUTES),
      },
      {
        path: 'spaces',
        loadChildren: () =>
          import('./features/spaces/spaces.routes').then((m) => m.SPACES_ROUTES),
      },
      {
        path: 'resources',
        loadChildren: () =>
          import('./features/resources/resources.routes').then((m) => m.RESOURCES_ROUTES),
      },
      {
        path: 'alerts',
        loadChildren: () =>
          import('./features/alerts/alerts.routes').then((m) => m.ALERTS_ROUTES),
      },

      // Sin dueño asignado todavía 
            {
        path: 'users',
        loadComponent: () =>
          import('./features/users/pages/user-list/user-list').then((m) => m.UserListComponent),
      },
      {
        path: 'reports',
        data: { title: 'Reports' },
        loadComponent: () =>
          import('./shared/coming-soon/coming-soon.component').then((m) => m.ComingSoonComponent),
      },
  
    ],
  },

  {
    path: 'unauthorized',
    loadComponent: () =>
      import('./shared/unauthorized/unauthorized.component').then((m) => m.UnauthorizedComponent),
  },

  { path: '**', redirectTo: '' },
];