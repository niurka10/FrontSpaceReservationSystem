import { Reservation } from '../models/reservation.interface';

// Las transiciones (elevar, aprobar, asignar...) devuelven la reserva SIN los
// nombres enriquecidos (solicitante, rol, carrera, espacio): solo las listas
// los traen. Si reemplazáramos la fila con esa respuesta, la tabla mostraría
// el userId en vez del nombre. Aquí tomamos lo nuevo (estado, etc.) y
// conservamos los nombres que la fila ya tenía.
export function mergeReservation(current: Reservation, updated: Reservation): Reservation {
    return {
        ...current,
        ...updated,
        requesterName: updated.requesterName ?? current.requesterName,
        requesterRole: updated.requesterRole ?? current.requesterRole,
        careerName: updated.careerName ?? current.careerName,
        // El nombre del espacio solo se conserva si el espacio NO cambió.
        spaceName:
            updated.spaceName ??
            (updated.spaceId === current.spaceId ? current.spaceName : undefined),
    };
}