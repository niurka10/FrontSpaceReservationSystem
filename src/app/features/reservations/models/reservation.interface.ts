export enum SpaceType {
  Classroom = 1,
  Laboratory = 2,
  Auditorium = 3,
  Cafeteria = 4,
  Others = 5
}

export const SPACE_TYPE_LABELS: Record<SpaceType, string> = {
    [SpaceType.Classroom]: 'Aula',
    [SpaceType.Laboratory]: 'Laboratorio',
    [SpaceType.Auditorium]: 'Auditorio',
    [SpaceType.Cafeteria]: 'Cafeteria',
    [SpaceType.Others]: 'Otros',
};

// Respuesta del GET /api/space (SpaceController.GetAll → SpaceResponse)
export interface SpaceOption {
    id: string,
    name: string,
    type: SpaceType,
    capacity: number,
    location: string,
    isActive: boolean
}

//Respuesta del Get de Resource response
export interface ResourceOption {
    id: string;
    name: string;
    description: string | null;
    availableQuantity: number;
    status: boolean;
}

export type ReservationStatus =
  | 'Draft'
  | 'PendingCoordinator'
  | 'PendingVicerrector'
  | 'PendingAssets'
  | 'Approved'
  | 'Rejected'
  | 'Cancelled';

  export const RESERVATION_STATUS_LABELS: Record<ReservationStatus, string> = {
  Draft: 'Borrador',
  PendingCoordinator: 'Pendiente de gestión',
  PendingVicerrector: 'Pend. autorización (Vicerrectorado)',
  PendingAssets: 'Autorizada · pend. asignación',
  Approved: 'Aprobada',
  Rejected: 'Rechazada',
  Cancelled: 'Cancelada',
};

export interface Reservation{
    id: string;
    date: string;
    startTime: string,
    endTime: string;
    reason: string,
    currentStatus: ReservationStatus;
    userId: string;
    spaceId: string | null;
    requesterName?: string;
    requesterRole?: string;
    spaceName?: string;
    careerName?: string;
}

export interface ReservationResourceItem {
  resourceName: string;
  quantity: number;
}

export interface ReservationHistoryEntry {
  newStatus: ReservationStatus;
  justification: string;
  changeDate: string;
  changedByName: string;
  changedByRole: string | null;
}
 
export interface ReservationDetail extends Reservation {
  resources: ReservationResourceItem[];
  history: ReservationHistoryEntry[];
}

export interface ReservationResourceRequest {
  resourceId: string;
  quantity: number;
}

export const RESERVATION_STEP_BY_STATUS: Record<ReservationStatus, number> = {
  Draft: 1,               // aún no se envía — sigue "en Solicitud"
  PendingCoordinator: 2,  // el Coordinador la tiene para revisar
  PendingVicerrector: 3,  // el Vicerrectorado la tiene para autorizar
  PendingAssets: 4,       // Bienes la tiene para asignar espacio
  Approved: 4,            // todo el flujo completo — el paso 4 también queda en verde
  Rejected: 0,            // rechazada: no hay "paso activo", se corta donde quedó
  Cancelled: 0,
};

// Etiqueta de cada entrada del historial. Se indexa por el NewStatus de la
// transición (no por PreviousStatus) porque cada acción de cada rol produce
// siempre el mismo NewStatus — no hace falta más info para saber qué pasó.
export const RESERVATION_HISTORY_ACTION_LABELS: Record<ReservationStatus, string> = {
  Draft: 'Rechazada por Coordinador — vuelve a edición',
  PendingCoordinator: 'Solicitud registrada',
  PendingVicerrector: 'Elevada a Vicerrectorado',
  PendingAssets: 'Autorizada por Vicerrectorado',
  Approved: 'Espacio asignado — Aprobada',
  Rejected: 'Rechazada',
  Cancelled: 'Cancelada por el solicitante',
};

export interface CreateReservationRequest {
  date: string; 
  startTime: string; 
  endTime: string; 
  reason: string;
  spaceId: string | null;
  resources?: ReservationResourceRequest[];
  onBehalfOfUserId?: string | null;
}