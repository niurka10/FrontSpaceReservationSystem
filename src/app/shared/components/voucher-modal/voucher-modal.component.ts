import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, input, output, signal } from '@angular/core';
import { ReservationDetail } from '../../../features/reservations/models/reservation.interface';
import { ReservationService } from '../../../features/reservations/services/reservation.service';
import { VoucherService } from '../../../features/reservations/services/voucher.service';
import { VoucherTicketComponent } from '../voucher-ticket/voucher-ticket.component';
import { apiErrorMessage, apiErrorMessageFromBlob } from '../../../features/reservations/utils/api-error';

@Component({
  selector: 'app-voucher-modal',
  standalone: true,
  imports: [CommonModule, VoucherTicketComponent],
  templateUrl: './voucher-modal.component.html',
  styleUrl: './voucher-modal.component.scss',
})
export class VoucherModalComponent implements OnInit {
  private readonly reservationService = inject(ReservationService);
  private readonly voucherService = inject(VoucherService);

  // El modal recibe solo el id y carga el detalle por su cuenta: así quien
  // lo use (Mis reservas, y más adelante cualquier otra pantalla) no tiene
  // que preocuparse de traer los datos.
  readonly reservationId = input.required<string>();
  readonly closed = output<void>();

  readonly detail = signal<ReservationDetail | null>(null);
  readonly isLoading = signal(true);
  readonly isDownloading = signal(false);
  readonly errorMessage = signal<string | null>(null);

  ngOnInit(): void {
    this.reservationService.getById(this.reservationId()).subscribe({
      next: (detail) => {
        this.detail.set(detail);
        this.isLoading.set(false);
      },
      error: (err) => {
        // 403/404 del detalle traen { code, description } en JSON normal.
        this.errorMessage.set(apiErrorMessage(err, 'No se pudo cargar el comprobante.'));
        this.isLoading.set(false);
      },
    });
  }

  download(): void {
    this.isDownloading.set(true);
    this.errorMessage.set(null);

    const id = this.reservationId();
    // Mismo código "RSV-XXXXXXXX" que ven en las tablas y en el ticket.
    const code = `RSV-${id.replace(/-/g, '').slice(0, 8).toUpperCase()}`;

    this.voucherService.downloadPdf(id).subscribe({
      next: (blob) => {
        this.voucherService.save(blob, `comprobante-${code}.pdf`);
        this.isDownloading.set(false);
      },
      error: async (err) => {
        this.errorMessage.set(
          await apiErrorMessageFromBlob(err, 'No se pudo descargar el PDF.')
        );
        this.isDownloading.set(false);
      },
    });
  }
}