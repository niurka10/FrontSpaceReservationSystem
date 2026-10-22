import { CommonModule } from "@angular/common";
import { Component, computed, OnInit, signal } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { ReservationStatus, RESERVATION_STATUS_LABELS, RESERVATION_HISTORY_ACTION_LABELS, RESERVATION_STEP_BY_STATUS, Reservation, ReservationDetail } from "../../models/reservation.interface";
import { ReservationService } from "../../services/reservation.service";
import { apiErrorMessage } from "../../utils/api-error";
import { mergeReservation } from "../../utils/merge-reservation";
import { ReservationDetailModalComponent } from "../reservation-detail-modal/reservation-detail-modal.component";


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

// Turno corto para dictar o recordar (ej. "B2233"). Se calcula del ID, así que
// es provisional: cuando el backend tenga un correlativo real, se reemplaza.
function turnCode(id: string): string {
  let h = 2166136261;
  for (const ch of id) {
    h ^= ch.charCodeAt(0);
    h = Math.imul(h, 16777619);
  }
  const n = h >>> 0;
  const letter = String.fromCharCode(65 + (n % 26));
  const digits = String(Math.floor(n / 26) % 10000).padStart(4, '0');
  return `${letter}${digits}`;
}

type ColKey = 'code' | 'requester' | 'career' | 'space' | 'date' | 'status';

@Component({
  selector: 'app-pending-vicerrector',
  standalone: true,
  imports: [CommonModule, FormsModule, ReservationDetailModalComponent],
  templateUrl: './pending-vicerrector.html',
  styleUrls: ['./pending-vicerrector.scss'],
})
export class PendingVicerrectorComponent implements OnInit {
  // Exponemos estos "diccionarios" del modelo tal cual al template, para no
  // tener que escribir un método por cada lookup (Angular permite llamar
  // funciones/propiedades públicas de la clase directo desde el HTML).
  readonly statusLabels = RESERVATION_STATUS_LABELS;
  readonly pseudoCode = pseudoCode;
  readonly turnCode = turnCode;

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
  readonly detailError = signal<string | null>(null);
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

  constructor(private reservationService: ReservationService) { }

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
    this.detailError.set(null); // limpia un aviso anterior
    this.activeTab.set(tab);
    this.page.set(1);
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
          rows.map((r) => (r.id === updated.id ? mergeReservation(r, updated) : r))
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
    this.detailError.set(null); // limpia un aviso anterior
    this.isLoadingDetail.set(true);
    this.reservationService.getById(reservationId).subscribe({
      next: (detail) => {
        this.selectedDetail.set(detail);
        this.isLoadingDetail.set(false);
      },
      error: (err) => {
        // 403/404 traen { code, description }; si no, texto de respaldo.
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

  // ---------- contadores, filtros por columna y paginación (solo en pantalla) ----------

  readonly pageSize = 15;
  readonly page = signal(1);
  readonly openFilter = signal<ColKey | null>(null);

  readonly colFilters = signal<Record<ColKey, string>>({
    code: '', requester: '', career: '', space: '', date: '', status: '',
  });

  readonly textColumns: { key: ColKey; label: string; title: string; placeholder: string }[] = [
    { key: 'code', label: 'Turno', title: 'Filtrar turno', placeholder: 'Ej. B2233' },
    { key: 'requester', label: 'Solicitante', title: 'Filtrar solicitante', placeholder: 'Buscar nombre...' },
    { key: 'career', label: 'Carrera', title: 'Filtrar carrera', placeholder: 'Buscar carrera...' },
    { key: 'space', label: 'Espacio', title: 'Filtrar espacio', placeholder: 'Buscar espacio...' },
  ];

  private normalize(value: string): string {
    return value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
  }

  // Contador de cada tarjeta de estado.
  readonly tabCounts = computed(() => {
    const rows = this.reservations();
    const counts = {} as Record<TabId, number>;
    for (const t of this.tabs) {
      counts[t.id] = rows.filter((r) => t.matches(r.currentStatus)).length;
    }
    return counts;
  });

  // Estados que existen en la pestaña actual (para el filtro de Estado).
  readonly statusOptions = computed(() => {
    const seen = new Set(this.filteredReservations().map((r) => r.currentStatus));
    return [...seen].map((s) => ({ value: s as string, label: this.statusLabels[s] }));
  });

  // Pestaña actual + filtros de columna.
  readonly visibleReservations = computed(() => {
    const f = this.colFilters();
    const code = this.normalize(f.code);
    const requester = this.normalize(f.requester);
    const career = this.normalize(f.career);
    const space = this.normalize(f.space);

    return this.filteredReservations().filter((r) => {
      if (code && !this.normalize(turnCode(r.id)).includes(code)) return false;
      if (requester && !this.normalize(r.requesterName ?? r.userId ?? '').includes(requester)) return false;
      if (career && !this.normalize(r.careerName ?? '').includes(career)) return false;
      if (space && !this.normalize(r.spaceName ?? '').includes(space)) return false;
      if (f.date && r.date.slice(0, 10) !== f.date) return false;
      if (f.status && r.currentStatus !== f.status) return false;
      return true;
    });
  });

  readonly totalPages = computed(() =>
    Math.max(1, Math.ceil(this.visibleReservations().length / this.pageSize))
  );
  readonly currentPage = computed(() => Math.min(this.page(), this.totalPages()));

  readonly pagedReservations = computed(() => {
    const start = (this.currentPage() - 1) * this.pageSize;
    return this.visibleReservations().slice(start, start + this.pageSize);
  });

  readonly rangeStart = computed(() =>
    this.visibleReservations().length === 0 ? 0 : (this.currentPage() - 1) * this.pageSize + 1
  );
  readonly rangeEnd = computed(() =>
    Math.min(this.currentPage() * this.pageSize, this.visibleReservations().length)
  );

  readonly pageNumbers = computed<(number | '…')[]>(() => {
    const total = this.totalPages();
    const cur = this.currentPage();
    if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);

    const pages: (number | '…')[] = [1];
    const start = Math.max(2, cur - 1);
    const end = Math.min(total - 1, cur + 1);
    if (start > 2) pages.push('…');
    for (let i = start; i <= end; i++) pages.push(i);
    if (end < total - 1) pages.push('…');
    pages.push(total);
    return pages;
  });

  readonly activeChips = computed(() => {
    const f = this.colFilters();
    const chips: { key: ColKey; label: string; value: string }[] = [];
    if (f.code) chips.push({ key: 'code', label: 'Turno', value: f.code });
    if (f.requester) chips.push({ key: 'requester', label: 'Solicitante', value: f.requester });
    if (f.career) chips.push({ key: 'career', label: 'Carrera', value: f.career });
    if (f.space) chips.push({ key: 'space', label: 'Espacio', value: f.space });
    if (f.date) chips.push({ key: 'date', label: 'Fecha', value: f.date.split('-').reverse().join('/') });
    if (f.status) {
      chips.push({
        key: 'status', label: 'Estado',
        value: this.statusLabels[f.status as ReservationStatus] ?? f.status,
      });
    }
    return chips;
  });

  hasFilter(col: ColKey): boolean {
    return !!this.colFilters()[col];
  }

  toggleFilter(col: ColKey): void {
    this.openFilter.update((cur) => (cur === col ? null : col));
    if (this.openFilter()) {
      setTimeout(() => document.getElementById('col-filter-input')?.focus());
    }
  }

  closeFilter(): void {
    this.openFilter.set(null);
  }

  setFilter(col: ColKey, value: string): void {
    this.colFilters.update((f) => ({ ...f, [col]: value }));
    this.page.set(1);
  }

  pick(col: ColKey, value: string): void {
    this.setFilter(col, this.colFilters()[col] === value ? '' : value);
    this.closeFilter();
  }

  clearFilter(col: ColKey): void {
    this.setFilter(col, '');
  }

  clearAllFilters(): void {
    this.colFilters.set({ code: '', requester: '', career: '', space: '', date: '', status: '' });
    this.page.set(1);
    this.closeFilter();
  }

  goToPage(p: number): void {
    this.page.set(p);
  }

  prevPage(): void {
    this.page.set(Math.max(1, this.currentPage() - 1));
  }

  nextPage(): void {
    this.page.set(Math.min(this.totalPages(), this.currentPage() + 1));
  }
}