import { Routes } from '@angular/router';

import { ResourceList } from './pages/resource-list/resource-list';
import { ResourceForm } from './pages/resource-form/resource-form';

export const RESOURCES_ROUTES: Routes = [

  {
    path: '',
    data: { title: 'Recursos' },
    component: ResourceList,
  },

  {
    path: 'new',
    data: { title: 'Nuevo Recurso' },
    component: ResourceForm,
  },

  {
    path: ':id/edit',
    data: { title: 'Editar Recurso' },
    component: ResourceForm,
  }

];