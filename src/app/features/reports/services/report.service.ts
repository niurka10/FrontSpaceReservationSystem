import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { ReportFile, ReportFilters, ReportPreview, ReportType } from '../models/report.model';
import { todayIso } from '../../reservations/dashboard/utils/dashboard-utils';

const API_BASE = '/api/reports';

function fileNameFrom(header: string | null, fallback: string): string {
  if (!header) return fallback;

  const utf8 = /filename\*=UTF-8''([^;]+)/i.exec(header);
  if (utf8) {
    try { return decodeURIComponent(utf8[1]); } catch { /* sigue con el otro formato */ } //!important
  }
  const plain = /filename="?([^";]+)"?/i.exec(header);
  return plain ? plain[1] : fallback;
}

@Injectable({ providedIn: 'root' })
export class ReportService {
  private readonly http = inject(HttpClient);

  getTypes(): Observable<ReportType[]> {
    return this.http.get<ReportType[]>(`${API_BASE}/types`);
  }

  preview(type: string, filters: ReportFilters): Observable<ReportPreview> {
    return this.http.get<ReportPreview>(`${API_BASE}/${type}/preview`, {
      params: this.toParams(filters),
    });
  }

  // El archivo llega como Blob. observe:'response' da acceso a los headers para leer
  // el nombre que sugiere el backend (Content-Disposition).
  export(type: string, filters: ReportFilters): Observable<ReportFile> {
    return this.http
      .get(`${API_BASE}/${type}/export`, {
        params: this.toParams(filters),
        observe: 'response',
        responseType: 'blob',
      })
      .pipe(
        map((res) => ({
          blob: res.body as Blob,
          fileName: fileNameFrom(
            res.headers.get('Content-Disposition'),
            `reporte-${type}-${todayIso()}.xlsx`
          ),
        }))
      );
  }

  // Dispara la descarga en el navegador con un <a download> temporal.
  save(file: ReportFile): void {
    const url = URL.createObjectURL(file.blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = file.fileName;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  private toParams(filters: ReportFilters): HttpParams {
    let params = new HttpParams();
    for (const [key, value] of Object.entries(filters)) {
      if (value) params = params.set(key, value);
    }
    return params;
  }
}