import { Component, inject, signal, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { ResourceService } from '../../services/resource.service';
import { Resource } from '../../models/resource.interface';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../../../core/auth/auth.service';

@Component({
  selector: 'app-resource-list',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './resource-list.html',
  styleUrl: './resource-list.scss'
})
export class ResourceList implements OnInit {
  private resourceService = inject(ResourceService);
  private router = inject(Router);

  private authService = inject(AuthService)

  resources = signal<Resource[]>([]);
  loading = signal(true);
  error = signal<string | null>(null);

  canManageResources(): boolean {
    return this.authService.hasRole('Admin')
  }

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.resourceService.getAll().subscribe({
      next: (data) => {
        this.resources.set(data);
        this.loading.set(false);
      },
      error: (err) => {
        console.error('Error al cargar recursos:', err);
        this.error.set('No se pudieron cargar los recursos.');
        this.loading.set(false);
      }
    });
  }

  create(): void {
    this.router.navigate(['/resources/new']);
  }

  edit(id: string): void {
    this.router.navigate(['/resources', id, 'edit']);
  }

  get activeResources(): Resource[] {
    return this.resources().filter(resource => resource.status);
  }

  get inactiveResources(): Resource[] {
    return this.resources().filter(resource => !resource.status);
  }

  activate(id: string): void {
    this.resourceService.activate(id).subscribe({
      next: () => this.load(),
      error: (err) => {
        console.error('Error al activar recurso:', err);
        this.error.set('No se pudo activar el recurso.');
      }
    });
  }

  deactivate(id: string): void {
    this.resourceService.deactivate(id).subscribe({
      next: () => this.load(),
      error: (err) => {
        console.error('Error al desactivar recurso:', err);
        this.error.set('No se pudo desactivar el recurso.');
      }
    });
  }
}