import { ReservationStatus } from "../../models/reservation.interface";

export function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function longDateEs(date: Date): string {
  return capitalize(
    new Intl.DateTimeFormat('es', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(date)
  );
}

// Mismo criterio que el calendario completo (calendar.component.ts): la
// agenda semanal no muestra Rechazadas ni Canceladas.
export const ACTIVE_STATUSES: ReservationStatus[] = [
  'Draft', 'PendingCoordinator', 'PendingVicerrector', 'PendingAssets', 'Approved',
];

export type StatusGroup = 'draft' | 'review' | 'approved' | 'closed';

export function statusGroup(status: ReservationStatus): StatusGroup {
  switch (status) {
    case 'Draft': return 'draft';
    case 'Approved': return 'approved';
    case 'Rejected':
    case 'Cancelled': return 'closed';
    default: return 'review'; // PendingCoordinator, PendingVicerrector, PendingAssets
  }
}

// Un Date → "yyyy-MM-dd" con sus partes LOCALES (nunca toISOString: devuelve UTC).
function isoFromLocal(d: Date): string {
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

export function todayIso(): string {
  return isoFromLocal(new Date());
}

// "yyyy-MM-dd" → Date a medianoche UTC, para formatearlo con Intl en 'UTC'
// sin que la zona horaria lo desplace de día.
function utcFromIso(iso: string): Date {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

// ---------- Semana actual (lunes a domingo) ----------
export interface WeekDay {
  iso: string;       // "2026-10-19"
  name: string;      // "Lun"
  num: number;       // 19
  isToday: boolean;
}

const DAY_NAMES = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

export function currentWeek(): WeekDay[] {
  const now = new Date();
  const today = isoFromLocal(now);
  // getDay(): domingo = 0 ... sábado = 6. Esto lo convierte a lunes = 0 ... domingo = 6.
  const sinceMonday = (now.getDay() + 6) % 7;

  return DAY_NAMES.map((name, i) => {
    // new Date(año, mes, día + n) resuelve solo los cambios de mes y de año.
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - sinceMonday + i);
    const iso = isoFromLocal(d);
    return { iso, name, num: d.getDate(), isToday: iso === today };
  });
}

// "Semana del 19 al 25 de octubre"  /  "Semana del 28 de octubre al 3 de noviembre"
export function weekRangeLabel(week: WeekDay[]): string {
  const month = (iso: string) =>
    new Intl.DateTimeFormat('es', { month: 'long', timeZone: 'UTC' }).format(utcFromIso(iso));
  const first = week[0];
  const last = week[week.length - 1];
  const m1 = month(first.iso);
  const m2 = month(last.iso);
  return m1 === m2
    ? `Semana del ${first.num} al ${last.num} de ${m1}`
    : `Semana del ${first.num} de ${m1} al ${last.num} de ${m2}`;
}

// ---------- Estado visual (los 5 estados del backend, con su color) ----------
export type StatusVisual = 'draft' | 'review' | 'approved' | 'rejected' | 'cancelled';

export const STATUS_VISUAL_LABEL: Record<StatusVisual, string> = {
  draft: 'Borrador',
  review: 'En revisión',
  approved: 'Aprobada',
  rejected: 'Rechazada',
  cancelled: 'Cancelada',
};

export function statusVisual(status: ReservationStatus): StatusVisual {
  switch (status) {
    case 'Draft': return 'draft';
    case 'Approved': return 'approved';
    case 'Rejected': return 'rejected';
    case 'Cancelled': return 'cancelled';
    default: return 'review'; // las 3 pendientes
  }
}

// El día de calendario de una reserva viene como "2026-11-11T00:00:00Z".
// Tomamos solo "yyyy-MM-dd" y lo formateamos en UTC para que no cambie de día.
export function shortDateEs(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  const text = new Intl.DateTimeFormat('es', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  })
    .format(new Date(Date.UTC(y, m - 1, d)))
    .replace(/\./g, '')   // "mié." → "mié"
    .replace(',', '');    // "mié, 21 oct" → "mié 21 oct"
  return capitalize(text);
}

export function rsvCode(id: string): string {
  return `RSV-${id.replace(/-/g, '').slice(0, 8).toUpperCase()}`;
}

// ---------- Actividad reciente (dashboard-activity) ----------

// Mismo mapeo de roles que usa el módulo de usuarios, en español.
const ROLE_LABEL_ES: Record<string, string> = {
  Student: 'Estudiante',
  Teacher: 'Docente',
  Coordinator: 'Coordinador',
  Vicerrector: 'Vicerrector',
  Bienes: 'Bienes',
  Admin: 'Administrador',
};

// Frase legible para una entrada del feed /mine/activity.
// changedByRole viene null cuando el movimiento lo hizo el propio dueño
// (enviar o cancelar), así que ahí no corresponde decir "por X".
export function activityMessage(item: { newStatus: ReservationStatus; changedByRole: string | null }): string {
  const role = item.changedByRole ? (ROLE_LABEL_ES[item.changedByRole] ?? item.changedByRole) : null;

  switch (item.newStatus) {
    case 'PendingCoordinator': return 'Enviaste tu solicitud';
    case 'PendingVicerrector': return role ? `Tu reserva fue elevada a Vicerrectorado por ${role}` : 'Tu reserva fue elevada a Vicerrectorado';
    case 'PendingAssets': return role ? `Tu reserva fue autorizada por ${role}` : 'Tu reserva fue autorizada';
    case 'Approved': return role ? `Tu reserva fue aprobada por ${role}` : 'Tu reserva fue aprobada';
    case 'Rejected': return role ? `Tu reserva fue rechazada por ${role}` : 'Tu reserva fue rechazada';
    case 'Draft': return role ? `${role} devolvió tu reserva a borrador` : 'Tu reserva volvió a borrador';
    case 'Cancelled': return 'Cancelaste tu reserva';
    default: return 'Actualización en tu reserva';
  }
}

// changeDate es un instante UTC; new Date(iso) ya lo interpreta en hora
// LOCAL para mostrarlo (nunca forzar 'UTC' aquí, a diferencia de las fechas
// de calendario).
export function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diffMs / 60000);

  if (minutes < 1) return 'Ahora mismo';
  if (minutes < 60) return `Hace ${minutes} min`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Hace ${hours} h`;

  const days = Math.floor(hours / 24);
  if (days < 7) return `Hace ${days} d`;

  return capitalize(
    new Intl.DateTimeFormat('es', { day: 'numeric', month: 'short' }).format(new Date(iso))
  ).replace(/\./g, '');
}

