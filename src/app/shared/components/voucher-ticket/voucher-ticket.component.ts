import { CommonModule } from '@angular/common';
import { Component, computed, input, signal } from '@angular/core';
import {
  RESERVATION_STATUS_LABELS,
  ReservationDetail,
} from '../../../features/reservations/models/reservation.interface';

// DATOS DE EJEMPLO: solo para ver el efecto en este paso, cuando el input
// "reservation" llega vacío. En el paso 2 se borran.
const SAMPLE: ReservationDetail = {
  id: '1cd8773e-e52b-45c2-80ea-1e7d68b0c834',
  date: '2026-10-07T00:00:00Z',
  startTime: '12:00:00',
  endTime: '13:00:00',
  reason: 'Prueba 3 recursos solo 1 cada uno',
  currentStatus: 'Approved',
  userId: '00000000-0000-0000-0000-000000000000',
  spaceId: null,
  requesterName: 'Ariana Sarahi',
  requesterRole: 'Student',
  resources: [
    { resourceName: 'Proyector', quantity: 1 },
    { resourceName: 'Parlante', quantity: 1 },
    { resourceName: 'Extensión eléctrica', quantity: 1 },
  ],
  history: [],
};

@Component({
  selector: 'app-voucher-ticket',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './voucher-ticket.component.html',
  styleUrl: './voucher-ticket.component.scss',
})
export class VoucherTicketComponent {
  readonly statusLabels = RESERVATION_STATUS_LABELS;

  // input() es la forma moderna de @Input con signals. Si no llega nada,
  // el componente se dibuja con SAMPLE.
  readonly reservation = input<ReservationDetail | null>(null);
  // Momento en que se generó el voucher (GenerationDate del backend).
  // Es un instante exacto, por eso se muestra en hora local (sin ': UTC').
  readonly generatedAt = input<string | null>(null);

  readonly isSample = computed(() => this.reservation() === null);
  readonly data = computed(() => this.reservation() ?? SAMPLE);
  readonly issuedAt = computed(() =>
    this.isSample() ? new Date().toISOString() : this.generatedAt()
  );

  // Mismo código "RSV-XXXXXXXX" que ya ves en las tablas.
  readonly code = computed(
    () => `RSV-${this.data().id.replace(/-/g, '').slice(0, 8).toUpperCase()}`
  );

  // true mientras el papel sale; cambia el texto de la "impresora".
  readonly isPrinting = signal(true);

  // Truco para repetir la animación: el @for del HTML itera sobre [runKey()].
  // Al cambiar la clave, Angular destruye y recrea el ticket, y la animación
  // CSS arranca de nuevo.
  readonly runKey = signal(0);

  // (animationend) avisa cuando el CSS terminó de "imprimir": así el texto
  // cambia justo al terminar, sin depender de un setTimeout.
  onPrinted(): void {
    this.isPrinting.set(false);
  }

  replay(): void {
    this.isPrinting.set(true);
    this.runKey.update((v) => v + 1);
  }
}