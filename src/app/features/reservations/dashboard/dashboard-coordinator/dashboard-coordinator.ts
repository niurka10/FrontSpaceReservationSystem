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
    selector: 'app-dashboard-coordinator',
    standalone: true,
    imports: [CommonModule],
    templateUrl: './dashboard-coordinator.html',
    styleUrl: './dashboard-coordinator.scss'
})

export class DashboardCoordinatorComponent implements OnInit {
    readonly reservations = signal<Reservation[]>([]);
    readonly isLoading = signal(true);

    readonly cards = computed<StatCard[]>(() => {
        const row = this.reservations();

        // Pendientes de MI revisión: todavía no las elevé ni las rechacé.
        const pendientes = row.filter(r => r.currentStatus === 'PendingCoordinator').length;

        // Remitidas: ya pasaron mi etapa (las eleve hacia Vicerrectorado o más allá).
        const remitidas = row.filter(r =>
            ['PendingVicerrector', 'PendingAssets', 'Approved'].includes(r.currentStatus)
        ).length;

        const rechazadas = row.filter(r => r.currentStatus === 'Rejected').length;

        return [
            { label: 'Pendientes de mi revisión', value: pendientes, accent: '#b3720a' },
            { label: 'Remitidas', value: remitidas, accent: '#3457e8' },
            { label: 'Rechazadas', value: rechazadas, accent: '#c22b2b' },
            { label: 'Total de mi carrera', value: row.length, accent: '#8892a6' },
        ]
    });

    constructor(private reservationService: ReservationService) {}

    ngOnInit(): void {
        this.reservationService.listForMyCareer().subscribe({
            next: (rows) => {
                this.reservations.set(rows);
                this.isLoading.set(false);
            },
            error: () => this.isLoading.set(false),
        })
    }
}