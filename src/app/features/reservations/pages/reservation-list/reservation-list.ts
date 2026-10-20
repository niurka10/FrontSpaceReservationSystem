import { CommonModule } from '@angular/common';
import { Component, computed, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { RESERVATION_STEP_BY_STATUS, RESERVATION_HISTORY_ACTION_LABELS, RESERVATION_STATUS_LABELS, Reservation, ReservationDetail } from '../../models/reservation.interface';
import { ReservationService } from '../../services/reservation.service';
import { FormsModule } from '@angular/forms';
import { VoucherModalComponent } from '../../../../shared/components/voucher-modal/voucher-modal.component';
import { apiErrorMessage } from '../../utils/api-error';

function pseudoCode(id: string): string {
  return `RSV-${id.replace(/-/g, '').slice(0, 8).toUpperCase()}`;
}

type StatusFilter = 'all' | 'pending' | 'approved' | 'draft' | 'closed';

function matchesFilter(r: Reservation, f: StatusFilter): boolean {
  switch (f) {
    case 'pending': return r.currentStatus.startsWith('Pending');
    case 'approved': return r.currentStatus === 'Approved';
    case 'draft': return r.currentStatus === 'Draft';
    case 'closed': return r.currentStatus === 'Rejected' || r.currentStatus === 'Cancelled';
    default: return true;
  }
}

@Component({
  selector: 'app-reservation-list',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule, VoucherModalComponent],
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
  readonly detailError = signal<string | null>(null);
  readonly cancelling = signal<{ id: string; justification: string; isSaving: boolean } | null>(null);
  // Id de la reserva cuyo voucher se está viendo. null = modal cerrado.
  readonly voucherId = signal<string | null>(null);

  readonly filterLabels: Record<StatusFilter, string> = {
    all: 'Todas',
    pending: 'En revisión',
    approved: 'Aprobadas',
    draft: 'Borradores',
    closed: 'Cerradas',
  };

  readonly filter = signal<StatusFilter>('all');

  readonly counts = computed(() => {
    const rows = this.reservations();
    return {
      pending: rows.filter((r) => matchesFilter(r, 'pending')).length,
      approved: rows.filter((r) => matchesFilter(r, 'approved')).length,
      draft: rows.filter((r) => matchesFilter(r, 'draft')).length,
      closed: rows.filter((r) => matchesFilter(r, 'closed')).length,
    };
  });

  readonly filtered = computed(() =>
    this.reservations().filter((r) => matchesFilter(r, this.filter()))
  );

  // Si haces clic en la tarjeta que ya está activa, vuelve a mostrar todas.
  setFilter(value: StatusFilter): void {
    this.filter.update((current) => (current === value ? 'all' : value));
  }

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
        this.errorMessage.set('No se pudo enviar la solicitud. Intenta de nuevo.');
        this.sendingId.set(null);
      }
    })
  }

  openDetail(id: string): void {
    this.detailError.set(null); // limpia un aviso anterior
    this.isLoadingDetail.set(true);
    this.reservationsService.getById(id).subscribe({
      next: (detail) => {
        this.selectedDetail.set(detail);
        this.isLoadingDetail.set(false);
      },
      error: (err) => {
        // Muestra el `description` del backend; si no hay, el texto de respaldo.
        this.detailError.set(apiErrorMessage(err, 'No se pudo cargar el detalle.'));
        this.isLoadingDetail.set(false);
      },
    });
  }

  closeDetail(): void {
    this.selectedDetail.set(null);
  }

  openCancel(id: string): void {
    this.cancelling.set({ id, justification: 'Cancelada por el solicitante', isSaving: false });
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

  openVoucher(id: string): void {
    this.voucherId.set(id);
  }

  closeVoucher(): void {
    this.voucherId.set(null);
  }
}