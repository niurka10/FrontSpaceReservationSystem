import { CommonModule } from "@angular/common";
import { Component, computed, OnDestroy, OnInit, signal } from "@angular/core";
import { RouterLink } from "@angular/router";
import { Reservation } from "../../models/reservation.interface";
import { ReservationService } from "../../services/reservation.service";
import { AuthService } from "../../../../core/auth/auth.service";

interface StatCard {
    label: string;
    value: number;
    icon: string;
    tone: 'amber' | 'blue' | 'red' | 'gray';
    link: string;
    query?: Record<string, string>;
}

interface Slide {
    icon: string;
    tag: string;
    title: string;
    text: string;
    cta: string;
    link: string;
    theme: 'navy' | 'amber' | 'teal' | 'violet';
}

const pad = (n: number) => String(n).padStart(2, '0');
function todayKey(): string {
    const d = new Date();
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

@Component({
    selector: 'app-dashboard-coordinator',
    standalone: true,
    imports: [CommonModule, RouterLink],
    templateUrl: './dashboard-coordinator.html',
    styleUrl: './dashboard-coordinator.scss'
})
export class DashboardCoordinatorComponent implements OnInit, OnDestroy {
    readonly reservations = signal<Reservation[]>([]);
    readonly isLoading = signal(true);

    constructor(private reservationService: ReservationService, public authService: AuthService) { }

    // ---------- saludo ----------
    readonly userName = computed(() => {
        const email = this.authService.currentUser()?.email ?? '';
        return email.split('@')[0];
    });

    // ---------- tarjetas ----------
    readonly cards = computed<StatCard[]>(() => {
        const row = this.reservations();
        const pendientes = row.filter(r => r.currentStatus === 'PendingCoordinator').length;
        const remitidas = row.filter(r =>
            ['PendingVicerrector', 'PendingAssets', 'Approved'].includes(r.currentStatus)
        ).length;
        const rechazadas = row.filter(r => r.currentStatus === 'Rejected').length;

        return [
            { label: 'Pendientes de mi revisión', value: pendientes, icon: 'bi-hourglass-split', tone: 'amber', link: '/reservations/pending-coordinator' },
            { label: 'Remitidas', value: remitidas, icon: 'bi-send-check-fill', tone: 'blue', link: '/reservations/pending-coordinator' },
            { label: 'Rechazadas', value: rechazadas, icon: 'bi-x-circle-fill', tone: 'red', link: '/reservations/pending-coordinator' },
            { label: 'Total de mi carrera', value: row.length, icon: 'bi-collection-fill', tone: 'gray', link: '/reservations/calendar' },
        ];
    });

    // ---------- listas ----------
    // Las que esperan mi decisión, la más próxima primero.
    readonly pendingList = computed(() =>
        this.reservations()
            .filter(r => r.currentStatus === 'PendingCoordinator')
            .sort((a, b) => (a.date.slice(0, 10) + a.startTime).localeCompare(b.date.slice(0, 10) + b.startTime))
            .slice(0, 4)
    );

    readonly pendingCount = computed(() =>
        this.reservations().filter(r => r.currentStatus === 'PendingCoordinator').length
    );

    // Espacios más solicitados (con barra proporcional).
    readonly topSpaces = computed(() => {
        const counts = new Map<string, number>();
        for (const r of this.reservations()) {
            if (!r.spaceName) continue;
            counts.set(r.spaceName, (counts.get(r.spaceName) ?? 0) + 1);
        }
        const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4);
        const max = sorted[0]?.[1] ?? 1;
        return sorted.map(([name, count]) => ({ name, count, pct: Math.round((count / max) * 100) }));
    });

    // La próxima reserva (aprobada o en trámite) desde hoy.
    private readonly nextReservation = computed(() => {
        const today = todayKey();
        return this.reservations()
            .filter(r => r.currentStatus !== 'Rejected' && r.currentStatus !== 'Cancelled' && r.currentStatus !== 'Draft')
            .filter(r => r.date.slice(0, 10) >= today)
            .sort((a, b) => (a.date.slice(0, 10) + a.startTime).localeCompare(b.date.slice(0, 10) + b.startTime))[0] ?? null;
    });

    // ---------- carrusel ----------
    readonly slides = computed<Slide[]>(() => {
        const out: Slide[] = [];
        const n = this.pendingCount();

        out.push(n > 0
            ? {
                icon: 'bi-bell-fill', tag: 'Requiere tu atención',
                title: `${n} ${n === 1 ? 'solicitud espera' : 'solicitudes esperan'} tu decisión`,
                text: 'Elévalas a Vicerrectorado o recházalas con una justificación.',
                cta: 'Revisar ahora', link: '/reservations/pending-coordinator', theme: 'amber',
            }
            : {
                icon: 'bi-check-circle-fill', tag: 'Todo al día',
                title: 'No tienes solicitudes pendientes',
                text: 'Buen trabajo. Cuando llegue una nueva, aparecerá aquí.',
                cta: 'Ver calendario', link: '/reservations/calendar', theme: 'teal',
            });

        const next = this.nextReservation();
        if (next) {
            const [y, m, d] = next.date.slice(0, 10).split('-');
            out.push({
                icon: 'bi-calendar-event-fill', tag: 'Próxima reserva',
                title: `${next.spaceName ?? 'Solo recursos'} · ${d}/${m}/${y}`,
                text: `${next.startTime.slice(0, 5)}–${next.endTime.slice(0, 5)} · ${next.reason}`,
                cta: 'Ver en el calendario', link: '/reservations/calendar', theme: 'navy',
            });
        }

        const top = this.topSpaces()[0];
        if (top) {
            out.push({
                icon: 'bi-graph-up-arrow', tag: 'Dato de tu carrera',
                title: `${top.name} es el espacio más solicitado`,
                text: `${top.count} ${top.count === 1 ? 'reserva' : 'reservas'} en total.`,
                cta: 'Ver el calendario', link: '/reservations/calendar', theme: 'violet',
            });
        }

        out.push({
            icon: 'bi-clock-history', tag: 'Recuerda',
            title: 'Las reservas requieren 72 horas de anticipación',
            text: 'Planifica con tiempo para que Vicerrectorado y Bienes alcancen a gestionarlas.',
            cta: 'Nueva reserva', link: '/reservations/new', theme: 'navy',
        });

        return out;
    });

    readonly slideIndex = signal(0);
    readonly currentSlide = computed(() => this.slides()[Math.min(this.slideIndex(), this.slides().length - 1)]);
    private paused = false;
    private timer: ReturnType<typeof setInterval> | null = null;

    nextSlide(): void { this.slideIndex.update(i => (i + 1) % this.slides().length); }
    prevSlide(): void { this.slideIndex.update(i => (i - 1 + this.slides().length) % this.slides().length); }
    goTo(i: number): void { this.slideIndex.set(i); }
    pause(v: boolean): void { this.paused = v; }

    ngOnInit(): void {
        this.reservationService.listForMyCareer().subscribe({
            next: (rows) => {
                this.reservations.set(rows);
                this.isLoading.set(false);
            },
            error: () => this.isLoading.set(false),
        });

        this.timer = setInterval(() => { if (!this.paused) this.nextSlide(); }, 6000);
    }

    ngOnDestroy(): void {
        if (this.timer) clearInterval(this.timer);
    }
}