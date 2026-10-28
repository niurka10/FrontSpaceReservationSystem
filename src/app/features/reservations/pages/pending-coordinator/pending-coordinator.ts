import { CommonModule } from "@angular/common";
import { Component, HostListener, computed, OnInit, signal } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { Reservation, RESERVATION_HISTORY_ACTION_LABELS, RESERVATION_STATUS_LABELS, RESERVATION_STEP_BY_STATUS, ReservationDetail } from "../../models/reservation.interface";
import { ReservationService } from "../../services/reservation.service";
import { apiErrorMessage } from "../../utils/api-error";
import { mergeReservation } from "../../utils/merge-reservation";
import { ReservationDetailModalComponent } from "../reservation-detail-modal/reservation-detail-modal.component";

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
    imports: [CommonModule, FormsModule, ReservationDetailModalComponent],
    templateUrl: './pending-coordinator.html',
    styleUrls: ['./pending-coordinator.scss']
})
export class PendingCoordinatorComponent implements OnInit {
    readonly statusLabels = RESERVATION_STATUS_LABELS;
    readonly pseudoCode = pseudoCode;
    readonly selectedDetail = signal<ReservationDetail | null>(null);
    readonly isLoadingDetail = signal(false);

    readonly reservations = signal<Reservation[]>([]);
    readonly isLoading = signal(true);
    readonly detailError = signal<string | null>(null);
    readonly errorMessage = signal<string | null>(null);
    readonly action = signal<ActionState | null>(null);

    // ---------- Filtros (uno por columna) ----------
    readonly statusFilter = signal<string>('all');   // lo comparten las tarjetas y el filtro de la columna Estado
    readonly requesterFilter = signal('');
    readonly spaceFilter = signal<string>('all');    // 'all' | '__none__' | nombre del espacio
    readonly dateFilter = signal('');                // yyyy-MM-dd

    // Los números de las tarjetas cuentan sobre todas las reservas, no sobre las filtradas.
    readonly counts = computed(() => {
        const rows = this.reservations();
        const count = (s: string) => rows.filter((r) => r.currentStatus === s).length;
        return {
            pending: count('PendingCoordinator'),
            vicerrector: count('PendingVicerrector'),
            assets: count('PendingAssets'),
            approved: count('Approved'),
            rejected: count('Rejected'),
            cancelled: count('Cancelled'),
        };
    });

    // Opciones de los desplegables: solo lo que realmente existe en tus datos.
    readonly spaceOptions = computed(() => {
        const names = this.reservations()
            .map((r) => r.spaceName)
            .filter((n): n is string => !!n);
        return [...new Set(names)].sort();
    });

    readonly statusOptions = computed(() => {
        const statuses = [...new Set(this.reservations().map((r) => r.currentStatus))];
        return statuses.map((s) => ({ value: s as string, label: this.statusLabels[s] }));
    });

    readonly filteredReservations = computed(() => {
        const status = this.statusFilter();
        const requester = this.requesterFilter().trim().toLowerCase();
        const space = this.spaceFilter();
        const date = this.dateFilter();

        return this.reservations().filter((r) => {
            if (status !== 'all' && r.currentStatus !== status) return false;

            if (requester) {
                const text = `${r.requesterName ?? ''} ${this.requesterLabel(r)}`.toLowerCase();
                if (!text.includes(requester)) return false;
            }

            if (space === '__none__' && r.spaceName) return false;
            if (space !== 'all' && space !== '__none__' && r.spaceName !== space) return false;

            if (date && r.date.slice(0, 10) !== date) return false;

            return true;
        });
    });

    readonly hasActiveFilters = computed(
        () =>
            this.statusFilter() !== 'all' ||
            this.requesterFilter().trim() !== '' ||
            this.spaceFilter() !== 'all' ||
            this.dateFilter() !== ''
    );

    // Paginado
    readonly pageSize = 8;
    private readonly requestedPage = signal(1);
    readonly totalPages = computed(() => Math.max(1, Math.ceil(this.filteredReservations().length / this.pageSize)));
    readonly currentPage = computed(() => Math.min(this.requestedPage(), this.totalPages()));
    readonly firstIndex = computed(() => (this.currentPage() - 1) * this.pageSize);
    readonly paged = computed(() =>
        this.filteredReservations().slice(this.firstIndex(), this.firstIndex() + this.pageSize)
    );
    readonly pages = computed(() => Array.from({ length: this.totalPages() }, (_, i) => i + 1));
    readonly range = computed(() => {
        const total = this.filteredReservations().length;
        return {
            from: total === 0 ? 0 : this.firstIndex() + 1,
            to: Math.min(this.firstIndex() + this.pageSize, total),
            total,
        };
    });
    goToPage(page: number): void {
        this.requestedPage.set(Math.min(Math.max(1, page), this.totalPages()));
    }

    //Embudos 
    readonly openMenu = signal<'requester' | 'space' | 'date' | 'status' | null>(null);
    toggleMenu(m: 'requester' | 'space' | 'date' | 'status'): void {
        this.openMenu.update((c) => (c === m ? null : m));
    }
    @HostListener('document:click')
    closeMenus(): void { this.openMenu.set(null); }

    setRequester(v: string): void { this.requesterFilter.set(v); this.requestedPage.set(1); }
    setSpace(v: string): void { this.spaceFilter.update((c) => (c === v ? 'all' : v)); this.requestedPage.set(1); }
    setDate(v: string): void { this.dateFilter.set(v); this.requestedPage.set(1); }
    setStatus(v: string): void { this.statusFilter.update((c) => (c === v ? 'all' : v)); this.requestedPage.set(1); }

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

    // Clic en una tarjeta activa = vuelve a mostrar todas.
    setStatusCard(value: string): void {
        this.detailError.set(null);
        this.statusFilter.update((current) => (current === value ? 'all' : value));
    }

    clearFilters(): void {
        this.statusFilter.set('all');
        this.requesterFilter.set('');
        this.spaceFilter.set('all');
        this.dateFilter.set('');
    }

    requesterLabel(r: Reservation): string {
        if (r.requesterRole === 'Teacher') return 'Docente';
        if (r.requesterRole === 'Student') return 'Estudiante';
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
                    // /career ya no devuelve borradores. Si el rechazo del Coordinador
                    // dejó la reserva en Draft, la quitamos de la lista local para que
                    // coincida con lo que mostraría una recarga. Si no, reemplazamos la fila.
                    updated.currentStatus === 'Draft'
                        ? rows.filter((r) => r.id !== updated.id)
                        : rows.map((r) => (r.id === updated.id ? mergeReservation(r, updated) : r))
                );
                this.action.set(null);
            },
            error: () => {
                this.errorMessage.set('No se pudo procesar la solicitud. Intenta de nuevo.');
                this.action.update((a) => (a ? { ...a, isSaving: false } : a));
            },
        });
    }

    openDetail(reservationId: string): void {
        this.detailError.set(null); // limpia un aviso anterior
        this.isLoadingDetail.set(true);
        this.reservationService.getById(reservationId).subscribe({
            next: (detail) => {
                this.selectedDetail.set(detail);
                this.isLoadingDetail.set(false);
            },
            error: (err) => {
                // Muestra el `description` del backend; si no hay, el texto de respaldo.
                this.detailError.set(
                    apiErrorMessage(err, 'No se pudo cargar el detalle de la solicitud.')
                );
                this.isLoadingDetail.set(false);
            },
        });
    }

    closeDetail(): void {
        this.selectedDetail.set(null);
    }
}