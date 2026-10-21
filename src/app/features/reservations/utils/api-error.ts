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

// Igual que apiErrorMessage, pero para peticiones con responseType 'blob':
// ahí el cuerpo del error llega como Blob, así que primero lo leemos como texto
// y lo convertimos a JSON para sacar el `description`.
export async function apiErrorMessageFromBlob(err: unknown, fallback: string): Promise<string> {
  if (err instanceof HttpErrorResponse && err.error instanceof Blob) {
    try {
      const body = JSON.parse(await err.error.text());
      if (typeof body?.description === 'string' && body.description.trim()) {
        return body.description;
      }
    } catch {
      // El cuerpo no era JSON (vacío o texto): seguimos con el respaldo.
    }
  }
  return apiErrorMessage(err, fallback);
}