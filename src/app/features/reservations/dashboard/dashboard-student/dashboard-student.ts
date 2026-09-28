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
    selector: 'app-dashboard-student',
    standalone: true,
    imports: [CommonModule],
    templateUrl: './dashboard-student.html',
    styleUrl: './dashboard-student.scss'
})

export class DashboardStudentComponent implements OnInit {
    readonly reservations = signal<Reservation[]>([]);
    readonly isLoading = signal(true);

    readonly cards = computed<StatCard[]>(() => {
        const row = this.reservations();
        const enTramite = row.filter(r => 
            !['Approved', 'Rejected', 'Cancelled'].includes(r.currentStatus)
        ).length;

        const aprobadas = row.filter(r => r.currentStatus === 'Approved').length;
        const rechazadas = row.filter(r => r.currentStatus === 'Rejected').length;

        return [
            { label: 'Mis solicitudes en tramites', value: enTramite, accent: '#b3720a'},
            { label: 'Reservas aprobadas', value: aprobadas, accent: '#158a4c'},
            { label: 'Rechazadas', value: rechazadas, accent: '#c22b2b'},
            { label: 'Total en mi historia', value: row.length, accent: '#8892a6'},
        ]
    });


    constructor(private reservationService: ReservationService){}


    ngOnInit(): void {
        this.reservationService.listMine().subscribe({
            next: (rows) => {
                this.reservations.set(rows);
                this.isLoading.set(false);
            },
            error: () => this.isLoading.set(false),
        })
    }
}