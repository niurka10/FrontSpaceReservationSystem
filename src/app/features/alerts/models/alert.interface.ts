// Lo que recibimos / mostramos
export interface Alert {
  id: string;
  type: number;
  description: string;
  createdAt: string;
  createdBy: string | null;
  createdByName: string | null;
  resolvedAt: string | null;
  isResolved: boolean;
  resolutionObservation: string | null;
  resourceId: string | null;
  spaceId: string | null;
}

// Enviamos para CREAR
export interface CreateAlertRequest {
  type: number;
  description: string;
  resourceId: string | null;
  spaceId: string | null;
}

export interface ResolveAlertRequest {
  observation: string;
}