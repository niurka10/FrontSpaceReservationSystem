import { Component } from '@angular/core';
import { AuthService } from '../../core/auth/auth.service';
import { DashboardStudentComponent } from '../reservations/dashboard/dashboard-student/dashboard-student';
import { DashboardCoordinatorComponent } from '../reservations/dashboard/dashboard-coordinator/dashboard-coordinator';
import { DashboardBienesComponent } from '../reservations/dashboard/dashboard-bienes/dashboard-bienes';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [DashboardStudentComponent, DashboardCoordinatorComponent, DashboardBienesComponent],
  template: `
    @if (authService.hasRole('Coordinator')) {
      <app-dashboard-coordinator/>
    } @else if (authService.hasRole('Bienes')) {
      <app-dashboard-bienes/>
    } @else {
      <app-dashboard-student/>
    }
  `,
})
export class DashboardComponent {
  constructor(public authService: AuthService) { }
}