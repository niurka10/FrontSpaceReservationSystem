import { CommonModule } from '@angular/common';
import { Component, computed, input, output, signal } from '@angular/core';
import {
  RESERVATION_HISTORY_ACTION_LABELS,
  RESERVATION_STATUS_LABELS,
  RESERVATION_STEP_BY_STATUS,
  ReservationDetail,
  ReservationHistoryEntry,
  ReservationStatus,
} from '../../models/reservation.interface';

const STEP_LABELS = ['Solicitud', 'Coordinador', 'Vicerrectorado', 'Asignación'];

// Justificaciones más largas que esto se pliegan con "Ver más".
const LONG_TEXT = 140;

@Component({
  selector: 'app-reservation-detail-modal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './reservation-detail-modal.component.html',
  styleUrl: './reservation-detail-modal.component.scss',
  // Escape cierra el modal. '(document:keydown.escape)' escucha en toda la página.
  host: { '(document:keydown.escape)': 'closed.emit()' },
})
export class ReservationDetailModalComponent {
  // El modal NO pide datos: recibe el detalle ya cargado por la pantalla que lo abre
  // (cada pantalla conserva su propio openDetail y su manejo de errores).
  readonly detail = input.required<ReservationDetail>();
  readonly closed = output<void>();

  readonly statusLabels = RESERVATION_STATUS_LABELS;
  readonly actionLabels = RESERVATION_HISTORY_ACTION_LABELS;

  // Mismo código RSV-XXXXXXXX que el resto de la app.
  readonly code = computed(
    () => `RSV-${this.detail().id.replace(/-/g, '').slice(0, 8).toUpperCase()}`
  );

  // ---------- Progreso ----------
  // Cada paso sabe si ya se completó (done) o es el actual (current).
  // Aprobada = todo el flujo terminó, así que los 4 pasos quedan en verde.
  readonly steps = computed(() => {
    const status = this.detail().currentStatus;
    const active = RESERVATION_STEP_BY_STATUS[status];
    const allDone = status === 'Approved';
    return STEP_LABELS.map((label, i) => {
      const num = i + 1;
      return { num, label, done: allDone || num < active, current: !allDone && num === active };
    });
  });

  // Cuánto se rellena la línea de progreso: 0 % en el paso 1, 100 % en el 4.
  readonly fillPercent = computed(() => {
    const reached = this.steps().filter((s) => s.done || s.current).length;
    return (Math.max(reached - 1, 0) / (STEP_LABELS.length - 1)) * 100;
  });

  // ---------- Avisos de estado ----------
  // Rechazada / Cancelada no tienen "paso actual": en vez del stepper mostramos un
  // aviso con quién la cerró y por qué. Draft devuelto por el Coordinador también.
  readonly isClosed = computed(() => {
    const s = this.detail().currentStatus;
    return s === 'Rejected' || s === 'Cancelled';
  });

  // Historial del más reciente al más antiguo (se lee mejor de un vistazo).
  // [...array] copia antes de invertir, para no mutar el original.
  readonly timeline = computed(() => [...this.detail().history].reverse());

  readonly notice = computed<{ kind: ReservationStatus; entry: ReservationHistoryEntry } | null>(() => {
    const d = this.detail();
    const last = this.timeline()[0];
    if (!last) return null;
    if (d.currentStatus === 'Rejected' || d.currentStatus === 'Cancelled') {
      return { kind: d.currentStatus, entry: last };
    }
    // Borrador cuyo último movimiento es "Draft" = lo devolvió el Coordinador.
    if (d.currentStatus === 'Draft' && last.newStatus === 'Draft') {
      return { kind: 'Draft', entry: last };
    }
    return null;
  });

  // ---------- "Ver más" en justificaciones largas ----------
  private readonly expanded = signal<ReadonlySet<string>>(new Set());

  isLong(text: string): boolean {
    return text.length > LONG_TEXT;
  }

  isExpanded(key: string): boolean {
    return this.expanded().has(key);
  }

  toggle(key: string): void {
    this.expanded.update((set) => {
      const next = new Set(set);
      if (!next.delete(key)) next.add(key);
      return next;
    });
  }

  requesterLabel(role?: string): string {
    if (role === 'Teacher') return 'Docente';
    if (role === 'Student') return 'Estudiante';
    return '';
  }
}