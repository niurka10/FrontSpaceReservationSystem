import { CommonModule } from "@angular/common";
import { Component, computed, OnInit, signal } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { Reservation, RESERVATION_STATUS_LABELS, ReservationStatus } from "../models/reservation.interface";
import { ReservationService } from "../services/reservation.service";

type TabValue = 'Todas' | ReservationStatus;

interface Tab {
    value: TabValue;
    label: string;
}

interface ActionState {
    reservationId: string;
    kind: 'elevate' | 'reject';
    justification: string;
    isSaving: boolean;
}

function pseudoCode(id: string): string {
    return `RSV-${id.replace(/-/g, '').slice(0, 8).toUpperCase()}`;
}

@Component({
    selector: 'app-pending-coordinator',
    standalone: true,
    imports: [CommonModule, FormsModule],
    templateUrl: './pending-coordinator.html',
    styleUrls: ['./pending-coordinator.scss']
})
export class PendingCoordinatorComponent implements OnInit {
    readonly statusLabels = RESERVATION_STATUS_LABELS;
    readonly pseudoCode = pseudoCode;

    readonly tabs: Tab[] = [
        { value: 'Todas', label: 'Todas' },
        { value: 'PendingCoordinator', label: 'Pendientes de gestión' },
        { value: 'PendingVicerrector', label: 'Pendientes de autorización (Vicerrectorado)' },
        { value: 'PendingAssets', label: 'Autorizadas · pendientes de asignación' },
        { value: 'Approved', label: 'Aprobadas' },
        { value: 'Rejected', label: 'Rechazadas' }
    ];

    readonly activeTab = signal<TabValue>('Todas');
    readonly reservations = signal<Reservation[]>([]);
    readonly isLoading = signal(true);
    readonly errorMessage = signal<string | null>(null);
    readonly action = signal<ActionState | null>(null);


    readonly filteredReservations = computed(() => {
        const tab = this.activeTab();
        const all = this.reservations();
        return tab === 'Todas' ? all : all.filter(r => r.currentStatus === tab);
    });

    constructor(private reservationService: ReservationService) { }

    ngOnInit(): void {
        this.load();
    }

    load(): void {
        this.isLoading.set(true);
        this.errorMessage.set(null);

        this.reservationService.listForMyCareer().subscribe({
            next: (reservations) => {
                this.reservations.set(reservations);
                this.isLoading.set(false);
            },
            error: (err) => {
                console.error(err);
                this.errorMessage.set('Error al cargar las reservas. Intente nuevamente más tarde.');
                this.isLoading.set(false);
            }
        });
    }


    selectTab(tab: TabValue): void {
        this.activeTab.set(tab);
    }

    requesterLabel(r: Reservation): string {
        if(r.requesterRole === 'Teacher') return 'Docente';
        if(r.requesterRole === 'Student') return 'Estudiante';
        return '';
    }

    openAction(reservationId: string, kind: 'elevate' | 'reject'): void {
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
      current.kind === 'elevate'
        ? this.reservationService.elevate(current.reservationId, current.justification)
        : this.reservationService.reject(current.reservationId, current.justification);
 
    call.subscribe({
      next: (updated) => {
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
}