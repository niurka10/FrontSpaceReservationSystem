import { Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Reservation } from '../../models/reservation.interface';
import {
    ACTIVE_STATUSES,
    STATUS_VISUAL_LABEL, StatusVisual, currentWeek, statusVisual, weekRangeLabel,
} from '../utils/dashboard-utils';

@Component({
    selector: 'app-dashboard-week',
    standalone: true,
    imports: [RouterLink],
    templateUrl: './dashboard-week.html',
    styleUrl: './dashboard-week.scss',
})
export class DashboardWeekComponent {
    readonly reservations = input.required<Reservation[]>();

    // La semana se calcula UNA vez al crear el componente (con la fecha real de hoy).
    private readonly week = currentWeek();
    readonly range = weekRangeLabel(this.week);

    readonly legend = (Object.keys(STATUS_VISUAL_LABEL) as StatusVisual[]).map((key) => ({
        key,
        label: STATUS_VISUAL_LABEL[key],
    }));

    // Para cada día de la semana: sus reservas, ordenadas por hora de inicio.
    readonly days = computed(() => {
        // 1) Agrupamos por día comparando TEXTO yyyy-MM-dd (nunca new Date(r.date)).
        // Mismo criterio que el calendario completo: sin Rechazadas ni Canceladas.
        const byDay = new Map<string, Reservation[]>();
        for (const r of this.reservations()) {
            if (!ACTIVE_STATUSES.includes(r.currentStatus)) continue;
            const iso = r.date.slice(0, 10);
            byDay.set(iso, [...(byDay.get(iso) ?? []), r]);
        }

        // 2) Armamos las 7 filas; los días sin reservas quedan con items = [].
        return this.week.map((day) => ({
            ...day,
            items: (byDay.get(day.iso) ?? [])
                .sort((a, b) => a.startTime.localeCompare(b.startTime))
                .map((r) => {
                    const visual = statusVisual(r.currentStatus);
                    return {
                        id: r.id,
                        start: r.startTime.slice(0, 5),
                        end: r.endTime.slice(0, 5),
                        space: r.spaceName ?? 'Reserva de recursos',
                        visual,
                        statusLabel: STATUS_VISUAL_LABEL[visual],
                    };
                }),
        }));
    });
}