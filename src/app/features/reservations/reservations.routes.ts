import { Routes } from '@angular/router';

export const RESERVATIONS_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./reservation-list/reservation-list').then(
        (m) => m.ReservationListComponent
      ),
  },
  {
    path: 'new',
    loadComponent: () =>
      import('./reservation-form/reservation-form').then(
        (m) => m.ReservationForm
      ),
  },

  {
    path: 'pending-coordinator',
    loadComponent: () =>
      import('./pending-coordinator/pending-coordinator').then(
        (m) => m.PendingCoordinatorComponent)
  },
];