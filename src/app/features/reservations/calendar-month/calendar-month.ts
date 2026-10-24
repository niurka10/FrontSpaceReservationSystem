import { Component, ElementRef, HostListener, OnInit, computed, inject, signal, viewChild } from '@angular/core';
import { AuthService } from '../../../core/auth/auth.service';
import { Reservation, ReservationDetail } from '../models/reservation.interface';
import { ReservationService } from '../services/reservation.service';
import { apiErrorMessage } from '../utils/api-error';
import {
    ACTIVE_STATUSES, STATUS_VISUAL_LABEL, StatusGroup, capitalize, longDateEs, statusGroup,
    statusVisual, todayIso,
} from '../dashboard/utils/dashboard-utils';
import { ReservationDetailModalComponent } from '../pages/reservation-detail-modal/reservation-detail-modal.component';
import { RouterLink } from '@angular/router';
import { NgTemplateOutlet } from '@angular/common';

const MAX_DOTS = 3;
const WEEKDAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
const GROUP_ORDER: Record<StatusGroup, number> = { approved: 0, review: 1, draft: 2, closed: 3 };
//const ROLE_ES: Record<string, string> = { Student: 'Estudiante', Teacher: 'Docente' };
const ROLE_ES: Record<string, string> = { Student: 'Estudiante', Teacher: 'Docente', Coordinator: 'Coordinador' };
const pad = (n: number) => String(n).padStart(2, '0');
const dayKey = (year: number, month: number, day: number) => `${year}-${pad(month + 1)}-${pad(day)}`;

function plusDays(key: string, n: number): string {
    const [y, m, d] = key.split('-').map(Number);
    const r = new Date(y, m - 1, d + n);
    return dayKey(r.getFullYear(), r.getMonth(), r.getDate());
}

const norm = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
const spaceOf = (r: Reservation) => (r.spaceId ? (r.spaceName ?? 'Espacio') : 'Solo recursos');

// Una celda de la cuadrícula del mes.
interface DayCell {
    key: string;
    num: number;
    label: string;        // texto para lectores de pantalla: "21 de octubre, 3 reservas"
    isToday: boolean;
    isSelected: boolean;
    count: number;        // reservas del día
    dots: StatusGroup[];  // hasta 3 puntos
    extra: number;        // cuántas reservas no caben en los puntos
}

@Component({
    selector: 'app-calendar-month',
    standalone: true,
    imports: [RouterLink, NgTemplateOutlet, ReservationDetailModalComponent],
    templateUrl: './calendar-month.html',
    styleUrl: './calendar-month.scss',
})
export class CalendarMonthComponent implements OnInit {
    private readonly reservationService = inject(ReservationService);
    private readonly authService = inject(AuthService);

    readonly weekdays = WEEKDAYS;
    readonly legend = (['approved', 'review', 'draft'] as const).map((g) => ({
        g,
        label: STATUS_VISUAL_LABEL[g],
    }));
    // El Coordinador ve a quién pertenece cada reserva; Student/Teacher solo ven lo suyo.
    readonly isCoordinator = this.authService.hasRole('Coordinator');

    // "Hoy" como texto yyyy-MM-dd con partes locales (se fija al abrir la pantalla).
    private readonly today = todayIso();
    private readonly minBookingKey = plusDays(this.today, 3);

    // ---------- estado ----------
    readonly reservations = signal<Reservation[]>([]);
    readonly isLoading = signal(true);
    readonly errorMessage = signal<string | null>(null);

    // Mes que se está viendo. viewMonth va de 0 (enero) a 11 (diciembre), como Date.
    readonly viewYear = signal(Number(this.today.slice(0, 4)));
    readonly viewMonth = signal(Number(this.today.slice(5, 7)) - 1);

    // Día seleccionado ("yyyy-MM-dd"). Empieza en hoy.
    readonly selectedKey = signal(this.today);

    // ¿Está abierta la hoja inferior con las reservas del día?
    readonly panelOpen = signal(false);

    readonly canBook = computed(() => this.selectedKey() >= this.minBookingKey);

    // ---------- filtros ----------
    readonly roleFilter = signal<string>('all');
    readonly statusFilter = signal<StatusGroup | 'all'>('all');
    readonly spaceFilter = signal<string>('all');
    readonly personQuery = signal('');

    // Opciones sacadas de los datos reales (sin filtrar).
    readonly roleOptions = computed(() => {
        const roles = new Set<string>();
        for (const r of this.reservations()) if (r.requesterRole) roles.add(r.requesterRole);
        return [...roles].map((v) => ({ value: v, label: ROLE_ES[v] ?? v }));
    });

    readonly spaceOptions = computed(() =>
        [...new Set(this.reservations().map(spaceOf))].sort((a, b) => a.localeCompare(b, 'es'))
    );

    readonly hasFilters = computed(() =>
        this.roleFilter() !== 'all' || this.statusFilter() !== 'all' ||
        this.spaceFilter() !== 'all' || this.personQuery().trim() !== ''
    );

    // Reservas que pasan todos los filtros (se combinan con AND).
    readonly filtered = computed(() => {
        const role = this.roleFilter();
        const status = this.statusFilter();
        const space = this.spaceFilter();
        const q = norm(this.personQuery());
        return this.reservations().filter((r) =>
            (role === 'all' || r.requesterRole === role) &&
            (status === 'all' || statusGroup(r.currentStatus) === status) &&
            (space === 'all' || spaceOf(r) === space) &&
            (!q || norm(r.requesterName ?? '').includes(q))
        );
    });

    onRole(e: Event): void { this.roleFilter.set((e.target as HTMLSelectElement).value); }
    onSpace(e: Event): void { this.spaceFilter.set((e.target as HTMLSelectElement).value); }
    onPerson(e: Event): void { this.personQuery.set((e.target as HTMLInputElement).value); }
    toggleStatus(g: StatusGroup): void {
        this.statusFilter.update((cur) => (cur === g ? 'all' : g));
    }
    clearFilters(): void {
        this.roleFilter.set('all');
        this.statusFilter.set('all');
        this.spaceFilter.set('all');
        this.personQuery.set('');
    }

    // ---------- panel de filtros ----------
    readonly filtersOpen = signal(false);
    private readonly host = inject(ElementRef) as ElementRef<HTMLElement>;

    toggleFilters(): void { this.filtersOpen.update((v) => !v); }

    // Clic fuera del panel: se cierra.
    @HostListener('document:click', ['$event'])
    onDocClick(e: Event): void {
        if (!this.filtersOpen()) return;
        const box = this.host.nativeElement.querySelector('.f-wrap');
        if (box && !e.composedPath().includes(box)) this.filtersOpen.set(false);
    }

    // Elegir una opción; si vuelves a tocar la misma, se quita.
    setRole(v: string): void { this.roleFilter.update((c) => (c === v ? 'all' : v)); }
    setSpace(v: string): void { this.spaceFilter.update((c) => (c === v ? 'all' : v)); }

    // Chips de los filtros activos.
    readonly chips = computed(() => {
        const out: { key: 'role' | 'status' | 'space' | 'person'; label: string }[] = [];
        const q = this.personQuery().trim();
        const role = this.roleFilter();
        const status = this.statusFilter();
        if (q) out.push({ key: 'person', label: `"${q}"` });
        if (role !== 'all') out.push({ key: 'role', label: ROLE_ES[role] ?? role });
        if (this.spaceFilter() !== 'all') out.push({ key: 'space', label: this.spaceFilter() });
        if (status !== 'all') out.push({ key: 'status', label: this.legend.find((l) => l.g === status)?.label ?? status });
        return out;
    });

    clearChip(key: 'role' | 'status' | 'space' | 'person'): void {
        if (key === 'role') this.roleFilter.set('all');
        if (key === 'status') this.statusFilter.set('all');
        if (key === 'space') this.spaceFilter.set('all');
        if (key === 'person') this.personQuery.set('');
    }

    // ---------- detalle (mismo patrón que reservation-list) ----------
    readonly selectedDetail = signal<ReservationDetail | null>(null);
    readonly detailError = signal<string | null>(null);
    readonly loadingId = signal<string | null>(null);
    private lastCard: HTMLElement | null = null;

    private readonly closeBtn = viewChild<ElementRef<HTMLButtonElement>>('closeBtn');
    // El botón del día que abrió la hoja: al cerrarla le devolvemos el foco.
    private lastDay: HTMLElement | null = null;

    ngOnInit(): void {
        // Mismo origen que el calendario semanal: Coordinador ve su carrera; el resto, lo suyo.
        const source$ = this.authService.hasRole('Coordinator')
            ? this.reservationService.listForMyCareer()
            : this.reservationService.listMine();

        source$.subscribe({
            next: (rows) => {
                // Rechazadas y Canceladas no se muestran.
                this.reservations.set(rows.filter((r) => ACTIVE_STATUSES.includes(r.currentStatus)));
                this.isLoading.set(false);
            },
            error: (err) => {
                this.errorMessage.set(apiErrorMessage(err, 'No se pudieron cargar las reservas.'));
                this.isLoading.set(false);
            },
        });
    }

    // ---------- datos derivados ----------

    // Mapa "yyyy-MM-dd" → reservas de ese día, ordenadas por hora de inicio.
    // La clave sale de r.date.slice(0, 10): la fecha de una reserva es medianoche UTC,
    // y new Date(r.date) la correría un día atrás en Ecuador.
    readonly byDay = computed(() => {
        const map = new Map<string, Reservation[]>();
        for (const r of this.filtered()) {
            const key = r.date.slice(0, 10);
            map.set(key, [...(map.get(key) ?? []), r]);
        }
        for (const rows of map.values()) rows.sort((a, b) => a.startTime.localeCompare(b.startTime));
        return map;
    });

    // "Octubre de 2026"
    readonly monthLabel = computed(() =>
        capitalize(
            new Intl.DateTimeFormat('es', { month: 'long', year: 'numeric' }).format(
                new Date(this.viewYear(), this.viewMonth(), 1)
            )
        )
    );

    // La cuadrícula: primero los huecos (null) hasta el día de la semana en que cae el
    // día 1, luego solo los días de ESTE mes. Se recalcula sola al cambiar el mes, los
    // datos o el día seleccionado.
    readonly cells = computed<(DayCell | null)[]>(() => {
        const y = this.viewYear();
        const m = this.viewMonth();
        const monthName = new Intl.DateTimeFormat('es', { month: 'long' }).format(new Date(y, m, 1));

        // getDay(): domingo = 0. Con (n + 6) % 7 la semana empieza en lunes (lunes = 0).
        const blanks = (new Date(y, m, 1).getDay() + 6) % 7;
        const total = new Date(y, m + 1, 0).getDate();

        const byDay = this.byDay();
        const selected = this.selectedKey();
        const cells: (DayCell | null)[] = new Array<DayCell | null>(blanks).fill(null);

        for (let d = 1; d <= total; d++) {
            const key = dayKey(y, m, d);
            const rows = byDay.get(key) ?? [];
            const groups = rows
                .map((r) => statusGroup(r.currentStatus))
                .sort((a, b) => GROUP_ORDER[a] - GROUP_ORDER[b]);
            const countText = rows.length === 0 ? 'sin reservas' : rows.length === 1 ? '1 reserva' : `${rows.length} reservas`;

            cells.push({
                key,
                num: d,
                label: `${d} de ${monthName}, ${countText}`,
                isToday: key === this.today,
                isSelected: key === selected,
                count: rows.length,
                dots: groups.slice(0, MAX_DOTS),
                extra: Math.max(rows.length - MAX_DOTS, 0),
            });
        }
        return cells;
    });

    // ---------- panel del día ----------
    readonly selectedDateLabel = computed(() => {
        const [y, m, d] = this.selectedKey().split('-').map(Number);
        return longDateEs(new Date(y, m - 1, d));
    });

    readonly items = computed(() =>
        (this.byDay().get(this.selectedKey()) ?? []).map((r) => {
            const visual = statusVisual(r.currentStatus);
            const n = r.resourceCount ?? 0; 
            return {
                id: r.id,
                start: r.startTime.slice(0, 5),
                end: r.endTime.slice(0, 5),
                space: spaceOf(r),
                resourcePill: n > 0 ? `${r.spaceId ? '+' : ''}${n} ${n === 1 ? 'recurso' : 'recursos'}` : null,
                reason: r.reason,
                visual,
                statusLabel: STATUS_VISUAL_LABEL[visual],
                requester: this.isCoordinator
                    ? [r.requesterName, r.requesterRole ? (ROLE_ES[r.requesterRole] ?? r.requesterRole) : null, r.careerName]
                        .filter(Boolean)
                        .join(' · ')
                    : '',
            };
        })
    );

    readonly countLabel = computed(() => {
        const n = this.items().length;
        return n === 0 ? 'Sin reservas' : n === 1 ? '1 reserva' : `${n} reservas`;
    });

    prevMonth(): void { this.moveMonth(-1); }
    nextMonth(): void { this.moveMonth(1); }

    private moveMonth(delta: number): void {
        // new Date(año, mes + delta, 1) resuelve solo el cambio de año (diciembre → enero).
        const d = new Date(this.viewYear(), this.viewMonth() + delta, 1);
        this.viewYear.set(d.getFullYear());
        this.viewMonth.set(d.getMonth());

        // Se selecciona hoy si es el mes actual; si no, el día 1.
        const first = dayKey(d.getFullYear(), d.getMonth(), 1);
        this.selectedKey.set(first.slice(0, 7) === this.today.slice(0, 7) ? this.today : first);
    }

    goToday(): void {
        this.viewYear.set(Number(this.today.slice(0, 4)));
        this.viewMonth.set(Number(this.today.slice(5, 7)) - 1);
        this.selectedKey.set(this.today);
    }

    selectDay(key: string, event: Event): void {
        this.detailError.set(null);
        this.selectedKey.set(key);
        this.lastDay = event.currentTarget as HTMLElement;
        this.panelOpen.set(true);
        // setTimeout: se espera a que Angular quite el "inert" antes de mover el foco.
        setTimeout(() => this.closeBtn()?.nativeElement.focus({ preventScroll: true }));
    }

    closePanel(): void {
        this.detailError.set(null);
        this.panelOpen.set(false);
        this.lastDay?.focus({ preventScroll: true });
    }

    // Con el modal de detalle abierto, Escape lo cierra el propio modal (escucha en el
    // documento). Aquí NO se cierra también la hoja: por eso el return anticipado.
    onEscape(): void {
        if (this.selectedDetail()) return;
        if (this.panelOpen()) this.closePanel();
    }

    openDetail(id: string, event: Event): void {
        this.detailError.set(null);
        this.lastCard = event.currentTarget as HTMLElement;
        this.loadingId.set(id);
        this.reservationService.getById(id).subscribe({
            next: (detail) => {
                this.selectedDetail.set(detail);
                this.loadingId.set(null);
            },
            error: (err) => {
                // 403/404: el `description` del backend se muestra dentro de la hoja.
                this.detailError.set(apiErrorMessage(err, 'No se pudo cargar el detalle.'));
                this.loadingId.set(null);
            },
        });
    }

    closeDetail(): void {
        this.selectedDetail.set(null);
        this.lastCard?.focus({ preventScroll: true });
    }
}