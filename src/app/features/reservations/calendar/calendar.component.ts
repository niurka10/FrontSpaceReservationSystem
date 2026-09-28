import { Component, computed, OnInit, signal } from "@angular/core";
import { CommonModule } from "@angular/common";
import { Reservation } from "../models/reservation.interface";
import { ReservationService } from "../services/reservation.service";
import { AuthService } from "../../../core/auth/auth.service";

interface DayColumn {
    date: Date;
    dowLabel: string; //dias de la semana lunes, martes, etc..
    dayNumber: number;
}

const ACTIVE_STATUSES = ['Draft', 'PendingCoordinator', 'PendingVicerrector', 'PendingAssets', 'Approved'];
const HOURS = Array.from({ length: 12 }, (_, i) => 7 + i) // 07:00 a 18:00

@Component({
    selector: 'app-calendar',
    standalone: true,
    imports: [CommonModule],
    templateUrl: './calendar.component.html',
    styleUrl: './calendar.component.scss'
})
export class CalendarComponent implements OnInit {

    readonly hours = HOURS;
    readonly reservations = signal<Reservation[]>([]);
    readonly isLoading = signal(true);
    // weekOffset donde 0 es semana actual -1 semana anteriior y 1 semana siguiente
    readonly weekOffset = signal(0);

    readonly weekStart = computed<Date>(() => {
        const today = new Date();
        const day = (today.getDay() + 6) % 7;
        const monday = new Date(today);
        monday.setDate(today.getDate() - day + this.weekOffset() * 7);
        monday.setHours(0, 0, 0, 0);
        return monday;
    });

    readonly days = computed<DayColumn[]>(() => {
        const dowNames = ['Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab', 'Dom'];
        const start = this.weekStart();
        return dowNames.map((label, i) => {
            const d = new Date(start);
            d.setDate(start.getDate() + i);
            return { date: d, dowLabel: label, dayNumber: d.getDate() };
        });
    });

    constructor(
        private reservationService: ReservationService,
        private authService: AuthService) { }

        ngOnInit(): void {
        const source$ = this.authService.hasRole('Coordinator')
            ? this.reservationService.listForMyCareer()
            : this.reservationService.listMine();

        source$.subscribe({
            next: (rows) => {
                this.reservations.set(rows.filter((r) => ACTIVE_STATUSES.includes(r.currentStatus)));
                this.isLoading.set(false);
            },
            error: () => this.isLoading.set(false),
        });
    }

    prevWeek(): void { this.weekOffset.update((v) => v - 1); }
    nextWeek(): void { this.weekOffset.update((v) => v + 1); }
    goToday(): void { this.weekOffset.set(0); }

    readonly rowHeight = 44; // px — debe coincidir con el alto de fila del SCSS
    readonly headerHeight = 44;

    blocksForDay(day: Date) {
        return this.reservations()
            .filter((r) => this.isSameDay(new Date(r.date), day))
            .map((r) => ({ reservation: r, ...this.blockPosition(r) }));
    }

    private isSameDay(a: Date, b: Date): boolean {
        return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
    }

    // La "matemática" del calendario: convierte "14:00:00" en 14.0, "14:30:00" en
    // 14.5, etc. Con eso calculamos a cuántos px del borde superior empieza el
    // bloque (top) y qué tan alto es (height), en base a rowHeight = 1 hora.
    private blockPosition(r: Reservation): { top: number; height: number } {
        const start = this.toDecimalHours(r.startTime);
        const end = this.toDecimalHours(r.endTime);
        const firstHour = this.hours[0];

        // + headerHeight: el bloque se posiciona DENTRO de la columna del día,
        // que ya incluye su propia celda de encabezado arriba (ver HTML nuevo).
        const top = this.headerHeight + (start - firstHour) * this.rowHeight;
        const height = Math.max((end - start) * this.rowHeight - 4, 18);
        return { top, height };
    }

    private toDecimalHours(hhmmss: string): number {
        const [h, m] = hhmmss.split(':').map(Number);
        return h + m / 60;
    }
}