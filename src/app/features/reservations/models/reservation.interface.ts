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
}

export interface ReservationResourceRequest {
  resourceId: string;
  quantity: number;
}


export interface CreateReservationRequest {
  date: string; 
  startTime: string; 
  endTime: string; 
  reason: string;
  spaceId: string | null;
  resources?: ReservationResourceRequest[];
}