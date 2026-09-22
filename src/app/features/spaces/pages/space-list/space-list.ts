import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SpaceService } from '../../services/space.service';
import { Space } from '../../models/space.interface';
import { AuthService } from '../../../../core/auth/auth.service';

@Component({
  selector: 'app-space-list',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './space-list.html',
  styleUrl: './space-list.scss'
})
export class SpaceListComponent implements OnInit {

  private spaceService = inject(SpaceService);
  private authService = inject(AuthService);

  spaces = signal<Space[]>([]);
  loading = signal(true);
  error = signal('');

  // Verifica si el usuario tiene permiso para resolver alertas
  canManageSpaces(): boolean {
    return this.authService.hasRole('Admin');
  }

  ngOnInit(): void {
    this.loadSpaces();
  }

  loadSpaces(): void {
    this.loading.set(true);
    this.error.set('');

    this.spaceService.getAll().subscribe({
      next: (spaces) => {
        this.spaces.set(spaces);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('No se pudieron cargar los espacios.');
        this.loading.set(false);
      }
    });
  }

  get activeSpaces(): Space[] {
    return this.spaces().filter(space => space.isActive);
  }

  get inactiveSpaces(): Space[] {
    return this.spaces().filter(space => !space.isActive);
  }

  getSpaceType(type: number): string {
    switch (type) {
      case 1:
        return 'Aula';
      case 2:
        return 'Laboratorio';
      case 3:
        return 'Auditorio';
      case 4:
        return 'Cafetería';
      case 5:
        return 'Otro';
      default:
        return 'Desconocido';
    }
  }

  deactivate(id: string): void {
    this.spaceService.deactivate(id).subscribe({
      next: () => this.loadSpaces(),
      error: () => {
        this.error.set('No se pudo desactivar el espacio.');
      }
    });
  }

  activate(id: string): void {
    this.spaceService.activate(id).subscribe({
      next: () => this.loadSpaces(),
      error: () => {
        this.error.set('No se pudo activar el espacio.');
      }
    });
  }
}