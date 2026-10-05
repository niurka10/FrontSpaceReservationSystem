import { CommonModule } from "@angular/common";
import { Component, computed, OnInit, signal } from "@angular/core";
import { Reservation } from "../../models/reservation.interface";
import { ReservationService } from "../../services/reservation.service";

interface StatCard {
    label: string;
    value: number;
    accent: string;
}

@Component({
    selector: 'app-dashboard-bienes',
    standalone: true,
    imports: [CommonModule],
    templateUrl: './dashboard-bienes.html',
    styleUrl: './dashboard-bienes.scss'
})
export class DashboardBienesComponent implements OnInit {
    readonly reservations = signal<Reservation[]>([]);
    readonly isLoading = signal(true);

    readonly cards = computed<StatCard[]>(() => {
        const row = this.reservations();

        // Fechas como "YYYY-MM-DD" (hora local): se comparan como texto,
        // que en este formato ordena igual que las fechas.
        const hoy = this.toDay(new Date());
        const en7 = new Date();
        en7.setDate(en7.getDate() + 7);
        const limite = this.toDay(en7);

        const aprobadas = row.filter(r => r.currentStatus === 'Approved');

        // Lo que espera que Bienes asigne un espacio.
        const pendientes = row.filter(r => r.currentStatus === 'PendingAssets').length;

        // Aprobadas cuya fecha de uso es hoy.
        const hoyCount = aprobadas.filter(r => r.date.substring(0, 10) === hoy).length;

        // Aprobadas con uso entre mañana y dentro de 7 días.
        const proximas = aprobadas.filter(r => {
            const d = r.date.substring(0, 10);
            return d > hoy && d <= limite;
        }).length;

        return [
            { label: 'Pendientes de asignación', value: pendientes, accent: '#b3720a' },
            { label: 'Aprobadas para hoy', value: hoyCount, accent: '#158a4c' },
            { label: 'Próximos 7 días', value: proximas, accent: '#3457e8' },
            { label: 'Total asignadas', value: aprobadas.length, accent: '#8892a6' },
        ];
    });

    constructor(private reservationService: ReservationService) {}

    ngOnInit(): void {
        this.reservationService.listForAssets().subscribe({
            next: (rows) => {
                this.reservations.set(rows);
                this.isLoading.set(false);
            },
            error: () => this.isLoading.set(false),
        });
    }

    // 'en-CA' devuelve YYYY-MM-DD en hora local (toISOString usaría UTC y
    // podría correr el día).
    private toDay(d: Date): string {
        return d.toLocaleDateString('en-CA');
    }
}