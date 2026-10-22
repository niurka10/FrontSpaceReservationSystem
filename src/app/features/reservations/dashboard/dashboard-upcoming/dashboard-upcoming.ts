import { Component, computed, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Reservation } from '../../models/reservation.interface';
import { rsvCode, shortDateEs, todayIso } from '../utils/dashboard-utils';

const MAX_ITEMS = 4;

@Component({
  selector: 'app-dashboard-upcoming',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './dashboard-upcoming.html',
  styleUrl: './dashboard-upcoming.scss',
})
export class DashboardUpcomingComponent {
  readonly reservations = input.required<Reservation[]>();
  // El componente solo AVISA qué reserva quiere ver el usuario; el modal del voucher
  // lo abre el contenedor (así hay un solo modal, aunque luego otro bloque lo pida).
  readonly voucher = output<string>();

  readonly rsvCode = rsvCode;
  readonly shortDate = shortDateEs;

  readonly items = computed(() => {
    const today = todayIso();
    // Comparamos TEXTO: "2026-11-11" >= "2026-10-21" funciona porque el formato
    // yyyy-MM-dd ordena igual alfabética que cronológicamente.
    return this.reservations()
      .filter((r) => r.currentStatus === 'Approved' && r.date.slice(0, 10) >= today)
      .sort((a, b) =>
        (a.date.slice(0, 10) + a.startTime).localeCompare(b.date.slice(0, 10) + b.startTime)
      )
      .slice(0, MAX_ITEMS);
  });
}