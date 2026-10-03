import { Routes } from '@angular/router';

import { AlertList } from './pages/alert-list/alert-list';
import { AlertForm } from './pages/alert-form/alert-form';
import { roleGuard } from '../../core/guards/role.guard';

export const ALERTS_ROUTES: Routes = [
  {
    path: '',
    component: AlertList,
    canActivate: [roleGuard],
    data: {
      title: 'Alertas',
      roles: ['Student', 'Teacher', 'Coordinator', 'Vicerrector', 'Bienes', 'Admin']
    },
  },
  {
    path: 'new',
    component: AlertForm,
    canActivate: [roleGuard],
    data: {
      title: 'Nueva Alerta',
      roles: ['Student', 'Teacher', 'Coordinator', 'Vicerrector', 'Bienes', 'Admin']
    },
  },
];