import { Routes } from '@angular/router';

export const RESERVATIONS_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./pages/reservation-list/reservation-list').then(
        (m) => m.ReservationListComponent
      ),
  },
  {
    path: 'new',
    loadComponent: () =>
      import('./pages/reservation-form/reservation-form').then(
        (m) => m.ReservationFormComponent
      ),
  },

  {
    path: ':id/edit',
    loadComponent: () =>
      import('./pages/reservation-form/reservation-form').then(
        (m) => m.ReservationFormComponent)
  },
  {
    path: 'pending-coordinator',
    loadComponent: () =>
      import('./pages/pending-coordinator/pending-coordinator').then(
        (m) => m.PendingCoordinatorComponent)
  },
  {
    path: 'pending-vicerrector',
    loadComponent: () =>
      import('./pages/pending-vicerrector/pending-vicerrector').then(
        (m) => m.PendingVicerrectorComponent)
  },
  {
    path: 'pending-assets',
    loadComponent: () =>
      import('./pages/pending-assets/pending-assets').then(
        (m) => m.PendingAssetsComponent)
  },
  {
    path: 'calendar',
    loadComponent: () =>
      import('./calendar-month/calendar-month').then(
        (m) => m.CalendarMonthComponent)
  },
  {
    path: 'new-resources',
    data: { resourcesOnly: true },
    loadComponent: () =>
      import('./pages/reservation-form/reservation-form').then(
        (m) => m.ReservationFormComponent
      ),
  },
];