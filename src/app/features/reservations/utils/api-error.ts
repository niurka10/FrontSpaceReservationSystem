import { HttpErrorResponse } from '@angular/common/http';

// El backend responde los errores como { code, description }.
// Angular los entrega en err.error. Esta función saca el `description`
// si existe y, si no, usa un texto de respaldo.
export function apiErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof HttpErrorResponse) {
    const description = err.error?.description;
    if (typeof description === 'string' && description.trim()) {
      return description;
    }
    // Respaldo por si el cuerpo viene vacío (por ejemplo un 403 sin JSON).
    if (err.status === 403) return 'No tienes permiso para ver esta reserva.';
    if (err.status === 404) return 'La reserva no existe.';
  }
  return fallback;
}