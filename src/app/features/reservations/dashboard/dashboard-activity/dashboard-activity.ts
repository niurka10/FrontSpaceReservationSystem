import { Component, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ReservationActivityItem } from '../../models/reservation.interface';
import { ReservationService } from '../../services/reservation.service';
import { apiErrorMessage } from '../../utils/api-error';
import { activityMessage, rsvCode, statusVisual, timeAgo } from '../utils/dashboard-utils';

@Component({
  selector: 'app-dashboard-activity',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './dashboard-activity.html',
  styleUrl: './dashboard-activity.scss',
})
export class DashboardActivityComponent implements OnInit {
  readonly items = signal<ReservationActivityItem[]>([]);
  readonly isLoading = signal(true);
  readonly loadError = signal<string | null>(null);

  readonly rsvCode = rsvCode;
  readonly timeAgo = timeAgo;
  readonly message = activityMessage;
  readonly visual = statusVisual;

  constructor(private reservationService: ReservationService) { }

  ngOnInit(): void {
    this.reservationService.listMyActivity(5).subscribe({
      next: (rows) => {
        this.items.set(rows);
        this.isLoading.set(false);
      },
      error: (err) => {
        this.loadError.set(apiErrorMessage(err, 'No se pudo cargar tu actividad reciente.'));
        this.isLoading.set(false);
      },
    });
  }
}