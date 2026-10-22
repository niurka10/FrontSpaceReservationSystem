import { Component, computed, effect, input, signal, untracked } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Reservation } from '../../models/reservation.interface';
import { StatusGroup, statusGroup } from '../utils/dashboard-utils';

// `estado` es el valor que "Mis reservas" entiende en ?estado=
// (su filtro 'pending' agrupa las 3 pendientes, igual que 'review' aquí).
const KPI_DEFS: { group: StatusGroup; label: string; icon: string; estado: string }[] = [
  { group: 'draft', label: 'Borradores', icon: 'bi-pencil-square', estado: 'draft' },
  { group: 'review', label: 'En revisión', icon: 'bi-hourglass-split', estado: 'pending' },
  { group: 'approved', label: 'Aprobadas', icon: 'bi-check-circle-fill', estado: 'approved' },
  { group: 'closed', label: 'Rechazadas/Canceladas', icon: 'bi-x-circle-fill', estado: 'closed' },
];

const DURATION_MS = 700;

@Component({
  selector: 'app-dashboard-kpis',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './dashboard-kpis.html',
  styleUrl: './dashboard-kpis.scss',
})
export class DashboardKpisComponent {
  // Recibe la lista ya cargada por el contenedor (una sola petición a /mine).
  readonly reservations = input.required<Reservation[]>();

  // Valor FINAL de cada tarjeta. computed: se recalcula solo si cambia la lista.
  readonly cards = computed(() => {
    const counts: Record<StatusGroup, number> = { draft: 0, review: 0, approved: 0, closed: 0 };
    for (const r of this.reservations()) counts[statusGroup(r.currentStatus)]++;
    return KPI_DEFS.map((d) => ({ ...d, value: counts[d.group] }));
  });

  // Número que se ve en pantalla en cada momento (va subiendo hasta el valor final).
  readonly shown = signal<number[]>(KPI_DEFS.map(() => 0));

  constructor() {
    // effect(): se vuelve a ejecutar cuando cambian los valores finales.
    effect((onCleanup) => {
      const targets = this.cards().map((c) => c.value);
      // untracked: leemos `shown` sin que el effect dependa de él (si no, al
      // escribirlo en cada frame se dispararía a sí mismo en bucle).
      const from = untracked(() => this.shown());

      const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (reduce) {
        this.shown.set(targets); // sin animación: el número aparece directo
        return;
      }

      const start = performance.now();
      let frame = 0;
      const step = (now: number) => {
        const t = Math.min((now - start) / DURATION_MS, 1); // progreso 0 → 1
        const eased = 1 - Math.pow(1 - t, 3);               // arranca rápido, frena al final
        this.shown.set(targets.map((to, i) => Math.round(from[i] + (to - from[i]) * eased)));
        if (t < 1) frame = requestAnimationFrame(step);
      };
      frame = requestAnimationFrame(step);

      // Si cambian los datos a mitad de animación (o se destruye el componente),
      // se cancela el frame pendiente.
      onCleanup(() => cancelAnimationFrame(frame));
    });
  }
}