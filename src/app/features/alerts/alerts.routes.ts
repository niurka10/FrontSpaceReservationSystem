import { Routes } from '@angular/router';
import { AlertList } from './pages/alert-list/alert-list';
import { AlertForm } from './pages/alert-form/alert-form';

export const ALERTS_ROUTES: Routes = [
  {
    path: '',
    data: { title: 'Alertas' },
    component: AlertList,
  },
  {
    path: 'new',
    data: { title: 'Nueva Alerta' },
    component: AlertForm,
  },
];