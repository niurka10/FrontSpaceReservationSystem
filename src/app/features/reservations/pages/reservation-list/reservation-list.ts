import { CommonModule } from '@angular/common';
import { Component, computed, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { RESERVATION_STATUS_LABELS, Reservation, ReservationDetail } from '../../models/reservation.interface';
import { ReservationService } from '../../services/reservation.service';
import { FormsModule } from '@angular/forms';
import { VoucherModalComponent } from '../../../../shared/components/voucher-modal/voucher-modal.component';
import { apiErrorMessage } from '../../utils/api-error';
import { ReservationDetailModalComponent } from '../reservation-detail-modal/reservation-detail-modal.component';

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
  imports: [CommonModule, RouterLink, FormsModule, VoucherModalComponent, ReservationDetailModalComponent],
  templateUrl: './reservation-list.html',
  styleUrl: './reservation-list.scss',
})
export class ReservationListComponent implements OnInit {
  readonly pseudoCode = pseudoCode;
  readonly statusLabels = RESERVATION_STATUS_LABELS;
  readonly reservations = signal<Reservation[]>([]);
  readonly isLoading = signal(true);
  readonly errorMessage = signal<string | null>(null);
  readonly sendingId = signal<string | null>(null);
  readonly selectedDetail = signal<ReservationDetail | null>(null);
  readonly isLoadingDetail = signal(false);
  readonly detailError = signal<string | null>(null);
  readonly actionError = signal<string | null>(null);
  readonly cancelling = signal<{ id: string; justification: string; isSaving: boolean } | null>(null);
  readonly deleting = signal<{ id: string; isSaving: boolean } | null>(null);
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

  // Cuántas filas se muestran por página.
  readonly pageSize = 10;

  // Página que el usuario pidió (empieza en 1). Es una signal porque cambia con los clics.
  private readonly requestedPage = signal(1);

  // Total de páginas = filas filtradas / 10, redondeado hacia arriba.
  // Math.max(1, ...) evita "0 páginas" cuando la lista está vacía.
  // Es computed: se recalcula solo cuando cambia filtered().
  readonly totalPages = computed(() =>
    Math.max(1, Math.ceil(this.filtered().length / this.pageSize))
  );

  // Página realmente mostrada. Si borras la última fila de la última página,
  // requestedPage quedaría fuera de rango; Math.min la "recorta" a la última
  // página válida sin necesidad de un effect.
  readonly currentPage = computed(() => Math.min(this.requestedPage(), this.totalPages()));

  // Índice (base 0) de la primera fila de la página actual: página 1 → 0, página 2 → 10...
  readonly firstIndex = computed(() => (this.currentPage() - 1) * this.pageSize);

  // Las filas que se dibujan: un trozo de filtered() con slice(desde, hasta).
  readonly paged = computed(() =>
    this.filtered().slice(this.firstIndex(), this.firstIndex() + this.pageSize)
  );

  // Texto "Mostrando 11–20 de 34".
  readonly range = computed(() => {
    const total = this.filtered().length;
    return {
      from: total === 0 ? 0 : this.firstIndex() + 1,
      to: Math.min(this.firstIndex() + this.pageSize, total),
      total,
    };
  });

  goToPage(page: number): void {
    // Se limita al rango válido por si llega un valor fuera de límites.
    this.requestedPage.set(Math.min(Math.max(1, page), this.totalPages()));
  }

  // Si haces clic en la tarjeta que ya está activa, vuelve a mostrar todas.
  setFilter(value: StatusFilter): void {
    this.detailError.set(null);
    this.actionError.set(null);
    this.requestedPage.set(1); // al cambiar de filtro, siempre desde la primera página
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

  private refresh(): void {
    this.reservationsService.listMine().subscribe({
      next: (reservations) => this.reservations.set(reservations),
      error: (err) => console.error(err), // el aviso visible llega en la tarea 3
    });
  }

  sendDraft(id: string): void {
    this.actionError.set(null);
    const reservation = this.reservations().find((r) => r.id === id);
    if (!reservation) return;

    this.sendingId.set(id);
    this.reservationsService.submit(id, reservation.reason).subscribe({
      next: () => {
        this.sendingId.set(null);
        this.refresh();
      },
      error: (err) => {
        this.actionError.set(apiErrorMessage(err, 'No se pudo enviar la solicitud. Intenta de nuevo.'));
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
    this.actionError.set(null);
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
      next: () => {
        this.cancelling.set(null);
        this.refresh();
      },
      error: (err) => {
        this.actionError.set(apiErrorMessage(err, 'No se pudo cancelar la solicitud.'));
        this.cancelling.set(null);
        this.refresh();
      },
    });
  }

  openDelete(id: string): void {
    this.actionError.set(null);
    this.deleting.set({ id, isSaving: false });
  }

  closeDelete(): void {
    this.deleting.set(null);
  }

  confirmDelete(): void {
    const current = this.deleting();
    if (!current) return;

    this.deleting.set({ ...current, isSaving: true });

    this.reservationsService.delete(current.id).subscribe({
      next: () => {
        // 204: ya no existe. Cerramos y recargamos /mine (la fila desaparece).
        this.deleting.set(null);
        this.refresh();
      },
      error: (err) => {
        // 403/404/409: mostramos el `description` y recargamos para ver el estado real.
        this.actionError.set(apiErrorMessage(err, 'No se pudo eliminar el borrador.'));
        this.deleting.set(null);
        this.refresh();
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