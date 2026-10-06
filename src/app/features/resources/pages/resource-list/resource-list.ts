import { Component, computed, inject, signal, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { ResourceService } from '../../services/resource.service';
import { Resource } from '../../models/resource.interface';
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
  private authService = inject(AuthService);

  resources = signal<Resource[]>([]);
  loading = signal(true);
  error = signal<string | null>(null);

  activeTab = signal<'active' | 'inactive' | 'all'>('active');
  search = signal('');

  filteredResources = computed(() => {
    const term = this.search().trim().toLowerCase();
    const tab = this.activeTab();

    return this.resources().filter(r => {
      const matchesTab =
        tab === 'all' ||
        (tab === 'active' && r.status) ||
        (tab === 'inactive' && !r.status);

      const matchesSearch =
        !term ||
        r.name.toLowerCase().includes(term) ||
        (r.description ?? '').toLowerCase().includes(term);

      return matchesTab && matchesSearch;
    });
  });

  canManageResources(): boolean {
    return this.authService.hasRole('Admin');
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

  setTab(tab: 'active' | 'inactive' | 'all'): void {
    this.activeTab.set(tab);
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

  isLowStock(r: Resource): boolean {
    return r.availableQuantity <= 2;
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