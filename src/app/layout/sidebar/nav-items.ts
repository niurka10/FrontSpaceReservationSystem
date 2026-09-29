import { RoleCode } from "../../core/auth/models/auth.model";

export interface NavItem {
    label: string;
    path?: string;
    icon?: string;
    roles: RoleCode[];
    children?: NavItem[]
}

export const ALL_ROLES: RoleCode[] = [
    'Student',
    'Teacher',
    'Coordinator',
    'Vicerrector',
    'Bienes',
    'Admin',
];

export const NAV_ITEMS: NavItem[] = [
    {
        label: 'Dashboard',
        path: '/dashboard',
        roles: ALL_ROLES,
    },
    {
        label: 'Calendario',
        path: '/reservations/calendar',
        roles: ['Student','Teacher','Coordinator']
    },

    {
        label: 'Mis reservas',
        path: '/reservations',
        roles: ['Student', 'Teacher','Coordinator'],
    },

    {
        label: 'Agregar Reservas',
        path: '/reservations/new',
        roles: ['Student', 'Teacher','Coordinator']
    },

    {
        label: 'Pendientes (Coordinador)',
        path: '/reservations/pending-coordinator',
        roles: ['Coordinator', 'Admin'],
    },

    {
      label: 'Autorizaciones',
      path: '/reservations/pending-vicerrector',
      roles: ['Vicerrector', 'Admin'],
    },
    // {
    //   label: 'Pendientes (Bienes)',
    //   path: '/reservations/pending-assets',
    //   roles: ['Bienes', 'Admin'],
    // },

    {
        label: 'Administración',
        roles: ['Admin'],
        children: [
            { label: 'Usuarios', path: '/users', roles: ['Admin'] },
            { label: 'Reservas (todas)', path: '/admin/reservations', roles: ['Admin'] },
        ],
    },

    {
        label: 'Catálogos',
        roles: ['Admin'],
        children: [
            { label: 'Facultades', path: '/faculties', roles: ['Admin'] },
            { label: 'Carreras', path: '/careers', roles: ['Admin'] },
        ],
    },

    {
        label: 'Recursos',
        // Bienes también necesita ver espacios/recursos para poder asignar —
        // ajusta esta lista si no es el caso.
        roles: ['Admin', 'Bienes'],
        children: [
            { label: 'Espacios', path: '/spaces', roles: ['Admin', 'Bienes'] },
            { label: 'Recursos', path: '/resources', roles: ['Admin', 'Bienes'] },
        ],
    },

    {
        label: 'Alertas',
        path: '/alerts',
        roles: ['Student', 'Teacher', 'Coordinator', 'Vicerrector', 'Bienes', 'Admin'],
    },

    {
        label: 'Reportes',
        path: '/reports',
        roles: ['Admin'],
    },

]