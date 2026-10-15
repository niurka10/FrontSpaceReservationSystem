import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { map, Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class VoucherService {
  private readonly http = inject(HttpClient);

  // Por qué se descarga con HttpClient y no con un enlace directo a la URL:
  // el endpoint exige el token JWT en el encabezado Authorization, y un
  // enlace o window.open no lo envía. HttpClient sí (lo agrega tu interceptor).
  downloadPdf(reservationId: string): Observable<Blob> {
    return this.http
      .get(`/api/voucher/${reservationId}`, { responseType: 'blob' })
      // Se re-empaqueta con el tipo correcto: mientras el controller diga
      // "application.pdf" (con punto), el navegador no reconocería el archivo.
      .pipe(map((blob) => new Blob([blob], { type: 'application/pdf' })));
  }

  // Convierte el Blob en un archivo descargable y dispara la descarga.
  save(blob: Blob, fileName: string): void {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.click();
    // Libera la memoria del archivo temporal.
    URL.revokeObjectURL(url);
  }
}