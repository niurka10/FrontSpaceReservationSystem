import { Routes } from '@angular/router';

export const REPORTS_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./report-page/report-page').then((m) => m.ReportPageComponent),
  },
];