import { CommonModule } from '@angular/common';
import { Component, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { RESERVATION_STEP_BY_STATUS, RESERVATION_HISTORY_ACTION_LABELS, RESERVATION_STATUS_LABELS, Reservation, ReservationDetail } from '../../models/reservation.interface';
import { ReservationService } from '../../services/reservation.service';
import { FormsModule } from '@angular/forms';

function pseudoCode(id: string): string {
  return `RSV-${id.replace(/-/g, '').slice(0, 8).toUpperCase()}`;
}

@Component({
  selector: 'app-reservation-list',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule],
  templateUrl: './reservation-list.html',
  styleUrl: './reservation-list.scss',
})
export class ReservationListComponent implements OnInit {
  readonly pseudoCode = pseudoCode;
  readonly stepByStatus = RESERVATION_STEP_BY_STATUS;
  readonly historyActionLabels = RESERVATION_HISTORY_ACTION_LABELS;
  readonly statusLabels = RESERVATION_STATUS_LABELS;
  readonly reservations = signal<Reservation[]>([]);
  readonly isLoading = signal(true);
  readonly errorMessage = signal<string | null>(null);
  readonly sendingId = signal<string | null>(null);
  readonly selectedDetail = signal<ReservationDetail | null>(null);
  readonly isLoadingDetail = signal(false);
  readonly cancelling = signal<{ id: string; justification: string; isSaving: boolean } | null>(null);

  constructor(private reservationsService: ReservationService) { }

  ngOnInit(): void {
    this.reservationsService.listMine().subscribe({
      next: (reservations) => {
        this.reservations.set(reservations);
        this.isLoading.set(false);
      },
      error: () => {
        this.errorMessage.set('No se pudieron cargar tus reservas.');
        this.isLoading.set(false);
      },
    });
  }

  sendDraft(id: string): void {
    const reservation = this.reservations().find((r) => r.id === id);
    if (!reservation) return;

    this.sendingId.set(id);
    this.reservationsService.submit(id, reservation.reason).subscribe({
      next: (update) => {
        this.reservations.update((rows) => rows.map((r) => (r.id === update.id ? update : r)));
        this.sendingId.set(null);
      },
      error: () => {
        this.errorMessage.set('No se pudo enviat la solicitud. Intenta de nuevo.');
        this.sendingId.set(null);
      }
    })
  }

  openDetail(id: string): void {
    this.isLoadingDetail.set(true);
    this.reservationsService.getById(id).subscribe({
      next: (detail) => {
        this.selectedDetail.set(detail);
        this.isLoadingDetail.set(false);
      },
      error: () => {
        this.errorMessage.set('No se pudo cargar el detalle.');
        this.isLoadingDetail.set(false)
      },
    });
  }

  closeDetail(): void {
    this.selectedDetail.set(null);
  }

  openCancel(id: string): void {
    this.cancelling.set({ id, justification: '', isSaving: false });
  }

  closeCancel(): void {
    this.cancelling.set(null);
  }

  confirmCancel(): void {
    const current = this.cancelling();
    if (!current || !current.justification.trim()) return;

    this.cancelling.set({ ...current, isSaving: true });

    this.reservationsService.cancel(current.id, current.justification).subscribe({
      next: (updated) => {
        this.reservations.update((rows) => rows.map((r) => (r.id === updated.id ? updated : r)));
        this.cancelling.set(null);
      },
      error: () => {
        this.errorMessage.set('No se pudo cancelar la solicitud.');
        this.cancelling.update((c) => (c ? { ...c, isSaving: false } : c));
      },
    });
  }
}