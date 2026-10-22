import { Component, OnInit, signal } from "@angular/core";
import { Reservation } from "../../models/reservation.interface";
import { ReservationService } from "../../services/reservation.service";
import { apiErrorMessage } from "../../utils/api-error";
import { DashboardGreetingComponent } from "../dashboard-greeting/dashboard-greeting";
import { DashboardKpisComponent } from "../dashboard-kpis/dashboard-kpis";
import { VoucherModalComponent } from "../../../../shared/components/voucher-modal/voucher-modal.component";
import { DashboardUpcomingComponent } from "../dashboard-upcoming/dashboard-upcoming";
import { DashboardWeekComponent } from "../dashboard-week/dashboard-week";
import { DashboardActivityComponent } from "../dashboard-activity/dashboard-activity";

@Component({
    selector: 'app-dashboard-student',
    standalone: true,
    imports: [DashboardGreetingComponent, DashboardKpisComponent, DashboardUpcomingComponent, VoucherModalComponent, DashboardWeekComponent, DashboardActivityComponent],
    templateUrl: './dashboard-student.html',
    styleUrl: './dashboard-student.scss'
})
export class DashboardStudentComponent implements OnInit {
    // Una sola petición a /mine; los componentes hijos reciben la lista por input.
    readonly reservations = signal<Reservation[]>([]);
    readonly isLoading = signal(true);
    readonly loadError = signal<string | null>(null);
    readonly voucherId = signal<string | null>(null);

    constructor(private reservationService: ReservationService) { }

    ngOnInit(): void {
        this.reservationService.listMine().subscribe({
            next: (rows) => {
                this.reservations.set(rows);
                this.isLoading.set(false);
            },
            error: (err) => {
                this.loadError.set(apiErrorMessage(err, 'No se pudieron cargar tus reservas.'));
                this.isLoading.set(false);
            },
        });
    }

    openVoucher(id: string): void {
        this.voucherId.set(id);
    }

    closeVoucher(): void {
        this.voucherId.set(null);
    }
}

