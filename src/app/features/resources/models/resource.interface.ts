// Lo que recibimos / mostramos
export interface Resource {
  id: string;
  name: string;
  description: string | null;
  availableQuantity: number;
  status: boolean;
}

// Enviamos para CREAR
export interface CreateResourceRequest {
  name: string;
  description: string | null;
  availableQuantity: number;
}

// Enviamos para EDITAR
export interface UpdateResourceRequest {
  name: string;
  description: string | null;
  availableQuantity: number;
}