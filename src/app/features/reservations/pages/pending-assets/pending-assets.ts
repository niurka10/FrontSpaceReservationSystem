import { CommonModule } from "@angular/common";
import { Component, computed, OnInit, signal } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { Reservation, RESERVATION_HISTORY_ACTION_LABELS, RESERVATION_STATUS_LABELS, RESERVATION_STEP_BY_STATUS, ReservationDetail, ReservationStatus, SpaceOption } from "../../models/reservation.interface";
import { OptionsService } from "../../services/options.service";
import { ReservationService } from "../../services/reservation.service";

type TabId = 'Pendientes' | 'Asignadas' | 'Todas';

interface Tab {
    id: TabId;
    label: string;
    matches: (status: ReservationStatus) => boolean;
}

// Estado del modal de acción. A diferencia de los otros roles, acá "assign"
// necesita además la lista de espacios libres y el espacio elegido.
interface ActionState {
    reservation: Reservation;
    kind: 'assign' | 'reject';
    justification: string;
    selectedSpaceId: string | null;
    freeSpaces: SpaceOption[];
    isLoadingSpaces: boolean;
    isSaving: boolean;
}

function pseudoCode(id: string): string {
    return `RSV-${id.replace(/-/g, '').slice(0, 8).toUpperCase()}`;
}

@Component({
    selector: 'app-pending-assets',
    standalone: true,
    imports: [CommonModule, FormsModule],
    templateUrl: './pending-assets.html',
    styleUrls: ['./pending-assets.scss'],
})

export class PendingAssetsComponent implements OnInit {
    readonly statusLabels = RESERVATION_STATUS_LABELS;
    readonly historyActionLabels = RESERVATION_HISTORY_ACTION_LABELS;
    readonly stepByStatus = RESERVATION_STEP_BY_STATUS;
    readonly pseudoCode = pseudoCode;

    readonly tabs: Tab[] = [
        { id: 'Pendientes', label: 'Pendientes', matches: (s) => s === 'PendingAssets' },
        { id: 'Asignadas', label: 'Asignadas', matches: (s) => s === 'Approved' },
        { id: 'Todas', label: 'Todas', matches: () => true },
    ];

    readonly activeTab = signal<TabId>('Pendientes');
    readonly reservations = signal<Reservation[]>([]);
    readonly isLoading = signal(true);
    readonly errorMessage = signal<string | null>(null);

    readonly action = signal<ActionState | null>(null);

    readonly selectedDetail = signal<ReservationDetail | null>(null);
    readonly isLoadingDetail = signal(false);

    readonly filteredReservations = computed(() => {
        const tab = this.tabs.find((t) => t.id === this.activeTab())!;
        return this.reservations().filter((r) => tab.matches(r.currentStatus));
    });

    constructor(
        private reservationService: ReservationService,
        private optionsService: OptionsService,
    ) { }

    ngOnInit(): void {
        this.load();
    }

    load(): void {
        this.isLoading.set(true);
        this.errorMessage.set(null);

        this.reservationService.listForAssets().subscribe({
            next: (reservations) => {
                this.reservations.set(reservations);
                this.isLoading.set(false);
            },
            error: (err) => {
                console.error(err);
                this.errorMessage.set('Error al cargar las reservas. Intenta nuevamente más tarde.');
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
    // ---------- modal de asignar / rechazar ----------

    openAction(reservation: Reservation, kind: 'assign' | 'reject'): void {
        this.action.set({
            reservation,
            kind,
            justification: '',
            // Si ya traía un espacio tentativo, queda preseleccionado (Bienes
            // puede cambiarlo por otro libre o confirmarlo tal cual).
            selectedSpaceId: reservation.spaceId,
            freeSpaces: [],
            isLoadingSpaces: kind === 'assign',
            isSaving: false,
        });

        if (kind === 'assign') this.loadFreeSpaces(reservation);
    }

    private loadFreeSpaces(r: Reservation): void {
        // r.date viene como "2026-10-07T00:00:00Z": el endpoint solo quiere la fecha.
        this.optionsService
            .getFreeSpacesForSlot(r.date.slice(0, 10), r.startTime, r.endTime, r.id)
            .subscribe({
                next: (spaces) => {
                    this.action.update((a) => (a ? { ...a, freeSpaces: spaces, isLoadingSpaces: false } : a));
                },
                error: () => {
                    this.errorMessage.set('No se pudieron cargar los espacios disponibles.');
                    this.action.update((a) => (a ? { ...a, isLoadingSpaces: false } : a));
                },
            });
    }

    closeAction(): void {
        this.action.set(null);
    }

    // Habilita el botón "Confirmar". Rechazar exige justificación; asignar no,
    // pero una reserva que ya tenía espacio o eligió uno puede confirmarse.
    // Una reserva solo de recursos (sin espacio) se puede asignar sin espacio.
    canConfirm(a: ActionState): boolean {
        if (a.isSaving) return false;
        if (a.kind === 'reject') return !!a.justification.trim();
        return !a.isLoadingSpaces;
    }

    confirmAction(): void {
        const current = this.action();
        if (!current || !this.canConfirm(current)) return;

        this.action.set({ ...current, isSaving: true });

        const id = current.reservation.id;
        const call =
            current.kind === 'assign'
                ? this.reservationService.assign(
                    id,
                    current.justification.trim() || 'Espacio asignado por Bienes',
                    current.selectedSpaceId,
                )
                : this.reservationService.reject(id, current.justification);

        call.subscribe({
            next: (updated) => {
                this.reservations.update((rows) => rows.map((r) => (r.id === updated.id ? updated : r)));
                this.action.set(null);
            },
            error: () => {
                this.errorMessage.set('No se pudo procesar la solicitud. Intenta de nuevo.');
                this.action.update((a) => (a ? { ...a, isSaving: false } : a));
            },
        });
    }

    // ---------- modal de detalle (ojito) ----------

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