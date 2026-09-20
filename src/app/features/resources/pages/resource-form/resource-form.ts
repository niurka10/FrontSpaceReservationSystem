import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ResourceService } from '../../services/resource.service';
import { CreateResourceRequest, UpdateResourceRequest } from '../../models/resource.interface';

@Component({
  selector: 'app-resource-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './resource-form.html',
  styleUrl: './resource-form.scss'
})
export class ResourceForm implements OnInit {
  private fb = inject(FormBuilder);
  private resourceService = inject(ResourceService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  isEdit = signal(false);
  loading = signal(false);
  saving = signal(false);
  error = signal<string | null>(null);
  resourceId = '';

  resourceForm = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(150)]],
    description: ['', [Validators.maxLength(500)]],
    availableQuantity: [1, [Validators.required, Validators.min(0)]]
  });

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.resourceId = id;
      this.isEdit.set(true);
      this.loadResource(id);
    }
  }

  loadResource(id: string): void {
    this.loading.set(true);
    this.error.set(null);
    this.resourceService.getById(id).subscribe({
      next: (resource) => {
        this.resourceForm.patchValue({
          name: resource.name,
          description: resource.description ?? '',
          availableQuantity: resource.availableQuantity
        });
        this.loading.set(false);
      },
      error: (err) => {
        console.error('Error al cargar recurso:', err);
        this.error.set('No se pudo cargar el recurso.');
        this.loading.set(false);
      }
    });
  }

  save(): void {
    if (this.resourceForm.invalid) {
      this.resourceForm.markAllAsTouched();
      return;
    }

    this.saving.set(true);
    this.error.set(null);
    const form = this.resourceForm.getRawValue();

    if (this.isEdit()) {
      const request: UpdateResourceRequest = {
        name: form.name,
        description: form.description || null,
        availableQuantity: form.availableQuantity
      };
      this.resourceService.update(this.resourceId, request).subscribe({
        next: () => this.router.navigate(['/resources']),
        error: (err) => {
          console.error('Error al actualizar recurso:', err);
          this.error.set('No se pudo actualizar el recurso.');
          this.saving.set(false);
        }
      });
    } else {
      const request: CreateResourceRequest = {
        name: form.name,
        description: form.description || null,
        availableQuantity: form.availableQuantity
      };
      this.resourceService.create(request).subscribe({
        next: () => this.router.navigate(['/resources']),
        error: (err) => {
          console.error('Error al crear recurso:', err);
          this.error.set('No se pudo crear el recurso.');
          this.saving.set(false);
        }
      });
    }
  }

  cancel(): void {
    this.router.navigate(['/resources']);
  }
}