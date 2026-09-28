import { CommonModule } from "@angular/common";
import { Component, computed, OnInit, signal } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { ReservationStatus, RESERVATION_STATUS_LABELS, RESERVATION_HISTORY_ACTION_LABELS, RESERVATION_STEP_BY_STATUS, Reservation, ReservationDetail } from "../../models/reservation.interface";
import { ReservationService } from "../../services/reservation.service";


// A diferencia de pending-coordinator.ts (donde cada tab es UN status exacto:
// 'PendingCoordinator', 'Approved', etc.), acá el mockup pide tabs que agrupan
// VARIOS estados juntos (ej. "Autorizadas" = PendingAssets + Approved, porque
// ambos ya pasaron por la autorización del Vicerrector). Por eso cada Tab trae
// su propia función de filtro en vez de un simple valor a comparar.
type TabId = 'Pendientes' | 'Autorizadas' | 'Rechazadas' | 'Todas';

interface Tab {
  id: TabId;
  label: string;
  matches: (status: ReservationStatus) => boolean;
}

interface ActionState {
  reservationId: string;
  kind: 'approve' | 'reject';
  justification: string;
  isSaving: boolean;
}

// Mismo truco "de mentira" que ya usa pending-coordinator.ts para el código
// de la reserva (RSV-XXXXXXXX a partir del GUID) — cuando el backend tenga un
// correlativo real, este helper se borra y se usa el campo real directo.
function pseudoCode(id: string): string {
  return `RSV-${id.replace(/-/g, '').slice(0, 8).toUpperCase()}`;
}

@Component({
  selector: 'app-pending-vicerrector',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './pending-vicerrector.html',
  styleUrls: ['./pending-vicerrector.scss'],
})
export class PendingVicerrectorComponent implements OnInit {
  // Exponemos estos "diccionarios" del modelo tal cual al template, para no
  // tener que escribir un método por cada lookup (Angular permite llamar
  // funciones/propiedades públicas de la clase directo desde el HTML).
  readonly statusLabels = RESERVATION_STATUS_LABELS;
  readonly historyActionLabels = RESERVATION_HISTORY_ACTION_LABELS;
  readonly stepByStatus = RESERVATION_STEP_BY_STATUS;
  readonly pseudoCode = pseudoCode;

  readonly tabs: Tab[] = [
    { id: 'Pendientes', label: 'Pendientes', matches: (s) => s === 'PendingVicerrector' },
    { id: 'Autorizadas', label: 'Autorizadas', matches: (s) => s === 'PendingAssets' || s === 'Approved' },
    { id: 'Rechazadas', label: 'Rechazadas', matches: (s) => s === 'Rejected' },
    { id: 'Todas', label: 'Todas', matches: () => true },
  ];

  // ------- estado de la lista -------
  readonly activeTab = signal<TabId>('Pendientes');
  readonly reservations = signal<Reservation[]>([]);
  readonly isLoading = signal(true);
  readonly errorMessage = signal<string | null>(null);

  // ------- estado del modal de acción (aprobar / rechazar) -------
  readonly action = signal<ActionState | null>(null);

  // ------- estado del modal de detalle (el del stepper de 4 pasos) -------
  readonly selectedDetail = signal<ReservationDetail | null>(null);
  readonly isLoadingDetail = signal(false);

  // computed(): se recalcula solo cuando cambia activeTab() o reservations()
  // (las dos signals de las que depende). No hace falta llamarlo manualmente
  // cada vez que filtramos — Angular lo detecta.
  readonly filteredReservations = computed(() => {
    const tab = this.tabs.find((t) => t.id === this.activeTab())!;
    return this.reservations().filter((r) => tab.matches(r.currentStatus));
  });

  constructor(private reservationService: ReservationService) {}

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.isLoading.set(true);
    this.errorMessage.set(null);

    this.reservationService.listForVicerrector().subscribe({
      next: (reservations) => {
        this.reservations.set(reservations);
        this.isLoading.set(false);
      },
      error: (err) => {
        console.error(err);
        this.errorMessage.set('Error al cargar las reservas. Intente nuevamente más tarde.');
        this.isLoading.set(false);
      },
    });
  }

  selectTab(tab: TabId): void {
    this.activeTab.set(tab);
  }

  requesterLabel(r: Reservation): string {
    if (r.requesterRole === 'Teacher') return 'Docente';
    if (r.requesterRole === 'Student') return 'Estudiante';
    return '';
  }

  // ---------- modal de aprobar / rechazar (mismo patrón que Coordinator) ----------

  openAction(reservationId: string, kind: 'approve' | 'reject'): void {
    this.action.set({ reservationId, kind, justification: '', isSaving: false });
  }

  closeAction(): void {
    this.action.set(null);
  }

  confirmAction(): void {
    const current = this.action();
    if (!current || !current.justification.trim()) return;

    this.action.set({ ...current, isSaving: true });

    const call =
      current.kind === 'approve'
        ? this.reservationService.approve(current.reservationId, current.justification)
        : this.reservationService.reject(current.reservationId, current.justification);

    call.subscribe({
      next: (updated) => {
        // reemplazamos en el array la reserva que cambió, sin tener que
        // recargar toda la lista de nuevo contra el backend
        this.reservations.update((rows) =>
          rows.map((r) => (r.id === updated.id ? updated : r))
        );
        this.action.set(null);
      },
      error: () => {
        this.errorMessage.set('No se pudo procesar la solicitud. Intenta de nuevo.');
        this.action.update((a) => (a ? { ...a, isSaving: false } : a));
      },
    });
  }

  // ---------- modal de detalle (ícono de "ojo") ----------

  openDetail(reservationId: string): void {
    this.isLoadingDetail.set(true);
    this.reservationService.getById(reservationId).subscribe({
      next: (detail) => {
        this.selectedDetail.set(detail);
        this.isLoadingDetail.set(false);
      },
      error: () => {
        this.errorMessage.set('No se pudo cargar el detalle de la solicitud.');
        this.isLoadingDetail.set(false);
      },
    });
  }

  closeDetail(): void {
    this.selectedDetail.set(null);
  }
}